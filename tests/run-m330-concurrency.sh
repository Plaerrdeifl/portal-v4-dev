#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
database="m330_concurrency_$$"
cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists "$database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$container" createdb -U postgres -T template0 "$database"
docker exec "$container" pg_dump -U postgres -d postgres --no-owner --no-privileges \
  --exclude-extension=pg_cron --exclude-schema=cron --exclude-schema=vault \
  | docker exec -i "$container" psql -U postgres -d "$database" \
  >/tmp/m330-clone-$$.log 2>&1
docker cp supabase/migrations/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql "$container:/tmp/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql"
docker cp supabase/migrations/20260818194600_add_fanbus_change_notifications_m330_r1.sql "$container:/tmp/20260818194600_add_fanbus_change_notifications_m330_r1.sql"
docker cp supabase/tests/m330_concurrency_fixture.sql "$container:/tmp/m330_concurrency_fixture.sql"
docker cp supabase/tests/m330_concurrency_assert.sql "$container:/tmp/m330_concurrency_assert.sql"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/20260818194600_add_fanbus_change_notifications_m330_r1.sql
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/m330_concurrency_fixture.sql

run_race() {
  first="$1"
  second="$2"
  first_log="/tmp/m330-first-$$.log"
  second_log="/tmp/m330-second-$$.log"
  set +e
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "$first" >"$first_log" 2>&1 & first_pid=$!
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "$second" >"$second_log" 2>&1 & second_pid=$!
  wait "$first_pid"; first_status=$?
  wait "$second_pid"; second_status=$?
  set -e
  if [ "$first_status" -ne 0 ] && [ "$second_status" -ne 0 ]; then
    sed -n '1,100p' "$first_log"
    sed -n '1,100p' "$second_log"
    exit 1
  fi
}

run_race \
  "select app_private.m330_concurrency_cancel('00000000-0000-4330-9200-000000000001')" \
  "select app_private.m330_concurrency_book('00000000-0000-4330-9200-000000000001','00000000-0000-4330-9300-000000000011','booking-race-m330@example.invalid')"

waitlisted="$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-9200-000000000002' and status='WAITLISTED' limit 1")"
run_race \
  "select app_private.m330_concurrency_cancel('00000000-0000-4330-9200-000000000002')" \
  "select app_private.m330_concurrency_promote('$waitlisted')"

participant="$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-9200-000000000003' and status='ACTIVE' limit 1")"
run_race \
  "select app_private.m330_concurrency_cancel('00000000-0000-4330-9200-000000000003')" \
  "select app_private.m330_concurrency_operate('$participant','00000000-0000-4330-9400-000000000003')"

run_race \
  "select app_private.m330_concurrency_cancel('00000000-0000-4330-9200-000000000004')" \
  "select app_private.m330_concurrency_update('00000000-0000-4330-9200-000000000004')"

# Separate assignment fixture covers assignment versus cancellation as its own lock race.
select_assignment_seed="select app_private.m330_concurrency_book('00000000-0000-4330-9200-000000000005','00000000-0000-4330-9300-000000000051','assignment-race-m330@example.invalid')"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "$select_assignment_seed"
assignment_participant="$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-9200-000000000005' and status='ACTIVE' limit 1")"
run_race \
  "select app_private.m330_concurrency_cancel('00000000-0000-4330-9200-000000000005')" \
  "select app_private.m330_concurrency_assign('$assignment_participant','00000000-0000-4330-9400-000000000005')"

# If update won first, retry cancellation with the authoritative revision.
for trip in 1 2 3 4 5; do
  trip_id="00000000-0000-4330-9200-$(printf '%012d' "$trip")"
  status="$(docker exec "$container" psql -U postgres -d "$database" -Atc "select status from app_modules.fanbus_trips where id='$trip_id'")"
  if [ "$status" != "CANCELLED" ]; then
    docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "select app_private.m330_concurrency_cancel('$trip_id')"
  fi
done

docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/m330_concurrency_assert.sql
echo M330_CONCURRENCY_PASS

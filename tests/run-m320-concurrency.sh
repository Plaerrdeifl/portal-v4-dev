#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
fixture="/tmp/m320_concurrency_fixture.sql"
assertions="/tmp/m320_concurrency_assert.sql"

docker cp supabase/tests/m320_concurrency_fixture.sql "$container:$fixture"
docker cp supabase/tests/m320_concurrency_assert.sql "$container:$assertions"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$fixture"

deadline_log="/tmp/m320-deadline-lock-$$.log"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "begin; select id from app_modules.fanbus_trips where id='00000000-0000-4320-9200-000000000006' for update; select pg_sleep(2); update app_modules.fanbus_trips set registration_closes_at=clock_timestamp()-interval '100 milliseconds' where id='00000000-0000-4320-9200-000000000006'; commit;" \
  >"$deadline_log" 2>&1 &
deadline_lock_pid=$!
sleep 0.25
deadline_outcome="$(docker exec "$container" psql -U postgres -d postgres -Atc \
  "select app_private.m320_concurrency_single('00000000-0000-4320-9200-000000000006','deadline@example.invalid','00000000-0000-4320-9300-000000000061')->>'outcome'")"
wait "$deadline_lock_pid"
if [ "$deadline_outcome" != "CLOSED" ]; then
  sed -n '1,120p' "$deadline_log"
  echo "Expected CLOSED after waiting for the trip lock, got: $deadline_outcome"
  exit 1
fi
if [ "$(docker exec "$container" psql -U postgres -d postgres -Atc \
  "select count(*) from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000006'")" != "0" ]; then
  echo "Deadline race persisted a registration after registration_closes_at."
  exit 1
fi

run_pair() {
  first_sql="$1"
  second_sql="$2"
  expected="$3"
  first_log="/tmp/m320-concurrency-first-$$.log"
  second_log="/tmp/m320-concurrency-second-$$.log"

  set +e
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$first_sql" >"$first_log" 2>&1 &
  first_pid=$!
  docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$second_sql" >"$second_log" 2>&1 &
  second_pid=$!
  wait "$first_pid"
  first_status=$?
  wait "$second_pid"
  second_status=$?
  set -e

  if [ "$expected" = "both" ] && { [ "$first_status" -ne 0 ] || [ "$second_status" -ne 0 ]; }; then
    sed -n '1,120p' "$first_log"
    sed -n '1,120p' "$second_log"
    exit 1
  fi
  if [ "$expected" = "one" ] && { [ "$first_status" -eq "$second_status" ]; }; then
    sed -n '1,120p' "$first_log"
    sed -n '1,120p' "$second_log"
    exit 1
  fi
}

run_pair \
  "select app_private.m320_concurrency_single('00000000-0000-4320-9200-000000000001','single-a@example.invalid','00000000-0000-4320-9300-000000000011')" \
  "select app_private.m320_concurrency_single('00000000-0000-4320-9200-000000000001','single-b@example.invalid','00000000-0000-4320-9300-000000000012')" \
  both

run_pair \
  "select app_private.m320_concurrency_batch('00000000-0000-4320-9200-000000000002','batch-a@example.invalid','00000000-0000-4320-9300-000000000021')" \
  "select app_private.m320_concurrency_batch('00000000-0000-4320-9200-000000000002','batch-b@example.invalid','00000000-0000-4320-9300-000000000022')" \
  both

first_waitlisted="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000003' and status='WAITLISTED' order by waitlisted_at,participant_sequence,id limit 1")"
second_waitlisted="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000003' and status='WAITLISTED' order by waitlisted_at,participant_sequence,id offset 1 limit 1")"
run_pair \
  "select app_private.m320_concurrency_as_admin('PROMOTE',jsonb_build_object('id','$first_waitlisted','expectedRevision',1))" \
  "select app_private.m320_concurrency_as_admin('PROMOTE',jsonb_build_object('id','$second_waitlisted','expectedRevision',1))" \
  one

cancel_id="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000004' and status='ACTIVE' limit 1")"
run_pair \
  "select app_private.m320_concurrency_as_admin('CANCEL',jsonb_build_object('id','$cancel_id','expectedRevision',1))" \
  "select app_private.m320_concurrency_single('00000000-0000-4320-9200-000000000004','after-cancel@example.invalid','00000000-0000-4320-9300-000000000041')" \
  both

first_participant="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000005' and status='WAITLISTED' order by participant_sequence limit 1")"
second_participant="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000005' and status='WAITLISTED' order by participant_sequence offset 1 limit 1")"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "update app_modules.fanbus_registrations set status='ACTIVE',waitlisted_at=null where id in ('$first_participant','$second_participant')"
run_pair \
  "select app_private.m320_concurrency_as_admin('ASSIGN',jsonb_build_object('participantId','$first_participant','busId','00000000-0000-4320-9400-000000000001'))" \
  "select app_private.m320_concurrency_as_admin('ASSIGN',jsonb_build_object('participantId','$second_participant','busId','00000000-0000-4320-9400-000000000001'))" \
  one

assigned_participant="$(docker exec "$container" psql -U postgres -d postgres -Atc "select participant_id from app_modules.fanbus_bus_assignments where bus_id='00000000-0000-4320-9400-000000000001'")"
unassigned_participant="$(docker exec "$container" psql -U postgres -d postgres -Atc "select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4320-9200-000000000005' and status='ACTIVE' and id <> '$assigned_participant' limit 1")"
run_pair \
  "select app_private.m320_concurrency_as_admin('ASSIGN',jsonb_build_object('participantId','$assigned_participant','busId','00000000-0000-4320-9400-000000000002'))" \
  "select app_private.m320_concurrency_as_admin('ASSIGN',jsonb_build_object('participantId','$unassigned_participant','busId','00000000-0000-4320-9400-000000000002'))" \
  one

docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$assertions"
echo M320_CONCURRENCY_PASS

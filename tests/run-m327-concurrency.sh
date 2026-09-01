#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
database="m327_concurrency_$$"
cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists "$database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$container" createdb -U postgres -T template0 "$database"
docker exec "$container" pg_dump -U postgres -d postgres --no-owner --no-privileges \
  --exclude-extension=pg_cron --exclude-schema=cron --exclude-schema=vault \
  | docker exec -i "$container" psql -U postgres -d "$database" >/tmp/m327-clone-$$.log 2>&1
docker cp supabase/tests/m327_concurrency_fixture.sql "$container:/tmp/m327_concurrency_fixture.sql"
docker cp supabase/tests/m327_concurrency_assert.sql "$container:/tmp/m327_concurrency_assert.sql"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/m327_concurrency_fixture.sql

run_pair() {
  first_sql="$1"
  second_sql="$2"
  expected="$3"
  first_log="/tmp/m327-concurrency-first-$$.log"
  second_log="/tmp/m327-concurrency-second-$$.log"
  set +e
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "$first_sql" >"$first_log" 2>&1 & first_pid=$!
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -c "$second_sql" >"$second_log" 2>&1 & second_pid=$!
  wait "$first_pid"; first_status=$?
  wait "$second_pid"; second_status=$?
  set -e
  if [ "$expected" = "both" ] && { [ "$first_status" -ne 0 ] || [ "$second_status" -ne 0 ]; }; then
    sed -n '1,100p' "$first_log"; sed -n '1,100p' "$second_log"; exit 1
  fi
  if [ "$expected" = "one" ] && [ "$first_status" -eq "$second_status" ]; then
    sed -n '1,100p' "$first_log"; sed -n '1,100p' "$second_log"; exit 1
  fi
}

run_pair \
  "select app_private.m327_concurrency_append('00000000-0000-4328-8700-000000000001','First')" \
  "select app_private.m327_concurrency_append('00000000-0000-4328-8700-000000000002','Second')" \
  both
run_pair \
  "select app_private.m327_concurrency_self_update()" \
  "select app_private.m327_concurrency_operator_update()" \
  one

docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/m327_concurrency_assert.sql
echo M327_CONCURRENCY_PASS

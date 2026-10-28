#!/bin/sh
set -eu

container="cockpit-admin-r2-postgres-$$"
first_log="/tmp/cockpit-admin-first-$$.log"
second_log="/tmp/cockpit-admin-second-$$.log"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run -d --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-bookworm >/dev/null

until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 0.2
done
# The official image briefly exposes its initialization server before switching
# to the final postmaster. Require readiness once more after that handoff.
sleep 1
until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 0.2
done

docker cp supabase/tests/cockpit_admin_isolated_base.sql \
  "$container:/tmp/cockpit_admin_isolated_base.sql"
docker cp supabase/migrations/20261028175847_cockpit_admin_contract_r2.sql \
  "$container:/tmp/cockpit_admin_contract_r2.sql"
docker cp supabase/tests/cockpit_admin_contract.sql \
  "$container:/tmp/cockpit_admin_contract.sql"
docker cp supabase/tests/cockpit_admin_concurrency_fixture.sql \
  "$container:/tmp/cockpit_admin_concurrency_fixture.sql"
docker cp supabase/tests/cockpit_admin_concurrency_assert.sql \
  "$container:/tmp/cockpit_admin_concurrency_assert.sql"

docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/cockpit_admin_isolated_base.sql
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/cockpit_admin_contract_r2.sql
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/cockpit_admin_contract.sql
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/cockpit_admin_concurrency_fixture.sql

set +e
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c \
  "begin; select app_private.cockpit_admin_concurrent_self_demote('00000000-0000-4321-8000-000000000001'); select pg_sleep(2); commit;" \
  >"$first_log" 2>&1 &
first_pid=$!

sleep 0.2

docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c \
  "select app_private.cockpit_admin_concurrent_self_demote('00000000-0000-4321-8000-000000000002');" \
  >"$second_log" 2>&1 &
second_pid=$!

wait "$first_pid"
first_status=$?
wait "$second_pid"
second_status=$?
set -e

if [ "$first_status" -ne 0 ] || [ "$second_status" -ne 0 ]; then
  sed -n '1,120p' "$first_log"
  sed -n '1,120p' "$second_log"
  exit 1
fi

docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f /tmp/cockpit_admin_concurrency_assert.sql

echo COCKPIT_ADMIN_CONCURRENCY_PASS

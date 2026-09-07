#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
database="m340_slice3_concurrency_$$"
migration="20260906182716_add_fanbus_publishing_queue_m340.sql"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists "$database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$container" createdb -U postgres -T template0 "$database"
docker exec "$container" pg_dump -U postgres -d postgres --no-owner --no-privileges \
  --exclude-extension=pg_cron --exclude-schema=cron --exclude-schema=vault \
  | docker exec -i "$container" psql -U postgres -d "$database" \
  >"/tmp/m340-slice3-clone-$$.log" 2>&1
docker cp "supabase/migrations/$migration" "$container:/tmp/$migration"
docker cp supabase/tests/m340_slice3_concurrency_fixture.sql \
  "$container:/tmp/m340_slice3_concurrency_fixture.sql"
docker cp supabase/tests/m340_slice3_concurrency_assert.sql \
  "$container:/tmp/m340_slice3_concurrency_assert.sql"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
  -f "/tmp/$migration"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
  -f /tmp/m340_slice3_concurrency_fixture.sql

pids=""
for increment in $(seq 1 10); do
  docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
    -c "select public.pd_m340_fanbus_publishing_job_claim()" \
    >"/tmp/m340-slice3-claim-$increment-$$.log" 2>&1 &
  pids="$pids $!"
done

for pid in $pids; do
  wait "$pid"
done

docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 \
  -f /tmp/m340_slice3_concurrency_assert.sql
echo M340_SLICE3_CONCURRENCY_PASS

#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
fixture="/tmp/m320_backfill_fixture.sql"
migration="/tmp/20260814110000_add_fanbus_participants_m320_r1.sql"
assertions="/tmp/m320_backfill_assert.sql"

npx supabase db reset --local --version 20260812223000 --no-seed
docker cp supabase/tests/m320_backfill_fixture.sql "$container:$fixture"
docker cp \
  supabase/migrations/20260814110000_add_fanbus_participants_m320_r1.sql \
  "$container:$migration"
docker cp supabase/tests/m320_backfill_assert.sql "$container:$assertions"
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f "$fixture"
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f "$migration"
docker exec "$container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f "$assertions"

echo M320_BACKFILL_PASS

#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
docker cp supabase/migrations/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql "$container:/tmp/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql"
docker cp supabase/migrations/20260818194600_add_fanbus_change_notifications_m330_r1.sql "$container:/tmp/20260818194600_add_fanbus_change_notifications_m330_r1.sql"
docker cp supabase/tests/m330_fanbus_cancellation.sql "$container:/tmp/m330_fanbus_cancellation.sql"
docker cp supabase/tests/m330_local_suite.sql "$container:/tmp/m330_local_suite.sql"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/m330_local_suite.sql

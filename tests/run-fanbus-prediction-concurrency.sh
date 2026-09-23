#!/bin/sh
set -eu

container="supabase_db_portal-v4-dev"
database="fanbus_prediction_concurrency_$$"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists "$database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$container" createdb -U postgres -T template0 "$database"
docker exec "$container" pg_dump -U postgres -d postgres --no-owner --no-privileges \
  --exclude-extension=pg_cron --exclude-schema=cron --exclude-schema=vault \
  | docker exec -i "$container" psql -U postgres -d "$database" \
  >"/tmp/fanbus-prediction-clone-$$.log" 2>&1
docker cp supabase/tests/fanbus_prediction_concurrency_fixture.sql "$container:/tmp/fanbus_prediction_concurrency_fixture.sql"
docker cp supabase/tests/fanbus_prediction_concurrency_assert.sql "$container:/tmp/fanbus_prediction_concurrency_assert.sql"
docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/fanbus_prediction_concurrency_fixture.sql

run_pair() {
  first_sql="$1"
  second_sql="$2"
  expected="$3"
  first_log="/tmp/fanbus-prediction-first-$$.log"
  second_log="/tmp/fanbus-prediction-second-$$.log"
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

actor="00000000-0000-4555-9600-000000000001"
game="00000000-0000-4555-9650-000000000001"
run_pair \
  "begin; select set_config('request.jwt.claim.sub','$actor',true); select app_private.api_fanbus_prediction_entry_save('{\"gameId\":\"$game\",\"registrationId\":\"00000000-0000-4555-9640-000000000002\",\"tips\":[{\"dogsGoals\":2,\"opponentGoals\":0}]}'::jsonb); commit;" \
  "begin; select set_config('request.jwt.claim.sub','$actor',true); select app_private.api_fanbus_prediction_entry_save(jsonb_build_object('gameId','$game','participantId',(select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9640-000000000001'),'registrationId','00000000-0000-4555-9640-000000000001','expectedRevision',1,'tips','[{\"dogsGoals\":3,\"opponentGoals\":1}]'::jsonb)); commit;" \
  both

participant="$(docker exec "$container" psql -U postgres -d "$database" -Atc "select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9640-000000000001'")"
same_base="begin; select set_config('request.jwt.claim.sub','$actor',true); select app_private.api_fanbus_prediction_entry_save(jsonb_build_object('gameId','$game','participantId','$participant','registrationId','00000000-0000-4555-9640-000000000001','expectedRevision',2,"
run_pair \
  "$same_base'tips','[{\"dogsGoals\":4,\"opponentGoals\":2}]'::jsonb)); commit;" \
  "$same_base'tips','[{\"dogsGoals\":5,\"opponentGoals\":2}]'::jsonb)); commit;" \
  one

docker exec "$container" psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -f /tmp/fanbus_prediction_concurrency_assert.sql
echo FANBUS_PREDICTION_CONCURRENCY_PASS

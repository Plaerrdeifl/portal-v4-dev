import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath =
  'supabase/migrations/20260928105016_social_media_generator_fanbus_read.sql';

const migration = await fs.readFile(migrationPath, 'utf8');

test('generator fanbus read consumes central trip, event and boarding-stop data', () => {
  assert.match(
    migration,
    /create function app_private\.api_social_media_generator_fanbus_trips_list\(\)/
  );
  assert.match(migration, /from app_modules\.fanbus_trips as trip/);
  assert.match(migration, /join app_modules\.events as event/);
  assert.match(migration, /left join app_modules\.event_games as game/);
  assert.match(migration, /from app_modules\.fanbus_trip_boarding_stops as trip_stop/);
  assert.match(migration, /join app_modules\.fanbus_boarding_stops as stop/);

  for (const field of [
    "'tripId'",
    "'eventId'",
    "'eventDate'",
    "'eventTime'",
    "'destination'",
    "'opponentName'",
    "'priceCents'",
    "'departureAt'",
    "'boardingStops'"
  ]) {
    assert.match(migration, new RegExp(field));
  }
});

test('generator fanbus read stays read-only behind pd_api and generator access', () => {
  assert.match(migration, /social_media_generator_require_access\(\)/);
  assert.match(
    migration,
    /when 'social_media_generator_fanbus_trips_list' then 'READ'/
  );
  assert.match(
    migration,
    /return app_private\.api_social_media_generator_fanbus_trips_list\(\)/
  );
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /insert into app_modules/i);
  assert.doesNotMatch(migration, /update app_modules/i);
  assert.doesNotMatch(migration, /delete from app_modules/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*api_social_media_generator_fanbus_trips_list\(\)[\s\S]*to authenticated/
  );
});

test('generator fanbus read excludes cancelled trips without changing fanbus state', () => {
  assert.match(migration, /where trip\.status <> 'CANCELLED'/);
});

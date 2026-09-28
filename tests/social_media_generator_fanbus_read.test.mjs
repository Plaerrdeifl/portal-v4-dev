import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath =
  'supabase/migrations/20260928102500_social_media_generator_fanbus_read.sql';

const migration = await fs.readFile(migrationPath, 'utf8');

test('generator fanbus read uses canonical Fanbus and event data', () => {
  assert.match(migration, /from app_modules\.fanbus_trips as trip/);
  assert.match(migration, /join app_modules\.events as event/);
  assert.match(migration, /left join app_modules\.event_games as game/);
  assert.match(
    migration,
    /from app_modules\.fanbus_trip_boarding_stops as trip_stop/
  );
  assert.match(migration, /join app_modules\.fanbus_boarding_stops as stop/);
  assert.match(migration, /trip\.price_cents/);
  assert.match(migration, /game\.opponent_name/);
  assert.match(migration, /trip_stop\.departure_at/);
});

test('generator fanbus read is future-facing and excludes cancelled trips', () => {
  assert.match(migration, /trip\.status <> 'CANCELLED'/);
  assert.match(migration, /event\.event_date >= pg_catalog\.current_date/);
  assert.match(migration, /'boardingStops'/);
  assert.match(migration, /'priceCents'/);
  assert.match(migration, /'destination'/);
});

test('generator fanbus read stays read-only behind pd_api', () => {
  assert.match(
    migration,
    /when 'social_media_generator_fanbus_trips_list' then 'READ'/
  );
  assert.match(
    migration,
    /return app_private\.api_social_media_generator_fanbus_trips_list/
  );
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /insert into app_modules/i);
  assert.doesNotMatch(migration, /update app_modules/i);
  assert.doesNotMatch(migration, /delete from app_modules/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*api_social_media_generator_fanbus_trips_list\(jsonb\)[\s\S]*to authenticated/
  );
});

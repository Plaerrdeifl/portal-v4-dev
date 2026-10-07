import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath =
  'supabase/migrations/20260928094609_social_media_generator_matchday_score_read.sql';

const migration = await fs.readFile(migrationPath, 'utf8');

test('generator matchday score read uses canonical Liveticker state and actions', () => {
  assert.match(
    migration,
    /create function app_private\.api_social_media_generator_matchday_score_get\(/
  );
  assert.match(
    migration,
    /from app_modules\.liveticker_game_states as state/
  );
  assert.match(
    migration,
    /from app_modules\.liveticker_actions as action/
  );
  assert.match(migration, /action\.is_active/);
  assert.match(migration, /action\.payload ->> 'minute'/);
  assert.match(migration, /v_state\.completed_at/);
});

test('generator matchday score read exposes period and final projections', () => {
  for (const field of [
    "'homeScore'",
    "'awayScore'",
    "'periods'",
    "'period'",
    "'available'",
    "'status'",
    "'completedAt'"
  ]) {
    assert.match(migration, new RegExp(field));
  }

  assert.match(migration, /between 1 and 20/);
  assert.match(migration, /between 21 and 40/);
  assert.match(migration, /between 41 and 60/);
  assert.match(migration, /when v_state\.completed_at is not null then 'FINAL'/);
});

test('generator matchday score read stays read-only behind pd_api', () => {
  assert.match(
    migration,
    /when 'social_media_generator_matchday_score_get' then 'READ'/
  );
  assert.match(
    migration,
    /return app_private\.api_social_media_generator_matchday_score_get/
  );
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /insert into app_modules/i);
  assert.doesNotMatch(migration, /update app_modules/i);
  assert.doesNotMatch(migration, /delete from app_modules/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*api_social_media_generator_matchday_score_get\(jsonb\)[\s\S]*to authenticated/
  );
});

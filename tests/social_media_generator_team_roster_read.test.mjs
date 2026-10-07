import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath =
  'supabase/migrations/20260928094038_social_media_generator_team_roster_read.sql';

const migration = await fs.readFile(migrationPath, 'utf8');

test('generator roster read uses the canonical Liveticker players table', () => {
  assert.match(
    migration,
    /create function app_private\.api_social_media_generator_team_roster_get\(/
  );
  assert.match(
    migration,
    /perform app_private\.social_media_generator_require_access\(\)/
  );
  assert.match(migration, /from app_modules\.liveticker_players as player/);
  assert.match(migration, /where player\.team_id = v_team_id/);

  for (const field of [
    "'id'",
    "'name'",
    "'jerseyNumber'",
    "'position'",
    "'teamId'",
    "'active'"
  ]) {
    assert.match(migration, new RegExp(field));
  }
});

test('generator roster read stays behind pd_api and is classified READ', () => {
  assert.match(migration, /'social_media_generator_team_roster_get'/);
  assert.match(
    migration,
    /when 'social_media_generator_team_roster_get' then 'READ'/
  );
  assert.match(
    migration,
    /return app_private\.api_social_media_generator_team_roster_get/
  );
  assert.match(
    migration,
    /revoke all on function[\s\S]*api_social_media_generator_team_roster_get\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*api_social_media_generator_team_roster_get\(jsonb\)[\s\S]*to authenticated/
  );
});

test('generator roster read does not create a second roster model', () => {
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /insert into app_social_media/i);
  assert.doesNotMatch(migration, /update app_modules\.liveticker_players/i);
  assert.doesNotMatch(migration, /delete from app_modules\.liveticker_players/i);
});

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migrationPath =
  'supabase/migrations/20260928085337_social_media_generator_central_team_logos.sql';

async function migration() {
  return fs.readFile(migrationPath, 'utf8');
}

function functionBody(sql, signature) {
  const start = sql.indexOf(signature);
  assert.notEqual(start, -1, `missing ${signature}`);
  const end = sql.indexOf('$function$;', start);
  assert.notEqual(end, -1, `unterminated ${signature}`);
  return sql.slice(start, end + '$function$;'.length);
}

test('generator team APIs use only central Liveticker Storage logo metadata', async () => {
  const sql = await migration();
  const list = functionBody(
    sql,
    'create or replace function app_private.api_social_media_generator_media_teams_list()'
  );
  const get = functionBody(
    sql,
    'create or replace function app_private.api_social_media_generator_media_team_logo_get('
  );

  for (const body of [list, get]) {
    assert.match(body, /logo_storage_bucket/);
    assert.match(body, /logo_storage_path/);
    assert.doesNotMatch(body, /logo_asset_path/);
    assert.doesNotMatch(body, /logo_data/);
    assert.doesNotMatch(body, /dataBase64/i);
    assert.doesNotMatch(body, /encode\s*\(/i);
  }
});

test('generator matchday API exposes the same central Storage source', async () => {
  const sql = await migration();
  const matchday = functionBody(
    sql,
    'create or replace function app_private.api_social_media_generator_matchday_games_list()'
  );

  assert.match(matchday, /'logoStorageBucket'/);
  assert.match(matchday, /'logoStoragePath'/);
  assert.match(
    matchday,
    /logo_storage_bucket is not null[\s\S]*logo_storage_path is not null/
  );
  assert.doesNotMatch(matchday, /logo_asset_path/);
  assert.doesNotMatch(matchday, /logo_data/);
});

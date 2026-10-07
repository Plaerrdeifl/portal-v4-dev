import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migration = await fs.readFile(
  'supabase/migrations/20260928191905_social_media_liveticker_goal_scorers_snapshot.sql',
  'utf8'
);

test('headless Liveticker snapshots freeze cumulative Dogs scorer actions', () => {
  assert.match(
    migration,
    /social_media_liveticker_goal_scorers_snapshot\(/
  );
  assert.match(migration, /action\.is_active/);
  assert.match(migration, /action\.payload ->> 'team' = 'mighty'/);
  assert.match(migration, /when 'PERIOD_1' then 20/);
  assert.match(migration, /when 'PERIOD_2' then 40/);
  assert.match(migration, /'goalScorers'/);
  assert.match(migration, /action\.ordinal/);
  assert.doesNotMatch(migration, /group by[\s\S]*player/i);
});

test('converted penalty shots are goals while shootout and missed attempts stay out', () => {
  assert.match(migration, /action\.action_type = 'penalty'/);
  assert.match(migration, /action\.payload ->> 'subtype' = 'penalty_shot'/);
  assert.match(migration, /action\.payload ->> 'result' = 'scored'/);
  assert.match(migration, /then 'PENALTY_SHOT'/);
  assert.doesNotMatch(
    migration,
    /action\.action_type = 'shootout'[\s\S]*jsonb_agg/
  );
});

test('snapshot extension remains private and fails active legacy jobs explicitly', () => {
  assert.match(
    migration,
    /revoke all on function[\s\S]*social_media_liveticker_goal_scorers_snapshot\(uuid, text\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant execute on function[\s\S]*social_media_liveticker_goal_scorers_snapshot\(uuid, text\)[\s\S]*to postgres/
  );
  assert.match(migration, /SNAPSHOT_VERSION_UNSUPPORTED/);
  assert.doesNotMatch(migration, /grant[\s\S]*to authenticated/);
});

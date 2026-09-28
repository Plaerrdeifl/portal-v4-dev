import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const migration = await fs.readFile(
  'supabase/migrations/20260928165700_social_media_liveticker_headless_v1.sql',
  'utf8'
);
const edge = await fs.readFile(
  'supabase/functions/social-media-render-worker/index.ts',
  'utf8'
);

test('headless Liveticker queue exposes only period 1, period 2 and final', () => {
  assert.match(
    migration,
    /graphic_kind in \('PERIOD_1', 'PERIOD_2', 'FINAL'\)/
  );
  assert.doesNotMatch(
    migration,
    /graphic_kind in \([^\n]*PERIOD_3/
  );
  assert.match(
    migration,
    /social_media_generator_liveticker_render_start/
  );
  assert.match(
    migration,
    /social_media_generator_liveticker_render_get/
  );
});

test('headless snapshots freeze cumulative period scores and final result suffix', () => {
  assert.match(migration, /'cumulativeHomeScore'/);
  assert.match(migration, /'cumulativeAwayScore'/);
  assert.match(migration, /p_assume_final boolean default false/);
  assert.match(migration, /v_kind = 'FINAL'/);
  assert.match(migration, /v_result_suffix := 'n\. P\.'/);
  assert.match(migration, /v_result_suffix := 'n\. V\.'/);
  assert.match(migration, /SOCIAL_MEDIA_LIVETICKER_TEAM_LOGO_MISSING/);
});

test('headless worker RPCs remain service-role only', () => {
  assert.match(
    migration,
    /pd_social_media_liveticker_render_worker_claim/
  );
  assert.match(
    migration,
    /pd_social_media_liveticker_render_worker_complete/
  );
  assert.match(
    migration,
    /to postgres, service_role;/
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*pd_social_media_liveticker_render_worker_claim\(\)[\s\S]*to authenticated/
  );
});

test('render gateway validates and dispatches Liveticker worker messages', () => {
  for (const token of [
    'livetickerClaim',
    'livetickerHeartbeat',
    'livetickerComplete',
    'isLivetickerResult',
    'pd_social_media_liveticker_render_worker_claim',
    'pd_social_media_liveticker_render_worker_complete'
  ]) {
    assert.match(edge, new RegExp(token));
  }
  assert.match(edge, /value\.artifacts\.length !== 2/);
  assert.match(edge, /kinds\[0\] === "POST" && kinds\[1\] === "STORY"/);
});

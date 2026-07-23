import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("web push badge and quiet time FIX3 contracts", async () => {
  const migration = await read("supabase/migrations/20260723234500_fix_web_push_badge_and_quiet_time.sql");
  const push = await read("js/push.js");
  const tasks = await read("js/modules/tasks.js");
  const css = await read("css/app.css");
  const worker = await read("service-worker.js");

  assert.match(migration, /event_type = 'PUSH_TEST'/);
  assert.match(migration, /notification\.event_type <> 'PUSH_TEST'/);
  assert.match(migration, /read_at = coalesce\(read_at, created_at, now\(\)\)/);

  assert.match(push, /const quietHoursEnabled = Boolean\(preferences\.quietHoursEnabled\);/);
  assert.match(push, /class="v4-push-quiet-grid \${quietHoursEnabled \? "is-enabled" : "is-disabled"}"/);
  assert.match(push, /quietStart\.readOnly = !active;/);
  assert.match(push, /quietEnd\.readOnly = !active;/);
  assert.match(push, /quietStart\.setAttribute\('aria-disabled', String\(!active\)\);/);
  assert.match(push, /quietEnd\.setAttribute\('aria-disabled', String\(!active\)\);/);
  assert.match(push, /window\.setTimeout\(\(\) =>/);
  assert.match(push, /__V4_PUSH_BADGE_QUIETTIME_FIX3_APPLIED__/);
  assert.doesNotMatch(push, /readonly aria-disabled="true""/);

  assert.match(tasks, /await window\.plaerrdeiflPush\?\.syncBadge\?\.\(\);/);
  assert.doesNotMatch(tasks, /plaerrdeifl:notifications-changed/);

  assert.match(css, /V4 WEB PUSH BADGE QUIETTIME FIX1/);
  assert.match(css, /pointer-events:none!important/);
  assert.match(worker, /pd-portal-v4-web-push-badge-quiettime-fix1-20260723/);
});

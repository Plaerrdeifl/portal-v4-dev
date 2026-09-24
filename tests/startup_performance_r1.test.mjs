import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("startup performance R1 avoids eager fanbus and duplicate badge work", async () => {
  const [html, pages, push, taskPush, worker] = await Promise.all([
    read("index.html"),
    read("js/pages.js"),
    read("js/push.js"),
    read("js/task-push-r3.js"),
    read("service-worker.js")
  ]);

  for (const eagerModule of [
    "m328-trip-edit-ios-fields.js",
    "m328-trip-subpage-back.js",
    "p800-r2-fanbus-ux.js",
    "fanbus-user-standards.js",
    "m320-r3-auto-assignment.js",
    "m326-person-picker-ux.js",
    "m326-manual-composer-ux.js",
    "m326-registration-status-ux.js"
  ]) {
    assert.doesNotMatch(html, new RegExp(`<script[^>]+src="[^"]*${eagerModule}`, "i"));
    assert.match(pages, new RegExp(eagerModule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(pages, /const FANBUS_ENHANCEMENT_MODULES = Object\.freeze/);
  assert.match(pages, /function ensureFanbusEnhancements\(\)/);
  assert.equal(
    (pages.match(/await ensureFanbusEnhancements\(\);/g) || []).length,
    2
  );

  assert.match(push, /new CustomEvent\("pd-badge-sync-request"\)/);
  assert.doesNotMatch(push, /window\.setInterval\([\s\S]*updateBadge/);
  assert.doesNotMatch(push, /window\.addEventListener\("online",[\s\S]*updateBadge/);

  assert.match(taskPush, /const BADGE_SYNC_MIN_INTERVAL_MS = 30000;/);
  assert.match(taskPush, /let badgeSyncPromise = null;/);
  assert.match(taskPush, /window\.addEventListener\("pd-badge-sync-request"/);
  assert.match(taskPush, /synchronizeAuthoritativeBadge\(auth\.current\(\), \{ force: true \}\)/);

  assert.match(
    worker,
    /const STARTUP_PERFORMANCE_CACHE_VERSION = "pd-portal-v4-startup-performance-r1-fanbus-add-person-mobile1-20260924";/
  );
  assert.match(worker, /async function cacheFirstStatic\(request, url\)/);
  assert.match(worker, /event\.respondWith\(cacheFirstStatic\(request, url\)\)/);
});

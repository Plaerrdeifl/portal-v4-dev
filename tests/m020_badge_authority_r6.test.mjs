import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read(
  "../supabase/migrations/20260830225000_m020_badge_authoritative_snapshot_r6.sql"
);
const pushConsumer = read("../js/task-push-r3.js");
const worker = read("../service-worker.js");

test("M020 R6 snapshot makes badgeEnabled=false authoritative", () => {
  assert.match(migration, /preference\.badge_enabled/);
  assert.match(
    migration,
    /case when coalesce\(v_badge_enabled, true\) then v_unread_count else 0 end/
  );
  assert.match(migration, /set search_path = ''/);
});

test("M020 R6 clears badge on account identity change before syncing the new user", () => {
  assert.match(pushConsumer, /if \(userId !== badgeAuthUserId\)/);
  assert.match(pushConsumer, /badgeAuthUserId = userId;\s*await setLocalBadge\(0\);/m);
  assert.match(pushConsumer, /const snapshot = await api\.call\("push_snapshot"\)/);
  assert.match(
    pushConsumer,
    /revision !== badgeSyncRevision\s*\|\|\s*currentAuthUserId\(\) !== userId/m
  );
  assert.match(
    pushConsumer,
    /snapshot\?\.preferences\?\.badgeEnabled === false\s*\? 0\s*: Number\(snapshot\?\.unreadNotificationCount \|\| 0\)/m
  );
});

test("M020 R6 stale push payloads are followed by server-authoritative sync", () => {
  assert.match(
    pushConsumer,
    /event\.data\?\.type === "PUSH_STATE_CHANGED"\)[\s\S]*void synchronizeAuthoritativeBadge\(\)/m
  );
  assert.doesNotMatch(
    pushConsumer,
    /event\.data\?\.type === "PUSH_STATE_CHANGED"[\s\S]{0,240}event\.data\.badgeCount/m
  );
});

test("PROD R6 rotates the service-worker shell cache", () => {
  assert.match(worker, /pd-portal-v4-prod-r6-readiness-20260830/);
  assert.match(
    worker,
    /keys\.filter\(key => key\.startsWith\("pd-portal-"\) && key !== APP_CACHE\)/
  );
});

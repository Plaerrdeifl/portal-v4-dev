import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pushConsumer = read("../js/task-push-r3.js");
const worker = read("../service-worker.js");

test("M020 R6 consumes server badgeEnabled and unread count as one authoritative snapshot", () => {
  assert.match(pushConsumer, /const snapshot = await api\.call\("push_snapshot"\)/);
  assert.match(
    pushConsumer,
    /snapshot\?\.preferences\?\.badgeEnabled === false\s*\? 0\s*: Number\(snapshot\?\.unreadNotificationCount \|\| 0\)/m
  );
});

test("M020 R6 clears badge on account identity change before syncing the new user", () => {
  assert.match(pushConsumer, /if \(userId !== badgeAuthUserId\)/);
  assert.match(pushConsumer, /badgeAuthUserId = userId;\s*await setLocalBadge\(0\);/m);
  assert.match(
    pushConsumer,
    /revision !== badgeSyncRevision\s*\|\|\s*currentAuthUserId\(\) !== userId/m
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

test("PROD R6 rotates the final service-worker shell cache while retaining compatibility markers", () => {
  assert.match(worker, /const CACHE_VERSION = "pd-portal-v4-m900-platform-mode-r1-20260823"/);
  assert.match(worker, /const R6_CACHE_VERSION = "pd-portal-v4-prod-r6-final-20260830"/);
  assert.match(worker, /const APP_CACHE = `\$\{R6_CACHE_VERSION\}-shell`/);
  assert.match(
    worker,
    /keys\.filter\(key => key\.startsWith\("pd-portal-"\) && key !== APP_CACHE\)/
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("task access R3 enforces role visibility and immediate-only transfer", async () => {
  const migration = await read(
    "supabase/migrations/20260724000500_fix_task_access_immediate_transfer_and_push_deeplinks.sql"
  );

  const visibilityStart = migration.indexOf(
    "create or replace function app_private.task_is_visible"
  );
  const visibilityEnd = migration.indexOf(
    "create or replace function app_private.task_notification_queue",
    visibilityStart
  );
  const visibility = migration.slice(visibilityStart, visibilityEnd);

  assert.match(visibility, /has_capability\(p_user_id, 'tasks\.manage'\)/);
  assert.match(visibility, /task\.assigned_user_id = p_user_id/);
  assert.match(visibility, /app_private\.is_office_holder\(p_user_id\)/);
  assert.match(visibility, /task\.context_type = 'TEAM'/);
  assert.match(visibility, /app_private\.is_team_member\(p_user_id, task\.team_id\)/);
  assert.doesNotMatch(visibility, /task\.created_by = p_user_id/);

  assert.match(migration, /v_operation <> 'IMMEDIATE'/);
  assert.match(migration, /Übertragungsanfragen sind deaktiviert/);
  assert.match(migration, /'IMMEDIATE',[\s\S]+?'ACCEPTED'/);
  assert.match(migration, /membership\.team_role in \('LEAD', 'CO_LEAD'\)/);
  assert.match(migration, /task\.status <> 'ARCHIVED'/);
  assert.match(migration, /create or replace function app_private\.api_mark_notification_read/);
  assert.match(migration, /v_action = 'mark_notification_read'/);
  assert.match(migration, /'canTransfer', false/);
});

test("push R3 refreshes deep links and clears read badges", async () => {
  const bridge = await read("js/task-push-r3.js");
  const worker = await read("service-worker.js");
  const index = await read("index.html");

  assert.match(bridge, /api\.call\("mark_notification_read"/);
  assert.match(bridge, /await auth\.refresh\(\)/);
  assert.match(bridge, /notificationId/);
  assert.match(bridge, /\[data-open-task\]/);
  assert.match(bridge, /\[data-request-transfer\]/);
  assert.match(bridge, /button\.textContent = "Aufgabe übertragen"/);
  assert.match(bridge, /clearAppBadge/);

  assert.match(worker, /task-access-push-r3/);
  assert.match(worker, /pd-portal-v4-push-newtasks-quiettime-r1-20260723/);
  assert.match(worker, /routeWithNotification/);
  assert.match(worker, /notificationId/);
  assert.match(worker, /Math\.max\(0, previousBadgeCount - 1\)/);
  assert.doesNotMatch(worker, /client\.navigate/);
  assert.match(worker, /\.\/js\/task-push-r3\.js/);

  assert.match(index, /js\/task-push-r3\.js/);
});

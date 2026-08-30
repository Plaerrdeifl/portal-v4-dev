import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260830100500_m020_push_read_outbox_compat.sql");
const pushConsumer = read("../js/task-push-r3.js");

test("M020 central push IDs resolve to the projected user notification", () => {
  assert.match(migration, /create or replace function app_private\.api_mark_notification_read/);
  assert.match(migration, /app_private\.notification_outbox as outbox/);
  assert.match(migration, /outbox\.id = v_notification_id/);
  assert.match(migration, /outbox\.recipient_user_id = v_actor/);
  assert.match(migration, /notification\.event_key = \(/);
  assert.match(migration, /'m020:' \|\| outbox\.event_id::text \|\| ':' \|\| v_actor::text/);
  assert.match(migration, /notification\.id = v_resolved_notification_id/);
});

test("M020 push deep links still acknowledge through the central mark-read API", () => {
  assert.match(pushConsumer, /api\.call\("mark_notification_read"/);
  assert.match(pushConsumer, /notificationId,/);
  assert.match(pushConsumer, /applyBadge\(result\?\.unreadNotificationCount \|\| 0\)/);
});

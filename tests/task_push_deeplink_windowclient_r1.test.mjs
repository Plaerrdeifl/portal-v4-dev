import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("task notifications carry a concrete route end to end", async () => {
  const created = await read("supabase/migrations/20260723235500_add_task_created_push_r1.sql");
  const taskPush = await read("supabase/migrations/20260724000500_fix_task_access_immediate_transfer_and_push_deeplinks.sql");
  const sender = await read("supabase/functions/send-web-push/index.ts");

  assert.ok(created.includes("'#/tasks?taskId=' || new.id::text"));
  assert.ok(taskPush.includes("'#/tasks?taskId=' || p_task_id::text"));
  assert.ok(sender.includes('route: item.route || "#/dashboard"'));
  assert.ok(sender.includes("notificationId: item.notificationId"));
});

test("existing PWA windows always receive the route fallback after navigate", async () => {
  const worker = await read("service-worker.js");

  assert.ok(worker.includes("async function openPushRouteInExistingClient"));
  assert.ok(worker.includes("let destination = client"));
  assert.ok(worker.includes("const navigated = await client.navigate(targetUrl)"));
  assert.ok(worker.includes("destination = navigated"));
  assert.ok(worker.includes("destination.postMessage(message)"));
  assert.ok(worker.includes("return destination.focus()"));
  assert.ok(!worker.includes("return navigated.focus()"));
  assert.ok(worker.includes("return self.clients.openWindow(targetUrl)"));
  assert.ok(worker.includes("routeWithNotification"));
});

test("task-push-r3 owns the OPEN_PUSH_ROUTE page fallback", async () => {
  const push = await read("js/push.js");
  const bridge = await read("js/task-push-r3.js");

  assert.ok(!push.includes("OPEN_PUSH_ROUTE"));
  assert.ok(bridge.includes("OPEN_PUSH_ROUTE"));
  assert.ok(bridge.includes("openPushDestination"));
  assert.ok(bridge.includes("location.hash = next"));
  assert.ok(push.includes("const __V4_TASK_PUSH_DEEPLINK_WINDOWCLIENT_R1__ = true;"));
});

test("startup preserves the push hash and tasks open the requested id", async () => {
  const app = await read("js/app.js");
  const tasks = await read("js/modules/tasks.js");

  assert.ok(app.includes("const hadInitialHash = Boolean(location.hash)"));
  assert.ok(app.includes("if (!hadInitialHash)"));
  assert.ok(tasks.includes('const requestedTaskId = params.get("taskId")'));
  assert.ok(tasks.includes("if (requestedTask) openTaskDetails(requestedTask)"));
});

test("cache retains previous compatibility markers", async () => {
  const worker = await read("service-worker.js");

  for (const marker of [
    "pd-portal-v4-task-push-deeplink-windowclient-r1-20260724",
    "pd-portal-v4-admin-task-access-r1-20260724",
    "pd-portal-v4-offices-save-corr1-20260724",
    "pd-portal-v4-task-access-push-r3-20260724",
    "pd-portal-v4-push-newtasks-quiettime-r1-20260723"
  ]) assert.ok(worker.includes(marker));
});

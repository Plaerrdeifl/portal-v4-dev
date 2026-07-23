import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("task workflow R2 supports waiting transfer reads and notification outbox", async () => {
  const migration = await read("supabase/migrations/20260723190000_add_task_workflow_r2_core.sql");
  const tasks = await read("js/modules/tasks.js");
  const css = await read("css/app.css");
  const worker = await read("service-worker.js");

  assert.match(migration, /status in \('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'ARCHIVED'\)/);
  assert.match(migration, /waiting_reason text not null/);
  assert.match(migration, /waiting_deadline timestamptz/);
  assert.match(migration, /status_changed_at timestamptz/);
  assert.match(migration, /create table app_modules\.task_transfers/);
  assert.match(migration, /'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'/);
  assert.match(migration, /create table app_modules\.task_history_reads/);
  assert.match(migration, /create table app_portal\.notifications/);
  assert.match(migration, /create or replace function app_private\.api_task_transfer/);
  assert.match(migration, /when.*WAITING/s);
  assert.match(migration, /TASK_TRANSFER_REQUESTED/);
  assert.match(migration, /TRANSFER_ACCEPTED/);
  assert.match(migration, /Die Zuständigkeit kann nur über „Aufgabe übertragen“ geändert werden/);
  assert.match(migration, /when 'task_transfer'|v_action = 'task_transfer'/);
  assert.match(
    migration,
    /status <> 'WAITING'[\s\S]+waiting_started_at is not null/
  );
  assert.match(
    migration,
    /api_save_task_before_workflow_r2\(v_safe_payload\)/
  );
  assert.match(
    migration,
    /coalesce\(v_transfer\.from_user_id, v_transfer\.requested_by\)/
  );
  assert.match(
    migration,
    /Die Zielperson ist für die inzwischen geänderte Aufgabe nicht mehr zulässig/
  );

  assert.match(tasks, /\{ value: "WAITING", label: "Wartet" \}/);
  assert.match(tasks, /Worauf wird gewartet\?/);
  assert.match(tasks, /Wartefrist \(optional\)/);
  assert.match(tasks, /call\("task_transfer"/);
  assert.match(
    tasks,
    /operation:\s*immediate\s*\?\s*"IMMEDIATE"\s*:\s*"REQUEST"/
  );
  assert.match(tasks, /operation:\s*"ACCEPT"/);
  assert.match(
    tasks,
    /openTransferResponse\(task,\s*"REJECT"\)/
  );
  assert.match(
    tasks,
    /openTransferResponse\(task,\s*"CANCEL"\)/
  );
  assert.match(tasks, /unreadUpdateCount/);
  assert.match(tasks, /Aufgabe übertragen/);
  assert.match(tasks, /WAITING_STARTED: "Wartephase begonnen"/);
  assert.match(tasks, /TRANSFER_ACCEPTED: "Aufgabe übernommen"/);
  assert.doesNotMatch(tasks, /<span>Meine Notiz<\/span>/);

  assert.match(css, /V4 TASK WORKFLOW R2 CORE/);
  assert.match(worker, /pd-portal-v4-task-workflow-r2-core-20260723/);
});

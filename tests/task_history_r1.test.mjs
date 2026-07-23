import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("task history is chronological, audited and editable for 30 minutes", async () => {
  const migration = await read(
    "supabase/migrations/20260723162000_add_task_history.sql"
  );
  const tasks = await read("js/modules/tasks.js");
  const css = await read("css/app.css");
  const worker = await read("service-worker.js");

  assert.match(migration, /create table app_modules\.task_updates/);
  assert.match(migration, /interval '30 minutes'/);
  assert.match(migration, /'editWindowMinutes', 30/);
  assert.match(migration, /TASK_UPDATE_CREATED/);
  assert.match(migration, /TASK_UPDATE_EDITED/);
  assert.match(migration, /TASK_UPDATE_HIDDEN/);
  assert.match(migration, /visibility in \('TASK', 'PRIVATE'\)/);
  assert.match(migration, /LEGACY_NOTE/);
  assert.match(migration, /legacyRevision/);
  assert.match(migration, /legacyTimestampAvailable/);
  assert.match(
    migration,
    /md5\(note\.task_id::text \|\| ':' \|\| note\.user_id::text\)::uuid/
  );
  assert.doesNotMatch(migration, /note\.created_at/);
  assert.doesNotMatch(migration, /note\.updated_at/);
  assert.doesNotMatch(migration, /note\.id/);
  assert.match(migration, /source_note_id uuid unique/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /api_task_history_snapshot/);
  assert.match(migration, /v_operation = 'LIST'/);
  assert.match(migration, /v_operation = 'ADD'/);
  assert.match(migration, /v_operation = 'EDIT'/);
  assert.match(migration, /v_operation = 'HIDE'/);
  assert.match(
    migration,
    /Das 30-Minuten-Bearbeitungsfenster ist abgelaufen/
  );

  assert.match(tasks, /Aufgabenverlauf/);
  assert.match(tasks, /operation: "LIST"/);
  assert.match(tasks, /operation: "ADD"/);
  assert.match(tasks, /operation: "EDIT"/);
  assert.match(tasks, /operation: "HIDE"/);
  assert.match(tasks, /30 Minuten lang korrigiert/);
  assert.match(tasks, />Verlauf<\/button>/);
  assert.doesNotMatch(tasks, />Notiz<\/button>/);

  assert.match(css, /V4 TASK HISTORY R1/);
  assert.match(worker, /pd-portal-v4-push-newtasks-quiettime-r1-20260723/);
});

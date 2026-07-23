import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("new tasks create push notifications for the same visible audience", async () => {
  const migration = await read(
    "supabase/migrations/20260723235500_add_task_created_push_r1.sql"
  );
  const push = await read("js/push.js");
  const worker = await read("service-worker.js");

  assert.match(
    migration,
    /add column new_tasks boolean not null default true/
  );
  assert.match(
    migration,
    /when p_event_type = 'TASK_CREATED'[\s\S]+then preference\.new_tasks/
  );
  assert.match(
    migration,
    /create or replace function app_private\.queue_task_created_push_r1\(\)/
  );
  assert.match(migration, /after insert on app_modules\.tasks/);
  assert.match(
    migration,
    /app_private\.task_is_visible\(recipient\.id, new\.id\)/
  );
  assert.match(
    migration,
    /recipient\.id is distinct from new\.created_by/
  );
  assert.match(migration, /'task-created:' \|\| new\.id::text/);
  assert.match(migration, /'TASK_CREATED'/);
  assert.match(migration, /'#\/tasks\?taskId=' \|\| new\.id::text/);
  assert.match(migration, /'newTasks', preference\.new_tasks/);
  assert.match(
    migration,
    /new_tasks =[\s\S]+p_payload ->> 'newTasks'/
  );

  assert.match(push, /<strong>Neue Aufgaben<\/strong>/);
  assert.match(push, /name="newTasks"/);
  assert.match(
    push,
    /newTasks: form\.elements\.newTasks\.checked/
  );

  assert.match(worker, /pd-portal-v4-push-newtasks-quiettime-r1-20260723/);
});

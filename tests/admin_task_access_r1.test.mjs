import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("admin exposes additive user task access controls", async () => {
  const admin = await read("js/modules/admin.js");

  assert.match(admin, /function editTaskAccess\(user\)/);
  assert.match(admin, /data-edit-user-task-access=/);
  assert.match(admin, /call\("save_user_task_access"/);
  assert.match(admin, /viewAllTeamTasks/);
  assert.match(admin, /viewBoardTasks/);
  assert.match(admin, /archiveScope/);
  assert.match(admin, /archiveTeamIds/);
  assert.doesNotMatch(admin, /name="canCreateTasks"/);
  assert.doesNotMatch(admin, /name="canManageTasks"/);
  assert.match(admin, /function editPersonalCapabilities\(user\)/);
  assert.match(admin, /set_user_capabilities/);
  assert.match(admin, /canDirectTransfer/);
  assert.match(admin, /Auf Rollenstandard zurücksetzen/);
  assert.match(
    admin,
    /const __V4_ADMIN_TASK_ACCESS_R1__ = true;/
  );
});

test("task sections are generated from effective access", async () => {
  const tasks = await read("js/modules/tasks.js");

  assert.match(tasks, /function taskAccess\(\)/);
  assert.match(tasks, /function availableTaskFilters\(\)/);
  assert.match(tasks, /function normalizeTaskView\(\)/);
  assert.match(tasks, /access\.archiveFull/);
  assert.match(tasks, /access\.archiveAllTeams/);
  assert.match(tasks, /access\.archiveOwn/);
  assert.match(tasks, /access\.archiveTeamIds/);
  assert.match(tasks, /const filters = availableTaskFilters\(\);/);
  assert.doesNotMatch(
    tasks,
    /const filters = \[\s*\["mine"[\s\S]+?\["archive"/
  );
  assert.match(
    tasks,
    /const __V4_ADMIN_TASK_ACCESS_TASKS_R1__ = true;/
  );
});

test("migration stores overrides and enforces server access", async () => {
  const migration = await read(
    "supabase/migrations/20260724113000_add_admin_task_access_overrides.sql"
  );

  assert.match(
    migration,
    /create table app_portal\.user_task_access_overrides/
  );
  assert.match(
    migration,
    /create table app_portal\.user_task_archive_teams/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_access_profile/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_archive_is_visible/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_is_visible/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_save_user_task_access/
  );
  assert.match(
    migration,
    /require_capability\('portal\.admin'\)/
  );
  assert.match(migration, /USER_TASK_ACCESS_UPDATED/);
  assert.match(migration, /USER_TASK_ACCESS_RESET/);
  assert.match(
    migration,
    /archive_scope = 'SELECTED_TEAMS'/
  );
  assert.match(migration, /'save_user_task_access'/);
});

test("task actions remain individually scoped", async () => {
  const migration = await read(
    "supabase/migrations/20260724113000_add_admin_task_access_overrides.sql"
  );

  assert.match(
    migration,
    /create or replace function app_private\.task_can_create_team/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_can_create_board/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_can_direct_transfer/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_transfer_target_allowed/
  );
  assert.match(
    migration,
    /Direkte Aufgabenübertragung ist nicht erlaubt/
  );
  assert.match(
    migration,
    /Die Zuständigkeit kann nur über „Aufgabe übertragen“ geändert werden/
  );
});

test("PWA cache keeps all compatibility markers", async () => {
  const worker = await read("service-worker.js");

  assert.match(
    worker,
    /pd-portal-v4-admin-task-access-r1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-offices-save-corr1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-task-access-push-r3-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-push-newtasks-quiettime-r1-20260723/
  );
});

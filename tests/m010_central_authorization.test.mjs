import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const migrationPath =
  "supabase/migrations/20260810140000_add_central_user_capabilities_m010_r1.sql";

test("M010 creates the protected central personal-capability model", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /create table app_portal\.user_capabilities/);
  assert.match(migration, /primary key \(user_id, capability_code\)/);
  assert.match(migration, /references app_portal\.users\(id\)/);
  assert.match(migration, /references app_portal\.capabilities\(code\)/);
  assert.match(migration, /check \(capability_code <> 'portal\.admin'\)/);
  assert.match(
    migration,
    /alter table app_portal\.user_capabilities enable row level security/
  );
  assert.match(
    migration,
    /revoke all on table app_portal\.user_capabilities[\s\S]+from public, anon, authenticated/
  );
});

test("M010 has one role-office-personal engine with the active-role gate", async () => {
  const migration = await read(migrationPath);
  const engine = migration.match(
    /create or replace function app_private\.has_capability\([\s\S]+?\n\$\$;/
  )?.[0] || "";

  assert.match(engine, /portal_user\.status = 'ACTIVE'/);
  assert.match(engine, /role\.is_active/);
  assert.match(engine, /app_portal\.role_capabilities/);
  assert.match(engine, /app_fanclub\.office_capabilities/);
  assert.match(engine, /app_portal\.user_capabilities/);
  assert.match(engine, /'portal\.admin'/);
  assert.doesNotMatch(engine, /team_memberships|team_functions/);
  assert.doesNotMatch(engine, /can_create_tasks|can_manage_tasks/);
});

test("M010 preserves all provenance sources simultaneously", async () => {
  const migration = await read(migrationPath);
  const provenance = migration.match(
    /create or replace function app_private\.user_capability_provenance\([\s\S]+?\n\$\$;/
  )?.[0] || "";

  for (const source of ["ROLE", "OFFICE", "PERSONAL", "ADMIN_OVERRIDE"]) {
    assert.match(provenance, new RegExp(`'${source}'`));
  }
  assert.match(provenance, /union all/);
  assert.match(provenance, /jsonb_agg/);
  assert.match(provenance, /'sources'/);
});

test("M010 admin set operation is portal-admin-only, atomic and audited", async () => {
  const migration = await read(migrationPath);
  const operation = migration.match(
    /create or replace function app_private\.api_set_user_capabilities\([\s\S]+?\n\$\$;/
  )?.[0] || "";

  assert.match(operation, /require_capability\('portal\.admin'\)/);
  assert.match(operation, /for update/);
  assert.match(operation, /expectedCapabilities/);
  assert.match(operation, /errcode = '40001'/);
  assert.match(operation, /portal\.admin kann nicht persoenlich vergeben werden/);
  assert.match(operation, /USER_CAPABILITIES_UPDATED/);
  assert.match(operation, /addedCapabilities/);
  assert.match(operation, /removedCapabilities/);
  assert.match(operation, /personalCapabilities/);
  assert.match(migration, /v_action = 'set_user_capabilities'/);
});

test("M010 migrates task flags and makes the legacy columns non-authoritative", async () => {
  const migration = await read(migrationPath);

  assert.match(
    migration,
    /'tasks\.create', access_override\.can_create_tasks/
  );
  assert.match(
    migration,
    /'tasks\.manage', access_override\.can_manage_tasks/
  );
  assert.match(migration, /set can_create_tasks = false/);
  assert.match(migration, /can_manage_tasks = false/);
  assert.match(migration, /USER_CAPABILITIES_MIGRATED/);
  assert.match(
    migration,
    /check \(not can_create_tasks and not can_manage_tasks\)/
  );
  assert.match(
    migration,
    /create or replace function app_private\.task_access_profile[\s\S]+app_private\.has_capability\(p_user_id, 'tasks\.create'\)/
  );
  assert.match(
    migration,
    /drop function app_private\.has_capability_before_user_task_access_r1/
  );
});

test("M010 grants events.manage to exactly the five fixed offices", async () => {
  const migration = await read(migrationPath);

  for (const office of [
    "VORSTAND_1",
    "VORSTAND_2",
    "VORSTAND_3",
    "KASSIER",
    "SCHRIFTFUEHRER"
  ]) {
    assert.match(migration, new RegExp(`'${office}'`));
  }
  assert.match(migration, /'events\.manage'/);
  assert.doesNotMatch(
    migration,
    /insert into app_portal\.role_capabilities[\s\S]+events\.manage/
  );
});

test("admin UI edits only personal capability sources", async () => {
  const admin = await read("js/modules/admin.js");

  assert.match(admin, /function editPersonalCapabilities\(user\)/);
  assert.match(admin, /personalCapabilityCatalog/);
  assert.match(admin, /effectiveCapabilities/);
  assert.match(admin, /personalCapabilities/);
  assert.match(admin, /ROLE/);
  assert.match(admin, /OFFICE/);
  assert.match(admin, /PERSONAL/);
  assert.match(admin, /ADMIN_OVERRIDE/);
  assert.match(admin, /call\("set_user_capabilities"/);
  assert.match(admin, /expectedCapabilities/);
  assert.doesNotMatch(admin, /name="canCreateTasks"/);
  assert.doesNotMatch(admin, /name="canManageTasks"/);
});

test("M010 architecture documentation records the security boundaries", async () => {
  const documentation = await read("docs/M010_R1_CENTRAL_AUTHORIZATION.md");

  assert.match(documentation, /ROLE OR OFFICE OR PERSONAL/);
  assert.match(documentation, /ADMIN_OVERRIDE/);
  assert.match(documentation, /kein Deny/i);
  assert.match(documentation, /portal\.admin/);
  assert.match(documentation, /niemals Ersatz für einen echten Amtsplatz/);
  assert.match(documentation, /keine allgemeinen globalen\s+Capability-Quellen/);
  assert.match(documentation, /Frontend-Anzeige und Navigation\s+dienen nur der UX/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("dashboard API is role and membership aware", async () => {
  const migration = await read(
    "supabase/migrations/20260724133000_add_role_aware_dashboard_r1.sql"
  );

  assert.match(
    migration,
    /create or replace function app_private\.api_dashboard\(\)/
  );
  assert.match(migration, /'isMember', v_is_member/);
  assert.match(migration, /'isOfficeHolder', v_is_office/);
  assert.match(migration, /'isAdmin', v_is_admin/);
  assert.match(migration, /v_show_own_tasks :=/);
  assert.match(migration, /app_private\.task_access_profile\(v_actor\)/);
  assert.match(migration, /app_private\.task_is_visible\(v_actor, task\.id\)/);
  assert.match(migration, /task\.context_type = 'TEAM'/);
  assert.match(migration, /task\.context_type = 'BOARD'/);
  assert.match(migration, /when not v_is_member then null/);
  assert.match(migration, /when not \(v_is_office or v_is_admin\) then null/);
});

test("normal portal users receive no fallback dashboard card", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(dashboard, /const cards = \[\];/);
  assert.match(
    dashboard,
    /panel\.classList\.toggle\("is-empty", cards\.length === 0\)/
  );
  assert.match(dashboard, /panel\.innerHTML = cards\.join\(""\)/);
  assert.doesNotMatch(dashboard, /Portal aktiv/);
  assert.doesNotMatch(dashboard, /Dein Zugang ist vollständig eingerichtet/);
  assert.match(
    dashboard,
    /const __V4_DASHBOARD_ROLE_AWARE_R1__ = true;/
  );
});

test("member dashboard exposes contribution and birthdays without age", async () => {
  const migration = await read(
    "supabase/migrations/20260724133000_add_role_aware_dashboard_r1.sql"
  );
  const dashboard = await read("js/modules/dashboard.js");
  const fanclub = await read("js/modules/fanclub.js");

  assert.match(migration, /add column birth_date date/);
  assert.match(
    migration,
    /create or replace function app_private\.next_member_birthday/
  );
  assert.match(migration, /'birthdayOn', upcoming\.next_birthday/);
  assert.match(migration, /'daysUntil'/);
  assert.doesNotMatch(
    migration.slice(
      migration.indexOf("'birthdays'"),
      migration.indexOf("'ownTasks'")
    ),
    /birth_date/
  );
  assert.match(migration, /'status', 'NO_SEASON'/);
  assert.match(migration, /'status', 'NOT_ASSIGNED'/);
  assert.match(migration, /then 'EXEMPT'/);
  assert.match(migration, /then 'PAID'/);
  assert.match(migration, /then 'PENDING'/);
  assert.match(migration, /then 'PARTIAL'/);
  assert.match(dashboard, /Nächste Geburtstage/);
  assert.doesNotMatch(dashboard, /Alter|Geburtsjahr/);
  assert.match(fanclub, /name="birthDate"/);
  assert.match(fanclub, /member\.birthDate/);
});

test("board dashboard includes finance and open contribution metrics", async () => {
  const migration = await read(
    "supabase/migrations/20260724133000_add_role_aware_dashboard_r1.sql"
  );
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(migration, /from app_fanclub\.finance_accounts/);
  assert.match(migration, /when 'INCOME' then entry\.amount/);
  assert.match(migration, /when 'EXPENSE' then -entry\.amount/);
  assert.match(migration, /'openContributionCount'/);
  assert.match(migration, /'openContributionAmount'/);
  assert.match(dashboard, /Fanclub-Kassen/);
  assert.match(dashboard, /Offene Beiträge/);
  assert.match(dashboard, /Vorstandsaufgaben/);
});

test("dashboard task rows open the concrete task", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(dashboard, /data-dashboard-task-id=/);
  assert.match(dashboard, /new URLSearchParams\(\{ taskId \}\)/);
  assert.match(dashboard, /navigate\(\s*"tasks"/);
});

test("dashboard cache rotates while preserving previous markers", async () => {
  const worker = await read("service-worker.js");

  assert.match(
    worker,
    /pd-portal-v4-dashboard-role-aware-r1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-task-push-deeplink-windowclient-r1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-admin-task-access-r1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-offices-save-corr1-20260724/
  );
});

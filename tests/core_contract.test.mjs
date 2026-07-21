import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("V4 entry point uses Supabase and no active Apps Script bridge", async () => {
  const html = await read("index.html");
  assert.match(html, /@supabase\/supabase-js@2/);
  assert.match(html, /js\/runtime-config\.js/);
  assert.match(html, /type="module" src="\.\/js\/app\.js/);
  assert.doesNotMatch(html, /<script[^>]+google-identity\.js/i);
  assert.doesNotMatch(html, /<script[^>]+m4-corr/i);
  assert.doesNotMatch(html, /script\.google\.com\/macros/i);
});

test("runtime configuration is generated and ignored", async () => {
  const ignore = await read(".gitignore");
  const example = await read("js/runtime-config.example.js");
  const generator = await read("scripts/write-runtime-config.mjs");
  assert.match(ignore, /^\/js\/runtime-config\.js$/m);
  assert.match(example, /supabasePublishableKey/);
  assert.match(generator, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(generator, /service[_-]?role/i);
});

test("database migrations are ordered and contain the core contract", async () => {
  const names = (await readdir(join(root, "supabase", "migrations")))
    .filter(name => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(names, [
    "20260717182508_bootstrap_private_schema.sql",
    "20260719225500_create_application_schemas.sql",
    "20260719230000_create_portal_core_tables.sql",
    "20260719230100_seed_portal_core_authorization.sql",
    "20260719230200_create_portal_core_api.sql",
    "20260720152000_add_member_email_match_suggestion.sql",
    "20260720161000_add_admin_team_delete.sql",
    "20260720174500_make_team_codes_internal.sql",
    "20260720201500_harden_task_workflow.sql",
    "20260720223000_restore_archived_tasks.sql",
    "20260720234500_add_contribution_management.sql",
    "20260721013000_add_finance_task_profile_workflows.sql",
    "20260721095000_add_finance_account_opening_balance.sql",
    "20260721193000_finalize_fanclub_review.sql"
  ]);

  const tables = await read(`supabase/migrations/${names[2]}`);
  const seed = await read(`supabase/migrations/${names[3]}`);
  const api = await read(`supabase/migrations/${names[4]}`);
  for (const schema of ["app_portal", "app_fanclub", "app_modules", "app_private"]) {
    assert.match(tables + api, new RegExp(schema.replace("_", "_")));
  }
  assert.match(tables, /enable row level security/g);
  assert.match(seed, /VORSTAND_1/);
  assert.match(seed, /SCHRIFTFUEHRER/);
  assert.match(seed, /PORTAL_USER/);
  assert.match(api, /create or replace function public\.pd_api/);
  assert.match(api, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
  assert.match(api, /grant execute on function public\.pd_create_bootstrap_token[\s\S]+to service_role/);
  assert.doesNotMatch(api, /grant\s+(?:all|select|insert|update|delete)[\s\S]+to\s+anon/i);
});

test("dynamic roles and fixed offices are documented as V4 decisions", async () => {
  const roles = await read("docs/CHANGE_DECISIONS/AE-V4-01_DYNAMIC_PORTAL_ROLES.md");
  const offices = await read("docs/CHANGE_DECISIONS/AE-V4-02_FIXED_OFFICES.md");
  assert.match(roles, /Rollen anlegen/);
  assert.match(roles, /letzten[\s\S]{0,80}administrativ/i);
  assert.match(offices, /dauerhaft genau fünf/i);
  assert.match(offices, /KASSIER/);
});

test("frontend modules use the single Supabase RPC boundary", async () => {
  const api = await read("js/api.js");
  assert.match(api, /client\.rpc\("pd_api"/);
  for (const file of ["admin", "dashboard", "fanclub", "profile", "tasks", "teams"]) {
    const source = await read(`js/modules/${file}.js`);
    assert.doesNotMatch(source, /script\.google\.com|google\.script\.run|pwaBridge/i);
  }
});

test("package is ESM-ready and pinned to the agreed toolchain", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.devDependencies.supabase, "2.109.1");
  assert.equal(pkg.engines.node, ">=24.18.0 <25");
  assert.equal(pkg.packageManager, "npm@12.0.1");
});

test("route click handling ignores the html route marker", async () => {
  const ui = await read("js/ui.js");
  assert.match(
    ui,
    /closest\("button\[data-route\], a\[data-route\]"\)/
  );
  assert.doesNotMatch(ui, /closest\("\[data-route\]"\)/);
});

test("member email match migration is safe and confirmable", async () => {
  const migration = await read(
    "supabase/migrations/20260720152000_add_member_email_match_suggestion.sql"
  );
  const admin = await read("js/modules/admin.js");

  assert.ok(
    migration.includes(
      "create or replace function app_private.api_member_match"
    )
  );
  assert.ok(
    migration.includes("require_capability('users.manage')")
  );
  assert.ok(
    migration.includes("when 'member_match'")
  );
  assert.ok(
    migration.includes("lower(btrim(coalesce(member.email")
  );
  assert.ok(
    migration.includes("user_member_links")
  );

  assert.ok(
    admin.includes('call("member_match"')
  );
  assert.ok(
    admin.includes("Mitglied automatisch erkannt")
  );
  assert.ok(
    admin.includes("Bitte prüfen und bestätigen")
  );
  assert.ok(
    admin.includes("AMBIGUOUS")
  );
});

test("admins can delete unused teams safely", async () => {
  const migration = await read(
    "supabase/migrations/20260720161000_add_admin_team_delete.sql"
  );
  const teams = await read("js/modules/teams.js");

  assert.ok(
    migration.includes(
      "create or replace function app_private.api_delete_team"
    )
  );
  assert.ok(
    migration.includes("require_capability('teams.manage')")
  );
  assert.ok(
    migration.includes("from app_modules.tasks")
  );
  assert.ok(
    migration.includes("delete from app_portal.teams")
  );
  assert.ok(
    migration.includes("TEAM_DELETED")
  );
  assert.ok(
    migration.includes("when 'delete_team'")
  );

  assert.ok(
    teams.includes('call("delete_team"')
  );
  assert.ok(
    teams.includes("data-delete-team")
  );
  assert.ok(
    teams.includes("Team löschen")
  );
});

test("Vercel DEV deployment publishes only the static build", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const vercel = JSON.parse(await read("vercel.json"));
  const build = await read("scripts/build-static.mjs");
  const ignore = await read(".gitignore");

  assert.equal(pkg.scripts.build, "node scripts/build-static.mjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.equal(vercel.outputDirectory, "dist");

  for (const directory of [
    "assets",
    "components",
    "css",
    "js",
    "pages"
  ]) {
    assert.ok(build.includes(`"${directory}"`));
  }

  assert.ok(build.includes("write-runtime-config.mjs"));
  assert.ok(build.includes("SUPABASE_PUBLISHABLE_KEY"));
  assert.doesNotMatch(build, /service[_-]?role/i);
  assert.match(ignore, /^\/dist\/$/m);
});

test("team codes are generated internally and hidden from the UI", async () => {
  const migration = await read(
    "supabase/migrations/20260720174500_make_team_codes_internal.sql"
  );
  const teams = await read("js/modules/teams.js");

  assert.match(
    migration,
    /create or replace function app_private\.team_code_base/
  );
  assert.match(
    migration,
    /create or replace function app_private\.next_team_code/
  );
  assert.match(
    migration,
    /v_code := app_private\.next_team_code\(v_name\)/
  );
  assert.doesNotMatch(
    migration,
    /set code = v_code/
  );

  assert.doesNotMatch(
    teams,
    /name="code"/
  );
  assert.doesNotMatch(
    teams,
    /team\.code/
  );
  assert.doesNotMatch(
    teams,
    /BUS_ORGA/
  );
});

test("task status uses a constrained dropdown", async () => {
  const tasks = await read("js/modules/tasks.js");

  assert.match(tasks, /function statusOptions\(task\)/);
  assert.match(tasks, /function statusSelect\(task\)/);
  assert.match(tasks, /data-task-status=/);
  assert.match(tasks, /Offen \(wieder öffnen\)/);
  assert.doesNotMatch(tasks, /data-task-next-status/);
  assert.doesNotMatch(tasks, /function workflowButton\(task\)/);
});

test("admins can permanently delete archived tasks before deleting a team", async () => {
  const migration = await read(
    "supabase/migrations/20260721013000_add_finance_task_profile_workflows.sql"
  );
  const tasks = await read("js/modules/tasks.js");
  const teams = await read("js/modules/teams.js");

  assert.match(
    migration,
    /create or replace function app_private\.api_delete_archived_task/
  );
  assert.match(migration, /require_capability\('portal\.admin'\)/);
  assert.match(migration, /v_task\.status <> 'ARCHIVED'/);
  assert.match(migration, /v_confirmation <> 'LÖSCHEN'/);
  assert.match(migration, /TASK_PERMANENTLY_DELETED/);
  assert.match(migration, /delete from app_modules\.tasks/);
  assert.match(migration, /'canDeletePermanently'/);
  assert.match(migration, /'archivedTaskCount'/);
  assert.match(
    migration,
    /Diese müssen im Aufgabenarchiv durch einen Admin endgültig gelöscht werden/
  );

  assert.match(tasks, /call\("delete_archived_task"/);
  assert.match(tasks, /data-delete-archived-task=/);
  assert.match(tasks, /Endgültig löschen/);
  assert.match(tasks, /pattern="LÖSCHEN"/);
  assert.match(tasks, /activeArchiveTeamId/);

  assert.match(teams, /data-open-team-archive=/);
  assert.match(teams, /Archivierte Aufgaben anzeigen/);
  assert.match(teams, /team\.archivedTaskCount/);
  assert.match(teams, /navigate\("tasks", params\)/);
});

test("task workflow remains revision-safe and archived without hard delete", async () => {
  const migration = await read(
    "supabase/migrations/20260720201500_harden_task_workflow.sql"
  );
  const tasks = await read("js/modules/tasks.js");
  const common = await read("js/modules/common.js");

  assert.match(migration, /add column if not exists archived_by uuid/);
  assert.match(
    migration,
    /check \(status in \('OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED'\)\)/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_archive_task/
  );
  assert.match(migration, /when 'archive_task'/);
  assert.match(migration, /TASK_REOPENED/);
  assert.match(migration, /Die Aufgabe wurde zwischenzeitlich geändert/);
  assert.doesNotMatch(migration, /delete from app_modules\.tasks/i);

  assert.match(tasks, /Meine Aufgaben/);
  assert.match(tasks, /Teamaufgaben/);
  assert.match(tasks, /Vorstandsaufgaben/);
  assert.match(tasks, /call\("archive_task"/);
  assert.match(tasks, /revision: task\.revision/);
  assert.match(tasks, /ownNoteRevision/);
  assert.doesNotMatch(tasks, /WAITING|Warten/);
  assert.doesNotMatch(common, /"WAITING"/);
});

test("archived tasks remain restorable through an audited action", async () => {
  const migration = await read(
    "supabase/migrations/20260720223000_restore_archived_tasks.sql"
  );
  const tasks = await read("js/modules/tasks.js");

  assert.match(
    migration,
    /create or replace function app_private\.api_restore_task/
  );
  assert.match(migration, /when 'restore_task'/);
  assert.match(migration, /TASK_RESTORED/);
  assert.match(migration, /'canRestore'/);
  assert.match(migration, /set status = 'OPEN'/);
  assert.match(migration, /archived_at = null/);
  assert.match(migration, /archived_by = null/);
  assert.match(
    migration,
    /task_can_reopen_or_archive\(v_actor, v_id\)/
  );

  assert.match(tasks, /async function restoreTask\(task\)/);
  assert.match(tasks, /call\("restore_task"/);
  assert.match(tasks, /data-restore-task=/);
  assert.match(tasks, />Wiederherstellen<\/button>/);
  assert.doesNotMatch(tasks, /value: "RESTORE"/);
});

test("contribution workflow remains permissioned and ledger-backed", async () => {
  const migration = await read(
    "supabase/migrations/20260720234500_add_contribution_management.sql"
  );
  const fanclub = await read("js/modules/fanclub.js");

  for (const table of [
    "contribution_seasons",
    "contribution_classes",
    "member_contributions",
    "finance_accounts",
    "contribution_payment_reports",
    "finance_entries"
  ]) {
    assert.match(
      migration,
      new RegExp(`create table app_fanclub\\.${table}`)
    );
  }

  assert.match(migration, /'KASSE',[\s\S]+?'Kasse',[\s\S]+?'CASH'/);
  assert.match(migration, /can_report_contribution_payment/);
  assert.match(migration, /when 'save_contribution_season'/);
  assert.match(migration, /when 'save_contribution_class'/);
  assert.match(migration, /when 'save_member_contribution'/);
  assert.match(migration, /when 'report_contribution_payment'/);
  assert.match(migration, /when 'review_contribution_payment'/);
  assert.match(migration, /CONTRIBUTION_PAYMENT_CONFIRMED/);
  assert.match(migration, /insert into app_fanclub\.finance_entries/);
  assert.doesNotMatch(migration, /update app_fanclub\.finance_entries/i);
  assert.doesNotMatch(migration, /delete from app_fanclub\.finance_entries/i);

  assert.match(fanclub, /\["contributions", "Beiträge"\]/);
  assert.match(fanclub, /call\("save_contribution_season"/);
  assert.match(fanclub, /call\("save_contribution_class"/);
  assert.match(fanclub, /call\("save_member_contribution"/);
  assert.match(fanclub, /call\("report_contribution_payment"/);
  assert.match(fanclub, /call\("review_contribution_payment"/);
  assert.match(fanclub, /account\.code === "KASSE"/);
  assert.match(fanclub, /optionList\(PAYMENT_METHODS, "CASH"\)/);
  assert.match(fanclub, /Number\(contribution\.reportableAmount\) > 0/);
});

test("finance ledger remains immutable transferable reversible and statement-ready", async () => {
  const migration = await read(
    "supabase/migrations/20260721013000_add_finance_task_profile_workflows.sql"
  );
  const fanclub = await read("js/modules/fanclub.js");

  assert.match(migration, /add column operation_id uuid not null/);
  assert.match(migration, /add column reverses_entry_id uuid/);
  assert.match(migration, /REVERSED/);
  assert.match(
    migration,
    /create or replace function app_private\.api_save_finance_account/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_delete_finance_account/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_create_finance_entry/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_transfer_finance/
  );
  assert.match(
    migration,
    /create or replace function app_private\.api_reverse_finance_entry/
  );
  assert.match(migration, /FINANCE_TRANSFER_CREATED/);
  assert.match(migration, /FINANCE_TRANSFER_REVERSED/);
  assert.match(migration, /FINANCE_ENTRY_REVERSED/);
  assert.match(
    migration,
    /Das Konto wurde bereits verwendet und kann nur deaktiviert werden/
  );
  assert.doesNotMatch(migration, /update app_fanclub\.finance_entries/i);
  assert.doesNotMatch(migration, /delete from app_fanclub\.finance_entries/i);
  assert.doesNotMatch(migration, /limit 1000/i);

  assert.match(fanclub, /\["cashbook", "Kasse"\]/);
  assert.match(fanclub, /call\("save_finance_account"/);
  assert.match(fanclub, /call\("delete_finance_account"/);
  assert.match(fanclub, /call\("create_finance_entry"/);
  assert.match(fanclub, /call\("transfer_finance"/);
  assert.match(fanclub, /call\("reverse_finance_entry"/);
  assert.match(fanclub, /data-dialog-reverse-entry=/);
  assert.match(fanclub, /data-open-finance-account=/);
  assert.match(fanclub, /function accountStatementEntries\(accountId\)/);
  assert.match(fanclub, /Kontoauszug/);
  assert.match(fanclub, /runningBalance/);
  assert.doesNotMatch(
    fanclub,
    /data-edit-finance-entry|data-delete-finance-entry/
  );
});

test("portal profile privacy and account creation contracts remain intact", async () => {
  const profileMigration = await read(
    "supabase/migrations/20260721013000_add_finance_task_profile_workflows.sql"
  );
  const accountMigration = await read(
    "supabase/migrations/20260721095000_add_finance_account_opening_balance.sql"
  );
  const api = await read("js/api.js");
  const app = await read("js/app.js");
  const ui = await read("js/ui.js");
  const admin = await read("js/modules/admin.js");
  const teams = await read("js/modules/teams.js");
  const fanclub = await read("js/modules/fanclub.js");
  const topbar = await read("components/topbar.html");
  const sidebar = await read("components/sidebar.html");
  const index = await read("index.html");
  const login = await read("pages/login.html");

  assert.match(
    profileMigration,
    /create table app_portal\.profile_change_requests/
  );
  assert.match(
    profileMigration,
    /create or replace function app_private\.api_submit_profile_change_request/
  );
  assert.match(
    profileMigration,
    /create or replace function app_private\.api_review_profile_change_request/
  );
  assert.match(profileMigration, /PROFILE_CHANGE_REQUEST_APPROVED/);
  assert.match(profileMigration, /when 'submit_profile_change_request'/);
  assert.match(profileMigration, /when 'review_profile_change_request'/);

  assert.match(api, /pd-api-state/);
  assert.match(api, /pendingRequests/);
  assert.match(app, /label: "Live"/);
  assert.match(app, /label: "Lädt …"/);
  assert.match(ui, /avatar_url/);
  assert.match(ui, /userAvatarImage/);
  assert.match(ui, /submit_profile_change_request/);
  assert.match(ui, /data-user-logout/);
  assert.match(ui, /body\.classList\.toggle\(\s*"overlay-open"/);
  assert.doesNotMatch(ui, /profileField\("Portal-ID"/);
  assert.doesNotMatch(ui, /member\.memberCode/);

  assert.match(admin, /\["profileChanges", "Datenänderungen"\]/);
  assert.match(admin, /review_profile_change_request/);
  assert.match(admin, /renderProfileChanges/);
  assert.doesNotMatch(teams, /user\.userCode|member\.userCode/);

  assert.match(topbar, /id="portalHomeButton"/);
  assert.match(topbar, /id="connectionStatus"/);
  assert.match(topbar, /id="userAvatarImage"/);
  assert.doesNotMatch(topbar, /logoutButton|Abmelden/);
  assert.match(sidebar, /mobile-sidebar-close/);
  assert.doesNotMatch(sidebar, /R7\.1|Milestone 4/);

  assert.match(index, /id="mobileNav"/);
  assert.doesNotMatch(index, /id="mobileMorePanel"|id="mobileMoreBackdrop"/);
  assert.doesNotMatch(index, /id="buildLabel"/);
  assert.doesNotMatch(index, /mobileLogoutButton|id="logoutButton"/);

  assert.match(login, /public-login-inline/);
  assert.doesNotMatch(login, /auth-page|auth-brand-panel|auth-card-wrap/);
  assert.doesNotMatch(login, /data-route="home"/);

  const accountStart = fanclub.indexOf("function accountForm(account = {})");
  const accountEnd = fanclub.indexOf(
    "function openFinanceAccount",
    accountStart
  );
  assert.equal(accountStart >= 0, true);
  assert.equal(accountEnd > accountStart, true);

  const accountFormSource = fanclub.slice(accountStart, accountEnd);
  assert.doesNotMatch(accountFormSource, /name="code"/);
  assert.match(accountFormSource, /name="openingBalance"/);
  assert.match(accountFormSource, /name="openingBalanceDate"/);
  assert.doesNotMatch(accountFormSource, /placeholder="Bankkonto"/);
  assert.doesNotMatch(
    fanclub,
    /<small>\$\{escapeHtml\(account\.code\)\}<\/small>/
  );
  assert.match(fanclub, /OPENING_BALANCE: "Startsaldo"/);

  assert.match(accountMigration, /'KONTO_'/);
  assert.match(accountMigration, /'OPENING_BALANCE'/);
  assert.match(accountMigration, /'Startsaldo'/);
  assert.match(accountMigration, /set name = v_name/);
  assert.doesNotMatch(accountMigration, /set code = v_code/);
});

test("mobile navigation keeps the bottom bar and More opens the full sidebar", async () => {
  const index = await read("index.html");
  const ui = await read("js/ui.js");

  assert.match(index, /id="mobileNav"/);
  assert.doesNotMatch(index, /id="mobileMorePanel"|id="mobileMoreBackdrop"/);
  assert.match(ui, /MOBILE_PRIMARY/);
  assert.match(ui, /more\.id = "mobileMoreToggle"/);
  assert.match(ui, /event\.target\.closest\("#mobileMoreToggle"\)/);
  assert.match(
    ui,
    /event\.target\.closest\("#mobileMoreToggle"\)[\s\S]*?openMobileMenu\(\)/
  );
  assert.doesNotMatch(ui, /openMobileMore|closeMobileMore|mobileMoreRoutes/);
});

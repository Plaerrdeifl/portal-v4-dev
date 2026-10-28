import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20261028175847_cockpit_admin_contract_r2.sql";
const sqlTestPath = "supabase/tests/cockpit_admin_contract.sql";
const concurrencyRunnerPath = "tests/run-cockpit-admin-concurrency.sh";

const read = (file) => fs.readFile(path.join(root, file), "utf8");

test("Cockpit administration stays behind narrow pd_api actions", async () => {
  const sql = await read(migrationPath);

  for (const action of [
    "cockpit_admin_users_list",
    "cockpit_admin_user_get",
    "cockpit_admin_access_set",
    "cockpit_admin_personal_capabilities_set",
  ]) {
    assert.match(sql, new RegExp(`'${action}'`, "i"));
  }

  assert.match(sql, /when 'cockpit_admin_users_list' then 'READ'/i);
  assert.match(sql, /when 'cockpit_admin_user_get' then 'READ'/i);
  assert.match(sql, /when 'cockpit_admin_access_set' then 'USER_MUTATION'/i);
  assert.match(
    sql,
    /when 'cockpit_admin_personal_capabilities_set' then 'USER_MUTATION'/i,
  );
  assert.match(sql, /pd_api_dispatch_current_before_cockpit_admin_r2/i);
  assert.doesNotMatch(sql, /create or replace function public\.pd_api/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/i);
});

test("actor, target, role and capability changes are server-side allowlisted", async () => {
  const sql = await read(migrationPath);
  const actorGuard = sql.match(
    /create function app_private\.cockpit_require_admin_actor[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";
  const accessWrite = sql.match(
    /create function app_private\.api_cockpit_admin_access_set[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";
  const capabilityWrite = sql.match(
    /create function app_private\.api_cockpit_admin_personal_capabilities_set[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(actorGuard, /auth\.uid\(\)/i);
  assert.match(actorGuard, /portal_user\.status = 'ACTIVE'/i);
  assert.match(actorGuard, /cockpit_access\.is_enabled/i);
  assert.match(actorGuard, /'SYSTEM_ADMIN', 'ADMIN'/i);
  assert.doesNotMatch(actorGuard, /portal\.admin/i);
  assert.doesNotMatch(actorGuard, /for update/i);

  assert.match(sql, /create function app_private\.cockpit_lock_admin_actor/i);
  assert.match(sql, /for update of portal_user, cockpit_access/i);

  assert.match(accessWrite, /v_actor_role = 'ADMIN'[\s\S]*v_role <> 'USER'/i);
  assert.match(accessWrite, /COCKPIT_TARGET_NOT_MANAGEABLE/i);
  assert.match(accessWrite, /STALE_REVISION/i);
  assert.match(accessWrite, /COCKPIT_TARGET_INACTIVE/i);
  assert.match(accessWrite, /COCKPIT_ACCESS_SET/i);
  assert.doesNotMatch(accessWrite, /update app_portal\.users/i);

  assert.match(capabilityWrite, /'liveticker\.manage'/i);
  assert.match(capabilityWrite, /'social_media_generator\.use'/i);
  assert.match(capabilityWrite, /COCKPIT_INVALID_CAPABILITY_ALLOWLIST/i);
  assert.match(capabilityWrite, /COCKPIT_PERSONAL_CAPABILITIES_SET/i);
  assert.match(
    capabilityWrite,
    /personal\.capability_code in \([\s\S]*'liveticker\.manage'[\s\S]*'social_media_generator\.use'/i,
  );
});

test("last SYSTEM_ADMIN and first bootstrap use the same serialized invariant", async () => {
  const sql = await read(migrationPath);
  const bootstrap = sql.match(
    /create function app_private\.cockpit_bootstrap_first_system_admin[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(sql, /pg_advisory_xact_lock\(70303, 2\)/i);
  assert.match(sql, /cockpit_active_system_admin_count\(\) < 1/i);
  assert.match(sql, /COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED/i);
  assert.match(bootstrap, /COCKPIT_BOOTSTRAP_ALREADY_COMPLETED/i);
  assert.match(bootstrap, /p_target_user_id/i);
  assert.match(bootstrap, /p_operator_reference/i);
  assert.match(bootstrap, /p_reason/i);
  assert.match(bootstrap, /COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED/i);
  assert.doesNotMatch(bootstrap, /auth\.uid\(\)|portal\.admin/i);
  assert.doesNotMatch(
    sql,
    /when 'cockpit_bootstrap_first_system_admin'/i,
  );
  assert.match(
    sql,
    /revoke all on function[\s\S]*cockpit_bootstrap_first_system_admin\(uuid, text, text\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
});

test("projections separate personal, effective and in-Cockpit rights", async () => {
  const sql = await read(migrationPath);
  const projection = sql.match(
    /create function app_private\.cockpit_admin_user_projection[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(projection, /'personallyAssigned'/i);
  assert.match(projection, /'effectiveFromAllSources'/i);
  assert.match(projection, /'effectiveInCockpit'/i);
  assert.match(projection, /app_private\.has_capability/i);
  assert.match(projection, /app_private\.cockpit_user_has_access/i);
  assert.match(sql, /'identityCreationAvailable', false/i);
});

test("SQL and real-session concurrency coverage are reproducible", async () => {
  const [sqlTest, runner] = await Promise.all([
    read(sqlTestPath),
    read(concurrencyRunnerPath),
  ]);

  for (const marker of [
    "portal.admin wurde als Cockpit-Admin akzeptiert",
    "Gesperrter Cockpit-Admin wurde akzeptiert",
    "SYSTEM_ADMIN-Verwaltungsliste ist unvollstaendig",
    "ADMIN-Liste enthaelt privilegierte Cockpit-Ziele",
    "ADMIN konnte Rollen eskalieren",
    "ADMIN konnte SYSTEM_ADMIN verwalten",
    "Fremdes Fachrecht wurde akzeptiert",
    "Veraltete Revision wurde nicht abgewiesen",
    "Effektive Generatorquelle wurde beim Entzug verloren",
    "Cockpit-Sperre hat globale Zustaende veraendert",
    "Letzter SYSTEM_ADMIN wurde nicht geschuetzt",
    "Auditnachweis fuer Cockpit-Schreibaktionen fehlt",
  ]) {
    assert.ok(sqlTest.includes(marker), `SQL-Testfall fehlt: ${marker}`);
  }

  assert.match(sqlTest, /^begin;/m);
  assert.match(sqlTest, /^rollback;/m);
  assert.match(runner, /cockpit_admin_concurrency_fixture\.sql/);
  assert.match(runner, /cockpit_admin_concurrency_assert\.sql/);
  assert.match(runner, /pg_sleep\(2\)/);
  assert.match(runner, /wait "\$first_pid"/);
});

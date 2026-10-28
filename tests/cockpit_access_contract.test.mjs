import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20261027174518_cockpit_access_contract_r1.sql";
const sqlTestPath = "supabase/tests/cockpit_access_contract.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");
const readSqlTest = () => fs.readFile(path.join(root, sqlTestPath), "utf8");

test("Cockpit enrollment is explicit, revisioned, and application-scoped", async () => {
  const sql = await readMigration();

  assert.match(sql, /create table app_portal\.cockpit_access/i);
  assert.match(sql, /user_id uuid primary key[\s\S]*app_portal\.users/i);
  assert.match(sql, /role in \('SYSTEM_ADMIN', 'ADMIN', 'USER'\)/i);
  assert.match(sql, /is_enabled boolean not null default false/i);
  assert.match(sql, /revision integer not null default 1/i);
  assert.match(sql, /cockpit_access_revision_check[\s\S]*revision > 0/i);
  assert.doesNotMatch(sql, /insert into app_portal\.cockpit_access/i);
  assert.doesNotMatch(sql, /create (?:table|function)[\s\S]*auth\.users/i);
  assert.doesNotMatch(sql, /insert into app_portal\.portal_roles/i);
});

test("private admission never substitutes portal.admin for Cockpit enrollment", async () => {
  const sql = await readMigration();
  const admission = sql.match(
    /create function app_private\.cockpit_user_has_access[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(admission, /portal_user\.status = 'ACTIVE'/i);
  assert.match(admission, /portal_role\.is_active/i);
  assert.match(admission, /cockpit_access\.is_enabled/i);
  assert.doesNotMatch(admission, /portal\.admin/i);
});

test("SYSTEM_ADMIN extends only the two established module capabilities", async () => {
  const sql = await readMigration();
  const hasCapability = sql.match(
    /create or replace function app_private\.has_capability[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(hasCapability, /'liveticker\.manage'/i);
  assert.match(hasCapability, /'social_media_generator\.use'/i);
  assert.match(hasCapability, /cockpit_access\.role = 'SYSTEM_ADMIN'/i);
  assert.match(hasCapability, /cockpit_access\.is_enabled/i);
  assert.match(hasCapability, /role_capability\.capability_code in \([\s\S]*'portal\.admin'/i);
  assert.doesNotMatch(
    hasCapability,
    /cockpit_access[\s\S]*p_capability\s*=\s*'portal\.admin'/i,
  );
  assert.match(sql, /'COCKPIT_SYSTEM_ADMIN'::text/i);
});

test("cockpit_access_get is actor-bound and reports personal versus effective rights", async () => {
  const sql = await readMigration();
  const api = sql.match(
    /create function app_private\.api_cockpit_access_get[\s\S]+?\n\$function\$;/i,
  )?.[0] ?? "";

  assert.match(api, /v_user_id uuid := auth\.uid\(\)/i);
  assert.doesNotMatch(api, /p_payload\s*->>?/i);
  assert.match(api, /app_private\.has_capability\([\s\S]*'liveticker\.manage'/i);
  assert.match(api, /app_private\.social_media_generator_user_has_access/i);
  assert.match(api, /team\.code = 'SOCIAL_MEDIA'/i);
  assert.match(api, /membership\.is_active/i);
  assert.match(api, /'personallyAssigned'/i);
  assert.match(api, /'effectiveAllowed'/i);
  assert.match(api, /'activeSocialMediaTeam'/i);
  assert.match(api, /'schemaVersion', 1/i);
  assert.match(api, /'PORTAL_USER_NOT_FOUND'/i);
  assert.match(api, /'PORTAL_USER_INACTIVE'/i);
  assert.match(api, /'COCKPIT_ACCESS_NOT_ASSIGNED'/i);
  assert.match(api, /'COCKPIT_ACCESS_BLOCKED'/i);
  assert.match(api, /'ALLOWED'/i);
});

test("the action is read-only, registered, enveloped, and default-deny", async () => {
  const sql = await readMigration();

  assert.match(sql, /array\['cockpit_access_get'\]::text\[\]/i);
  assert.match(sql, /when 'cockpit_access_get' then 'READ'/i);
  assert.match(
    sql,
    /when 'cockpit_access_get' then[\s\S]*api_cockpit_access_get/i,
  );
  assert.match(sql, /pd_api_dispatch_current_before_cockpit_access_r1/i);
  assert.match(sql, /alter table app_portal\.cockpit_access enable row level security/i);
  assert.match(
    sql,
    /revoke all on table app_portal\.cockpit_access[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /revoke all on function[\s\S]*api_cockpit_access_get\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(
    sql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated|service_role)/i,
  );
  assert.doesNotMatch(sql, /USER_MUTATION[\s\S]*cockpit_access_get/i);
});

test("transactional SQL coverage includes the required escalation and revocation cases", async () => {
  const sqlTest = await readSqlTest();

  for (const expected of [
    "Nicht angemeldeter Cockpit-Aufruf",
    "Inaktiver Portaluser",
    "Fehlende Cockpit-Zuordnung",
    "Cockpit-Sperre",
    "Portaladmin wurde ohne Cockpit-Zuordnung freigegeben",
    "Cockpit-Benutzer ohne Fachrechte",
    "Livetickerrecht oder manipulierte Ziel-ID",
    "Persoenliches Generatorrecht",
    "Aktive SOCIAL_MEDIA-Mitgliedschaft",
    "Inaktive SOCIAL_MEDIA-Mitgliedschaft",
    "Portaladmin mit Cockpit-Freigabe",
    "Cockpit-Systemadministrator ist zu weit oder zu eng",
    "Cockpit-Sperre entzieht Systemadministrator-Sonderrechte nicht sauber",
    "Entzogenes Generatorrecht ist stale",
    "Andere Generatorquelle wurde beim Entzug verloren",
    "Bestehende Fachrechte ausserhalb Cockpit",
  ]) {
    assert.ok(sqlTest.includes(expected), `SQL-Testfall fehlt: ${expected}`);
  }

  assert.match(sqlTest, /^begin;/m);
  assert.match(sqlTest, /^rollback;/m);
  assert.match(sqlTest, /has_table_privilege/i);
  assert.match(sqlTest, /has_function_privilege/i);
});

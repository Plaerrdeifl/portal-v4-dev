import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

const paths = {
  authorization:
    "supabase/migrations/20260820065000_add_team_function_authorization_m010_r2.sql",
  operations:
    "supabase/migrations/20260820070000_split_fanbus_operations_permissions_m010_r2.sql",
  fanbusRead:
    "supabase/migrations/20260820071500_adjust_fanbus_read_permissions_m010_r2.sql",
  memberRole:
    "supabase/migrations/20260820073000_retire_member_role_m010_r2.sql",
  teamFunctions:
    "supabase/migrations/20260820074500_manage_team_functions_m010_r2.sql",
  recipients:
    "supabase/migrations/20260820080000_dynamic_fanbus_org_recipients_m010_r2.sql"
};

const [authorization, operations, fanbusRead, memberRole, teamFunctions, recipients,
  fanbuses, teams, admin, sqlBehavior] = await Promise.all([
  read(paths.authorization),
  read(paths.operations),
  read(paths.fanbusRead),
  read(paths.memberRole),
  read(paths.teamFunctions),
  read(paths.recipients),
  read("js/modules/fanbuses.js"),
  read("js/modules/teams.js"),
  read("js/modules/admin.js"),
  read("supabase/tests/m010_r2_authorization.sql")
]);

function functionBody(source, signature, endMarker = "\n$$;") {
  const start = source.indexOf(signature);
  const end = source.indexOf(endMarker, start + signature.length);
  assert.ok(start >= 0 && end > start, `missing function: ${signature}`);
  return source.slice(start, end + endMarker.length);
}

test("M010-R2 migration package is forward-only and ordered", async () => {
  const names = Object.values(paths).map(path => path.split("/").at(-1));
  assert.deepEqual(names, [...names].sort());
  for (const migration of [authorization, operations, fanbusRead, memberRole, teamFunctions, recipients]) {
    assert.match(migration, /M010-R2/);
    assert.doesNotMatch(migration, /tpieykhhawszlzsoflnl|wplescvhlgctynkfwvrj/);
  }
});

test("TEAM_FUNCTION is a protected additive capability source", () => {
  assert.match(authorization, /create table app_portal\.team_function_capabilities/);
  assert.match(authorization, /primary key \(team_id, function_code, capability_code\)/);
  assert.match(authorization, /check \(capability_code <> 'portal\.admin'\)/);
  assert.match(authorization, /enable row level security/);
  assert.match(
    authorization,
    /revoke all on table app_portal\.team_function_capabilities[\s\S]*from public, anon, authenticated/
  );

  const engine = functionBody(
    authorization,
    "create or replace function app_private.has_capability("
  );
  for (const source of [
    "role_capabilities",
    "office_capabilities",
    "team_function_assignments",
    "team_function_capabilities",
    "user_capabilities"
  ]) {
    assert.match(engine, new RegExp(source));
  }
  assert.match(engine, /membership\.is_active/);
  assert.match(engine, /team\.is_active/);
  assert.match(engine, /team_function\.is_active/);
  assert.match(engine, /function_capability\.is_active/);
  assert.match(engine, /portal_user\.status = 'ACTIVE'/);
  assert.match(engine, /role\.is_active/);
});

test("BUS_ORGA functions map exactly the approved fanbus capabilities", () => {
  for (const [functionCode, capability] of [
    ["BUS_TRIPS_MANAGE", "fanbus.manage"],
    ["BUS_PARTICIPANTS_MANAGE", "fanbus.registrations.manage"],
    ["BUS_OPERATIONS", "fanbus.operations.manage"],
    ["BUS_PAYMENT_MARKER", "fanbus.payment_marker.manage"]
  ]) {
    assert.match(
      authorization,
      new RegExp(`'${functionCode}'[\\s\\S]*?'${capability.replace(".", "\\.")}'`)
    );
  }
  const mapping = authorization.slice(
    authorization.indexOf("insert into app_portal.team_function_capabilities"),
    authorization.indexOf("-- 4. Zentrale Capability-Engine")
  );
  assert.doesNotMatch(mapping, /BUS_KASSE/);
  assert.doesNotMatch(mapping, /portal\.admin/);
  assert.match(authorization, /PERSONAL-Quellen entfernt/);
  assert.match(authorization, /TEAM_FUNCTION-Zuordnung/);
});

test("fanbus check-in payment and participant management are independent", () => {
  const snapshot = functionBody(
    operations,
    "create or replace function app_private.api_fanbus_operations_snapshot("
  );
  for (const capability of [
    "fanbus.registrations.manage",
    "fanbus.operations.manage",
    "fanbus.payment_marker.manage"
  ]) {
    assert.match(snapshot, new RegExp(capability.replace(".", "\\.")));
  }

  const checkin = functionBody(
    operations,
    "create or replace function app_private.api_fanbus_checkin_set("
  );
  const paid = functionBody(
    operations,
    "create or replace function app_private.api_fanbus_paid_set("
  );
  assert.match(checkin, /require_capability\([\s\S]*'fanbus\.operations\.manage'/);
  assert.doesNotMatch(checkin, /require_capability\([\s\S]*fanbus\.registrations\.manage/);
  assert.match(paid, /require_capability\([\s\S]*'fanbus\.payment_marker\.manage'/);
  assert.doesNotMatch(paid, /finance\.|fanbus\.registrations\.manage/);
  for (const mutation of [checkin, paid]) {
    assert.match(mutation, /m330_lock_mutable_fanbus_trip/);
    assert.match(mutation, /expectedRevision/);
    assert.match(mutation, /revision = revision \+ 1/);
  }

  assert.match(fanbusRead, /'canManageOperations'/);
  assert.match(fanbusRead, /'canManagePaymentMarker'/);
  assert.match(fanbuses, /function fanbusOperationsAccess/);
  assert.match(fanbuses, /if \(canManageOperations\)[\s\S]*data-m325-checkin="PRESENT"/);
  assert.match(fanbuses, /if \(canManagePaymentMarker\)[\s\S]*data-m325-paid=/);
});

test("MEMBER retirement keeps membership identity link-based and self-scoped", () => {
  const selfSnapshot = functionBody(
    memberRole,
    "create function app_private.api_fanclub_member_snapshot()"
  );
  assert.match(selfSnapshot, /user_member_links/);
  assert.match(selfSnapshot, /member\.status = 'ACTIVE'/);
  assert.match(selfSnapshot, /'scope',[\s\S]*'SELF'/);
  assert.match(selfSnapshot, /'canViewMemberDetails',[\s\S]*false/);
  assert.match(selfSnapshot, /'canReadFinance',[\s\S]*false/);

  const bootstrap = functionBody(
    memberRole,
    "create function app_private.api_bootstrap()"
  );
  assert.match(bootstrap, /user_member_links/);
  assert.match(bootstrap, /member\.status = 'ACTIVE'/);
  assert.match(bootstrap, /'members\.read'/);
  assert.match(memberRole, /'fromRoleCode',[\s\S]*'MEMBER'/);
  assert.match(memberRole, /'toRoleCode',[\s\S]*'PORTAL_USER'/);
  assert.match(memberRole, /where code = 'MEMBER'[\s\S]*is_active = false/);
  assert.doesNotMatch(memberRole, /delete from app_portal\.portal_roles/);
  assert.doesNotMatch(
    memberRole,
    /(?:insert into|update|delete from) app_portal\.role_capabilities/
  );
});

test("team functions require teams.manage and every existing-row mutation uses CAS", () => {
  const setter = functionBody(
    teamFunctions,
    "create function app_private.api_set_team_functions("
  );
  assert.match(setter, /require_capability\([\s\S]*'teams\.manage'/);
  assert.doesNotMatch(setter, /can_manage_team/);
  assert.match(setter, /expectedRevision/);
  assert.match(setter, /for update/);
  assert.match(setter, /STALE_TEAM_MEMBERSHIP_REVISION/);
  assert.match(setter, /revision = revision \+ 1/);

  for (const [signature, staleCode] of [
    ["create or replace function app_private.api_save_team(", "STALE_TEAM_REVISION"],
    ["create or replace function app_private.api_save_team_member(", "STALE_TEAM_MEMBERSHIP_REVISION"],
    ["create or replace function app_private.api_remove_team_member(", "STALE_TEAM_MEMBERSHIP_REVISION"]
  ]) {
    const body = functionBody(teamFunctions, signature);
    assert.match(body, /expectedRevision/);
    assert.match(body, /for update/);
    assert.match(body, new RegExp(staleCode));
  }

  const saveTeam = functionBody(
    teamFunctions,
    "create or replace function app_private.api_save_team("
  );
  assert.match(saveTeam, /next_team_code\(v_name\)/);
  assert.doesNotMatch(saveTeam, /p_payload ->> 'code'/);
  assert.doesNotMatch(saveTeam, /set[\s\S]*code = v_code/);

  const api = functionBody(
    teamFunctions,
    "create function public.pd_api("
  );
  assert.match(api, /v_action = 'set_team_functions'/);
  assert.match(
    api,
    /jsonb_build_object\([\s\S]*'ok',[\s\S]*true,[\s\S]*'data',[\s\S]*v_data/
  );
  assert.match(api, /exception\s+when others/);
  assert.match(teams, /call\("set_team_functions"/);
  assert.match(teams, /expectedRevision: membership\.revision/);
  assert.match(teams, /payload\.expectedRevision = team\.revision/);
});

test("BUS_KASSE stays non-authoritative and outside the function editor", () => {
  assert.doesNotMatch(
    authorization.slice(
      authorization.indexOf("insert into app_portal.team_function_capabilities"),
      authorization.indexOf("-- 4. Zentrale Capability-Engine")
    ),
    /BUS_KASSE/
  );
  assert.match(
    teamFunctions,
    /team_function_assignments[\s\S]*exists \([\s\S]*team_function_capabilities/
  );
  assert.match(
    teamFunctions,
    /not exists \([\s\S]*jsonb_array_elements_text[\s\S]*and exists \([\s\S]*team_function_capabilities/
  );
});

test("M020 fanbus recipients require active BUS_ORGA membership and effective registration management", () => {
  assert.match(recipients, /p_path =[\s\S]*'fanbusOrganization'[\s\S]*'userIds'/);
  assert.match(recipients, /team\.code = 'BUS_ORGA'/);
  assert.match(recipients, /team\.is_active/);
  assert.match(recipients, /membership\.is_active/);
  assert.match(recipients, /portal_user\.status = 'ACTIVE'/);
  assert.match(
    recipients,
    /has_capability\([\s\S]*membership\.user_id,[\s\S]*'fanbus\.registrations\.manage'/
  );
  assert.match(recipients, /select distinct[\s\S]*membership\.user_id/);
});

test("TEAM_FUNCTION provenance is visible but personal grants remain separately editable", () => {
  assert.match(admin, /source\.source === "TEAM_FUNCTION"/);
  assert.match(admin, /Teamfunktion:/);
  assert.match(admin, /Nur der persönliche Anteil ist editierbar/);
  assert.match(admin, /Rechte aus Rolle, Amt, Teamfunktion oder Admin-Override/);
});

test("M010-R2 ships a transactional DEV behavior contract", () => {
  assert.match(sqlBehavior, /begin;/);
  assert.match(sqlBehavior, /rollback;/);
  assert.match(sqlBehavior, /Teammitgliedschaft allein erzeugt ein Fachrecht/);
  assert.match(sqlBehavior, /LEAD\/CO_LEAD durfte Fachrechte vergeben/);
  assert.match(sqlBehavior, /Registrierungsmanager außerhalb BUS_ORGA ist M020-Empfänger/);
  assert.match(sqlBehavior, /PERSONAL-Ausnahmequelle wurde ungültig/);
  assert.match(sqlBehavior, /Veraltete Teamrevision wurde akzeptiert/);
  assert.match(sqlBehavior, /Self-Fanclub-Snapshot ist nicht sicher begrenzt/);
});

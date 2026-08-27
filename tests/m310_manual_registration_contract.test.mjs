import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260811150000_add_manual_fanbus_registrations_m310_r1.sql";

const [migration, ui] = await Promise.all([
  read(migrationPath),
  read("js/modules/fanbuses.js")
]);

function functionBlock(source, name, nextMarker) {
  const start = source.indexOf(name);
  const end = source.indexOf(nextMarker, start + name.length);
  assert.notEqual(start, -1, `Startmarker fehlt: ${name}`);
  assert.notEqual(end, -1, `Endmarker fehlt: ${nextMarker}`);
  return source.slice(start, end);
}

test("M310 registration source is explicit, backfilled and constrained", () => {
  assert.match(migration, /add column source text/);
  assert.match(
    migration,
    /when portal_user_id is not null then 'PORTAL'[\s\S]+else 'GUEST'/
  );
  assert.match(migration, /alter column source set not null/);
  assert.match(migration, /source in \('PORTAL', 'GUEST', 'MANUAL'\)/);
  assert.match(migration, /'source', registration\.source/);
  assert.match(migration, /'source', v_existing\.source/);
});

test("M310 member identity is linked and protected for active registrations", () => {
  assert.match(
    migration,
    /add column member_id uuid[\s\S]+references app_fanclub\.members\(id\) on delete set null/
  );
  assert.match(
    migration,
    /set member_id = link\.member_id[\s\S]+link\.user_id = registration\.portal_user_id/
  );
  assert.match(
    migration,
    /create unique index fanbus_registrations_active_member_uidx[\s\S]+trip_id, member_id[\s\S]+status = 'ACTIVE'/
  );
});

test("M310 email is optional only for MANUAL registrations", () => {
  assert.match(migration, /alter column email drop not null/);
  assert.match(
    migration,
    /source in \('PORTAL', 'GUEST'\)[\s\S]+email is not null[\s\S]+source = 'MANUAL'[\s\S]+email is null/
  );
  assert.match(
    migration,
    /v_source = 'MANUAL'[\s\S]+v_email is not null[\s\S]+FANBUS_EMAIL_INVALID/
  );
  assert.match(
    migration,
    /alter table app_modules\.fanbus_registrations\s+validate constraint fanbus_registrations_email_check;/
  );
});

test("manual lookup and create require fanbus.registrations.manage", () => {
  const lookup = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_people_list()",
    "create function app_private.api_fanbus_registration_create_manual("
  );
  const create = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_create_manual(",
    "alter function public.pd_api(text, jsonb)"
  );

  assert.match(lookup, /require_capability\([\s\S]+fanbus\.registrations\.manage/);
  assert.match(create, /require_capability\([\s\S]+fanbus\.registrations\.manage/);
  assert.match(migration, /when 'fanbus_registration_people_list'/);
  assert.match(migration, /when 'fanbus_registration_create_manual'/);
});

test("person lookup returns only the minimal deduplicated member and portal contract", () => {
  const lookup = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_people_list()",
    "create function app_private.api_fanbus_registration_create_manual("
  );

  for (const field of [
    "personType",
    "memberId",
    "portalUserId",
    "firstName",
    "lastName",
    "email"
  ]) {
    assert.match(lookup, new RegExp(`'${field}'`));
  }
  assert.match(lookup, /member\.status = 'ACTIVE'/);
  assert.match(lookup, /portal_user\.status = 'ACTIVE'/);
  assert.match(lookup, /not exists \([\s\S]+user_member_links/);
  assert.doesNotMatch(lookup, /phone|street|postal|birth|notes/i);
});

test("member lookup uses the same normalized valid email fallback as the core", () => {
  const lookup = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_people_list()",
    "create function app_private.api_fanbus_registration_create_manual("
  );

  assert.match(
    lookup,
    /when nullif\(lower\(btrim\(member\.email\)\), ''\)[\s\S]+then nullif\(lower\(btrim\(member\.email\)\), ''\)/
  );
  assert.match(
    lookup,
    /when nullif\(lower\(btrim\(portal_user\.email\)\), ''\)[\s\S]+then nullif\(lower\(btrim\(portal_user\.email\)\), ''\)[\s\S]+else null/
  );
  assert.doesNotMatch(
    lookup,
    /coalesce\(\s*nullif\(btrim\(member\.email\)/
  );
});

test("manual actor and selected subject remain separate", () => {
  const core = functionBlock(
    migration,
    "create function app_private.fanbus_submit_registration_core(",
    "create or replace function app_private.fanbus_submit_registration("
  );

  assert.match(core, /p_actor uuid,[\s\S]+p_member_id uuid,[\s\S]+p_portal_user_id uuid/);
  assert.match(core, /created_by,[\s\S]+updated_by[\s\S]+p_actor,[\s\S]+p_actor/);
  assert.match(
    core,
    /perform app_private\.log_audit\([\s\S]+p_actor,[\s\S]+'FANBUS_REGISTRATION_CREATED'/
  );
  assert.match(core, /'source', v_source/);
  assert.match(
    migration,
    /'MANUAL',[\s\S]+v_actor,[\s\S]+v_member_id,[\s\S]+v_portal_user_id/
  );
});

test("PORTAL, GUEST and MANUAL all use the common atomic registration core", () => {
  const wrapper = functionBlock(
    migration,
    "create or replace function app_private.fanbus_submit_registration(",
    "create or replace function app_private.api_fanbus_registrations_list("
  );
  const manual = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_create_manual(",
    "alter function public.pd_api(text, jsonb)"
  );

  assert.match(wrapper, /fanbus_submit_registration_core/);
  assert.match(wrapper, /when p_portal_user_id is null then 'GUEST' else 'PORTAL'/);
  assert.match(manual, /fanbus_submit_registration_core/);
  assert.match(manual, /'MANUAL'/);
  assert.doesNotMatch(manual, /turnstile|fanbus_public_rate_limits|source_hash/i);
});

test("common core keeps status, visibility, time and capacity protection", () => {
  const core = functionBlock(
    migration,
    "create function app_private.fanbus_submit_registration_core(",
    "create or replace function app_private.fanbus_submit_registration("
  );

  assert.match(core, /for update of trip/);
  assert.match(core, /v_trip_status = 'CLOSED'/);
  assert.match(core, /v_trip_status <> 'PUBLISHED'/);
  assert.match(core, /v_event_visibility is distinct from 'PUBLIC'/);
  assert.match(core, /v_now < v_registration_opens_at[\s\S]+v_outcome := 'NOT_STARTED'/);
  assert.match(core, /v_now >= v_registration_closes_at[\s\S]+v_outcome := 'CLOSED'/);
  assert.match(core, /v_active_count >= v_capacity[\s\S]+'FULL'/);
});

test("manual member, portal user and guest payloads are resolved server-side", () => {
  const core = functionBlock(
    migration,
    "create function app_private.fanbus_submit_registration_core(",
    "create or replace function app_private.fanbus_submit_registration("
  );
  const manual = functionBlock(
    migration,
    "create function app_private.api_fanbus_registration_create_manual(",
    "alter function public.pd_api(text, jsonb)"
  );

  assert.match(core, /from app_fanclub\.members as member[\s\S]+member\.status = 'ACTIVE'/);
  assert.match(core, /from app_portal\.users as portal_user[\s\S]+portal_user\.status = 'ACTIVE'/);
  assert.match(manual, /v_person_type = 'MEMBER'[\s\S]+memberId/);
  assert.match(manual, /v_person_type = 'PORTAL_USER'[\s\S]+portalUserId/);
  assert.match(manual, /v_mode = 'GUEST'[\s\S]+firstName[\s\S]+lastName[\s\S]+email/);
  assert.match(manual, /jsonb_typeof\(p_payload -> 'email'\) not in \('string', 'null'\)/);
});

test("duplicates follow member, portal, email and no-email name identities", () => {
  const core = functionBlock(
    migration,
    "create function app_private.fanbus_submit_registration_core(",
    "create or replace function app_private.fanbus_submit_registration("
  );

  assert.match(core, /registration\.member_id = v_member_id/);
  assert.match(core, /registration\.portal_user_id = v_portal_user_id/);
  assert.match(core, /lower\(btrim\(registration\.email\)\) = v_email/);
  assert.match(
    core,
    /v_email is null[\s\S]+registration\.email is null[\s\S]+registration\.first_name[\s\S]+registration\.last_name/
  );
  assert.match(core, /return jsonb_build_object\([\s\S]+ALREADY_ACTIVE/);
});

test("manual registration requires both stored consent confirmations", () => {
  assert.match(
    migration,
    /p_privacy_confirmed is distinct from true[\s\S]+p_terms_confirmed is distinct from true[\s\S]+FANBUS_CONSENT_REQUIRED/
  );
  assert.match(migration, /v_privacy_reference,[\s\S]+v_terms_reference/);
  assert.match(ui, /consentConfirmed[\s\S]+type="checkbox" required/);
});

test("M310 UI exposes manual registration only through the registration capability", () => {
  assert.match(
    ui,
    /hasCapability\("fanbus\.registrations\.manage"\)[\s\S]+data-m310-add-registration>Teilnehmer hinzufügen/
  );
  assert.match(ui, /call\("fanbus_registration_people_list"\)/);
  assert.match(ui, /call\("fanbus_registration_create_manual_bulk", \{ \.\.\.payload, idempotencyKey: manualAttempt\.key \}\)/);
  assert.match(ui, /call\("fanbus_registrations_list", \{ tripId: trip\.id \}\)/);
  assert.match(ui, /call\("fanbus_trips_list"\)/);
  assert.match(ui, /MANUAL: "Manuell"/);
  const registrationCard = ui.slice(
    ui.indexOf("function registrationCard"),
    ui.indexOf("async function cancelRegistrationFromActions")
  );
  assert.doesNotMatch(registrationCard, /registration\.email|v4-m310-registration-email/);
});

test("manual UI idempotency attempt is bound to the complete business payload", () => {
  assert.match(
    ui,
    /function manualAttemptFor\(currentAttempt, fingerprint\)[\s\S]+currentAttempt\?\.fingerprint === fingerprint[\s\S]+crypto\.randomUUID\(\)/
  );
  assert.match(ui, /let manualAttempt = null/);
  assert.match(ui, /const payload = \{[\s\S]+tripId: trip\.id,[\s\S]+participants: state\.participants\.map[\s\S]+termsConfirmed: values\.consentConfirmed === "on"/);
  assert.match(ui, /person\.portalUserId \? \{ portalUserId: person\.portalUserId \}/);
  assert.match(ui, /person\.memberId \? \{ memberId: person\.memberId \}/);
  assert.match(ui, /person\.regularRiderId \? \{ regularRiderId: person\.regularRiderId \}/);
  assert.match(ui, /person\.source === "GUEST" \? \{ firstName: person\.firstName, lastName: person\.lastName, email: person\.email \|\| null \}/);
  assert.match(
    ui,
    /const fingerprint = JSON\.stringify\(payload\);[\s\S]+manualAttempt = manualAttemptFor\(manualAttempt, fingerprint\)/
  );
  assert.match(
    ui,
    /fanbus_registration_create_manual_bulk", \{ \.\.\.payload, idempotencyKey: manualAttempt\.key/
  );
  assert.doesNotMatch(
    ui,
    /const payload = \{[^}]*idempotencyKey/
  );
});

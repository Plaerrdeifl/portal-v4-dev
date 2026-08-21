import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const migrationPath = "supabase/migrations/20260820120000_add_m325_r2_member_linking.sql";

test("D-055 stores only the nullable portal-user anchor without uniqueness", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /add column linked_portal_user_id uuid/);
  assert.match(sql, /foreign key \(linked_portal_user_id\)[\s\S]*references app_portal\.users\(id\)[\s\S]*on delete restrict/);
  assert.match(sql, /fanbus_companion_list_members_linked_portal_user_idx/);
  assert.doesNotMatch(sql, /add column linked_member_id|foreign key \(linked_member_id\)/);
  assert.doesNotMatch(sql, /unique[^;]*linked_portal_user_id|linked_portal_user_id[^;]*unique/i);
});

test("D-055 adds the isolated M010 identity capability and dedicated BUS_ORGA function", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /'fanbus\.participant_identity\.manage'/);
  assert.match(sql, /Fanbus-Teilnehmeridentitaeten verknuepfen/);
  assert.match(sql, /'BUS_PARTICIPANT_IDENTITY',[\s\S]*'Teilnehmeridentitäten verknüpfen'/);
  assert.match(sql, /insert into app_portal\.team_function_capabilities[\s\S]*'BUS_PARTICIPANT_IDENTITY',[\s\S]*'fanbus\.participant_identity\.manage'[\s\S]*where team\.code = 'BUS_ORGA'/);
  assert.doesNotMatch(sql, /insert into app_portal\.(?:role_capabilities|office_capabilities|user_capabilities)[\s\S]*fanbus\.participant_identity\.manage/i);
  assert.doesNotMatch(sql, /insert into app_portal\.team_function_assignments[\s\S]*BUS_PARTICIPANT_IDENTITY/i);
  assert.doesNotMatch(sql, /fanbus\.(?:operations|registrations|payment_marker)\.manage[\s\S]*(?:or|in)[\s\S]*fanbus\.participant_identity\.manage/i);
});

test("private Portaluser search is active-only bounded and PII-minimal", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create function app_private.m325_portal_people_search");
  const end = sql.indexOf("create function app_private.api_fanbus_companion_person_search", start);
  const helper = sql.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(helper, /from app_portal\.users as portal_user/);
  assert.match(helper, /portal_user\.status = 'ACTIVE'/);
  assert.match(helper, /limit 8/);
  assert.match(helper, /'portalUserId'/);
  assert.match(helper, /'displayName'/);
  assert.match(helper, /'badge', 'Portaluser'/);
  assert.match(helper, /'isMember'/);
  assert.doesNotMatch(helper, /portal_user\.email|phone|address|birth|notes|office|role|capabilit|team/i);
  assert.doesNotMatch(helper, /offset|totalCount|pageSize/i);
  assert.match(sql, /api_fanbus_companion_person_search[\s\S]*require_active_user\(\)[\s\S]*length\(v_query\) < 3/);
});

test("private Companion link and unlink are owner-locked CAS operations", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create function app_private.api_fanbus_companion_person_link");
  const end = sql.indexOf("create or replace function app_private.api_fanbus_companion_duplicate_preview", start);
  const block = sql.slice(start, end);
  assert.match(block, /list\.owner_user_id = v_actor/);
  assert.match(block, /for update of list, companion/);
  assert.match(block, /v_existing\.revision <> v_expected/);
  assert.match(block, /v_existing\.linked_portal_user_id = v_target[\s\S]*'noOp', true/);
  assert.match(block, /portal_user\.id = v_target and portal_user\.status = 'ACTIVE'/);
  assert.match(block, /set linked_portal_user_id = v_target[\s\S]*first_name = v_first[\s\S]*last_name = v_last/);
  assert.match(block, /v_existing\.linked_portal_user_id is null[\s\S]*'noOp', true/);
  assert.match(block, /set linked_portal_user_id = null,[\s\S]*revision = revision \+ 1/);
});

test("Companion read model exposes live Portaluser state and optional member state", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create or replace function app_private.api_fanbus_companion_lists_list");
  const end = sql.indexOf("create or replace function app_private.api_fanbus_companion_member_upsert", start);
  const block = sql.slice(start, end);
  assert.match(block, /coalesce\(portal_user\.first_name, companion\.first_name\)/);
  assert.match(block, /coalesce\(portal_user\.last_name, companion\.last_name\)/);
  assert.match(block, /'linkedPortalUserId', companion\.linked_portal_user_id/);
  assert.match(block, /'portalUserStatus', portal_user\.status/);
  assert.match(block, /'memberStatus', linked_member\.status/);
  assert.match(block, /'isMember', linked_member\.status = 'ACTIVE'/);
});

test("booking derives current portal and optional member identity server-side", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create or replace function app_private.api_fanbus_companion_booking_submit");
  const end = sql.indexOf("create function app_private.api_fanbus_registration_identity_suggestion", start);
  const block = sql.slice(start, end);
  assert.match(block, /v_member\.linked_portal_user_id/);
  assert.match(block, /portal_user\.status = 'ACTIVE'/);
  assert.match(block, /'linkedPortalUserId', v_member\.linked_portal_user_id/);
  assert.match(block, /v_member\.linked_portal_user_id is null[\s\S]*v_item ->> 'email'/);
  assert.doesNotMatch(block, /'linkedMemberId'|linked_member_id/);
  assert.match(sql, /new\.portal_user_id := v_linked_portal_user_id/);
  assert.match(sql, /new\.member_id := v_derived_member_id/);
  assert.match(sql, /from app_portal\.user_member_links as link[\s\S]*member\.status = 'ACTIVE'/);
  assert.match(sql, /new\.email := null/);
});

test("preview and submit share stable IDs and conservative guest conflicts", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /create function app_private\.m325_companion_conflict_status/);
  assert.match(sql, /registration\.portal_user_id = p_linked_portal_user_id/);
  assert.match(sql, /registration\.member_id = p_derived_member_id/);
  assert.match(sql, /registration\.companion_list_member_id = p_template_member_id/);
  assert.match(sql, /p_linked_portal_user_id is null[\s\S]*p_derived_member_id is null[\s\S]*lower\(btrim\(registration\.first_name\)\)/);
  assert.ok((sql.match(/app_private\.m325_companion_conflict_status\(/g) || []).length >= 4);
  assert.match(sql, /v_linked_portal_user = any\(v_seen_portals\)/);
  assert.match(sql, /v_derived_member = any\(v_seen_members\)/);
  assert.match(sql, /v_linked_portal_user = v_actor/);
  assert.match(sql, /v_derived_member = v_primary_member/);
});

test("administrative identity actions preserve PORTAL PRIMARY and support published or closed trips", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create function app_private.m325_registration_identity_set");
  const end = sql.indexOf("create function app_private.api_fanbus_registration_identity_link", start);
  const block = sql.slice(start, end);
  assert.match(block, /require_capability\([\s\S]*'fanbus\.participant_identity\.manage'/);
  assert.match(block, /m330_lock_mutable_fanbus_trip\(v_trip_id\)/);
  assert.match(block, /v_trip_status not in \('PUBLISHED', 'CLOSED'\)/);
  assert.match(block, /v_existing\.status not in \('ACTIVE', 'WAITLISTED'\)/);
  assert.match(block, /v_existing\.revision <> v_expected/);
  assert.match(block, /v_existing\.source = 'PORTAL'[\s\S]*v_existing\.booking_role = 'PRIMARY'[\s\S]*FANBUS_PRIMARY_PORTAL_IDENTITY_IMMUTABLE/);
  assert.ok(block.indexOf("FANBUS_PRIMARY_PORTAL_IDENTITY_IMMUTABLE") < block.indexOf("if v_mode = 'LINK'"));
  assert.match(block, /FANBUS_REGISTRATION_IDENTITY_RELINK_REQUIRED/);
  assert.match(block, /FANBUS_REGISTRATION_IDENTITY_DUPLICATE/);
  assert.match(block, /set portal_user_id = v_target_portal_user_id,[\s\S]*member_id = v_target_member_id/);
  assert.doesNotMatch(block, /email\s*=/i);
  assert.doesNotMatch(block, /fanbus\.(?:operations|registrations|payment_marker)\.manage/);
});

test("administrative link propagates only through exact Companion provenance", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create function app_private.m325_registration_identity_set");
  const end = sql.indexOf("create function app_private.api_fanbus_registration_identity_link", start);
  const block = sql.slice(start, end);
  assert.match(block, /companion\.id = v_existing\.companion_list_member_id/);
  assert.match(block, /list\.owner_user_id = v_existing\.created_by/);
  assert.match(block, /for update of list, companion/);
  assert.match(block, /FANBUS_COMPANION_IDENTITY_CONFLICT/);
  assert.match(block, /set linked_portal_user_id = v_target_portal_user_id/);
  assert.match(block, /v_companion\.linked_portal_user_id = v_existing\.portal_user_id/);
  assert.match(block, /companionOldRevision/);
  assert.match(block, /companionNewRevision/);
});

test("identity suggestions are exact-name capability-gated and non-mutating", async () => {
  const sql = await read(migrationPath);
  const start = sql.indexOf("create function app_private.api_fanbus_registration_identity_suggestion");
  const end = sql.indexOf("create function app_private.api_fanbus_registration_identity_search", start);
  const block = sql.slice(start, end);
  assert.match(block, /fanbus\.participant_identity\.manage/);
  assert.match(block, /registration\.portal_user_id is null/);
  assert.match(block, /trip\.status in \('PUBLISHED', 'CLOSED'\)/);
  assert.match(block, /lower\(btrim\(portal_user\.first_name\)\)[\s\S]*lower\(btrim\(v_registration\.first_name\)\)/);
  assert.match(block, /lower\(btrim\(portal_user\.last_name\)\)[\s\S]*lower\(btrim\(v_registration\.last_name\)\)/);
  assert.match(block, /when v_match_count = 0 then 'NONE'/);
  assert.match(block, /when v_match_count = 1 then 'SINGLE'/);
  assert.match(block, /else 'MULTIPLE'/);
  assert.doesNotMatch(block, /update|insert|delete|portal_user\.email/i);
});

test("pd_api routes D-055 actions while private functions remain closed", async () => {
  const sql = await read(migrationPath);
  for (const action of [
    "fanbus_companion_person_search",
    "fanbus_companion_person_link",
    "fanbus_companion_person_unlink",
    "fanbus_registration_identity_search",
    "fanbus_registration_identity_suggestion",
    "fanbus_registration_identity_link",
    "fanbus_registration_identity_relink",
    "fanbus_registration_identity_unlink"
  ]) assert.match(sql, new RegExp(`when '${action}'`));
  assert.match(sql, /return public\.pd_api_before_m325_r2_member_linking\(p_action, p_payload\)/);
  assert.match(sql, /revoke all on function[\s\S]*api_fanbus_registration_identity_link\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
});

test("D-055 UI uses Portaluser identity and capability-gated admin controls", async () => {
  const [ui, registration, css, standalone] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("js/fanbus-registration.js"),
    read("css/app.css"),
    read("fanbus-anmeldung.html")
  ]);
  const companionUi = ui.slice(
    ui.indexOf("function companionPersonBadge"),
    ui.indexOf("function operationEventLabel")
  );
  const publicTrip = registration.slice(
    registration.indexOf("function renderTrip"),
    registration.indexOf("function appendReferenceConsent")
  );
  assert.match(ui, /Portaluser suchen/);
  assert.match(ui, /Portaluser verknüpfen/);
  assert.match(ui, /fanbus\.participant_identity\.manage/);
  assert.match(ui, /fanbus_registration_identity_suggestion/);
  assert.match(ui, /Mehrere mögliche Portaluser/);
  assert.match(ui, /fanbus_registration_identity_relink/);
  assert.match(ui, /fanbus_registration_identity_unlink/);
  assert.match(ui, /registration\.source === "PORTAL"[\s\S]*registration\.bookingRole === "PRIMARY"/);
  assert.match(ui, /\["PUBLISHED", "CLOSED"\]\.includes\(trip\.status\)/);
  assert.match(ui, /&& !portalPrimaryIdentity/);
  assert.match(ui, /query\.length < 3/);
  assert.match(ui, /\}, 300\)/);
  assert.match(ui, /data\.people\.slice\(0, 8\)/);
  assert.match(ui, /linked \? " readonly"/);
  assert.doesNotMatch(ui, /linkedMemberId|data-m325-linked-member-id|memberCode/);
  assert.match(registration, /data-m325-linked-portal-user-id/);
  assert.match(registration, /Portaluser · inaktiv/);
  assert.doesNotMatch(registration, /member\.isMember|>Mitglied</);
  assert.doesNotMatch(companionUi, /member\.isMember|person\.isMember|>Mitglied</);
  assert.match(companionUi, /v4-m325-person-search-result is-name-only/);
  assert.match(registration, /!linked && email/);
  assert.doesNotMatch(registration, /Der aktuelle Name im Portal wird für die Buchung verwendet\./);
  assert.doesNotMatch(registration, /Der aktuelle Mitgliedsname wird für die Buchung verwendet\./);
  assert.doesNotMatch(registration, /linkedMemberId|data-m325-linked-member-id/);
  assert.match(standalone, /Plärrdeifl<small>FANBUS-ANMELDUNG<\/small>/);
  assert.doesNotMatch(standalone, /<h1>Fanbus-Anmeldung<\/h1>/);
  assert.match(standalone, /fanbus-public-booking-card[\s\S]*id="m310PublicTrip"[\s\S]*id="m310RegistrationPanel"/);
  assert.doesNotMatch(publicTrip, /trip\.(?:departureAt|priceCents|capacity|registrationOpensAt|registrationClosesAt)/);
  assert.doesNotMatch(publicTrip, />Abfahrt<|>Fahrtpreis<|>Freie Plätze<|>Anmeldezeitraum</);
  assert.match(registration, /elements\.title\.textContent = "Deine Anmeldung"/);
  assert.doesNotMatch(registration, /Mit Portal anmelden|Angemeldet als/);
  assert.match(registration, /function companionEditorBody\(linked, values\)[\s\S]*linked[\s\S]*Portaluser[\s\S]*Vorname/);
  assert.doesNotMatch(registration, /readonly|Operativer Hinweis/);
  assert.match(registration, /Hinweis \(optional\)/);
  assert.match(registration, /title: "Mitfahrer hinzufügen"[\s\S]*Aus Mitfahrerliste[\s\S]*Portaluser suchen[\s\S]*Gast hinzufügen/);
  assert.match(standalone, /\+ Mitfahrer hinzufügen/);
  assert.doesNotMatch(standalone, /Mitfahrerliste verwenden|Wer fährt mit\?/);
  assert.match(registration, /link\.textContent = linkText/);
  assert.match(registration, /link\.target = "_blank"[\s\S]*link\.rel = "noopener noreferrer"/);
  assert.doesNotMatch(registration, /link\.textContent = normalized/);
  assert.match(registration, /\$\{total\} \$\{total === 1 \? "Person wird" : "Personen werden"\} angemeldet/);
  assert.doesNotMatch(registration, /reguläre Anmeldung|Wartelistenanmeldung|Begleiter/);
  assert.ok(
    registration.indexOf('api.call("fanbus_companion_duplicate_preview"')
      < registration.indexOf('"fanbus_companion_booking_submit"')
  );
  assert.match(registration, /if \(!preview\.canSubmit\)[\s\S]*Buchung nicht möglich/);
  assert.match(registration, /portalPreviewFingerprint = fingerprint;[\s\S]*previewBox\.hidden = true;[\s\S]*previewBox\.replaceChildren\(\);/);
  assert.doesNotMatch(registration, /Duplicate Preview|Geprüfte Buchung bestätigen|Vorschau ist bereit/);
  assert.match(registration, /if \(\["CREATED", "WAITLISTED", "ALREADY_ACTIVE"\][\s\S]*previewBox\.hidden = true;[\s\S]*finishRegistration/);
  assert.match(css, /\.v4-m325-person-search-result/);
  assert.match(css, /\.v4-m325-companion-identity-badges/);
  assert.match(css, /\.v4-m325-template-person/);
  assert.match(css, /\.v4-m325-registration-identity/);
});

test("compact companion UI preserves current-trip boarding-stop validation", async () => {
  const registration = await read("js/fanbus-registration.js");
  const validation = registration.slice(
    registration.indexOf("function tripHasBoardingStops"),
    registration.indexOf("function companionMarkup")
  );
  const portalSubmit = registration.slice(
    registration.indexOf("async function submitPortal"),
    registration.indexOf("async function submitGuest")
  );
  const guestSubmit = registration.slice(
    registration.indexOf("async function submitGuest"),
    registration.indexOf("async function renderMode")
  );
  const portalSearch = registration.slice(
    registration.indexOf("function openCompanionPortalSearchDialog"),
    registration.indexOf("async function submitPortal")
  );

  assert.match(validation, /if \(!tripHasBoardingStops\(\)\) return true/);
  assert.match(validation, /companionBoardingStopId[\s\S]*resolvedBoardingStop\(boardingStopId\)/);
  assert.match(validation, /querySelectorAll\("\[data-m320-companion\]"\)[\s\S]*find\(card => !companionCardHasValidBoardingStop\(card\)\)/);
  assert.match(validation, /Bitte wähle für \$\{name\} einen Zustiegsort\./);
  assert.match(validation, /requestCompanionBoardingStop\(mode, invalidCard\)[\s\S]*return false/);
  assert.match(registration, /const boardingStop = resolvedBoardingStop\([\s\S]*boardingStop\?\.id \? \{ boardingStopId: boardingStop\.id \} : \{\}/);
  assert.match(registration, /else if \(tripHasBoardingStops\(\)\) parts\.push\("Zustiegsort fehlt"\)/);
  assert.match(registration, /fanbus-companion-meta[\s\S]*data-m325-edit-booking-companion>Ändern/);

  const portalValidation = portalSubmit.indexOf('validateCompanionBoardingStops(elements.portalForm, "portal")');
  assert.ok(portalValidation >= 0);
  assert.ok(portalValidation < portalSubmit.indexOf('api.call("fanbus_companion_duplicate_preview"'));
  assert.ok(portalValidation < portalSubmit.indexOf('"fanbus_companion_booking_submit"'));

  const guestValidation = guestSubmit.indexOf('validateCompanionBoardingStops(elements.guestForm, "guest")');
  assert.ok(guestValidation >= 0);
  assert.ok(guestValidation < guestSubmit.indexOf("await fetch("));

  assert.match(portalSearch, /defaultBoardingStopId: null/);
  assert.match(portalSearch, /!companionCardHasValidBoardingStop\(card\)[\s\S]*requestCompanionBoardingStop\("portal", card\)/);
});

test("D-055 pgTAP coverage preserves M020 M150 and M330 boundaries", async () => {
  const [sqlTest, migration] = await Promise.all([
    read("supabase/tests/m325_r2_member_linking.sql"),
    read(migrationPath)
  ]);
  for (const marker of [
    "Mehrere Companion-Zeilen duerfen denselben Portaluser referenzieren",
    "BLOCKED Portaluser ist nicht auffindbar",
    "Operations-Capability allein erlaubt keinen Identity-Link",
    "Registrations-Capability allein erlaubt keinen Identity-Link",
    "Identity-Capability erlaubt den administrativen Link",
    "Administrative Verknuepfung zieht genau den Provenienz-Companion mit",
    "Anderer Companion-Link wird nicht still ueberschrieben",
    "Exakt ein Namensmatch liefert einen Vorschlag",
    "Mehrere Namensmatches liefern keine Vorauswahl",
    "Direkter Submit blockiert denselben Portaluser atomar",
    "Gastname kollidiert vorsichtig mit bekannter Registration",
    "M150 bleibt unveraendert",
    "Linked Booking uebernimmt keine fremde E-Mail",
    "PORTAL-PRIMARY RELINK ist unveraenderlich",
    "PORTAL-PRIMARY UNLINK ist unveraenderlich",
    "CLOSED Fahrt erlaubt administrativen Identity-Link",
    "CANCELLED Fahrt verbietet administrativen Identity-Link",
    "BUS_PARTICIPANT_IDENTITY ist fuer BUS_ORGA gemappt",
    "Direkter Batch-Submit blockiert denselben Portaluser zweimal atomar",
    "Direkter Submit blockiert PRIMARY gleich Companion atomar",
    "Direkter Submit erlaubt gleichen Namen fuer verschiedene Portaluser",
    "Echter Gast-Submit kollidiert vorsichtig mit bekannter Portalperson"
  ]) assert.match(sqlTest, new RegExp(marker));
  assert.doesNotMatch(migration, /notification_event_enqueue|notification_type|recipient/i);
  assert.doesNotMatch(migration, /insert into app_portal\.user_member_links|update app_portal\.user_member_links|delete from app_portal\.user_member_links/);
  assert.doesNotMatch(migration, /create or replace function app_private\.fanbus_submit_booking_core/);
  assert.doesNotMatch(migration, /api_fanbus_trip_cancel/);
});

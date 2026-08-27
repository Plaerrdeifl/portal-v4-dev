import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const [people, bulk, mail, corrections, f45Sql, ui, css, page, renderer] = await Promise.all([
  read("supabase/migrations/20260827063627_m326_r1_f1_f2_people_groups_identity.sql"),
  read("supabase/migrations/20260827063630_m326_r1_f3_manual_bulk.sql"),
  read("supabase/migrations/20260827063633_m326_r1_f4_mail_label.sql"),
  read("supabase/migrations/20260827083330_m326_r1_f45_review_corrections.sql"),
  read("supabase/tests/m326_r1_f45.sql"),
  read("js/modules/fanbuses.js"),
  read("css/app.css"),
  read("pages/fanbuses.html"),
  read("supabase/functions/notification-dispatch/index.ts")
]);

test("F1 creates the closed regular-rider model and optional registration provenance", () => {
  assert.match(people, /create table app_modules\.fanbus_regular_riders/);
  for (const column of ["first_name", "last_name", "email", "mobile", "default_boarding_stop_id", "default_bus_preference", "linked_portal_user_id", "note", "is_active", "revision", "created_by", "updated_by"]) {
    assert.match(people, new RegExp(`\\b${column}\\b`));
  }
  assert.match(people, /default_bus_preference in \('EGAL', 'RUHIG', 'PARTY'\)/);
  assert.doesNotMatch(people, /default_bus_preference[\s\S]{0,100}'NORMAL'/);
  assert.match(people, /linked_portal_user_id\)[\s\S]*where linked_portal_user_id is not null/);
  assert.match(people, /alter table app_modules\.fanbus_registrations[\s\S]*add column regular_rider_id uuid/);
  assert.doesNotMatch(people, /update app_modules\.fanbus_registrations[\s\S]*regular_rider_id/);
});

test("F1 groups store exactly one stable non-guest anchor", () => {
  assert.match(people, /create table app_modules\.fanbus_person_groups/);
  const members = people.slice(people.indexOf("create table app_modules.fanbus_person_group_members"), people.indexOf("alter table app_modules.fanbus_registrations"));
  assert.match(members, /portal_user_id uuid/);
  assert.match(members, /member_id uuid/);
  assert.match(members, /regular_rider_id uuid/);
  assert.match(members, /num_nonnulls\(portal_user_id, member_id, regular_rider_id\) = 1/);
  assert.doesNotMatch(members, /guest|jsonb/i);
  assert.match(members, /unique \(group_id, position\) deferrable initially deferred/);
});

test("F1 security keeps all new tables outside direct browser access", () => {
  for (const table of ["fanbus_regular_riders", "fanbus_person_groups", "fanbus_person_group_members"]) {
    assert.match(people, new RegExp(`alter table app_modules\\.${table} enable row level security`));
    assert.match(people, new RegExp(`app_modules\\.${table}[\\s\\S]*from public, anon, authenticated`));
  }
  assert.doesNotMatch(people, /create policy/i);
  assert.match(people, /from public, anon, authenticated, service_role/);
  assert.match(corrections, /from public, anon, authenticated, service_role/);
  assert.ok((people.match(/fanbus\.registrations\.manage/g) || []).length >= 12);
  assert.match(people, /m326_regular_rider_link_change[\s\S]*require_capability\('fanbus\.registrations\.manage'\)/);
  assert.match(people, /fanbus_regular_riders_list'[\s\S]*then 'READ'/);
  const list = people.slice(people.indexOf("create function app_private.api_fanbus_regular_riders_list"), people.indexOf("create function app_private.api_fanbus_regular_rider_detail"));
  assert.doesNotMatch(list, /'email'|'mobile'|'note'/);
  assert.match(list, /'effectiveIdentityKey'/);
});

test("F2 effective identity is portal-first while anchors remain unchanged", () => {
  const resolver = people.slice(people.indexOf("create function app_private.fanbus_effective_person"), people.indexOf("create function app_private.api_fanbus_regular_riders_list"));
  assert.match(resolver, /'effectiveType', 'PORTAL_USER'/);
  assert.match(resolver, /'effectiveType', 'MEMBER'/);
  assert.match(resolver, /'effectiveType', 'REGULAR_RIDER'/);
  assert.match(resolver, /'identityKey', 'PORTAL:'/);
  assert.match(resolver, /'identityKey', 'MEMBER:'/);
  assert.match(resolver, /'identityKey', 'REGULAR_RIDER:'/);
  assert.match(people, /fanbus_person_group_projection[\s\S]*fanbus_effective_person\(v_member\.portal_user_id,v_member\.member_id,v_member\.regular_rider_id\)/);
  assert.doesNotMatch(people, /update app_modules\.fanbus_person_group_members[\s\S]*(portal_user_id|member_id|regular_rider_id)/);
});

test("F2 LINK, UNLINK and RELINK are one CAS-locked server contract", () => {
  const link = people.slice(people.indexOf("create function app_private.m326_regular_rider_link_change"), people.indexOf("create function app_private.api_fanbus_regular_rider_link"));
  assert.match(link, /require_capability\('fanbus\.registrations\.manage'\)/);
  assert.match(link, /for update/);
  assert.match(link, /v_old\.revision<>v_expected[\s\S]*STALE_REVISION/);
  assert.match(link, /p_mode not in\('LINK','UNLINK','RELINK'\)/);
  assert.match(link, /FANBUS_REGULAR_RIDER_PORTAL_LINK_CONFLICT/);
  assert.match(link, /revision=revision\+1/);
  for (const action of ["LINK", "UNLINK", "RELINK"]) assert.match(link, new RegExp(action));
  assert.doesNotMatch(link, /email\s*=|mobile\s*=|first_name\s*=/);
  assert.match(link, /v_expected is null/);
  assert.match(link, /'linkOperation',p_mode/);
  assert.match(link, /'oldPortalUserId',v_old\.linked_portal_user_id/);
  assert.match(link, /'newPortalUserId',case when p_mode='UNLINK' then null else v_portal end/);
});

test("F2 group projection reports inactive people and identity convergence without rewriting", () => {
  const group = people.slice(people.indexOf("create function app_private.fanbus_person_group_projection"), people.indexOf("create function app_private.api_fanbus_person_groups_list"));
  assert.match(people, /'available', false, 'reason', '(?:PORTAL_USER|MEMBER|REGULAR_RIDER)_INACTIVE'/);
  assert.match(group, /v_key=any\(v_seen\)/);
  assert.match(group, /'conflict',v_conflict/);
  assert.match(group, /'availableCount'/);
  assert.match(group, /'hasConflicts'/);
  assert.doesNotMatch(group, /delete from|update app_modules\.fanbus_person_group_members/);
  const groupMutations = people.slice(people.indexOf("create function app_private.api_fanbus_person_group_update"), people.indexOf("-- Additive M900 action inventory"));
  assert.ok((groupMutations.match(/v_expected is null/g) || []).length >= 3);
  assert.match(groupMutations, /v_old_anchor_keys/);
  assert.match(groupMutations, /and not v_anchor_key=any\(v_old_anchor_keys\)/);
  assert.match(groupMutations, /'anchorType',v_anchor_type,'anchorId',v_anchor_id/);
  assert.match(groupMutations, /FANBUS_PERSON_GROUP_MEMBER_REMOVED[\s\S]*FANBUS_PERSON_GROUP_MEMBER_ADDED/);
});

test("F4.5 limits manual-name fallback to free manual identities", () => {
  assert.match(corrections, /drop index app_modules\.fanbus_registrations_live_manual_name_uidx/);
  assert.match(corrections, /source = 'MANUAL'[\s\S]*member_id is null[\s\S]*portal_user_id is null[\s\S]*regular_rider_id is null[\s\S]*email is null/);
  assert.match(corrections, /fanbus_submit_booking_core_before_m330_r1/);
  assert.match(corrections, /registration\.regular_rider_id is null/);
  assert.match(corrections, /M326_F45_M320_MANUAL_NAME_BASELINE_MISMATCH/);
  assert.match(corrections, /m325_companion_conflict_status/);
  assert.match(corrections, /M326_F45_M325_MANUAL_NAME_BASELINE_MISMATCH/);
  assert.doesNotMatch(corrections, /fanbus_submit_booking_core\([\s\S]*capacity|waitlisted_at|idempotency_key/);
  assert.match(f45Sql, /same-name second regular rider is not blocked by name/);
  assert.match(f45Sql, /same-name free guest is not blocked by regular riders/);
  assert.match(f45Sql, /same-name free manual guests remain duplicates/);
  assert.match(f45Sql, /same-name guest companion is not blocked by a regular rider/);
});

test("F4.5 behavior suite covers audit hardening and inactive-anchor editing", () => {
  for (const operation of ["LINK", "RELINK", "UNLINK"]) {
    assert.match(f45Sql, new RegExp(`${operation} audit stores`));
  }
  for (const anchor of ["PORTAL_USER", "MEMBER", "REGULAR_RIDER"]) {
    assert.match(f45Sql, new RegExp(`anchorType'='${anchor}'`));
  }
  assert.match(f45Sql, /existing inactive anchor can be retained while group is edited/);
  assert.match(f45Sql, /new inactive anchor remains forbidden/);
  assert.match(f45Sql, /has_table_privilege\('service_role'/);
});

test("F3 bulk validates all identities under the trip lock and invokes M320 exactly once", () => {
  const fn = bulk.slice(bulk.indexOf("create function app_private.api_fanbus_registration_create_manual_bulk"), bulk.indexOf("alter function app_private.pd_api_current_actions"));
  assert.match(fn, /require_capability\('fanbus\.registrations\.manage'\)/);
  assert.match(fn, /from app_modules\.fanbus_trips where id=v_trip for update/);
  assert.match(fn, /v_identity=any\(v_seen\)[\s\S]*FANBUS_BATCH_DUPLICATE/);
  assert.match(fn, /fanbus_registration_effective_key/);
  assert.match(fn, /status in\('ACTIVE','WAITLISTED'\)/);
  assert.match(fn, /m325_assert_idempotency/);
  assert.equal((fn.match(/fanbus_submit_booking_core\(/g) || []).length, 1);
  const callPosition = fn.indexOf("fanbus_submit_booking_core(");
  assert.ok(callPosition > fn.lastIndexOf("end loop"));
  assert.doesNotMatch(fn, /fanbus_registration_create_manual\(/);
});

test("F3 keeps stable request idempotency, stop defaults, provenance and effective EGAL", () => {
  assert.match(bulk, /'request',p_payload-'idempotencyKey'/);
  assert.ok(bulk.indexOf("m325_assert_idempotency") < bulk.indexOf("fanbus_effective_person"));
  assert.match(bulk, /fanbus_registration_idempotency[\s\S]*if found then return v_result/);
  assert.match(bulk, /v_source\|\|'-'\|\|coalesce\(v_portal,v_member,v_rider\)::text/);
  assert.match(bulk, /defaultBoardingStopId/);
  assert.match(bulk, /fanbus_trip_boarding_stops[\s\S]*stop\.is_active/);
  assert.match(bulk, /FANBUS_BOARDING_STOP_REQUIRED/);
  assert.match(bulk, /not v_item\?'busPreference'/);
  assert.match(bulk, /new\.regular_rider_id:=/);
  assert.match(bulk, /requested value in the legacy core/);
});

test("F3 extends the existing P800 manual flow with a compact editable composer", () => {
  assert.match(ui, /fanbus_registration_create_manual_bulk/);
  assert.match(ui, /data-m326-add-person>\+ Person/);
  assert.match(ui, /data-m326-add-group>\+ Gruppe/);
  assert.match(ui, /data-m326-remove-person/);
  assert.match(ui, /data-m326-person-stop/);
  assert.match(ui, /data-m326-person-preference/);
  assert.match(ui, /data-m326-composer-summary/);
  assert.match(ui, /Gruppe noch nicht übernommen/);
  assert.match(ui, /Nicht verfügbar:/);
  assert.match(ui, /member\.conflict/);
  assert.match(ui, /if \(!unavailable\.length && !collisions\.length\)[\s\S]*transfer\(members\)/);
  assert.match(ui, /!collisions\.length && eligible\.length[\s\S]*data-m326-accept-available/);
  assert.match(ui, /Die konvergierten Gruppenanker müssen vor einer Übernahme bewusst/);
  assert.match(ui, /höchstens 20 Personen/);
  assert.match(ui, /source === "GUEST"/);
  assert.match(css, /\.v4-m326-composer-card/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*grid-template-columns: 1fr/);
});

test("F3 management UI exposes regular riders, conscious links and stable groups", () => {
  assert.match(page, /m326RegularRidersButton/);
  assert.match(page, /m326PersonGroupsButton/);
  for (const action of ["fanbus_regular_rider_create", "fanbus_regular_rider_update", "fanbus_regular_rider_deactivate", "fanbus_regular_rider_link", "fanbus_regular_rider_unlink", "fanbus_regular_rider_relink", "fanbus_person_group_members_replace"]) {
    assert.match(ui, new RegExp(action));
  }
  assert.match(ui, /Gäste können nicht in Gruppen aufgenommen werden/);
});

test("F5 DEV-E2E projects group-import singular and bulk duplicates without changing atomic booking", () => {
  const groupImport = ui.slice(
    ui.indexOf("function openManualComposerGroupPicker"),
    ui.indexOf("async function openManualRegistration")
  );
  assert.match(groupImport, /Nur \$\{eligible\.length\} \$\{eligible\.length === 1 \? "verfügbare Person" : "verfügbare Personen"\} übernehmen/);
  assert.doesNotMatch(groupImport, /Nur \$\{eligible\.length\} verfügbare Personen übernehmen/);

  const projection = ui.slice(
    ui.indexOf("function manualBulkSubmitError"),
    ui.indexOf("function manualAttemptFor")
  );
  assert.match(projection, /error\?\.code === "P3201" \|\| error\?\.message === "FANBUS_BATCH_DUPLICATE"/);
  assert.match(projection, /Mindestens eine Person ist für diese Fahrt bereits angemeldet\. Es wurde keine neue Anmeldung erstellt\./);
  assert.match(projection, /return error;/);

  const submit = ui.slice(
    ui.indexOf("async function openManualRegistration"),
    ui.indexOf("function showRegistrationsDialog")
  );
  assert.match(submit, /fanbus_registration_create_manual_bulk[\s\S]*catch \(error\) \{\s*throw manualBulkSubmitError\(error\);/);
  assert.doesNotMatch(submit, /showToast\([^\n]*FANBUS_BATCH_DUPLICATE/);

  const atomicBulk = bulk.slice(
    bulk.indexOf("create function app_private.api_fanbus_registration_create_manual_bulk"),
    bulk.indexOf("alter function app_private.pd_api_current_actions")
  );
  assert.equal((atomicBulk.match(/fanbus_submit_booking_core\(/g) || []).length, 1);
  assert.ok(atomicBulk.indexOf("FANBUS_BATCH_DUPLICATE") < atomicBulk.indexOf("fanbus_submit_booking_core("));
});

test("F5 regular-rider management uses compact mobile cards and a capability-gated detail dialog", () => {
  const card = ui.slice(
    ui.indexOf("function regularRiderListCard"),
    ui.indexOf("function regularRiderDetailBody")
  );
  assert.match(card, /data-m326-open-rider/);
  assert.match(card, /v4-compact-record v4-m326-person-card/);
  assert.match(card, /<strong>\$\{escapeHtml\(name\)\}<\/strong><small>/);
  assert.doesNotMatch(card, /Bearbeiten|Verknüpfen|Deaktivieren|data-m326-detail-/);

  const detail = ui.slice(
    ui.indexOf("function regularRiderDetailBody"),
    ui.indexOf("async function renderRegularRidersWorkspace")
  );
  assert.match(detail, /hasCapability\("fanbus\.registrations\.manage"\)/);
  for (const action of ["data-m326-detail-edit", "data-m326-detail-link", "data-m326-detail-unlink", "data-m326-detail-deactivate"]) {
    assert.match(detail, new RegExp(action));
  }
  assert.match(detail, /Standard-Zustieg/);
  assert.match(detail, /Standard-Buswunsch/);
  assert.match(detail, /E-Mail/);
  assert.match(detail, /Mobilnummer/);
  assert.match(detail, /Interne Notiz/);
  assert.match(detail, /Portaluser/);
  assert.match(ui, /data-m326-open-rider[\s\S]*fanbus_regular_rider_detail[\s\S]*openRegularRiderDetailDialog/);

  assert.match(css, /\.v4-m326-person-card\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*max-width: 100%;/);
  assert.match(css, /\.v4-m326-person-card \.v4-compact-record-copy strong\s*\{[\s\S]*overflow-wrap: break-word;[\s\S]*hyphens: none;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v4-m326-rider-toolbar\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*\.v4-m326-rider-toolbar > \.button\s*\{[\s\S]*min-height: 44px;[\s\S]*white-space: nowrap;/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*\.v4-m326-rider-toolbar,[\s\S]*\.v4-m326-person-card\s*\{[\s\S]*max-width: 100%;/);
});

test("F5 successful regular-rider writes discard stale parent dialog contexts", () => {
  const editWrite = ui.slice(
    ui.indexOf("function openRegularRiderDialog"),
    ui.indexOf("function openRegularRiderLinkDialog")
  );
  assert.match(editWrite, /fanbus_regular_rider_update[\s\S]*fanbus_regular_rider_create/);
  assert.match(editWrite, /closeAllDialogs\(\);\s*await refresh\(\);/);
  assert.doesNotMatch(editWrite, /dialog\.close\(\)/);

  const linkWrite = ui.slice(
    ui.indexOf("function openRegularRiderLinkDialog"),
    ui.indexOf("function regularRiderListCard")
  );
  assert.match(linkWrite, /fanbus_regular_rider_relink[\s\S]*fanbus_regular_rider_link/);
  assert.match(linkWrite, /closeAllDialogs\(\);\s*await refresh\(\);/);
  assert.doesNotMatch(linkWrite, /dialog\.close\(\)/);
});

test("F5 person-group management uses compact cards, structured rows and a searchable stable-anchor picker", () => {
  const card = ui.slice(
    ui.indexOf("function personGroupListCard"),
    ui.indexOf("function personGroupDetailBody")
  );
  assert.match(card, /v4-compact-record v4-m326-group-card/);
  assert.match(card, /data-m326-open-group/);
  assert.match(card, /<strong>\$\{escapeHtml\(group\.name\)\}<\/strong><small>/);
  assert.doesNotMatch(card, /Personen bearbeiten|Bearbeiten|Deaktivieren|data-m326-detail-/);

  const detailBody = ui.slice(
    ui.indexOf("function personGroupDetailBody"),
    ui.indexOf("function openPersonGroupForm")
  );
  assert.match(detailBody, /Personenübersicht/);
  assert.match(detailBody, /canManage && group\.isActive/);
  for (const action of ["data-m326-detail-group-members", "data-m326-detail-edit-group", "data-m326-detail-deactivate-group"]) {
    assert.match(detailBody, new RegExp(action));
  }

  const detailFlow = ui.slice(
    ui.indexOf("async function openPersonGroupDetailDialog"),
    ui.indexOf("async function renderPersonGroupsWorkspace")
  );
  assert.match(detailFlow, /hasCapability\("fanbus\.registrations\.manage"\)/);
  assert.match(detailFlow, /title: detail\.name/);

  const workspace = ui.slice(
    ui.indexOf("async function renderPersonGroupsWorkspace"),
    ui.indexOf("function operationEventLabel")
  );
  assert.match(workspace, /groups\.map\(personGroupListCard\)/);
  assert.match(workspace, /data-m326-open-group[\s\S]*openPersonGroupDetailDialog/);
  assert.doesNotMatch(workspace, /data-m326-(?:group-members|edit-group|deactivate-group)/);

  const picker = ui.slice(
    ui.indexOf("function openPersonGroupPicker"),
    ui.indexOf("async function openPersonGroupMembers")
  );
  assert.match(picker, /type="search"[\s\S]*data-m326-group-person-query/);
  assert.match(picker, /selectedAnchors\.has\(groupMemberAnchor\(choice\)\)/);
  assert.match(picker, /<strong>\$\{escapeHtml\(choice\.name\)\}<\/strong><small>\$\{escapeHtml\(choice\.source\)\}<\/small>/);
  assert.doesNotMatch(picker, /<select|GUEST/);
  assert.deepEqual(
    [...picker.matchAll(/data-m326-group-source="([A-Z_]+)"/g)].map(match => match[1]),
    ["ALL", "MEMBER", "PORTAL_USER", "REGULAR_RIDER"]
  );

  const editor = ui.slice(
    ui.indexOf("async function openPersonGroupMembers"),
    ui.indexOf("async function openPersonGroupDetailDialog")
  );
  assert.match(editor, /v4-m326-group-member-copy"><strong>[\s\S]*<\/strong><small>[\s\S]*<\/small><\/span>/);
  assert.match(editor, /v4-m326-group-member-remove/);
  assert.match(editor, /\+ Person hinzufügen/);
  assert.match(editor, /people\.filter\(person => person\.personType === "MEMBER" \|\| person\.personType === "PORTAL_USER"\)/);
  assert.doesNotMatch(editor, /<select|data-m326-group-choice/);
  assert.match(editor, /person\.anchorType === "PORTAL_USER" \? \{ portalUserId: person\.anchorId \}/);
  assert.match(editor, /person\.anchorType === "MEMBER" \? \{ memberId: person\.anchorId \}/);
  assert.match(editor, /person\.anchorType === "REGULAR_RIDER" \? \{ regularRiderId: person\.anchorId \}/);

  assert.match(css, /\.v4-m326-group-card\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*max-width: 100%;/);
  assert.match(css, /\.v4-m326-group-card \.v4-compact-record-copy strong\s*\{[\s\S]*overflow-wrap: break-word;[\s\S]*hyphens: none;/);
  assert.match(css, /\.v4-m326-group-member-row\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 44px;/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v4-m326-group-detail-facts\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*\.v4-m326-group-card,[\s\S]*\.v4-m326-group-member-row\s*\{[\s\S]*max-width: 100%;/);
});

test("F4 central mail resolver is fail-closed and guards every fanbus outbox email", () => {
  assert.match(mail, /create function app_private\.fanbus_trip_mail_label/);
  assert.match(mail, /when v_type='GAME' then nullif\(btrim\(v_opponent\),''\)/);
  assert.match(mail, /when v_type in\('FANCLUB','OTHER'\) then nullif\(btrim\(v_title\),''\)/);
  assert.match(mail, /FANBUS_MAIL_LABEL_MISSING/);
  assert.match(mail, /before insert or update of payload on app_private\.notification_outbox/);
  assert.match(mail, /v_template not like 'fanbus\.%'/);
  assert.match(mail, /jsonb_set\(new\.payload,'\{data,tripTitle\}'/);
  assert.doesNotMatch(mail, /'Fanbusfahrt'/);
});

test("F4 renderer uses projected label in subject, HTML and plain text and rejects fallback", () => {
  assert.match(renderer, /key\.startsWith\("fanbus\."\)/);
  assert.match(renderer, /FANBUS_MAIL_LABEL_MISSING/);
  assert.match(renderer, /Fahrt: \$\{tripTitle\}/);
  assert.match(renderer, /escapeHtml\(tripTitle\)/);
  assert.match(renderer, /subject: `Fanbus[^`]*\$\{tripTitle\}`/);
});

test("scope freeze remains additive", () => {
  const all = `${people}\n${bulk}\n${mail}`;
  assert.doesNotMatch(all, /create table .*person(s|en)?\s*\(/i);
  assert.doesNotMatch(all, /insert into app_portal\.capabilities/i);
  assert.doesNotMatch(all, /notification_type.*add|create table .*notification/i);
  assert.doesNotMatch(all, /seat|ticket|qr|refund|return_trip/i);
});

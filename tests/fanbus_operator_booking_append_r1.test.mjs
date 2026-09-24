import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../js/modules/bus-orga-bookings.js");
const pages = read("../js/pages.js");
const app = read("../js/app.js");
const v3 = read("../js/modules/bus-orga-v3.js");
const index = read("../index.html");
const serviceWorker = read("../service-worker.js");
const migration = read("../supabase/migrations/20260919183000_fanbus_operator_booking_append_r1.sql");

test("operator append is exposed as guarded user mutation", () => {
  assert.match(migration, /require_capability\('fanbus\.registrations\.manage'\)/);
  assert.match(migration, /fanbus_booking_operator_append/);
  assert.match(migration, /USER_MUTATION/);
  assert.match(migration, /revoke all on function app_private\.api_fanbus_booking_operator_append\(jsonb\)/);
});

test("operator append keeps participant in the existing booking", () => {
  assert.match(migration, /v_booking_id,'COMPANION',v_sequence/);
  assert.match(migration, /select coalesce\(max\(participant_sequence\),0\)\+1/);
  assert.match(migration, /where booking_id=v_booking_id/);
  assert.match(migration, /'MANUAL',v_actor,v_actor,v_booking_id,'COMPANION'/);
});

test("operator append validates identity, stop and duplicates", () => {
  assert.match(migration, /fanbus_effective_person/);
  assert.match(migration, /fanbus_registration_effective_key/);
  assert.match(migration, /FANBUS_BATCH_DUPLICATE/);
  assert.match(migration, /FANBUS_BOARDING_STOP_REQUIRED/);
  assert.match(migration, /FANBUS_BUS_PREFERENCE_INVALID/);
  assert.match(migration, /consentConfirmed/);
});

test("only the newly appended participant is waitlisted when capacity is exhausted", () => {
  assert.match(migration, /v_active_count>=app_private\.fanbus_effective_capacity/);
  assert.match(migration, /v_status := 'WAITLISTED'/);
  assert.match(migration, /insert into app_modules\.fanbus_registrations/);
  assert.doesNotMatch(migration, /update app_modules\.fanbus_registrations[\s\S]*set status='WAITLISTED'/i);
});

test("operator append is idempotent and audited", () => {
  assert.match(migration, /OPERATOR_APPEND/);
  assert.match(migration, /fanbus_m325_idempotency/);
  assert.match(migration, /FANBUS_BOOKING_OPERATOR_PARTICIPANT_ADDED/);
});

test("bus orga booking UI adds people in group context with fallbacks", () => {
  assert.match(ui, /data-m328-add-person/);
  assert.match(ui, /Person hinzufügen/);
  assert.match(ui, /fanbus_booking_group_candidates/);
  assert.match(ui, /Noch nicht gebuchte Gruppenmitglieder werden zuerst angeboten/);
  assert.match(ui, /fanbus_registration_people_list/);
  assert.match(ui, /fanbus_regular_riders_list/);
  assert.match(ui, /<summary>Bekannte Person<\\/summary>/);
  assert.match(ui, /<summary>Neuen Gast eintragen<\\/summary>/);
  assert.match(ui, /m328-add-person-action/);
  assert.match(ui, /fanbus_booking_operator_append/);
});

test("append controls remain usable on mobile", () => {
  assert.match(ui, /@media\(max-width:520px\)/);
  assert.match(ui, /m328-booking-actions\{grid-template-columns:1fr\}/);
  assert.match(ui, /m328-append-fields\{grid-template-columns:1fr\}/);
});


test("booking view applies the authoritative append response immediately", () => {
  assert.match(ui, /const result = await runWrite\([\s\S]*fanbus_booking_operator_append/);
  assert.match(ui, /closeAllDialogs\(\);\s*applyRegistrationResult\(state, result\);/);
  assert.doesNotMatch(ui, /booking\.participants\.push\(optimistic\)/);
  assert.doesNotMatch(ui, /window\.setTimeout\(async \(\) =>/);
});

test("operator group cache versions force the current booking module into the PWA", () => {
  assert.match(app, /pages\.js[^"]*fanbusappend=20260919-r6&groups=20260919-operational-groups1/);
  assert.match(pages, /bus-orga-bookings\.js\?v=20260919-fanbus-operator-append-r5&groups=20260919-operational-groups1/);
  assert.match(v3, /bus-orga-bookings\.js\?v=20260919-fanbus-operator-append-r5&groups=20260919-operational-groups1/);
  assert.match(index, /fanbusappend=20260919-r6&groups=20260919-operational-groups1/);
  assert.match(serviceWorker, /pd-portal-v4-fanbus-operational-groups-r1-20260919/);
});


const restoreContractMigration = read("../supabase/migrations/20260919212559_restore_fanbus_operator_append_contract.sql");

test("post-reconcile repair restores the authoritative operator append contract", () => {
  assert.match(restoreContractMigration, /create or replace function app_private\.api_fanbus_booking_operator_append\(p_payload jsonb\)/);
  assert.match(restoreContractMigration, /api_fanbus_booking_operator_append_before_authoritative_response_r2\(p_payload\)/);
  assert.match(restoreContractMigration, /api_fanbus_registrations_list/);
  assert.match(restoreContractMigration, /addedParticipantId/);
  assert.match(restoreContractMigration, /addedStatus/);
  assert.doesNotMatch(restoreContractMigration, /jsonb_object_keys\(p_payload\)/);
});

const authoritativeMigration = read("../supabase/migrations/20260919183100_fanbus_operator_append_authoritative_response_r2.sql");

test("authoritative append migration returns the refreshed registrations list", () => {
  assert.match(authoritativeMigration, /api_fanbus_registrations_list/);
  assert.match(authoritativeMigration, /addedParticipantId/);
  assert.match(authoritativeMigration, /addedStatus/);
});


test("booking header counts loaded current rows instead of stale bookingParticipantCount", () => {
  assert.match(ui, /function bookingCurrentCount\(booking\) \{\s*return booking\.participants\.filter\(cancellable\)\.length;\s*\}/);
  assert.doesNotMatch(ui, /Number\(person\?\.bookingParticipantCount\)/);
});

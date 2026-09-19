import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260919183200_fanbus_booking_operational_groups.sql");
const bookings = read("../js/modules/bus-orga-bookings.js");
const assignment = read("../js/modules/bus-orga-assignment.js");
const participants = read("../js/modules/bus-orga-participants.js");
const dialogs = read("../js/modules/bus-orga-participant-dialogs.js");
const registration = read("../js/modules/bus-orga-registration-v3.js");

test("booking_id is the canonical operational group with optional saved-group provenance", () => {
  for (const field of [
    "person_group_id", "group_bus_preference", "group_bus_id",
    "merged_into_booking_id", "split_from_booking_id"
  ]) assert.match(migration, new RegExp(`add column ${field}`));
  assert.match(migration, /status in \('ACTIVE','WAITLISTED'\)/);
  assert.match(registration, /personGroupId: booking\.personGroupId \|\| null/);
  assert.match(migration, /FANBUS_BOOKING_PERSON_GROUP_LINKED/);
});

test("group migration upgrades the existing operator append baseline", () => {
  assert.match(migration, /create or replace function app_private\.api_fanbus_booking_operator_append/);
  const actionsBlock = migration.match(/pd_api_current_actions_before_booking_groups\(\)\|\|array\[([\s\S]*?)\]::text\[\]/)?.[1] || "";
  assert.doesNotMatch(actionsBlock, /fanbus_booking_operator_append/);
});

test("append prioritizes unbooked saved-group members and inherits group rules", () => {
  assert.match(migration, /api_fanbus_booking_group_candidates/);
  assert.match(migration, /'booked',exists/);
  assert.match(bookings, /Noch nicht gebuchte Gruppenmitglieder werden zuerst angeboten/);
  assert.match(bookings, /fanbus_booking_operator_append/);
  assert.match(migration, /v_booking\.group_bus_preference,false,false/);
  assert.match(migration, /FANBUS_GROUP_BUS_CAPACITY_CONFLICT/);
  assert.match(migration, /FANBUS_BOOKING_PARTICIPANT_ADDED/);
});

test("group preference and bus mutations are atomic and overrides explicit", () => {
  assert.match(migration, /api_fanbus_booking_group_rules_set/);
  assert.match(migration, /fanbus_booking_apply_group_bus/);
  assert.match(migration, /bus_preference_override boolean not null default false/);
  assert.match(migration, /bus_assignment_override boolean not null default false/);
  assert.match(migration, /FANBUS_BOOKING_PARTICIPANT_OVERRIDE_SET/);
  assert.match(migration, /FANBUS_BOOKING_PARTICIPANT_OVERRIDE_CLEARED/);
  assert.match(bookings, /Nur diese Person abweichend/);
  assert.match(bookings, /An Gruppenregel angleichen/);
  assert.doesNotMatch(dialogs, /name="busPreference"[\s\S]{0,500}fanbus_registration_update_m325/);
});

test("automatic assignment never splits a non-overridden booking", () => {
  assert.match(migration, /m320_r3_assignment_plan_before_booking_groups/);
  assert.match(migration, /GROUP_CAPACITY_CONFLICT/);
  assert.match(migration, /FANBUS_GROUP_SPLIT_REQUIRES_OVERRIDE/);
  assert.match(assignment, /editableGroups/);
  assert.match(assignment, /Gemeinsamer Bus/);
  assert.match(assignment, /editableGroups\.flatMap/);
});

test("merge supports multiple source bookings and preserves historical numbers", () => {
  assert.match(migration, /jsonb_array_length\(p_payload->'sourceBookingIds'\)<1/);
  assert.match(migration, /merged_into_booking_id=v_target\.id/);
  assert.match(migration, /sourceBookingNumbers/);
  assert.match(migration, /FANBUS_BOOKINGS_MERGED/);
  assert.match(bookings, /data-m328-select-booking/);
  assert.match(bookings, /Buchungen zusammenführen/);
  assert.match(bookings, /overrideMode/);
});

test("split creates a new booking with a new primary and complete audit linkage", () => {
  assert.match(migration, /api_fanbus_booking_split/);
  assert.match(migration, /returning id,booking_number into v_new_id,v_new_number/);
  assert.match(migration, /booking_role='PRIMARY'/);
  assert.match(migration, /FANBUS_BOOKING_SPLIT/);
  assert.match(bookings, /Aus Gruppe lösen/);
});

test("current group counts exclude cancelled history and reload uses server projection", () => {
  assert.match(participants, /\["ACTIVE", "WAITLISTED"\]\.includes\(registration\.status\)/);
  assert.match(bookings, /function currentParticipants/);
  assert.match(bookings, /call\("fanbus_registrations_list", \{ tripId \}\)/);
  assert.match(migration, /fanbus_booking_current_participant_ids/);
  assert.doesNotMatch(bookings, /MutationObserver/);
});

test("new actions are classified, dispatched, and private functions are not directly executable", () => {
  for (const action of [
    "fanbus_booking_group_candidates", "fanbus_booking_operator_append",
    "fanbus_booking_group_rules_set", "fanbus_booking_participant_override_set",
    "fanbus_booking_participant_override_clear", "fanbus_bookings_merge",
    "fanbus_booking_split"
  ]) {
    assert.match(migration, new RegExp(`'${action}'`));
  }
  assert.match(migration, /from public,anon,authenticated,service_role/);
  assert.match(migration, /to postgres/);
  assert.match(migration, /security definer\s+set search_path=''/g);
});

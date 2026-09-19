import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260919231602_fanbus_travel_groups_r1.sql");
const bookings = read("../js/modules/bus-orga-bookings.js");
const assignment = read("../js/modules/bus-orga-assignment.js");
const workspace = read("../js/modules/bus-orga-workspace-base.js");
const worker = read("../service-worker.js");
const pages = read("../js/pages.js");
const app = read("../js/app.js");
const index = read("../index.html");

test("travel groups connect separate bookings without merging booking numbers", () => {
  assert.match(migration, /create table app_modules\.fanbus_travel_groups/);
  assert.match(migration, /add column travel_group_id uuid/);
  assert.match(migration, /api_fanbus_travel_group_connect/);
  assert.match(migration, /api_fanbus_travel_group_unlink/);
  assert.match(migration, /FANBUS_TRAVEL_GROUP_CONNECTED/);
  assert.match(migration, /fanbus_travel_group_connect/);
  assert.match(migration, /fanbus_travel_group_unlink/);
  assert.doesNotMatch(migration, /merged_into_booking_id\s*=/);
});

test("registration projection exposes travel-group metadata", () => {
  assert.match(migration, /travelGroupId/);
  assert.match(migration, /travelGroupName/);
  assert.match(migration, /travelGroupBusPreference/);
  assert.match(migration, /travelGroupBusId/);
  assert.match(migration, /travelGroupBookingCount/);
});

test("automatic assignment treats travel groups as one keep-together unit", () => {
  assert.match(migration, /m320_r3_assignment_plan_before_travel_groups_r1/);
  assert.match(migration, /TRAVEL_GROUP_TOGETHER/);
  assert.match(migration, /TRAVEL_GROUP_KEPT_TOGETHER/);
  assert.match(migration, /TRAVEL_GROUP_NO_COMMON_BUS/);
  assert.match(migration, /FANBUS_TRAVEL_GROUP_SPLIT_REQUIRES_OVERRIDE/);
  assert.match(migration, /m320_r3_assignment_fingerprint_before_travel_groups_r1/);
  assert.match(assignment, /proposal\.travelGroupId \|\| proposal\.bookingId/);
  assert.match(assignment, /Reisegruppe \$\{group\.travelGroupName/);
  assert.match(assignment, /Zusammenbleiben/);
  assert.match(assignment, /assignment_\$\{escapeAttr\(group\.unitKey\)\}/);
});

test("booking UI distinguishes travel-group linking from destructive merging", () => {
  assert.match(bookings, /m328ConnectTravelGroup/);
  assert.match(bookings, /Als Reisegruppe verbinden/);
  assert.match(bookings, /Buchungsnummern bleiben erhalten/);
  assert.match(bookings, /fanbus_travel_group_connect/);
  assert.match(bookings, /fanbus_travel_group_unlink/);
  assert.match(bookings, /<em>Reisegruppe<\/em>/);
  assert.match(bookings, /wirklich zusammenführen/);
});

test("small mobile UX fixes stay compact and single-column", () => {
  assert.match(bookings, /m328-primary-choice input\{width:15px!important;min-width:15px!important;height:15px!important/);
  assert.match(bookings, /return person\.bookingRole === "PRIMARY" \? "" : "Mitfahrer"/);
  assert.match(bookings, /m328-person-actions-menu>summary\{list-style:none;width:auto!important;min-height:28px!important/);
  assert.match(bookings, /m328-override-form/);
  assert.match(bookings, /\.m328-merge-form,\.m328-override-form,\.m328-travel-group-form\{grid-template-columns:1fr!important\}/);
  assert.match(bookings, /Aus Buchung lösen/);
});

test("travel-group warnings are translated for operators", () => {
  assert.match(workspace, /TRAVEL_GROUP_ALREADY_SPLIT_FIXED/);
  assert.match(workspace, /TRAVEL_GROUP_NO_COMMON_BUS/);
  assert.match(workspace, /TRAVEL_GROUP_KEPT_TOGETHER/);
});

test("PWA cache chain rotates for travel groups", () => {
  assert.match(worker, /FANBUS_TRAVEL_GROUPS_CACHE_VERSION/);
  assert.match(worker, /APP_CACHE = `\$\{FANBUS_TRAVEL_GROUPS_CACHE_VERSION\}-shell`/);
  assert.match(pages, /travelgroups=20260920-r1/);
  assert.match(app, /travelgroups=20260920-r1/);
  assert.match(index, /travelgroups=20260920-r1/);
});

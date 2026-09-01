import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tripDetail = fs.readFileSync(new URL("../js/modules/bus-orga-trip-detail.js", import.meta.url), "utf8");
const workspaceRouter = fs.readFileSync(new URL("../js/modules/bus-orga-trip-workspaces.js", import.meta.url), "utf8");
const workspaceBase = fs.readFileSync(new URL("../js/modules/bus-orga-workspace-base.js", import.meta.url), "utf8");
const participants = fs.readFileSync(new URL("../js/modules/bus-orga-participants.js", import.meta.url), "utf8");
const participantDialogs = fs.readFileSync(new URL("../js/modules/bus-orga-participant-dialogs.js", import.meta.url), "utf8");
const occupancy = fs.readFileSync(new URL("../js/modules/bus-orga-occupancy.js", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("../js/modules/bus-orga-operations.js", import.meta.url), "utf8");
const bookings = fs.readFileSync(new URL("../js/modules/bus-orga-bookings.js", import.meta.url), "utf8");
const subpageBack = fs.readFileSync(new URL("../js/m328-trip-subpage-back.js", import.meta.url), "utf8");
const pages = fs.readFileSync(new URL("../js/pages.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const workspaceCode = [workspaceRouter, workspaceBase, participants, participantDialogs, occupancy, operations].join("\n");

test("M328 trip detail stays inside native bus-orga workspaces behind one settings menu", () => {
  assert.doesNotMatch(tripDetail, /queueM328FanbusAction|openLegacyTripAction|#\/fanbuses\?/);
  assert.match(tripDetail, /data-m328-trip-settings/);
  assert.match(tripDetail, /function openTripMenu\(state\)/);
  assert.match(tripDetail, /\["bookings", "participants", "occupancy", "assignment", "operations"\]\.includes\(action\)/);
  assert.match(tripDetail, /return navigate\(action, trip\.id\)/);
  assert.doesNotMatch(tripDetail, /m328-trip-detail-work-actions/);
  assert.doesNotMatch(tripDetail, /<h3>Fahrt verwalten<\/h3>/);
});

test("M328 trip detail keeps the published badge top-right without a mobile status row", () => {
  assert.match(tripDetail, /m328-trip-detail-status\{position:absolute;right:0;top:4px/);
  assert.match(tripDetail, /m328-trip-detail-head\{position:relative;display:grid;grid-template-columns:auto minmax\(0,1fr\)/);
  assert.doesNotMatch(tripDetail, /@media\(max-width:620px\)[\s\S]*?m328-trip-detail-head>\.badge\{grid-column:2/);
});

test("M328 trip overview exposes bookings, participants, unassigned seats, buses and boarding stops", () => {
  assert.match(tripDetail, /function bookingSummary\(registrations\)/);
  assert.match(tripDetail, /function participantSummary\(registrations\)/);
  assert.match(tripDetail, /status === "ACTIVE" && !item\.busId/);
  assert.match(tripDetail, /Buchungen & Teilnehmer/);
  assert.match(tripDetail, /Nicht zugeordnet/);
  assert.match(tripDetail, /Busse & Zustiege/);
  assert.match(tripDetail, /formatBoardingTime\(stop\.departureAt\)/);
  for (const action of ["fanbus_registrations_list", "fanbus_buses_list", "fanbus_bus_boarding_stops_list", "fanbus_trip_boarding_stops_list"]) {
    assert.match(tripDetail, new RegExp(action));
  }
});

test("M328 native participants, buses and operations use one trip-return workspace shell", () => {
  assert.match(workspaceRouter, /export async function hydrateBusOrgaTripWorkspace/);
  assert.match(workspaceRouter, /view === "participants"/);
  assert.match(workspaceRouter, /view === "occupancy"/);
  assert.match(workspaceRouter, /view === "assignment"/);
  assert.match(workspaceRouter, /view === "operations"/);
  assert.match(workspaceBase, /data-m328-workspace-back>← Fahrt/);
  assert.match(workspaceBase, /export function backToTrip\(tripId\)/);
  assert.match(workspaceBase, /navigate\("trip-detail", tripId\)/);
  assert.match(workspaceRouter, /data-m328-workspace-load-back>← Fahrt/);
  assert.doesNotMatch(workspaceCode, /#\/fanbuses/);
});

test("M328 participant cards expose booking context and compact cancellation filters", () => {
  assert.match(participants, /class="m328-participant-card"/);
  assert.doesNotMatch(participants, /class="v4-m310-registration-record m328-participant-card"/);
  assert.match(participants, /Einzelbuchung/);
  assert.match(participants, /Gruppenbuchung · \$\{context\.count\} Personen/);
  assert.match(participants, /Mitfahrer · Gruppe \$\{context\.primaryName\}/);
  assert.match(participants, /value="CURRENT">Nicht storniert/);
  assert.match(participants, /status === "CURRENT" \? registration\.status !== "CANCELLED"/);
});

test("M328 booking overview has the same compact status filter and trip return", () => {
  assert.match(bookings, /m328-bookings-filter/);
  assert.match(bookings, /value="CURRENT">Nicht storniert/);
  assert.match(bookings, /← Fahrt/);
  assert.match(bookings, /view: "trip-detail"/);
  assert.match(bookings, /Einzelbuchung/);
  assert.match(bookings, /Mitfahrer · Gruppe/);
});

test("M328 operations filter is native and no longer inherits the broken legacy M325 grid", () => {
  assert.match(operations, /m328-operation-filter-form/);
  assert.match(operations, /m328-operation-filter-details/);
  assert.match(operations, /value="OPEN"/);
  assert.doesNotMatch(operations, /class="form-grid v4-smart-form v4-m325-operation-filters/);
});

test("M328 bus workspace is named Busse and preserves zero occupancy", () => {
  assert.match(occupancy, /workspacePage\("Busse", state\.trip/);
  assert.match(occupancy, /escapeHtml\(String\(occupancy\)\)/);
  assert.match(occupancy, /escapeHtml\(String\(bus\.capacity \?\? 0\)\)/);
  assert.match(workspaceBase, /m328-auto-assignment[\s\S]*white-space:normal/);
});

test("M328 native workspaces retain participant, assignment and operations contracts", () => {
  for (const action of [
    "fanbus_registrations_list",
    "fanbus_registration_update_m325",
    "fanbus_bus_assignment_set",
    "fanbus_waitlist_promote",
    "fanbus_registration_cancel",
    "fanbus_buses_list",
    "fanbus_bus_boarding_stops_set",
    "fanbus_assignment_preview",
    "fanbus_assignment_apply",
    "fanbus_operations_snapshot",
    "fanbus_checkin_set",
    "fanbus_paid_set",
  ]) assert.match(workspaceCode, new RegExp(action));
});

test("M328 final bus management cache chain remains explicit", () => {
  const key = "20260830-m328-final-bus-management1";
  assert.match(index, new RegExp(`m328-trip-subpage-back\\.js\\?v=${key}`));
  assert.match(index, new RegExp(`app\\.js[^\"]*m328final=${key}`));
  assert.match(app, new RegExp(`pages\\.js[^\"]*m328final=${key}`));
  for (const moduleName of ["bus-orga-trip-detail", "bus-orga-bookings", "bus-orga-trip-edit", "bus-orga-trip-workspaces"]) {
    assert.match(pages, new RegExp(`${moduleName}\\.js\\?v=${key}`));
  }
  assert.match(pages, /bus-orga-v3\.js\?[^"\n]*final=20260830-m328-final-bus-management1&registration=20260830-m328-registration-flow2/);
  assert.match(pages, /if \(view === "registration"\)[\s\S]*"hydrateBusOrgaV3"/);
});

test("M328 legacy trip edit and registration back controls still bridge normal navigation to the current trip", () => {
  assert.match(subpageBack, /SUBPAGE_VIEWS = new Set\(\["trip-edit", "registration"\]\)/);
  assert.match(subpageBack, /button\.textContent = "← Fahrt"/);
  assert.match(subpageBack, /view: "trip-detail"/);
});

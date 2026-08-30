import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tripDetail = fs.readFileSync(
  new URL("../js/modules/bus-orga-trip-detail.js", import.meta.url),
  "utf8",
);
const workspaceRouter = fs.readFileSync(
  new URL("../js/modules/bus-orga-trip-workspaces.js", import.meta.url),
  "utf8",
);
const workspaceBase = fs.readFileSync(
  new URL("../js/modules/bus-orga-workspace-base.js", import.meta.url),
  "utf8",
);
const participants = fs.readFileSync(
  new URL("../js/modules/bus-orga-participants.js", import.meta.url),
  "utf8",
);
const participantDialogs = fs.readFileSync(
  new URL("../js/modules/bus-orga-participant-dialogs.js", import.meta.url),
  "utf8",
);
const occupancy = fs.readFileSync(
  new URL("../js/modules/bus-orga-occupancy.js", import.meta.url),
  "utf8",
);
const operations = fs.readFileSync(
  new URL("../js/modules/bus-orga-operations.js", import.meta.url),
  "utf8",
);
const bookings = fs.readFileSync(
  new URL("../js/modules/bus-orga-bookings.js", import.meta.url),
  "utf8",
);
const subpageBack = fs.readFileSync(
  new URL("../js/m328-trip-subpage-back.js", import.meta.url),
  "utf8",
);
const pages = fs.readFileSync(new URL("../js/pages.js", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const workspaceCode = [workspaceRouter, workspaceBase, participants, participantDialogs, occupancy, operations].join("\n");

test("M328 trip detail stays inside the native bus-orga workspaces", () => {
  assert.doesNotMatch(tripDetail, /queueM328FanbusAction|openLegacyTripAction|#\/fanbuses\?/);
  assert.doesNotMatch(tripDetail, /actionButton\("registration"/);
  assert.match(
    tripDetail,
    /\["bookings", "participants", "occupancy", "operations"\]\.includes\(action\)/,
  );
  assert.match(tripDetail, /return navigate\(action, trip\.id\)/);
  assert.match(tripDetail, /actionButton\("bookings", "Buchungen"\)/);
  assert.match(tripDetail, /actionButton\("occupancy", "Busse"\)/);
  assert.doesNotMatch(tripDetail, /actionButton\("bookings", "Buchungen", "primary"\)/);
});

test("M328 trip detail keeps compact two-column mobile facts", () => {
  assert.match(
    tripDetail,
    /m328-trip-detail-facts\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  );
  assert.match(
    tripDetail,
    /m328-trip-detail-facts \.m328-trip-detail-fact-wide\{grid-column:1\/-1\}/,
  );
  assert.match(
    tripDetail,
    /@media\(max-width:620px\)[\s\S]*?m328-trip-detail-facts\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  );
  assert.match(tripDetail, /m328-trip-detail-action-edit:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/);
});

test("M328 native participants, buses and operations use one trip-return workspace shell", () => {
  assert.match(workspaceRouter, /export async function hydrateBusOrgaTripWorkspace/);
  assert.match(workspaceRouter, /view === "participants"/);
  assert.match(workspaceRouter, /view === "occupancy"/);
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
  ]) {
    assert.match(workspaceCode, new RegExp(action));
  }
});

test("M328 final bus management cache chain is explicit from index to feature modules", () => {
  const key = "20260830-m328-final-bus-management1";
  assert.match(index, new RegExp(`m328-trip-subpage-back\\.js\\?v=${key}`));
  assert.match(index, new RegExp(`app\\.js[^\"]*m328final=${key}`));
  assert.match(app, new RegExp(`pages\\.js[^\"]*m328final=${key}`));
  for (const moduleName of [
    "bus-orga-trip-detail",
    "bus-orga-bookings",
    "bus-orga-trip-edit",
    "bus-orga-registration-v3",
    "bus-orga-trip-workspaces",
  ]) {
    assert.match(pages, new RegExp(`${moduleName}\\.js\\?v=${key}`));
  }
  for (const moduleName of ["bus-orga-workspace-base", "bus-orga-participants", "bus-orga-occupancy", "bus-orga-operations"]) {
    assert.match(workspaceRouter, new RegExp(`${moduleName}\\.js\\?v=${key}`));
  }
});

test("M328 legacy trip edit and registration back controls are bridged to the current trip", () => {
  assert.match(subpageBack, /SUBPAGE_VIEWS = new Set\(\["trip-edit", "registration"\]\)/);
  assert.match(subpageBack, /button\.textContent = "← Fahrt"/);
  assert.match(subpageBack, /view: "trip-detail"/);
  assert.match(subpageBack, /location\.hash === "#\/bus-orga"/);
});

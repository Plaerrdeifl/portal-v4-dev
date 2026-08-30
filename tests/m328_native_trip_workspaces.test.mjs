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

test("M328 native participants, occupancy and operations use one workspace shell", () => {
  assert.match(workspaceRouter, /export async function hydrateBusOrgaTripWorkspace/);
  assert.match(workspaceRouter, /view === "participants"/);
  assert.match(workspaceRouter, /view === "occupancy"/);
  assert.match(workspaceRouter, /view === "operations"/);
  assert.match(workspaceBase, /data-m328-workspace-back>← Bus-Orga/);
  assert.match(workspaceBase, /location\.hash = "#\/bus-orga"/);
  assert.doesNotMatch(workspaceCode, /#\/fanbuses/);
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

test("M328 native workspace cache chain is explicit from index to feature modules", () => {
  const key = "20260830-m328-native-workspaces1";
  assert.match(index, new RegExp(`app\\.js[^\"]*m328workspaces=${key}`));
  assert.match(app, new RegExp(`pages\\.js[^\"]*m328workspaces=${key}`));
  assert.match(pages, new RegExp(`bus-orga-trip-detail\\.js\\?v=${key}`));
  assert.match(pages, new RegExp(`bus-orga-trip-workspaces\\.js\\?v=${key}`));
});

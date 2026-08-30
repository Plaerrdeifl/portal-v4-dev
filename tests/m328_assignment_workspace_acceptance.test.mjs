import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const tripDetail = read("../js/modules/bus-orga-trip-detail.js");
const workspaceRouter = read("../js/modules/bus-orga-trip-workspaces.js");
const buses = read("../js/modules/bus-orga-buses.js");
const assignment = read("../js/modules/bus-orga-assignment.js");
const participants = read("../js/modules/bus-orga-participants.js");
const pages = read("../js/pages.js");
const filterCleanup = read("../js/m328-booking-filter-cleanup.js");
const iosEntry = read("../js/m328-trip-edit-ios-fields.js");

test("M328 separates bus inventory from bus assignment", () => {
  assert.match(tripDetail, /actionButton\("occupancy", "Busse"\)/);
  assert.match(tripDetail, /actionButton\("assignment", "Zuordnung"\)/);
  assert.match(tripDetail, /canManage && canRegistrations/);
  assert.match(workspaceRouter, /view === "occupancy"[\s\S]*hydrateBuses/);
  assert.match(workspaceRouter, /view === "assignment"[\s\S]*hydrateAssignment/);
  assert.match(pages, /\["participants", "occupancy", "assignment", "operations"\]\.includes\(view\)/);
  assert.match(buses, /hydrateOccupancy\(root, tripId, context\)/);
  assert.match(buses, /querySelector\("\[data-m328-auto-assignment\]"\)\?\.remove\(\)/);
});

test("M328 assignment workspace exposes current assigned and unassigned ACTIVE participants", () => {
  assert.match(assignment, /registration\.status === "ACTIVE"/);
  assert.match(assignment, /Boolean\(registration\.busId\)/);
  assert.match(assignment, /Nicht zugeordnet/);
  assert.match(assignment, /Aktuelle Zuordnung/);
  assert.match(assignment, /Busbelegung/);
  assert.match(assignment, /fanbus_assignment_preview/);
  assert.match(assignment, /fanbus_assignment_apply/);
});

test("M328 participant cards visually identify related group bookings", () => {
  assert.match(participants, /function groupMarker\(registration, contexts\)/);
  assert.match(participants, /Gruppe \$\{context\.primaryName\} · \$\{context\.count\} Personen/);
  assert.match(participants, /\$\{groupMarker\(registration, contexts\)\}/);
});

test("M328 booking acceptance keeps exactly one compact filter surface", () => {
  assert.match(filterCleanup, /tools\.querySelector\("\.m328-bookings-filter"\)\?\.remove\(\)/);
  assert.match(filterCleanup, /\.m328-final-booking-filter-body\{position:absolute/);
  assert.match(filterCleanup, /width:min\(220px,calc\(100vw - 52px\)\)/);
  assert.match(iosEntry, /m328-booking-filter-cleanup\.js\?v=20260830-m328-booking-filter-cleanup1/);
});

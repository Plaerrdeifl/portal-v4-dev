import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routerSource = read("../js/router.js");
const authSource = read("../js/auth.js");
const pagesSource = read("../js/pages.js");
const dashboardHtml = read("../pages/bus-orga.html");
const dashboardSource = read("../js/modules/bus-orga.js");
const registrationSource = read("../js/modules/bus-orga-registration.js");
const shellSource = read("../js/m328-bus-orga-shell.js");
const directEntry = read("../bus-orga/index.html");
const buildSource = read("../scripts/build-static.mjs");

test("M328 provides a protected direct Bus-Orga entry", () => {
  assert.match(routerSource, /"bus-orga"\s*:\s*\{/);
  assert.match(routerSource, /page:\s*"bus-orga\.html"/);
  assert.match(routerSource, /system:\s*true/);
  assert.match(authSource, /key === "bus-orga"/);
  assert.match(pagesSource, /key === "bus-orga"/);
  assert.match(pagesSource, /modules\/bus-orga\.js/);
  assert.match(directEntry, /url=\/#\/bus-orga/);
  assert.match(buildSource, /"bus-orga"/);
});

test("M328 quick registration stays inside Bus-Orga and never routes through fanbuses", () => {
  assert.match(dashboardHtml, /id="m328QuickRegistration"[^>]*>Anmeldung<\/button>/);
  assert.match(dashboardSource, /function openRegistration\(tripId\)/);
  assert.match(dashboardSource, /view:\s*"registration"/);
  assert.match(dashboardSource, /location\.hash = `#\/bus-orga\?\$\{params\}`/);
  assert.match(dashboardSource, /if \(action === "add-registration"\) return openRegistration\(tripId\)/);
  assert.doesNotMatch(dashboardSource, /openFanbusContext\("add-registration"/);
  assert.match(dashboardSource, /hydrateBusOrgaRegistration\(context\)/);
});

test("M328 native registration view uses the existing M326 backend contracts directly", () => {
  for (const action of [
    "fanbus_trips_list",
    "fanbus_registration_people_list",
    "fanbus_regular_riders_list",
    "fanbus_person_groups_list",
    "fanbus_trip_boarding_stops_list",
    "fanbus_person_group_resolve",
    "fanbus_registration_create_manual_bulk"
  ]) {
    assert.match(registrationSource, new RegExp(action));
  }
  assert.match(registrationSource, /source:\s*"GUEST"/);
  assert.match(registrationSource, /source:\s*"REGULAR_RIDER"/);
  assert.match(registrationSource, /personType === "MEMBER"/);
  assert.match(registrationSource, /personType === "PORTAL_USER"/);
  assert.match(registrationSource, /data-m328-reg-source="GROUP"/);
  assert.match(registrationSource, /idempotencyKey:\s*manualAttempt\.key/);
  assert.match(registrationSource, /termsConfirmed:/);
});

test("M328 native registration has explicit return and returns after successful save", () => {
  assert.match(registrationSource, /← Bus-Orga/);
  assert.match(registrationSource, /location\.hash = "#\/bus-orga"/);
  const submitBlock = registrationSource.match(/async function submitRegistration[\s\S]*?\n\}/)?.[0] || "";
  assert.match(submitBlock, /fanbus_registration_create_manual_bulk/);
  assert.match(submitBlock, /location\.hash = "#\/bus-orga"/);
});

test("M328 removes the broken legacy registration preload and dialog flow", () => {
  assert.doesNotMatch(pagesSource, /m328-registration-preload/);
  assert.doesNotMatch(shellSource, /M328_REGISTRATION_FLOW_KEY/);
  assert.doesNotMatch(shellSource, /m328-registration-flow/);
  assert.doesNotMatch(shellSource, /data-m310-add-registration/);
  assert.doesNotMatch(shellSource, /pending\.action === "add-registration"/);
});

test("M328 quick registration labels use short date and venue only", () => {
  assert.match(dashboardSource, /function formatShortDate\(value\)/);
  assert.match(dashboardSource, /return match \? `\$\{match\[3\]\}\.\$\{match\[2\]\}\.`/);
  assert.match(dashboardSource, /const venue = String\(trip\?\.venue \|\| ""\)\.trim\(\) \|\| "Ort offen"/);
  const tripOptionBlock = dashboardSource.match(/function tripOption\(trip\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(tripOptionBlock, /displayTitle/);
});

test("M328 general administration stays collapsed and global only", () => {
  assert.match(dashboardHtml, /<details class="module-panel m328-workspaces m328-general-details">/);
  assert.match(dashboardHtml, />Allgemeine Verwaltung</);
  assert.doesNotMatch(dashboardHtml, /<details class="module-panel m328-workspaces m328-general-details" open/);
  const workspaceBlock = dashboardSource.match(/function renderWorkspaces\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(workspaceBlock, /title: "Zustiege"/);
  assert.match(workspaceBlock, /title: "Stammfahrer"/);
  assert.match(workspaceBlock, /title: "Gruppen"/);
  assert.doesNotMatch(workspaceBlock, /title: "Teilnehmer"/);
  assert.doesNotMatch(workspaceBlock, /title: "Busse"/);
});

test("M328 trip-specific actions stay inside each collapsed ride", () => {
  assert.match(dashboardHtml, />Fahrtenverwaltung</);
  assert.match(dashboardSource, /tripActionButton\("participants"/);
  assert.match(dashboardSource, /tripActionButton\("occupancy"/);
  assert.match(dashboardSource, /tripActionButton\("operations"/);
  assert.match(dashboardSource, /tripActionButton\("edit-trip"/);
  assert.match(dashboardSource, /data-m328-trip-toggle/);
  assert.match(dashboardSource, /aria-expanded="false"/);
  assert.match(dashboardSource, /data-m328-trip-expanded/);
});

test("M328 normal Fanbus view still exposes only one Bus-Orga entry", () => {
  assert.match(pagesSource, /m328-bus-orga-shell\.js/);
  assert.match(shellSource, /m328BusOrgaEntry/);
  assert.match(shellSource, /🚌 Bus-Orga/);
  assert.match(shellSource, /#m310AddTripButton/);
  assert.match(shellSource, /#m326RegularRidersButton/);
  assert.match(shellSource, /#m326PersonGroupsButton/);
  assert.match(shellSource, /#m310FanbusSettingsButton/);
  assert.match(shellSource, /\.v4-m310-trip-nav/);
});

test("M328 mobile registration and dashboard prevent horizontal clipping", () => {
  assert.match(dashboardHtml, /overflow-x:clip/);
  assert.match(registrationSource, /m328-reg-surface\{[^}]*overflow-x:clip/);
  assert.match(registrationSource, /@media\(max-width:520px\)/);
  assert.match(registrationSource, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

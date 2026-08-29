import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routerSource = read("../js/router.js");
const authSource = read("../js/auth.js");
const pagesSource = read("../js/pages.js");
const dashboardHtml = read("../pages/bus-orga.html");
const dashboardSource = read("../js/modules/bus-orga.js");
const shellSource = read("../js/m328-bus-orga-shell.js");
const directEntry = read("../bus-orga/index.html");
const buildSource = read("../scripts/build-static.mjs");

test("M328 provides a protected system route with post-login-compatible access", () => {
  assert.match(routerSource, /"bus-orga"\s*:\s*\{/);
  assert.match(routerSource, /page:\s*"bus-orga\.html"/);
  assert.match(routerSource, /system:\s*true/);
  assert.match(authSource, /key === "bus-orga"/);
  for (const capability of [
    "fanbus.manage",
    "fanbus.registrations.manage",
    "fanbus.operations.manage",
    "fanbus.payment_marker.manage"
  ]) {
    assert.match(authSource, new RegExp(capability.replaceAll(".", "\\.")));
  }
  assert.match(pagesSource, /key === "bus-orga"/);
  assert.match(pagesSource, /modules\/bus-orga\.js/);
});

test("M328 direct entry is included in the static Cloudflare Pages build", () => {
  assert.match(directEntry, /url=\/#\/bus-orga/);
  assert.match(directEntry, /href="\/#\/bus-orga"/);
  assert.match(buildSource, /"bus-orga"/);
});

test("M328 dashboard prioritizes manual registration and existing workspaces", () => {
  assert.match(dashboardHtml, /＋ Anmeldung erfassen/);
  assert.match(dashboardHtml, /m328QuickRegistrationTrip/);
  assert.match(dashboardHtml, /m328BusOrgaBack/);
  assert.match(dashboardHtml, /m328BusOrgaClose/);
  assert.match(dashboardSource, /call\("fanbus_trips_list"\)/);
  assert.match(dashboardSource, /openFanbusContext\("add-registration"/);
  assert.match(dashboardSource, /queueM328FanbusAction\(action, tripId\)/);
  assert.match(dashboardSource, /openWorkspace\("operations"/);
  assert.match(dashboardSource, /openWorkspace\("regular-riders"\)/);
  assert.match(dashboardSource, /openWorkspace\("person-groups"\)/);
  assert.match(dashboardSource, /openWorkspace\("settings"\)/);
});

test("M328 quick registration labels use only date and venue", () => {
  assert.match(dashboardSource, /const venue = String\(trip\?\.venue \|\| ""\)\.trim\(\) \|\| "Ort offen"/);
  assert.match(dashboardSource, /formatDate\(trip\.eventDate\)\}\ · \$\{venue\}/);
  const tripOptionBlock = dashboardSource.match(/function tripOption\(trip\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(tripOptionBlock, /displayTitle/);
});

test("M328 separates general administration from trip-specific administration", () => {
  assert.match(dashboardHtml, />Allgemeine Verwaltung</);
  assert.match(dashboardHtml, />Fahrtenverwaltung</);
  const workspaceBlock = dashboardSource.match(/function renderWorkspaces\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(workspaceBlock, /title: "Zustiege"/);
  assert.match(workspaceBlock, /title: "Stammfahrer"/);
  assert.match(workspaceBlock, /title: "Gruppen"/);
  assert.doesNotMatch(workspaceBlock, /title: "Fahrten"/);
  assert.doesNotMatch(workspaceBlock, /title: "Teilnehmer"/);
  assert.doesNotMatch(workspaceBlock, /title: "Busse"/);
  assert.doesNotMatch(workspaceBlock, /title: "Fahrtbetrieb"/);
  assert.match(dashboardSource, /tripActionButton\("participants"/);
  assert.match(dashboardSource, /tripActionButton\("occupancy"/);
  assert.match(dashboardSource, /tripActionButton\("operations"/);
  assert.match(dashboardSource, /tripActionButton\("edit-trip"/);
});

test("M328 removes administration controls from normal fanbus view", () => {
  assert.match(pagesSource, /m328-bus-orga-shell\.js/);
  assert.match(shellSource, /m328BusOrgaEntry/);
  assert.match(shellSource, /🚌 Bus-Orga/);
  assert.match(shellSource, /#m310AddTripButton/);
  assert.match(shellSource, /#m326RegularRidersButton/);
  assert.match(shellSource, /#m326PersonGroupsButton/);
  assert.match(shellSource, /#m310FanbusSettingsButton/);
  assert.match(shellSource, /\.v4-m310-trip-nav/);
  assert.match(shellSource, /\.v4-m310-more-actions/);
  assert.match(shellSource, /:not\(\[data-m328-orga-context="true"\]\)/);
});

test("M328 reuses the existing participant composer for quick registration", () => {
  assert.match(shellSource, /data-m310-participants/);
  assert.match(shellSource, /data-m310-add-registration/);
  assert.match(shellSource, /pending\.action === "add-registration"/);
  assert.doesNotMatch(dashboardSource, /fanbus_registration_create_manual_bulk/);
});

test("M328 recognizes fanbus administration context without changing normal routes", () => {
  assert.match(shellSource, /function isM328BusOrgaContext/);
  assert.match(shellSource, /params\.get\("orga"\) === "1"/);
  assert.match(shellSource, /params\.get\("from"\) === "bus-orga"/);
  assert.match(shellSource, /new URLSearchParams\(query\)/);
  assert.match(shellSource, /location\.hash = "#\/bus-orga"/);
});

test("M328 mobile dashboard is compact and prevents horizontal clipping", () => {
  assert.match(dashboardHtml, /overflow-x:clip/);
  assert.match(dashboardHtml, /#m328QuickRegistrationTrip\{[\s\S]*?max-width:100%/);
  assert.match(dashboardHtml, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(dashboardHtml, /@media\(max-width:700px\)[\s\S]*?\.m328-workspace-card small\{[\s\S]*?display:none/);
  assert.doesNotMatch(dashboardHtml, /@media\(max-width:390px\)[\s\S]*?\.m328-workspace-grid\{[\s\S]*?grid-template-columns:1fr/);
  assert.match(dashboardSource, /title: "Zustiege"/);
  assert.match(dashboardSource, /title: "Stammfahrer"/);
  assert.match(dashboardSource, /title: "Gruppen"/);
});

test("M328 trip management is collapsed by default and expands one ride at a time", () => {
  assert.match(dashboardSource, /data-m328-trip-toggle/);
  assert.match(dashboardSource, /aria-expanded="false"/);
  assert.match(dashboardSource, /data-m328-trip-expanded/);
  assert.match(dashboardSource, /hidden>/);
  assert.match(dashboardSource, /function setTripExpanded/);
  assert.match(dashboardSource, /body\.hidden = !expanded/);
  assert.match(dashboardHtml, /\.m328-trip-expanded\[hidden\]/);
  assert.match(dashboardHtml, /\.m328-trip-actions\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

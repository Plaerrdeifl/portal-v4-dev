import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isM328BusOrgaContext,
  m328FanbusRouteParams
} from "../js/m328-bus-orga-shell.js";

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
  assert.match(dashboardSource, /queueM328FanbusAction\("add-registration"/);
  assert.match(dashboardSource, /view:\s*"operations"|openWorkspace\("operations"/);
  assert.match(dashboardSource, /openWorkspace\("regular-riders"\)/);
  assert.match(dashboardSource, /openWorkspace\("person-groups"\)/);
  assert.match(dashboardSource, /openWorkspace\("settings"\)/);
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
  assert.equal(isM328BusOrgaContext("#/fanbuses?orga=1&from=bus-orga"), true);
  assert.equal(isM328BusOrgaContext("#/fanbuses?view=settings&from=bus-orga"), true);
  assert.equal(isM328BusOrgaContext("#/fanbuses"), false);
  assert.equal(m328FanbusRouteParams("#/fanbuses?orga=1&x=2").get("x"), "2");
});

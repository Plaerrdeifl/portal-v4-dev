import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const preloadSource = read("../js/m328-registration-preload.js");
const shellSource = read("../js/m328-bus-orga-shell.js");

test("M328 prepares registration before legacy fanbus hydration", () => {
  const preloadIndex = pagesSource.indexOf("setupM328RegistrationPreload");
  const shellIndex = pagesSource.indexOf("setupM328BusOrgaShell");
  const hydrateIndex = pagesSource.indexOf("hydrateFanbuses");
  assert.ok(preloadIndex >= 0);
  assert.ok(shellIndex > preloadIndex);
  assert.ok(hydrateIndex > shellIndex);
});

test("M328 hides intermediate fanbus dialogs until the M326 composer is ready", () => {
  assert.match(preloadSource, /m328-registration-route-mask/);
  assert.match(preloadSource, /m328-registration-preparing/);
  assert.match(preloadSource, /#m326ManualComposerForm/);
  assert.match(preloadSource, /Personen, Stammfahrer, Gruppen und Zustiege werden geladen/);
  assert.match(preloadSource, /← Bus-Orga/);
  assert.match(preloadSource, /location\.hash = "#\/bus-orga"/);
});

test("M328 still reuses the existing M326 registration flow", () => {
  assert.match(shellSource, /pending\.action === "add-registration"/);
  assert.match(shellSource, /data-m310-add-registration/);
  assert.match(shellSource, /#m326ManualComposerForm/);
  assert.doesNotMatch(preloadSource, /fanbus_registration_create_manual_bulk/);
});

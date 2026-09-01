import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const quick = read("../js/m328-quick-change.js");
const quickBack = read("../js/m328-quick-back.js");
const iosEntry = read("../js/m328-trip-edit-ios-fields.js");
const tripDetail = read("../js/modules/bus-orga-trip-detail.js");

test("M328 quick registration becomes an expandable quick change workflow", () => {
  for (const label of [
    "Schnelländerung",
    "Anmeldung hinzufügen",
    "Buchungen anzeigen",
    "Teilnehmer anzeigen",
    "Busse anzeigen",
    "Buszuordnung",
    "Fahrtbetrieb",
    "Fahrtdaten bearbeiten",
  ]) assert.match(quick, new RegExp(label));
  assert.match(quick, /replaceLegacyQuickSection/);
  assert.match(quick, /from: "quick"/);
  assert.doesNotMatch(quick, /Fahrt absagen|Entwurf löschen|Veröffentlichen/);
});

test("M328 quick action expands locally without router navigation", () => {
  assert.match(quick, /class="m328-quick-game-row"/);
  assert.match(quick, /<span>Spiel<\/span>/);
  assert.match(quick, /<select data-m328-quick-game aria-label="Spiel auswählen"/);
  assert.match(quick, /Spiel auswählen …/);
  assert.match(quick, /renderTripPicker\(section, items, action\)/);
  assert.match(quick, /clearQuickRouteWithoutNavigation/);
  assert.match(quick, /history\.replaceState\(history\.state, "", "#\/bus-orga"\)/);
  assert.doesNotMatch(quick, /function openActionSelection/);
  assert.doesNotMatch(quick, /data-m328-quick-trip=/);
  assert.doesNotMatch(quick, /m328-quick-trip-list/);
});

test("M328 quick selection closes through the details control instead of an internal back button", () => {
  assert.doesNotMatch(quick, /data-m328-quick-back/);
  assert.match(quick, /section\.ontoggle = \(\) => \{/);
  assert.match(quick, /if \(section\.open\) return;[\s\S]*?clearQuickRouteWithoutNavigation\(\);[\s\S]*?renderActionList\(section, items, actions\);/);
  assert.match(quick, /m328-quick-picker-title/);
});

test("M328 quick game selection navigates only after a concrete game was chosen", () => {
  assert.match(quick, /select\?\.addEventListener\("change"/);
  assert.match(quick, /if \(select\.value\) openTarget\(action, select\.value\)/);
  assert.match(quick, /function openTarget\(action, tripId\)[\s\S]*?location\.hash = `#\/bus-orga\?\$\{params\}`/);
});

test("M328 quick targets return one step to the selected quick action", () => {
  assert.match(quickBack, /window\.addEventListener\("click"/);
  assert.match(quickBack, /from === "quick" && route\.quick/);
  assert.match(quickBack, /quickSelectionHash\(route\.quick\)/);
  assert.match(quickBack, /content:"← Auswahl"/);
});

test("M328 quick modules are loaded before the legacy acceptance back interceptor", () => {
  const quickIndex = iosEntry.indexOf('m328-quick-change.js?v=20260830-m328-quick-change4');
  const backIndex = iosEntry.indexOf('m328-quick-back.js?v=20260830-m328-quick-back1');
  const acceptanceIndex = iosEntry.indexOf('m328-final-acceptance.js?v=20260830-m328-final-acceptance2');
  assert.ok(quickIndex >= 0);
  assert.ok(backIndex >= 0);
  assert.ok(acceptanceIndex > backIndex);
});

test("M328 trip detail is overview-first and exposes management only through the gear", () => {
  assert.match(tripDetail, /data-m328-trip-settings/);
  assert.match(tripDetail, /Fahrtdaten/);
  assert.match(tripDetail, /Buchungen & Teilnehmer/);
  assert.match(tripDetail, /Busse & Zustiege/);
  assert.match(tripDetail, /m328-trip-detail-status\{position:absolute;right:0;top:4px/);
  assert.doesNotMatch(tripDetail, /m328-trip-detail-work-actions/);
});

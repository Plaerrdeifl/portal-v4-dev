import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [common, ui, fanbuses, dates, page, css] = await Promise.all([
  read("js/modules/common.js"),
  read("js/ui.js"),
  read("js/modules/fanbuses.js"),
  read("js/modules/dates.js"),
  read("pages/fanbuses.html"),
  read("css/app.css")
]);

test("shared native dialog preserves parent content, focus and scroll for X, Escape and cancel", () => {
  assert.match(common, /const dialogContexts = \[\]/);
  assert.match(common, /function saveDialogContext\(dialog\)/);
  assert.match(common, /content:?[\s\S]*focus,?[\s\S]*scrollTop/);
  assert.match(common, /function restoreDialogContext\(dialog\)/);
  assert.match(common, /dialog\.addEventListener\("cancel"[\s\S]*event\.preventDefault\(\)[\s\S]*closeDialog\(dialog\)/);
  assert.match(common, /data-v4-dialog-close/);
  assert.match(common, /export function closeAllDialogs\(\)/);
});

test("central toast region moves into an open modal top-layer context", () => {
  assert.match(ui, /getElementById\("v4Dialog"\)/);
  assert.match(ui, /appendChild\(region\)/);
  assert.match(ui, /v4-dialog-modal-state/);
  assert.match(ui, /setTimeout\(remove, timeout\)/);
  assert.match(css, /\.v4-dialog > \.toast-region/);
});

test("fanbus page exposes one accessible compact global action menu", () => {
  assert.match(page, /id="m310FanbusActionToggle"/);
  assert.match(page, /aria-controls="m310FanbusActionMenu"/);
  assert.match(page, /aria-expanded="false"/);
  assert.match(page, /role="menu"/);
  assert.match(page, /id="m325CompanionListsButton"[\s\S]*Meine Mitfahrer/);
  assert.match(page, /id="m310AddTripButton"[\s\S]*hidden/);
  assert.match(fanbuses, /setupFanbusActionMenu\(canManage\)/);
  assert.match(fanbuses, /event\.key === "Escape"/);
  assert.match(fanbuses, /!root\.contains\(event\.target\)/);
});

test("trip detail is compact and has Overview, occupancy, operations and management access", () => {
  const detailStart = fanbuses.indexOf("function tripDetailMarkup(trip, tripStops = [])");
  const detailEnd = fanbuses.indexOf("function tripTable", detailStart);
  const detailSource = fanbuses.slice(detailStart, detailEnd);
  const navigationStart = fanbuses.indexOf("function tripNavigation(trip)");
  const navigationEnd = fanbuses.indexOf(
    "function tripDetailMarkup(trip, tripStops = [])",
    navigationStart
  );
  const navigationSource = fanbuses.slice(navigationStart, navigationEnd);

  assert.notEqual(detailStart, -1);
  assert.notEqual(detailEnd, -1);
  assert.notEqual(navigationStart, -1);
  assert.notEqual(navigationEnd, -1);
  assert.match(detailSource, /eventTimeCompact\(trip\.eventTime\)/);
  assert.doesNotMatch(detailSource, /v4-m310-trip-status|tripBadges\\(trip\\)/);
  assert.match(detailSource, /v4-m325-trip-travel/);
  assert.match(detailSource, /registrationWindowText\(trip\)/);
  assert.match(detailSource, /\$\{tripNavigation\(trip\)\}/);
  assert.doesNotMatch(detailSource, /Anmeldungen \/ Kapazität/);
  assert.doesNotMatch(detailSource, /Meine Mitfahrer/);
  assert.doesNotMatch(detailSource, /data-m320-buses|data-m325-companions/);
  assert.match(detailSource, /data-m310-edit-mode/);
  assert.match(detailSource, />Abbrechen</);
  assert.match(detailSource, />Änderungen speichern</);

  assert.doesNotMatch(navigationSource, />Übersicht</);
  assert.match(navigationSource, />Belegung</);
  assert.match(navigationSource, />Fahrtbetrieb</);
  assert.match(navigationSource, /data-m310-trip-settings/);
  assert.match(navigationSource, /canManageRegistrations/);
  assert.match(navigationSource, /const canOpenOccupancy = canManage \|\| canManageRegistrations/);
});

test("occupancy remains bus-centered and preserves per-bus stop mapping", () => {
  assert.match(fanbuses, /function occupancyMarkup\(data, busMappings, tripStops, access\)/);
  assert.match(fanbuses, /<\/strong>Teilnehmer<\/span>/);
  assert.match(fanbuses, /<\/strong>Gesamtplätze<\/span>/);
  assert.match(fanbuses, /<\/strong>Warteliste<\/span>/);
  assert.match(fanbuses, /<\/strong>Ohne Bus<\/span>/);
  assert.match(fanbuses, /mapping\.tripBoardingStopIds/);
  assert.match(fanbuses, /fanbus_bus_boarding_stops_set/);
  assert.match(fanbuses, /data-m310-occupancy-assignment/);
  assert.match(fanbuses, /fanbus_bus_assignment_set/);
  assert.match(fanbuses, /data-m310-occupancy-promote/);
  assert.match(fanbuses, /Die Auswahl gilt ausschließlich für diesen Bus/);
  assert.match(fanbuses, /data-m310-create-bus/);
  assert.match(fanbuses, /data-m320-edit-bus/);
});

test("calendar links only published existing fanbus snapshots by eventId", () => {
  assert.match(dates, /call\("fanbus_trips_list"\)/);
  assert.match(dates, /trip\.eventId === eventId && trip\.status === "PUBLISHED"/);
  assert.match(dates, />🚌 Fanbus<\/a>/);
  assert.match(dates, /#\/fanbuses\?detail=/);
  assert.doesNotMatch(dates, /trip\.status === "DRAFT"/);
});

test("M325 workspace retains trip return context and uses the real view scroller", () => {
  assert.match(fanbuses, /fromTrip=/);
  assert.match(fanbuses, /history\.replaceState\(null, "", `#\/fanbuses\?detail=/);
  assert.match(fanbuses, /document\.getElementById\("view"\)\?\.scrollTop/);
  assert.match(fanbuses, /document\.getElementById\("view"\)[\s\S]*scrollTo/);
  assert.doesNotMatch(fanbuses, /operationsUiState\.scrollY = window\.scrollY/);
});

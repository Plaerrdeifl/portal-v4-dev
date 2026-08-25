import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("P800-R2 Fanbus detail follows the approved information hierarchy", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const detail = section(fanbuses, "function tripDetailMarkup", "function openTripDetail");
  assert.match(detail, /formatBerlinTime\(trip\.departureAt\)/);
  assert.doesNotMatch(detail, /formatBerlinDateTime\(trip\.departureAt\)/);
  assert.ok(detail.indexOf("tripDetailStopsMarkup") < detail.indexOf("tripRegistrationDeadlineMarkup"));
  assert.match(fanbuses, /ANMELDESCHLUSS/);
});

test("P800-R2 trip navigation exposes direct work areas without a per-trip gear", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const nav = section(fanbuses, "function tripNavigation", "function normalizedTripDetailStops");
  assert.match(nav, /data-m310-participants/);
  assert.match(nav, />Teilnehmerliste</);
  assert.match(nav, /data-m310-occupancy/);
  assert.match(nav, /Busverwaltung/);
  assert.match(nav, />Fahrtbetrieb</);
  assert.match(nav, /data-m310-edit-mode/);
  assert.match(nav, />Weitere Aktionen</);
  assert.doesNotMatch(nav, /⚙️|data-m310-trip-settings/);
});

test("P800-R2 editor uses time-only departure and central stop selections", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const form = section(fanbuses, "function tripStopMasterOptions", "function tripUpdatePayload");
  assert.match(form, /name="departureTime" type="time"/);
  assert.match(form, /name="registrationClosesAt" type="datetime-local"/);
  assert.match(form, /data-m310-trip-stop-editor-row/);
  assert.match(form, /data-m310-trip-stop-master/);
  assert.match(form, /data-m310-trip-stop-time/);
  assert.match(form, /data-m310-trip-stop-add/);
  assert.match(fanbuses, /call\("fanbus_boarding_stops_list"\)/);
  assert.match(fanbuses, /call\("fanbus_trip_boarding_stop_upsert"/);
});

test("P800-R2 central boarding stops live in Fanbus settings", async () => {
  const [fanbuses, page] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("pages/fanbuses.html")
  ]);
  assert.match(page, /id="m310FanbusSettingsButton"/);
  assert.match(page, />Fanbus-Einstellungen</);
  assert.match(fanbuses, /view=settings/);
  assert.match(fanbuses, /function renderFanbusSettingsWorkspace/);
  assert.match(fanbuses, /Zentrale Zustiegsorte/);
  assert.doesNotMatch(section(fanbuses, "function tripManagementActions", "function registrationWindowText"), /Zustiegsstammdaten/);
});

test("P800-R2 workflow UX remains frontend-only and does not implement automatic assignment", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  assert.doesNotMatch(fanbuses, /fanbus_(?:auto|automatic).*assign/i);
});

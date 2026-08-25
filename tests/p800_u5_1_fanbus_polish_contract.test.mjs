import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [fanbuses, css, page, sql, publicRegistration, wordpressFanbus] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("css/app.css"),
  read("pages/fanbuses.html"),
  read("supabase/migrations/20260815223000_p800_u5_1_remove_departure_info_requirement.sql"),
  read("js/fanbus-registration.js"),
  read("wordpress/plugins/plaerrdeifl-m310-fanbus/plaerrdeifl-m310-fanbus.php")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("U5.1 detail uses normal stop styling, lifecycle status and right-aligned registration", () => {
  const detail = section(fanbuses, "function tripDetailMarkup", "function openTripDetail");
  const stops = section(fanbuses, "function tripDetailStopsMarkup", "async function loadTripDetailStops");
  assert.match(detail, /tripLifecycleBadge\(trip\)/);
  assert.doesNotMatch(detail, /tripBadges\(trip\)/);
  assert.match(stops, /v4-preserve-lines/);
  assert.doesNotMatch(stops, /v4-m325-trip-stop-list|v4-m325-trip-stop"/);
  assert.match(css, /\.v4-m310-register-link[\s\S]*justify-self:\s*end/);
});

test("U5.1 moves trip edit into management menu and removes legacy meeting field", () => {
  const management = section(fanbuses, "function tripManagementActions", "function registrationWindowText");
  const navigation = section(fanbuses, "function tripNavigation", "function normalizedTripDetailStops");
  const form = section(fanbuses, "function tripForm", "function tripUpdatePayload");
  assert.doesNotMatch(management, /data-m310-edit-mode/);
  assert.match(navigation, /data-m310-edit-mode/);
  assert.doesNotMatch(form, /Treffpunkt \/ Abfahrtsort|name="departureInfo"/);
  assert.match(fanbuses, /departureInfo:\s*trip\.departureInfo \|\| null/);
});

test("U5.1 participant filters are a two by two grid with explicit actions", () => {
  assert.equal((fanbuses.match(/class="v4-m320-filter-half"/g) || []).length, 4);
  assert.match(css, /v4-m320-filter-half[\s\S]*grid-column:\s*span 6/);
  assert.doesNotMatch(fanbuses, /data-m320-open-registration/);
  assert.match(fanbuses, /function openRegistrationActions/);
  const card = section(fanbuses, "function registrationCard", "async function cancelRegistrationFromActions");
  assert.match(card, /data-m320-edit-registration/);
  assert.match(card, /data-m320-more-registration/);
  assert.doesNotMatch(card, /tabindex="0" role="button"/);
});

test("U5.1 bus cards are clickable and expose edit plus boarding-stop actions", () => {
  const occupancy = section(fanbuses, "function occupancyMarkup", "async function occupancyData");
  assert.match(occupancy, /data-m310-open-bus-actions/);
  assert.match(occupancy, /function openBusActions/);
  assert.match(occupancy, />Bus bearbeiten</);
  assert.match(occupancy, />Zustiege verwalten</);
  assert.match(occupancy, />Bus löschen</);
});

test("U5.1 normalizes Fanbus gear title alignment and bus checkboxes", () => {
  assert.match(page, /v4-m310-heading-title-row[\s\S]*Fanbusfahrten[\s\S]*m310FanbusManagement/);
  assert.match(css, /v4-m310-heading-title-row[\s\S]*align-items:\s*center/);
  assert.match(css, /input\[type="checkbox"\][\s\S]*width:\s*20px/);
  assert.match(css, /font-size:\s*\.9rem/);
});

test("U5.1 backend no longer requires legacy departure_info", () => {
  assert.doesNotMatch(sql, /v_existing\.departure_info is null/);
  assert.doesNotMatch(sql, /length\(btrim\(v_existing\.departure_info\)\)/);
  assert.doesNotMatch(sql, /v_trip\.departure_info is null/);
  assert.doesNotMatch(sql, /length\(btrim\(v_trip\.departure_info\)\)/);
  assert.doesNotMatch(sql, /nullif\(btrim\(trip\.departure_info\), ''\) is (?:null|not null)/);
});


test("U5.1 public registration no longer renders legacy departure info", () => {
  assert.doesNotMatch(publicRegistration, /Abfahrtsinfo/);
  assert.doesNotMatch(publicRegistration, /trip\.departureInfo/);
});

test("U5.1 WordPress accepts legacy departureInfo only as optional transport data", () => {
  assert.match(wordpressFanbus, /'departureInfo'/);
  assert.match(
    wordpressFanbus,
    /valid_optional_text\(\$value\['departureInfo'\], 4000\)/
  );
  assert.doesNotMatch(
    wordpressFanbus,
    /valid_text\(\$value\['departureInfo'\], 4000\)/
  );
  assert.doesNotMatch(wordpressFanbus, /<strong>Abfahrtsinfo<\/strong>/);
  assert.doesNotMatch(wordpressFanbus, /pd-m310-departure-info/);
  assert.match(wordpressFanbus, /Version: 1\.0\.5/);
  assert.match(wordpressFanbus, /private const VERSION = '1\.0\.5'/);
});

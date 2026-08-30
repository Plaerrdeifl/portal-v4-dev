import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const fanbuses = read("../js/modules/fanbuses.js");
const shell = read("../js/m328-bus-orga-shell.js");
const overview = read("../js/modules/bus-orga-v2.js");
const router = read("../js/modules/bus-orga-v3.js");
const detail = read("../js/modules/bus-orga-trip-detail.js");
const pages = read("../js/pages.js");
const app = read("../js/app.js");
const index = read("../index.html");
const originalBookingMigration = read("../supabase/migrations/20260829090000_m328_r1_booking_management.sql");
const completionMigration = read("../supabase/migrations/20260829213946_m328_completion_public_trips_dev_booking_numbers.sql");

test("normal Fanbus view is fail-closed to public, published and available trips", () => {
  const filter = fanbuses.match(/function publicFanbusTrips\(items\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(filter, /trip\?\.status === "PUBLISHED"/);
  assert.match(filter, /trip\?\.visibility === "PUBLIC"/);
  assert.match(filter, /trip\?\.registrationStatus !== "UNAVAILABLE"/);
  assert.match(fanbuses, /const items = publicFanbusTrips\(trips\(\)\)/);
  assert.match(fanbuses, /const detailTrip = items\.find\(item => item\.id === routeQuery\.get\("detail"\)\)/);
  assert.match(overview, /const data = await call\("fanbus_trips_list"\)/);
  assert.match(overview, /renderTrips\(items\)/);
});

test("public database list, direct detail and boarding stops expose published trips only", () => {
  assert.match(completionMigration, /rename to pd_public_fanbus_trip_before_m328_completion/);
  assert.match(completionMigration, /rename to pd_public_fanbus_trips_before_m328_completion/);
  assert.match(completionMigration, /item\.value ->> 'tripStatus' = 'PUBLISHED'/);
  assert.match(completionMigration, /coalesce\(v_base ->> 'tripStatus', ''\) <> 'PUBLISHED'/);
  assert.match(completionMigration, /jsonb_build_object\('available', false\)/);
  assert.match(completionMigration, /pd_public_fanbus_trip_boarding_stops_before_m328_completion/);
  assert.match(completionMigration, /jsonb_build_object\('stops', '\[\]'::jsonb\)/);
  assert.match(completionMigration, /from public, anon, authenticated, service_role/);
  assert.match(completionMigration, /to anon, authenticated/);
  assert.doesNotMatch(completionMigration, /api_fanbus_trips_list\s*\(/);
});

test("central boarding-stop help text remains visible and exact", () => {
  assert.match(fanbuses, /Hier werden die Zustiegsorte angelegt, die später in den Bus-Einstellungen ausgewählt werden können\./);
  assert.match(fanbuses, /<p class="subtle">Hier werden/);
  assert.doesNotMatch(shell, /fanbus-settings\] \.v4-m310-settings-section-heading \.subtle"\)\?\.remove/);
});

test("ride cards navigate to an authenticated native detail page instead of expanding inline", () => {
  assert.match(overview, /data-m328-trip-open/);
  assert.match(overview, /view: "trip-detail"/);
  assert.doesNotMatch(overview, /data-m328-trip-toggle/);
  assert.doesNotMatch(overview, /m328-trip-expanded/);
  assert.match(router, /view === "trip-detail"/);
  assert.match(router, /hydrateBusOrgaTripDetail\(context\)/);
  assert.match(detail, /BUS_ORGA_CAPABILITIES\.some/);
  assert.match(detail, /call\("fanbus_trips_list"\)/);
  assert.match(detail, /find\(item => item\.id === tripId\)/);
  assert.match(detail, /data-trip-detail-back/);
  assert.match(detail, /location\.hash = "#\/bus-orga"/);
});

test("native detail reuses the existing server actions behind the overview gear menu", () => {
  for (const action of [
    "fanbus_trip_publish",
    "fanbus_trip_close",
    "fanbus_trip_reopen",
    "fanbus_trip_delete",
    "fanbus_trip_cancel"
  ]) assert.match(detail, new RegExp(action));
  for (const label of ["Buchungen", "Teilnehmer", "Busse", "Buszuordnung", "Fahrtbetrieb", "Fahrtdaten bearbeiten"]) {
    assert.match(detail, new RegExp(label));
  }
  assert.match(detail, /data-m328-trip-settings/);
  assert.match(detail, /function openTripMenu\(state\)/);
  assert.doesNotMatch(detail, /m328-trip-detail-work-actions/);
  assert.doesNotMatch(detail, /actionButton\("registration"|>Anmeldung/);
  assert.match(detail, /expectedRevision: Number\(trip\.revision\)/);
  assert.match(detail, /return navigate\(action, trip\.id\)/);
  assert.match(detail, /@media\(max-width:420px\)/);
});

test("new booking numbers use the central environment contract and preserve race safety", () => {
  assert.match(completionMigration, /app_private\.platform_release_environment\(\)/);
  assert.match(completionMigration, /v_environment in \('DEV', 'LOCAL'\) then 'DEV-'/);
  assert.match(completionMigration, /v_environment = 'PROD' then 'FB-'/);
  assert.match(completionMigration, /FANBUS_BOOKING_ENVIRONMENT_INVALID/);
  assert.match(completionMigration, /nextval\('app_private\.fanbus_booking_number_seq'/);
  assert.match(completionMigration, /\^\(FB\|DEV\)-\[0-9\]\{2\}-\[0-9\]\{6,\}\$/);
  assert.doesNotMatch(completionMigration, /hostname|location\.host|update app_modules\.fanbus_bookings/i);
  assert.match(originalBookingMigration, /create unique index if not exists fanbus_bookings_booking_number_uidx/);
  assert.match(originalBookingMigration, /alter column booking_number set default app_private\.fanbus_next_booking_number\(\)/);
});

test("completion release hard-busts every changed module edge", () => {
  assert.match(index, /app\.js\?v=20260829-m328-r1-native-actions1&venue=2/);
  assert.match(app, /pages\.js\?v=20260829-m328-r1-native-actions1&venue=2/);
  assert.match(pages, /fanbuses\.js\?v=[^"\n]+completion=20260829-m328-final1/);
  assert.match(pages, /m328-bus-orga-shell\.js\?v=[^"\n]+completion=20260829-m328-final1/);
  assert.match(pages, /bus-orga-v3\.js\?v=[^"\n]+completion=20260829-m328-final1/);
  assert.match(router, /bus-orga-v2\.js\?v=[^"\n]+completion=20260829-m328-final1/);
  assert.match(router, /bus-orga-trip-detail\.js\?v=20260829-m328-completion1/);
  assert.match(router, /bus-orga-trip-edit\.js\?v=[^"\n]+completion=20260829-m328-final1/);
});

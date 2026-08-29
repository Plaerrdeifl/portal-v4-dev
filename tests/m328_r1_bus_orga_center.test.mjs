import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routerSource = read("../js/router.js");
const authSource = read("../js/auth.js");
const pagesSource = read("../js/pages.js");
const appSource = read("../js/app.js");
const indexHtml = read("../index.html");
const dashboardHtml = read("../pages/bus-orga.html");
const dashboardSource = read("../js/modules/bus-orga-v2.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const registrationSource = read("../js/modules/bus-orga-registration-v3.js");
const bookingsSource = read("../js/modules/bus-orga-bookings.js");
const tripDetailSource = read("../js/modules/bus-orga-trip-detail.js");
const tripEditSource = read("../js/modules/bus-orga-trip-edit.js");
const shellSource = read("../js/m328-bus-orga-shell.js");
const directEntry = read("../bus-orga/index.html");
const buildSource = read("../scripts/build-static.mjs");
const migrationSource = read("../supabase/migrations/20260829090000_m328_r1_booking_management.sql");

test("M328 provides a protected direct Bus-Orga entry and loads the native action shell", () => {
  assert.match(routerSource, /"bus-orga"\s*:\s*\{/);
  assert.match(routerSource, /page:\s*"bus-orga\.html"/);
  assert.match(routerSource, /system:\s*true/);
  assert.match(authSource, /key === "bus-orga"/);
  assert.match(pagesSource, /key === "bus-orga"/);
  assert.match(pagesSource, /modules\/bus-orga-v3\.js/);
  assert.match(pagesSource, /hydrateBusOrgaV3/);
  assert.match(directEntry, /url=\/#\/bus-orga/);
  assert.match(buildSource, /"bus-orga"/);
});

test("M328 hard-busts the SPA module chain for native Bus-Orga releases", () => {
  assert.match(indexHtml, /pd-release" content="20260829-m328-r1-native-actions1"/);
  assert.match(indexHtml, /js\/app\.js\?v=20260829-m328-r1-native-actions1/);
  assert.match(appSource, /pages\.js\?v=20260829-m328-r1-native-actions1/);
  assert.match(pagesSource, /bus-orga-v3\.js\?v=20260829-m328-r1-next-trip-venue1/);
  assert.match(nativeSource, /bus-orga-v2\.js\?v=20260829-m328-r1-next-trip-venue1/);
  assert.match(nativeSource, /bus-orga-trip-detail\.js\?v=20260829-m328-completion1/);
  assert.match(pagesSource, /completion=20260829-m328-final1/);
});

test("M328 quick registration stays inside Bus-Orga", () => {
  assert.match(dashboardHtml, /id="m328QuickRegistration"[^>]*>Anmeldung<\/button>/);
  assert.match(dashboardSource, /function openRegistration\(tripId\)/);
  assert.match(dashboardSource, /view:\s*"registration"/);
  assert.match(nativeSource, /view === "registration"/);
  assert.match(nativeSource, /hydrateBusOrgaRegistrationV3\(context\)/);
  assert.match(nativeSource, /bus-orga-registration-v3\.js\?v=20260829-m328-r1-prepared-density1/);
  assert.doesNotMatch(dashboardSource, /openFanbusContext\("add-registration"/);
});

test("M328 next trip prefers the actual venue over a technical display title", () => {
  const block = dashboardSource.match(/function renderNextTrip\(items\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(block, /const venue = String\(trip\.venue \|\| ""\)\.trim\(\)/);
  assert.match(block, /const title = venue \|\| trip\.displayTitle \|\| "Fanbusfahrt"/);
  assert.match(block, /escapeHtml\(title\)/);
});

test("M328 registration starts with a concise new-booking heading and pill modes", () => {
  assert.match(registrationSource, /<h2>Anmeldung • \$\{escapeHtml\(venue\)\}<\/h2>/);
  assert.match(registrationSource, /shortDate\(state\.trip\.eventDate\)/);
  assert.match(registrationSource, /eventTime\(state\.trip\.eventTime\)/);
  assert.match(registrationSource, /Person suchen/);
  assert.match(registrationSource, /Name eingeben …/);
  assert.match(registrationSource, /label: "Alle"/);
  assert.match(registrationSource, /label: "Mitglieder"/);
  assert.match(registrationSource, /label: "Portaluser"/);
  assert.match(registrationSource, /label: "Stammfahrer"/);
  assert.match(registrationSource, /data-m328-reg3-special="KNOWN">Bekannte Personen<\/button>/);
  assert.match(registrationSource, /<h3>Neue Buchung<\/h3>/);
  assert.match(registrationSource, /Die nächste ausgewählte Person startet eine Buchung\./);
  assert.match(registrationSource, /data-m328-reg3-special="GUEST">Gast<\/button>/);
  assert.match(registrationSource, /data-m328-reg3-special="GROUP">Gruppe<\/button>/);
  assert.match(registrationSource, /id="m328Reg3InputPanel" class="m328-reg3-special-panel" hidden/);
  assert.doesNotMatch(registrationSource, /Ausgewählte Fahrt/);
  assert.doesNotMatch(registrationSource, /\.focus\s*\(/);
  assert.doesNotMatch(registrationSource, /autofocus/);
});

test("M328 keeps the quick-trip select slightly taller for unclipped venue labels", () => {
  assert.match(nativeSource, /#m328QuickRegistrationTrip/);
  assert.match(nativeSource, /height:44px!important/);
  assert.match(nativeSource, /min-height:44px!important/);
});

test("M328 resolves personal boarding-stop defaults before trip fallback", () => {
  assert.match(registrationSource, /function preferredTripStopId\(state, preferredBoardingStopId\)/);
  assert.match(registrationSource, /boardingStopId:\s*preferredTripStopId\(state, choice\.defaultBoardingStopId\)/);
  const personChoiceBlock = registrationSource.match(/function personChoice\(source, item\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(personChoiceBlock, /defaultBoardingStopId:\s*item\.defaultBoardingStopId/);
  assert.match(registrationSource, /member\.tripBoardingStopId \|\| preferredTripStopId\(state, member\.defaultBoardingStopId\)/);
});

test("M328 shows bus preference only when the central trip contract enables it", () => {
  assert.match(registrationSource, /state\.trip\.busPreferenceSelectionEnabled \?/);
  assert.match(registrationSource, /busPreference:\s*state\.trip\.busPreferenceSelectionEnabled/);
  assert.match(bookingsSource, /state\.trip\.busPreferenceSelectionEnabled === true/);
});

test("M328 mixed capture models visible bookings instead of one flat participant list", () => {
  assert.match(registrationSource, /bookings:\s*\[\]/);
  assert.match(registrationSource, /Buchung \$\{bookingIndex \+ 1\}/);
  assert.match(registrationSource, /kind: "GROUP"/);
  assert.match(registrationSource, /kind: "INDIVIDUAL"/);
  assert.match(registrationSource, /data-m328-reg3-booking-card/);
  assert.match(registrationSource, /Gruppe als eine Buchung/);
  assert.match(registrationSource, /Alle Buchungen speichern/);
  assert.match(registrationSource, /fanbus_registration_create_manual_batches/);
});

test("M328 booking management creates human-readable numbers for every central booking", () => {
  assert.match(migrationSource, /alter table app_modules\.fanbus_bookings[\s\S]*add column if not exists booking_number text/);
  assert.match(migrationSource, /alter column booking_number set default app_private\.fanbus_next_booking_number\(\)/);
  assert.match(migrationSource, /\^FB-\[0-9\]\{2\}-\[0-9\]\{6,\}\$/);
  assert.match(migrationSource, /fanbus_registration_create_manual_batches/);
  assert.match(migrationSource, /'bookingMode','GROUP'/);
  assert.match(migrationSource, /bookingNumber/);
});

test("M328 booking overview supports edit, whole-booking cancel and participant cancel", () => {
  assert.match(tripDetailSource, /actionButton\("bookings", "Buchungen"/);
  assert.match(tripDetailSource, /navigate\("bookings", trip\.id\)/);
  assert.match(nativeSource, /view === "bookings"/);
  assert.match(bookingsSource, /Buchungsnummer oder Name suchen/);
  assert.match(bookingsSource, /data-m328-edit-booking/);
  assert.match(bookingsSource, /Gesamte Buchung stornieren/);
  assert.match(bookingsSource, /Person stornieren/);
  assert.match(bookingsSource, /fanbus_booking_operator_update/);
  assert.match(bookingsSource, /fanbus_booking_operator_cancel/);
  assert.match(migrationSource, /api_fanbus_booking_operator_update/);
  assert.match(migrationSource, /api_fanbus_booking_operator_cancel/);
  assert.match(migrationSource, /fanbus_participant_cancel_kernel/);
});

test("M328 trip edit stays inside Bus-Orga and does not expose the old Fanbus editor", () => {
  assert.match(nativeSource, /view === "trip-edit"/);
  assert.match(nativeSource, /hydrateBusOrgaTripEdit\(context\)/);
  assert.match(tripDetailSource, /navigate\("trip-edit", trip\.id\)/);
  assert.match(tripEditSource, /<h2>Fahrt bearbeiten • \$\{escapeHtml\(venue\)\}<\/h2>/);
  assert.match(tripEditSource, /fanbus_trip_update/);
  assert.match(tripEditSource, /fanbus_trip_boarding_stop_upsert/);
  assert.match(tripEditSource, /location\.hash = "#\/bus-orga"/);
});

test("M328 booking numbers are projected into central mail template data", () => {
  assert.match(migrationSource, /notification_add_external_email_before_m328_r1/);
  assert.match(migrationSource, /'bookingNumber',v_booking_number/);
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
});

test("M328 ride administration opens a dedicated detail view with all existing actions", () => {
  assert.match(dashboardHtml, />Fahrtenverwaltung</);
  assert.match(dashboardSource, /data-m328-trip-open/);
  assert.match(dashboardSource, /view:\s*"trip-detail"/);
  assert.doesNotMatch(dashboardSource, /data-m328-trip-toggle/);
  assert.doesNotMatch(dashboardSource, /m328-trip-expanded/);
  assert.match(nativeSource, /view === "trip-detail"/);
  assert.match(tripDetailSource, /← Bus-Orga/);
  assert.match(tripDetailSource, /actionButton\("bookings", "Buchungen"/);
  assert.match(tripDetailSource, /actionButton\("participants", "Teilnehmer"/);
  assert.match(tripDetailSource, /actionButton\("occupancy", "Busse & Zuordnung"/);
  assert.match(tripDetailSource, /actionButton\("operations", "Fahrtbetrieb"/);
  assert.match(tripDetailSource, /actionButton\("edit", "Bearbeiten"/);
});

test("M328 normal Fanbus view still exposes only one Bus-Orga entry", () => {
  assert.match(pagesSource, /m328-bus-orga-shell\.js/);
  assert.match(shellSource, /m328BusOrgaEntry/);
  assert.match(shellSource, /🚌 Bus-Orga/);
});

test("M328 mobile surfaces prevent horizontal clipping", () => {
  assert.match(dashboardHtml, /overflow-x:clip/);
  assert.match(registrationSource, /m328-reg3\{[^}]*overflow-x:clip/);
  assert.match(registrationSource, /@media\(max-width:520px\)/);
  assert.match(bookingsSource, /@media\(max-width:520px\)/);
  assert.match(tripEditSource, /overflow-x:clip/);
  assert.match(tripDetailSource, /overflow-x:clip/);
  assert.match(tripDetailSource, /@media\(max-width:620px\)/);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const routerSource = read("../js/router.js");
const authSource = read("../js/auth.js");
const pagesSource = read("../js/pages.js");
const dashboardHtml = read("../pages/bus-orga.html");
const dashboardSource = read("../js/modules/bus-orga-v2.js");
const registrationSource = read("../js/modules/bus-orga-registration-v2.js");
const bookingsSource = read("../js/modules/bus-orga-bookings.js");
const shellSource = read("../js/m328-bus-orga-shell.js");
const directEntry = read("../bus-orga/index.html");
const buildSource = read("../scripts/build-static.mjs");
const migrationSource = read("../supabase/migrations/20260829090000_m328_r1_booking_management.sql");

test("M328 provides a protected direct Bus-Orga entry", () => {
  assert.match(routerSource, /"bus-orga"\s*:\s*\{/);
  assert.match(routerSource, /page:\s*"bus-orga\.html"/);
  assert.match(routerSource, /system:\s*true/);
  assert.match(authSource, /key === "bus-orga"/);
  assert.match(pagesSource, /key === "bus-orga"/);
  assert.match(pagesSource, /modules\/bus-orga-v2\.js/);
  assert.match(pagesSource, /hydrateBusOrgaV2/);
  assert.doesNotMatch(pagesSource, /setupM328RegistrationUxPolish/);
  assert.match(directEntry, /url=\/#\/bus-orga/);
  assert.match(buildSource, /"bus-orga"/);
});

test("M328 quick registration stays inside Bus-Orga", () => {
  assert.match(dashboardHtml, /id="m328QuickRegistration"[^>]*>Anmeldung<\/button>/);
  assert.match(dashboardSource, /function openRegistration\(tripId\)/);
  assert.match(dashboardSource, /view:\s*"registration"/);
  assert.match(dashboardSource, /location\.hash = `#\/bus-orga\?\$\{params\}`/);
  assert.match(dashboardSource, /hydrateBusOrgaRegistrationV2\(context\)/);
  assert.doesNotMatch(dashboardSource, /openFanbusContext\("add-registration"/);
});

test("M328 registration has direct header, no selected-trip box and no autofocus", () => {
  assert.match(registrationSource, /<h2>Anmeldung • \$\{escapeHtml\(venue\)\}<\/h2>/);
  assert.match(registrationSource, /shortDate\(state\.trip\.eventDate\)/);
  assert.match(registrationSource, /eventTime\(state\.trip\.eventTime\)/);
  assert.doesNotMatch(registrationSource, /Ausgewählte Fahrt/);
  assert.doesNotMatch(registrationSource, /\.focus\s*\(/);
  assert.doesNotMatch(registrationSource, /autofocus/);
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
});

test("M328 mixed capture models visible bookings instead of one flat participant list", () => {
  assert.match(registrationSource, /bookings:\s*\[\]/);
  assert.match(registrationSource, /Buchung \$\{bookingIndex \+ 1\}/);
  assert.match(registrationSource, /Gemeinsame Buchung/);
  assert.match(registrationSource, /Einzelbuchung/);
  assert.match(registrationSource, /data-m328-reg2-add-to-booking/);
  assert.match(registrationSource, /Gruppe als eine Buchung/);
  assert.match(registrationSource, /Alle Buchungen speichern/);
  assert.match(registrationSource, /fanbus_registration_create_manual_batches/);
});

test("M328 booking management creates human-readable numbers for every central booking", () => {
  assert.match(migrationSource, /alter table app_modules\.fanbus_bookings[\s\S]*add column if not exists booking_number text/);
  assert.match(migrationSource, /alter column booking_number set default app_private\.fanbus_next_booking_number\(\)/);
  assert.match(migrationSource, /\^FB-\[0-9\]\{2\}-\[0-9\]\{6,\}\$/);
  assert.match(migrationSource, /fanbus_registration_create_manual_batches/);
  assert.match(migrationSource, /bookingMode', 'GROUP'/);
  assert.match(migrationSource, /bookingNumber/);
});

test("M328 booking overview is available per trip and searchable by booking number or person", () => {
  assert.match(dashboardSource, /openBookings\(tripId\)/);
  assert.match(dashboardSource, /tripActionButton\("bookings"/);
  assert.match(dashboardSource, />Buchungen</);
  assert.match(dashboardSource, /hydrateBusOrgaBookings\(context\)/);
  assert.match(bookingsSource, /fanbus_registrations_list/);
  assert.match(bookingsSource, /bookingNumber/);
  assert.match(bookingsSource, /Buchungsnummer oder Name suchen/);
  assert.match(bookingsSource, /groupBookings\(registrations\)/);
});

test("M328 booking numbers are projected into the central mail template data", () => {
  assert.match(migrationSource, /notification_add_external_email_before_m328_r1/);
  assert.match(migrationSource, /v_data := v_data \|\| jsonb_build_object\([\s\S]*'bookingNumber', v_booking_number/);
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

test("M328 ride administration stays collapsed and exposes booking-first actions", () => {
  assert.match(dashboardHtml, />Fahrtenverwaltung</);
  assert.match(dashboardSource, /tripActionButton\("bookings"/);
  assert.match(dashboardSource, /tripActionButton\("participants"/);
  assert.match(dashboardSource, /tripActionButton\("occupancy"/);
  assert.match(dashboardSource, /tripActionButton\("operations"/);
  assert.match(dashboardSource, /tripActionButton\("edit-trip"/);
  assert.match(dashboardSource, /data-m328-trip-toggle/);
  assert.match(dashboardSource, /aria-expanded="false"/);
  assert.match(dashboardSource, /const title = venue \|\| trip\.displayTitle/);
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

test("M328 mobile surfaces prevent horizontal clipping", () => {
  assert.match(dashboardHtml, /overflow-x:clip/);
  assert.match(registrationSource, /m328-reg2\{[^}]*overflow-x:clip/);
  assert.match(registrationSource, /@media\(max-width:520px\)/);
  assert.match(bookingsSource, /@media\(max-width:520px\)/);
});

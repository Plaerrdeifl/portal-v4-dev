import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const registration = read("../js/fanbus-registration.js");
const overlay = read("../js/m328-r2-public-registration-flow.js");
const loader = read("../js/m327-r1-guest-contact-polish.js");
const migration = read("../supabase/migrations/20260830214500_m328_booking_mail_contact_context.sql");

test("boarding stop priority stays personal then trip then required selection", () => {
  assert.match(registration, /userBoardingPreference\?\.effectiveTripBoardingStopId\s*\|\|\s*trip\?\.defaultTripBoardingStopId/);
  assert.match(registration, /select\.required = hasStops/);
  assert.match(registration, /boardingStopOptions\(trip\?\.defaultTripBoardingStopId \|\| ""\)/);
  assert.match(overlay, /#m325UserBoardingPreference\{display:none!important\}/);
});

test("registration has a deliberate review before the core submit", () => {
  assert.match(loader, /setupM328PublicRegistrationFlow/);
  assert.match(overlay, /\.fanbus-public-form>\.p800-fanbus-review\{display:none!important\}/);
  assert.match(overlay, /title: "Anmeldung prüfen"/);
  assert.match(overlay, /submitLabel: "Jetzt verbindlich anmelden"/);
  assert.match(overlay, /reviewBypass\.add\(form\);\s*form\.requestSubmit\(\)/);
  assert.match(overlay, /document\.addEventListener\("submit", interceptRegistrationSubmit, true\)/);
  assert.match(overlay, /event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\)/);
  assert.match(overlay, /button\.dataset\.p800IdleLabel = "Anmeldung prüfen"/);
});

test("missing companion stops remain handled by the existing validator", () => {
  assert.match(overlay, /function companionBoardingStopMissing\(form\)/);
  assert.match(overlay, /if \(!form\.reportValidity\(\) \|\| companionBoardingStopMissing\(form\)\) return/);
  assert.match(registration, /validateCompanionBoardingStops\(elements\.portalForm, "portal"\)/);
  assert.match(registration, /validateCompanionBoardingStops\(elements\.guestForm, "guest"\)/);
});

test("receipt lookup uses only the concrete submission key", () => {
  assert.match(overlay, /"fanbus_self_register"/);
  assert.match(overlay, /"fanbus_companion_booking_submit"/);
  assert.match(overlay, /window\.addEventListener\("pd-api-before-call", capturePortalSubmission\)/);
  assert.match(overlay, /\/functions\/v1\/m310-fanbus-register/);
  assert.match(overlay, /rememberSubmission\(payload\?\.tripId, payload\?\.idempotencyKey\)/);

  const receiptStart = migration.indexOf("create or replace function public.pd_public_fanbus_booking_reference(");
  const receiptEnd = migration.indexOf("comment on function public.pd_public_fanbus_booking_reference", receiptStart);
  const receipt = migration.slice(receiptStart, receiptEnd);
  assert.ok(receiptStart >= 0 && receiptEnd > receiptStart);
  assert.match(receipt, /app_private\.fanbus_registration_idempotency/);
  assert.match(receipt, /app_modules\.fanbus_bookings/);
  assert.match(receipt, /idempotency\.trip_id = p_trip_id/);
  assert.match(receipt, /idempotency\.idempotency_key = p_idempotency_key/);
  assert.doesNotMatch(receipt, /first_name|last_name|email|phone/i);
  assert.match(receipt, /from public, anon, authenticated, service_role/i);
  assert.match(receipt, /to anon, authenticated/i);
});

test("success renders the real booking number", () => {
  assert.match(overlay, /pd_public_fanbus_booking_reference/);
  assert.match(overlay, /BOOKING_NUMBER_PATTERN/);
  assert.match(overlay, /<span>Buchungsnummer<\/span>/);
  assert.match(overlay, /Bitte gib diese Nummer bei Rückfragen an\./);
  assert.match(overlay, /"Anmeldung bestätigt", "Auf Warteliste eingetragen", "Bereits angemeldet"/);
});

test("back to app is shown only for an authenticated top-level app entry", () => {
  assert.match(overlay, /!current\.authenticated \|\| current\.status !== "ACTIVE"/);
  assert.match(overlay, /window\.top !== window\.self/);
  assert.match(overlay, /display-mode: standalone/);
  assert.match(overlay, /referrer\.origin !== window\.location\.origin/);
  assert.match(overlay, /referrer\.pathname === appRoot/);
  assert.match(overlay, /button\.textContent = "← Zurück zur App"/);
  assert.match(overlay, /window\.history\.back\(\)/);
  assert.match(overlay, /window\.location\.assign\("\.\/#\/fanbuses"\)/);
});

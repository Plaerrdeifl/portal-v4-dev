import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const acceptance = read("../js/m328-final-acceptance.js");
const bookingCleanup = read("../js/m328-booking-filter-cleanup.js");
const iosLoader = read("../js/m328-trip-edit-ios-fields.js");

test("M328 final acceptance keeps ride workspaces inside the selected ride", () => {
  assert.match(acceptance, /const CHILD_VIEWS = new Set\(\["bookings", "participants", "occupancy", "operations", "trip-edit"\]\)/);
  assert.match(acceptance, /view: "trip-detail", trip:/);
  assert.match(acceptance, /duplicateReturn \? "← Prüfung" : "← Fahrt"/);
  assert.match(acceptance, /location\.hash = duplicateReviewRoute\(route\.tripId, route\.reviewA, route\.reviewB\)/);
  assert.match(acceptance, /location\.hash = tripDetailRoute\(route\.tripId\)/);
  assert.match(acceptance, /if \(route\.view === "bookings"\) \{/);
  assert.match(acceptance, /if \(route\.from === "duplicate-review" && route\.reviewA && route\.reviewB\)/);
});

test("M328 normal booking back navigation is no longer swallowed by the acceptance layer", () => {
  const bookingBranch = acceptance.slice(
    acceptance.indexOf('if (route.view === "bookings") {'),
    acceptance.indexOf('event.preventDefault();', acceptance.indexOf('if (route.view === "bookings") {') + 1)
  );
  assert.match(bookingBranch, /return;/);
  assert.doesNotMatch(bookingBranch, /tripDetailRoute/);
});

test("M328 final acceptance gives booking roles clear group semantics", () => {
  assert.match(acceptance, /"Einzelbuchung"/);
  assert.match(acceptance, /"Mitfahrer · Gruppenbuchung"/);
  assert.match(acceptance, /"Gruppenbuchung · Ansprechperson"/);
  assert.match(acceptance, /bookingSizes/);
});

test("M328 booking view reuses the native filter instead of layering a second filter", () => {
  assert.match(acceptance, /querySelector\("\.m328-bookings-filter, \.m328-final-booking-filter"\)/);
  assert.match(acceptance, /details\.classList\.remove\("m328-bookings-filter"\)/);
  assert.match(acceptance, /details\.classList\.add\("m328-final-booking-filter"\)/);
  assert.match(acceptance, /body\?\.classList\.remove\("m328-bookings-filter-body"\)/);
  assert.match(acceptance, /body\?\.classList\.add\("m328-final-booking-filter-body"\)/);
  assert.doesNotMatch(acceptance, /data-m328-booking-status-filter/);
  assert.doesNotMatch(acceptance, /selected === "OPEN"/);
  assert.doesNotMatch(bookingCleanup, /querySelector\("\.m328-bookings-filter"\)\?\.remove\(\)/);
});

test("M328 booking summary is readable and independent from filter math", () => {
  assert.match(acceptance, /const cancelled = cards\.filter\(card => bookingCardStatus\(card\) === "CANCELLED"\)\.length/);
  assert.match(acceptance, /const active = cards\.length - cancelled/);
  assert.match(acceptance, /active === 1 \? "aktive Buchung" : "aktive Buchungen"/);
  assert.match(acceptance, /`\$\{active\} \$\{activeLabel\} · \$\{cancelled\} storniert`/);
  assert.doesNotMatch(acceptance, /von\s+\$\{total\}\s+Buchungen/);
});

test("M328 participant filter does not retrigger the observer when count is unchanged", () => {
  assert.match(acceptance, /const nextCount = `\$\{visible\} von \$\{total\}`;/);
  assert.match(acceptance, /if \(count && count\.textContent !== nextCount\) count\.textContent = nextCount;/);
  assert.doesNotMatch(acceptance, /if \(count\) count\.textContent = `\$\{visible\} von \$\{total\}`;/);
});

test("M328 booking polish observers are scoped to the portal view instead of the full document", () => {
  assert.match(acceptance, /const viewRoot = document\.getElementById\("view"\)/);
  assert.match(acceptance, /observer\.observe\(viewRoot, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(acceptance, /observer\.observe\(document\.documentElement/);
  assert.match(bookingCleanup, /const viewRoot = document\.getElementById\("view"\)/);
  assert.match(bookingCleanup, /observer\.observe\(viewRoot, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(bookingCleanup, /observer\.observe\(document\.documentElement/);
});

test("M328 final acceptance repairs operations and bus presentation without changing domain actions", () => {
  assert.match(acceptance, /classList\.remove\("form-grid", "v4-smart-form", "v4-m325-operation-filters"\)/);
  assert.match(acceptance, /m328-final-operation-filters/);
  assert.match(acceptance, /data-trip-detail-action="bookings"/);
  assert.match(acceptance, /bookings\.classList\.remove\("primary"\)/);
  assert.match(acceptance, /data-trip-detail-action="occupancy"/);
  assert.match(acceptance, /buses\.textContent = "Busse"/);
  assert.match(acceptance, /title\.textContent = "Busse"/);
  assert.match(acceptance, /Busse & Zuordnung/);
  assert.match(acceptance, /value\.textContent = `0 \$\{text\}`/);
  assert.doesNotMatch(acceptance, /fanbus_bus_upsert|fanbus_assignment_apply|fanbus_checkin_set|fanbus_paid_set/);
});

test("M328 final acceptance is versioned from the existing M328 entry module", () => {
  assert.match(iosLoader, /m328-final-acceptance\.js\?v=20260908-m328-final-acceptance3/);
  assert.match(iosLoader, /m328-booking-filter-cleanup\.js\?v=20260908-m328-booking-filter-cleanup2/);
});

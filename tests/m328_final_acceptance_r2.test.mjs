import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const acceptance = read("../js/m328-final-acceptance.js");
const iosLoader = read("../js/m328-trip-edit-ios-fields.js");

test("M328 final acceptance keeps ride workspaces inside the selected ride", () => {
  assert.match(acceptance, /const CHILD_VIEWS = new Set\(\["bookings", "participants", "occupancy", "operations", "trip-edit"\]\)/);
  assert.match(acceptance, /view: "trip-detail", trip:/);
  assert.match(acceptance, /button\.textContent = "← Fahrt"/);
  assert.match(acceptance, /stopImmediatePropagation\(\)/);
});

test("M328 final acceptance gives booking roles clear group semantics", () => {
  assert.match(acceptance, /"Einzelbuchung"/);
  assert.match(acceptance, /"Mitfahrer · Gruppenbuchung"/);
  assert.match(acceptance, /"Gruppenbuchung · Ansprechperson"/);
  assert.match(acceptance, /bookingSizes/);
});

test("M328 final acceptance adds compact cancelled filters to participants and bookings", () => {
  assert.match(acceptance, /data-m328-hide-cancelled/);
  assert.match(acceptance, /Stornierte ausblenden/);
  assert.match(acceptance, /data-m328-booking-status-filter/);
  assert.match(acceptance, /Nicht storniert/);
  assert.match(acceptance, /selected === "OPEN" \? status !== "CANCELLED"/);
});

test("M328 participant filter does not retrigger the global child-list observer when count is unchanged", () => {
  assert.match(acceptance, /const nextCount = `\$\{visible\} von \$\{total\}`;/);
  assert.match(acceptance, /if \(count && count\.textContent !== nextCount\) count\.textContent = nextCount;/);
  assert.doesNotMatch(acceptance, /if \(count\) count\.textContent = `\$\{visible\} von \$\{total\}`;/);
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
  assert.match(iosLoader, /m328-final-acceptance\.js\?v=20260830-m328-final-acceptance2/);
});

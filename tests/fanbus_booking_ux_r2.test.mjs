import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../js/modules/bus-orga-bookings.js");
const migration = read("../supabase/migrations/20260919220959_fanbus_booking_primary_and_compact_ui.sql");
const worker = read("../service-worker.js");
const pages = read("../js/pages.js");
const app = read("../js/app.js");
const index = read("../index.html");

test("booking primary can be reassigned atomically through the platform action", () => {
  assert.match(migration, /api_fanbus_booking_primary_set/);
  assert.match(migration, /booking_role='COMPANION'/);
  assert.match(migration, /booking_role='PRIMARY'/);
  assert.match(migration, /FANBUS_BOOKING_PRIMARY_CHANGED/);
  assert.match(migration, /fanbus_booking_primary_set/);
  assert.match(migration, /USER_MUTATION/);
  assert.match(migration, /revoke all on function[\s\S]*api_fanbus_booking_primary_set/);
});

test("compact booking UI exposes one primary radio and collapses noisy person actions", () => {
  assert.match(ui, /type="radio"[\s\S]*data-m328-primary-person/);
  assert.match(ui, /fanbus_booking_primary_set/);
  assert.match(ui, /m328-person-actions-menu/);
  assert.match(ui, /<summary class="button small secondary">Aktionen<\/summary>/);
  assert.match(ui, /m328-more-persons/);
  assert.match(ui, /weitere Personen/);
  assert.match(ui, /m328-booking-more-actions/);
  assert.match(ui, /Weitere Aktionen/);
});

test("booking facts are compact and empty saved-group noise is removed", () => {
  assert.match(ui, /m328-booking-group-fact/);
  assert.match(ui, /booking\.personGroupName \?/);
  assert.doesNotMatch(ui, /Keine gespeicherte Personengruppe/);
  assert.doesNotMatch(ui, /<span>Abweichungen<strong>\$\{overrideText \|\| "Keine"\}<\/strong><\/span>/);
});

test("merge dialog is forced into a single mobile-safe column", () => {
  assert.match(ui, /m328-merge-form/);
  assert.match(ui, /\.m328-merge-form,\.m328-override-form,\.m328-travel-group-form\{grid-template-columns:1fr!important\}/);
  assert.match(ui, /\.m328-merge-form>\*,\.m328-override-form>\*,\.m328-travel-group-form>\*\{grid-column:1!important;width:100%!important\}/);
});

test("add-person dialog stays compact and mobile-safe", () => {
  const start = ui.indexOf("async function openAddPerson");
  const end = ui.indexOf("async function setPrimaryPerson", start);
  const block = ui.slice(start, end);

  assert.match(ui, /\.m328-add-person-choice>summary\{[^}]*width:100%[^}]*white-space:normal/);
  assert.match(ui, /\.m328-add-person-action\{width:100%/);
  assert.match(ui, /\.m328-add-person-guest\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(ui, /@media\(max-width:520px\)\{[^}]*[\s\S]*?\.m328-add-person-group \.m328-dialog-actions,\.m328-add-person-guest\{grid-template-columns:1fr\}/);
  assert.match(block, /Für diese Buchung ist keine gespeicherte Personengruppe hinterlegt\./);
  assert.match(block, /<summary>Bekannte Person<\/summary>/);
  assert.match(block, /<summary>Neuen Gast eintragen<\/summary>/);
  assert.doesNotMatch(block, /v4-smart-form/);
  assert.match(block, /data-m328-add-person-choice/);
  assert.match(block, /if \(other !== choice\) other\.open = false/);
});

test("group editing keeps its groupRules in the form save scope", () => {
  const saveStart = ui.indexOf("async function saveBookingEdit");
  const bindStart = ui.indexOf("function bindList", saveStart);
  const block = ui.slice(saveStart, bindStart);
  assert.match(block, /const groupField = name => form\.querySelector/);
  assert.match(block, /const groupRules = \{/);
  const cancelStart = ui.indexOf("async function cancelParticipants");
  const bookingById = ui.indexOf("function bookingById", cancelStart);
  assert.doesNotMatch(ui.slice(cancelStart, bookingById), /groupField|groupRules/);
});

test("booking overview defaults to non-cancelled bookings", () => {
  assert.match(ui, /<option value="CURRENT" selected>Nicht storniert<\/option>/);
  assert.match(ui, /statusFilter: "CURRENT"/);
});

test("PWA cache chain rotates for booking UX R2", () => {
  assert.match(worker, /FANBUS_BOOKING_UX_R2_CACHE_VERSION/);
  assert.match(worker, /FANBUS_TRAVEL_GROUPS_CACHE_VERSION/);
  assert.match(worker, /APP_CACHE = `\$\{STARTUP_PERFORMANCE_CACHE_VERSION\}-shell`/);
  assert.match(pages, /bookingux=20260920-r2a/);
  assert.match(app, /bookingux=20260920-r2a/);
  assert.match(index, /bookingux=20260920-r2a/);
});

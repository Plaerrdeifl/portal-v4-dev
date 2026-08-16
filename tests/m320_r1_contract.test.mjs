import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("M320 adds bookings, waitlist, bus assignments and closed browser tables", async () => {
  const sql = await read("supabase/migrations/20260814110000_add_fanbus_participants_m320_r1.sql");
  for (const table of ["fanbus_bookings", "fanbus_buses", "fanbus_bus_assignments"]) {
    assert.match(sql, new RegExp(`create table app_modules\\.${table}`));
    assert.match(sql, new RegExp(`alter table app_modules\\.${table} enable row level security`));
  }
  assert.match(sql, /booking_role in \('PRIMARY', 'COMPANION'\)/);
  assert.match(sql, /status in \('ACTIVE', 'WAITLISTED', 'CANCELLED'\)/);
  assert.match(sql, /fanbus_registrations_booking_primary_uidx/);
  assert.match(sql, /select trip\.\* into v_trip[\s\S]*for update/);
  assert.match(sql, /FANBUS_WAITLIST_PROMOTED/);
  assert.match(sql, /FANBUS_BUS_ASSIGNED/);
  assert.match(sql, /foreign key \(participant_id, trip_id\)/);
});

test("M320 public surface accepts a bounded companion batch without exposing duplicates", async () => {
  const edge = await read("supabase/functions/m310-fanbus-register/index.ts");
  const ui = await read("js/fanbus-registration.js");
  assert.match(edge, /"companions"/);
  assert.match(edge, /companions\.length > 19/);
  assert.match(edge, /value\.companions === undefined \? \[\] : value\.companions/);
  assert.match(edge, /outcome === "WAITLISTED"/);
  assert.match(ui, /function companionsFor\(form\)/);
  assert.match(ui, /Warteliste eingetragen/);
});

test("M320 mobile forms keep guest preference, edit fields and filters in responsive order", async () => {
  const [standalone, fanbuses, css] = await Promise.all([
    read("fanbus-anmeldung.html"),
    read("js/modules/fanbuses.js"),
    read("css/app.css")
  ]);

  const guestStart = standalone.indexOf('<form id="m310GuestForm"');
  const guestEnd = standalone.indexOf("</form>", guestStart);
  const guestForm = standalone.slice(guestStart, guestEnd);
  const primaryPreference = guestForm.indexOf('<select name="busPreference"');
  const companions = guestForm.indexOf('data-m320-companions="guest"');
  assert.ok(guestStart >= 0 && guestEnd > guestStart);
  assert.ok(primaryPreference >= 0 && companions > primaryPreference);

  const editStart = fanbuses.indexOf("function openRegistrationEdit");
  const editEnd = fanbuses.indexOf("function bindRegistrationActions", editStart);
  const editForm = fanbuses.slice(editStart, editEnd);
  assert.match(editForm, /data-m320-registration-edit/);
  assert.match(editForm, /class="v4-field-half">Vorname/);
  assert.match(editForm, /class="v4-field-half">Nachname/);
  assert.match(editForm, /class="v4-field-full">E-Mail/);
  assert.match(editForm, /class="v4-field-full">Buspräferenz/);

  const filtersStart = fanbuses.indexOf('data-m320-registration-filters');
  const filtersEnd = fanbuses.indexOf("</form>`;", filtersStart);
  const filters = fanbuses.slice(filtersStart, filtersEnd);
  assert.match(filters, /class="v4-field-full">Suche/);
  for (const field of ["status", "preference", "bus", "assignment"]) {
    assert.match(filters, new RegExp(`class="v4-m320-filter-half"[^>]*>[^<]*<select name="${field}"`));
  }
  assert.equal((filters.match(/class="v4-m320-filter-half"/g) || []).length, 4);
  assert.match(
    css,
    /\[data-m320-registration-filters\]\s*>\s*\.v4-m320-filter-half\s*\{[^}]*grid-column:\s*span 6/
  );
  assert.match(css, /data-m320-registration-edit[^}]*v4-field-half[^}]*grid-column:1\/-1/);
});

test("M320 capacity warning renders the normalized numeric values", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  assert.match(
    fanbuses,
    /const activeBusCapacity = Number\(data\?\.summary\?\.activeBusCapacity \|\| 0\)/
  );
  assert.match(
    fanbuses,
    /Kapazität der aktiven Busse \(\$\{escapeHtml\(activeBusCapacity\)\}\)/
  );
  assert.doesNotMatch(
    fanbuses,
    /Kapazität der aktiven Busse \(\$\{escapeHtml\(data\.summary\.activeBusCapacity\)\}\)/
  );
});

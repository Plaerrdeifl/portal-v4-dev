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

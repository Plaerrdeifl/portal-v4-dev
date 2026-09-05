import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildOperationalBookingContexts,
  operationalBookingCountLabel,
  operationalBookingRoleLabel
} from "../js/modules/fanbus-operational-integrity.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const ui = read("../js/m328-fanbus-operational-integrity.js");
const migration = read("../supabase/migrations/20260905123213_fanbus_group_duplicate_review_r1.sql");

test("GROUP-001 counts only ACTIVE and WAITLISTED as the current booking", () => {
  const registrations = [
    { id: "a", bookingId: "b", bookingRole: "PRIMARY", firstName: "Lara", status: "ACTIVE" },
    { id: "c", bookingId: "b", bookingRole: "COMPANION", firstName: "Jan", status: "CANCELLED" }
  ];
  const context = buildOperationalBookingContexts(registrations).get("b");
  assert.equal(context.count, 1);
  assert.equal(context.historicalCount, 2);
  assert.equal(context.cancelledCount, 1);
  assert.equal(operationalBookingRoleLabel(registrations[0], context), "Einzelbuchung");
  assert.equal(operationalBookingCountLabel(context), "1 Person · 1 storniert");
});

test("GROUP-001 keeps two current participants as a group", () => {
  const registrations = [
    { id: "a", bookingId: "b", bookingRole: "PRIMARY", firstName: "A", status: "ACTIVE" },
    { id: "c", bookingId: "b", bookingRole: "COMPANION", firstName: "B", status: "WAITLISTED" },
    { id: "d", bookingId: "b", bookingRole: "COMPANION", firstName: "C", status: "CANCELLED" }
  ];
  const context = buildOperationalBookingContexts(registrations).get("b");
  assert.equal(context.count, 2);
  assert.match(operationalBookingRoleLabel(registrations[0], context), /^Gruppenbuchung/);
  assert.match(operationalBookingRoleLabel(registrations[1], context), /^Mitfahrer · Gruppe/);
});

test("DUPLICATE-001 is review-only and never auto-cancels by name", () => {
  assert.match(migration, /duplicateCandidates/);
  assert.match(migration, /lower\(btrim\(first_registration\.first_name\)\)/);
  assert.match(migration, /first_registration\.booking_id is distinct from second_registration\.booking_id/);
  assert.match(migration, /fanbus_duplicate_reviews/);
  assert.match(migration, /decision = 'NOT_DUPLICATE'/);
  assert.doesNotMatch(migration, /update app_modules\.fanbus_registrations\s+set status = 'CANCELLED'/i);
});

test("DUPLICATE-001 UI exposes review, open-registration and not-duplicate actions", () => {
  assert.match(ui, /Mögliche Doppelanmeldung/);
  assert.match(ui, /fanbus_duplicate_review_resolve/);
  assert.match(ui, /Kein Duplikat – als geprüft markieren/);
  assert.match(ui, /data-m328-open-duplicate/);
});

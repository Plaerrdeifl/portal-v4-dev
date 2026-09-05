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

function context(rows, bookingId = "b") {
  return buildOperationalBookingContexts(rows).get(bookingId);
}

function row(id, status, bookingRole = "COMPANION", bookingId = "b", firstName = id) {
  return { id, bookingId, bookingRole, firstName, status };
}

test("GROUP-001 case 1: single booking stays single", () => {
  const rows = [row("a", "ACTIVE", "PRIMARY")];
  const ctx = context(rows);
  assert.equal(ctx.count, 1);
  assert.equal(operationalBookingRoleLabel(rows[0], ctx), "Einzelbuchung");
});

test("GROUP-001 cases 2/3: two or three current participants are groups", () => {
  for (const size of [2, 3]) {
    const rows = [
      row("a", "ACTIVE", "PRIMARY"),
      ...Array.from({ length: size - 1 }, (_, i) => row(`c${i}`, "ACTIVE"))
    ];
    const ctx = context(rows);
    assert.equal(ctx.count, size);
    assert.match(operationalBookingRoleLabel(rows[0], ctx), /^Gruppenbuchung/);
  }
});

test("GROUP-001 case 4: two minus one cancelled becomes single", () => {
  const rows = [row("a", "ACTIVE", "PRIMARY"), row("c", "CANCELLED")];
  const ctx = context(rows);
  assert.equal(ctx.count, 1);
  assert.equal(ctx.historicalCount, 2);
  assert.equal(ctx.cancelledCount, 1);
  assert.equal(operationalBookingRoleLabel(rows[0], ctx), "Einzelbuchung");
  assert.equal(operationalBookingCountLabel(ctx), "1 Person · 1 storniert");
});

test("GROUP-001 case 5: three minus one cancelled leaves two-person group", () => {
  const rows = [row("a", "ACTIVE", "PRIMARY"), row("b1", "WAITLISTED"), row("c", "CANCELLED")];
  const ctx = context(rows);
  assert.equal(ctx.count, 2);
  assert.match(operationalBookingRoleLabel(rows[0], ctx), /^Gruppenbuchung/);
  assert.match(operationalBookingRoleLabel(rows[1], ctx), /^Mitfahrer · Gruppe/);
});

test("GROUP-001 case 6: cancelled guest plus separate self-booking stay independent", () => {
  const rows = [
    row("lara", "ACTIVE", "PRIMARY", "lara-booking", "Lara"),
    row("jan-guest", "CANCELLED", "COMPANION", "lara-booking", "Jan"),
    row("jan-self", "ACTIVE", "PRIMARY", "jan-booking", "Jan")
  ];
  const contexts = buildOperationalBookingContexts(rows);
  assert.equal(contexts.get("lara-booking").count, 1);
  assert.equal(contexts.get("jan-booking").count, 1);
  assert.equal(operationalBookingRoleLabel(rows[0], contexts.get("lara-booking")), "Einzelbuchung");
  assert.equal(operationalBookingRoleLabel(rows[2], contexts.get("jan-booking")), "Einzelbuchung");
});

test("GROUP-001 case 7: ACTIVE and WAITLISTED count, CANCELLED does not", () => {
  const rows = [row("a", "WAITLISTED", "PRIMARY"), row("b", "ACTIVE"), row("c", "CANCELLED")];
  assert.equal(context(rows).count, 2);
});

test("GROUP-001 case 8: mobile duplicate review remains single-column", () => {
  assert.match(ui, /@media\(max-width:520px\)/);
  assert.match(ui, /m328-duplicate-review-grid\{grid-template-columns:1fr\}/);
});

test("DUPLICATE-001 is cross-booking, current-only, review-only", () => {
  assert.match(migration, /first_registration\.booking_id is distinct from second_registration\.booking_id/);
  assert.match(migration, /first_registration\.status in \('ACTIVE', 'WAITLISTED'\)/);
  assert.match(migration, /second_registration\.status in \('ACTIVE', 'WAITLISTED'\)/);
  assert.match(migration, /lower\(btrim\(first_registration\.first_name\)\)/);
  assert.match(migration, /fanbus_duplicate_reviews/);
  assert.match(migration, /decision = 'NOT_DUPLICATE'/);
  assert.doesNotMatch(migration, /update app_modules\.fanbus_registrations\s+set status = 'CANCELLED'/i);
});

test("DUPLICATE-001 UI exposes warning, review and existing participant actions", () => {
  assert.match(ui, /Mögliche Doppelanmeldung/);
  assert.match(ui, /fanbus_duplicate_review_resolve/);
  assert.match(ui, /Kein Duplikat – als geprüft markieren/);
  assert.match(ui, /data-m328-open-booking/);
});

test("DUPLICATE-001 review rendering is idempotent under the global MutationObserver", () => {
  assert.match(ui, /function duplicateReviewSignature\(candidates\)/);
  assert.match(ui, /existingPanel\?\.dataset\.m328DuplicateReviewSignature === signature/);
  assert.match(ui, /syncDuplicateMarkers\(candidates\);\s*if \(existingPanel\?\.dataset\.m328DuplicateReviewSignature === signature\) return;/s);
  assert.doesNotMatch(ui, /function renderDuplicateReview[\s\S]*?\{\s*document\.querySelector\("\[data-m328-duplicate-review-panel\]"\)\?\.remove\(\);/);
});

test("DUPLICATE-001 review opens the actual booking overview entry", () => {
  assert.match(ui, /function bookingsRoute\(tripId\)/);
  assert.match(ui, /let pendingBookingId = "";/);
  assert.match(ui, /location\.hash = bookingsRoute\(route\.tripId\)/);
  assert.match(ui, /data-m328-open-booking/);
  assert.match(ui, /card\.open = true/);
  assert.match(ui, /card\.scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.doesNotMatch(ui, /function openParticipant\(/);
});

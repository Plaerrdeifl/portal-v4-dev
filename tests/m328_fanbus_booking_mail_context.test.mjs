import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [worker, bookingMigration] = await Promise.all([
  read("supabase/functions/notification-dispatch/index.ts"),
  read("supabase/migrations/20260829090000_m328_r1_booking_management.sql")
]);

test("M328 enriches every booking-bound email payload with the readable booking number", () => {
  const wrapperStart = bookingMigration.indexOf("create function app_private.notification_add_external_email(");
  const wrapperEnd = bookingMigration.indexOf("alter function app_private.pd_api_current_actions()", wrapperStart);
  const wrapper = bookingMigration.slice(wrapperStart, wrapperEnd);

  assert.ok(wrapperStart >= 0 && wrapperEnd > wrapperStart);
  assert.match(wrapper, /v_booking_id := nullif\(v_data ->> 'bookingId',''\)::uuid/);
  assert.match(wrapper, /from app_modules\.fanbus_bookings as booking where booking\.id=v_booking_id/);
  assert.match(wrapper, /jsonb_build_object\('bookingNumber',v_booking_number\)/);
});

test("fanbus booking emails render a consistent booking reference and help block", () => {
  assert.match(worker, /const FANBUS_CONTACT_EMAIL = "fanbus@plaerrdeifl\.de"/);
  assert.match(worker, /function fanbusBookingContext\(/);
  assert.match(worker, /Buchungsnummer: \$\{bookingNumber\}/);
  assert.match(worker, /Bitte gib diese Buchungsnummer bei Rückfragen mit an\./);
  assert.match(worker, /Fragen zu deiner Buchung\?/);
  assert.match(worker, /Oder melde dich direkt bei Luca oder Pascal\./);
  assert.match(worker, /mailto:\$\{FANBUS_CONTACT_EMAIL\}/);
  assert.match(worker, /\^\(\?:FB\|DEV\)-\[0-9\]\{2\}-\[0-9\]\{6,\}\$/);
});

test("booking context is applied centrally to fanbus mail delivery only", () => {
  const decoratorStart = worker.indexOf("function withFanbusBookingContext");
  const builderStart = worker.indexOf("function buildEmail", decoratorStart);
  const decorator = worker.slice(decoratorStart, builderStart);
  const deliverStart = worker.indexOf("async function deliver");
  const serveStart = worker.indexOf("Deno.serve", deliverStart);
  const deliver = worker.slice(deliverStart, serveStart);

  assert.ok(decoratorStart >= 0 && builderStart > decoratorStart);
  assert.match(decorator, /if \(!key\.startsWith\("fanbus\."\)\) return email/);
  assert.match(decorator, /legacyContactText/);
  assert.match(decorator, /legacyContactHtml/);
  assert.match(decorator, /Viele Grüße/);
  assert.match(decorator, /Im Portal öffnen/);
  assert.match(deliver, /withFanbusBookingContext\(claim, buildEmail\(config, claim\)\)/);
});

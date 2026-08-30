import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [worker, bookingMigration, contactMigration] = await Promise.all([
  read("supabase/functions/notification-dispatch/index.ts"),
  read("supabase/migrations/20260829090000_m328_r1_booking_management.sql"),
  read("supabase/migrations/20260830214500_m328_booking_mail_contact_context.sql")
]);

test("M328 keeps readable booking-number enrichment in the central email wrapper", () => {
  const wrapperStart = bookingMigration.indexOf("create function app_private.notification_add_external_email(");
  const wrapperEnd = bookingMigration.indexOf("alter function app_private.pd_api_current_actions()", wrapperStart);
  const wrapper = bookingMigration.slice(wrapperStart, wrapperEnd);

  assert.ok(wrapperStart >= 0 && wrapperEnd > wrapperStart);
  assert.match(wrapper, /v_booking_id := nullif\(v_data ->> 'bookingId',''\)::uuid/);
  assert.match(wrapper, /from app_modules\.fanbus_bookings as booking where booking\.id=v_booking_id/);
  assert.match(wrapper, /jsonb_build_object\('bookingNumber',v_booking_number\)/);
});

test("one central fanbus organization contact owns verified booking-mail contact values", () => {
  assert.match(contactMigration, /'fanbus\.organization_contact'/);
  assert.match(contactMigration, /'fanbus@plaerrdeifl\.de'/);
  assert.match(contactMigration, /'Luca'[\s\S]*?'0174 6681046'[\s\S]*?'tel:\+491746681046'/);
  assert.match(contactMigration, /'Pascal'[\s\S]*?'0172 9744908'[\s\S]*?'tel:\+491729744908'/);
  assert.match(contactMigration, /'whatsapp', '\{\}'::jsonb/);
  assert.doesNotMatch(contactMigration, /'username', '@plaerrdeifl'/);
  assert.doesNotMatch(contactMigration, /'url', 'https:\/\/wa\.me\/plaerrdeifl'/);
  assert.match(contactMigration, /Kein WhatsApp-Wert wird geraten/);
  assert.match(contactMigration, /create or replace function app_private\.fanbus_public_organization_contact\(\)/);
  assert.match(contactMigration, /'whatsapp', coalesce\(normalized\.whatsapp, '\{\}'::jsonb\)/);

  const wrapperStart = contactMigration.indexOf("create function app_private.notification_add_external_email(");
  const wrapperEnd = contactMigration.indexOf("revoke all on function app_private.notification_add_external_email(", wrapperStart);
  const wrapper = contactMigration.slice(wrapperStart, wrapperEnd);

  assert.ok(wrapperStart >= 0 && wrapperEnd > wrapperStart);
  assert.match(wrapper, /p_template_key like 'fanbus\.%'/);
  assert.match(wrapper, /from app_modules\.fanbus_bookings as booking/);
  assert.match(wrapper, /'organizationContact', app_private\.fanbus_public_organization_contact\(\)/);
  assert.match(wrapper, /notification_add_external_email_before_m328_booking_contact_context/);
  assert.match(contactMigration, /revoke all on function app_private\.notification_add_external_email\([\s\S]*?from public, anon, authenticated, service_role;/);
  assert.match(contactMigration, /grant execute on function app_private\.notification_add_external_email\([\s\S]*?to postgres;/);
});

test("fanbus booking emails render the reference and help block only from payload contacts", () => {
  assert.doesNotMatch(worker, /const FANBUS_(?:CONTACT|WHATSAPP|LUCA|PASCAL)/);
  assert.doesNotMatch(worker, /fanbus@plaerrdeifl\.de/);
  assert.doesNotMatch(worker, /0174 6681046/);
  assert.doesNotMatch(worker, /0172 9744908/);
  assert.doesNotMatch(worker, /@plaerrdeifl/);

  assert.match(worker, /function fanbusBookingContext\(/);
  assert.match(worker, /data\.organizationContact/);
  assert.match(worker, /contactItems\("emails"\)/);
  assert.match(worker, /contactItems\("phones"\)/);
  assert.match(worker, /organizationContact\.whatsapp/);
  assert.match(worker, /Buchungsnummer: \$\{bookingNumber\}/);
  assert.match(worker, /Bitte gib diese Buchungsnummer bei Rückfragen mit an\./);
  assert.match(worker, /Fragen zu deiner Buchung\?/);
  assert.match(worker, /mailto:\$\{escapeHtml\(item\.value\)\}/);
  assert.match(worker, /\^https:\\\/\\\/wa\\\.me/);
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

test("the current fanbus email inventory remains covered by the central decorator", () => {
  const fanbusMailTemplates = [
    "fanbus.booking.active",
    "fanbus.booking.waitlisted",
    "fanbus.internal_new",
    "fanbus.internal_extended",
    "fanbus.waitlist_promoted",
    "fanbus.cancelled",
    "fanbus.trip_cancelled",
    "fanbus.internal_cancelled",
    "fanbus.trip_price_changed",
    "fanbus.linked_event_changed",
    "fanbus.trip_departure_changed",
    "fanbus.boarding_time_changed",
    "fanbus.selected_boarding_stop_changed"
  ];

  for (const templateKey of fanbusMailTemplates) {
    assert.ok(worker.includes(`\"${templateKey}\"`), `${templateKey} missing from worker`);
  }

  assert.match(worker, /case "membership\.receipt":/);
  assert.match(worker, /if \(!key\.startsWith\("fanbus\."\)\) return email/);
});

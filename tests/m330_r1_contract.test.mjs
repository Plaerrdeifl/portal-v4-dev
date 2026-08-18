import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [domain, notifications, edge, dispatcher, portal, publicPage, push, wordpress, wordpressCss] = await Promise.all([
  read("supabase/migrations/20260818194500_add_fanbus_trip_cancellation_m330_r1.sql"),
  read("supabase/migrations/20260818194600_add_fanbus_change_notifications_m330_r1.sql"),
  read("supabase/functions/m310-fanbus-register/index.ts"),
  read("supabase/functions/notification-dispatch/index.ts"),
  read("js/modules/fanbuses.js"),
  read("js/fanbus-registration.js"),
  read("js/push.js"),
  read("wordpress/plugins/plaerrdeifl-m310-fanbus/plaerrdeifl-m310-fanbus.php"),
  read("wordpress/plugins/plaerrdeifl-m310-fanbus/assets/m310-fanbus.css")
]);

test("M330 adds the terminal cancellation model without a new table or index", () => {
  assert.match(domain, /add column cancellation_reason text/);
  assert.match(domain, /add column cancelled_at timestamptz/);
  assert.match(domain, /add column cancelled_by uuid/);
  assert.match(domain, /status in \('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'\)/);
  assert.match(domain, /length\(cancellation_reason\) between 1 and 240/);
  assert.match(domain, /status <> 'CANCELLED'[\s\S]*cancellation_reason is not null[\s\S]*cancelled_at is not null/);
  assert.doesNotMatch(domain, /create table .*cancell/i);
  assert.doesNotMatch(domain, /create (unique )?index/i);
});

test("cancellation API enforces capability, row lock, lifecycle, revision, idempotency and one transaction event", () => {
  const block = domain.slice(domain.indexOf("create function app_private.api_fanbus_trip_cancel"), domain.indexOf("-- Booking-Core"));
  assert.match(block, /require_capability\('fanbus\.manage'\)/);
  assert.match(block, /from app_modules\.fanbus_trips[\s\S]*for update/);
  assert.ok(block.indexOf("v_existing.status = 'CANCELLED'") < block.indexOf("v_existing.revision <> v_expected_revision"));
  assert.match(block, /v_existing\.cancellation_reason = v_reason/);
  assert.match(block, /FANBUS_TRIP_ALREADY_CANCELLED/);
  assert.match(block, /STALE_REVISION/);
  assert.match(block, /status = 'CLOSED'[\s\S]*FANBUS_TRIP_PUBLISHED/);
  assert.match(block, /status = 'CANCELLED'[\s\S]*revision = revision \+ 1/);
  assert.match(block, /FANBUS_TRIP_CANCELLED/);
  assert.match(block, /fanbus-trip:' \|\| v_id::text \|\| ':cancelled'/);
  assert.match(block, /jsonb_build_object\('tripId', v_id\)/);
  assert.doesNotMatch(block, /email|is_paid|push_subscription|participant/i);
});

test("all affected mutation families take the shared trip-first cancellation guard", () => {
  for (const fn of [
    "api_fanbus_trip_update", "api_fanbus_trip_publish", "api_fanbus_trip_close",
    "api_fanbus_trip_reopen", "api_fanbus_trip_delete", "api_fanbus_registration_update",
    "api_fanbus_registration_cancel", "api_fanbus_waitlist_promote", "api_fanbus_bus_upsert",
    "api_fanbus_bus_assignment_set", "api_fanbus_trip_boarding_stop_upsert",
    "api_fanbus_trip_boarding_stops_reorder", "api_fanbus_bus_boarding_stops_set",
    "api_fanbus_registration_operational_update", "api_fanbus_registration_update_m325",
    "api_fanbus_checkin_set", "api_fanbus_paid_set"
  ]) {
    const start = domain.indexOf(`create function app_private.${fn}(p_payload jsonb)`);
    assert.ok(start >= 0, `${fn} wrapper is present`);
    assert.match(domain.slice(start, start + 650), /m330_lock_mutable_fanbus_trip/);
  }
  assert.match(domain, /fanbus_submit_booking_core[\s\S]*for update[\s\S]*v_status = 'CANCELLED'/);
  assert.match(domain, /outcome[\s\S]*CANCELLED/);
});

test("public projections expose only the cancellation contract and preserve the public horizon", () => {
  for (const fn of ["pd_public_fanbus_trip", "pd_public_fanbus_trips", "pd_public_fanbus_trip_boarding_stops"]) {
    assert.match(domain, new RegExp(`function public\\.${fn}`));
  }
  assert.match(domain, /'tripStatus', trip\.status/);
  assert.match(domain, /'cancellationReason', trip\.cancellation_reason/);
  assert.match(domain, /'cancelledAt', trip\.cancelled_at/);
  assert.match(domain, /event\.visibility = 'PUBLIC'/);
  assert.match(domain, /event\.event_date >= v_today/);
  assert.match(domain, /when trip\.status = 'CANCELLED' then 'CANCELLED'/);
  const publicProjection = domain.slice(domain.indexOf("public.pd_public_fanbus_trip"), domain.indexOf("-- Interner Snapshot"));
  for (const forbidden of ["cancelled_by", "booking_id", "first_name", "last_name", "email", "is_paid", "audit_events"]) {
    assert.doesNotMatch(publicProjection, new RegExp(forbidden));
  }
});

test("internal snapshot supplies the PII-free impact preview", () => {
  assert.match(domain, /'affectedBookingCount', registration\.booking_count/);
  assert.match(domain, /'activeRegistrationCount', registration\.active_count/);
  assert.match(domain, /'waitlistedRegistrationCount', registration\.waitlisted_count/);
  assert.match(domain, /Buchungskontakte erhalten eine Pflicht-E-Mail; Portalnutzer optional Push/);
});

test("M020 expands one mandatory email per primary booking and optional push", () => {
  assert.match(notifications, /FANBUS_TRIP_CANCELLED/);
  assert.match(notifications, /distinct on \(primary_registration\.booking_id\)/);
  assert.match(notifications, /affected\.status in \('ACTIVE', 'WAITLISTED'\)/);
  assert.match(notifications, /primary_registration\.booking_role = 'PRIMARY'/);
  assert.match(notifications, /'fanbus\.trip_cancelled'[\s\S]*true\s*\)/);
  assert.match(notifications, /'Fanbusfahrt abgesagt'/);
  assert.match(notifications, /#\/fanbuses\?detail=/);
  assert.match(notifications, /for update skip locked/);
  assert.match(notifications, /interval '1 minute'[\s\S]*interval '5 minutes'[\s\S]*interval '30 minutes'[\s\S]*interval '2 hours'/);
  assert.match(dispatcher, /case "fanbus\.trip_cancelled"/);
  assert.match(dispatcher, /Fanbusfahrt abgesagt – \$\{tripTitle\}/);
  assert.match(dispatcher, /Fahrt abgesagt[\s\S]*Grund:/);
  assert.match(dispatcher, /Deine Fanbusbuchung ist von dieser Absage betroffen/);
  assert.doesNotMatch(dispatcher.slice(dispatcher.indexOf('case "fanbus.trip_cancelled"'), dispatcher.indexOf('case "fanbus.internal_cancelled"')), /refund|erstattung|rückzahlung/i);
});

test("new trip-cancellation push preference is additive and personal cancellation remains separate", () => {
  assert.match(notifications, /push_fanbus_trip_cancellations boolean not null default true/);
  assert.match(notifications, /p_template_key[\s\S]*fanbus\.trip_cancelled[\s\S]*push_fanbus_trip_cancellations/);
  assert.match(notifications, /notification_push_preference_enabled_before_m330_r1/);
  assert.doesNotMatch(notifications, /fanbus\.cancelled[^\n]*push_fanbus_trip_cancellations/);
  assert.match(push, /<strong>Eigene Stornierungen<\/strong><small>Stornierungen der eigenen Buchung<\/small>/);
  assert.match(push, /<strong>Fahrt abgesagt<\/strong><small>Wenn eine Fanbusfahrt vollständig abgesagt wird<\/small>/);
  assert.match(push, /pushFanbusTripCancellations: form\.elements\.pushFanbusTripCancellations\.checked/);
});

test("M210 reuses existing events, filters relevant fields and guards PUBLIC visibility", () => {
  assert.match(notifications, /DATE_EVENT_CHANGED/);
  assert.match(notifications, /DATE_ICS_IMPORT_SUMMARY/);
  assert.doesNotMatch(notifications, /FANBUS_EVENT_CHANGED/);
  for (const field of ["eventDate", "eventTime", "venue", "title", "opponentName", "homeAway"]) {
    assert.match(notifications, new RegExp(`'${field}'`));
  }
  assert.match(notifications, /source_trip\.status in \('PUBLISHED', 'CLOSED'\)/);
  assert.match(notifications, /EVENT_PUBLIC_VISIBILITY_REQUIRED_BY_FANBUS/);
  assert.match(notifications, /trip\.status = 'PUBLISHED'/);
  assert.match(
    notifications,
    /pg_advisory_xact_lock[\s\S]{0,300}select coalesce\(max\(audit\.id\), 0\)[\s\S]{0,200}into v_audit_floor/
  );
  assert.match(notifications, /audit\.id > v_audit_floor/);
  assert.match(notifications, /audit\.before_data -> 'eventDate'/);
  assert.match(notifications, /audit\.before_data -> 'eventTime'/);
  assert.match(notifications, /audit\.before_data -> 'venue'/);
  assert.match(notifications, /audit\.before_data -> 'homeAway'/);
  assert.match(notifications, /audit\.before_data -> 'opponentName'/);
  assert.match(notifications, /'fanbus\.linked_event_changed'/);
  assert.doesNotMatch(notifications, /':event-change',[\s\S]{0,100}'fanbus\.trip_departure_changed'/);
  assert.match(dispatcher, /case "fanbus\.linked_event_changed"/);
  assert.match(dispatcher, /Termin- oder Spieldaten für deine Fanbusfahrt wurden geändert/);
  assert.match(notifications, /m210_ics_import_confirm_before_m330_r1[\s\S]*from public, anon, authenticated, service_role/);
});

test("public Edge, portal UI and WordPress render cancellation safely without booking CTAs", () => {
  assert.match(edge, /outcome === "CANCELLED"/);
  assert.match(edge, /FANBUS_TRIP_CANCELLED/);
  assert.match(edge, /Diese Fanbusfahrt wurde abgesagt\./);
  assert.match(publicPage, /tripStatus === "CANCELLED"/);
  assert.match(publicPage, /Fahrt abgesagt/);
  assert.match(publicPage, /FANBUS_TRIP_CANCELLED/);
  assert.match(portal, /Öffentlicher Stornierungsgrund/);
  assert.match(portal, /maxlength="240"/);
  assert.match(portal, /affectedBookingCount/);
  assert.match(portal, /Fahrt absagen/);
  assert.match(portal, /Betriebsdaten bleiben historisch lesbar/);
  assert.match(wordpress, /'CANCELLED'/);
  assert.match(wordpress, /Fahrt abgesagt/);
  assert.match(wordpress, /cancellationReason/);
  assert.match(wordpress, /array\('UNAVAILABLE', 'CANCELLED'\)/);
  assert.match(wordpressCss, /pd-m310-status-cancelled/);
});

test("private M330 functions stay outside browser execution", () => {
  assert.match(domain, /revoke all on function app_private\.api_fanbus_trip_cancel\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(notifications, /revoke all on function app_private\.notification_push_preference_enabled[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(domain, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
});

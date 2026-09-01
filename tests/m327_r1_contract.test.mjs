import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const [sql, ui, page, guest, css, renderer] = await Promise.all([
  read("supabase/migrations/20260828194202_m327_r1_fanbus_booking_selfservice.sql"),
  read("js/modules/fanbus-my-bookings.js"),
  read("pages/fanbuses.html"),
  read("js/fanbus-registration.js"),
  read("css/app.css"),
  read("supabase/functions/notification-dispatch/index.ts")
]);

test("M327 exposes one authenticated read and three USER_MUTATION actions", () => {
  for (const action of [
    "fanbus_my_bookings_list",
    "fanbus_selfservice_participant_update",
    "fanbus_selfservice_participant_cancel",
    "fanbus_selfservice_booking_append"
  ]) assert.match(sql, new RegExp(action));
  assert.match(sql, /when 'fanbus_my_bookings_list' then 'READ'/);
  assert.equal((sql.match(/then 'USER_MUTATION'/g) || []).length >= 3, true);
});

test("ownership A-I is actor-bound and creator is PORTAL source plus created_by", () => {
  assert.match(sql, /v_actor uuid := app_private\.require_active_user\(\)/);
  assert.match(sql, /p_booking\.source = 'PORTAL' and p_booking\.created_by = p_actor/);
  assert.match(sql, /p_registration\.portal_user_id = p_actor/);
  assert.doesNotMatch(sql, /booking_role\s*=\s*'PRIMARY'.{0,120}(creator|created_by)/is);
  assert.match(sql, /v_booking\.source <> 'PORTAL' or v_booking\.created_by <> v_actor/);
  assert.match(sql, /raise exception 'NOT_FOUND'/);
  assert.doesNotMatch(sql, /update app_modules\.fanbus_bookings[\s\S]{0,200}created_by/i);
});

test("read model includes creator-or-participant history and minimizes non-creator data", () => {
  const fn = sql.slice(sql.indexOf("create function app_private.api_fanbus_my_bookings_list"), sql.indexOf("create function app_private.api_fanbus_selfservice_participant_update"));
  assert.match(fn, /booking\.source = 'PORTAL' and booking\.created_by = v_actor/);
  assert.match(fn, /own\.portal_user_id = v_actor/);
  assert.doesNotMatch(fn, /event_date\s*>=|departure_at\s*>\s*clock_timestamp/);
  assert.match(fn, /when booking\.is_creator or registration\.portal_user_id = v_actor/);
  const redacted = fn.slice(fn.indexOf("else jsonb_build_object("), fn.indexOf("end", fn.indexOf("else jsonb_build_object(")));
  for (const forbidden of ["email", "portalUserId", "memberId", "regularRiderId", "operational", "paid", "checkin"]) {
    assert.doesNotMatch(redacted, new RegExp(forbidden, "i"));
  }
});

test("72-hour boundary is strict and registration close is absent from existing-booking guards", () => {
  assert.match(sql, /p_departure_at - interval '72 hours'/);
  assert.match(sql, /clock_timestamp\(\) >= app_private\.fanbus_selfservice_until/);
  assert.match(sql, /clock_timestamp\(\) < app_private\.fanbus_selfservice_until/);
  const guard = sql.slice(sql.indexOf("create function app_private.fanbus_assert_selfservice_mutable"), sql.indexOf("-- Capability-independent"));
  assert.doesNotMatch(guard, /registration_closes_at/);
  assert.match(guard, /p_trip\.status <> 'PUBLISHED'/);
  assert.match(guard, /p_trip\.departure_at is null/);
});

test("participant update is allowlisted, CAS-protected and assignment-stable", () => {
  const start = sql.indexOf("create function app_private.api_fanbus_selfservice_participant_update");
  const fn = sql.slice(start, sql.indexOf("-- Preserve the accepted M320-R3 contract", start));
  for (const key of ["participantId", "expectedRevision", "tripBoardingStopId", "busPreference"]) assert.match(fn, new RegExp(key));
  for (const forbidden of ["firstName", "lastName", "operationalNote", "paid", "checkin", "busId"]) {
    assert.doesNotMatch(fn, new RegExp(`'${forbidden}'`));
  }
  assert.match(fn, /where id = v_trip_id for update/);
  assert.match(fn, /where id = v_id and trip_id = v_trip_id for update/);
  assert.match(fn, /v_registration\.revision <> v_expected[\s\S]*STALE_REVISION/);
  assert.match(fn, /fanbus_bus_boarding_stops/);
  assert.match(fn, /FANBUS_SELF_SERVICE_STOP_INCOMPATIBLE_CONTACT_BUS_ORGA/);
  assert.doesNotMatch(fn, /delete from app_modules\.fanbus_bus_assignments/);
  assert.match(fn, /SELF_SERVICE_PARTICIPANT_UPDATED/);
});

test("operator and selfservice cancellation share one kernel without auto-promotion", () => {
  const kernel = sql.slice(sql.indexOf("create function app_private.fanbus_participant_cancel_kernel"), sql.indexOf("alter function app_private.api_fanbus_registration_cancel"));
  assert.match(kernel, /delete from app_modules\.fanbus_bus_assignments/);
  assert.match(kernel, /status = 'CANCELLED'/);
  assert.doesNotMatch(kernel, /promot/i);
  assert.ok((sql.match(/fanbus_participant_cancel_kernel\(/g) || []).length >= 4);
  assert.match(sql, /require_capability\('fanbus\.registrations\.manage'\)/);
  assert.match(sql, /SELF_SERVICE_PARTICIPANT_CANCELLED/);
});

test("append preserves booking, sequence, primary and atomic batch outcome", () => {
  const fn = sql.slice(sql.indexOf("create function app_private.api_fanbus_selfservice_booking_append"), sql.indexOf("create function app_private.fanbus_selfservice_owner"));
  assert.match(fn, /where id=v_trip_id for update/);
  assert.match(fn, /where id=v_booking_id and trip_id=v_trip_id for update/);
  assert.match(fn, /max\(participant_sequence\)/);
  assert.match(fn, /v_booking_id,'COMPANION'/);
  assert.doesNotMatch(fn, /insert into app_modules\.fanbus_bookings/);
  assert.doesNotMatch(fn, /booking_role\s*=|participant_sequence\s*=|update app_modules\.fanbus_registrations/);
  assert.match(fn, /v_active_count\+v_batch_size>app_private\.fanbus_effective_capacity/);
  assert.match(fn, /status='WAITLISTED'/);
  assert.match(fn, /v_waitlisted_at:=clock_timestamp\(\)/);
});

test("append duplicate, idempotency and provenance are server-authoritative", () => {
  assert.match(sql, /m325_companion_conflict_status/);
  assert.match(sql, /jsonb_array_elements\(v_canonical\)/);
  assert.match(sql, /FANBUS_COMPANION_CONFLICT/);
  assert.match(sql, /'operation','APPEND','actor',v_actor,'booking',v_booking_id,'trip',v_trip_id/);
  assert.match(sql, /M327-R1-D076/);
  assert.match(sql, /FANBUS_IDEMPOTENCY_KEY_REUSED/);
  assert.match(sql, /response_payload is not null then return/);
  assert.match(sql, /SELF_SERVICE_PARTICIPANT_ADDED/);
});

test("append emits exactly the dedicated existing-pipeline M020 event", () => {
  assert.match(sql, /notification_event_enqueue\(\s*'FANBUS_BOOKING_EXTENDED'/);
  assert.match(sql, /'fanbus\.internal_extended'/);
  assert.match(sql, /notification_config_user_ids/);
  const append = sql.slice(sql.indexOf("create function app_private.api_fanbus_selfservice_booking_append"), sql.indexOf("create function app_private.fanbus_selfservice_owner"));
  assert.doesNotMatch(append, /FANBUS_BOOKING_CREATED/);
  assert.match(renderer, /case "fanbus\.internal_extended"/);
});

test("organization contact has one sanitized public projection and guest mail/success consumers", () => {
  assert.match(sql, /'fanbus\.organization_contact'/);
  assert.match(sql, /create function public\.pd_public_fanbus_contact\(\)/);
  assert.match(sql, /grant execute on function public\.pd_public_fanbus_contact\(\) to anon, authenticated/);
  assert.doesNotMatch(sql, /grant select on.*settings/is);
  assert.match(guest, /rpc\("pd_public_fanbus_contact"\)/);
  assert.match(guest, /Du möchtest deine Anmeldung ändern oder stornieren/);
  assert.match(renderer, /organizationContact/);
  assert.match(renderer, /Bitte wende dich an unsere BUS_ORGA/);
});

test("frontend stays inside Fanbus and implements creator/non-creator mobile cards", () => {
  assert.match(page, /id="m327TripsPanel"/);
  assert.match(page, /Buchungen &amp; Einstellungen/);
  assert.match(page, /id="m327MyBookingsTab"[\s\S]*?>Meine Buchungen<\/button>/);
  assert.doesNotMatch(page, /main-navigation|nav-item/);
  assert.match(ui, /booking\.isCreator && trip\.canMutate/);
  assert.match(ui, /booking\.isCreator \|\| participant\.isSelf/);
  assert.match(ui, /participant\.redacted/);
  assert.match(ui, /Vergangene Buchungen/);
  assert.match(ui, /Eine Änderung des Buswunsches ändert diese Buszuordnung nicht automatisch/);
  assert.match(ui, /call\("fanbus_companion_duplicate_preview"/);
  assert.match(ui, /data-m327-duplicate-preview/);
  assert.match(ui, /appendAttempt\?\.fingerprint !== fingerprint/);
  assert.match(ui, /idempotencyKey: appendAttempt\.idempotencyKey/);
  assert.match(css, /\.m327-booking-card/);
  assert.match(css, /@media \(max-width:700px\)/);
});

test("browser roles retain no direct fanbus table mutations", () => {
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|select)[\s\S]*app_modules\.fanbus_/i);
  assert.match(sql, /security definer/g);
  assert.match(sql, /set search_path = ''/g);
  assert.match(sql, /from public, anon, authenticated, service_role/);
});

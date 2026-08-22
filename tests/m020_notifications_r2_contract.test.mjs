import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [migration, push, ui, css, worker, r1Migration] = await Promise.all([
  read("supabase/migrations/20260817183000_add_notification_preferences_m020_r2.sql"),
  read("js/push.js"),
  read("js/ui.js"),
  read("css/app.css"),
  read("supabase/functions/notification-dispatch/index.ts"),
  read("supabase/migrations/20260816170000_add_central_notifications_m020_r1.sql")
]);

test("M020-R2 is additive and preserves the frozen R1 migration", () => {
  assert.match(migration, /M020-R2/);
  assert.match(r1Migration, /M020-R1/);
  assert.doesNotMatch(migration, /wplescvhlgctynkfwvrj/);
});

test("granular push preferences exist and default behind the existing parent switches", () => {
  for (const field of [
    "push_membership_applications",
    "push_access_requests",
    "push_own_account_status",
    "push_fanbus_new_trips",
    "push_fanbus_own_bookings",
    "push_fanbus_waitlist",
    "push_fanbus_cancellations",
    "push_fanbus_times",
    "push_fanbus_boarding",
    "push_fanbus_bus_assignment",
    "push_fanbus_price_changes",
    "push_fanbus_org_bookings",
    "push_fanbus_org_cancellations",
    "push_dates_new",
    "push_dates_changes",
    "push_dates_deleted"
  ]) {
    assert.match(migration, new RegExp(`${field} boolean not null default true`));
  }
  assert.match(migration, /notification_preference_enabled\(\s*p_user_id,\s*p_category,\s*'PUSH'/s);
});

test("mandatory email behavior is not controlled by the new push subpreferences", () => {
  const start = migration.indexOf("create or replace function app_private.notification_add_user");
  const end = migration.indexOf("create or replace function app_private.api_push_snapshot", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /p_email_mandatory\s+or\s+app_private\.notification_preference_enabled/s);
  assert.match(block, /notification_push_preference_enabled/);
  assert.ok(block.indexOf("v_email_enabled :=") < block.indexOf("v_push_enabled :="));
});

test("portal projection exists only for an actually eligible push with an active device", () => {
  const start = migration.indexOf("create or replace function app_private.notification_add_user");
  const end = migration.indexOf("create or replace function app_private.api_push_snapshot", start);
  const block = migration.slice(start, end);
  assert.match(block, /v_has_push_subscription boolean := false/);
  assert.match(block, /ps\.is_active = true/);
  assert.match(block, /if not v_push_enabled or not v_has_push_subscription then\s+return;/s);
  assert.ok(
    block.indexOf("if not v_push_enabled or not v_has_push_subscription") <
      block.indexOf("notification_project_user"),
    "projection must happen only after push eligibility was established"
  );
});

test("orphan targets do not keep the application badge unread count", () => {
  assert.match(migration, /notification_projection_actionable/);
  assert.match(migration, /notification_unread_count/);
  for (const type of [
    "task",
    "fanbus_registration",
    "fanbus_trip",
    "membership_application",
    "access_request",
    "event",
    "event_import_run"
  ]) {
    assert.match(migration, new RegExp(`'${type}'`));
  }
  assert.match(migration, /'unreadNotificationCount',\s*app_private\.notification_unread_count\(v_user\)/s);
  assert.match(migration, /else app_private\.notification_unread_count\(c\.recipient_user_id\)/);
});

test("new published fanbus trip becomes one optional push family", () => {
  assert.match(migration, /new\.action = 'FANBUS_TRIP_PUBLISHED'/);
  assert.match(migration, /'FANBUS_TRIP_PUBLISHED'/);
  assert.match(migration, /'fanbus\.trip_published'/);
  assert.match(migration, /'Neue Auswärtsfahrt'/);
  assert.match(migration, /push_fanbus_new_trips/);
});

test("bus changes use the real ASSIGNED audit and do not invent a FANBUS_BUS_CHANGED action", () => {
  assert.match(migration, /new\.action = 'FANBUS_BUS_ASSIGNED'/);
  assert.match(migration, /FANBUS_BUS_ASSIGNMENT_CHANGED/);
  assert.doesNotMatch(migration, /new\.action\s*=\s*'FANBUS_BUS_CHANGED'/);
  assert.match(migration, /push_fanbus_bus_assignment/);
});

test("published price changes are mandatory email plus optional push for existing bookings", () => {
  assert.match(migration, /new\.action = 'FANBUS_TRIP_UPDATED'/);
  assert.match(migration, /priceCents/);
  assert.match(migration, /FANBUS_TRIP_PRICE_CHANGED/);
  assert.match(migration, /'fanbus\.trip_price_changed'/);
  assert.match(migration, /affected\.status in \('ACTIVE', 'WAITLISTED'\)/);
  assert.match(migration, /notification_add_external_email\(/);
  assert.match(migration, /'fanbus\.trip_price_changed',[\s\S]*?true\s*\)/);
  assert.match(migration, /push_fanbus_price_changes/);
  assert.match(worker, /case "fanbus\.trip_price_changed"/);
  assert.match(worker, /Fanbus – Preis geändert/);
});

test("R2 does not invent a published-trip cancellation that the fanbus domain does not support", () => {
  assert.doesNotMatch(migration, /FANBUS_TRIP_CANCELLED|fanbus\.trip_cancelled/i);
});

test("manual dates notify only material changes and ICS is summarized once", () => {
  assert.match(migration, /EVENT_CREATED/);
  assert.match(migration, /EVENT_UPDATED/);
  assert.match(migration, /EVENT_DELETED/);
  assert.match(migration, /v_source = 'ICS_IMPORT'/);
  assert.match(migration, /EVENT_ICS_IMPORT_CONFIRMED/);
  assert.match(migration, /DATE_ICS_IMPORT_SUMMARY/);
  assert.match(migration, /createdCount/);
  assert.match(migration, /updatedCount/);
  assert.match(migration, /v_before_relevant is not distinct from v_after_relevant/);
});

test("dates expose push but keep optional date email disabled in R2 UI", () => {
  assert.match(push, /title: "Termine"/);
  assert.match(push, /emailDisabled: true/);
  assert.match(push, /pushName: "pushDates"/);
  assert.match(push, /pushChecked: preferences\.pushDates === true/);
  assert.match(push, /pushDates: form\.elements\.pushDates\.checked/);
  assert.match(push, /emailDates: false/);
  assert.match(push, /Termine-Push genauer einstellen/);
  for (const name of ["pushDatesNew", "pushDatesChanges", "pushDatesDeleted"]) {
    assert.match(push, new RegExp(`name="${name}"`));
  }
});

test("account and fanbus detail switches are present without changing task detail behavior", () => {
  assert.match(push, /Konto-Push genauer einstellen/);
  assert.match(push, /Fanbus-Push genauer einstellen/);
  for (const name of [
    "pushMembershipApplications",
    "pushAccessRequests",
    "pushOwnAccountStatus",
    "pushFanbusNewTrips",
    "pushFanbusOwnBookings",
    "pushFanbusWaitlist",
    "pushFanbusCancellations",
    "pushFanbusTimes",
    "pushFanbusBoarding",
    "pushFanbusBusAssignment",
    "pushFanbusPriceChanges",
    "pushFanbusOrgBookings",
    "pushFanbusOrgCancellations"
  ]) {
    assert.match(push, new RegExp(`name="${name}"`));
  }
  assert.match(push, /Aufgaben-Push genauer einstellen/);
  for (const name of ["newTasks", "taskUpdates", "taskStatus", "taskTransfers", "waitingDeadlines"]) {
    assert.match(push, new RegExp(`name="${name}"`));
  }
});

test("red More dot is removed while normal active highlighting remains", () => {
  assert.doesNotMatch(ui, /classList\.toggle\("more-active"/);
  assert.doesNotMatch(css, /\.mobile-nav-button\.more-active::after/);
  assert.match(ui, /more\.classList\.toggle\("active", highlighted\)/);
  assert.match(css, /\.mobile-nav-button\.active\s*\{/);
});

test("R1 retry and claim recovery semantics remain in the replacement functions", () => {
  for (const marker of [
    "CLAIM_EXPIRED",
    "MAX_ATTEMPTS_REACHED",
    "DELIVERY_EXPIRED",
    "PUSH_SUBSCRIPTION_INACTIVE",
    "for update skip locked",
    "interval '10 minutes'",
    "interval '1 minute'",
    "interval '5 minutes'",
    "interval '30 minutes'",
    "interval '2 hours'",
    "interval '12 hours'"
  ]) {
    assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(migration, /case when attempt_count>=5 then 'FAILED' else 'PENDING' end/);
});

test("new private R2 helpers are not browser-executable", () => {
  for (const signature of [
    "notification_projection_actionable\\(text, text\\)",
    "notification_unread_count\\(uuid\\)",
    "notification_push_preference_enabled\\(uuid, text, text, text, jsonb\\)",
    "m020_r2_audit_notification_trigger\\(\\)",
    "notification_expand_r2_event\\(uuid\\)"
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke execute on function app_private\\.${signature}[\\s\\S]*?from public, anon, authenticated, service_role`)
    );
  }
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const worker = read("../service-worker.js");
const bridge = read("../js/task-push-r3.js");
const migration = read(
  "../supabase/migrations/20260901220000_m020_push_navigation_badge_acknowledgement.sql"
);

test("closed, background and running PWA states share one URL-based navigation contract", () => {
  assert.match(worker, /const targetUrl = new URL\(route, self\.registration\.scope\)\.href/);
  assert.match(worker, /windows\.find\(client => client\.visibilityState === "visible"\)/);
  assert.match(worker, /\|\| windows\.find\(client => client\.focused\)/);
  assert.match(worker, /const navigated = await client\.navigate\(targetUrl\)/);
  assert.match(worker, /return self\.clients\.openWindow\(targetUrl\)/);
  assert.doesNotMatch(worker, /OPEN_PUSH_ROUTE/);
});

test("notification and concrete entity ids survive the service-worker route", () => {
  assert.match(worker, /params\.set\("notificationId", id\)/);
  assert.match(migration, /notification\.id = v_resolved_notification_id/);
  assert.match(migration, /outbox\.id = v_notification_id/);
  assert.match(bridge, /taskId: params\.get\("taskId"\)/);
  assert.match(bridge, /applicationId: context\.params\.get\("applicationId"\)/);
  assert.match(bridge, /accessRequestId: context\.params\.get\("accessRequest"\)/);
  assert.match(bridge, /fanbusTripId: context\.params\.get\("detail"\)/);
  assert.match(bridge, /hasItem\(data\?\.tasks, pending\?\.taskId/);
  assert.match(bridge, /action === "membership_application_detail"/);
  assert.match(bridge, /hasItem\(data\?\.requests, pending\?\.accessRequestId/);
  assert.match(bridge, /hasItem\(data\?\.trips, pending\?\.fanbusTripId/);
});

test("read acknowledgement starts only after a successful target data call", () => {
  assert.match(bridge, /window\.addEventListener\("pd-api-after-call"/);
  assert.match(bridge, /acknowledgeActivatedArea/);
  assert.match(bridge, /action === "tasks_snapshot"/);
  assert.match(bridge, /action === "events_list"/);
  assert.match(bridge, /action === "membership_applications_list"/);
  assert.match(bridge, /action === "admin_snapshot"/);
  assert.doesNotMatch(bridge, /prepareHashDestination/);
  assert.doesNotMatch(bridge, /openPushDestination/);
});

test("manual area activation acknowledges only its server-defined notification family", () => {
  assert.match(migration, /v_scope = 'membership_applications'/);
  assert.match(migration, /notification\.event_type = 'MEMBERSHIP_APPLICATION_INTERNAL_NEW'/);
  assert.match(migration, /v_scope = 'access_requests'/);
  assert.match(migration, /notification\.event_type = 'ACCESS_REQUEST_INTERNAL_NEW'/);
  assert.match(migration, /v_scope = 'tasks'/);
  assert.match(migration, /left\(notification\.event_type, 5\) = 'TASK_'/);
  assert.match(migration, /v_scope = 'dates'/);
  assert.match(migration, /'DATE_ICS_IMPORT_SUMMARY'/);
  assert.match(migration, /v_scope = 'fanbuses'/);
  assert.match(migration, /notification\.route like '#\/fanbuses%'/);
});

test("mixed unread areas remain isolated and the backend snapshot is authoritative", () => {
  const membershipBlock = migration.slice(
    migration.indexOf("v_scope = 'membership_applications'"),
    migration.indexOf("elsif v_scope = 'access_requests'")
  );
  assert.match(membershipBlock, /MEMBERSHIP_APPLICATION_INTERNAL_NEW/);
  assert.doesNotMatch(membershipBlock, /TASK_|DATE_|FANBUS_/);
  assert.match(migration, /return app_private\.api_push_snapshot\(\)/);
  assert.match(bridge, /await applyAuthoritativeBadgeSnapshot\(snapshot, userId\)/);
  assert.doesNotMatch(worker, /previousBadgeCount\s*-\s*1/);
  assert.doesNotMatch(worker, /badgeCount:\s*1/);
  assert.match(worker, /payload\.badgeCount !== undefined/);
});

test("BUS_ORGA notifications use the existing trip booking view and retain D-073 guards", () => {
  assert.match(migration, /return '#\/bus-orga\?view=bookings&trip=' \|\| v_trip_id::text/);
  assert.match(migration, /'FANBUS_BOOKING_CREATED'/);
  assert.match(migration, /'FANBUS_BOOKING_EXTENDED'/);
  assert.match(migration, /'FANBUS_REGISTRATION_CANCELLED'/);
  assert.match(migration, /has_capability\(v_actor, 'fanbus\.registrations\.manage'\)/);
  assert.match(migration, /has_capability\(v_actor, 'fanbus\.manage'\)/);
  assert.match(migration, /registration\.trip_id = v_trip_id/);
  assert.match(migration, /booking\.trip_id = v_trip_id/);
  assert.match(bridge, /entityType: "fanbus_trip_operational"/);
});

test("scope permissions reuse the existing authorization model", () => {
  assert.match(migration, /perform app_private\.m150_require_current_board_member\(\)/);
  assert.match(migration, /perform app_private\.require_capability\('users\.manage'\)/);
  assert.match(migration, /raise exception 'Berechtigung fehlt\.'/);
});

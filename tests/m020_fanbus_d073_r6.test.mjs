import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read(
  "../supabase/migrations/20260830230000_m020_fanbus_d073_acknowledge_r6.sql"
);
const pushConsumer = read("../js/task-push-r3.js");

test("existing D-073 selects booking-created and cancelled notifications through the registration-to-trip relation", () => {
  assert.match(migration, /v_entity_type = 'fanbus_trip_operational'/);
  assert.match(migration, /'FANBUS_BOOKING_CREATED'/);
  assert.match(migration, /'FANBUS_REGISTRATION_CANCELLED'/);
  assert.match(migration, /notification\.entity_type = 'fanbus_registration'/);
  assert.match(migration, /from app_modules\.fanbus_registrations as registration/);
  assert.match(migration, /registration\.id::text = notification\.entity_id/);
  assert.match(migration, /registration\.trip_id = v_trip_id/);
  assert.doesNotMatch(
    migration,
    /notification\.event_type\s+in\s*\([^)]*(?:FANBUS_TRIP_CANCELLED|FANBUS_TRIP_PRICE_CHANGED|FANBUS_TRIP_UPDATED)/s
  );
});

test("D-073 server path requires Fanbus management capability and never trusts a client notification list", () => {
  assert.match(migration, /has_capability\(v_actor, 'fanbus\.registrations\.manage'\)/);
  assert.match(migration, /has_capability\(v_actor, 'fanbus\.manage'\)/);
  assert.doesNotMatch(migration, /notificationIds|notification_ids|jsonb_array_elements/i);
});

test("D-073 is triggered only after successful relevant Fanbus API calls and applies returned authoritative badge snapshot", () => {
  assert.match(
    pushConsumer,
    /const FANBUS_D073_VIEW_ACTIONS = new Set\(\[[\s\S]*"fanbus_registrations_list"[\s\S]*"fanbus_buses_list"[\s\S]*\]\)/m
  );
  assert.match(pushConsumer, /window\.addEventListener\("pd-api-after-call"/);
  assert.match(pushConsumer, /entityType: "fanbus_trip_operational"/);
  assert.match(pushConsumer, /entityId: tripId/);
  assert.match(pushConsumer, /await applyAuthoritativeBadgeSnapshot\(snapshot, userId\)/);
});

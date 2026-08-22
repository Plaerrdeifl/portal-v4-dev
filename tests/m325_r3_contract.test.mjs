import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const migrationPath = "supabase/migrations/20260822074900_add_joint_fanbus_preferences_and_bus_control.sql";

test("M325-R3 adds the closed preference model and additive trip default", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /add column default_boarding_stop_id uuid[\s\S]*references app_modules\.fanbus_boarding_stops\(id\) on delete set null/);
  assert.match(sql, /create table app_modules\.fanbus_user_preferences/);
  assert.match(sql, /user_id uuid primary key[\s\S]*references app_portal\.users\(id\) on delete cascade/);
  assert.match(sql, /revision integer not null default 1[\s\S]*revision > 0/);
  assert.match(sql, /fanbus_user_preferences_set_updated_at/);
  assert.match(sql, /alter table app_modules\.fanbus_user_preferences enable row level security/);
  assert.match(sql, /revoke all on table app_modules\.fanbus_user_preferences[\s\S]*from public, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /create policy[\s\S]*fanbus_user_preferences/i);
  const table = sql.slice(
    sql.indexOf("create table app_modules.fanbus_user_preferences"),
    sql.indexOf("create trigger fanbus_user_preferences_set_updated_at")
  );
  assert.doesNotMatch(table, /member_id|jsonb|default_bus_preference|role/i);
});

test("self-service contracts derive the actor and enforce active master stop plus CAS", async () => {
  const sql = await read(migrationPath);
  for (const name of ["get", "set", "delete"]) {
    assert.match(sql, new RegExp(`api_fanbus_user_preference_${name}`));
  }
  const block = sql.slice(
    sql.indexOf("create function app_private.api_fanbus_user_preference_get"),
    sql.indexOf("-- Preserve the complete current M010/M330 snapshot")
  );
  assert.ok((block.match(/require_active_user\(\)/g) || []).length >= 3);
  assert.doesNotMatch(block, /p_payload\s*->>\s*'userId'|p_user_id/);
  assert.match(block, /where preference\.user_id = v_actor/);
  assert.match(block, /where id = v_stop_id and is_active/);
  assert.match(block, /v_expected_revision <> v_existing\.revision/);
  assert.match(block, /delete from app_modules\.fanbus_user_preferences[\s\S]*revision = v_expected_revision/);
  assert.match(block, /availableBoardingStops/);
});

test("personal preference writes keep CAS but emit no detailed preference audit", async () => {
  const sql = await read(migrationPath);
  const preferenceBlock = sql.slice(
    sql.indexOf("create function app_private.api_fanbus_user_preference_set"),
    sql.indexOf("-- Preserve the complete current M010/M330 snapshot")
  );
  assert.doesNotMatch(preferenceBlock, /FANBUS_USER_PREFERENCE_SET/);
  assert.doesNotMatch(preferenceBlock, /FANBUS_USER_PREFERENCE_DELETED/);
  assert.match(sql, /FANBUS_TRIP_SETTINGS_UPDATED/);
  assert.match(sql, /FANBUS_TRIP_DEFAULT_BOARDING_STOP_CLEARED/);
  assert.match(sql, /FANBUS_BUS_PREFERENCE_AUTO_DISABLED/);
});

test("one central resolver implements explicit, personal-or-companion, trip and none", async () => {
  const sql = await read(migrationPath);
  const resolver = sql.slice(
    sql.indexOf("create function app_private.fanbus_resolve_trip_boarding_stop"),
    sql.indexOf("create function app_private.api_fanbus_user_preference_get")
  );
  assert.match(resolver, /p_explicit_trip_boarding_stop_id[\s\S]*'MANUAL'/);
  assert.match(resolver, /p_preferred_boarding_stop_id[\s\S]*p_preferred_source/);
  assert.match(resolver, /trip\.default_boarding_stop_id[\s\S]*'TRIP'/);
  assert.match(resolver, /null::uuid, 'NONE'/);
  assert.match(resolver, /trip_stop\.trip_id = p_trip_id[\s\S]*trip_stop\.is_active/);
  assert.ok((sql.match(/fanbus_resolve_trip_boarding_stop\(/g) || []).length >= 6);
});

test("registration resolver never reads a linked user's preference", async () => {
  const sql = await read(migrationPath);
  const trigger = sql.slice(
    sql.indexOf("create or replace function app_private.m325_registration_before_insert"),
    sql.indexOf("alter function app_private.api_fanbus_companion_duplicate_preview")
  );
  assert.match(trigger, /companion\.default_boarding_stop_id/);
  assert.match(trigger, /new\.source = 'PORTAL'[\s\S]*new\.booking_role = 'PRIMARY'[\s\S]*preference\.user_id = new\.created_by/);
  const linkedBranch = trigger.slice(
    trigger.indexOf("if v_linked_portal_user_id is not null"),
    trigger.indexOf("elsif new.source = 'PORTAL'")
  );
  assert.doesNotMatch(linkedBranch, /fanbus_user_preferences/);
  assert.match(trigger, /fanbus_resolve_trip_boarding_stop\([\s\S]*v_stop_id[\s\S]*v_preferred_stop_id/);
});

test("trip default and stop lifecycle preserve CAS, M330 and non-relevant edits", async () => {
  const sql = await read(migrationPath);
  const tripUpdate = sql.slice(
    sql.indexOf("create or replace function app_private.api_fanbus_trip_update"),
    sql.indexOf("-- Single insertion-time boarding resolver")
  );
  assert.match(tripUpdate, /require_capability\('fanbus\.manage'\)/);
  assert.match(tripUpdate, /m330_lock_mutable_fanbus_trip/);
  assert.match(tripUpdate, /api_fanbus_trip_update_before_m330_r1/);
  assert.match(tripUpdate, /boarding_stop_id = v_default_stop[\s\S]*trip_stop\.is_active/);
  assert.match(tripUpdate, /p_payload - 'defaultBoardingStopId' - 'busPreferenceEnabled'/);
  const lifecycle = sql.slice(
    sql.indexOf("create or replace function app_private.api_fanbus_trip_boarding_stop_upsert"),
    sql.indexOf("-- M320 AUTO_RESET_FALSE")
  );
  assert.match(lifecycle, /v_new_active is false[\s\S]*v_new_master_stop is distinct from v_before\.boarding_stop_id/);
  assert.match(lifecycle, /default_boarding_stop_id = null[\s\S]*revision = revision \+ 1[\s\S]*updated_by = v_actor/);
  assert.doesNotMatch(lifecycle.slice(lifecycle.indexOf("if v_before.id")), /departure_at|trip_note|position/);
});

test("public and portal UIs consume server-resolved defaults without UUID copy", async () => {
  const [sql, ui, html] = await Promise.all([
    read(migrationPath),
    read("js/fanbus-registration.js"),
    read("fanbus-anmeldung.html")
  ]);
  for (const field of ["defaultTripBoardingStopId", "effectiveTripBoardingStopId", "effectiveSource"]) {
    assert.match(sql, new RegExp(field));
  }
  assert.match(ui, /fanbus_user_preference_get/);
  assert.match(ui, /fanbus_user_preference_set/);
  assert.match(ui, /fanbus_user_preference_delete/);
  assert.match(ui, /Persönlicher Standard-Zustieg/);
  assert.match(ui, /trip\?\.defaultTripBoardingStopId/);
  assert.match(ui, /stop\.label} · \$\{formatBerlinTime\(stop\.departureAt\)}/);
  assert.match(html, /m325UserBoardingPreference/);
  assert.doesNotMatch(html, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
});

test("trip-stop writes refresh the shared trip snapshot before reuse", async () => {
  const admin = await read("js/modules/fanbuses.js");
  const refresh = admin.slice(
    admin.indexOf("async function refreshTripSnapshot"),
    admin.indexOf("function bindStopReorder")
  );
  assert.match(refresh, /call\("fanbus_trips_list"\)/);
  assert.match(refresh, /snapshot = nextSnapshot \|\| \{ trips: \[\] \}/);
  assert.match(refresh, /render\(\)/);
  assert.match(refresh, /trips\(\)\.find\(item => item\.id === tripId\)/);
  assert.ok((admin.match(/await refreshTripSnapshot\(trip\.id\)/g) || []).length >= 2);
});

test("manual portal boarding choice survives preference save and delete", async () => {
  const ui = await read("js/fanbus-registration.js");
  assert.match(ui, /let portalBoardingStopTouched = false/);
  assert.match(ui, /namedItem\("boardingStopId"\)\?\.addEventListener\("change", \(\) => \{\s*portalBoardingStopTouched = true/);
  const applyPreference = ui.slice(
    ui.indexOf("function applyPortalBoardingPreference"),
    ui.indexOf("function renderUserBoardingPreference")
  );
  assert.match(applyPreference, /if \(!select \|\| portalBoardingStopTouched\) return/);
  assert.ok((ui.match(/applyPortalBoardingPreference\(\)/g) || []).length >= 4);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const migrationPath = "supabase/migrations/20260822074900_add_joint_fanbus_preferences_and_bus_control.sql";

test("M320-R2 adds one false-by-default trip flag and no new category", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /add column bus_preference_enabled boolean not null default false/);
  assert.doesNotMatch(sql, /create table[^;]*(?:bus_preference|category)/i);
  assert.doesNotMatch(sql, /'NORMAL'[^\n]*allowedBusPreferences/);
  assert.doesNotMatch(sql, /create table[^;]*(?:assignment_rule|automatic_assignment)/i);
});

test("central effective resolver requires flag, two buses, PARTY and RUHIG", async () => {
  const sql = await read(migrationPath);
  const resolver = sql.slice(
    sql.indexOf("create function app_private.fanbus_bus_preference_selection_enabled"),
    sql.indexOf("create function app_private.fanbus_allowed_bus_preferences")
  );
  assert.match(resolver, /trip\.bus_preference_enabled/);
  assert.match(resolver, /count\(\*\) filter \(where bus\.is_active\) >= 2/);
  assert.match(resolver, /bus\.category = 'PARTY'/);
  assert.match(resolver, /bus\.category = 'RUHIG'/);
  assert.match(sql, /\["EGAL", "RUHIG", "PARTY"\]/);
  assert.match(sql, /else '\[\]'::jsonb/);
});

test("new registration input stays validated and effective storage is fail-closed EGAL", async () => {
  const sql = await read(migrationPath);
  const trigger = sql.slice(
    sql.indexOf("create or replace function app_private.m325_registration_before_insert"),
    sql.indexOf("alter function app_private.api_fanbus_companion_duplicate_preview")
  );
  assert.match(trigger, /new\.bus_preference not in \('EGAL', 'RUHIG', 'PARTY'\)/);
  assert.match(trigger, /not app_private\.fanbus_bus_preference_selection_enabled\(new\.trip_id\)[\s\S]*new\.bus_preference := 'EGAL'/);
  assert.match(trigger, /before the[\s\S]*shared insert used by ACTIVE and WAITLISTED/i);
  assert.doesNotMatch(sql, /update app_modules\.fanbus_registrations[\s\S]*bus_preference = 'EGAL'/);
});

test("idempotency remains based on request and is not rebuilt from trip configuration", async () => {
  const sql = await read(migrationPath);
  assert.doesNotMatch(sql, /request_hash[\s\S]{0,300}bus_preference_enabled/);
  assert.doesNotMatch(sql, /request_hash[\s\S]{0,300}fanbus_buses/);
  assert.match(sql, /existing booking core has already hashed and validated the requested/i);
  assert.doesNotMatch(sql, /update app_private\.fanbus_registration_idempotency[\s\S]*request_hash/);
});

test("AUTO_RESET_FALSE mutates the trip after a successful existing bus mutation", async () => {
  const sql = await read(migrationPath);
  const block = sql.slice(
    sql.indexOf("create or replace function app_private.api_fanbus_bus_upsert"),
    sql.indexOf("alter function public.pd_api")
  );
  assert.match(block, /require_capability\('fanbus\.manage'\)/);
  assert.match(block, /m330_lock_mutable_fanbus_trip/);
  assert.ok(block.indexOf("api_fanbus_bus_upsert_before_m330_r1") < block.indexOf("bus_preference_enabled = false"));
  assert.match(block, /bus_preference_enabled = false[\s\S]*revision = revision \+ 1[\s\S]*updated_by = v_actor/);
  assert.match(block, /FANBUS_BUS_PREFERENCE_AUTO_DISABLED/);
  assert.match(block, /AUTO_RESET_FALSE/);
  assert.doesNotMatch(block, /raise exception[^;]*(?:PARTY|RUHIG)/i);
});

test("enabling true is server validated and snapshots expose no topology", async () => {
  const sql = await read(migrationPath);
  const update = sql.slice(
    sql.indexOf("create or replace function app_private.api_fanbus_trip_update"),
    sql.indexOf("-- Single insertion-time boarding resolver")
  );
  assert.match(update, /FANBUS_BUS_PREFERENCE_STRUCTURE_INVALID/);
  assert.match(update, /count\(\*\)[\s\S]*is_active[\s\S]*>= 2/);
  assert.match(update, /category = 'PARTY'/);
  assert.match(update, /category = 'RUHIG'/);
  for (const field of ["busPreferenceEnabled", "busPreferenceSelectionEnabled", "allowedBusPreferences"]) {
    assert.match(sql, new RegExp(field));
  }
  const publicBlock = sql.slice(
    sql.indexOf("-- Public projections"),
    sql.indexOf("-- Existing trip-update API")
  );
  assert.doesNotMatch(publicBlock, /'buses'|'category'|'activeBusCount'/);
});

test("public and manual new-registration UIs hide disabled choices and send EGAL", async () => {
  const [registration, admin, html] = await Promise.all([
    read("js/fanbus-registration.js"),
    read("js/modules/fanbuses.js"),
    read("fanbus-anmeldung.html")
  ]);
  assert.match(registration, /function busPreferenceSelectionEnabled/);
  assert.match(registration, /field\.hidden = !enabled/);
  assert.match(registration, /select\.value = "EGAL"/);
  assert.match(registration, /busPreferenceSelectionEnabled\(\)[\s\S]*: "EGAL"/);
  assert.match(registration, /\["EGAL", "RUHIG", "PARTY"\]/);
  assert.match(admin, /trip\.busPreferenceSelectionEnabled[\s\S]*Buswunsch/);
  assert.match(admin, /trip\.busPreferenceSelectionEnabled[\s\S]*person\.busPreference \|\| "EGAL"[\s\S]*: "EGAL"/);
  assert.match(admin, /busPreferenceEnabled/);
  assert.match(html, /data-m320-bus-preference="portal"/);
  assert.match(html, /data-m320-bus-preference="guest"/);
});

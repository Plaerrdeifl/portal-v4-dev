import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath =
  "supabase/migrations/20260823084306_consolidate_pd_api_and_targeted_indexes_m900_r1_f4.sql";

function functionBlock(sql, signature, nextMarker) {
  const start = sql.indexOf(signature);
  const end = sql.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, "Missing function block: " + signature);
  return sql.slice(start, end);
}

test("F4 exposes one current 119-action dispatch without historical runtime traversal", async () => {
  const sql = await read(migrationPath);
  const inventory = functionBlock(
    sql,
    "create function app_private.pd_api_current_actions()",
    "create function app_private.pd_api_dispatch_current"
  );
  const dispatcher = functionBlock(
    sql,
    "create function app_private.pd_api_dispatch_current",
    "create or replace function public.pd_api"
  );
  const publicApi = functionBlock(
    sql,
    "create or replace function public.pd_api",
    "revoke all on function"
  );
  const inventoryActions = [
    ...inventory.matchAll(/^\s*'([a-z0-9_]+)'[,]?$/gm)
  ].map(match => match[1]);

  assert.equal(inventoryActions.length, 119);
  assert.equal(new Set(inventoryActions).size, 119);
  for (const action of inventoryActions) {
    assert.match(dispatcher, new RegExp("'" + action + "'"), action);
  }
  assert.doesNotMatch(dispatcher, /pd_api_before_|pd_api_core_before_/);
  assert.doesNotMatch(publicApi, /pd_api_before_|pd_api_core_before_/);
  assert.match(publicApi, /platform_action_classification[\s\S]*require_platform_user_write_allowed[\s\S]*pd_api_dispatch_current/);
  assert.match(publicApi, /require_platform_user_write_allowed\([\s\S]*v_action,[\s\S]*auth\.uid\(\)/);
  assert.match(dispatcher, /p_action = 'saveDashboardPreferences'/);
  assert.match(dispatcher, /Unbekannte Portalaktion:[\s\S]*errcode = '22023'/);
});

test("F4 keeps the reviewed 29 READ and 90 USER_MUTATION classification", async () => {
  const [f4, core] = await Promise.all([
    read(migrationPath),
    read("supabase/migrations/20260823002244_add_platform_mode_core_m900_r1.sql")
  ]);
  const inventory = functionBlock(
    f4,
    "create function app_private.pd_api_current_actions()",
    "create function app_private.pd_api_dispatch_current"
  );
  const inventoryActions = new Set([
    ...inventory.matchAll(/^\s*'([a-z0-9_]+)'[,]?$/gm)
  ].map(match => match[1]));
  const readArray = core.match(
    /platform_action_classification[\s\S]+?= any \(array\[([\s\S]+?)\]::text\[\]\)/
  )?.[1] || "";
  const readActions = [...readArray.matchAll(/'([a-z0-9_]+)'/g)]
    .map(match => match[1]);

  assert.equal(readActions.length, 29);
  assert.ok(readActions.every(action => inventoryActions.has(action)));
  assert.equal(inventoryActions.size - readActions.length, 90);
});

test("F4 preserves dashboard and authenticated public-stop response semantics", async () => {
  const sql = await read(migrationPath);
  const dispatcher = functionBlock(
    sql,
    "create function app_private.pd_api_dispatch_current",
    "create or replace function public.pd_api"
  );

  assert.match(dispatcher, /v_data := app_private\.api_dashboard\(\)/);
  assert.match(dispatcher, /p_action = 'dashboard'[\s\S]*\{preferences\}[\s\S]*api_dashboard_preferences/);
  assert.match(dispatcher, /fanbus_trip_boarding_stops_public[\s\S]*require_active_user/);
  assert.match(dispatcher, /pd_public_fanbus_trip_boarding_stops\(v_trip_id\)/);
  assert.match(dispatcher, /FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD/);
});

test("F4 retains exact grants and adds only evidence-backed structural indexes", async () => {
  const sql = await read(migrationPath);

  assert.match(sql, /grant execute on function public\.pd_api\(text, jsonb\)\s+to authenticated/);
  assert.match(sql, /pd_api_dispatch_current\(text, jsonb\)[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /pd_api_before_events_r1[\s\S]*pd_api_core_before_dashboard_widgets_r1[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /primary key \(source_type, source_key, external_uid\)/);
  assert.match(sql, /create index fanbus_bookings_trip_id_idx[\s\S]*fanbus_bookings\(trip_id\)/);
  assert.doesNotMatch(sql, /drop index/i);
  assert.doesNotMatch(sql, /execute\s+format|execute\s+immediate/i);
});

test("M900 completion documentation records architecture, performance and debt boundaries", async () => {
  const doc = await read("docs/P900_M900_R1_TECHNICAL_COMPLETION.md");
  for (const phrase of [
    "Current pd_api Dispatch",
    "Platform Mode Contract",
    "Public RPC Matrix",
    "Grant Matrix",
    "Audit Policy",
    "Performance Decisions",
    "Remaining Technical Debt",
    "DEV Deployment Runbook",
    "PROD-R4 Prerequisites"
  ]) {
    assert.match(doc, new RegExp(phrase));
  }
  assert.match(doc, /119 normalized actions/);
  assert.match(doc, /29 READ and 90 USER_MUTATION/);
  assert.match(doc, /PROD remains out of scope/);
});

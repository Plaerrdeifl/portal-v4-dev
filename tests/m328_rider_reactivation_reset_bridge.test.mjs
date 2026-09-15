import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

const foldedPath =
  "supabase/migrations/20260829090000_m328_r1_booking_management.sql";
const bridgePath =
  "supabase/migrations/20260829161959_m328_rider_reactivation_reset_bridge.sql";
const standalonePath =
  "supabase/migrations/20260829162000_m328_r1_regular_rider_reactivate.sql";

const [folded, bridge, standalone] = await Promise.all([
  read(foldedPath),
  read(bridgePath),
  read(standalonePath)
]);

test("M328 rider reactivation was folded as an identical standalone contract", () => {
  const marker = "begin;\n\ncreate function app_private.api_fanbus_regular_rider_activate";
  const foldedContract = folded.slice(folded.lastIndexOf(marker)).trim();
  const standaloneContract = standalone.slice(standalone.indexOf("begin;")).trim();

  assert.ok(foldedContract, "folded rider-reactivation contract is missing");
  assert.equal(foldedContract, standaloneContract);
});

test("M328 reset bridge is ordered before the duplicate standalone migration", () => {
  assert.ok(foldedPath < bridgePath);
  assert.ok(bridgePath < standalonePath);
});

test("M328 reset bridge preserves applied databases and fails closed", () => {
  assert.match(
    bridge,
    /supabase_migrations\.schema_migrations[\s\S]*version = '20260829162000'/
  );
  assert.match(bridge, /if v_standalone_applied then[\s\S]*return;/);
  assert.match(
    bridge,
    /M328_R1_RIDER_REACTIVATION_RESET_BRIDGE_UNEXPECTED_STATE/
  );
  assert.doesNotMatch(
    bridge,
    /(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?app_(?:portal|fanclub|modules)\./i
  );
});

test("M328 reset bridge unwraps only the five duplicated function objects", () => {
  for (const signature of [
    "app_private.api_fanbus_regular_rider_activate(jsonb)",
    "app_private.pd_api_current_actions()",
    "app_private.pd_api_current_actions_before_m328_r1_rider_reactivate()",
    "app_private.pd_api_dispatch_current(text,jsonb)",
    "app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text,jsonb)"
  ]) {
    assert.match(bridge, new RegExp(signature.replace(/[().]/g, "\\$&")));
  }

  assert.equal((bridge.match(/execute 'drop function/g) || []).length, 3);
  assert.equal((bridge.match(/execute 'alter function/g) || []).length, 2);
  assert.doesNotMatch(bridge, /create (?:or replace )?function/i);
});

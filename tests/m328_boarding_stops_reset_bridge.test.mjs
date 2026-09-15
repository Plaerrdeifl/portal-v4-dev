import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

const schemaPath =
  "supabase/migrations/20260814130000_add_fanbus_operations_m325_r1.sql";
const bridgePath =
  "supabase/migrations/20260829225222_m328_canonical_boarding_stops_reset_bridge.sql";
const targetPath =
  "supabase/migrations/20260829225223_m328_fanbus_draft_defaults.sql";

const [schema, bridge, target] = await Promise.all([
  read(schemaPath),
  read(bridgePath),
  read(targetPath)
]);

test("M328 canonical-stop bridge precedes the dependent migration", () => {
  assert.ok(schemaPath < bridgePath);
  assert.ok(bridgePath < targetPath);
  assert.match(target, /lower\(btrim\(stop\.label\)\) = 'icedome'/);
  assert.match(target, /lower\(btrim\(stop\.label\)\) = 'pendlerparkplatz'/);
});

test("boarding-stop schema and bridge use the established creation defaults", () => {
  assert.match(schema, /id uuid primary key default extensions\.gen_random_uuid\(\)/);
  assert.match(schema, /position integer not null check \(position > 0\)/);
  assert.match(schema, /is_active boolean not null default true/);
  assert.match(schema, /revision integer not null default 1 check \(revision > 0\)/);
  assert.match(schema, /fanbus_boarding_stops_position_uidx/);
  assert.match(
    schema,
    /select coalesce\(max\(position\),0\)\+1 into v_position from app_modules\.fanbus_boarding_stops/
  );
  assert.match(bridge, /select coalesce\(max\(stop\.position\), 0\) \+ 1/);
});

test("already migrated operational databases are an explicit no-op", () => {
  assert.match(
    bridge,
    /supabase_migrations\.schema_migrations[\s\S]*version = '20260829225223'/
  );
  assert.match(bridge, /if v_target_applied then[\s\S]*return;/);
});

test("fresh chains add only missing canonical active stops", () => {
  assert.match(bridge, /if v_icedome_total = 0 then[\s\S]*'Icedome'/);
  assert.match(bridge, /if v_pendler_total = 0 then[\s\S]*'Pendlerparkplatz'/);
  assert.equal(
    (bridge.match(/insert into app_modules\.fanbus_boarding_stops/g) || []).length,
    2
  );
  assert.doesNotMatch(
    bridge,
    /(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?(?:auth|app_portal|app_fanclub)\./i
  );
  assert.doesNotMatch(
    bridge,
    /(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?app_modules\.(?!fanbus_boarding_stops\b)/i
  );
});

test("inactive or ambiguous canonical-stop states fail closed", () => {
  assert.match(bridge, /v_icedome_total > 1/);
  assert.match(bridge, /v_icedome_total = 1 and v_icedome_active <> 1/);
  assert.match(bridge, /v_pendler_total > 1/);
  assert.match(bridge, /v_pendler_total = 1 and v_pendler_active <> 1/);
  assert.match(
    bridge,
    /M328_CANONICAL_BOARDING_STOPS_RESET_BRIDGE_UNEXPECTED_STATE/
  );
  assert.doesNotMatch(bridge, /update app_modules\.fanbus_boarding_stops/i);
  assert.doesNotMatch(bridge, /on conflict/i);
});

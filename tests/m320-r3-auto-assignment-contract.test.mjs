import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260827203217_m320_r3_auto_bus_assignment.sql";
const fixPath = "supabase/migrations/20260827203255_m320_r3_planner_greatest_fix.sql";
const uiPath = "js/modules/m320-r3-auto-assignment.js";

test("M320-R3 freezes assignment origin to exactly MANUAL or AUTO", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /add column assignment_source text not null default 'MANUAL'/i);
  assert.match(migration, /assignment_source in \('MANUAL','AUTO'\)/i);
  assert.match(migration, /assignment_source='MANUAL'/i);
  assert.match(migration, /'assignmentSource','MANUAL'/i);
  assert.match(
    migration,
    /v_source:=case when v_bus_id is not distinct from v_proposed_bus_id then 'AUTO' else 'MANUAL' end/i
  );
});

test("M320-R3 exposes preview as READ and apply as USER_MUTATION only through pd_api routing", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /array\['fanbus_assignment_preview','fanbus_assignment_apply'\]/);
  assert.match(migration, /when 'fanbus_assignment_preview' then 'READ'/);
  assert.match(migration, /when 'fanbus_assignment_apply' then 'USER_MUTATION'/);
  assert.match(migration, /when 'fanbus_assignment_preview' then return app_private\.api_fanbus_assignment_preview/);
  assert.match(migration, /when 'fanbus_assignment_apply' then return app_private\.api_fanbus_assignment_apply/);
  assert.match(
    migration,
    /revoke all on function[\s\S]*app_private\.api_fanbus_assignment_preview\(jsonb\)[\s\S]*app_private\.api_fanbus_assignment_apply\(jsonb\)[\s\S]*from public,anon,authenticated,service_role/
  );
});

test("M320-R3 preview is a pure planner/fingerprint response while apply locks and rejects stale input", async () => {
  const migration = await read(migrationPath);
  const previewStart = migration.indexOf("create function app_private.api_fanbus_assignment_preview");
  const applyStart = migration.indexOf("create function app_private.api_fanbus_assignment_apply");
  const preview = migration.slice(previewStart, applyStart);
  const apply = migration.slice(applyStart);

  assert.match(preview, /m320_r3_assignment_plan\(v_trip_id\)/);
  assert.match(preview, /m320_r3_assignment_fingerprint\(v_trip_id\)/);
  assert.doesNotMatch(preview, /\binsert\s+into\b/i);
  assert.doesNotMatch(preview, /\bupdate\s+app_modules\b/i);
  assert.doesNotMatch(preview, /\bdelete\s+from\b/i);
  assert.doesNotMatch(preview, /log_audit/i);

  assert.match(apply, /m330_lock_mutable_fanbus_trip\(v_trip_id\)/);
  assert.match(apply, /FANBUS_ASSIGNMENT_PREVIEW_STALE/);
  assert.match(apply, /errcode='40001'/);
  assert.match(apply, /m320_r3_assignment_fingerprint\(v_trip_id\)/);
  assert.match(apply, /m320_r3_assignment_plan\(v_trip_id\)/);
  assert.match(apply, /FANBUS_BUS_CAPACITY_EXHAUSTED/);
  assert.match(apply, /FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP/);
});

test("M320-R3 apply does not accept assignment_source from the browser", async () => {
  const migration = await read(migrationPath);
  const ui = await read(uiPath);

  assert.match(
    migration,
    /key\.name<>all\(array\['tripId','algorithmVersion','inputFingerprint','finalAssignments'\]\)/
  );
  assert.match(
    migration,
    /key\.name<>all\(array\['participantId','busId'\]\)/
  );
  assert.match(ui, /finalAssignments = editable\.map\(proposal => \(\{[\s\S]*participantId: proposal\.participantId,[\s\S]*busId:/);
  assert.doesNotMatch(ui, /assignmentSource\s*:/);
});

test("M320-R3 R1 only plans currently unassigned ACTIVE participants and protects existing assignments", async () => {
  const migration = await read(migrationPath);

  assert.match(
    migration,
    /participant\.status\s*=\s*'ACTIVE'[\s\S]*?assignment\.participant_id\s+is\s+null/i
  );
  assert.match(migration, /'assignmentState',case when assignment\.assignment_source='MANUAL' then 'FIXED_MANUAL' else 'EXISTING_AUTO' end/);
  assert.match(migration, /'EXISTING_ASSIGNMENT_PROTECTED'/);
  assert.doesNotMatch(migration, /update app_modules\.fanbus_bus_assignments[\s\S]*assignment_source='AUTO'/i);
});

test("M320-R3 fingerprint covers algorithm, trip, buses, participants, assignments and stop topology", async () => {
  const migration = await read(migrationPath);

  for (const token of [
    "algorithmVersion",
    "busPreferenceEnabled",
    "participantSequence",
    "busPreference",
    "tripBoardingStopId",
    "assignmentSource",
    "tripStops",
    "busStopMappings",
    "revision"
  ]) {
    assert.match(migration, new RegExp(token));
  }
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /'sha256'/);
});

test("M320-R3 keeps the registered DEV greatest fix as an additive migration", async () => {
  const migration = await read(migrationPath);
  const fix = await read(fixPath);

  assert.match(migration, /pg_catalog\.greatest/);
  assert.match(fix, /pg_catalog\.pg_get_functiondef/);
  assert.match(fix, /pg_catalog\.replace/);
  assert.match(fix, /'pg_catalog\.greatest'/);
  assert.match(fix, /'greatest'/);
});

test("M320-R3 UI is mobile-first and keeps existing MANUAL/AUTO assignments non-editable", async () => {
  const index = await read("index.html");
  const ui = await read(uiPath);

  assert.equal(
    index.match(/js\/modules\/m320-r3-auto-assignment\.js/g)?.length,
    1
  );
  assert.match(ui, /proposal\.assignmentState === "PROPOSED_AUTO"/);
  assert.match(ui, /FIXED_MANUAL/);
  assert.match(ui, /EXISTING_AUTO/);
  assert.match(ui, /bestehende MANUAL- und AUTO-Zuordnungen werden nicht automatisch verändert/);
  assert.match(ui, /@media\(max-width:620px\)/);
  assert.match(ui, /Daten haben sich geändert\. Bitte Zuordnung neu berechnen\./);
});

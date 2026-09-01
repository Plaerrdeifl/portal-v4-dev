import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = await fs.readFile(
  path.join(
    root,
    "supabase/migrations/20260824222500_m020_access_request_badge_actionability_hotfix.sql"
  ),
  "utf8"
);

test("M020 resolved access requests no longer count as actionable unread badges", () => {
  assert.match(
    migration,
    /elsif v_type = 'access_request' then[\s\S]*from app_portal\.access_requests x[\s\S]*where x\.id = v_id[\s\S]*and x\.status = 'PENDING'/
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /resolved requests cannot keep unread app badges alive/);
  assert.doesNotMatch(migration, /delete\s+from\s+app_portal\.notifications/i);
  assert.doesNotMatch(migration, /update\s+app_portal\.notifications/i);
});

test("M020 hotfix preserves the existing actionability entity allowlist", () => {
  for (const entity of [
    "task",
    "fanbus_registration",
    "fanbus_trip",
    "fanbus_trip_boarding_stop",
    "membership_application",
    "access_request",
    "event",
    "event_import_run"
  ]) {
    assert.ok(migration.includes(`'${entity}'`), `entity missing: ${entity}`);
  }
});

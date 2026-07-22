import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(
  path.join(root, relativePath),
  "utf8"
);

test("account retirement snapshot uses the established portal actor helper", async () => {
  const migration = await read(
    "supabase/migrations/20260722220000_fix_account_retirement_snapshot_actor.sql"
  );

  assert.match(
    migration,
    /create or replace function app_private\.api_fanclub_snapshot\(\)/
  );
  assert.match(
    migration,
    /app_private\.require_capability\('members\.read'\)/
  );
  assert.match(
    migration,
    /app_private\.api_fanclub_snapshot_before_account_retirement\(\)/
  );
  assert.match(
    migration,
    /app_private\.has_capability\(v_actor, 'portal\.admin'\)/
  );
  assert.match(migration, /account\.retired_at is null/);
  assert.match(migration, /report\.status = 'PENDING'/);
  assert.doesNotMatch(
    migration,
    /current_portal_user_id/
  );
});

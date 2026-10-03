import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20261003212719_reduce_edge_function_idle_quota.sql";
const migration = await fs.readFile(path.join(root, migrationPath), "utf8");

test("notification dispatch skips Edge invocation without delivery or recovery work", () => {
  assert.match(
    migration,
    /create or replace function app_private\.notification_dispatch_has_work\(\)/i
  );
  assert.match(
    migration,
    /event\.status in \('PENDING', 'PROCESSING'\)[\s\S]*event\.next_attempt_at <= pg_catalog\.now\(\)/i
  );
  assert.match(
    migration,
    /outbox\.status = 'PROCESSING'[\s\S]*outbox\.claim_expires_at <= pg_catalog\.now\(\)/i
  );
  assert.match(
    migration,
    /outbox\.status in \('PENDING', 'RETRY'\)[\s\S]*outbox\.expires_at <= pg_catalog\.now\(\)/i
  );
  assert.match(
    migration,
    /event\.status = 'EXPANDED'[\s\S]*outbox\.status in \('PENDING', 'PROCESSING', 'RETRY'\)/i
  );
  assert.match(
    migration,
    /if not app_private\.notification_dispatch_has_work\(\) then\s+return null;/i
  );
  assert.match(migration, /timeout_milliseconds := 120000/i);
});

test("social render worker work-status RPC covers all four queues and is service-only", () => {
  assert.match(
    migration,
    /create or replace function public\.pd_social_media_render_worker_work_status\(\)/i
  );
  for (const key of ["media", "liveticker", "render", "cloud"]) {
    assert.match(
      migration,
      new RegExp("'" + key + "'\\s*,\\s*exists", "i")
    );
  }
  assert.match(
    migration,
    /revoke all on function public\.pd_social_media_render_worker_work_status\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.pd_social_media_render_worker_work_status\(\)[\s\S]*to postgres, service_role/i
  );
});

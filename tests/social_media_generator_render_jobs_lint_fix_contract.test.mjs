import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927102000_social_media_generator_render_jobs_lint_fix.sql";

test("render-job lint fix keeps retry and completion semantics while using valid LEAST/GREATEST syntax", async () => {
  const sql = await fs.readFile(path.join(root, migrationPath), "utf8");

  assert.match(sql, /create or replace function app_private\.api_social_media_generator_render_retry/i);
  assert.match(sql, /max_attempts = least\(20, job\.attempt_count \+ 3\)/i);
  assert.match(sql, /create or replace function public\.pd_social_media_render_worker_complete/i);
  assert.match(sql, /secs => least\([\s\S]*15 \* greatest\(1, v_job\.attempt_count\)/i);
  assert.doesNotMatch(sql, /pg_catalog\.(?:least|greatest)\(/i);
  assert.match(sql, /to service_role/i);
});

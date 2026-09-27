import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927123500_social_media_generator_render_cloud_phase3.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("cloud delivery has a separate lease queue and retry budget", async () => {
  const sql = await readMigration();

  assert.match(sql, /cloud_attempt_count integer not null default 0/i);
  assert.match(sql, /cloud_max_attempts integer not null default 3/i);
  assert.match(sql, /cloud_claim_token uuid/i);
  assert.match(sql, /cloud_claim_expires_at timestamptz/i);
  assert.match(sql, /create index social_media_render_jobs_cloud_claim_idx/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /cloud_attempt_count = job\.cloud_attempt_count \+ 1/i);
  assert.match(sql, /cloud_claim_expires_at = pg_catalog\.now\(\) \+ interval '10 minutes'/i);
});

test("cloud completion preserves render success and validates Nextcloud download metadata", async () => {
  const sql = await readMigration();
  const complete = sql.match(
    /create function public\.pd_social_media_render_worker_cloud_complete[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(complete, /v_job\.render_status <> 'SUCCEEDED'/i);
  assert.match(complete, /v_nextcloud_path not like '\/Publishing\/%'/i);
  assert.ok(complete.includes("cloud[.]plaerrdeifl[.]de/s/"));
  assert.match(complete, /v_download_url <> v_share_url \|\| '\/download'/i);
  assert.match(complete, /v_sha256 <> coalesce\(v_job\.result_manifest ->> 'sha256'/i);
  assert.match(complete, /set cloud_status = 'SUCCEEDED'/i);
  assert.doesNotMatch(complete, /set render_status = 'SUCCEEDED'/i);
});

test("browser gets an explicit cloud retry action behind pd_api", async () => {
  const sql = await readMigration();

  assert.match(
    sql,
    /create function app_private\.api_social_media_generator_render_cloud_retry/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_render_cloud_retry' then 'WRITE'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_render_cloud_retry' then[\s\S]*api_social_media_generator_render_cloud_retry/i
  );
});

test("cloud worker RPCs remain service-role-only", async () => {
  const sql = await readMigration();

  assert.match(
    sql,
    /revoke all on function[\s\S]*pd_social_media_render_worker_cloud_claim\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    sql,
    /grant execute on function[\s\S]*pd_social_media_render_worker_cloud_complete\(uuid, uuid, boolean, text, jsonb\)[\s\S]*to service_role/i
  );
});

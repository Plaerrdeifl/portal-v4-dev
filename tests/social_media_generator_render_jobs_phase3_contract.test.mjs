import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927100500_social_media_generator_render_jobs_phase3.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("render jobs freeze an exact owned draft version and binding context", async () => {
  const sql = await readMigration();

  assert.match(sql, /create table app_social_media\.render_jobs/i);
  assert.match(sql, /draft_version bigint not null/i);
  assert.match(sql, /document jsonb not null/i);
  assert.match(sql, /binding_context jsonb not null/i);
  assert.match(
    sql,
    /where draft\.id = v_draft_id[\s\S]*draft\.owner_user_id = v_user_id/i
  );
  assert.match(
    sql,
    /if v_draft\.version <> v_expected_version then[\s\S]*SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT/i
  );
  assert.match(
    sql,
    /v_draft\.id,[\s\S]*v_draft\.version,[\s\S]*v_draft\.document,[\s\S]*v_binding_context/i
  );
});

test("render jobs separate render and cloud state", async () => {
  const sql = await readMigration();

  assert.match(
    sql,
    /render_status in \('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'\)/i
  );
  assert.match(
    sql,
    /cloud_status in \('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'\)/i
  );
  assert.match(
    sql,
    /set render_status = 'SUCCEEDED',[\s\S]*cloud_status = 'PENDING'/i
  );
});

test("worker claim uses lease token skip-locked and bounded automatic retries", async () => {
  const sql = await readMigration();
  const claim = sql.match(
    /create function public\.pd_social_media_render_worker_claim\(\)[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(claim, /for update skip locked/i);
  assert.match(claim, /claim_token = v_token/i);
  assert.match(claim, /claim_expires_at = pg_catalog\.now\(\) \+ interval '10 minutes'/i);
  assert.match(claim, /job\.attempt_count < job\.max_attempts/i);
  assert.match(claim, /attempt_count = job\.attempt_count \+ 1/i);
});

test("worker RPCs are service-role-only and browser actions stay behind pd_api", async () => {
  const sql = await readMigration();

  for (const action of [
    "social_media_generator_render_start",
    "social_media_generator_render_get",
    "social_media_generator_render_retry"
  ]) {
    assert.match(sql, new RegExp("when '" + action + "'", "i"));
  }

  assert.match(
    sql,
    /when 'social_media_generator_render_start' then 'WRITE'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_render_get' then 'READ'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_render_retry' then 'WRITE'/i
  );

  assert.match(
    sql,
    /revoke all on function[\s\S]*public\.pd_social_media_render_worker_claim\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    sql,
    /grant execute on function[\s\S]*public\.pd_social_media_render_worker_complete\(uuid, uuid, boolean, text, jsonb\)[\s\S]*to service_role/i
  );
});

test("worker completion validates PNG manifest compatibility and is idempotent", async () => {
  const sql = await readMigration();
  const complete = sql.match(
    /create function public\.pd_social_media_render_worker_complete[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(complete, /mimeType' <> 'image\/png'/i);
  assert.match(complete, /sha256'.*\^\[a-f0-9\]\{64\}\$/is);
  assert.match(complete, /compatibilityVersion/i);
  assert.match(complete, /last_completed_claim_token = p_claim_token/i);
  assert.match(complete, /'idempotent', true/i);
});

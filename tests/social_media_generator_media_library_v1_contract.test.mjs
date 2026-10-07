import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = "supabase/migrations/20260927142436_social_media_generator_media_library_v1.sql";
const edgePath = "supabase/functions/social-media-library/index.ts";
const gatewayPath = "supabase/functions/social-media-render-worker/index.ts";

const read = (file) => fs.readFile(path.join(root, file), "utf8");

test("media library stores immutable metadata and protects private tables", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /create table app_social_media\.media_assets/i);
  assert.match(sql, /create table app_social_media\.media_uploads/i);
  assert.match(sql, /media_type in \('UPLOAD', 'GENERAL', 'BACKGROUND'\)/i);
  assert.match(sql, /status in \('ACTIVE', 'ARCHIVED'\)/i);
  assert.match(sql, /sha256 ~ '\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(sql, /alter table app_social_media\.media_assets enable row level security/i);
  assert.match(sql, /revoke all on table[\s\S]*media_assets[\s\S]*from public, anon, authenticated, service_role/i);
});

test("browser media actions remain behind pd_api and mutations are classified", async () => {
  const sql = await read(migrationPath);
  for (const action of [
    "social_media_generator_media_list",
    "social_media_generator_media_get",
    "social_media_generator_media_asset_authorize",
    "social_media_generator_media_upload_start",
    "social_media_generator_media_upload_get",
    "social_media_generator_media_archive"
  ]) assert.match(sql, new RegExp(action));
  assert.match(sql, /when 'social_media_generator_media_list' then 'READ'/i);
  assert.match(sql, /when 'social_media_generator_media_upload_start' then 'USER_MUTATION'/i);
  assert.match(sql, /when 'social_media_generator_media_archive' then 'USER_MUTATION'/i);
});

test("drafts keep stable media references without persisted href data", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /social_media_generator_library_refs_valid/i);
  assert.match(sql, /element \? 'href'/i);
  assert.match(sql, /mediaRef,sha256/i);
  assert.match(sql, /add column media_manifest jsonb/i);
  assert.match(sql, /social_media_generator_build_media_manifest/i);
  assert.match(sql, /'mediaManifest', v_job\.media_manifest/i);
});

test("upload edge validates raster bytes and uses service-only storage", async () => {
  const edge = await read(edgePath);
  assert.match(edge, /MAX_IMAGE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(edge, /function inspectImage/);
  assert.match(edge, /image\/png/);
  assert.match(edge, /image\/jpeg/);
  assert.match(edge, /image\/webp/);
  assert.doesNotMatch(edge, /image\/svg\+xml/);
  assert.match(edge, /social_media_generator_media_upload_start/);
  assert.match(edge, /pd_social_media_library_upload_queue/);
  assert.match(edge, /social-media-generator-library/);
});

test("render gateway exposes only exact media worker RPCs", async () => {
  const gateway = await read(gatewayPath);
  for (const rpc of [
    "pd_social_media_library_worker_claim",
    "pd_social_media_library_worker_heartbeat",
    "pd_social_media_library_worker_complete"
  ]) assert.match(gateway, new RegExp(rpc));
  assert.match(gateway, /addMediaDownloadUrl/);
  assert.match(gateway, /social-media-generator-library/);
  assert.doesNotMatch(gateway, /body\.rpc|body\.rpcName|body\.function/i);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const edgePath = "supabase/functions/social-media-render-worker/index.ts";
const readEdge = () => fs.readFile(path.join(root, edgePath), "utf8");

test("social-media render gateway uses a dedicated token and exact RPC allowlist", async () => {
  const source = await readEdge();

  assert.match(source, /X-Social-Media-Render-Worker-Token/);
  assert.match(source, /EXPECTED_TOKEN_SHA256_BY_HOST/);
  assert.match(source, /fac0f4a76b1448bcb1e7c1e97b1b7cb2398400133fe44a0d2c81ecde454ef49d/);
  for (const rpc of [
    "pd_social_media_render_worker_claim",
    "pd_social_media_render_worker_heartbeat",
    "pd_social_media_render_worker_complete",
    "pd_social_media_render_worker_cloud_claim",
    "pd_social_media_render_worker_cloud_heartbeat",
    "pd_social_media_render_worker_cloud_complete",
    "pd_social_media_library_worker_claim",
    "pd_social_media_library_worker_heartbeat",
    "pd_social_media_library_worker_complete"
  ]) {
    assert.match(source, new RegExp(rpc));
  }
  assert.doesNotMatch(source, /body\.rpc|body\.rpcName|body\.function/i);
});

test("gateway validates render and cloud success payloads before service-role RPCs", async () => {
  const source = await readEdge();

  assert.match(source, /function isRenderManifest/);
  assert.match(source, /mimeType === "image\/png"/);
  assert.ok(source.includes("social-media-render-worker\\/[0-9]+[.][0-9]+[.][0-9]+"));
  assert.match(source, /function isCloudResult/);
  assert.ok(source.includes("cloud\\.plaerrdeifl\\.de"));
  assert.match(source, /startsWith\("\/Publishing\/"\)/);
  assert.match(source, /authorizedWorkerToken/);
  assert.match(source, /sha256Hex/);
});

test("gateway derives service role only from edge runtime secrets", async () => {
  const source = await readEdge();

  assert.match(source, /Deno\.env\.get\("SUPABASE_SECRET_KEYS"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /Authorization: `Bearer \$\{config\.key\}`/);
  assert.match(source, /signed\.signedURL\.startsWith\("\/object\/sign\/"\)/);
  assert.match(source, /`\/storage\/v1\$\{signed\.signedURL\}`/);
  assert.doesNotMatch(source, /service[_-]?role[^\n]{0,80}VITE_/i);
});

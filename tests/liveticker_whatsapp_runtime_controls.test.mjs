import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("WhatsApp runtime controls fail closed without exposing local WPP", async () => {
  const migration = await read("supabase/migrations/20260917192915_liveticker_whatsapp_runtime_controls_dev_r1.sql");
  const runtime = await read("js/liveticker-runtime-controls.js");
  const html = await read("liveticker/index.html");
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");
  const gateway = await read("supabase/functions/liveticker-whatsapp-worker/index.ts");

  assert.match(migration, /perform app_private\.worker_runtime_assert_ready\('LIVETICKER_WHATSAPP'\)/);
  assert.match(migration, /raise exception 'LIVETICKER_WPP_DISABLED'/);
  assert.match(migration, /raise exception 'LIVETICKER_WPP_NOT_READY'/);
  assert.match(migration, /api_liveticker_whatsapp_sticker_enqueue_before_runtime_control_r1/);
  assert.match(migration, /api_liveticker_whatsapp_delivery_enqueue_before_runtime_control_r1/);
  assert.match(migration, /api_liveticker_whatsapp_delivery_retry_before_runtime_control_r1/);
  assert.match(migration, /grant execute on function public\.pd_liveticker_wpp_runtime_control\(text, text\) to service_role/);
  assert.match(migration, /grant execute on function public\.pd_liveticker_whatsapp_worker_can_claim\(\) to service_role/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*pd_liveticker_wpp_runtime_control[\s\S]*to authenticated/i);

  assert.match(runtime, /api\.call\("liveticker_wpp_runtime_status", \{\}\)/);
  assert.doesNotMatch(runtime, /api\.call\("liveticker_wpp_runtime_set"/);
  assert.match(runtime, /const WPP_CONTROL_OWNER = false/);
  assert.match(runtime, /wpp\.toggle\.disabled = true/);
  assert.match(runtime, /wpp\.toggle\.textContent = WPP_CONTROL_OWNER \? "…" : "Nur PROD"/);
  assert.doesNotMatch(runtime, /127\.0\.0\.1:3001|WAHA_API_KEY|\/api\/sessions/);
  assert.doesNotMatch(html, /127\.0\.0\.1:3001|WAHA_API_KEY/);

  assert.match(worker, /WAHA_BASE_URL \|\| "http:\/\/127\.0\.0\.1:3001"/);
  assert.match(worker, /if \(!workerEnabled \|\| !wppDesiredConnected \|\| wppState !== "CONNECTED"\) return/);
  assert.match(gateway, /if \(!isObject\(gate\) \|\| gate\.ready !== true\) return \{ claimed: false, blocked: true \}/);

  assert.match(runtime, /Promise\.allSettled/);
  assert.match(runtime, /STATUS_FAILURE_THRESHOLD = 3/);
  assert.match(runtime, /TRANSITION_REFRESH_MS = 1000/);
  assert.match(runtime, /closeStatusControl\(wa\.control\)/);
  assert.match(runtime, /Steuerung erfolgt zentral über PROD/);
  assert.match(worker, /lastWppActionTarget === desiredConnected/);
  assert.match(worker, /lastWppActionTarget = desiredConnected/);
  assert.match(worker, /WPP_CONTROL_OWNER/);
  assert.match(worker, /wppDesiredConnected = WPP_CONTROL_OWNER \? requestedConnected : true/);
  assert.match(worker, /WPP_CONTROL_OWNER[\s\S]*\? await applyWppDesiredState/);
  assert.match(worker, /wppControlOwner: WPP_CONTROL_OWNER/);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("database broadcasts content-free Liveticker worker wake signals", async () => {
  const migration = await read(
    "supabase/migrations/20260925055302_liveticker_workers_realtime_wake_r1.sql"
  );

  assert.match(migration, /realtime\.send\([\s\S]*'liveticker-graphic-jobs'[\s\S]*false/);
  assert.match(migration, /realtime\.send\([\s\S]*'liveticker-whatsapp-jobs'[\s\S]*false/);
  assert.match(migration, /jsonb_build_object\('availableAt', new\.available_at\)/);
  assert.match(migration, /jsonb_build_object\('availableAt', new\.next_attempt_at\)/);
  assert.match(migration, /after insert or update of status, available_at/);
  assert.match(migration, /after insert or update of status, next_attempt_at/);
  assert.match(migration, /after update of enabled/);
  assert.match(migration, /after update of desired_connected/);
  assert.doesNotMatch(migration, /request_snapshot|message|sticker_id|claim_token/);
});

test("Liveticker readiness covers the bounded recovery interval without changing other workers", async () => {
  const migration = await read(
    "supabase/migrations/20260925062810_liveticker_worker_readiness_window_r1.sql"
  );

  assert.match(migration, /'LIVETICKER_GRAPHICS', 'LIVETICKER_WHATSAPP'/);
  assert.match(migration, /then interval '5 minutes'/);
  assert.match(migration, /else interval '90 seconds'/);
  assert.match(migration, /create or replace function app_private\.worker_runtime_status_internal/);
  assert.match(migration, /'activePollSeconds', 5/);
  assert.match(migration, /'disabledPollSeconds', 60/);
});

test("WPP readiness covers the two-minute recovery cadence and still fails closed", async () => {
  const migration = await read(
    "supabase/migrations/20260925110000_liveticker_wpp_readiness_window_r1.sql"
  );

  assert.match(migration, /create or replace function app_private\.liveticker_wpp_runtime_status_internal/);
  assert.match(migration, /create or replace function public\.pd_liveticker_whatsapp_worker_can_claim/);
  assert.match(migration, /v_worker_ready boolean := app_private\.worker_runtime_is_ready\('LIVETICKER_WHATSAPP'\)/);
  assert.match(migration, /last_seen_at >= v_wpp\.updated_at/);
  assert.match(migration, /interval '5 minutes'/);
  assert.match(migration, /'ready', v_worker_ready and v_wpp_ready/);
  assert.doesNotMatch(migration, /interval '20 seconds'/);
});

test("DEV graphic manifests accept the current Publishing root and legacy Liveticker paths", async () => {
  const migration = await read(
    "supabase/migrations/20260925063500_liveticker_graphic_manifest_publishing_root_r1.sql"
  );

  assert.match(migration, /v_path like '\/Publishing\/%'/);
  assert.match(migration, /v_path like '\/Liveticker\/%'/);
  assert.match(migration, /v_path like '%\.\.%'/);
  assert.ok(
    migration.includes("if v_share !~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}$'")
  );
  assert.match(migration, /v_download <> \(v_share \|\| '\/download'\)/);
});

test("publishing worker is Realtime-first with bounded recovery and atomic gateway claims", async () => {
  const [worker, realtime, gateway, deploy] = await Promise.all([
    read("workers/liveticker-publishing/publishing_worker_dev.py"),
    read("workers/liveticker-publishing/realtime_wake.py"),
    read("supabase/functions/liveticker-publishing-worker/index.ts"),
    read("workers/liveticker-publishing/deploy-dev.sh")
  ]);

  assert.match(worker, /RECOVERY_SECONDS = 120/);
  assert.match(worker, /DEV_REALTIME_TOPIC = 'liveticker-graphic-jobs'/);
  assert.match(worker, /while run_once_dev\(\):/);
  assert.match(worker, /control = control_dev\(\)/);
  assert.doesNotMatch(worker, /time\.sleep\(sleep_seconds\)|sleep_seconds = 5/);
  assert.match(realtime, /HEARTBEAT_SECONDS = 20/);
  assert.match(realtime, /RECONNECT_DELAYS_SECONDS = \(1, 2, 5, 10, 30\)/);
  assert.match(realtime, /message\.get\("event"\) == "broadcast"/);
  assert.match(realtime, /broadcast\.get\("event"\) == "wake"/);
  assert.match(gateway, /pd_liveticker_graphic_worker_claim/);
  assert.match(deploy, /realtime_publishable_key/);
  assert.match(deploy, /Service was NOT restarted/);
});

test("WhatsApp worker couples control checks to wakes and keeps two-minute recovery", async () => {
  const [worker, env] = await Promise.all([
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("workers/liveticker-whatsapp/liveticker-whatsapp-worker.env.example")
  ]);

  assert.match(worker, /RECOVERY_INTERVAL_MS[^\n]*"120000"/);
  assert.match(worker, /scheduleQueueWake\("realtime_join"\)/);
  assert.match(worker, /realtimeAvailableDelay\(message\.payload\?\.payload\)/);
  assert.match(worker, /const ready = await refreshRuntimeControl\(reason\)/);
  assert.match(worker, /setInterval\(\(\) => scheduleQueueWake\("recovery_poll"\), RECOVERY_INTERVAL_MS\)/);
  assert.match(worker, /WPP_TRANSITION_CHECK_MS = 15000/);
  assert.doesNotMatch(worker, /RUNTIME_CONTROL_INTERVAL_MS|POLL_INTERVAL_MS/);
  assert.match(env, /RECOVERY_INTERVAL_MS=120000/);
  assert.doesNotMatch(env, /POLL_INTERVAL_MS/);
});

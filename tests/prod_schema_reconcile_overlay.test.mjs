import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("PROD multichannel recovery source preserves routing and per-channel targets", async () => {
  const sql = await read("supabase/prod-overlays/20260917222446_liveticker_whatsapp_multichannel_prod_r1.sql");
  assert.match(sql, /PROD only: multi-channel routing/);
  assert.match(sql, /create table app_private\.liveticker_whatsapp_channels/);
  assert.match(sql, /create table app_private\.liveticker_whatsapp_routing_control/);
  assert.match(sql, /create table app_modules\.liveticker_whatsapp_job_targets/);
  assert.match(sql, /mode in \('TEST', 'MAIN', 'BOTH'\)/);
  assert.match(sql, /create trigger liveticker_whatsapp_job_snapshot_targets/);
});

test("PROD reconcile adds image delivery without removing multichannel targets", async () => {
  const sql = await read("supabase/prod-overlays/20260919_liveticker_prod_reconcile_r1.sql");
  assert.match(sql, /alter table app_modules\.liveticker_whatsapp_jobs[\s\S]*add column if not exists image_status/);
  assert.match(sql, /alter table app_modules\.liveticker_whatsapp_job_targets[\s\S]*add column if not exists image_status/);
  assert.match(sql, /platform_release_environment\(\) is distinct from 'PROD'/);
  assert.match(sql, /new\.delivery_mode = 'IMAGE_WITH_CAPTION'/);
  assert.match(sql, /create or replace view public\.pd_liveticker_whatsapp_job_targets_worker/);
  assert.match(sql, /drop trigger if exists liveticker_graphic_autqueue_r1/);
  assert.doesNotMatch(sql, /drop table app_private\.liveticker_whatsapp_channels/i);
  assert.doesNotMatch(sql, /drop table app_modules\.liveticker_whatsapp_job_targets/i);
});

test("PROD worker merge keeps target routing and supports IMAGE component", async () => {
  const worker = await read("supabase/prod-overlays/functions/liveticker-whatsapp-worker/index.prod-reconcile-r1.ts");
  assert.match(worker, /EXPECTED_SUPABASE_HOST = "wplescvhlgctynkfwvrj\.supabase\.co"/);
  assert.match(worker, /TARGET_VIEW = "pd_liveticker_whatsapp_job_targets_worker"/);
  assert.match(worker, /"IMAGE_WITH_CAPTION"/);
  assert.match(worker, /exactKeys\(value, \["sticker", "text", "image"\]\)/);
  assert.match(worker, /component: "STICKER" \| "TEXT" \| "IMAGE"/);
  assert.match(worker, /image_status: imageStatus/);
  assert.match(worker, /stickers\\\/prod\\\//);
});

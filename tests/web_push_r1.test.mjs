import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("Web Push R1 is private permissioned and cross-platform", async () => {
  const migration = await read("supabase/migrations/20260723213000_add_web_push_r1.sql");
  const push = await read("js/push.js");
  const worker = await read("service-worker.js");
  const ui = await read("js/ui.js");
  const html = await read("index.html");
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  const config = await read("supabase/config.toml");
  const edge = await read("supabase/functions/send-web-push/index.ts");

  assert.match(migration, /create table app_portal\.push_subscriptions/);
  assert.match(migration, /create table app_portal\.notification_preferences/);
  assert.match(migration, /create or replace function public\.pd_push_claim_batch/);
  assert.match(migration, /create or replace function public\.pd_push_complete/);
  assert.match(migration, /pd_push_dispatch_secret/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /net\.http_post/);
  assert.match(migration, /cron\.schedule/);
  assert.match(migration, /TASK_WAITING_DEADLINE_SOON/);
  assert.match(migration, /TASK_WAITING_DEADLINE_OVERDUE/);
  assert.match(migration, /when.*push_snapshot|v_action = 'push_snapshot'/s);
  assert.match(
    migration,
    /grant execute on function public\.pd_push_claim_batch\(integer\)\s+to service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.pd_push_complete\(jsonb\)\s+to service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.pd_push_validate_dispatch_secret\(text\)\s+to service_role/
  );

  for (const signature of [
    "public.pd_push_claim_batch(integer)",
    "public.pd_push_complete(jsonb)",
    "public.pd_push_validate_dispatch_secret(text)"
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(
        String.raw`grant\s+execute\s+on\s+function\s+${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s+to\s+authenticated`,
        "i"
      )
    );
  }

  assert.match(push, /Notification\.requestPermission\(\)/);
  assert.match(push, /pushManager\.subscribe/);
  assert.match(push, /userVisibleOnly:\s*true/);
  assert.match(push, /applicationServerKey/);
  assert.match(push, /save_push_subscription/);
  assert.match(push, /remove_push_subscription/);
  assert.match(push, /create_push_test/);
  assert.match(push, /Zum Home-Bildschirm/);
  assert.match(push, /quietHoursEnabled/);

  assert.match(worker, /self\.addEventListener\("push"/);
  assert.match(worker, /self\.addEventListener\("notificationclick"/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /openWindow/);
  assert.match(worker, /pd-portal-v4-web-push-badge-quiettime-fix1-20260723/);
  assert.match(worker, /\.\/js\/push\.js/);

  assert.match(ui, /data-open-push-settings/);
  assert.match(ui, /plaerrdeiflPush/);
  assert.match(html, /\.\/js\/push\.js/);
  assert.equal(manifest.id, "./");

  assert.match(config, /\[functions\.send-web-push\]/);
  assert.match(config, /verify_jwt\s*=\s*false/);

  assert.match(edge, /npm:web-push@3\.6\.7/);
  assert.match(edge, /pd_push_validate_dispatch_secret/);
  assert.match(edge, /pd_push_claim_batch/);
  assert.match(edge, /pd_push_complete/);
  assert.match(edge, /VAPID_PRIVATE_KEY/);
  assert.match(edge, /headers:\s*\{[\s\S]*apikey:\s*key/);
  assert.doesNotMatch(edge, /Authorization:\s*`?Bearer/);
  assert.doesNotMatch(push, /VAPID_PRIVATE_KEY|SERVICE_ROLE|SUPABASE_SECRET_KEYS/);
});

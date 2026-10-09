import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => readFile(path.join(root, relative), "utf8");

const [migration, dispatcher, sqlTest, documentation] = await Promise.all([
  read("supabase/migrations/20261008143000_fanbus_dev_e2e_delivery_isolation.sql"),
  read("supabase/functions/notification-dispatch/index.ts"),
  read("supabase/tests/fanbus_dev_e2e_delivery_isolation.sql"),
  read("docs/pd-portal/FANBUS_DEV_E2E_DELIVERY_ISOLATION.md")
]);

test("DEV E2E classification is server-only, actor-bound and DEV-bound", () => {
  assert.match(migration, /actor_user_id\s*=\s*'00000000-0000-4555-8555-000000000042'/);
  assert.match(migration, /coalesce\(v_claims ->> 'sub', ''\) <> p_actor_user_id::text/);
  assert.match(migration, /v_claims ->> 'role'[\s\S]*<> 'authenticated'/);
  assert.match(migration, /v_claims ->> 'iss'[\s\S]*tpieykhhawszlzsoflnl/);
  assert.match(migration, /notification_dev_e2e_run_for_actor[\s\S]*language plpgsql\s+volatile/);
  assert.match(migration, /run\.starts_at <= pg_catalog\.clock_timestamp\(\)/);
  assert.match(migration, /run\.expires_at > pg_catalog\.clock_timestamp\(\)/);
  assert.match(migration, /pd_notification_dispatch_url[\s\S]*tpieykhhawszlzsoflnl/);
  assert.doesNotMatch(migration, /p_payload\s*->>\s*'(?:devE2e|deliveryMode|testMode)'/i);
  assert.match(sqlTest, /browserFlag/);
  assert.match(sqlTest, /foreignRunId/);
  assert.match(sqlTest, /wplescvhlgctynkfwvrj/);
});

test("configuration and audit state do not cross the browser or service-role boundary", () => {
  assert.match(migration, /alter table app_private\.dev_e2e_delivery_runs enable row level security/);
  assert.match(migration, /alter table app_private\.dev_e2e_delivery_runs force row level security/);
  assert.match(migration, /revoke all on app_private\.dev_e2e_delivery_runs[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /revoke all on function app_private\.dev_e2e_delivery_run_open[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function app_private\.dev_e2e_delivery_run_open[\s\S]*to postgres/);
  assert.doesNotMatch(`${dispatcher}\n${documentation}`, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+/);
});

test("isolated EMAIL and PUSH become an auditable non-SENT terminal state before claims", () => {
  const claimAt = migration.indexOf("create or replace function public.pd_notification_claim_batch");
  const candidatesAt = migration.indexOf("with candidates as", claimAt);
  assert.ok(claimAt >= 0 && candidatesAt > claimAt);
  const preClaim = migration.slice(claimAt, candidatesAt);
  assert.match(preClaim, /status\s*=\s*'SKIPPED'/);
  assert.match(preClaim, /sent_at\s*=\s*null/);
  assert.match(preClaim, /provider_message_id\s*=\s*null/);
  assert.match(migration, /where o\.delivery_mode = 'NORMAL'[\s\S]*for update skip locked/);
  assert.match(sqlTest, /v_isolated_email/);
  assert.match(sqlTest, /v_isolated_push/);
  assert.match(sqlTest, /jsonb_array_length\(v_claims\) <> 0/);
});

test("dispatcher defense checks isolation before either provider path", () => {
  const deliver = dispatcher.slice(
    dispatcher.indexOf("async function deliver"),
    dispatcher.indexOf("Deno.serve", dispatcher.indexOf("async function deliver"))
  );
  const isolationAt = deliver.indexOf('claim.deliveryMode === "DEV_E2E_ISOLATED"');
  const smtpAt = deliver.indexOf("sendWithSmtp");
  const pushAt = deliver.indexOf("sendWithWebPush");
  assert.ok(isolationAt >= 0 && smtpAt > isolationAt && pushAt > isolationAt);
  assert.match(deliver, /config\.supabaseUrl !== DEV_E2E_SUPABASE_ORIGIN/);
  assert.match(deliver, /terminalStatus: "SKIPPED"/);
  assert.match(dispatcher, /terminalStatus: result\.terminalStatus \|\| ""/);
  assert.match(migration, /M020_COMPLETE_TERMINAL_INVALID/);
});

test("retry, idempotency, platform mode and normal delivery contracts stay intact", () => {
  for (const marker of [
    "CLAIM_EXPIRED",
    "MAX_ATTEMPTS_REACHED",
    "DELIVERY_EXPIRED",
    "PUSH_SUBSCRIPTION_INACTIVE",
    "for update skip locked",
    "interval '10 minutes'",
    "interval '1 minute'",
    "interval '5 minutes'",
    "interval '30 minutes'",
    "interval '2 hours'",
    "interval '12 hours'"
  ]) assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(migration, /on conflict \(notification_type, event_key\)/);
  assert.match(migration, /delivery_mode = 'NORMAL'/);
  assert.match(sqlTest, /PROVIDER_SMTP_450/);
  assert.match(sqlTest, /Repeated\/parallel-style claim duplicated work/);
  assert.match(documentation, /Platform mode/i);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  attachWhatsappPublishIntent,
  changedWhatsappActionIds
} from "../js/liveticker-whatsapp-publish.js";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const migrationPath = "supabase/migrations/20260913145500_liveticker_whatsapp_channel_dev_r1.sql";

test("WhatsApp intent decorates exactly one changed action without persisting into the baseline", () => {
  const previous = [{ id: "goal-1", type: "goal", team: "mighty", minute: 10 }];
  const state = {
    history: [
      { id: "goal-1", type: "goal", team: "mighty", minute: 10 },
      { id: "penalty-1", type: "penalty", minute: 11, penalties: [] }
    ]
  };

  assert.deepEqual(changedWhatsappActionIds(previous, state.history), ["penalty-1"]);
  const result = attachWhatsappPublishIntent({ previousHistory: previous, state, text: "🚨 Strafe", enabled: true });
  assert.equal(result.attached, true);
  assert.deepEqual(state.history[1]._whatsapp, { publish: true, text: "🚨 Strafe" });
  assert.equal(previous[0]._whatsapp, undefined);
});

test("WhatsApp intent is not attached when disabled, ambiguous or too long", () => {
  const disabled = { history: [{ id: "a", type: "goal" }] };
  assert.equal(attachWhatsappPublishIntent({ previousHistory: [], state: disabled, text: "Tor", enabled: false }).attached, false);
  assert.equal(disabled.history[0]._whatsapp, undefined);

  const ambiguous = { history: [{ id: "a", type: "goal" }, { id: "b", type: "goal" }] };
  assert.equal(attachWhatsappPublishIntent({ previousHistory: [], state: ambiguous, text: "Tor", enabled: true }).attached, false);
  assert.equal(ambiguous.history[0]._whatsapp, undefined);
  assert.equal(ambiguous.history[1]._whatsapp, undefined);

  const tooLong = { history: [{ id: "c", type: "goal" }] };
  assert.equal(attachWhatsappPublishIntent({ previousHistory: [], state: tooLong, text: "x".repeat(4001), enabled: true }).reason, "too_long");
  assert.equal(tooLong.history[0]._whatsapp, undefined);
});

test("WhatsApp migration creates a durable unique outbox and strips transient metadata", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /create table app_modules\.liveticker_whatsapp_jobs/i);
  assert.match(sql, /unique \(event_id, client_action_id, publication_version\)/i);
  assert.match(sql, /v_item - '_whatsapp'/);
  assert.match(sql, /app_private\.liveticker_require_operator\(\)/);
  assert.match(sql, /on conflict \(event_id, client_action_id, publication_version\) do nothing/i);
  assert.match(sql, /alter publication supabase_realtime add table app_modules\.liveticker_whatsapp_jobs/i);
  assert.match(sql, /revoke all on function public\.pd_public_liveticker_sync_before_whatsapp_channel_r1/i);
});

test("WhatsApp worker is server-only, realtime-woken and WAHA-loopback by default", async () => {
  const [worker, envExample, service] = await Promise.all([
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("workers/liveticker-whatsapp/liveticker-whatsapp-worker.env.example"),
    read("workers/liveticker-whatsapp/liveticker-whatsapp-worker.service")
  ]);

  assert.match(worker, /postgres_changes/);
  assert.match(worker, /event: "INSERT", schema: "app_modules", table: "liveticker_whatsapp_jobs"/);
  assert.match(worker, /pd_liveticker_whatsapp_worker_claim/);
  assert.match(worker, /pd_liveticker_whatsapp_worker_complete/);
  assert.match(worker, /pd_liveticker_whatsapp_worker_fail/);
  assert.match(worker, /http:\/\/127\.0\.0\.1:3001/);
  assert.match(worker, /@newsletter/);
  assert.doesNotMatch(worker, /REPLACE_WITH_DEV_SERVICE_ROLE_KEY/);

  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_DEV_SERVICE_ROLE_KEY/);
  assert.match(envExample, /WAHA_API_KEY=REPLACE_WITH_LOCAL_WAHA_API_KEY/);
  assert.match(envExample, /EXPECTED_SUPABASE_PROJECT_REF=tpieykhhawszlzsoflnl/);
  assert.match(service, /\/home\/benny\/\.nvm\/versions\/node\/v24\.20\.0\/bin\/node/);
});

test("Liveticker bootstrap defers state dispatch until generated output exists", async () => {
  const bootstrap = await read("js/liveticker-bootstrap.js");
  assert.match(bootstrap, /queueMicrotask\(\(\) => \{\s*window\.dispatchEvent\(new CustomEvent\("pd-liveticker-state-saved"/s);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260913-whatsapp-channel-r1/);
});

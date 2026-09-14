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
const migrationPaths = [
  "supabase/migrations/20260913134310_liveticker_whatsapp_outbox_dev_r1.sql",
  "supabase/migrations/20260913134341_liveticker_whatsapp_sync_wrapper_dev_r1.sql",
  "supabase/migrations/20260913134516_liveticker_whatsapp_worker_view_dev_r1.sql"
];

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

test("WhatsApp migrations create the durable outbox, sync wrapper and server-only worker view", async () => {
  const sql = (await Promise.all(migrationPaths.map(read))).join("\n");
  assert.match(sql, /create table app_modules\.liveticker_whatsapp_jobs/i);
  assert.match(sql, /unique \(event_id, client_action_id, publication_version\)/i);
  assert.match(sql, /v_item - '_whatsapp'/);
  assert.match(sql, /app_private\.liveticker_require_operator\(\)/);
  assert.match(sql, /on conflict \(event_id, client_action_id, publication_version\) do nothing/i);
  assert.match(sql, /revoke all on function public\.pd_public_liveticker_sync_before_whatsapp_channel_r1/i);
  assert.match(sql, /create view public\.pd_liveticker_whatsapp_jobs_worker/i);
  assert.match(sql, /security_invoker\s*=\s*true/i);
  assert.match(sql, /grant select, update on table public\.pd_liveticker_whatsapp_jobs_worker to service_role/i);
});

test("storage wakes WhatsApp only after a durable sync and wake failures stay non-fatal", async () => {
  const storage = await read("js/liveticker-game-storage.js");
  assert.match(storage, /WHATSAPP_WAKE_TOPIC = "liveticker-whatsapp-jobs"/);
  assert.match(storage, /hasWhatsappPublishIntent\(changes\)/);
  assert.match(storage, /applyRemoteState\(result\);\s*if \(wakeWhatsapp\) void broadcastWhatsappWake\(\);/s);
  assert.match(storage, /channel\.httpSend\("wake", \{\}\)/);
  assert.match(storage, /await client\.removeChannel\(channel\)/);
  assert.match(storage, /catch \(error\) \{[\s\S]*console\.warn\("WhatsApp-Worker konnte nicht sofort geweckt werden\./);
});

test("WhatsApp worker uses public realtime plus token-authenticated gateway, never a server DB key", async () => {
  const [worker, envExample, service, gateway] = await Promise.all([
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("workers/liveticker-whatsapp/liveticker-whatsapp-worker.env.example"),
    read("workers/liveticker-whatsapp/liveticker-whatsapp-worker.service"),
    read("supabase/functions/liveticker-whatsapp-worker/index.ts")
  ]);

  assert.match(worker, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(worker, /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY/);
  assert.match(worker, /X-Liveticker-Worker-Token/);
  assert.match(worker, /message\.event === "broadcast" && message\.payload\?\.event === "wake"/);
  assert.match(worker, /http:\/\/127\.0\.0\.1:3001/);
  assert.match(worker, /WAHA_SESSION \|\| "Liveticker_Test"/);
  assert.match(worker, /sent-journal\.json/);
  assert.match(worker, /job_send_recovered/);

  assert.match(envExample, /SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_DEV_PUBLISHABLE_KEY/);
  assert.doesNotMatch(envExample, /SERVICE_ROLE/);
  assert.match(envExample, /LIVETICKER_WORKER_TOKEN_FILE=\/srv\/docker\/liveticker\/dev\/secrets\/worker_token/);
  assert.match(envExample, /EXPECTED_SUPABASE_PROJECT_REF=tpieykhhawszlzsoflnl/);
  assert.match(envExample, /WAHA_SESSION=Liveticker_Test/);

  assert.match(service, /\/home\/benny\/\.nvm\/versions\/node\/v24\.20\.0\/bin\/node/);
  assert.match(service, /ReadWritePaths=\/srv\/docker\/liveticker\/whatsapp-worker/);
  assert.match(service, /UMask=0077/);

  assert.match(gateway, /WORKER_TOKEN_HEADER = "X-Liveticker-Worker-Token"/);
  assert.match(gateway, /pd_liveticker_whatsapp_jobs_worker/);
  assert.match(gateway, /action === "claim"/);
  assert.match(gateway, /action === "complete"/);
  assert.match(gateway, /action === "fail"/);
  assert.match(gateway, /SUPABASE_SECRET_KEYS/);
  assert.doesNotMatch(gateway, /WAHA_API_KEY|WAHA_CHANNEL_ID/);
});

test("WhatsApp worker sends goal and penalty PNG media before the text message", async () => {
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");
  const [goalPng, penaltyPng] = await Promise.all([
    fs.readFile(path.join(root, "workers/liveticker-whatsapp/assets/toooor.png")),
    fs.readFile(path.join(root, "workers/liveticker-whatsapp/assets/strafe.png"))
  ]);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.equal(goalPng.subarray(0, 8).equals(pngSignature), true);
  assert.equal(penaltyPng.subarray(0, 8).equals(pngSignature), true);
  assert.match(worker, /GOAL_MEDIA_FILE = `\$\{MEDIA_ASSET_DIR\}\/toooor\.png`/);
  assert.match(worker, /PENALTY_MEDIA_FILE = `\$\{MEDIA_ASSET_DIR\}\/strafe\.png`/);
  assert.match(worker, /goal: loadPngAsset\(GOAL_MEDIA_FILE, "toooor\.png"\)/);
  assert.match(worker, /penalty: loadPngAsset\(PENALTY_MEDIA_FILE, "strafe\.png"\)/);
  assert.match(worker, /await sendImageToWaha\(mediaAsset\)/);
  assert.match(worker, /log\("job_media_sent"/);

  const mediaIndex = worker.indexOf("const mediaRecord =");
  const textIndex = worker.indexOf("const textRecord = await sendTextToWaha(job);");
  assert.notEqual(mediaIndex, -1);
  assert.notEqual(textIndex, -1);
  assert.ok(mediaIndex < textIndex, "media must be sent before the text message");
});

test("Liveticker bootstrap defers state dispatch until generated output exists", async () => {
  const bootstrap = await read("js/liveticker-bootstrap.js");
  assert.match(bootstrap, /queueMicrotask\(\(\) => \{\s*window\.dispatchEvent\(new CustomEvent\("pd-liveticker-state-saved"/s);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260913-whatsapp-channel-r1/);
});

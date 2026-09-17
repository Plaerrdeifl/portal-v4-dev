import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { attachWhatsappPublishIntent } from "../js/liveticker-whatsapp-publish.js";
import {
  activeWhatsappStickers,
  classicActionWhatsappStickers,
  situationWhatsappStickers,
  whatsappStickerDeliveryStatus,
  whatsappTextDeliveryForAction,
  whatsappTextDeliveryStatus
} from "../js/liveticker-whatsapp-sticker-core.js";
import {
  deliverWhatsappJob,
  InvalidWhatsappJobError,
  sentRecordFromJob,
  UnknownStickerError
} from "../workers/liveticker-whatsapp/delivery.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const stickerId = "11111111-1111-4111-8111-111111111111";
const stickerAsset = Object.freeze({
  id: stickerId,
  filename: `${stickerId}.webp`,
  mimetype: "image/webp",
  data: "UklGRhIAAABXRUJQ"
});
const mediaRecord = Object.freeze({ messageId: "sticker-message", sentAt: "2026-09-15T10:00:00.000Z" });
const textRecord = Object.freeze({ messageId: "text-message", sentAt: "2026-09-15T10:00:02.000Z" });

function deliveryDependencies(overrides = {}) {
  return {
    resolveSticker: async () => stickerAsset,
    sendSticker: async () => mediaRecord,
    sendText: async () => textRecord,
    remember: async () => {},
    waitAfterSticker: async () => {},
    ...overrides
  };
}

test("sticker library returns only active stickers for the Liveticker picker", () => {
  const active = { id: stickerId, name: "TOOOOR", active: true };
  const inactive = { id: "22222222-2222-4222-8222-222222222222", name: "Alt", active: false };
  const malformed = { id: "33333333-3333-4333-8333-333333333333", name: "Ohne Status" };
  assert.deepEqual(activeWhatsappStickers([active, inactive, malformed]), [active]);
  assert.deepEqual(activeWhatsappStickers(null), []);
});

test("new action with selected sticker carries only the stable sticker reference in the transient intent", () => {
  const state = { history: [{ id: "goal-1", type: "goal" }] };
  const result = attachWhatsappPublishIntent({
    previousHistory: [],
    state,
    text: "TOOOOR für die Mighty Dogs",
    enabled: true,
    stickerId
  });
  assert.equal(result.attached, true);
  assert.deepEqual(state.history[0]._whatsapp, { publish: true, text: "TOOOOR für die Mighty Dogs", stickerId });
  assert.equal("filename" in state.history[0]._whatsapp, false);
});

test("edit and deletion never create a new WhatsApp publish intent", () => {
  const previous = [{ id: "goal-1", type: "goal", minute: 10 }];
  const edited = { history: [{ id: "goal-1", type: "goal", minute: 11 }] };
  const deleted = { history: [] };
  assert.equal(attachWhatsappPublishIntent({ previousHistory: previous, state: edited, text: "Korrektur", stickerId }).attached, false);
  assert.equal(attachWhatsappPublishIntent({ previousHistory: previous, state: deleted, text: "Gelöscht", stickerId }).attached, false);
  assert.equal(edited.history[0]._whatsapp, undefined);
});

test("classic view sends contextual and Situation stickers through the existing STICKER_ONLY service", async () => {
  const publish = await read("js/liveticker-whatsapp-publish.js");
  assert.match(publish, /Aktionssticker/);
  assert.match(publish, /Situationssticker/);
  assert.doesNotMatch(publish, /Weitere Spielsticker|Allgemeine Sticker/);
  assert.match(publish, /createWhatsappStickerOnlyRequest/);
  assert.match(publish, /linkedActionId: null/);
  assert.match(publish, /linkWhatsappStickerDelivery/);
  assert.match(publish, /retryWhatsappDelivery/);
  assert.match(publish, /window\.setInterval\(async \(\) => \{[\s\S]*await refreshDeliveries\(\);[\s\S]*await flushPendingLinks\(\);[\s\S]*\}, 1000\)/);
  const sendSticker = publish.match(/async function sendSticker\(area\) \{[\s\S]+?\n  \}/)?.[0] || "";
  assert.doesNotMatch(sendSticker, /requestSubmit|state\.history|message\s*:/);
  assert.match(sendSticker, /if \(!transportReady\(\) \|\| !state\?\.selectedStickerId \|\| state\.deliveryId \|\| state\.busy\) return/);
  assert.match(sendSticker, /state\.request \|\|= createWhatsappStickerOnlyRequest/);
  assert.match(sendSticker, /state\.request\.send\(\)/);
  assert.doesNotMatch(sendSticker, /requestSubmit|state\.history|message\s*:/);

  const submitHandler = publish.match(/form\?\.addEventListener\("submit"[\s\S]+?\}, \{ capture: true \}\);/)?.[0] || "";
  assert.match(submitHandler, /selectedAction\(\) === "SITUATION"/);
  assert.match(submitHandler, /event\.stopImmediatePropagation\(\)/);

  const saveHandler = publish.match(/window\.addEventListener\("pd-liveticker-state-saved"[\s\S]+?\n  \}\);/)?.[0] || "";
  assert.match(saveHandler, /attachWhatsappPublishIntent\(\{[\s\S]*enabled: control\?\.checked !== false && transportReady\(\)\s*\}\)/);
  assert.doesNotMatch(saveHandler, /stickerId\s*:/);
  assert.match(saveHandler, /areas\.action\.sourceAction !== "SITUATION"[\s\S]*pendingLinks\.set\(actionId, areas\.action\.deliveryId\)/);
  assert.match(publish, /linkWhatsappStickerDelivery\(\{ jobId, actionId \}\)/);
  assert.match(publish, /if \(!state\.request \|\| state\.deliveryId\) return/);
});

test("classic action stickers are active and match the selected team/action context", () => {
  const opponentTeamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherOpponentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const stickers = [
    { id: "our-goal", active: true, audience: "OUR_TEAM", category: "GOAL" },
    { id: "inactive-goal", active: false, audience: "OUR_TEAM", category: "GOAL" },
    { id: "against-current", active: true, audience: "OPPONENT", category: "AGAINST", opponentTeamId },
    { id: "against-other", active: true, audience: "OPPONENT", category: "AGAINST", opponentTeamId: otherOpponentId },
    { id: "our-penalty", active: true, audience: "OUR_TEAM", category: "PENALTY" },
    { id: "their-penalty", active: true, audience: "OPPONENT", category: "PENALTY", opponentTeamId }
  ];

  assert.deepEqual(classicActionWhatsappStickers(stickers, { action: "GOAL_MIGHTY", opponentTeamId }).map(item => item.id), ["our-goal"]);
  assert.deepEqual(classicActionWhatsappStickers(stickers, { action: "GOAL_OPPONENT", opponentTeamId }).map(item => item.id), ["against-current"]);
  assert.deepEqual(classicActionWhatsappStickers(stickers, { action: "PENALTY", opponentTeamId, penaltyTeams: ["mighty"] }).map(item => item.id), ["our-penalty"]);
  assert.deepEqual(classicActionWhatsappStickers(stickers, { action: "PENALTY", opponentTeamId, penaltyTeams: ["opponent"] }).map(item => item.id), ["their-penalty"]);
  assert.deepEqual(classicActionWhatsappStickers(stickers, { action: "PENALTY", opponentTeamId, penaltyTeams: ["mighty", "opponent"] }), []);
});

test("Situation includes every active non-action category and remains opponent-aware", () => {
  const opponentTeamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const stickers = [
    { id: "game-own", active: true, audience: "OUR_TEAM", category: "GAME_SITUATION" },
    { id: "game-general", active: true, audience: "GENERAL", category: "GAME_SITUATION" },
    { id: "game-opponent", active: true, audience: "OPPONENT", category: "GAME_SITUATION", opponentTeamId },
    { id: "game-wrong-opponent", active: true, audience: "OPPONENT", category: "GAME_SITUATION", opponentTeamId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    { id: "general", active: true, audience: "GENERAL", category: "GENERAL" },
    { id: "video", active: true, audience: "GENERAL", category: "VIDEO_REVIEW" },
    { id: "goal", active: true, audience: "OUR_TEAM", category: "GOAL" },
    { id: "against", active: true, audience: "OPPONENT", category: "AGAINST", opponentTeamId },
    { id: "penalty", active: true, audience: "OUR_TEAM", category: "PENALTY" },
    { id: "inactive-general", active: false, audience: "GENERAL", category: "GENERAL" }
  ];
  assert.deepEqual(situationWhatsappStickers(stickers, { opponentTeamId }).map(item => item.id), [
    "game-own", "game-general", "game-opponent", "general", "video"
  ]);
});

test("classic sticker and text status use the persisted delivery component state", () => {
  assert.equal(whatsappStickerDeliveryStatus({ stickerStatus: "PENDING", attemptCount: 1 }).label, "WIRD GESENDET …");
  assert.equal(whatsappStickerDeliveryStatus({ stickerStatus: "PENDING", attemptCount: 2 }).label, "WIRD ERNEUT VERSUCHT …");
  assert.equal(whatsappStickerDeliveryStatus({ stickerStatus: "SENT" }).label, "GESENDET ✓");
  assert.deepEqual(whatsappStickerDeliveryStatus({ stickerStatus: "FAILED" }), {
    label: "FEHLGESCHLAGEN – MANUELL EINGREIFEN",
    tone: "error",
    retryable: true
  });
  assert.equal(whatsappTextDeliveryStatus({ textStatus: "PENDING", attemptCount: 1 }).label, "WIRD GESENDET …");
  assert.equal(whatsappTextDeliveryStatus({ textStatus: "PENDING", attemptCount: 2 }).label, "WIRD ERNEUT VERSUCHT …");
  assert.equal(whatsappTextDeliveryStatus({ textStatus: "SENT" }).label, "GESENDET ✓");
  assert.equal(whatsappTextDeliveryStatus({ textStatus: "FAILED" }).retryable, true);
});

test("text delivery lookup ignores standalone stickers and uses the linked action", () => {
  const stickerOnly = { id: "sticker", linkedActionId: "goal-1", textStatus: "NOT_REQUESTED" };
  const otherText = { id: "other", linkedActionId: "goal-2", textStatus: "SENT" };
  const goalText = { id: "text", linkedActionId: "goal-1", textStatus: "PENDING" };
  assert.equal(whatsappTextDeliveryForAction([stickerOnly, otherText, goalText], "goal-1"), goalText);
  assert.equal(whatsappTextDeliveryForAction([stickerOnly], "goal-1"), null);
  assert.equal(whatsappTextDeliveryForAction(null, "goal-1"), null);
});

test("classic text delivery status follows linked outbox jobs and retries the same job", async () => {
  const publish = await read("js/liveticker-whatsapp-publish.js");
  assert.match(publish, /whatsappTextDeliveryForAction\(deliveries, textActionId\)/);
  assert.match(publish, /whatsappTextDeliveryStatus\(delivery\)/);
  assert.match(publish, /label\.textContent = `TEXT \$\{status\.label\}`/);
  assert.match(publish, /delivery\.textStatus !== "FAILED"/);
  assert.match(publish, /retryWhatsappDelivery\(\{ eventId: eventId\(\), jobId: delivery\.id \}\)/);
  assert.match(publish, /if \(result\.attached && actionId\)[\s\S]*textActionId = actionId[\s\S]*textRequestPending = true/);
  assert.doesNotMatch(publish, /createWhatsappDeliveryRequest|enqueueWhatsappDelivery/);
});

test("GAME_SITUATION is additive in client, admin and DEV migration contracts", async () => {
  const [client, admin, sql] = await Promise.all([
    read("js/liveticker-whatsapp-sticker-core.js"),
    read("js/modules/liveticker-admin.js"),
    read("supabase/migrations/20260917173757_liveticker_whatsapp_game_situation_stickers_dev_r1.sql")
  ]);
  assert.match(client, /"GAME_SITUATION"/);
  assert.match(admin, /value="GAME_SITUATION"/);
  assert.match(admin, /GAME_SITUATION: "Spielsituation"/);
  assert.match(sql, /drop constraint liveticker_whatsapp_stickers_category_check/i);
  assert.match(sql, /'GAME_SITUATION'/);
  assert.match(sql, /create or replace function app_private\.api_liveticker_whatsapp_sticker_metadata_set/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /app_private\.liveticker_require_operator\(\)/i);
  assert.match(sql, /platform_release_environment\(\) is distinct from 'DEV'/i);
  assert.doesNotMatch(sql, /insert into app_modules\.liveticker_whatsapp_stickers/i);
});

test("migration uses private Supabase Storage, validates references and keeps sticker metadata secret-free", async () => {
  const sql = await read("supabase/migrations/20260914220855_liveticker_whatsapp_sticker_library_dev_r1.sql");
  assert.match(sql, /create table app_modules\.liveticker_whatsapp_stickers/i);
  assert.match(sql, /'liveticker-whatsapp-stickers',[\s\S]*false,[\s\S]*102400/i);
  assert.match(sql, /allowed_mime_types[\s\S]*image\/webp/i);
  assert.match(sql, /add column sticker_id uuid[\s\S]*references app_modules\.liveticker_whatsapp_stickers\(id\) on delete restrict/i);
  assert.match(sql, /where v_include_inactive or sticker\.active/i);
  assert.match(sql, /where sticker\.id = v_sticker_id and sticker\.active/i);
  assert.match(sql, /LIVETICKER_UNKNOWN_WHATSAPP_STICKER/i);
  assert.match(sql, /when 'liveticker_whatsapp_sticker_upload_authorize' then 'USER_MUTATION'/i);
  assert.match(sql, /when 'liveticker_whatsapp_sticker_asset_authorize' then 'READ'/i);
  assert.match(sql, /when 'liveticker_whatsapp_sticker_set_active' then 'USER_MUTATION'/i);
  assert.match(sql, /v_item - '_whatsapp'/i);
  assert.doesNotMatch(sql, /service[_-]?role[_-]?(?:key|secret)|waha[_-]?api[_-]?key/i);
});

test("sticker upload normalizes original images server-side and keeps browser code encoder-free", async () => {
  const [upload, processor, dependencyConfig, authorizationMigration, browserApi, stickerClient, admin] = await Promise.all([
    read("supabase/functions/liveticker-whatsapp-stickers/index.ts"),
    read("supabase/functions/liveticker-whatsapp-stickers/image-processing.mjs"),
    read("supabase/functions/liveticker-whatsapp-stickers/deno.json"),
    read("supabase/migrations/20260915110000_liveticker_whatsapp_sticker_server_processing_dev_r1.sql"),
    read("js/api.js"),
    read("js/liveticker-whatsapp-stickers.js"),
    read("js/modules/liveticker-admin.js")
  ]);
  assert.match(dependencyConfig, /npm:@imagemagick\/magick-wasm@0\.0\.43/);
  assert.match(processor, /STICKER_WIDTH = 512/);
  assert.match(processor, /STICKER_HEIGHT = 512/);
  assert.match(processor, /STICKER_MAX_BYTES = 100 \* 1024/);
  assert.match(processor, /MagickColors\.Transparent/);
  assert.match(processor, /compositeGravity\(source, Gravity\.Center, CompositeOperator\.Over\)/);
  assert.match(processor, /STICKER_WEBP_MIN_QUALITY = 20/);
  assert.match(processor, /while \(lower <= upper\)/);
  assert.match(processor, /kind === "ANIM" \|\| kind === "ANMF"/);
  assert.match(processor, /kind === "acTL"/);
  assert.match(upload, /normalizeStickerImage\(sourceBytes\)/);
  assert.match(upload, /storage\/v1\/object/);
  assert.match(authorizationMigration, /sourceMimeType/);
  assert.match(authorizationMigration, /sourceSize/);
  assert.doesNotMatch(authorizationMigration, /filename/);
  assert.match(admin, /uploadLivetickerWhatsappSticker\(values\.name, source\)/);
  assert.match(admin, /image\/png,image\/jpeg,image\/webp/);
  assert.doesNotMatch(stickerClient, /canvas|toBlob|createImageBitmap|image\/webp.*quality/i);
  assert.doesNotMatch(stickerClient, /Dieser Browser kann den Sticker nicht zuverlässig als WebP vorbereiten/);
  assert.doesNotMatch(browserApi, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEYS/);
  assert.doesNotMatch(stickerClient, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEYS/);
});

test("worker job without sticker sends only text", async () => {
  const calls = [];
  const result = await deliverWhatsappJob({
    job: { id: "job-1", message: "Nur Text", stickerId: null },
    sentRecord: {},
    ...deliveryDependencies({
      resolveSticker: async () => { calls.push("resolve"); return stickerAsset; },
      sendSticker: async () => { calls.push("sticker"); return mediaRecord; },
      sendText: async () => { calls.push("text"); return textRecord; },
      remember: async () => { calls.push("remember"); }
    })
  });
  assert.deepEqual(calls, ["text", "remember"]);
  assert.equal(result.sentRecord.text.messageId, "text-message");
  assert.equal(result.sentRecord.media, undefined);
});

test("explicit TEXT_ONLY sends exactly the text component", async () => {
  const calls = [];
  await deliverWhatsappJob({
    job: { id: "job-text", deliveryMode: "TEXT_ONLY", message: "Nur Text", stickerId: null },
    sentRecord: {},
    ...deliveryDependencies({
      resolveSticker: async () => { calls.push("resolve"); return stickerAsset; },
      sendSticker: async () => { calls.push("sticker"); return mediaRecord; },
      sendText: async () => { calls.push("text"); return textRecord; },
      remember: async () => { calls.push("remember"); },
      waitAfterSticker: async () => { calls.push("delay"); }
    })
  });
  assert.deepEqual(calls, ["text", "remember"]);
});

test("STICKER_ONLY sends exactly the sticker component", async () => {
  const calls = [];
  const result = await deliverWhatsappJob({
    job: { id: "job-sticker", deliveryMode: "STICKER_ONLY", message: null, stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      resolveSticker: async () => { calls.push("resolve"); return stickerAsset; },
      sendSticker: async () => { calls.push("sticker"); return mediaRecord; },
      sendText: async () => { calls.push("text"); return textRecord; },
      remember: async () => { calls.push("remember"); },
      waitAfterSticker: async () => { calls.push("delay"); }
    })
  });
  assert.deepEqual(calls, ["resolve", "sticker", "remember"]);
  assert.equal(result.sentRecord.media.messageId, "sticker-message");
  assert.equal(result.sentRecord.text, undefined);
  assert.equal(result.sentRecord.messageId, "sticker-message");
});

test("worker sends selected sticker before text", async () => {
  const calls = [];
  await deliverWhatsappJob({
    job: { id: "job-2", deliveryMode: "STICKER_THEN_TEXT", message: "Sticker und Text", stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      resolveSticker: async id => { calls.push(`resolve:${id}`); return stickerAsset; },
      sendSticker: async () => { calls.push("sticker"); return mediaRecord; },
      sendText: async () => { calls.push("text"); return textRecord; },
      remember: async record => { calls.push(record.media && !record.text ? "remember-media" : "remember-text"); },
      waitAfterSticker: async () => { calls.push("delay"); }
    })
  });
  assert.deepEqual(calls, [`resolve:${stickerId}`, "sticker", "remember-media", "delay", "text", "remember-text"]);
});

test("text failure after sticker persists media and retry does not send the sticker twice", async () => {
  let journal = {};
  let stickerSends = 0;
  await assert.rejects(() => deliverWhatsappJob({
    job: { id: "job-3", message: "Retry", stickerId },
    sentRecord: journal,
    ...deliveryDependencies({
      sendSticker: async () => { stickerSends += 1; return mediaRecord; },
      sendText: async () => { throw new Error("text failed"); },
      remember: async record => { journal = structuredClone(record); }
    })
  }), /text failed/);
  assert.equal(journal.media.messageId, "sticker-message");

  const retry = await deliverWhatsappJob({
    job: { id: "job-3", message: "Retry", stickerId },
    sentRecord: journal,
    ...deliveryDependencies({
      sendSticker: async () => { stickerSends += 1; return mediaRecord; },
      remember: async record => { journal = structuredClone(record); }
    })
  });
  assert.equal(stickerSends, 1);
  assert.equal(retry.sentRecord.text.messageId, "text-message");
});

test("persisted sticker success makes a combined retry send only text", async () => {
  const calls = [];
  const sentRecord = sentRecordFromJob({
    stickerStatus: "SENT",
    stickerMessageId: "durable-sticker-message",
    stickerSentAt: "2026-09-15T10:00:00.000Z",
    textStatus: "PENDING"
  });
  await deliverWhatsappJob({
    job: { deliveryMode: "STICKER_THEN_TEXT", message: "Retry Text", stickerId },
    sentRecord,
    ...deliveryDependencies({
      resolveSticker: async () => { calls.push("resolve"); return stickerAsset; },
      sendSticker: async () => { calls.push("sticker"); return mediaRecord; },
      sendText: async () => { calls.push("text"); return textRecord; },
      remember: async () => { calls.push("remember"); },
      waitAfterSticker: async () => { calls.push("delay"); }
    })
  });
  assert.deepEqual(calls, ["text", "remember"]);
});

test("STICKER_ONLY retry never calls the text transport", async () => {
  const calls = [];
  await assert.rejects(() => deliverWhatsappJob({
    job: { deliveryMode: "STICKER_ONLY", message: null, stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      sendSticker: async () => { calls.push("sticker-failed"); throw new Error("sticker failed"); },
      sendText: async () => { calls.push("text"); return textRecord; }
    })
  }), /sticker failed/);
  await deliverWhatsappJob({
    job: { deliveryMode: "STICKER_ONLY", message: null, stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      sendSticker: async () => { calls.push("sticker-retry"); return mediaRecord; },
      sendText: async () => { calls.push("text-retry"); return textRecord; }
    })
  });
  assert.deepEqual(calls, ["sticker-failed", "sticker-retry"]);
});

test("job without a sendable component is rejected before a transport call", async () => {
  let called = false;
  await assert.rejects(() => deliverWhatsappJob({
    job: { deliveryMode: "TEXT_ONLY", message: "   ", stickerId: null },
    sentRecord: {},
    ...deliveryDependencies({
      sendSticker: async () => { called = true; return mediaRecord; },
      sendText: async () => { called = true; return textRecord; }
    })
  }), error => error instanceof InvalidWhatsappJobError && error.code === "INVALID_WHATSAPP_JOB");
  assert.equal(called, false);
});

test("sticker failure prevents text delivery and does not create a media journal entry", async () => {
  let remembered = false;
  let textSent = false;
  await assert.rejects(() => deliverWhatsappJob({
    job: { id: "job-4", message: "Nicht voreilig", stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      sendSticker: async () => { throw new Error("sticker failed"); },
      sendText: async () => { textSent = true; return textRecord; },
      remember: async () => { remembered = true; }
    })
  }), /sticker failed/);
  assert.equal(textSent, false);
  assert.equal(remembered, false);
});

test("unknown sticker ID fails in a controlled way without sending another asset or text", async () => {
  let stickerSent = false;
  let textSent = false;
  await assert.rejects(() => deliverWhatsappJob({
    job: { id: "job-5", message: "Unbekannt", stickerId },
    sentRecord: {},
    ...deliveryDependencies({
      resolveSticker: async () => null,
      sendSticker: async () => { stickerSent = true; return mediaRecord; },
      sendText: async () => { textSent = true; return textRecord; }
    })
  }), error => error instanceof UnknownStickerError && error.code === "UNKNOWN_STICKER");
  assert.equal(stickerSent, false);
  assert.equal(textSent, false);
});

test("runtime uses only explicit sticker_id and WAHA WPP sendSticker, never message guessing or sendImage", async () => {
  const [worker, gateway] = await Promise.all([
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("supabase/functions/liveticker-whatsapp-worker/index.ts")
  ]);
  assert.match(worker, /deliverWhatsappJob/);
  assert.match(worker, /action: "sticker", stickerId/);
  assert.match(worker, /\/api\/sendSticker/);
  assert.doesNotMatch(worker, /\/api\/sendImage|mediaAssetForJob|TO\+OR|Strafe\\\(n\\\)/i);
  assert.match(gateway, /STICKER_BUCKET = "liveticker-whatsapp-stickers"/);
  assert.match(gateway, /stickerId: row\.sticker_id/);
  assert.match(gateway, /sha256Bytes\(bytes\) !== expectedSha/);
});

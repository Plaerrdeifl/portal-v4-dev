import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { attachWhatsappPublishIntent } from "../js/liveticker-whatsapp-publish.js";
import { activeWhatsappStickers } from "../js/liveticker-whatsapp-sticker-core.js";
import { deliverWhatsappJob, UnknownStickerError } from "../workers/liveticker-whatsapp/delivery.mjs";

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

test("migration uses private Supabase Storage, validates references and keeps sticker metadata secret-free", async () => {
  const sql = await read("supabase/migrations/20260914220855_liveticker_whatsapp_sticker_library_dev_r1.sql");
  assert.match(sql, /create table app_modules\.liveticker_whatsapp_stickers/i);
  assert.match(sql, /'liveticker-whatsapp-stickers',[\s\S]*false,[\s\S]*102400/i);
  assert.match(sql, /allowed_mime_types[\s\S]*image\/webp/i);
  assert.match(sql, /add column sticker_id uuid[\s\S]*references app_modules\.liveticker_whatsapp_stickers\(id\) on delete restrict/i);
  assert.match(sql, /where v_include_inactive or sticker\.active/i);
  assert.match(sql, /where sticker\.id = v_sticker_id and sticker\.active/i);
  assert.match(sql, /LIVETICKER_UNKNOWN_WHATSAPP_STICKER/i);
  assert.match(sql, /v_item - '_whatsapp'/i);
  assert.doesNotMatch(sql, /service[_-]?role[_-]?(?:key|secret)|waha[_-]?api[_-]?key/i);
});

test("sticker upload is server-validated as static 512px WebP and browser code contains no service key", async () => {
  const [upload, browserApi, stickerClient] = await Promise.all([
    read("supabase/functions/liveticker-whatsapp-stickers/index.ts"),
    read("js/api.js"),
    read("js/liveticker-whatsapp-stickers.js")
  ]);
  assert.match(upload, /MAX_STICKER_BYTES = 100 \* 1024/);
  assert.match(upload, /dimensions\?\.width === STICKER_SIZE && dimensions\.height === STICKER_SIZE/);
  assert.match(upload, /kind === "ANIM" \|\| kind === "ANMF"/);
  assert.match(upload, /storage\/v1\/object/);
  assert.match(stickerClient, /Math\.min\(canvas\.width \/ width, canvas\.height \/ height\)/);
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

test("worker sends selected sticker before text", async () => {
  const calls = [];
  await deliverWhatsappJob({
    job: { id: "job-2", message: "Sticker und Text", stickerId },
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

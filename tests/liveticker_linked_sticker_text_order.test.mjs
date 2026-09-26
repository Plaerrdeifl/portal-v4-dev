import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  deliverWhatsappJob,
  linkedTextRemainingDelayMs
} from "../workers/liveticker-whatsapp/delivery.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const ACTION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ACTION_ID = "22222222-2222-4222-8222-222222222222";
const NOW_MS = Date.parse("2026-09-26T12:00:02.000Z");
const MINIMUM_DELAY_MS = 2000;

function textJob(overrides = {}) {
  return {
    id: "text-job",
    deliveryMode: "TEXT_ONLY",
    message: "Tor für die Plärrdeifl",
    stickerId: null,
    linkedActionId: ACTION_ID,
    ...overrides
  };
}

function linkedSticker(overrides = {}) {
  return {
    linkedActionId: ACTION_ID,
    deliveryMode: "STICKER_ONLY",
    status: "SUCCEEDED",
    stickerStatus: "SENT",
    stickerSentAt: "2026-09-26T12:00:00.600Z",
    ...overrides
  };
}

test("unlinked TEXT_ONLY job is not delayed", () => {
  const job = textJob({ linkedActionId: null, linkedSticker: linkedSticker() });
  assert.equal(linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("linked TEXT_ONLY job without a matching sticker is not delayed", () => {
  assert.equal(linkedTextRemainingDelayMs(textJob(), NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("linked sticker older than two seconds does not delay text", () => {
  const job = textJob({ linkedSticker: linkedSticker({ stickerSentAt: "2026-09-26T11:59:59.999Z" }) });
  assert.equal(linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("linked sticker sent 1.4 seconds ago delays text by only the remaining 600ms", async () => {
  const job = textJob({ linkedSticker: linkedSticker() });
  const calls = [];
  const delayMs = linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS);
  assert.equal(delayMs, 600);

  await new Promise(resolve => {
    calls.push(`delay:${delayMs}`);
    resolve();
  });
  await deliverWhatsappJob({
    job,
    sentRecord: {},
    resolveSticker: async () => { throw new Error("sticker must not be resolved"); },
    sendSticker: async () => { throw new Error("sticker must not be sent"); },
    sendText: async () => {
      calls.push("text");
      return { messageId: "text-message", sentAt: "2026-09-26T12:00:02.600Z" };
    },
    sendImage: async () => { throw new Error("image must not be sent"); },
    remember: async () => { calls.push("remember"); },
    waitAfterSticker: async () => { calls.push("combined-delay"); }
  });
  assert.deepEqual(calls, ["delay:600", "text", "remember"]);
});

test("a freshly sent linked sticker delays text by at most two seconds", () => {
  const job = textJob({ linkedSticker: linkedSticker({ stickerSentAt: "2026-09-26T12:00:02.000Z" }) });
  assert.equal(linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS), 2000);
  const futureJob = textJob({ linkedSticker: linkedSticker({ stickerSentAt: "2026-09-26T12:00:03.000Z" }) });
  assert.equal(linkedTextRemainingDelayMs(futureJob, NOW_MS, MINIMUM_DELAY_MS), 2000);
});

test("a successful sticker for another action does not delay text", () => {
  const job = textJob({ linkedSticker: linkedSticker({ linkedActionId: OTHER_ACTION_ID }) });
  assert.equal(linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("failed or pending sticker does not block linked text", () => {
  const failed = textJob({ linkedSticker: linkedSticker({ status: "FAILED", stickerStatus: "FAILED" }) });
  const pending = textJob({ linkedSticker: linkedSticker({ status: "PENDING", stickerStatus: "PENDING" }) });
  assert.equal(linkedTextRemainingDelayMs(failed, NOW_MS, MINIMUM_DELAY_MS), 0);
  assert.equal(linkedTextRemainingDelayMs(pending, NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("STICKER_THEN_TEXT remains outside the cross-job delay", () => {
  const job = textJob({ deliveryMode: "STICKER_THEN_TEXT", stickerId: ACTION_ID, linkedSticker: linkedSticker() });
  assert.equal(linkedTextRemainingDelayMs(job, NOW_MS, MINIMUM_DELAY_MS), 0);
});

test("worker and claim gateway preserve exact linked-job ordering contracts", async () => {
  const [worker, gateway] = await Promise.all([
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("supabase/functions/liveticker-whatsapp-worker/index.ts")
  ]);
  const claim = gateway.match(/async function claim\(\)[\s\S]+?\n\}/)?.[0] || "";
  assert.match(claim, /order: "created_at\.asc,id\.asc"/);
  assert.match(claim, /candidate\.deliveryMode === "TEXT_ONLY" && isLinkedActionId\(candidate\.linkedActionId\)/);
  assert.match(claim, /event_id: `eq\.\$\{candidate\.eventId\}`/);
  assert.match(claim, /status: "eq\.PENDING"[\s\S]*created_at: `lte\.\$\{candidate\.createdAt\}`[\s\S]*order: "created_at\.desc,id\.desc"/);
  assert.match(claim, /if \(pendingRows\.length\) candidate = claimCandidate\(pendingRows\[0\]\)/);
  assert.match(claim, /delivery_mode: "eq\.STICKER_ONLY"/);
  assert.match(claim, /status: "eq\.SUCCEEDED"/);
  assert.match(claim, /sticker_status: "eq\.SENT"/);
  assert.match(claim, /order: "sticker_sent_at\.desc"/);
  assert.match(worker, /if \(!sentRecord\.text\)[\s\S]*linkedTextRemainingDelayMs\(job, Date\.now\(\), MEDIA_TEXT_DELAY_MS\)[\s\S]*setTimeout\(resolve, linkedTextDelayMs\)[\s\S]*deliverWhatsappJob/);
});

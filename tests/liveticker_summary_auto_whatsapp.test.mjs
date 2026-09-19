import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  deliverWhatsappJob,
  WHATSAPP_DELIVERY_MODES
} from "../workers/liveticker-whatsapp/delivery.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("summary output emits a dedicated publish request instead of submitting another game action", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  assert.match(engine, /pd-liveticker-summary-requested/);
  assert.match(engine, /requestSummaryOutput\("PERIOD_1"/);
  assert.match(engine, /requestSummaryOutput\("PERIOD_2"/);
  assert.match(engine, /requestSummaryOutput\("FINAL"/);
});

test("automatic summary delivery selects POST only and never STORY", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.match(graphics, /function postArtifactForJob\(job\)/);
  assert.match(graphics, /find\(item => item\?\.kind === "POST"\)/);
  assert.doesNotMatch(graphics, /find\(item => item\?\.kind === "STORY"\)/);
  assert.match(graphics, /deliveryMode: "IMAGE_WITH_CAPTION"/);
  assert.match(graphics, /idempotencyKey: request\.jobId/);
  assert.match(graphics, /message: request\.text/);
  assert.match(graphics, /Text \+ POST senden/);
});

test("finished summary status cannot stay visually stuck on an old PROCESSING snapshot", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.match(graphics, /const summaryDone = summaryStatus\?\.kind === kind && summaryStatus\?\.state === "success"/);
  assert.match(graphics, /const active = !summaryDone && \(isActive\(job\) \|\| enqueueInFlight === kind\)/);
  assert.match(graphics, /summaryStatus = null;[\s\S]*void enqueue\(kind\)/);
});

test("minute and iOS page resume refresh the graphic status instead of reusing stale UI state", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.match(graphics, /function handleMinuteDisplayChange\(\)[\s\S]*render\(\);[\s\S]*if \(resultsOpen\) void refreshStatusOnly\(\)/);
  assert.match(graphics, /minuteInput\?\.addEventListener\("input", handleMinuteDisplayChange\)/);
  assert.match(graphics, /minuteInput\?\.addEventListener\("change", handleMinuteDisplayChange\)/);
  assert.match(graphics, /visibilitychange[\s\S]*refreshAll\(\)/);
  assert.match(graphics, /pageshow[\s\S]*refreshAll\(\)/);
});

test("manual flyer regeneration does not auto-send another WhatsApp summary", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const block = graphics.match(/resultGenerateButton\?\.addEventListener\("click",[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(block, /queuedSummary = null/);
  assert.match(block, /void enqueue\(kind\)/);
  assert.doesNotMatch(block, /BUTTONS\[kind\]\?\.click/);
});

test("IMAGE_WITH_CAPTION is one WPP image component and never a second text send", async () => {
  const sent = { messageId: "img-1", sentAt: "2026-09-19T13:30:00.000Z" };
  let imageCalls = 0;
  let textCalls = 0;
  const result = await deliverWhatsappJob({
    job: {
      id: "job-image",
      deliveryMode: WHATSAPP_DELIVERY_MODES.IMAGE_WITH_CAPTION,
      message: "*Ende 1. Drittel – 2:2*",
      imageUrl: "https://cloud.plaerrdeifl.de/s/AbCdEf123456/download",
      imageFilename: "period_1_post.png"
    },
    sentRecord: {},
    resolveSticker: async () => null,
    sendSticker: async () => { throw new Error("sticker must not run"); },
    sendText: async () => { textCalls += 1; throw new Error("text must not run"); },
    sendImage: async job => {
      imageCalls += 1;
      assert.equal(job.message, "*Ende 1. Drittel – 2:2*");
      return sent;
    },
    remember: async () => {},
    waitAfterSticker: async () => {}
  });

  assert.equal(imageCalls, 1);
  assert.equal(textCalls, 0);
  assert.equal(result.imageSentThisRun, true);
  assert.deepEqual(result.sentRecord.image, sent);
});

test("DEV image delivery migration requires caption text and keeps Story outside the outbox contract", async () => {
  const sql = await read("supabase/migrations/20260919133949_liveticker_whatsapp_image_delivery_dev_r1.sql");
  assert.match(sql, /IMAGE_WITH_CAPTION/);
  assert.match(sql, /message is not null/);
  assert.match(sql, /char_length\(btrim\(message\)\) between 1 and 4000/i);
  assert.match(sql, /image_status/);
  assert.doesNotMatch(sql, /STORY/);
});

test("WPP summary image uses caption natively", async () => {
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");
  assert.match(worker, /\/api\/sendImage/);
  assert.match(worker, /caption: String\(job\?\.message \|\| ""\)/);
  assert.match(worker, /imageFilename/);
});

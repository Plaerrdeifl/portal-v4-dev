import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
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

test("summary WhatsApp send selects POST only and never STORY", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.match(graphics, /function postArtifactForJob\(job\)/);
  assert.match(graphics, /find\(item => item\?\.kind === "POST"\)/);
  assert.doesNotMatch(graphics, /find\(item => item\?\.kind === "STORY"\)/);
  assert.match(graphics, /deliveryMode: "IMAGE_WITH_CAPTION"/);
  assert.match(graphics, /idempotencyKey: newRequestId\(\)/);
  assert.match(graphics, /imageUrl: post\.downloadUrl/);
  assert.match(graphics, /message: text/);
});

test("output panel routes its primary action without duplicate jobs or sends", async () => {
  const [graphics, html] = await Promise.all([
    read("js/liveticker-graphics-inline.js"),
    read("liveticker/index.html")
  ]);
  const generate = graphics.match(/resultGenerateButton\?\.addEventListener\("click",[\s\S]*?\n\}\);/)?.[0] || "";
  const primary = graphics.match(/resultWhatsappButton\?\.addEventListener\("click",[\s\S]*?\n\}\);/)?.[0] || "";
  assert.match(generate, /void enqueue\(kind, text\)/);
  assert.doesNotMatch(generate, /sendSummaryToWhatsapp/);
  assert.match(generate, /latestJob\(kind\)\?\.status !== "SUCCEEDED" \|\| enqueueInFlight/);
  assert.match(primary, /if \(isActive\(job\) \|\| enqueueInFlight\) return/);
  assert.match(primary, /job\?\.status === "SUCCEEDED"[\s\S]*sendSummaryToWhatsapp\(kind\)[\s\S]*return/);
  assert.equal((primary.match(/void enqueue\(kind, text\)/g) || []).length, 1);
  assert.equal((primary.match(/sendSummaryToWhatsapp\(kind\)/g) || []).length, 1);
  assert.match(html, /id="resultWhatsappButton"[^>]*>🖼️ Flyer erstellen<\/button>/);
  assert.match(html, /id="resultGenerateButton"[^>]*hidden[^>]*>Neu erstellen<\/button>/);
});

test("output panel models no-job, active, succeeded and failed states", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const start = graphics.indexOf("function outputPanelState");
  const end = graphics.indexOf("\nfunction renderResultActions", start);
  assert.ok(start >= 0 && end > start, "outputPanelState must stay directly testable");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${graphics.slice(start, end)}\n;globalThis.outputPanelState = outputPanelState;`, context);
  const state = context.outputPanelState;

  assert.deepEqual(
    JSON.parse(JSON.stringify(state(null, { workerReady: true }))),
    {
      primaryDisabled: false,
      primaryLabel: "🖼️ Flyer erstellen",
      regenerateVisible: false,
      regenerateDisabled: true
    }
  );

  for (const status of ["QUEUED", "PROCESSING"]) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(state({ status }, { workerReady: true }))),
      {
        primaryDisabled: true,
        primaryLabel: "Flyer wird erstellt …",
        regenerateVisible: false,
        regenerateDisabled: true
      }
    );
  }

  assert.deepEqual(
    JSON.parse(JSON.stringify(state({ status: "SUCCEEDED" }, { workerReady: true, sendable: true }))),
    {
      primaryDisabled: false,
      primaryLabel: "📲 An WhatsApp senden",
      regenerateVisible: true,
      regenerateDisabled: false
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(state({ status: "FAILED" }, { workerReady: true }))),
    {
      primaryDisabled: false,
      primaryLabel: "Erneut erstellen",
      regenerateVisible: false,
      regenerateDisabled: true
    }
  );
});

test("old single pending-summary race is removed", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.doesNotMatch(graphics, /\bpendingSummary\b/);
  assert.doesNotMatch(graphics, /\bqueuedSummary\b/);
  assert.doesNotMatch(graphics, /maybePublishPendingSummary/);
  assert.match(graphics, /summaryStatusByKind = new Map\(\)/);
  assert.match(graphics, /summarySendInFlight = new Set\(\)/);
});

test("20 40 and 60 are one-time prompts per event and only exact minute hits count", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  assert.match(graphics, /const OUTPUT_MOMENTS = Object\.freeze\(\{[\s\S]*20: "PERIOD_1",[\s\S]*40: "PERIOD_2",[\s\S]*60: "FINAL"/);
  assert.match(graphics, /seenOutputMoments\.has\(kind\)/);
  assert.match(graphics, /seenOutputMoments\.add\(kind\)/);
  assert.match(graphics, /localStorage\.setItem\(outputMomentStorageKey/);
  assert.match(graphics, /return OUTPUT_MOMENTS\[minute\] \|\| ""/);
  assert.doesNotMatch(graphics, /minute\s*>=\s*60/);
});

test("manual period status buttons stay available even without an existing flyer", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const renderStatus = graphics.match(/function renderOutputStatus\(\)[\s\S]*?\n\}/)?.[0] || "";
  const clickBlock = graphics.match(/outputStatusButtons\.forEach\([\s\S]*?\n\}\)\);/)?.[0] || "";
  assert.match(renderStatus, /button\.disabled = !hasEvent/);
  assert.match(clickBlock, /summaryTextFromOutput\(kind\)/);
  assert.match(clickBlock, /openResults\(kind\)/);
  assert.doesNotMatch(clickBlock, /status !== "SUCCEEDED"/);
});

test("resend reuses the finished POST and creates a fresh delivery id without rendering", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const sendStart = graphics.indexOf("async function sendSummaryToWhatsapp");
  const sendEnd = graphics.indexOf("function currentOutputKind", sendStart);
  const block = graphics.slice(sendStart, sendEnd);
  assert.match(block, /const job = latestJob\(kind\)/);
  assert.match(block, /job\?\.status !== "SUCCEEDED"/);
  assert.match(block, /const post = postArtifactForJob\(job\)/);
  assert.match(block, /idempotencyKey: newRequestId\(\)/);
  assert.doesNotMatch(block, /liveticker_graphics_enqueue/);
  assert.match(graphics, /"📲 Erneut an WhatsApp senden"/);
});

test("minute and iOS page resume refresh status without generating a flyer", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const minute = graphics.match(/function handleMinuteDisplayChange\(\)[\s\S]*?\n\}/)?.[0] || "";
  assert.match(minute, /syncOutputMomentPrompt\(\)/);
  assert.match(minute, /render\(\)/);
  assert.doesNotMatch(minute, /enqueue\(/);
  assert.match(graphics, /minuteInput\?\.addEventListener\("input", handleMinuteDisplayChange\)/);
  assert.match(graphics, /minuteInput\?\.addEventListener\("change", handleMinuteDisplayChange\)/);
  assert.match(graphics, /visibilitychange[\s\S]*refreshAll\(\)/);
  assert.match(graphics, /pageshow[\s\S]*refreshAll\(\)/);
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

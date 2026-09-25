import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  isNewsletterChatStoreError,
  NEWSLETTER_RECOVERY_DELAYS_MS,
  sendWithNewsletterRecovery,
  WHATSAPP_DELIVERY_WINDOW_MS,
  WHATSAPP_SEND_BUDGET_MS
} from "../workers/liveticker-whatsapp/delivery.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const chatStoreError = new Error("Chat not found in ChatStore for 120363407159499081@newsletter");

test("delivery timing leaves a four-second gateway completion margin", async () => {
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");
  assert.equal(WHATSAPP_DELIVERY_WINDOW_MS, 14000);
  assert.equal(WHATSAPP_SEND_BUDGET_MS, 10000);
  assert.equal(WHATSAPP_DELIVERY_WINDOW_MS - WHATSAPP_SEND_BUDGET_MS, 4000);
  assert.match(worker, /WAHA_TIMEOUT_MS = Number\.parseInt\(process\.env\.WAHA_TIMEOUT_MS \|\| "10000", 10\)/);
  assert.match(worker, /Math\.min\(WAHA_TIMEOUT_MS, Math\.floor\(timeoutMs\)\)/);
});

test("successful WPP response completes on the first attempt", async () => {
  let calls = 0;
  const result = await sendWithNewsletterRecovery({
    send: async () => { calls += 1; return { messageId: "ok" }; },
    remainingMs: () => WHATSAPP_SEND_BUDGET_MS
  });
  assert.equal(result.messageId, "ok");
  assert.equal(calls, 1);
});

test("newsletter ChatStore failure resolves the known channel and retries inside the budget", async () => {
  let now = 0;
  let calls = 0;
  let resolves = 0;
  const retries = [];
  const result = await sendWithNewsletterRecovery({
    send: async () => {
      calls += 1;
      if (calls === 1) throw chatStoreError;
      return { messageId: "recovered" };
    },
    resolveNewsletter: async () => { resolves += 1; },
    markRetrying: async (_error, attempt) => { retries.push(attempt); },
    remainingMs: () => WHATSAPP_SEND_BUDGET_MS - now,
    sleep: async delay => { now += delay; }
  });
  assert.equal(result.messageId, "recovered");
  assert.equal(calls, 2);
  assert.equal(resolves, 1);
  assert.deepEqual(retries, [2]);
  assert.ok(now < WHATSAPP_SEND_BUDGET_MS);
});

test("newsletter recovery stops after the bounded short retries", async () => {
  let now = 0;
  let calls = 0;
  await assert.rejects(sendWithNewsletterRecovery({
    send: async () => { calls += 1; throw chatStoreError; },
    resolveNewsletter: async () => {},
    markRetrying: async () => {},
    remainingMs: () => WHATSAPP_SEND_BUDGET_MS - now,
    sleep: async delay => { now += delay; }
  }), /Chat not found in ChatStore/);
  assert.equal(calls, NEWSLETTER_RECOVERY_DELAYS_MS.length + 1);
  assert.ok(now < WHATSAPP_SEND_BUDGET_MS);
  assert.ok(WHATSAPP_SEND_BUDGET_MS < WHATSAPP_DELIVERY_WINDOW_MS);
});

test("ambiguous network errors are not blindly retried", async () => {
  let calls = 0;
  await assert.rejects(sendWithNewsletterRecovery({
    send: async () => { calls += 1; throw new Error("fetch failed"); },
    remainingMs: () => WHATSAPP_SEND_BUDGET_MS
  }), /fetch failed/);
  assert.equal(calls, 1);
  assert.equal(isNewsletterChatStoreError(chatStoreError), true);
  assert.equal(isNewsletterChatStoreError(new Error("other failure")), false);
});

test("an ambiguous sticker timeout is attempted exactly once", async () => {
  let calls = 0;
  const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  await assert.rejects(sendWithNewsletterRecovery({
    send: async () => { calls += 1; throw timeout; },
    remainingMs: () => WHATSAPP_SEND_BUDGET_MS
  }), error => error === timeout);
  assert.equal(calls, 1);
});

test("gateway makes failures terminal until the explicit same-job retry RPC", async () => {
  const [gateway, worker, migration] = await Promise.all([
    read("supabase/functions/liveticker-whatsapp-worker/index.ts"),
    read("workers/liveticker-whatsapp/worker.mjs"),
    read("supabase/migrations/20260917062900_liveticker_whatsapp_delivery_retry_dev_r1.sql")
  ]);
  const claim = gateway.match(/async function claim\(\)[\s\S]+?\n\}/)?.[0] || "";
  const fail = gateway.match(/async function fail\(body: JsonObject\)[\s\S]+?\n\}/)?.[0] || "";
  assert.match(claim, /status: "eq\.PENDING"/);
  assert.doesNotMatch(claim, /status\.eq\.FAILED|status\.eq\.PROCESSING/);
  assert.match(fail, /retryable: false, nextAttemptAt: null/);
  assert.match(worker, /WHATSAPP_DELIVERY_WINDOW_MS/);
  assert.match(worker, /WHATSAPP_SEND_BUDGET_MS/);
  assert.match(worker, /action: "retrying"/);
  assert.match(worker, /channels\/\$\{encodeURIComponent\(WAHA_CHANNEL_ID\)\}/);
  assert.match(migration, /update app_modules\.liveticker_whatsapp_jobs[\s\S]*where id = v_job\.id[\s\S]*status = 'FAILED'/i);
});

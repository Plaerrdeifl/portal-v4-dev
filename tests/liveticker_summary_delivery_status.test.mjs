import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("summary WhatsApp UI waits for real delivery success", async () => {
  const graphics = await read("js/liveticker-graphics-inline.js");
  const html = await read("liveticker/index.html");
  const auth = await read("js/liveticker-auth-bootstrap.js");

  assert.match(graphics, /liveticker_whatsapp_deliveries_list/);
  assert.match(graphics, /queued\?\.delivery\?\.id/);
  assert.match(graphics, /status === "SUCCEEDED"/);
  assert.match(graphics, /status === "FAILED"/);
  assert.match(graphics, /POST \+ Text erfolgreich an WhatsApp gesendet/);
  assert.match(graphics, /WhatsApp-Versand fehlgeschlagen/);
  assert.match(graphics, /SUMMARY_DELIVERY_KEY/);
  assert.match(graphics, /resumeSummaryDeliveryTracking\(\)/);
  assert.match(graphics, /notice\.state === "success" \? "success"/);
  assert.doesNotMatch(graphics, /POST \+ Text an WhatsApp übergeben\./);

  assert.match(html, /graphic-status\[data-state="success"\]/);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260926-live-stability-r2/);
  assert.match(auth, /liveticker-graphics-inline\.js\?v=20260920-summary-delivery-status-r1/);
});

test("WhatsApp worker supports image delivery completion components", async () => {
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");
  const delivery = await read("workers/liveticker-whatsapp/delivery.mjs");

  assert.match(worker, /async function sendImageToWaha/);
  assert.match(worker, /image: normalized\.image \? \{/);
  assert.match(worker, /sendImage: currentJob =>/);
  assert.match(worker, /job_image_sent/);

  assert.match(delivery, /IMAGE_WITH_CAPTION/);
  assert.match(delivery, /record\.image/);
  assert.match(delivery, /sendImage/);
  assert.match(delivery, /imageSentThisRun/);
});

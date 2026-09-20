import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("compact text mode switch controls WhatsApp auto-send and copy fallback", async () => {
  const [publish, engine, bootstrap, html] = await Promise.all([
    read("js/liveticker-whatsapp-publish.js"),
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-bootstrap.js"),
    read("liveticker/index.html")
  ]);

  assert.doesNotMatch(publish, /liveticker-whatsapp-panel/);
  assert.match(publish, /TEXT_MODE_ID = "livetickerTextMode"/);
  assert.match(publish, /data-text-mode="WHATSAPP"/);
  assert.match(publish, /data-text-mode="COPY"/);
  assert.match(publish, /📲 WhatsApp/);
  assert.match(publish, /📋 Nur kopieren/);
  assert.match(publish, /manualCopyMode = true/);
  assert.match(publish, /transportReady\(\) && !manualCopyMode \? "WHATSAPP" : "COPY"/);
  assert.match(publish, /enabled: effectiveTextMode\(\) === "WHATSAPP"/);
  assert.match(publish, /PD_LIVETICKER_TEXT_MODE = mode/);

  assert.match(engine, /PD_LIVETICKER_TEXT_MODE/);
  assert.match(engine, /return Boolean\(runtime\?\.ready\) && mode === "WHATSAPP"/);
  assert.match(engine, /const whatsappEnabled = !editingId && whatsappAutoSendReady\(\)/);
  assert.match(engine, /pd-liveticker-text-mode/);

  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260919-live-safety-r1/);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260920-summary-delivery-status-r1/);
});

test("compact switch sits in submit row and delivery status moves below it", async () => {
  const publish = await read("js/liveticker-whatsapp-publish.js");
  assert.match(publish, /submitRow\.insertBefore\(mode, submitRow\.firstChild\)/);
  assert.match(publish, /\.liveticker-text-mode\{grid-column:1;grid-row:1/);
  assert.match(publish, /\.liveticker-submit-row \.liveticker-text-delivery-status\{grid-column:1\/-1;grid-row:2\}/);
  assert.match(publish, /\.liveticker-submit-row \.submit-compact\{grid-column:2;grid-row:1\}/);
});

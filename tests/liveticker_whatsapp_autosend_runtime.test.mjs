import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("WhatsApp text auto-send depends only on runtime readiness, not a second checkbox", async () => {
  const [publish, engine, bootstrap, html] = await Promise.all([
    read("js/liveticker-whatsapp-publish.js"),
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-bootstrap.js"),
    read("liveticker/index.html")
  ]);
  assert.doesNotMatch(publish, /type="checkbox"[^>]*livetickerWhatsappPublish/);
  assert.doesNotMatch(publish, /control\?\.checked/);
  assert.match(publish, /enabled: transportReady\(\)/);
  assert.match(publish, /WA aktiv · neue Aktionen werden automatisch gesendet/);
  assert.doesNotMatch(engine, /livetickerWhatsappPublish/);
  assert.match(engine, /function whatsappAutoSendReady\(\)[\s\S]*Boolean\(runtime\?\.ready\)/);
  assert.match(engine, /whatsappEnabled: !editingId/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260918-text-autosend-r1/);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260918-text-autosend-r1/);
});

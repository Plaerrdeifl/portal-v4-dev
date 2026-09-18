import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("removed WhatsApp panel identifier is not referenced after compact mode migration", async () => {
  const [publish, bootstrap, html] = await Promise.all([
    read("js/liveticker-whatsapp-publish.js"),
    read("js/liveticker-bootstrap.js"),
    read("liveticker/index.html")
  ]);

  assert.doesNotMatch(publish, /WHATSAPP_PANEL_ID/);
  assert.doesNotMatch(publish, /livetickerWhatsappPanel/);
  assert.match(publish, /function syncActionModeUi\(\)[\s\S]*submitRow\.hidden = situation/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260918-text-mode-r2/);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260918-text-mode-r2/);
});

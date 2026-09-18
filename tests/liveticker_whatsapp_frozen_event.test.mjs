import assert from "node:assert/strict";
import test from "node:test";
import { attachSubmitWhatsappIntent } from "../js/liveticker-engine-v4.js";

test("WhatsApp intent decorates frozen penalty events without mutating them", () => {
  const original = Object.freeze({
    id: "pen-1",
    type: "penalty",
    minute: 17,
    penalties: [{ team: "opponent", duration: "2", reason: "Beinstellen", player: null }]
  });

  const decorated = attachSubmitWhatsappIntent(original, "17 Spielminute\nStrafe(n)", {
    enabled: true,
    editingId: null
  });

  assert.notEqual(decorated, original);
  assert.equal(Object.isExtensible(original), false);
  assert.equal(Object.hasOwn(original, "_whatsapp"), false);
  assert.deepEqual(decorated._whatsapp, { publish: true, text: "17 Spielminute\nStrafe(n)" });
  assert.equal(decorated.type, "penalty");
});

test("WhatsApp intent returns the original event unchanged when sending is disabled", () => {
  const original = Object.freeze({ id: "pen-2", type: "penalty", minute: 18, penalties: [] });
  const result = attachSubmitWhatsappIntent(original, "Text", { enabled: false });
  assert.equal(result, original);
});

test("submit uses the decorated event returned by attachSubmitWhatsappIntent", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.resolve(import.meta.dirname, "..");
  const engine = await fs.readFile(path.join(root, "js/liveticker-engine-v4.js"), "utf8");
  assert.match(engine, /let tickerEvent = buildTickerEvent\(\)/);
  assert.match(engine, /tickerEvent = attachSubmitWhatsappIntent\(tickerEvent, output\.value,/);
});

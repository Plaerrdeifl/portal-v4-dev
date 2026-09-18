import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("new text actions carry the WhatsApp publish intent before persistence", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  assert.match(engine, /export function attachSubmitWhatsappIntent\(tickerEvent, text,/);
  assert.match(engine, /return \{[\s\S]*\.\.\.tickerEvent,[\s\S]*_whatsapp: Object\.freeze\(\{ publish: true, text: message \}\)/);
  assert.match(engine, /if \(!tickerEvent \|\| editingId \|\| !enabled/);

  const submitStart = engine.indexOf('form.addEventListener("submit"');
  const persistStart = engine.indexOf("completeTickerSubmitLifecycle({", submitStart);
  const intentStart = engine.indexOf("attachSubmitWhatsappIntent(tickerEvent, output.value", submitStart);
  assert.ok(submitStart >= 0);
  assert.ok(intentStart > submitStart);
  assert.ok(persistStart > intentStart);
  assert.match(engine.slice(submitStart, persistStart), /const whatsappEnabled = !editingId && whatsappAutoSendReady\(\)/);
});

test("direct intent rollout cache marker reaches the liveticker bootstrap chain", async () => {
  const [html, auth, bootstrap] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js")
  ]);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260918-delete-guard-r1/);
  assert.match(auth, /liveticker-bootstrap\.js\?v=20260918-delete-guard-r1/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260918-delete-guard-r1/);
});

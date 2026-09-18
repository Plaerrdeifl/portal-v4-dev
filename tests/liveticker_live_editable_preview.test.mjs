import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  historyWithDraftEvent,
  shouldCopyLivetickerOutput
} from "../js/liveticker-engine-v4.js";

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("draft history inserts a new action and replaces the edited action without mutating saved history", () => {
  const saved = [
    { id: "one", type: "goal", team: "mighty", minute: 1 },
    { id: "two", type: "goal", team: "opponent", minute: 2 }
  ];
  const added = { id: "draft", type: "goal", team: "mighty", minute: 3 };
  const preview = historyWithDraftEvent(saved, null, added);
  assert.deepEqual(preview.map(item => item.id), ["one", "two", "draft"]);
  assert.deepEqual(saved.map(item => item.id), ["one", "two"]);

  const edited = { id: "two", type: "goal", team: "mighty", minute: 4 };
  const editPreview = historyWithDraftEvent(saved, "two", edited);
  assert.deepEqual(editPreview.map(item => item.id), ["one", "two"]);
  assert.equal(editPreview[1].minute, 4);
  assert.equal(saved[1].minute, 2);
});

test("submit copies only when automatic WhatsApp delivery is not both enabled and ready", () => {
  assert.equal(shouldCopyLivetickerOutput({ whatsappEnabled: true, transportReady: true }), false);
  assert.equal(shouldCopyLivetickerOutput({ whatsappEnabled: true, transportReady: false }), true);
  assert.equal(shouldCopyLivetickerOutput({ whatsappEnabled: false, transportReady: true }), true);
  assert.equal(shouldCopyLivetickerOutput({ whatsappEnabled: false, transportReady: false }), true);
});

test("live preview uses the same draft builder and formatter before submit", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  assert.match(engine, /function buildTickerEvent\(\)/);
  assert.match(engine, /function draftOutputText\(tickerEvent\)[\s\S]*historyWithDraftEvent\(state\.history, editingId, tickerEvent\)[\s\S]*formatEventText\(tickerEvent, previewHistory, opponent\(\)\)/);
  assert.match(engine, /function refreshDraftOutput\([\s\S]*const tickerEvent = buildTickerEvent\(\);[\s\S]*setOutput\(text\)/);
  assert.match(engine, /form\.addEventListener\("input",[\s\S]*refreshDraftOutput/);
  assert.match(engine, /form\.addEventListener\("change",[\s\S]*refreshDraftOutput/);
  assert.match(engine, /const tickerEvent = buildTickerEvent\(\);[\s\S]*if \(!outputManuallyEdited\) setOutput\(draftOutputText\(tickerEvent\)\)/);
});

test("manual preview edits are sticky for the current action and the preview save button does not copy or send", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  assert.match(engine, /if \(outputManuallyEdited && !force\) return/);
  assert.match(engine, /output\?\.addEventListener\("input",[\s\S]*outputManuallyEdited = true/);
  const previewSave = engine.match(/saveOutputButton\?\.addEventListener\("click",[\s\S]*?\n  \}\);/)?.[0] || "";
  assert.match(previewSave, /showOutputPreview\(\)/);
  assert.match(previewSave, /Text übernommen/);
  assert.doesNotMatch(previewSave, /copyCurrentOutput|dispatchEvent|saveState/);
});

test("state-saved captures the visible text at persist time and WhatsApp uses that immutable snapshot", async () => {
  const [bootstrap, publish] = await Promise.all([
    read("js/liveticker-bootstrap.js"),
    read("js/liveticker-whatsapp-publish.js")
  ]);
  assert.match(bootstrap, /const outputText = String\(document\.getElementById\("tickerOutput"\)\?\.value \|\| ""\);/);
  assert.match(bootstrap, /CustomEvent\("pd-liveticker-state-saved", \{ detail: \{ state, outputText \} \}\)/);
  assert.match(publish, /const outputText = typeof event\.detail\?\.outputText === "string"[\s\S]*text: outputText/);
});

test("submit sends when WhatsApp is ready and otherwise copies exactly the current preview", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  const submit = engine.match(/form\.addEventListener\("submit",[\s\S]*?\n  \}\);/)?.[0] || "";
  assert.match(submit, /const copyAfterSave = shouldCopyLivetickerOutput/);
  assert.match(submit, /const whatsappEnabled = !editingId && whatsappAutoSendReady\(\)/);
  assert.match(submit, /if \(copyAfterSave\) \{[\s\S]*void copyCurrentOutput\(\);[\s\S]*\} else \{[\s\S]*Wird an WhatsApp gesendet/);
  assert.doesNotMatch(submit, /setOutput\(formatEventText/);
});

test("editable WhatsApp preview is physically before the save/send control", async () => {
  const html = await read("liveticker/index.html");
  const previewIndex = html.indexOf('id="whatsappOutput"');
  const submitIndex = html.indexOf('id="livetickerSubmitRow"');
  assert.ok(previewIndex >= 0 && submitIndex > previewIndex);
  assert.match(html, /id="outputTitle">WhatsApp-Vorschau<\/h2>/);
  assert.match(html, /id="saveOutputButton"[^>]*aria-label="Text übernehmen"/);
});

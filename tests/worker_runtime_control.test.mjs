import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("Liveticker exposes manual worker control and blocks graphics until ready", async () => {
  const html = await read("liveticker/index.html");
  const js = await read("js/liveticker-graphics-inline.js");
  assert.match(html, /id="graphicWorkerToggle"/);
  assert.match(html, /id="graphicWorkerStatus"/);
  assert.match(js, /worker_runtime_status/);
  assert.match(js, /worker_runtime_set/);
  assert.match(js, /LIVETICKER_GRAPHICS/);
  assert.match(js, /Boolean\(workerRuntime\?\.ready\)/);
  assert.match(js, /Worker deaktiviert – Grafik-Erstellung derzeit nicht möglich\./);
  const fullRefresh = js.match(/function scheduleFullRefresh\([\s\S]*?\n}\n/);
  assert.ok(fullRefresh, "scheduleFullRefresh must exist");
  assert.doesNotMatch(fullRefresh[0], /clearWorkerRefreshTimer\(\)/);
});


test("Liveticker game mode keeps the live workflow compact and one-tap", async () => {
  const html = await read("liveticker/index.html");
  const engine = await read("js/liveticker-engine-v4.js");
  const graphics = await read("js/liveticker-graphics-inline.js");
  const storage = await read("js/liveticker-game-storage.js");
  const support = await read("js/liveticker-v5-support.js");
  assert.match(html, /id="submitButton"[^>]*>Speichern &amp; kopieren<\/button>/);
  assert.match(html, /id="tickerOutputPreview"/);
  assert.match(html, /id="editOutputButton"[^>]*>Bearbeiten<\/button>/);
  assert.match(html, /id="saveOutputButton"[^>]*>Speichern &amp; kopieren<\/button>/);
  assert.match(html, /id="historyToggle"/);
  assert.match(html, /class="live-game-row"[\s\S]*class="score-top compact-score"[\s\S]*id="gameMinute"/);
  assert.match(html, /class="field opponent-field" hidden/);
  assert.doesNotMatch(html, /primary-output-wrap\{position:sticky/);
  assert.match(storage, /liveticker-sync-status\[data-state="error"\]\{display:block/);
  assert.doesNotMatch(support, /<span class="label">Spielort<\/span>/);
  assert.match(engine, /ordered\.slice\(0, 5\)/);
  assert.match(engine, /data-expand=/);
  assert.match(engine, /void copyCurrentOutput\(\)/);
  assert.match(html, /id="primaryOutputButton"/);
  assert.match(graphics, /function currentOutputKind\(\)/);
  assert.match(graphics, /BUTTONS\[kind\]\?\.click\(\)/);
  assert.match(html, /data-output-status="PERIOD_1"/);
  assert.match(html, /data-output-status="PERIOD_2"/);
  assert.match(html, /data-output-status="FINAL"/);
  assert.doesNotMatch(html, /Spiel schnell mittickern/);
});

test("Fanbus Social Media exposes manual worker control and blocks flyer generation until ready", async () => {
  const js = await read("js/modules/m340-publishing.js");
  assert.match(js, /data-m340-worker-toggle/);
  assert.match(js, /worker_runtime_status/);
  assert.match(js, /worker_runtime_set/);
  assert.match(js, /FANBUS_PUBLISHING/);
  assert.match(js, /Boolean\(model\?\.workerRuntime\?\.ready\)/);
  assert.match(js, /Worker deaktiviert – Flyer-Erstellung derzeit nicht möglich\./);
});

test("worker runtimes use 60 second disabled and 5 second active polling", async () => {
  const migration = await read("supabase/migrations/20260909115912_worker_runtime_controls_r1.sql");
  const fanbusWorker = await read("workers/m340-publishing/worker.py");
  const livetickerWorker = await read("workers/liveticker-publishing/publishing_worker_dev.py");
  assert.match(migration, /'activePollSeconds',5,'disabledPollSeconds',60/);
  assert.match(fanbusWorker, /poll_seconds not in \(5, 60\)/);
  assert.match(fanbusWorker, /LAST_POLL_SECONDS = 60/);
  assert.match(livetickerWorker, /activePollSeconds.*5/);
  assert.match(livetickerWorker, /disabledPollSeconds.*60/);
  assert.match(livetickerWorker, /sleep_seconds = 60/);
  assert.match(livetickerWorker, /sleep_seconds = 5/);
});

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

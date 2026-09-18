import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("worker statuses and current period use separate centered rows without horizontal page growth", async () => {
  const html = await read("liveticker/index.html");
  const workerStart = html.indexOf('class="worker-status-bar"');
  const periodStart = html.indexOf('class="segment-status-bar"');
  const gameStart = html.indexOf('class="game-meta"');
  assert.ok(workerStart >= 0);
  assert.ok(periodStart > workerStart);
  assert.ok(gameStart > periodStart);
  const workerBlock = html.slice(workerStart, periodStart);
  const periodBlock = html.slice(periodStart, gameStart);
  assert.match(workerBlock, /id="graphicWorkerControl"/);
  assert.match(workerBlock, /id="whatsappWorkerControl"/);
  assert.match(workerBlock, /id="wppControl"/);
  assert.doesNotMatch(workerBlock, /id="segmentLabel"/);
  assert.match(periodBlock, /id="segmentLabel"/);
  assert.match(periodBlock, /id="shootoutStatus"/);
  assert.doesNotMatch(periodBlock, /worker-control/);
  assert.match(html, /\.worker-status-bar\{[^}]*max-width:100%/);
  assert.match(html, /\.status-bar-tools\{[^}]*flex-wrap:wrap[^}]*max-width:100%/);
  assert.match(html, /\.segment-status-bar\{[^}]*justify-content:center/);
});

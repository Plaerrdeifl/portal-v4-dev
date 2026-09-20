import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("successful FINAL output completes the game through a semantic archive event", async () => {
  const [graphics, storage] = await Promise.all([
    read("js/liveticker-graphics-inline.js"),
    read("js/liveticker-game-storage.js")
  ]);

  assert.match(graphics, /let pendingFinalizationJobId = ""/);
  assert.match(graphics, /kind === "FINAL" && validUuid\(jobId\)/);
  assert.match(graphics, /job\.status !== "SUCCEEDED"/);
  assert.match(graphics, /new CustomEvent\("pd-liveticker-final-output-ready"/);
  assert.match(storage, /window\.addEventListener\("pd-liveticker-final-output-ready"/);
  assert.match(storage, /eventId !== selectedGame\.eventId/);
  assert.match(storage, /completeSelectedGame\(\)/);
  assert.doesNotMatch(storage, /#finalSummaryButton/);
});

test("archive reset is a DEV-local tool and is not enabled for PROD", async () => {
  const admin = await read("js/modules/liveticker-admin.js");
  assert.match(admin, /function archiveResetAllowed\(\)/);
  assert.match(admin, /host==="dev\.plaerrdeifl\.de"/);
  assert.match(admin, /host==="localhost"/);
  assert.doesNotMatch(admin, /host==="portal\.plaerrdeifl\.de"/);
  assert.match(admin, /archiveResetAllowed\(\)\?'<div class="button-row">/);
});

test("archive finalization runtime chain is cache-busted end-to-end", async () => {
  const [html, auth, bootstrap, pages] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js"),
    read("js/pages.js")
  ]);

  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260920-missing-fragments-r1/);
  assert.match(auth, /liveticker-bootstrap\.js\?v=20260920-missing-fragments-r1/);
  assert.match(auth, /liveticker-graphics-inline\.js\?v=20260920-archive-finalization-r1/);
  assert.match(bootstrap, /liveticker-game-storage\.js\?v=20260920-archive-finalization-r1/);
  assert.match(pages, /liveticker-admin\.js\?v=20260920-archive-finalization-r1/);
});

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const NEW_CACHE = "pd-portal-v4-push-newtasks-quiettime-r1-20260723";
const OLD_CACHE = [
  "pd-portal-v4-task-history-r1",
  "30min-20260723"
].join("-");

async function collectTests(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectTests(path));
    } else if (
      entry.isFile()
      && entry.name.endsWith(".test.mjs")
      && entry.name !== "task_history_showtoast_fix7.test.mjs"
    ) {
      files.push(path);
    }
  }

  return files;
}

test("task history imports toast helper and all cache contracts agree", async () => {
  const tasks = await readFile("js/modules/tasks.js", "utf8");
  const worker = await readFile("service-worker.js", "utf8");

  const importBlock = tasks.match(
    /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/common\.js["'];/
  )?.[0] || "";

  assert.match(importBlock, /\bshowToast\b/);
  assert.match(tasks, /showToast\("Update wurde gespeichert\."/);
  assert.match(tasks, /showToast\("Update wurde korrigiert\."/);
  assert.match(tasks, /showToast\("Eintrag wurde ausgeblendet\."/);
  assert.match(worker, new RegExp(NEW_CACHE));

  const testFiles = await collectTests("tests");
  let newCacheReferences = 0;

  for (const path of testFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      new RegExp(OLD_CACHE),
      `Veralteter Cachevertrag in ${path}`
    );

    if (source.includes(NEW_CACHE)) {
      newCacheReferences += 1;
    }
  }

  assert.ok(
    newCacheReferences > 0,
    "Kein bestehender Test prüft die neue Cache-Version."
  );
});

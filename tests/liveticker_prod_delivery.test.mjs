import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("PROD static build publishes the standalone Liveticker route", async () => {
  const build = await read("scripts/build-static.mjs");
  assert.match(build, /"liveticker"/);
});

test("standalone Liveticker stays hidden until active authorized login", async () => {
  const html = await read("liveticker/index.html");
  const gate = await read("js/liveticker-auth-bootstrap.js");

  assert.match(html, /<main id="tickerApp" class="shell" hidden>/);
  assert.match(html, /liveticker-auth-bootstrap\.js/);
  assert.match(gate, /await auth\.initialize\(\)/);
  assert.match(gate, /!state\?\.authenticated/);
  assert.match(gate, /state\.status !== "ACTIVE"/);
  assert.match(gate, /!auth\.hasCapability\("liveticker\.manage"\)/);
  assert.match(gate, /window\.location\.replace\("\.\.\/#\/login"\)/);
  assert.match(gate, /app\.hidden = false/);
  assert.match(gate, /await import\("\.\/liveticker-bootstrap\.js/);
});

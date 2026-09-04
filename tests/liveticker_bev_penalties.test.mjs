import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BEV_PENALTY_DURATIONS,
  BEV_PENALTY_REASONS
} from "../js/liveticker-v5-support.js";

test("BEV 2026/27 penalty catalogue includes match and game misconduct values", () => {
  assert.ok(BEV_PENALTY_DURATIONS.includes("20"));
  assert.ok(BEV_PENALTY_DURATIONS.includes("25"));
  assert.ok(BEV_PENALTY_DURATIONS.includes("2+20"));
  assert.ok(BEV_PENALTY_REASONS.includes("Faustkampf"));
});

test("BEV catalogue is restored after core rebuilds penalty rows", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../js/liveticker-v5-support.js"), "utf8");
  assert.match(source, /patchPenaltyRowsAfterCore/);
  assert.match(source, /#addPenalty, #cancelEdit/);
  assert.match(source, /#resetGame/);
  assert.match(source, /form\.addEventListener\("submit"/);
});

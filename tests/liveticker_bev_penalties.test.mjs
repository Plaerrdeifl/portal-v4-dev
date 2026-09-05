import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BEV_PENALTY_DURATIONS,
  BEV_PENALTY_REASONS,
  applyPenaltyTerminology,
  isRecommendedPenaltyCombination,
  penaltyDurationLabel,
  penaltyRecommendation,
  recommendedReasonsForDuration
} from "../js/liveticker-v5-support.js";

test("BEV 2026/27 penalty catalogue includes match and game misconduct values", () => {
  assert.ok(BEV_PENALTY_DURATIONS.includes("20"));
  assert.ok(BEV_PENALTY_DURATIONS.includes("25"));
  assert.ok(BEV_PENALTY_DURATIONS.includes("2+20"));
  assert.ok(BEV_PENALTY_REASONS.includes("Faustkampf"));
});

test("penalty durations use hockey terminology instead of raw report minutes", () => {
  assert.equal(penaltyDurationLabel("20"), "Spieldauer");
  assert.equal(penaltyDurationLabel("25"), "Matchstrafe");
  assert.equal(penaltyDurationLabel("5+20"), "5 Min. + Spieldauer");
  assert.equal(
    applyPenaltyTerminology("Mighty Dogs · 5+20 min · Kniecheck"),
    "Mighty Dogs · 5 Min. + Spieldauer · Kniecheck"
  );
});

test("reason-first selection provides a normal default without blocking exceptions", () => {
  assert.equal(penaltyRecommendation("Haken").defaultDuration, "2");
  assert.ok(isRecommendedPenaltyCombination("Haken", "2"));
  assert.ok(isRecommendedPenaltyCombination("Haken", "5+20"));
  assert.equal(isRecommendedPenaltyCombination("Haken", "25"), false);
});

test("duration-first selection promotes matching reasons while preserving the full catalogue", () => {
  const majorReasons = recommendedReasonsForDuration("5+20");
  assert.ok(majorReasons.includes("Kniecheck"));
  assert.ok(majorReasons.includes("Slew-Footing"));
  assert.ok(majorReasons.includes("Faustkampf"));
  assert.ok(BEV_PENALTY_REASONS.includes("Halten"));
});

test("team penalties keep a two-minute default", () => {
  assert.equal(penaltyRecommendation("Zu viele Spieler auf dem Eis").defaultDuration, "2");
  assert.equal(penaltyRecommendation("Zu viele Spieler auf dem Eis").benchPenalty, true);
});

test("BEV catalogue is restored after core rebuilds penalty rows", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../js/liveticker-v5-support.js"), "utf8");
  assert.match(source, /patchPenaltyRowsAfterCore/);
  assert.match(source, /#addPenalty, #cancelEdit/);
  assert.match(source, /#resetGame/);
  assert.match(source, /form\.addEventListener\("submit"/);
  assert.match(source, /Sonderfall/);
  assert.match(source, /Weitere Strafarten/);
  assert.match(source, /Weitere Gründe/);
});

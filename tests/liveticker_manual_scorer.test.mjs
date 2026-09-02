import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { MIGHTY_ROSTER } from "../js/liveticker-prototype.js";
import {
  findPlayerByNumber,
  normalizeJerseyNumber,
  stripUnknownGoalPlaceholders
} from "../js/liveticker-manual-scorer.js";

const root = resolve(import.meta.dirname, "..");

test("direct jersey number finds the roster player", () => {
  assert.equal(normalizeJerseyNumber(" #84 "), "84");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "84")?.name, "Nils Melchior");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "#10")?.name, "Kevin Heckenberger");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "999"), null);
});

test("unknown scorer wording disappears from generated WhatsApp text", () => {
  const opponentGoal = [
    "29 Spielminute",
    "Tor Erfurt",
    "Torschütze noch offen",
    "",
    "Neuer Spielstand",
    "*1:1*"
  ].join("\n");
  const cleaned = stripUnknownGoalPlaceholders(opponentGoal);
  assert.doesNotMatch(cleaned, /Torschütze noch offen|Torschütze folgt/);
  assert.match(cleaned, /Tor Erfurt/);
  assert.match(cleaned, /\*1:1\*/);
});

test("summary keeps the goal minute but removes unknown scorer placeholder", () => {
  const cleaned = stripUnknownGoalPlaceholders("12 Spielminute – Torschütze noch offen");
  assert.equal(cleaned, "12 Spielminute");
});

test("number inputs are wired for scorer, both assists and every penalty player", async () => {
  const source = await readFile(resolve(root, "js/liveticker-manual-scorer.js"), "utf8");
  assert.match(source, /goalNumberDirect/);
  assert.match(source, /assist1NumberDirect/);
  assert.match(source, /assist2NumberDirect/);
  assert.match(source, /\[data-field='player'\]/);
  assert.match(source, /grid-template-columns:74px minmax\(0,1fr\)/);
});

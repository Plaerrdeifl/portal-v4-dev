import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  PENALTY_REASONS,
  ROSTER,
  formatTickerText
} from "../js/liveticker-prototype.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("public Liveticker prototype stays isolated and ships in the static build", async () => {
  const html = await read("liveticker/index.html");
  const build = await read("scripts/build-static.mjs");

  assert.match(html, /data-route="liveticker-prototype"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /Keine Anmeldung · keine Speicherung · keine Datenübertragung/);
  assert.match(html, /type="module" src="\.\.\/js\/liveticker-prototype\.js"/);
  assert.doesNotMatch(html, /supabase|auth-gate|runtime-config/i);
  assert.match(build, /"liveticker"/);
});

test("2026/27 Mighty Dogs roster is complete and grouped", () => {
  assert.equal(ROSTER.length, 18);
  assert.deepEqual(
    [...new Set(ROSTER.map(player => player.position))],
    ["Tor", "Verteidigung", "Sturm"]
  );
  assert.equal(ROSTER.filter(player => !player.number).length, 2);
  assert.ok(ROSTER.some(player => player.name === "Kevin Heckenberger" && player.number === "10"));
  assert.ok(ROSTER.some(player => player.name === "Ricards Bernhards" && player.number === ""));
});

test("goal text is formatted for WhatsApp", () => {
  assert.equal(
    formatTickerText({
      action: "GOAL",
      period: "2",
      gameMinute: "27",
      goalPlayer: { number: "10", name: "Kevin Heckenberger" }
    }),
    [
      "🥅 *TOR FÜR DIE MIGHTY DOGS!*",
      "",
      "🏒 #10 Kevin Heckenberger",
      "🕒 27. Spielminute · 2. Drittel"
    ].join("\n")
  );
});

test("penalty text handles duration, reason and optional player", () => {
  assert.ok(PENALTY_REASONS.includes("Halten"));
  assert.ok(PENALTY_REASONS.includes("Beinstellen"));
  assert.equal(
    formatTickerText({
      action: "PENALTY",
      period: "1",
      gameMinute: "9",
      penaltyDuration: "2",
      penaltyReason: "Beinstellen",
      penaltyPlayer: null
    }),
    [
      "⏱️ *STRAFE GEGEN DIE MIGHTY DOGS*",
      "",
      "🚨 2 Minuten · Beinstellen",
      "🕒 9. Spielminute · 1. Drittel"
    ].join("\n")
  );
});

test("invalid goal data is rejected with a practical message", () => {
  assert.throws(
    () => formatTickerText({
      action: "GOAL",
      period: "3",
      gameMinute: "61",
      goalPlayer: null
    }),
    /Spielminute zwischen 1 und 60/
  );
  assert.throws(
    () => formatTickerText({
      action: "GOAL",
      period: "3",
      gameMinute: "53",
      goalPlayer: null
    }),
    /Torschützen auswählen/
  );
});

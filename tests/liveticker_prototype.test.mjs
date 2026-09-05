import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  ERFURT_ROSTER,
  GOAL_POSITION_ORDER,
  MIGHTY_ROSTER,
  OPPONENTS,
  PENALTY_DURATIONS,
  PENALTY_POSITION_ORDER,
  PENALTY_REASONS
} from "../js/liveticker-prototype-v4.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("public DEV Liveticker stays standalone and uses the scoped Supabase storage boundary", async () => {
  const html = await read("liveticker/index.html");
  const bootstrap = await read("js/liveticker-bootstrap.js");
  const storage = await read("js/liveticker-game-storage.js");
  const build = await read("scripts/build-static.mjs");

  assert.match(html, /data-route="liveticker-prototype"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /script-src 'self' blob:/);
  assert.match(html, /connect-src 'self' https:\/\/\*\.supabase\.co/);
  assert.match(html, /Spielstand und Aktionen werden zentral pro Spiel gespeichert/);
  assert.match(html, /type="module" src="\.\.\/js\/liveticker-bootstrap\.js\?v=20260905-calendar1"/);
  assert.match(bootstrap, /runtime-config\.js/);
  assert.match(bootstrap, /importRuntimeEngine/);
  assert.match(storage, /pd_public_liveticker_games/);
  assert.match(storage, /pd_public_liveticker_state/);
  assert.match(storage, /pd_public_liveticker_sync/);
  assert.doesNotMatch(html + bootstrap + storage, /Google|auth-gate|Anmeldung erforderlich/i);
  assert.match(build, /"liveticker"/);
});

test("calendar owns opponent and home-away selection", async () => {
  const html = await read("liveticker/index.html");
  const bootstrap = await read("js/liveticker-bootstrap.js");
  const storage = await read("js/liveticker-game-storage.js");
  assert.match(html, /Gegner · aus Kalender/);
  assert.match(storage, /game\.homeAway === "AWAY" \? "away" : "home"/);
  assert.match(bootstrap, /opponentSelect\.disabled = true/);
  assert.match(bootstrap, /button\.disabled = true/);
});

test("manual period controls are gone and minute driven status is visible", async () => {
  const html = await read("liveticker/index.html");
  assert.doesNotMatch(html, /name="period"/);
  assert.doesNotMatch(html, /id="period[123]"/);
  assert.match(html, /id="segmentLabel"/);
  assert.match(html, /ab 61 = Overtime/);
  assert.doesNotMatch(html, /max="60"/);
});

test("goal editor exposes two optional assists, shootout and inline jersey inputs", async () => {
  const html = await read("liveticker/index.html");
  for (const id of ["goalNumber", "assist1Number", "assist2Number", "shootoutNumber"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="player-entry"/);
  assert.match(html, /id="assist1"/);
  assert.match(html, /id="assist2"/);
  assert.match(html, /id="actionShootout" name="action" type="radio" value="SHOOTOUT"/);
});

test("player ordering is context specific", () => {
  assert.deepEqual([...GOAL_POSITION_ORDER], ["Sturm", "Verteidigung", "Tor"]);
  assert.deepEqual([...PENALTY_POSITION_ORDER], ["Verteidigung", "Sturm", "Tor"]);
});

test("2026/27 Mighty Dogs fallback roster remains complete", () => {
  assert.equal(MIGHTY_ROSTER.length, 18);
  assert.equal(MIGHTY_ROSTER.filter(player => !player.number).length, 2);
  assert.ok(MIGHTY_ROSTER.some(player => player.name === "Kevin Heckenberger" && player.number === "10"));
});

test("Erfurt fallback remains available for module contract tests", () => {
  assert.equal(OPPONENTS.erfurt.shortName, "Erfurt");
  assert.equal(OPPONENTS.erfurt.roster, ERFURT_ROSTER);
  assert.ok(ERFURT_ROSTER.some(player => player.name === "Patrick Glatzel" && player.number === "37"));
});

test("penalty catalogue keeps common reasons and combination penalties", () => {
  assert.ok(PENALTY_REASONS.includes("Halten"));
  assert.ok(PENALTY_REASONS.includes("Beinstellen"));
  assert.ok(PENALTY_DURATIONS.includes("2+2"));
  assert.ok(PENALTY_DURATIONS.includes("5+20"));
});

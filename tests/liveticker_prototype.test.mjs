import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  ERFURT_ROSTER,
  MIGHTY_ROSTER,
  OPPONENTS,
  PENALTY_DURATIONS,
  PENALTY_REASONS
} from "../js/liveticker-prototype.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("public Liveticker prototype stays isolated and ships in the static build", async () => {
  const html = await read("liveticker/index.html");
  const build = await read("scripts/build-static.mjs");

  assert.match(html, /data-route="liveticker-prototype"/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /Keine Anmeldung · nur lokal auf diesem Gerät gespeichert · keine Datenübertragung/);
  assert.match(html, /type="module" src="\.\.\/js\/liveticker-prototype\.js"/);
  assert.doesNotMatch(html, /supabase|auth-gate|runtime-config/i);
  assert.match(build, /"liveticker"/);
});

test("manual period controls are gone and minute driven status is visible", async () => {
  const html = await read("liveticker/index.html");
  assert.doesNotMatch(html, /name="period"/);
  assert.doesNotMatch(html, /id="period[123]"/);
  assert.match(html, /id="segmentLabel"/);
  assert.match(html, /ab 61 = Overtime/);
  assert.doesNotMatch(html, /max="60"/);
});

test("goal editor exposes two optional assists and shootout as a separate action", async () => {
  const html = await read("liveticker/index.html");
  assert.match(html, /id="assist1"/);
  assert.match(html, /id="assist2"/);
  assert.match(html, /id="actionShootout" name="action" type="radio" value="SHOOTOUT"/);
  assert.match(html, /id="shootoutScored"/);
  assert.match(html, /id="shootoutMissed"/);
});

test("2026/27 Mighty Dogs roster remains complete and grouped", () => {
  assert.equal(MIGHTY_ROSTER.length, 18);
  assert.deepEqual(
    [...new Set(MIGHTY_ROSTER.map(player => player.position))],
    ["Tor", "Verteidigung", "Sturm"]
  );
  assert.equal(MIGHTY_ROSTER.filter(player => !player.number).length, 2);
  assert.ok(MIGHTY_ROSTER.some(player => player.name === "Kevin Heckenberger" && player.number === "10"));
  assert.ok(MIGHTY_ROSTER.some(player => player.name === "Ricards Bernhards" && player.number === ""));
});

test("Erfurt is available as the first opponent with its roster", () => {
  assert.equal(OPPONENTS.erfurt.shortName, "Erfurt");
  assert.equal(OPPONENTS.erfurt.fullName, "TecArt Black Dragons Erfurt");
  assert.equal(OPPONENTS.erfurt.roster, ERFURT_ROSTER);
  assert.ok(ERFURT_ROSTER.some(player => player.name === "Patrick Glatzel" && player.number === "37"));
  assert.ok(ERFURT_ROSTER.some(player => player.name === "Harrison Reed" && player.number === "83"));
});

test("penalty catalogue keeps common reasons and combination penalties", () => {
  assert.ok(PENALTY_REASONS.includes("Halten"));
  assert.ok(PENALTY_REASONS.includes("Beinstellen"));
  assert.ok(PENALTY_DURATIONS.includes("2+2"));
  assert.ok(PENALTY_DURATIONS.includes("2+10"));
  assert.ok(PENALTY_DURATIONS.includes("5+10"));
  assert.ok(PENALTY_DURATIONS.includes("5+20"));
});

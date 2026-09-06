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

test("calendar adapter accepts the current compact engine and injects calendar rosters", async () => {
  const adapter = await read("js/liveticker-bootstrap.js");
  const engine = await read("js/liveticker-engine-v4.js");

  const opponentSection = /export const OPPONENTS\s*=\s*Object\.freeze\(\{[\s\S]*?\}\);\s*(?=export const PENALTY_REASONS)/;
  const defaultStateSection = /function defaultState\(\)\s*\{[\s\S]*?\}\s*(?=function normalizeLoadedState)/;
  const rosterSection = /function rosterForTeam\(team,[^)]*\)\s*\{[\s\S]*?\}\s*(?=function fillPlayerSelect)/;

  assert.match(engine, opponentSection);
  assert.match(engine, defaultStateSection);
  assert.match(engine, rosterSection);
  assert.match(adapter, /replaceEngineSection/);
  assert.match(adapter, /PD_LIVETICKER_GAME_CONTEXT\?\.ownTeam\?\.players/);
  assert.match(adapter, /runtimeOpponentTeam\.players/);
  assert.doesNotMatch(adapter, /const opponentBlock = `export const OPPONENTS/);
});


test("PROD output templates stay authenticated and capability-gated", async () => {
  const migration = await read("supabase/migrations/20260906115000_liveticker_output_templates_prod_r1.sql");
  const storage = await read("js/liveticker-game-storage.js");
  const admin = await read("js/modules/liveticker-admin.js");

  assert.match(migration, /create function public\.pd_public_liveticker_templates\(\)/);
  assert.match(migration, /perform app_private\.liveticker_require_operator\(\)/);
  assert.match(migration, /revoke all on function public\.pd_public_liveticker_templates\(\) from public,anon,authenticated/);
  assert.match(migration, /grant execute on function public\.pd_public_liveticker_templates\(\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.pd_public_liveticker_templates\(\) to anon/);
  assert.match(storage, /Authorization: `Bearer \$\{token\}`/);
  assert.match(storage, /auth\.hasCapability\("liveticker\.manage"\)/);
  assert.match(admin, /call\("liveticker_output_templates_list"\)/);
  assert.match(admin, /call\("liveticker_output_template_save"/);
});

test("PROD editor ships the frozen four output contexts", async () => {
  const admin = await read("js/modules/liveticker-admin.js");
  const templates = await read("js/liveticker-output-templates.js");
  assert.match(admin, /Tore – Wir/);
  assert.match(admin, /Strafen – Wir/);
  assert.match(admin, /Tore – Die anderen/);
  assert.match(admin, /Strafen – Die anderen/);
  assert.match(templates, /ownPenaltyTemplate/);
  assert.match(templates, /opponentPenaltyTemplate/);
});

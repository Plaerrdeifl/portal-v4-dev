import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("runtime calendar adapter preserves the penalty-shot goalie helper", async () => {
  const [engine, bootstrap] = await Promise.all([
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-bootstrap.js")
  ]);

  assert.match(bootstrap, /\(\?=function goalieRosterForTeam\)/);
  assert.doesNotMatch(bootstrap, /\(\?=function fillPlayerSelect\)/);

  const pattern = /function rosterForTeam\(team,[^)]*\)\s*\{[\s\S]*?\}\s*(?=function goalieRosterForTeam)/;
  const replacement = [
    "function rosterForTeam(team, opponent) {",
    "  const ownRoster = globalThis.PD_LIVETICKER_GAME_CONTEXT?.ownTeam?.players;",
    "  return team === \"mighty\" ? (Array.isArray(ownRoster) ? ownRoster : MIGHTY_ROSTER) : opponent.roster;",
    "}",
    ""
  ].join("\n");
  const transformed = engine.replace(pattern, replacement);

  assert.notEqual(transformed, engine);
  assert.match(transformed, /function goalieRosterForTeam\(team, opponent\)/);
  assert.equal((transformed.match(/function goalieRosterForTeam/g) || []).length, 1);
});

test("goalie roster accepts both calendar display position Tor and DB/admin code GOALIE", async () => {
  const engine = await read("js/liveticker-engine-v4.js");

  assert.match(engine, /player\.position === "Tor" \|\| player\.position === "GOALIE"/);
  assert.match(engine, /player\.position === "GOALIE" \? \{ \.\.\.player, position: "Tor" \} : player/);
  assert.match(engine, /fillPlayerSelect\(penaltyShotGoalie,[\s\S]*\["Tor"\]\)/);
});

test("goalie fix cache marker reaches the runtime engine chain", async () => {
  const [html, auth, bootstrap] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js")
  ]);

  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260918-whatsapp-frozen-r1/);
  assert.match(auth, /liveticker-bootstrap\.js\?v=20260918-whatsapp-frozen-r1/);
  assert.match(bootstrap, /fetch\("\.\.\/js\/liveticker-engine-v4\.js", \{ cache: "no-store" \}\)/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260918-whatsapp-frozen-r1/);
});

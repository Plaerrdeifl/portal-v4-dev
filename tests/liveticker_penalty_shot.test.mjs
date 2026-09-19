import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  calculateScore,
  formatEventText,
  formatFinalSummary,
  formatSegmentSummary,
  isPenaltyShotEvent
} from "../js/liveticker-engine-v4.js";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const opponent = { shortName: "Bayreuth" };
const shooter = { number: "10", name: "Kevin Heckenberger", position: "Sturm" };
const goalie = { number: "30", name: "Test Goalie", position: "Tor" };

function penaltyShot(result = "missed") {
  return {
    id: "ps-1",
    type: "penalty",
    subtype: "penalty_shot",
    minute: 18,
    team: "mighty",
    player: shooter,
    goalie,
    result,
    penalties: [{ team: "opponent", duration: "Penalty", reason: "Straf-Penalty", player: null }]
  };
}

test("Straf-Penalty is a penalty subtype and not a shootout attempt", () => {
  assert.equal(isPenaltyShotEvent(penaltyShot()), true);
  assert.equal(isPenaltyShotEvent({ type: "shootout" }), false);
});

test("converted Straf-Penalty counts as a regular game goal, missed one does not", () => {
  assert.deepEqual(calculateScore([penaltyShot("missed")]), { mighty: 0, opponent: 0 });
  assert.deepEqual(calculateScore([penaltyShot("scored")]), { mighty: 1, opponent: 0 });
});

test("Straf-Penalty text includes minute, shooter, defending goalie and result", () => {
  const event = penaltyShot("scored");
  const text = formatEventText(event, [event], opponent);
  assert.match(text, /Straf-Penalty/);
  assert.match(text, /18 Spielminute/);
  assert.match(text, /Mighty Dogs · Schütze: #10 Kevin Heckenberger/);
  assert.match(text, /Bayreuth · Goalie: #30 Test Goalie/);
  assert.match(text, /✅ verwandelt/);
  assert.doesNotMatch(text, /Penaltyschießen/);
});

test("converted Straf-Penalty is reflected in period and final summaries", () => {
  const event = penaltyShot("scored");
  const period = formatSegmentSummary([event], "P1", opponent);
  const final = formatFinalSummary([event], opponent);
  assert.match(period, /Ende 1\. Drittel – 1:0/);
  assert.match(period, /Straf-Penalty · #10 Kevin Heckenberger/);
  assert.match(final, /Mighty Dogs 1:0 Bayreuth/);
  assert.match(final, /Straf-Penalty · #10 Kevin Heckenberger/);
  assert.match(final, /Straf-Penalty · #10 Kevin Heckenberger gegen #30 Test Goalie · verwandelt/);
});

test("Situation UI exposes Straf-Penalty with attacking shooter, defending goalie and result", async () => {
  const [html, engine, publish, bootstrap] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-whatsapp-publish.js"),
    read("js/liveticker-bootstrap.js")
  ]);
  assert.match(html, /id="situationPenaltyShot"[^>]*name="situationType"[^>]*value="PENALTY_SHOT"/);
  assert.match(html, /id="penaltyShotTeam"/);
  assert.match(html, /id="penaltyShotPlayer"/);
  assert.match(html, /id="penaltyShotGoalie"/);
  assert.match(html, /name="penaltyShotResult"/);
  assert.match(engine, /subtype: "penalty_shot"/);
  assert.match(engine, /goalieRosterForTeam\(defendingTeam\(penaltyShotTeam\.value\)/);
  assert.match(engine, /fillPlayerSelect\(penaltyShotGoalie,[\s\S]*\["Tor"\]\)/);
  assert.match(publish, /penaltyShotSituationSelected/);
  assert.match(publish, /selectedAction\(\) === "SITUATION" && !penaltyShotSituationSelected\(\)/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260919-live-safety-r1/);
});

test("Straf-Penalty reuses the existing penalty action type", async () => {
  const engine = await read("js/liveticker-engine-v4.js");
  const buildStart = engine.indexOf("function buildTickerEvent()");
  const buildEnd = engine.indexOf("function draftOutputText", buildStart);
  const build = engine.slice(buildStart, buildEnd);
  assert.match(build, /type: "penalty"/);
  assert.match(build, /subtype: "penalty_shot"/);
  assert.match(build, /penalties: \[\{ team: defending, duration: "Penalty", reason: "Straf-Penalty", player: null \}\]/);
  assert.doesNotMatch(build, /^\s*type: "penalty_shot"/m);
});

test("saved Straf-Penalty resets its draft controls without turning it into a sticker-only submit race", async () => {
  const [engine, publish] = await Promise.all([
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-whatsapp-publish.js")
  ]);
  assert.match(engine, /function resetPenaltyShotDraft\(\)[\s\S]*situationPenaltyShot\.checked = false/);
  assert.match(engine, /penaltyShotTeam.value = "mighty"/);
  assert.match(engine, /penaltyShotNumber.value = ""/);
  assert.match(engine, /penaltyShotGoalieNumber.value = ""/);
  assert.match(engine, /pd-liveticker-action-mode-changed/);
  assert.match(engine, /isPenaltyShotEvent\(tickerEvent\)[\s\S]*resetPenaltyShotDraft\(\)/);
  assert.match(publish, /pd-liveticker-action-mode-changed[\s\S]*syncActionModeUi\(\)/);
});

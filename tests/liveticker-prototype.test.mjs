import test from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_POSITION_ORDER,
  MIGHTY_ROSTER,
  OPPONENTS,
  PENALTY_POSITION_ORDER,
  calculateOfficialFinalScore,
  calculateScore,
  calculateShootout,
  findPlayerByNumber,
  formatFinalSummary,
  formatGoalText,
  formatSegmentSummary,
  isMajorPenalty,
  normalizeJerseyNumber,
  parsePenaltyDuration,
  segmentForMinute
} from "../js/liveticker-prototype-v4.js";

const opponent = OPPONENTS.erfurt;
const melchior = { number: "84", name: "Nils Melchior", position: "Sturm" };
const heckenberger = { number: "10", name: "Kevin Heckenberger", position: "Sturm" };
const bares = { number: "46", name: "Pavel Bares", position: "Sturm" };
const potvin = { number: "27", name: "Frédéric Potvin", position: "Sturm" };

function goal(id, team, minute, player, assists = [], style = "classic") {
  return { id, type: "goal", team, minute, player, assists, style };
}

test("game segment is derived only from the minute", () => {
  assert.equal(segmentForMinute(1).key, "P1");
  assert.equal(segmentForMinute(20).key, "P1");
  assert.equal(segmentForMinute(21).key, "P2");
  assert.equal(segmentForMinute(40).key, "P2");
  assert.equal(segmentForMinute(41).key, "P3");
  assert.equal(segmentForMinute(60).key, "P3");
  assert.equal(segmentForMinute(61).key, "OT");
  assert.equal(segmentForMinute(75).key, "OT");
});

test("player contexts use the intended practical roster order", () => {
  assert.deepEqual([...GOAL_POSITION_ORDER], ["Sturm", "Verteidigung", "Tor"]);
  assert.deepEqual([...PENALTY_POSITION_ORDER], ["Verteidigung", "Sturm", "Tor"]);
});

test("jersey number lookup accepts plain and hash-prefixed numbers", () => {
  assert.equal(normalizeJerseyNumber(" #84 "), "84");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "84")?.name, "Nils Melchior");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "#10")?.name, "Kevin Heckenberger");
  assert.equal(findPlayerByNumber(MIGHTY_ROSTER, "999"), null);
});

test("calculateScore ignores shootout attempts", () => {
  const history = [
    goal("g1", "mighty", 8, melchior),
    goal("g2", "opponent", 12, potvin),
    { id: "s1", type: "shootout", team: "mighty", player: melchior, result: "scored" },
    { id: "s2", type: "shootout", team: "opponent", player: potvin, result: "missed" }
  ];
  assert.deepEqual(calculateScore(history), { mighty: 1, opponent: 1 });
  assert.deepEqual(calculateShootout(history), { mighty: 1, opponent: 0 });
  assert.deepEqual(calculateOfficialFinalScore(history), { mighty: 2, opponent: 1, suffix: "n. P." });
});

test("overtime goal produces n. V. final result", () => {
  const history = [
    goal("g1", "mighty", 8, melchior),
    goal("g2", "opponent", 12, potvin),
    goal("g3", "mighty", 63, heckenberger)
  ];
  assert.deepEqual(calculateOfficialFinalScore(history), { mighty: 2, opponent: 1, suffix: "n. V." });
});

test("penalty duration parser handles combinations and major penalties", () => {
  assert.deepEqual(parsePenaltyDuration("2+2"), { parts: [2, 2], total: 4 });
  assert.deepEqual(parsePenaltyDuration("5+20"), { parts: [5, 20], total: 25 });
  assert.equal(isMajorPenalty("2+2"), false);
  assert.equal(isMajorPenalty("2+10"), true);
  assert.equal(isMajorPenalty("5+20"), true);
});

test("goal text supports scorer plus two assists", () => {
  const history = [goal("g1", "mighty", 18, melchior, [heckenberger, bares])];
  const text = formatGoalText(history[0], history, opponent);
  assert.match(text, /Torschütze: #84 Nils Melchior/);
  assert.match(text, /Assists: #10 Kevin Heckenberger · #46 Pavel Bares/);
  assert.match(text, /\*1:0\*/);
});

test("unknown scorer is omitted from generated goal text", () => {
  const mightyHistory = [goal("g1", "mighty", 18, null)];
  const mightyText = formatGoalText(mightyHistory[0], mightyHistory, opponent);
  assert.doesNotMatch(mightyText, /Torschütze noch offen|Torschütze:/);

  const opponentHistory = [goal("g2", "opponent", 29, null, [], "short")];
  const opponentText = formatGoalText(opponentHistory[0], opponentHistory, opponent);
  assert.match(opponentText, /Tor Erfurt/);
  assert.doesNotMatch(opponentText, /Torschütze noch offen/);
});

test("period summary contains only goals and scorers from the derived segment", () => {
  const history = [
    goal("g1", "mighty", 8, melchior, [heckenberger]),
    goal("g2", "opponent", 12, potvin),
    goal("g3", "mighty", 25, bares),
    { id: "p1", type: "penalty", minute: 18, penalties: [{ team: "mighty", player: melchior, duration: "2", reason: "Halten" }] }
  ];
  const text = formatSegmentSummary(history, "P1", opponent);
  assert.match(text, /#84 Nils Melchior/);
  assert.match(text, /#27 Frédéric Potvin/);
  assert.doesNotMatch(text, /Kevin Heckenberger/);
  assert.doesNotMatch(text, /25 Spielminute/);
  assert.doesNotMatch(text, /Halten/);
});

test("unknown scorer summary keeps only the minute", () => {
  const history = [goal("g1", "opponent", 12, null)];
  const text = formatSegmentSummary(history, "P1", opponent);
  assert.match(text, /12 Spielminute/);
  assert.doesNotMatch(text, /Torschütze noch offen/);
});

test("final summary includes goals, penalties, large penalty highlighting and shootout result", () => {
  const history = [
    goal("g1", "mighty", 8, melchior),
    goal("g2", "opponent", 12, potvin),
    {
      id: "p1", type: "penalty", minute: 34,
      penalties: [
        { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
        { team: "opponent", player: potvin, duration: "5+20", reason: "Bandencheck" }
      ]
    },
    { id: "s1", type: "shootout", team: "mighty", player: heckenberger, result: "scored" },
    { id: "s2", type: "shootout", team: "opponent", player: potvin, result: "missed" }
  ];
  const text = formatFinalSummary(history, opponent);
  assert.match(text, /Mighty Dogs 2:1 Erfurt n\. P\./);
  assert.match(text, /Strafen Mighty Dogs/);
  assert.match(text, /Strafen Erfurt/);
  assert.match(text, /🚨 \*34 Spielminute – #27 Frédéric Potvin – 5\+20 min Bandencheck\*/);
  assert.match(text, /Penaltyschießen/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  OPPONENTS,
  calculateScore,
  formatFinalSummary,
  formatGoalText,
  formatPeriodSummary,
  isMajorPenalty,
  parsePenaltyDuration
} from "../js/liveticker-prototype.js";

const opponent = OPPONENTS.erfurt;
const melchior = { number: "84", name: "Nils Melchior", position: "Sturm" };
const potvin = { number: "27", name: "Frédéric Potvin", position: "Sturm" };

function goal(id, team, minute, period, player, style = "classic") {
  return { id, type: "goal", team, minute, period, player, style };
}

test("calculateScore derives score only from goal history", () => {
  const history = [
    goal("g1", "mighty", 8, 1, melchior),
    { id: "p1", type: "penalty", minute: 9, period: 1, penalties: [] },
    goal("g2", "opponent", 12, 1, potvin),
    goal("g3", "mighty", 21, 2, melchior)
  ];
  assert.deepEqual(calculateScore(history), { mighty: 2, opponent: 1 });
});

test("penalty duration parser handles combinations", () => {
  assert.deepEqual(parsePenaltyDuration("2+2"), { parts: [2, 2], total: 4 });
  assert.deepEqual(parsePenaltyDuration("5+20"), { parts: [5, 20], total: 25 });
});

test("major penalties are highlighted by components of five minutes or more", () => {
  assert.equal(isMajorPenalty("2+2"), false);
  assert.equal(isMajorPenalty("2+10"), true);
  assert.equal(isMajorPenalty("5+20"), true);
});

test("goal text contains scorer and score at that event", () => {
  const history = [
    goal("g1", "mighty", 8, 1, melchior),
    goal("g2", "opponent", 12, 1, potvin),
    goal("g3", "mighty", 21, 2, melchior)
  ];
  const text = formatGoalText(history[0], history, opponent);
  assert.match(text, /#84 Nils Melchior/);
  assert.match(text, /\*1:0\*/);
});

test("period summary contains only scorers from selected period", () => {
  const history = [
    goal("g1", "mighty", 8, 1, melchior),
    goal("g2", "opponent", 12, 1, potvin),
    goal("g3", "mighty", 25, 2, melchior),
    { id: "p1", type: "penalty", minute: 18, period: 1, penalties: [{ team: "mighty", player: melchior, duration: "2", reason: "Halten" }] }
  ];
  const text = formatPeriodSummary(history, 1, opponent);
  assert.match(text, /#84 Nils Melchior/);
  assert.match(text, /#27 Frédéric Potvin/);
  assert.doesNotMatch(text, /25 Spielminute/);
  assert.doesNotMatch(text, /Halten/);
});

test("final summary includes goals and penalties for both teams", () => {
  const history = [
    goal("g1", "mighty", 8, 1, melchior),
    goal("g2", "opponent", 12, 1, potvin),
    {
      id: "p1", type: "penalty", minute: 34, period: 2,
      penalties: [
        { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
        { team: "opponent", player: potvin, duration: "5+20", reason: "Bandencheck" }
      ]
    }
  ];
  const text = formatFinalSummary(history, opponent);
  assert.match(text, /Mighty Dogs 1:1 Erfurt/);
  assert.match(text, /Strafen Mighty Dogs/);
  assert.match(text, /Strafen Erfurt/);
  assert.match(text, /🚨 \*34 Spielminute – #27 Frédéric Potvin – 5\+20 min Bandencheck\*/);
});

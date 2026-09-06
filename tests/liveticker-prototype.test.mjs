import test from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_POSITION_ORDER,
  MIGHTY_ROSTER,
  OPPONENTS,
  PENALTY_POSITION_ORDER,
  applyPenaltyStyleToDraft,
  completeTickerSubmitLifecycle,
  calculateOfficialFinalScore,
  calculateScore,
  calculateShootout,
  findPlayerByNumber,
  formatFinalSummary,
  formatGoalText,
  formatPenaltyText,
  formatSegmentSummary,
  isMajorPenalty,
  normalizeJerseyNumber,
  penaltyTemplateValues,
  parsePenaltyDuration,
  segmentForMinute
} from "../js/liveticker-prototype-v4.js";
import "../js/liveticker-output-templates.js";

globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES = {
  templates: [
    {
      key: "classic",
      title: "Klassisch",
      ownGoalTemplate: "{{minute}} Spielminute\n*Tooooooor für unsere Schweinfurter Mighty Dogs*\n\nTorschütze: {{scorer}}\nAssists: {{assists}}\n\nNeuer Spielstand\n*{{mighty_score}}:{{opponent_score}}*",
      ownPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentGoalTemplate: "{{minute}} Spielminute\nTor {{opponent_name}}\n{{scorer}}\nAssists: {{assists}}\n\nNeuer Spielstand\n*{{mighty_score}}:{{opponent_score}}*"
    },
    {
      key: "emotional",
      title: "Emotional",
      ownGoalTemplate: "{{minute}} Spielminute\n🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥\n\n{{scorer}}\nAssists: {{assists}}\n\nNeuer Spielstand\n*{{mighty_score}}:{{opponent_score}}*",
      ownPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentGoalTemplate: "{{minute}} Spielminute\nTor {{opponent_name}}\n{{scorer}}\nAssists: {{assists}}\n\nNeuer Spielstand\n*{{mighty_score}}:{{opponent_score}}*"
    },
    {
      key: "short",
      title: "Kurz",
      ownGoalTemplate: "{{minute}} Spielminute\n*TOOOOOR SCHWEINFURT!*\n{{scorer}}\nAssists: {{assists}}\n\n*{{mighty_score}}:{{opponent_score}}*",
      ownPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentPenaltyTemplate: "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}",
      opponentGoalTemplate: "{{minute}} Spielminute\nTor {{opponent_name}}\n{{scorer}}\nAssists: {{assists}}\n\n*{{mighty_score}}:{{opponent_score}}*"
    }
  ]
};

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

test("seeded classic, emotional and short variants preserve their previous output", () => {
  const ownClassic = goal("classic", "mighty", 18, melchior, [heckenberger], "classic");
  const ownEmotional = goal("emotional", "mighty", 18, melchior, [heckenberger], "emotional");
  const ownShort = goal("short", "mighty", 18, melchior, [heckenberger], "short");
  const opponentClassic = goal("opponent-classic", "opponent", 29, potvin, [], "classic");
  const opponentEmotional = goal("opponent-emotional", "opponent", 29, potvin, [], "emotional");
  const opponentShort = goal("opponent-short", "opponent", 29, potvin, [], "short");

  assert.equal(formatGoalText(ownClassic, [ownClassic], opponent), "18 Spielminute\n*Tooooooor für unsere Schweinfurter Mighty Dogs*\n\nTorschütze: #84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\nNeuer Spielstand\n*1:0*");
  assert.equal(formatGoalText(ownEmotional, [ownEmotional], opponent), "18 Spielminute\n🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥\n\n#84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\nNeuer Spielstand\n*1:0*");
  assert.equal(formatGoalText(ownShort, [ownShort], opponent), "18 Spielminute\n*TOOOOOR SCHWEINFURT!*\n#84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\n*1:0*");
  assert.equal(formatGoalText(opponentClassic, [opponentClassic], opponent), "29 Spielminute\nTor Erfurt\n#27 Frédéric Potvin\n\nNeuer Spielstand\n*0:1*");
  assert.equal(formatGoalText(opponentEmotional, [opponentEmotional], opponent), formatGoalText(opponentClassic, [opponentClassic], opponent));
  assert.equal(formatGoalText(opponentShort, [opponentShort], opponent), "29 Spielminute\nTor Erfurt\n#27 Frédéric Potvin\n\n*0:1*");
});

test("our and opponent goal templates stay independent of home or away venue", () => {
  const ownGoal = goal("own-venue", "mighty", 18, melchior);
  const opponentGoal = goal("opponent-venue", "opponent", 29, potvin);

  globalThis.PD_LIVETICKER_GAME_CONTEXT = { homeAway: "HOME" };
  const homeOwn = formatGoalText(ownGoal, [ownGoal], opponent);
  const homeOpponent = formatGoalText(opponentGoal, [opponentGoal], opponent);
  globalThis.PD_LIVETICKER_GAME_CONTEXT = { homeAway: "AWAY" };
  const awayOwn = formatGoalText(ownGoal, [ownGoal], opponent);
  const awayOpponent = formatGoalText(opponentGoal, [opponentGoal], opponent);
  delete globalThis.PD_LIVETICKER_GAME_CONTEXT;

  assert.equal(awayOwn, homeOwn);
  assert.equal(awayOpponent, homeOpponent);
  assert.match(awayOwn, /unsere Schweinfurter Mighty Dogs/);
  assert.match(awayOpponent, /Tor Erfurt/);
});

test("real penalty submit lifecycle preserves draft rows and updates one history event across all options", () => {
  const penalties = [
    { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
    { team: "opponent", player: potvin, duration: "5+20", reason: "Bandencheck" }
  ];
  const state = { minute: 1, history: [] };
  let editingId = null;
  let persistCalls = 0;
  let outputCalls = 0;
  let preserveCalls = 0;
  let cancelCalls = 0;

  for (const style of ["classic", "emotional", "short"]) {
    const event = applyPenaltyStyleToDraft({
      id: editingId || "penalty-draft",
      type: "penalty",
      minute: 34,
      penalties
    }, style);
    const lifecycle = completeTickerSubmitLifecycle({
      state,
      editingId,
      tickerEvent: event,
      persist: () => { persistCalls += 1; },
      renderHistory: () => {},
      renderOutput: () => { outputCalls += 1; },
      preservePenaltyDraft: id => { editingId = id; preserveCalls += 1; },
      cancelEdit: () => { cancelCalls += 1; },
      syncContext: () => {}
    });

    assert.equal(lifecycle.preservePenaltyDraft, true);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].style, style);
    assert.strictEqual(state.history[0].penalties, penalties);
  }

  assert.equal(persistCalls, 3);
  assert.equal(outputCalls, 3);
  assert.equal(preserveCalls, 3);
  assert.equal(cancelCalls, 0);

  assert.deepEqual(state.history[0].penalties.map(item => ({
    team: item.team,
    player: item.player,
    number: item.player?.number,
    duration: item.duration,
    reason: item.reason
  })), [
    { team: "mighty", player: melchior, number: "84", duration: "2", reason: "Halten" },
    { team: "opponent", player: potvin, number: "27", duration: "5+20", reason: "Bandencheck" }
  ]);
});

test("goal and shootout submit lifecycle still finishes without preserving a penalty draft", () => {
  const goalState = { minute: 1, history: [] };
  const goalEvent = goal("goal-submit", "mighty", 12, melchior);
  let cancelCalls = 0;
  const finish = tickerEvent => completeTickerSubmitLifecycle({
    state: goalState,
    editingId: null,
    tickerEvent,
    persist: () => {},
    renderHistory: () => {},
    renderOutput: () => {},
    preservePenaltyDraft: () => assert.fail("Tor/Shootout darf keinen Strafendraft erhalten."),
    cancelEdit: () => { cancelCalls += 1; },
    syncContext: () => {}
  });
  const goalLifecycle = finish(goalEvent);
  assert.deepEqual(goalLifecycle, { editingId: null, preservePenaltyDraft: false });
  assert.equal(goalState.history.length, 1);

  const shootoutEvent = { id: "shootout-submit", type: "shootout", team: "opponent", player: potvin, result: "missed" };
  const shootoutLifecycle = finish(shootoutEvent);
  assert.deepEqual(shootoutLifecycle, { editingId: null, preservePenaltyDraft: false });
  assert.equal(goalState.history.length, 2);
  assert.equal(goalState.minute, 12);
  assert.equal(cancelCalls, 2);
});

test("seeded penalty templates preserve output and persisted variants are used", () => {
  const event = {
    id: "penalty-template",
    type: "penalty",
    minute: 34,
    penalties: [
      { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
      { team: "opponent", player: potvin, duration: "5+20", reason: "Bandencheck" }
    ]
  };
  assert.equal(
    formatPenaltyText(event, opponent),
    "34 Spielminute\nStrafe(n)\n\nMighty Dogs · 2 min · Halten · #84 Nils Melchior\n🚨 *Erfurt · 5+20 min · Bandencheck · #27 Frédéric Potvin*"
  );

  const emotional = globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES.templates.find(template => template.key === "emotional");
  const seededTemplate = emotional.ownPenaltyTemplate;
  emotional.ownPenaltyTemplate = "OPTION 2 · {{minute}}\n{{penalties}}";
  try {
    const text = formatPenaltyText({ ...event, style: "emotional" }, opponent);
    assert.match(text, /^OPTION 2 · 34/);
    assert.match(text, /#84 Nils Melchior/);
    assert.match(text, /#27 Frédéric Potvin/);
  } finally {
    emotional.ownPenaltyTemplate = seededTemplate;
  }
});

test("our and opponent penalty templates are separate and independent of home or away", () => {
  const variant = globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES.templates.find(template => template.key === "short");
  const ownBefore = variant.ownPenaltyTemplate;
  const opponentBefore = variant.opponentPenaltyTemplate;
  variant.ownPenaltyTemplate = "WIR {{minute}}\n{{penalties}}";
  variant.opponentPenaltyTemplate = "DIE ANDEREN {{minute}} {{opponent_name}}\n{{penalties}}";
  const event = {
    id: "penalty-contexts", type: "penalty", minute: 40, style: "short",
    penalties: [
      { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
      { team: "opponent", player: potvin, duration: "5+20", reason: "Bandencheck" }
    ]
  };

  try {
    globalThis.PD_LIVETICKER_GAME_CONTEXT = { homeAway: "HOME" };
    const home = formatPenaltyText(event, opponent);
    globalThis.PD_LIVETICKER_GAME_CONTEXT = { homeAway: "AWAY" };
    const away = formatPenaltyText(event, opponent);
    assert.equal(away, home);
    assert.match(away, /^WIR 40[\s\S]*Mighty Dogs/);
    assert.match(away, /DIE ANDEREN 40 Erfurt[\s\S]*🚨 \*Erfurt/);
  } finally {
    variant.ownPenaltyTemplate = ownBefore;
    variant.opponentPenaltyTemplate = opponentBefore;
    delete globalThis.PD_LIVETICKER_GAME_CONTEXT;
  }
});

test("single-penalty variables are explicit and ambiguous values stay empty for multiple rows", () => {
  const single = penaltyTemplateValues({ minute: 18 }, [{
    team: "mighty", player: melchior, duration: "2", reason: "Halten"
  }], opponent);
  assert.deepEqual(single, {
    minute: 18,
    player_name: "Nils Melchior",
    jersey_number: "84",
    player: "#84 Nils Melchior",
    penalty_duration: "2 min",
    penalty_reason: "Halten",
    team_name: "Mighty Dogs",
    opponent_name: "Erfurt",
    penalty_line: "Mighty Dogs · 2 min · Halten · #84 Nils Melchior",
    penalties: "Mighty Dogs · 2 min · Halten · #84 Nils Melchior"
  });

  const multiple = penaltyTemplateValues({ minute: 18 }, [
    { team: "mighty", player: melchior, duration: "2", reason: "Halten" },
    { team: "mighty", player: bares, duration: "5+20", reason: "Bandencheck" }
  ], opponent);
  assert.equal(multiple.player_name, "");
  assert.equal(multiple.jersey_number, "");
  assert.equal(multiple.penalty_duration, "");
  assert.equal(multiple.penalty_reason, "");
  assert.equal(multiple.penalty_line, "");
  assert.match(multiple.penalties, /🚨 \*Mighty Dogs · 5\+20 min/);

  const opponentMultiple = penaltyTemplateValues({ minute: 18 }, [
    { team: "opponent", player: potvin, duration: "2", reason: "Halten" },
    { team: "opponent", player: null, duration: "2+2", reason: "Hoher Stock" }
  ], opponent);
  assert.equal(opponentMultiple.team_name, "Erfurt");
  assert.match(opponentMultiple.penalties, /^Erfurt · 2 min[\s\S]*Erfurt · 2\+2 min/);
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

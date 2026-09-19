export const MIGHTY_ROSTER = Object.freeze([
  { number: "40", name: "Leon Pöhlmann", position: "Tor" },
  { number: "42", name: "Benedict Roßberg", position: "Tor" },
  { number: "2", name: "Lucas Kleider", position: "Verteidigung" },
  { number: "5", name: "Colin Freibert", position: "Verteidigung" },
  { number: "19", name: "Kristers Donins", position: "Verteidigung" },
  { number: "28", name: "Renars Dzerods Alksnis", position: "Verteidigung" },
  { number: "33", name: "Thomáš Pribyl", position: "Verteidigung" },
  { number: "69", name: "Lukas Krumpe", position: "Verteidigung" },
  { number: "", name: "Ondrej Nedved", position: "Verteidigung" },
  { number: "10", name: "Kevin Heckenberger", position: "Sturm" },
  { number: "24", name: "Alex Asmus", position: "Sturm" },
  { number: "41", name: "Tomas Cermak", position: "Sturm" },
  { number: "46", name: "Pavel Bares", position: "Sturm" },
  { number: "70", name: "Josef Dana", position: "Sturm" },
  { number: "84", name: "Nils Melchior", position: "Sturm" },
  { number: "89", name: "Dimitri Litesov", position: "Sturm" },
  { number: "91", name: "Georg Pinsack", position: "Sturm" },
  { number: "", name: "Ricards Bernhards", position: "Sturm" }
]);

export const ERFURT_ROSTER = Object.freeze([
  { number: "37", name: "Patrick Glatzel", position: "Tor" },
  { number: "77", name: "Justin Spiewok", position: "Tor" },
  { number: "2", name: "Dennis Bondarenko", position: "Verteidigung" },
  { number: "6", name: "Jonas Gerstung", position: "Verteidigung" },
  { number: "25", name: "René Kramer", position: "Verteidigung" },
  { number: "44", name: "Phil Bischoff", position: "Verteidigung" },
  { number: "63", name: "Eric Wunderlich", position: "Verteidigung" },
  { number: "", name: "Jonas Fontana", position: "Verteidigung" },
  { number: "", name: "Philipp Hertel", position: "Verteidigung" },
  { number: "26", name: "Petr Gulda", position: "Sturm" },
  { number: "11", name: "Jesper Satzky", position: "Sturm" },
  { number: "12", name: "Maurice Keil", position: "Sturm" },
  { number: "22", name: "Enzo Herrschaft", position: "Sturm" },
  { number: "27", name: "Frédéric Potvin", position: "Sturm" },
  { number: "43", name: "Nils Herzog", position: "Sturm" },
  { number: "83", name: "Harrison Reed", position: "Sturm" },
  { number: "92", name: "Joe Kiss", position: "Sturm" },
  { number: "96", name: "Fritz Denner", position: "Sturm" },
  { number: "", name: "Jacob Lagacé", position: "Sturm" }
]);

export const OPPONENTS = Object.freeze({
  erfurt: Object.freeze({ id: "erfurt", shortName: "Erfurt", fullName: "TecArt Black Dragons Erfurt", roster: ERFURT_ROSTER })
});

export const PENALTY_REASONS = Object.freeze([
  "Halten", "Beinstellen", "Haken", "Stockschlag", "Behinderung", "Hoher Stock",
  "Crosscheck", "Bandencheck", "Check gegen Kopf oder Nacken", "Ellbogencheck",
  "Kniecheck", "Übertriebene Härte", "Unsportliches Verhalten", "Spielverzögerung",
  "Zu viele Spieler auf dem Eis"
]);

export const PENALTY_DURATIONS = Object.freeze(["2", "2+2", "5", "10", "2+10", "5+10", "5+20", "20"]);
export const GOAL_POSITION_ORDER = Object.freeze(["Sturm", "Verteidigung", "Tor"]);
export const PENALTY_POSITION_ORDER = Object.freeze(["Verteidigung", "Sturm", "Tor"]);

export const SEGMENTS = Object.freeze({
  P1: Object.freeze({ key: "P1", label: "1. Drittel", order: 1 }),
  P2: Object.freeze({ key: "P2", label: "2. Drittel", order: 2 }),
  P3: Object.freeze({ key: "P3", label: "3. Drittel", order: 3 }),
  OT: Object.freeze({ key: "OT", label: "Overtime", order: 4 }),
  SO: Object.freeze({ key: "SO", label: "Penaltyschießen", order: 5 })
});

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const LEGACY_STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v2";

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function canonicalizeServerAction(value) {
  if (Array.isArray(value)) return value.map(canonicalizeServerAction);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .filter(key => key !== "_whatsapp")
    .sort()
    .reduce((result, key) => {
      result[key] = canonicalizeServerAction(value[key]);
      return result;
    }, {});
}

export function canonicalServerActionFingerprint(action) {
  if (!action || typeof action !== "object") return "";
  return JSON.stringify(canonicalizeServerAction(action));
}

export function playerText(player) {
  if (!player) return "";
  return player.number ? `#${player.number} ${player.name}` : player.name;
}

export function normalizeJerseyNumber(value) {
  return String(value ?? "").trim().replace(/^#/, "").trim();
}

export function findPlayerByNumber(roster, value) {
  const number = normalizeJerseyNumber(value);
  if (!number) return null;
  return roster.find(player => String(player.number || "").trim() === number) || null;
}

export function segmentForMinute(value) {
  const minute = Number.parseInt(value, 10);
  if (!Number.isInteger(minute) || minute < 1) throw new Error("Bitte eine gültige Spielminute ab 1 eingeben.");
  if (minute <= 20) return SEGMENTS.P1;
  if (minute <= 40) return SEGMENTS.P2;
  if (minute <= 60) return SEGMENTS.P3;
  return SEGMENTS.OT;
}

export function parsePenaltyDuration(value) {
  const parts = String(value || "").split("+").map(part => Number.parseInt(part, 10));
  if (!parts.length || parts.some(part => !Number.isInteger(part) || part <= 0)) return { parts: [], total: 0 };
  return { parts, total: parts.reduce((sum, part) => sum + part, 0) };
}

export function isMajorPenalty(duration) {
  return parsePenaltyDuration(duration).parts.some(part => part >= 5);
}

export function isPenaltyShotEvent(event) {
  return Boolean(event && event.type === "penalty" && event.subtype === "penalty_shot");
}

function eventScoresGoal(event) {
  return Boolean(
    event
    && (event.team === "mighty" || event.team === "opponent")
    && (event.type === "goal" || (isPenaltyShotEvent(event) && event.result === "scored"))
  );
}

export function calculateScore(history) {
  return history.reduce((score, event) => {
    if (eventScoresGoal(event)) score[event.team] += 1;
    return score;
  }, { mighty: 0, opponent: 0 });
}

export function homeAwayScore(score, homeAway = globalThis.PD_LIVETICKER_GAME_CONTEXT?.homeAway) {
  const normalized = String(homeAway || "HOME").trim().toUpperCase();
  const mighty = Number(score?.mighty || 0);
  const opponent = Number(score?.opponent || 0);
  return normalized === "AWAY"
    ? Object.freeze({ home: opponent, away: mighty })
    : Object.freeze({ home: mighty, away: opponent });
}

export function calculateShootout(history) {
  return history.reduce((score, event) => {
    if (event.type === "shootout" && event.result === "scored" && (event.team === "mighty" || event.team === "opponent")) score[event.team] += 1;
    return score;
  }, { mighty: 0, opponent: 0 });
}

export function calculateOfficialFinalScore(history) {
  const regular = calculateScore(history);
  const shootoutEvents = history.filter(event => event.type === "shootout");
  if (shootoutEvents.length) {
    const shootout = calculateShootout(history);
    if (shootout.mighty !== shootout.opponent) {
      return {
        mighty: regular.mighty + (shootout.mighty > shootout.opponent ? 1 : 0),
        opponent: regular.opponent + (shootout.opponent > shootout.mighty ? 1 : 0),
        suffix: "n. P."
      };
    }
    return { ...regular, suffix: "Penaltyschießen läuft" };
  }
  if (history.some(event => eventScoresGoal(event) && Number(event.minute) > 60)) return { ...regular, suffix: "n. V." };
  return { ...regular, suffix: "" };
}

export function scoreAtEvent(history, eventId) {
  const score = { mighty: 0, opponent: 0 };
  for (const event of history) {
    if (eventScoresGoal(event)) score[event.team] += 1;
    if (event.id === eventId) break;
  }
  return score;
}

function teamName(team, opponent) {
  return team === "mighty" ? "Mighty Dogs" : opponent.shortName;
}

function goalPlayerLine(event) {
  return event.player ? playerText(event.player) : "";
}

function assistPlayers(event) {
  return Array.isArray(event.assists) ? event.assists.filter(Boolean).slice(0, 2) : [];
}

function assistLine(event) {
  const assists = assistPlayers(event);
  return assists.length ? `Assists: ${assists.map(playerText).join(" · ")}` : "";
}

function assistTemplateValue(event) {
  return assistPlayers(event).map(playerText).join(" · ");
}

function eventSegment(event) {
  if (event.type === "shootout") return SEGMENTS.SO;
  return segmentForMinute(event.minute);
}

export function formatGoalText(event, history, opponent) {
  const score = scoreAtEvent(history, event.id);
  const templates = globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES?.templates;
  const variant = Array.isArray(templates)
    ? templates.find(template => template.key === (event.style || "classic"))
    : null;
  const renderer = globalThis.PD_LIVETICKER_TEMPLATE_RENDERER?.render;

  if (!variant || typeof renderer !== "function") {
    throw new Error("Liveticker-Ausgabevarianten konnten nicht geladen werden.");
  }

  const template = event.team === "opponent"
    ? variant.opponentGoalTemplate
    : variant.ownGoalTemplate;

  const displayScore = homeAwayScore(score);
  return renderer(template, {
    minute: event.minute,
    scorer: goalPlayerLine(event),
    assists: assistTemplateValue(event),
    mighty_score: score.mighty,
    opponent_score: score.opponent,
    home_score: displayScore.home,
    away_score: displayScore.away,
    score: `${displayScore.home} : ${displayScore.away}`,
    opponent_name: opponent.shortName
  });
}

function formatPenaltyEntry(penalty, opponent) {
  const player = penalty.player ? ` · ${playerText(penalty.player)}` : "";
  return `${teamName(penalty.team, opponent)} · ${penalty.duration} min · ${penalty.reason}${player}`;
}

function formattedPenaltyEntry(penalty, opponent) {
  const line = formatPenaltyEntry(penalty, opponent);
  return isMajorPenalty(penalty.duration) ? `🚨 *${line}*` : line;
}

export function applyPenaltyStyleToDraft(draft, style) {
  const selectedStyle = ["classic", "emotional", "short"].includes(style) ? style : "classic";
  return Object.freeze({ ...draft, style: selectedStyle, penalties: draft.penalties });
}

export function historyWithDraftEvent(history, editingId, tickerEvent) {
  const next = Array.isArray(history) ? history.slice() : [];
  const index = editingId ? next.findIndex(item => item.id === editingId) : -1;
  if (index >= 0) next.splice(index, 1, tickerEvent);
  else next.push(tickerEvent);
  return next;
}

export function shouldCopyLivetickerOutput({ whatsappEnabled, transportReady }) {
  return !(Boolean(whatsappEnabled) && Boolean(transportReady));
}

export function attachSubmitWhatsappIntent(tickerEvent, text, { editingId = null, enabled = false } = {}) {
  const message = String(text ?? "");
  if (!tickerEvent || editingId || !enabled || !message.trim() || message.length > 4000) return tickerEvent;
  return {
    ...tickerEvent,
    _whatsapp: Object.freeze({ publish: true, text: message })
  };
}

export function applyTickerSubmitLifecycle(state, editingId, tickerEvent) {
  const index = editingId ? state.history.findIndex(item => item.id === editingId) : -1;
  if (index >= 0) state.history.splice(index, 1, tickerEvent);
  else state.history.push(tickerEvent);
  if (tickerEvent.type !== "shootout") state.minute = tickerEvent.minute;
  const preservePenalty = tickerEvent.type === "penalty" && !isPenaltyShotEvent(tickerEvent);
  return Object.freeze({
    editingId: preservePenalty ? tickerEvent.id : null,
    preservePenaltyDraft: preservePenalty
  });
}

export function completeTickerSubmitLifecycle({
  state,
  editingId,
  tickerEvent,
  persist,
  renderHistory,
  renderOutput,
  preservePenaltyDraft,
  cancelEdit,
  syncContext
}) {
  const lifecycle = applyTickerSubmitLifecycle(state, editingId, tickerEvent);
  persist();
  renderHistory();
  renderOutput();
  if (lifecycle.preservePenaltyDraft) preservePenaltyDraft(lifecycle.editingId);
  else cancelEdit();
  syncContext();
  return lifecycle;
}

export function penaltyTemplateValues(event, penalties, opponent) {
  const entries = Array.isArray(penalties) ? penalties : [];
  const single = entries.length === 1 ? entries[0] : null;
  const teams = [...new Set(entries.map(penalty => penalty.team))];
  return Object.freeze({
    minute: event.minute,
    player_name: single?.player?.name || "",
    jersey_number: single?.player?.number || "",
    player: single?.player ? playerText(single.player) : "",
    penalty_duration: single ? `${single.duration} min` : "",
    penalty_reason: single?.reason || "",
    team_name: teams.map(team => teamName(team, opponent)).join(" + "),
    opponent_name: opponent.shortName,
    penalty_line: single ? formattedPenaltyEntry(single, opponent) : "",
    penalties: entries.map(penalty => formattedPenaltyEntry(penalty, opponent)).join("\n")
  });
}

export function formatPenaltyText(event, opponent) {
  const templates = globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES?.templates;
  const variant = Array.isArray(templates)
    ? templates.find(template => template.key === (event.style || "classic"))
    : null;
  const renderer = globalThis.PD_LIVETICKER_TEMPLATE_RENDERER?.render;
  const ownTemplate = variant?.ownPenaltyTemplate || variant?.penaltyTemplate;
  const opponentTemplate = variant?.opponentPenaltyTemplate || variant?.penaltyTemplate;
  if (!ownTemplate || !opponentTemplate || typeof renderer !== "function") {
    throw new Error("Liveticker-Strafenausgaben konnten nicht geladen werden.");
  }

  if (ownTemplate === opponentTemplate) {
    return renderer(ownTemplate, penaltyTemplateValues(event, event.penalties, opponent));
  }

  return [
    ["mighty", ownTemplate],
    ["opponent", opponentTemplate]
  ].map(([team, template]) => {
    const penalties = event.penalties.filter(penalty => penalty.team === team);
    return penalties.length ? renderer(template, penaltyTemplateValues(event, penalties, opponent)) : "";
  }).filter(Boolean).join("\n\n");
}

export function formatShootoutText(event, opponent) {
  const result = event.result === "scored" ? "✅ verwandelt" : "❌ vergeben";
  const shooter = event.player ? playerText(event.player) : "Schütze noch offen";
  return ["*Penaltyschießen*", `${teamName(event.team, opponent)} · ${shooter}`, result].join("\n");
}

export function formatPenaltyShotText(event, opponent) {
  const result = event.result === "scored" ? "✅ verwandelt" : "❌ vergeben";
  const shooter = event.player ? playerText(event.player) : "Schütze noch offen";
  const defendingTeam = event.team === "mighty" ? "opponent" : "mighty";
  const goalie = event.goalie ? playerText(event.goalie) : "Goalie noch offen";
  return [
    "🏒 *Straf-Penalty*",
    `${event.minute} Spielminute`,
    `${teamName(event.team, opponent)} · Schütze: ${shooter}`,
    `${teamName(defendingTeam, opponent)} · Goalie: ${goalie}`,
    result
  ].join("\n");
}

export function formatEventText(event, history, opponent) {
  if (event.type === "goal") return formatGoalText(event, history, opponent);
  if (isPenaltyShotEvent(event)) return formatPenaltyShotText(event, opponent);
  if (event.type === "penalty") return formatPenaltyText(event, opponent);
  if (event.type === "shootout") return formatShootoutText(event, opponent);
  throw new Error("Unbekannte Aktion.");
}

export function historyByMinute(history) {
  return (Array.isArray(history) ? history : [])
    .map((event, index) => {
      const minute = Number.parseInt(event?.minute, 10);
      return { event, index, minute: Number.isInteger(minute) ? minute : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.minute - b.minute || a.index - b.index)
    .map(item => item.event);
}

function goalSummaryLines(history, team, segmentKey = null) {
  const targetSegment = segmentKey ? SEGMENTS[segmentKey] : null;
  return historyByMinute(history)
    .filter(event =>
      eventScoresGoal(event)
      && event.team === team
      && (!targetSegment || eventSegment(event).order <= targetSegment.order)
    )
    .map(event => {
      if (isPenaltyShotEvent(event)) {
        const shooter = event.player ? playerText(event.player) : "Schütze offen";
        return `${event.minute} Spielminute – 🏒 Straf-Penalty · ${shooter}`;
      }
      const scorer = goalPlayerLine(event);
      return scorer ? `${event.minute} Spielminute – ${scorer}` : `${event.minute} Spielminute`;
    });
}

export function formatSegmentSummary(history, segmentKey, opponent) {
  const segment = SEGMENTS[segmentKey];
  if (!segment || segment.key === "SO") throw new Error("Für diesen Abschnitt gibt es keine Drittelzusammenfassung.");
  const score = history.reduce((result, event) => {
    if (eventScoresGoal(event) && eventSegment(event).order <= segment.order) result[event.team] += 1;
    return result;
  }, { mighty: 0, opponent: 0 });
  const mighty = goalSummaryLines(history, "mighty", segment.key);
  const away = goalSummaryLines(history, "opponent", segment.key);
  const displayScore = homeAwayScore(score);
  const headline = segment.key === "OT"
    ? `*Ende Overtime – ${displayScore.home}:${displayScore.away}*`
    : `*Ende ${segment.label} – ${displayScore.home}:${displayScore.away}*`;
  return [headline, "", "🥅 *Mighty Dogs*", ...(mighty.length ? mighty : ["Keine Tore"]), "", `🥅 *${opponent.shortName}*`, ...(away.length ? away : ["Keine Tore"])].join("\n");
}

export function formatPeriodSummary(history, period, opponent) {
  const key = { 1: "P1", 2: "P2", 3: "P3" }[Number.parseInt(period, 10)];
  if (!key) throw new Error("Ungültiges Drittel.");
  return formatSegmentSummary(history, key, opponent);
}

function penaltySummaryLines(history, team) {
  const lines = [];
  for (const event of historyByMinute(history)) {
    if (event.type !== "penalty") continue;
    if (isPenaltyShotEvent(event)) {
      const defendingTeam = event.team === "mighty" ? "opponent" : "mighty";
      if (defendingTeam === team) {
        const shooter = event.player ? playerText(event.player) : "Schütze offen";
        const goalie = event.goalie ? playerText(event.goalie) : "Goalie offen";
        lines.push(`${event.minute} Spielminute – Straf-Penalty · ${shooter} gegen ${goalie} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`);
      }
      continue;
    }
    for (const penalty of event.penalties.filter(entry => entry.team === team)) {
      const base = `${event.minute} Spielminute – ${penalty.player ? playerText(penalty.player) : "ohne Spieler"} – ${penalty.duration} min ${penalty.reason}`;
      lines.push(isMajorPenalty(penalty.duration) ? `🚨 *${base}*` : base);
    }
  }
  return lines.length ? lines : ["Keine Strafen"];
}

function shootoutSummaryLines(history, opponent) {
  const attempts = historyByMinute(history).filter(event => event.type === "shootout");
  if (!attempts.length) return [];
  const score = calculateShootout(history);
  return ["", "🏒 *Penaltyschießen*", `Treffer: Mighty Dogs ${score.mighty}:${score.opponent} ${opponent.shortName}`, ...attempts.map(event => `${teamName(event.team, opponent)} · ${event.player ? playerText(event.player) : "Schütze offen"} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`)];
}

export function formatFinalSummary(history, opponent) {
  const finalScore = calculateOfficialFinalScore(history);
  const suffix = finalScore.suffix ? ` ${finalScore.suffix}` : "";
  const displayScore = homeAwayScore(finalScore);
  const awayGame = String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.homeAway || "HOME").trim().toUpperCase() === "AWAY";
  const scoreLine = awayGame
    ? `${opponent.shortName} ${displayScore.home}:${displayScore.away} Mighty Dogs${suffix}`
    : `Mighty Dogs ${displayScore.home}:${displayScore.away} ${opponent.shortName}${suffix}`;
  const mightyGoals = goalSummaryLines(history, "mighty");
  const opponentGoals = goalSummaryLines(history, "opponent");
  return [
    "*ENDSTAND*",
    scoreLine,
    "",
    "🥅 *Tore Mighty Dogs*",
    ...(mightyGoals.length ? mightyGoals : ["Keine Tore"]),
    "",
    `🥅 *Tore ${opponent.shortName}*`,
    ...(opponentGoals.length ? opponentGoals : ["Keine Tore"]),
    "",
    "🚨 *Strafen Mighty Dogs*",
    ...penaltySummaryLines(history, "mighty"),
    "",
    `🚨 *Strafen ${opponent.shortName}*`,
    ...penaltySummaryLines(history, "opponent"),
    ...shootoutSummaryLines(history, opponent)
  ].join("\n");
}

function defaultState() {
  return { opponentId: "erfurt", minute: 1, history: [] };
}

function normalizeLoadedState(parsed) {
  if (!parsed || !Array.isArray(parsed.history) || !OPPONENTS[parsed.opponentId]) return null;
  return {
    opponentId: parsed.opponentId,
    minute: Math.max(1, Number(parsed.minute) || 1),
    history: parsed.history
      .filter(event => event && ["goal", "penalty", "shootout"].includes(event.type))
      .map(event => event.type === "goal" ? { ...event, assists: Array.isArray(event.assists) ? event.assists.slice(0, 2) : [] } : event)
  };
}

function loadState() {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const current = normalizeLoadedState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    if (current) return current;
    const legacy = normalizeLoadedState(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null"));
    return legacy || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function rosterForTeam(team, opponent) {
  return team === "mighty" ? MIGHTY_ROSTER : opponent.roster;
}

function goalieRosterForTeam(team, opponent) {
  return rosterForTeam(team, opponent)
    .filter(player => player.position === "Tor" || player.position === "GOALIE")
    .map(player => player.position === "GOALIE" ? { ...player, position: "Tor" } : player);
}

function fillPlayerSelect(select, roster, selected = "", placeholder = "Spieler noch unbekannt", positionOrder = GOAL_POSITION_ORDER) {
  select.replaceChildren(new Option(placeholder, ""));
  for (const position of positionOrder) {
    const group = document.createElement("optgroup");
    group.label = position;
    for (const player of roster.filter(item => item.position === position)) group.append(new Option(playerText(player), player.name));
    if (group.children.length) select.append(group);
  }
  select.value = selected;
}

function playerFromSelect(select, roster) {
  return select.value ? roster.find(player => player.name === select.value) || null : null;
}

function bindNumberSelect(numberInput, select, getRoster) {
  function syncFromSelect() {
    const player = playerFromSelect(select, getRoster());
    numberInput.value = player?.number || "";
  }
  function syncFromNumber() {
    const raw = normalizeJerseyNumber(numberInput.value);
    if (!raw) {
      select.value = "";
      return;
    }
    const player = findPlayerByNumber(getRoster(), raw);
    select.value = player?.name || "";
  }
  numberInput.addEventListener("input", syncFromNumber);
  select.addEventListener("change", syncFromSelect);
  return { syncFromSelect, syncFromNumber };
}

function initialize() {
  const form = document.querySelector("#tickerForm");
  if (!form) return;

  let state = loadState();
  let editingId = null;
  let preservedPenaltyDraftId = null;
  let historyExpanded = false;
  let outputEditing = false;
  let outputManuallyEdited = false;
  let previewDraftId = uid();
  globalThis.PD_LIVETICKER_DRAFT_ACTION_ID = () => editingId || previewDraftId;
  let pendingServerActionId = "";
  let pendingServerActionFingerprint = "";
  const $ = selector => document.querySelector(selector);
  const opponentSelect = $("#opponentSelect");
  const minuteInput = $("#gameMinute");
  const segmentLabel = $("#segmentLabel");
  const mightyScore = $("#mightyScore");
  const opponentScore = $("#opponentScore");
  const mightyScoreName = $("#mightyScoreName");
  const opponentScoreName = $("#opponentScoreName");
  const assistDetails = $("#assistDetails");
  const shootoutStatus = $("#shootoutStatus");
  const goalFields = $("#goalFields");
  const penaltyFields = $("#penaltyFields");
  const situationFields = $("#situationFields");
  const situationPenaltyShot = $("#situationPenaltyShot");
  const penaltyShotFields = $("#penaltyShotFields");
  const shootoutFields = $("#shootoutFields");
  const goalPlayer = $("#goalPlayer");
  const goalNumber = $("#goalNumber");
  const assist1 = $("#assist1");
  const assist1Number = $("#assist1Number");
  const assist2 = $("#assist2");
  const assist2Number = $("#assist2Number");
  const goalPlayerLabel = $("#goalPlayerLabel");
  const penaltyRows = $("#penaltyRows");
  const penaltyShotTeam = $("#penaltyShotTeam");
  const penaltyShotPlayer = $("#penaltyShotPlayer");
  const penaltyShotNumber = $("#penaltyShotNumber");
  const penaltyShotGoalie = $("#penaltyShotGoalie");
  const penaltyShotGoalieNumber = $("#penaltyShotGoalieNumber");
  const penaltyShotShooterLabel = $("#penaltyShotShooterLabel");
  const penaltyShotGoalieLabel = $("#penaltyShotGoalieLabel");
  const shootoutTeam = $("#shootoutTeam");
  const shootoutPlayer = $("#shootoutPlayer");
  const shootoutNumber = $("#shootoutNumber");
  const output = $("#tickerOutput");
  const outputCard = $("#whatsappOutput");
  const outputPreview = $("#tickerOutputPreview");
  const outputCopyState = $("#outputCopyState");
  const editOutputButton = $("#editOutputButton");
  const saveOutputButton = $("#saveOutputButton");
  const errorBox = $("#formError");
  const copyButton = $("#copyButton");
  const submitButton = $("#submitButton");
  const editingBanner = $("#editingBanner");
  const historyList = $("#historyList");
  const historyEmpty = $("#historyEmpty");
  const historyToggle = $("#historyToggle");

  if ([goalPlayer, goalNumber, assist1, assist1Number, assist2, assist2Number, situationFields, situationPenaltyShot, penaltyShotFields, penaltyShotTeam, penaltyShotPlayer, penaltyShotNumber, penaltyShotGoalie, penaltyShotGoalieNumber, penaltyShotShooterLabel, penaltyShotGoalieLabel, shootoutPlayer, shootoutNumber].some(item => !item)) return;

  Object.values(OPPONENTS).forEach(item => opponentSelect.append(new Option(item.shortName, item.id)));
  opponentSelect.value = state.opponentId;
  minuteInput.value = String(state.minute);

  function contextualTemplateTitle(variant, contextKey) {
    const fields = {
      own: "ownGoalTitle",
      opponent: "opponentGoalTitle",
      ownPenalty: "ownPenaltyTitle",
      opponentPenalty: "opponentPenaltyTitle"
    };
    return variant?.[fields[contextKey]] || variant?.title || "Option";
  }

  function currentPenaltyTitleContext() {
    const teams = new Set([...penaltyRows.children]
      .map(row => row.querySelector("[data-field='team']")?.value)
      .filter(Boolean));
    if (teams.size !== 1) return "";
    return teams.has("opponent") ? "opponentPenalty" : "ownPenalty";
  }

  function syncTemplateStyleTitles() {
    const outputTemplates = globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES?.templates || [];
    const goalContext = selectedAction() === "GOAL_OPPONENT" ? "opponent" : "own";
    const penaltyContext = currentPenaltyTitleContext();
    document.querySelectorAll("input[name='goalStyle']").forEach(input => {
      const variant = outputTemplates.find(template => template.key === input.value);
      const label = document.querySelector(`label[for='${input.id}']`);
      if (variant && label) label.textContent = contextualTemplateTitle(variant, goalContext);
    });
    document.querySelectorAll("input[name='penaltyStyle']").forEach(input => {
      const variant = outputTemplates.find(template => template.key === input.value);
      const label = document.querySelector(`label[for='${input.id}']`);
      if (variant && label) label.textContent = penaltyContext
        ? contextualTemplateTitle(variant, penaltyContext)
        : (variant.title || "Option");
    });
  }
  syncTemplateStyleTitles();
  window.addEventListener("pd-liveticker-output-templates-updated", () => {
    syncTemplateStyleTitles();
    refreshDraftOutput();
  });

  window.addEventListener("pd-liveticker-remote-state", event => {
    const remote = event.detail || {};
    if (!Array.isArray(remote.history)) return;
    const normalized = normalizeLoadedState({
      opponentId: state.opponentId,
      minute: remote.minute,
      history: remote.history
    });
    if (!normalized) return;
    state = normalized;
    minuteInput.value = String(state.minute);
    segmentLabel.textContent = segmentForMinute(state.minute).label;
    if (editingId && !state.history.some(item => item.id === editingId)) cancelEdit();
    syncScore();
    renderHistory();
    if (!outputManuallyEdited) queueMicrotask(() => refreshDraftOutput({ force: true }));
  });

  function opponent() { return OPPONENTS[state.opponentId]; }
  function selectedAction() { return new FormData(form).get("action"); }
  function selectedSituation() { return new FormData(form).get("situationType") || ""; }
  function penaltyShotSelected() { return selectedAction() === "SITUATION" && selectedSituation() === "PENALTY_SHOT"; }
  function selectedGoalTeam() { return selectedAction() === "GOAL_OPPONENT" ? "opponent" : "mighty"; }
  function selectedMinute() { return Number.parseInt(minuteInput.value, 10); }
  function defendingTeam(attackingTeam) { return attackingTeam === "mighty" ? "opponent" : "mighty"; }
  function currentGoalRoster() { return rosterForTeam(selectedGoalTeam(), opponent()); }
  function currentPenaltyShotShooterRoster() { return rosterForTeam(penaltyShotTeam.value, opponent()); }
  function currentPenaltyShotGoalieRoster() { return goalieRosterForTeam(defendingTeam(penaltyShotTeam.value), opponent()); }
  function currentShootoutRoster() { return rosterForTeam(shootoutTeam.value, opponent()); }

  const goalBinding = bindNumberSelect(goalNumber, goalPlayer, currentGoalRoster);
  const assist1Binding = bindNumberSelect(assist1Number, assist1, currentGoalRoster);
  const assist2Binding = bindNumberSelect(assist2Number, assist2, currentGoalRoster);
  const penaltyShotBinding = bindNumberSelect(penaltyShotNumber, penaltyShotPlayer, currentPenaltyShotShooterRoster);
  const penaltyShotGoalieBinding = bindNumberSelect(penaltyShotGoalieNumber, penaltyShotGoalie, currentPenaltyShotGoalieRoster);
  const shootoutBinding = bindNumberSelect(shootoutNumber, shootoutPlayer, currentShootoutRoster);

  function syncContext() {
    const minute = Math.max(1, selectedMinute() || 1);
    state.minute = minute;
    minuteInput.value = String(minute);
    segmentLabel.textContent = segmentForMinute(minute).label;
    saveState(state);
  }

  function syncScore() {
    const score = calculateScore(state.history);
    mightyScore.textContent = String(score.mighty);
    opponentScore.textContent = String(score.opponent);
    $("#actionGoalOpponentLabel").innerHTML = '<span aria-hidden="true">🥅</span><span>Tor Gegner</span>';
    const opponentShootoutOption = shootoutTeam.querySelector("option[value='opponent']");
    if (opponentShootoutOption) opponentShootoutOption.textContent = opponent().shortName;
    const opponentPenaltyShotOption = penaltyShotTeam.querySelector("option[value='opponent']");
    if (opponentPenaltyShotOption) opponentPenaltyShotOption.textContent = opponent().shortName;
    const shootout = calculateShootout(state.history);
    const hasShootout = state.history.some(event => event.type === "shootout");
    shootoutStatus.hidden = !hasShootout;
    shootoutStatus.textContent = hasShootout ? `Penaltyschießen · Treffer ${shootout.mighty}:${shootout.opponent}` : "";
  }

  function syncGoalRoster() {
    const team = selectedGoalTeam();
    const roster = rosterForTeam(team, opponent());
    goalPlayerLabel.textContent = team === "mighty" ? "Torschütze Mighty Dogs" : `Torschütze ${opponent().shortName}`;
    const values = [goalPlayer.value, assist1.value, assist2.value];
    fillPlayerSelect(goalPlayer, roster, values[0], "Spieler wählen", GOAL_POSITION_ORDER);
    fillPlayerSelect(assist1, roster, values[1], "Kein / 1. Assist noch unbekannt", GOAL_POSITION_ORDER);
    fillPlayerSelect(assist2, roster, values[2], "Kein / 2. Assist noch unbekannt", GOAL_POSITION_ORDER);
    goalBinding.syncFromSelect();
    assist1Binding.syncFromSelect();
    assist2Binding.syncFromSelect();
  }

  function syncPenaltyShotRosters(selectedShooter = penaltyShotPlayer.value, selectedGoalie = penaltyShotGoalie.value) {
    const attackingTeam = penaltyShotTeam.value;
    const defending = defendingTeam(attackingTeam);
    penaltyShotShooterLabel.textContent = `Schütze ${teamName(attackingTeam, opponent())}`;
    penaltyShotGoalieLabel.textContent = `Goalie ${teamName(defending, opponent())}`;
    fillPlayerSelect(penaltyShotPlayer, currentPenaltyShotShooterRoster(), selectedShooter, "Schütze noch unbekannt", GOAL_POSITION_ORDER);
    fillPlayerSelect(penaltyShotGoalie, currentPenaltyShotGoalieRoster(), selectedGoalie, "Goalie noch unbekannt", ["Tor"]);
    penaltyShotBinding.syncFromSelect();
    penaltyShotGoalieBinding.syncFromSelect();
  }

  function syncShootoutRoster(selected = shootoutPlayer.value) {
    fillPlayerSelect(shootoutPlayer, currentShootoutRoster(), selected, "Schütze noch unbekannt", GOAL_POSITION_ORDER);
    shootoutBinding.syncFromSelect();
  }

  function syncActionFields() {
    const action = selectedAction();
    goalFields.hidden = !["GOAL_MIGHTY", "GOAL_OPPONENT"].includes(action);
    penaltyFields.hidden = action !== "PENALTY";
    situationFields.hidden = action !== "SITUATION";
    penaltyShotFields.hidden = !penaltyShotSelected();
    shootoutFields.hidden = action !== "SHOOTOUT";
    if (!goalFields.hidden) syncGoalRoster();
    if (!penaltyShotFields.hidden) syncPenaltyShotRosters();
    if (!shootoutFields.hidden) syncShootoutRoster();
    syncTemplateStyleTitles();
    errorBox.hidden = true;
  }

  function createPenaltyRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "penalty-row";
    row.innerHTML = `<div class="penalty-row-head"><strong>Strafe</strong><div class="penalty-row-actions"><button class="add-penalty" type="button">Hinzufügen</button><button class="remove-penalty" type="button">Entfernen</button></div></div><div class="penalty-grid"><div class="field"><label class="label">Team</label><select data-field="team"><option value="mighty">Mighty Dogs</option><option value="opponent">${opponent().shortName}</option></select></div><div class="field"><label class="label">Strafzeit</label><select data-field="duration"></select></div><div class="field wide"><label class="label">Spieler</label><div class="player-entry"><input class="jersey-number" data-field="number" type="text" inputmode="numeric" autocomplete="off" placeholder="#" aria-label="Trikotnummer"><select data-field="player"></select></div></div><div class="field wide"><label class="label">Strafgrund</label><select data-field="reason"></select></div></div>`;
    const team = row.querySelector("[data-field='team']");
    const duration = row.querySelector("[data-field='duration']");
    const player = row.querySelector("[data-field='player']");
    const number = row.querySelector("[data-field='number']");
    const reason = row.querySelector("[data-field='reason']");
    team.value = initial.team || "mighty";
    PENALTY_DURATIONS.forEach(value => duration.append(new Option(`${value} Min.`, value)));
    duration.value = initial.duration || "2";
    PENALTY_REASONS.forEach(value => reason.append(new Option(value, value)));
    reason.value = initial.reason || PENALTY_REASONS[0];
    const getRoster = () => rosterForTeam(team.value, opponent());
    fillPlayerSelect(player, getRoster(), initial.player?.name || "", "Spieler noch unbekannt", PENALTY_POSITION_ORDER);
    const binding = bindNumberSelect(number, player, getRoster);
    binding.syncFromSelect();
    team.addEventListener("change", () => {
      fillPlayerSelect(player, getRoster(), "", "Spieler noch unbekannt", PENALTY_POSITION_ORDER);
      binding.syncFromSelect();
      syncTemplateStyleTitles();
    });
    row.querySelector(".add-penalty").addEventListener("click", () => {
      createPenaltyRow();
      queueMicrotask(() => refreshDraftOutput());
    });
    row.querySelector(".remove-penalty").addEventListener("click", () => {
      if (penaltyRows.children.length > 1) {
        row.remove();
        syncTemplateStyleTitles();
        queueMicrotask(() => refreshDraftOutput());
      }
    });
    penaltyRows.append(row);
    syncTemplateStyleTitles();
  }

  function ensurePenaltyRow() { if (!penaltyRows.children.length) createPenaltyRow(); }

  function penaltyRowData(row) {
    const team = row.querySelector("[data-field='team']").value;
    return {
      team,
      duration: row.querySelector("[data-field='duration']").value,
      reason: row.querySelector("[data-field='reason']").value,
      player: playerFromSelect(row.querySelector("[data-field='player']"), rosterForTeam(team, opponent()))
    };
  }

  function historyTitle(event) {
    if (event.type === "goal") return `${event.minute}' Tor ${teamName(event.team, opponent())}`;
    if (isPenaltyShotEvent(event)) return `${event.minute}' Straf-Penalty ${teamName(event.team, opponent())} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    if (event.type === "shootout") return `Penalty ${teamName(event.team, opponent())} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    const teams = [...new Set(event.penalties.map(item => teamName(item.team, opponent())))].join(" + ");
    return `${event.minute}' Strafe(n) ${teams}`;
  }

  function historyDetail(event) {
    if (event.type === "goal") {
      const scorer = goalPlayerLine(event);
      const assists = assistLine(event);
      return [eventSegment(event).label, scorer, assists].filter(Boolean).join(" · ");
    }
    if (isPenaltyShotEvent(event)) {
      const shooter = event.player ? playerText(event.player) : "Schütze offen";
      const goalie = event.goalie ? playerText(event.goalie) : "Goalie offen";
      return `${eventSegment(event).label} · ${shooter} gegen ${goalie} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    }
    if (event.type === "shootout") return event.player ? playerText(event.player) : "Schütze offen";
    return `${eventSegment(event).label} · ${event.penalties.map(item => `${item.duration} min ${item.reason}`).join(" · ")}`;
  }

  function compactHistoryTitle(event) {
    if (event.type === "goal") {
      const scorer = event.player?.name || "Torschütze offen";
      return `${event.minute}' 🥅 ${scorer} · ${teamName(event.team, opponent())}`;
    }
    if (isPenaltyShotEvent(event)) {
      const shooter = event.player?.name || "Schütze offen";
      return `${event.minute}' 🏒 Straf-Penalty · ${shooter} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    }
    if (event.type === "shootout") {
      const shooter = event.player?.name || teamName(event.team, opponent());
      return `🏒 ${shooter} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    }
    const first = event.penalties?.[0] || null;
    const subject = first?.player?.name || (first ? teamName(first.team, opponent()) : "Strafe");
    const suffix = first ? `${first.duration} Min.` : "";
    return `${event.minute}' 🚨 ${subject}${suffix ? ` · ${suffix}` : ""}`;
  }

  function renderHistory() {
    historyList.replaceChildren();
    const ordered = historyByMinute(state.history).reverse();
    historyEmpty.hidden = ordered.length > 0;
    const visible = historyExpanded ? ordered : ordered.slice(0, 5);
    visible.forEach(event => {
      const item = document.createElement("article");
      const major = event.type === "penalty" && !isPenaltyShotEvent(event) && event.penalties.some(entry => isMajorPenalty(entry.duration));
      item.className = `history-item${major ? " major" : ""}`;
      item.dataset.eventId = event.id;
      item.innerHTML = `<button class="history-summary" type="button" data-expand="${event.id}" aria-expanded="false"><span>${compactHistoryTitle(event)}</span><span class="history-chevron" aria-hidden="true">⌄</span></button><div class="history-details" data-history-details="${event.id}" hidden><small>${historyDetail(event)}</small><div class="history-buttons"><button type="button" data-edit="${event.id}">Bearbeiten</button><button type="button" data-delete="${event.id}">Zurücknehmen</button></div></div>`;
      historyList.append(item);
    });
    if (historyToggle) {
      historyToggle.hidden = ordered.length <= 5;
      historyToggle.textContent = historyExpanded ? "Weniger anzeigen ▴" : "Alle Ereignisse anzeigen ▾";
    }
    syncScore();
  }

  function setCopyState(text = "", isError = false) {
    if (!outputCopyState) return;
    outputCopyState.textContent = text;
    outputCopyState.classList.toggle("error", isError);
  }

  function whatsappAutoSendReady() {
    const runtime = globalThis.PD_LIVETICKER_WHATSAPP_RUNTIME;
    const mode = globalThis.PD_LIVETICKER_TEXT_MODE || (runtime?.ready ? "WHATSAPP" : "COPY");
    return Boolean(runtime?.ready) && mode === "WHATSAPP";
  }

  function syncSubmitModeLabel() {
    if (!submitButton) return;
    const label = whatsappAutoSendReady()
      ? "Speichern und an WhatsApp senden"
      : "Speichern und kopieren";
    submitButton.setAttribute("aria-label", label);
    submitButton.title = label;
    const icon = submitButton.querySelector('[aria-hidden="true"]');
    if (icon) icon.textContent = whatsappAutoSendReady() ? "💾 📲" : "💾 📋";
    const hiddenLabel = submitButton.querySelector(".visually-hidden");
    if (hiddenLabel) hiddenLabel.textContent = label;
  }

  function serverActionFingerprint(action) {
    return canonicalServerActionFingerprint(action);
  }

  function setPendingServerSave(action) {
    pendingServerActionId = String(action?.id || "");
    pendingServerActionFingerprint = serverActionFingerprint(action);
    if (submitButton) submitButton.disabled = Boolean(pendingServerActionId);
  }

  function clearPendingServerSave() {
    pendingServerActionId = "";
    pendingServerActionFingerprint = "";
    if (submitButton) submitButton.disabled = false;
    syncSubmitModeLabel();
  }

  function confirmPendingServerSave(serverState) {
    if (!pendingServerActionId || !Array.isArray(serverState?.history)) return false;
    const saved = serverState.history.find(item => String(item?.id || "") === pendingServerActionId);
    if (!saved || serverActionFingerprint(saved) !== pendingServerActionFingerprint) return false;
    clearPendingServerSave();
    return true;
  }

  function failPendingServerSave(message) {
    if (!pendingServerActionId) return;
    clearPendingServerSave();
    errorBox.textContent = String(message || "Aktion konnte nicht auf dem Server gespeichert werden.");
    errorBox.hidden = false;
  }

  function renderOutputPreview() {
    if (outputPreview) outputPreview.textContent = output.value;
  }

  function showOutputPreview() {
    outputEditing = false;
    if (outputCard) outputCard.hidden = !output.value.trim();
    if (outputPreview) outputPreview.hidden = false;
    output.hidden = true;
    if (editOutputButton) editOutputButton.hidden = false;
    if (saveOutputButton) saveOutputButton.hidden = true;
    renderOutputPreview();
  }

  function setOutput(text) {
    output.value = text;
    if (copyButton) {
      copyButton.dataset.copied = "false";
      copyButton.textContent = "Kopieren";
      copyButton.hidden = true;
    }
    setCopyState("");
    showOutputPreview();
  }

  async function copyCurrentOutput() {
    const text = output.value.trim();
    if (!text) return false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(output.value);
      setCopyState("✓ kopiert");
      if (copyButton) copyButton.hidden = true;
      return true;
    } catch {
      try {
        output.hidden = false;
        output.focus();
        output.select();
        const copied = document.execCommand("copy");
        if (!copied) throw new Error("COPY_FAILED");
        showOutputPreview();
        setCopyState("✓ kopiert");
        if (copyButton) copyButton.hidden = true;
        return true;
      } catch {
        showOutputPreview();
        setCopyState("Gespeichert · Kopieren fehlgeschlagen", true);
        if (copyButton) copyButton.hidden = false;
        return false;
      }
    }
  }

  function cancelEdit() {
    editingId = null;
    preservedPenaltyDraftId = null;
    previewDraftId = uid();
    outputManuallyEdited = false;
    editingBanner.hidden = true;
    editingBanner.querySelector("span").textContent = "Aktion wird bearbeitet";
    submitButton.innerHTML = '<span aria-hidden="true">💾 📋</span><span class="visually-hidden">Speichern und kopieren</span>';
    penaltyRows.replaceChildren();
    ensurePenaltyRow();
    if (assistDetails) assistDetails.open = false;
    syncActionFields();
    syncSubmitModeLabel();
  }

  function resetPenaltyShotDraft() {
    situationPenaltyShot.checked = false;
    penaltyShotTeam.value = "mighty";
    penaltyShotNumber.value = "";
    penaltyShotGoalieNumber.value = "";
    const scored = $("#penaltyShotScored");
    if (scored) scored.checked = true;
    syncPenaltyShotRosters("", "");
    syncActionFields();
    window.dispatchEvent(new CustomEvent("pd-liveticker-action-mode-changed"));
  }

  function preservePenaltyDraft(id) {
    editingId = id;
    preservedPenaltyDraftId = id;
    previewDraftId = id;
    outputManuallyEdited = false;
    editingBanner.hidden = false;
    editingBanner.querySelector("span").textContent = "Strafe gespeichert · Textoption kann gewechselt werden";
    submitButton.innerHTML = '<span aria-hidden="true">💾 📋</span><span class="visually-hidden">Speichern und kopieren</span>';
    syncSubmitModeLabel();
  }

  function editEvent(id) {
    const event = state.history.find(item => item.id === id);
    if (!event) return;
    preservedPenaltyDraftId = null;
    editingId = id;
    previewDraftId = id;
    outputManuallyEdited = false;
    editingBanner.hidden = false;
    submitButton.innerHTML = '<span aria-hidden="true">💾 📋</span><span class="visually-hidden">Speichern und kopieren</span>';
    if (event.type !== "shootout") minuteInput.value = String(event.minute);
    if (event.type === "goal") {
      $(event.team === "mighty" ? "#actionGoalMighty" : "#actionGoalOpponent").checked = true;
      syncActionFields();
      const roster = rosterForTeam(event.team, opponent());
      fillPlayerSelect(goalPlayer, roster, event.player?.name || "", "Spieler wählen", GOAL_POSITION_ORDER);
      fillPlayerSelect(assist1, roster, event.assists?.[0]?.name || "", "Kein / 1. Assist noch unbekannt", GOAL_POSITION_ORDER);
      fillPlayerSelect(assist2, roster, event.assists?.[1]?.name || "", "Kein / 2. Assist noch unbekannt", GOAL_POSITION_ORDER);
      if (assistDetails) assistDetails.open = Boolean(event.assists?.length);
      goalBinding.syncFromSelect();
      assist1Binding.syncFromSelect();
      assist2Binding.syncFromSelect();
      const style = $(`input[name='goalStyle'][value='${event.style || "classic"}']`);
      if (style) style.checked = true;
    } else if (isPenaltyShotEvent(event)) {
      $("#actionSituation").checked = true;
      situationPenaltyShot.checked = true;
      penaltyShotTeam.value = event.team;
      syncActionFields();
      syncPenaltyShotRosters(event.player?.name || "", event.goalie?.name || "");
      const result = $(`input[name='penaltyShotResult'][value='${event.result || "missed"}']`);
      if (result) result.checked = true;
    } else if (event.type === "penalty") {
      $("#actionPenalty").checked = true;
      situationPenaltyShot.checked = false;
      syncActionFields();
      penaltyRows.replaceChildren();
      event.penalties.forEach(createPenaltyRow);
      const style = $(`input[name='penaltyStyle'][value='${event.style || "classic"}']`);
      if (style) style.checked = true;
    } else {
      $("#actionShootout").checked = true;
      syncActionFields();
      shootoutTeam.value = event.team;
      syncShootoutRoster(event.player?.name || "");
      const result = $(`input[name='shootoutResult'][value='${event.result}']`);
      if (result) result.checked = true;
    }
    syncContext();
    refreshDraftOutput({ force: true });
    window.scrollTo({ top: form.offsetTop - 10, behavior: "smooth" });
  }

  function validateMinute() {
    const minute = selectedMinute();
    if (!Number.isInteger(minute) || minute < 1) throw new Error("Bitte eine gültige Spielminute ab 1 eingeben.");
    return minute;
  }

  function validateGoalPeople(player, assists) {
    const names = [player, ...assists].filter(Boolean).map(item => item.name);
    if (new Set(names).size !== names.length) throw new Error("Torschütze und Assists müssen unterschiedliche Spieler sein.");
  }

  function buildTickerEvent() {
    const action = selectedAction();
    const eventId = editingId || previewDraftId;
    if (action === "SITUATION") {
      if (!penaltyShotSelected()) return null;
      const minute = validateMinute();
      const team = penaltyShotTeam.value;
      const defending = defendingTeam(team);
      return {
        id: eventId,
        type: "penalty",
        subtype: "penalty_shot",
        minute,
        team,
        player: playerFromSelect(penaltyShotPlayer, currentPenaltyShotShooterRoster()),
        goalie: playerFromSelect(penaltyShotGoalie, currentPenaltyShotGoalieRoster()),
        result: new FormData(form).get("penaltyShotResult") || "missed",
        penalties: [{ team: defending, duration: "Penalty", reason: "Straf-Penalty", player: null }]
      };
    }
    if (action === "SHOOTOUT") {
      const team = shootoutTeam.value;
      const roster = rosterForTeam(team, opponent());
      return {
        id: eventId,
        type: "shootout",
        team,
        player: playerFromSelect(shootoutPlayer, roster),
        result: new FormData(form).get("shootoutResult") || "scored"
      };
    }

    const minute = validateMinute();
    if (action === "PENALTY") {
      const penalties = [...penaltyRows.children].map(penaltyRowData);
      if (!penalties.length) throw new Error("Bitte mindestens eine Strafe erfassen.");
      return applyPenaltyStyleToDraft({
        id: eventId,
        type: "penalty",
        minute,
        penalties
      }, new FormData(form).get("penaltyStyle") || "classic");
    }

    const team = selectedGoalTeam();
    const roster = rosterForTeam(team, opponent());
    const player = playerFromSelect(goalPlayer, roster);
    const assists = [playerFromSelect(assist1, roster), playerFromSelect(assist2, roster)].filter(Boolean);
    validateGoalPeople(player, assists);
    return {
      id: eventId,
      type: "goal",
      team,
      minute,
      player,
      assists,
      style: new FormData(form).get("goalStyle") || "classic"
    };
  }

  function draftOutputText(tickerEvent) {
    const previewHistory = historyWithDraftEvent(state.history, editingId, tickerEvent);
    return formatEventText(tickerEvent, previewHistory, opponent());
  }

  function refreshDraftOutput({ force = false } = {}) {
    if (outputManuallyEdited && !force) return;
    if (selectedAction() === "SITUATION" && !penaltyShotSelected()) {
      output.value = "";
      if (outputCard) outputCard.hidden = true;
      return;
    }
    try {
      const tickerEvent = buildTickerEvent();
      if (!tickerEvent) return;
      const text = draftOutputText(tickerEvent);
      setOutput(text);
    } catch {
      output.value = "";
      if (outputCard) outputCard.hidden = true;
    }
  }

  form.addEventListener("change", event => {
    if (event.target.name !== "action") return;
    outputManuallyEdited = false;
    if (!editingId) previewDraftId = uid();
    if (preservedPenaltyDraftId && selectedAction() !== "PENALTY") cancelEdit();
    else syncActionFields();
    queueMicrotask(() => refreshDraftOutput({ force: true }));
  });
  form.addEventListener("input", () => queueMicrotask(() => refreshDraftOutput()));
  form.addEventListener("change", event => {
    if (event.target.name === "action") return;
    queueMicrotask(() => refreshDraftOutput());
  });
  minuteInput.addEventListener("change", syncContext);
  opponentSelect.addEventListener("change", () => {
    state.opponentId = opponentSelect.value;
    saveState(state);
    syncScore();
    syncActionFields();
    [...penaltyRows.children].forEach(row => {
      const team = row.querySelector("[data-field='team']").value;
      row.querySelector("[data-field='team'] option[value='opponent']").textContent = opponent().shortName;
      const player = row.querySelector("[data-field='player']");
      const number = row.querySelector("[data-field='number']");
      fillPlayerSelect(player, rosterForTeam(team, opponent()), "", "Spieler noch unbekannt", PENALTY_POSITION_ORDER);
      number.value = "";
    });
    syncPenaltyShotRosters("", "");
  });
  penaltyShotTeam.addEventListener("change", () => syncPenaltyShotRosters("", ""));
  situationPenaltyShot.addEventListener("change", () => {
    outputManuallyEdited = false;
    if (!editingId) previewDraftId = uid();
    syncActionFields();
    queueMicrotask(() => refreshDraftOutput({ force: true }));
  });
  shootoutTeam.addEventListener("change", () => syncShootoutRoster(""));

  document.querySelectorAll("[data-minute-step]").forEach(button => {
    button.addEventListener("click", () => {
      minuteInput.value = String(Math.max(1, (selectedMinute() || 1) + Number.parseInt(button.dataset.minuteStep, 10)));
      syncContext();
      queueMicrotask(() => refreshDraftOutput());
    });
  });

  $("#cancelEdit").addEventListener("click", cancelEdit);

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (pendingServerActionId) {
      errorBox.textContent = "Speichern läuft bereits – bitte die Serverbestätigung abwarten.";
      errorBox.hidden = false;
      return;
    }
    errorBox.hidden = true;
    try {
      let tickerEvent = buildTickerEvent();
      if (!tickerEvent) throw new Error("Für eine Spielsituation gibt es keine Textaktion zu speichern.");
      if (!outputManuallyEdited) setOutput(draftOutputText(tickerEvent));
      if (!output.value.trim()) throw new Error("Der Vorschautext darf nicht leer sein.");

      const runtime = globalThis.PD_LIVETICKER_WHATSAPP_RUNTIME;
      const whatsappEnabled = !editingId && whatsappAutoSendReady();
      tickerEvent = attachSubmitWhatsappIntent(tickerEvent, output.value, {
        editingId,
        enabled: whatsappEnabled
      });
      const copyAfterSave = shouldCopyLivetickerOutput({
        whatsappEnabled,
        transportReady: Boolean(runtime?.ready)
      });

      setPendingServerSave(tickerEvent);
      const lifecycle = completeTickerSubmitLifecycle({
        state,
        editingId,
        tickerEvent,
        persist: () => saveState(state),
        renderHistory,
        renderOutput: () => {
          renderOutputPreview();
          showOutputPreview();
          if (copyAfterSave) {
            void copyCurrentOutput();
          } else {
            setCopyState("Wird an WhatsApp gesendet …");
            if (copyButton) copyButton.hidden = true;
          }
        },
        preservePenaltyDraft,
        cancelEdit,
        syncContext
      });
      previewDraftId = lifecycle.preservePenaltyDraft ? tickerEvent.id : uid();
      if (isPenaltyShotEvent(tickerEvent) && !lifecycle.preservePenaltyDraft) resetPenaltyShotDraft();
      outputManuallyEdited = false;
      syncSubmitModeLabel();
    } catch (error) {
      clearPendingServerSave();
      errorBox.textContent = error.message || "Aktion konnte nicht gespeichert werden.";
      errorBox.hidden = false;
    }
  });

  historyList.addEventListener("click", event => {
    const editButton = event.target.closest?.("[data-edit]");
    const deleteButton = event.target.closest?.("[data-delete]");
    const expandButton = event.target.closest?.("[data-expand]");
    const editId = editButton?.dataset.edit || "";
    const deleteId = deleteButton?.dataset.delete || "";
    if (editId) { editEvent(editId); return; }
    if (deleteId) {
      const item = state.history.find(entry => entry.id === deleteId);
      if (!item || !window.confirm(`Aktion „${historyTitle(item)}“ wirklich zurücknehmen?`)) return;
      state.history = state.history.filter(entry => entry.id !== deleteId);
      saveState(state);
      renderHistory();
      if (editingId === deleteId) cancelEdit();
      return;
    }
    if (expandButton) {
      const id = expandButton.dataset.expand || "";
      const details = historyList.querySelector(`[data-history-details="${id}"]`);
      if (!details) return;
      const expanded = expandButton.getAttribute("aria-expanded") === "true";
      expandButton.setAttribute("aria-expanded", String(!expanded));
      details.hidden = expanded;
    }
  });

  historyToggle?.addEventListener("click", () => {
    historyExpanded = !historyExpanded;
    renderHistory();
  });

  function requestSummaryOutput(kind, text) {
    setOutput(text);
    void copyCurrentOutput();
    errorBox.hidden = true;
    window.dispatchEvent(new CustomEvent("pd-liveticker-summary-requested", {
      detail: { kind, text }
    }));
  }

  $("#period1OutputButton")?.addEventListener("click", () => {
    try {
      requestSummaryOutput("PERIOD_1", formatSegmentSummary(state.history, "P1", opponent()));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });
  $("#period2OutputButton")?.addEventListener("click", () => {
    try {
      requestSummaryOutput("PERIOD_2", formatSegmentSummary(state.history, "P2", opponent()));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });
  $("#finalOutputButton")?.addEventListener("click", () => {
    try {
      requestSummaryOutput("FINAL", formatFinalSummary(state.history, opponent()));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });

  copyButton?.addEventListener("click", async () => {
    await copyCurrentOutput();
    errorBox.hidden = true;
  });

  editOutputButton?.addEventListener("click", () => {
    if (!output.value.trim()) return;
    outputEditing = true;
    if (outputPreview) outputPreview.hidden = true;
    output.hidden = false;
    editOutputButton.hidden = true;
    if (saveOutputButton) saveOutputButton.hidden = false;
    if (copyButton) copyButton.hidden = true;
    setCopyState("");
    output.focus();
  });

  output?.addEventListener("input", () => {
    if (!outputEditing) return;
    outputManuallyEdited = true;
    setCopyState("Manuell geändert");
  });

  saveOutputButton?.addEventListener("click", () => {
    if (!output.value.trim()) return;
    renderOutputPreview();
    showOutputPreview();
    setCopyState("Text übernommen");
  });

  $("#resetGame").addEventListener("click", () => {
    if (!window.confirm("Alle lokal gespeicherten Testaktionen und den Spielstand zurücksetzen?")) return;
    state = defaultState();
    editingId = null;
    saveState(state);
    opponentSelect.value = state.opponentId;
    minuteInput.value = "1";
    output.value = "";
    historyExpanded = false;
    outputEditing = false;
    outputManuallyEdited = false;
    previewDraftId = uid();
    if (outputCard) outputCard.hidden = true;
    setCopyState("");
    goalNumber.value = "";
    assist1Number.value = "";
    assist2Number.value = "";
    penaltyShotNumber.value = "";
    penaltyShotGoalieNumber.value = "";
    situationPenaltyShot.checked = false;
    shootoutNumber.value = "";
    penaltyRows.replaceChildren();
    ensurePenaltyRow();
    cancelEdit();
    syncContext();
    renderHistory();
  });

  ensurePenaltyRow();
  syncContext();
  syncScore();
  syncActionFields();
  renderHistory();
  syncSubmitModeLabel();
  refreshDraftOutput({ force: true });
  window.addEventListener("pd-liveticker-server-synced", event => {
    confirmPendingServerSave(event.detail?.state);
  });
  window.addEventListener("pd-liveticker-server-sync-error", event => {
    failPendingServerSave(event.detail?.message || "Speicherfehler");
  });
  window.addEventListener("pd-liveticker-sync-circuit-open", () => {
    failPendingServerSave("Synchronisation wurde wegen ungewöhnlich vieler Änderungen gestoppt. Bitte Seite neu laden.");
  });
  window.addEventListener("pd-liveticker-whatsapp-runtime", syncSubmitModeLabel);
  window.addEventListener("pd-liveticker-text-mode", syncSubmitModeLabel);
}

if (typeof document !== "undefined") initialize();

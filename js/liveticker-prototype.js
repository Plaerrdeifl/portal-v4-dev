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

export function playerText(player) {
  if (!player) return "";
  return player.number ? `#${player.number} ${player.name}` : player.name;
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

export function calculateScore(history) {
  return history.reduce((score, event) => {
    if (event.type === "goal" && (event.team === "mighty" || event.team === "opponent")) score[event.team] += 1;
    return score;
  }, { mighty: 0, opponent: 0 });
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
  if (history.some(event => event.type === "goal" && Number(event.minute) > 60)) return { ...regular, suffix: "n. V." };
  return { ...regular, suffix: "" };
}

export function scoreAtEvent(history, eventId) {
  const score = { mighty: 0, opponent: 0 };
  for (const event of history) {
    if (event.type === "goal") score[event.team] += 1;
    if (event.id === eventId) break;
  }
  return score;
}

function teamName(team, opponent) {
  return team === "mighty" ? "Mighty Dogs" : opponent.shortName;
}

function goalPlayerLine(event) {
  return event.player ? playerText(event.player) : "Torschütze noch offen";
}

function assistPlayers(event) {
  return Array.isArray(event.assists) ? event.assists.filter(Boolean).slice(0, 2) : [];
}

function assistLine(event) {
  const assists = assistPlayers(event);
  return assists.length ? `Assists: ${assists.map(playerText).join(" · ")}` : "";
}

function eventSegment(event) {
  if (event.type === "shootout") return SEGMENTS.SO;
  return segmentForMinute(event.minute);
}

export function formatGoalText(event, history, opponent) {
  const score = scoreAtEvent(history, event.id);
  const minute = `${event.minute} Spielminute`;
  const scorer = goalPlayerLine(event);
  const assists = assistLine(event);
  const details = assists ? [scorer, assists] : [scorer];

  if (event.team === "opponent") {
    if (event.style === "short") return [minute, `Tor ${opponent.shortName}`, ...details, "", `*${score.mighty}:${score.opponent}*`].join("\n");
    return [minute, `Tor ${opponent.shortName}`, ...details, "", "Neuer Spielstand", `*${score.mighty}:${score.opponent}*`].join("\n");
  }

  if (event.style === "emotional") {
    return [minute, "🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥", "", ...details, "", "Neuer Spielstand", `*${score.mighty}:${score.opponent}*`].join("\n");
  }
  if (event.style === "short") {
    return [minute, "*TOOOOOR SCHWEINFURT!*", ...details, "", `*${score.mighty}:${score.opponent}*`].join("\n");
  }
  return [minute, "*Tooooooor für unsere Schweinfurter Mighty Dogs*", "", `Torschütze: ${scorer}`, ...(assists ? [assists] : []), "", "Neuer Spielstand", `*${score.mighty}:${score.opponent}*`].join("\n");
}

function formatPenaltyEntry(penalty, opponent) {
  const player = penalty.player ? ` · ${playerText(penalty.player)}` : "";
  return `${teamName(penalty.team, opponent)} · ${penalty.duration} min · ${penalty.reason}${player}`;
}

export function formatPenaltyText(event, opponent) {
  const lines = [`${event.minute} Spielminute`, "Strafe(n)", ""];
  for (const penalty of event.penalties) {
    const line = formatPenaltyEntry(penalty, opponent);
    lines.push(isMajorPenalty(penalty.duration) ? `🚨 *${line}*` : line);
  }
  return lines.join("\n");
}

export function formatShootoutText(event, opponent) {
  const result = event.result === "scored" ? "✅ verwandelt" : "❌ vergeben";
  const shooter = event.player ? playerText(event.player) : "Schütze noch offen";
  return ["*Penaltyschießen*", `${teamName(event.team, opponent)} · ${shooter}`, result].join("\n");
}

export function formatEventText(event, history, opponent) {
  if (event.type === "goal") return formatGoalText(event, history, opponent);
  if (event.type === "penalty") return formatPenaltyText(event, opponent);
  if (event.type === "shootout") return formatShootoutText(event, opponent);
  throw new Error("Unbekannte Aktion.");
}

function goalSummaryLines(history, team, segmentKey = null) {
  return history
    .filter(event => event.type === "goal" && event.team === team && (!segmentKey || eventSegment(event).key === segmentKey))
    .map(event => `${event.minute} Spielminute – ${goalPlayerLine(event)}`);
}

export function formatSegmentSummary(history, segmentKey, opponent) {
  const segment = SEGMENTS[segmentKey];
  if (!segment || segment.key === "SO") throw new Error("Für diesen Abschnitt gibt es keine Drittelzusammenfassung.");
  const score = history.reduce((result, event) => {
    if (event.type === "goal" && eventSegment(event).order <= segment.order) result[event.team] += 1;
    return result;
  }, { mighty: 0, opponent: 0 });
  const mighty = goalSummaryLines(history, "mighty", segment.key);
  const away = goalSummaryLines(history, "opponent", segment.key);
  const headline = segment.key === "OT"
    ? `*Ende Overtime – ${score.mighty}:${score.opponent}*`
    : `*Ende ${segment.label} – ${score.mighty}:${score.opponent}*`;
  return [
    headline,
    "",
    "🥅 *Mighty Dogs*",
    ...(mighty.length ? mighty : ["Keine Tore"]),
    "",
    `🥅 *${opponent.shortName}*`,
    ...(away.length ? away : ["Keine Tore"])
  ].join("\n");
}

export function formatPeriodSummary(history, period, opponent) {
  const key = { 1: "P1", 2: "P2", 3: "P3" }[Number.parseInt(period, 10)];
  if (!key) throw new Error("Ungültiges Drittel.");
  return formatSegmentSummary(history, key, opponent);
}

function penaltySummaryLines(history, team) {
  const lines = [];
  for (const event of history) {
    if (event.type !== "penalty") continue;
    for (const penalty of event.penalties.filter(entry => entry.team === team)) {
      const base = `${event.minute} Spielminute – ${penalty.player ? playerText(penalty.player) : "ohne Spieler"} – ${penalty.duration} min ${penalty.reason}`;
      lines.push(isMajorPenalty(penalty.duration) ? `🚨 *${base}*` : base);
    }
  }
  return lines.length ? lines : ["Keine Strafen"];
}

function shootoutSummaryLines(history, opponent) {
  const attempts = history.filter(event => event.type === "shootout");
  if (!attempts.length) return [];
  const score = calculateShootout(history);
  return [
    "",
    "🏒 *Penaltyschießen*",
    `Treffer: Mighty Dogs ${score.mighty}:${score.opponent} ${opponent.shortName}`,
    ...attempts.map(event => `${teamName(event.team, opponent)} · ${event.player ? playerText(event.player) : "Schütze offen"} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`)
  ];
}

export function formatFinalSummary(history, opponent) {
  const finalScore = calculateOfficialFinalScore(history);
  const suffix = finalScore.suffix ? ` ${finalScore.suffix}` : "";
  const mightyGoals = goalSummaryLines(history, "mighty");
  const opponentGoals = goalSummaryLines(history, "opponent");
  return [
    "*ENDSTAND*",
    `Mighty Dogs ${finalScore.mighty}:${finalScore.opponent} ${opponent.shortName}${suffix}`,
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

function fillPlayerSelect(select, roster, selected = "", placeholder = "Spieler noch unbekannt") {
  select.replaceChildren(new Option(placeholder, ""));
  for (const position of ["Tor", "Verteidigung", "Sturm"]) {
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

function initialize() {
  const form = document.querySelector("#tickerForm");
  if (!form) return;

  let state = loadState();
  let editingId = null;
  const $ = selector => document.querySelector(selector);
  const opponentSelect = $("#opponentSelect");
  const minuteInput = $("#gameMinute");
  const segmentLabel = $("#segmentLabel");
  const mightyScore = $("#mightyScore");
  const opponentScore = $("#opponentScore");
  const opponentScoreName = $("#opponentScoreName");
  const shootoutStatus = $("#shootoutStatus");
  const goalFields = $("#goalFields");
  const penaltyFields = $("#penaltyFields");
  const shootoutFields = $("#shootoutFields");
  const goalPlayer = $("#goalPlayer");
  const assist1 = $("#assist1");
  const assist2 = $("#assist2");
  const goalPlayerLabel = $("#goalPlayerLabel");
  const penaltyRows = $("#penaltyRows");
  const shootoutTeam = $("#shootoutTeam");
  const shootoutPlayer = $("#shootoutPlayer");
  const output = $("#tickerOutput");
  const errorBox = $("#formError");
  const copyButton = $("#copyButton");
  const submitButton = $("#submitButton");
  const editingBanner = $("#editingBanner");
  const historyList = $("#historyList");
  const historyEmpty = $("#historyEmpty");

  Object.values(OPPONENTS).forEach(item => opponentSelect.append(new Option(item.shortName, item.id)));
  opponentSelect.value = state.opponentId;
  minuteInput.value = String(state.minute);

  function opponent() { return OPPONENTS[state.opponentId]; }
  function selectedAction() { return new FormData(form).get("action"); }
  function selectedGoalTeam() { return selectedAction() === "GOAL_OPPONENT" ? "opponent" : "mighty"; }
  function selectedMinute() { return Number.parseInt(minuteInput.value, 10); }

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
    opponentScoreName.textContent = opponent().shortName;
    $("#actionGoalOpponentLabel").innerHTML = `🥅 Tor<br>${opponent().shortName}`;
    const opponentShootoutOption = shootoutTeam.querySelector("option[value='opponent']");
    if (opponentShootoutOption) opponentShootoutOption.textContent = opponent().shortName;
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
    fillPlayerSelect(goalPlayer, roster, values[0], "Torschütze noch unbekannt");
    fillPlayerSelect(assist1, roster, values[1], "Kein / 1. Assist noch unbekannt");
    fillPlayerSelect(assist2, roster, values[2], "Kein / 2. Assist noch unbekannt");
  }

  function syncShootoutRoster(selected = shootoutPlayer.value) {
    fillPlayerSelect(shootoutPlayer, rosterForTeam(shootoutTeam.value, opponent()), selected, "Schütze noch unbekannt");
  }

  function syncActionFields() {
    const action = selectedAction();
    goalFields.hidden = !["GOAL_MIGHTY", "GOAL_OPPONENT"].includes(action);
    penaltyFields.hidden = action !== "PENALTY";
    shootoutFields.hidden = action !== "SHOOTOUT";
    if (!goalFields.hidden) syncGoalRoster();
    if (!shootoutFields.hidden) syncShootoutRoster();
    errorBox.hidden = true;
  }

  function createPenaltyRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "penalty-row";
    row.innerHTML = `<div class="penalty-row-head"><strong>Strafe</strong><button class="remove-penalty" type="button">Entfernen</button></div><div class="penalty-grid"><div class="field"><label class="label">Team</label><select data-field="team"><option value="mighty">Mighty Dogs</option><option value="opponent">${opponent().shortName}</option></select></div><div class="field"><label class="label">Strafzeit</label><select data-field="duration"></select></div><div class="field wide"><label class="label">Spieler</label><select data-field="player"></select></div><div class="field wide"><label class="label">Strafgrund</label><select data-field="reason"></select></div></div>`;
    const team = row.querySelector("[data-field='team']");
    const duration = row.querySelector("[data-field='duration']");
    const player = row.querySelector("[data-field='player']");
    const reason = row.querySelector("[data-field='reason']");
    team.value = initial.team || "mighty";
    PENALTY_DURATIONS.forEach(value => duration.append(new Option(`${value} Min.`, value)));
    duration.value = initial.duration || "2";
    PENALTY_REASONS.forEach(value => reason.append(new Option(value, value)));
    reason.value = initial.reason || PENALTY_REASONS[0];
    fillPlayerSelect(player, rosterForTeam(team.value, opponent()), initial.player?.name || "");
    team.addEventListener("change", () => fillPlayerSelect(player, rosterForTeam(team.value, opponent())));
    row.querySelector(".remove-penalty").addEventListener("click", () => { if (penaltyRows.children.length > 1) row.remove(); });
    penaltyRows.append(row);
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
    if (event.type === "shootout") return `Penalty ${teamName(event.team, opponent())} · ${event.result === "scored" ? "verwandelt" : "vergeben"}`;
    const teams = [...new Set(event.penalties.map(item => teamName(item.team, opponent())))].join(" + ");
    return `${event.minute}' Strafe(n) ${teams}`;
  }

  function historyDetail(event) {
    if (event.type === "goal") {
      const assists = assistLine(event);
      return `${eventSegment(event).label} · ${goalPlayerLine(event)}${assists ? ` · ${assists}` : ""}`;
    }
    if (event.type === "shootout") return event.player ? playerText(event.player) : "Schütze offen";
    return `${eventSegment(event).label} · ${event.penalties.map(item => `${item.duration} min ${item.reason}`).join(" · ")}`;
  }

  function renderHistory() {
    historyList.replaceChildren();
    historyEmpty.hidden = state.history.length > 0;
    [...state.history].reverse().forEach(event => {
      const item = document.createElement("article");
      const major = event.type === "penalty" && event.penalties.some(entry => isMajorPenalty(entry.duration));
      item.className = `history-item${major ? " major" : ""}`;
      item.innerHTML = `<div class="history-main"><div class="history-copy"><strong>${major ? "🚨 " : ""}${historyTitle(event)}</strong><small>${historyDetail(event)}</small></div></div><div class="history-buttons"><button type="button" data-edit="${event.id}">Bearbeiten</button><button type="button" data-delete="${event.id}">Zurücknehmen</button></div>`;
      historyList.append(item);
    });
    syncScore();
  }

  function setOutput(text) {
    output.value = text;
    copyButton.dataset.copied = "false";
    copyButton.textContent = "Kopieren";
  }

  function cancelEdit() {
    editingId = null;
    editingBanner.hidden = true;
    submitButton.textContent = "Aktion speichern & Text erstellen";
    penaltyRows.replaceChildren();
    ensurePenaltyRow();
    syncActionFields();
  }

  function editEvent(id) {
    const event = state.history.find(item => item.id === id);
    if (!event) return;
    editingId = id;
    editingBanner.hidden = false;
    submitButton.textContent = "Änderung speichern & Text erstellen";
    if (event.type !== "shootout") minuteInput.value = String(event.minute);
    if (event.type === "goal") {
      $(event.team === "mighty" ? "#actionGoalMighty" : "#actionGoalOpponent").checked = true;
      syncActionFields();
      const roster = rosterForTeam(event.team, opponent());
      fillPlayerSelect(goalPlayer, roster, event.player?.name || "", "Torschütze noch unbekannt");
      fillPlayerSelect(assist1, roster, event.assists?.[0]?.name || "", "Kein / 1. Assist noch unbekannt");
      fillPlayerSelect(assist2, roster, event.assists?.[1]?.name || "", "Kein / 2. Assist noch unbekannt");
      const style = $(`input[name='goalStyle'][value='${event.style || "classic"}']`);
      if (style) style.checked = true;
    } else if (event.type === "penalty") {
      $("#actionPenalty").checked = true;
      syncActionFields();
      penaltyRows.replaceChildren();
      event.penalties.forEach(createPenaltyRow);
    } else {
      $("#actionShootout").checked = true;
      syncActionFields();
      shootoutTeam.value = event.team;
      syncShootoutRoster(event.player?.name || "");
      const result = $(`input[name='shootoutResult'][value='${event.result}']`);
      if (result) result.checked = true;
    }
    syncContext();
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

  form.addEventListener("change", event => {
    if (event.target.name === "action") syncActionFields();
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
      fillPlayerSelect(row.querySelector("[data-field='player']"), rosterForTeam(team, opponent()));
    });
  });
  shootoutTeam.addEventListener("change", () => syncShootoutRoster(""));

  document.querySelectorAll("[data-minute-step]").forEach(button => {
    button.addEventListener("click", () => {
      minuteInput.value = String(Math.max(1, (selectedMinute() || 1) + Number.parseInt(button.dataset.minuteStep, 10)));
      syncContext();
    });
  });

  $("#addPenalty").addEventListener("click", () => createPenaltyRow());
  $("#cancelEdit").addEventListener("click", cancelEdit);

  form.addEventListener("submit", event => {
    event.preventDefault();
    errorBox.hidden = true;
    try {
      const action = selectedAction();
      let tickerEvent;
      if (action === "SHOOTOUT") {
        const team = shootoutTeam.value;
        const roster = rosterForTeam(team, opponent());
        tickerEvent = {
          id: editingId || uid(), type: "shootout", team,
          player: playerFromSelect(shootoutPlayer, roster),
          result: new FormData(form).get("shootoutResult") || "scored"
        };
      } else {
        const minute = validateMinute();
        if (action === "PENALTY") {
          const penalties = [...penaltyRows.children].map(penaltyRowData);
          if (!penalties.length) throw new Error("Bitte mindestens eine Strafe erfassen.");
          tickerEvent = { id: editingId || uid(), type: "penalty", minute, penalties };
        } else {
          const team = selectedGoalTeam();
          const roster = rosterForTeam(team, opponent());
          const player = playerFromSelect(goalPlayer, roster);
          const assists = [playerFromSelect(assist1, roster), playerFromSelect(assist2, roster)].filter(Boolean);
          validateGoalPeople(player, assists);
          tickerEvent = {
            id: editingId || uid(), type: "goal", team, minute, player, assists,
            style: new FormData(form).get("goalStyle") || "classic"
          };
        }
      }
      const index = editingId ? state.history.findIndex(item => item.id === editingId) : -1;
      if (index >= 0) state.history.splice(index, 1, tickerEvent);
      else state.history.push(tickerEvent);
      if (tickerEvent.type !== "shootout") state.minute = tickerEvent.minute;
      saveState(state);
      renderHistory();
      setOutput(formatEventText(tickerEvent, state.history, opponent()));
      cancelEdit();
      syncContext();
    } catch (error) {
      errorBox.textContent = error.message || "Aktion konnte nicht gespeichert werden.";
      errorBox.hidden = false;
    }
  });

  historyList.addEventListener("click", event => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) editEvent(editId);
    if (deleteId) {
      const item = state.history.find(entry => entry.id === deleteId);
      if (!item || !window.confirm(`Aktion „${historyTitle(item)}“ wirklich zurücknehmen?`)) return;
      state.history = state.history.filter(entry => entry.id !== deleteId);
      saveState(state);
      renderHistory();
      if (editingId === deleteId) cancelEdit();
    }
  });

  $("#periodSummaryButton").addEventListener("click", () => {
    try { setOutput(formatSegmentSummary(state.history, segmentForMinute(selectedMinute()).key, opponent())); }
    catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  });
  $("#finalSummaryButton").addEventListener("click", () => setOutput(formatFinalSummary(state.history, opponent())));

  copyButton.addEventListener("click", async () => {
    if (!output.value.trim()) { errorBox.textContent = "Bitte zuerst einen Text erstellen."; errorBox.hidden = false; return; }
    try { await navigator.clipboard.writeText(output.value); }
    catch { output.focus(); output.select(); document.execCommand("copy"); }
    copyButton.dataset.copied = "true";
    copyButton.textContent = "Kopiert ✓";
    errorBox.hidden = true;
  });

  $("#resetGame").addEventListener("click", () => {
    if (!window.confirm("Alle lokal gespeicherten Testaktionen und den Spielstand zurücksetzen?")) return;
    state = defaultState();
    editingId = null;
    saveState(state);
    opponentSelect.value = state.opponentId;
    minuteInput.value = "1";
    output.value = "";
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
}

if (typeof document !== "undefined") initialize();

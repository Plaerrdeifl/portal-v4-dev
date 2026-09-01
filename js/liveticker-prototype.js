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
const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v2";

function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function playerText(player) {
  if (!player) return "";
  return player.number ? `#${player.number} ${player.name}` : player.name;
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
    if (event.type !== "goal") return score;
    if (event.team === "mighty") score.mighty += 1;
    if (event.team === "opponent") score.opponent += 1;
    return score;
  }, { mighty: 0, opponent: 0 });
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

export function formatGoalText(event, history, opponent) {
  const score = scoreAtEvent(history, event.id);
  const minute = `${event.minute} Spielminute`;
  const scorer = goalPlayerLine(event);

  if (event.team === "opponent") {
    if (event.style === "short") return [minute, `Tor ${opponent.shortName}`, "", `*${score.mighty}:${score.opponent}*`].join("\n");
    return [minute, `Tor ${opponent.shortName}`, event.player ? scorer : "Torschütze folgt", "", `Neuer Spielstand`, `*${score.mighty}:${score.opponent}*`].join("\n");
  }

  if (event.style === "emotional") {
    return [minute, "🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥", "", scorer, "", "Neuer Spielstand", `*${score.mighty}:${score.opponent}*`].join("\n");
  }
  if (event.style === "short") {
    return [minute, "*TOOOOOR SCHWEINFURT!*", scorer, "", `*${score.mighty}:${score.opponent}*`].join("\n");
  }
  return [minute, "*Tooooooor für unsere Schweinfurter Mighty Dogs*", "", `Torschütze mit der ${scorer}`, "", "Neuer Spielstand", `*${score.mighty}:${score.opponent}*`].join("\n");
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

export function formatEventText(event, history, opponent) {
  if (event.type === "goal") return formatGoalText(event, history, opponent);
  if (event.type === "penalty") return formatPenaltyText(event, opponent);
  throw new Error("Unbekannte Aktion.");
}

function goalSummaryLines(history, team, period = null) {
  return history
    .filter(event => event.type === "goal" && event.team === team && (period === null || event.period === period))
    .map(event => `${event.minute} Spielminute – ${goalPlayerLine(event)}`);
}

export function formatPeriodSummary(history, period, opponent) {
  const currentPeriod = Number.parseInt(period, 10);
  if (![1, 2, 3].includes(currentPeriod)) throw new Error("Ungültiges Drittel.");
  const score = history.reduce((result, event) => {
    if (event.type === "goal" && event.period <= currentPeriod) result[event.team] += 1;
    return result;
  }, { mighty: 0, opponent: 0 });
  const mighty = goalSummaryLines(history, "mighty", currentPeriod);
  const away = goalSummaryLines(history, "opponent", currentPeriod);
  return [
    `*Ende ${currentPeriod}. Drittel – ${score.mighty}:${score.opponent}*`,
    "",
    "🥅 *Mighty Dogs*",
    ...(mighty.length ? mighty : ["Keine Tore"]),
    "",
    `🥅 *${opponent.shortName}*`,
    ...(away.length ? away : ["Keine Tore"])
  ].join("\n");
}

function penaltySummaryLines(history, team, opponent) {
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

export function formatFinalSummary(history, opponent) {
  const score = calculateScore(history);
  const mightyGoals = goalSummaryLines(history, "mighty");
  const opponentGoals = goalSummaryLines(history, "opponent");
  return [
    "*ENDSTAND*",
    `Mighty Dogs ${score.mighty}:${score.opponent} ${opponent.shortName}`,
    "",
    "🥅 *Tore Mighty Dogs*",
    ...(mightyGoals.length ? mightyGoals : ["Keine Tore"]),
    "",
    `🥅 *Tore ${opponent.shortName}*`,
    ...(opponentGoals.length ? opponentGoals : ["Keine Tore"]),
    "",
    "🚨 *Strafen Mighty Dogs*",
    ...penaltySummaryLines(history, "mighty", opponent),
    "",
    `🚨 *Strafen ${opponent.shortName}*`,
    ...penaltySummaryLines(history, "opponent", opponent)
  ].join("\n");
}

function defaultState() {
  return { opponentId: "erfurt", period: 1, minute: 1, history: [] };
}

function loadState() {
  if (typeof localStorage === "undefined") return defaultState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.history) || !OPPONENTS[parsed.opponentId]) return defaultState();
    return {
      opponentId: parsed.opponentId,
      period: [1, 2, 3].includes(Number(parsed.period)) ? Number(parsed.period) : 1,
      minute: Math.min(60, Math.max(1, Number(parsed.minute) || 1)),
      history: parsed.history.filter(event => event && ["goal", "penalty"].includes(event.type))
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function rosterForTeam(team, opponent) {
  return team === "mighty" ? MIGHTY_ROSTER : opponent.roster;
}

function fillPlayerSelect(select, roster, selected = "") {
  select.replaceChildren(new Option("Torschütze / Spieler noch unbekannt", ""));
  const positions = ["Tor", "Verteidigung", "Sturm"];
  for (const position of positions) {
    const group = document.createElement("optgroup");
    group.label = position;
    for (const player of roster.filter(item => item.position === position)) {
      const option = new Option(playerText(player), player.name);
      option.dataset.number = player.number;
      group.append(option);
    }
    if (group.children.length) select.append(group);
  }
  select.value = selected;
}

function playerFromSelect(select, roster) {
  if (!select.value) return null;
  return roster.find(player => player.name === select.value) || null;
}

function initialize() {
  const form = document.querySelector("#tickerForm");
  if (!form) return;

  let state = loadState();
  let editingId = null;
  const opponentSelect = document.querySelector("#opponentSelect");
  const opponentScoreName = document.querySelector("#opponentScoreName");
  const opponentGoalLabel = document.querySelector("#actionGoalOpponentLabel");
  const mightyScore = document.querySelector("#mightyScore");
  const opponentScore = document.querySelector("#opponentScore");
  const minuteInput = document.querySelector("#gameMinute");
  const goalFields = document.querySelector("#goalFields");
  const penaltyFields = document.querySelector("#penaltyFields");
  const goalPlayer = document.querySelector("#goalPlayer");
  const goalPlayerLabel = document.querySelector("#goalPlayerLabel");
  const goalStyleFields = document.querySelector("#goalStyleFields");
  const penaltyRows = document.querySelector("#penaltyRows");
  const output = document.querySelector("#tickerOutput");
  const copyButton = document.querySelector("#copyButton");
  const errorBox = document.querySelector("#formError");
  const submitButton = document.querySelector("#submitButton");
  const editingBanner = document.querySelector("#editingBanner");
  const historyList = document.querySelector("#historyList");
  const historyEmpty = document.querySelector("#historyEmpty");

  for (const opponent of Object.values(OPPONENTS)) opponentSelect.append(new Option(opponent.shortName, opponent.id));
  opponentSelect.value = state.opponentId;
  minuteInput.value = String(state.minute);
  document.querySelector(`#period${state.period}`).checked = true;

  function opponent() { return OPPONENTS[state.opponentId]; }
  function selectedAction() { return new FormData(form).get("action"); }
  function selectedGoalTeam() { return selectedAction() === "GOAL_OPPONENT" ? "opponent" : "mighty"; }
  function selectedPeriod() { return Number.parseInt(new FormData(form).get("period"), 10); }
  function selectedMinute() { return Number.parseInt(minuteInput.value, 10); }

  function syncScore() {
    const score = calculateScore(state.history);
    mightyScore.textContent = String(score.mighty);
    opponentScore.textContent = String(score.opponent);
    opponentScoreName.textContent = opponent().shortName;
    opponentGoalLabel.innerHTML = `🥅 Tor<br>${opponent().shortName}`;
  }

  function syncContext() {
    state.period = selectedPeriod();
    state.minute = Math.min(60, Math.max(1, selectedMinute() || 1));
    minuteInput.value = String(state.minute);
    saveState(state);
  }

  function syncActionFields() {
    const action = selectedAction();
    const isPenalty = action === "PENALTY";
    goalFields.hidden = isPenalty;
    penaltyFields.hidden = !isPenalty;
    if (!isPenalty) {
      const team = selectedGoalTeam();
      goalPlayerLabel.textContent = team === "mighty" ? "Torschütze Mighty Dogs" : `Torschütze ${opponent().shortName}`;
      const currentValue = goalPlayer.value;
      fillPlayerSelect(goalPlayer, rosterForTeam(team, opponent()), currentValue);
      goalStyleFields.hidden = false;
    }
    errorBox.hidden = true;
  }

  function penaltyRowData(row) {
    const team = row.querySelector("[data-field='team']").value;
    const roster = rosterForTeam(team, opponent());
    return {
      team,
      player: playerFromSelect(row.querySelector("[data-field='player']"), roster),
      duration: row.querySelector("[data-field='duration']").value,
      reason: row.querySelector("[data-field='reason']").value
    };
  }

  function createPenaltyRow(initial = {}) {
    const row = document.createElement("div");
    row.className = "penalty-row";
    row.innerHTML = `
      <div class="penalty-row-head"><strong>Strafe</strong><button class="remove-penalty" type="button">Entfernen</button></div>
      <div class="penalty-grid">
        <div class="field"><label class="label">Team</label><select data-field="team"><option value="mighty">Mighty Dogs</option><option value="opponent">${opponent().shortName}</option></select></div>
        <div class="field"><label class="label">Strafzeit</label><select data-field="duration"></select></div>
        <div class="field wide"><label class="label">Spieler</label><select data-field="player"></select></div>
        <div class="field wide"><label class="label">Strafgrund</label><select data-field="reason"></select></div>
      </div>`;
    const teamSelect = row.querySelector("[data-field='team']");
    const durationSelect = row.querySelector("[data-field='duration']");
    const reasonSelect = row.querySelector("[data-field='reason']");
    const playerSelect = row.querySelector("[data-field='player']");
    teamSelect.value = initial.team || "mighty";
    for (const value of PENALTY_DURATIONS) durationSelect.append(new Option(`${value} Min.`, value));
    durationSelect.value = initial.duration || "2";
    for (const reason of PENALTY_REASONS) reasonSelect.append(new Option(reason, reason));
    reasonSelect.value = initial.reason || PENALTY_REASONS[0];
    fillPlayerSelect(playerSelect, rosterForTeam(teamSelect.value, opponent()), initial.player?.name || "");
    teamSelect.addEventListener("change", () => fillPlayerSelect(playerSelect, rosterForTeam(teamSelect.value, opponent())));
    row.querySelector(".remove-penalty").addEventListener("click", () => {
      if (penaltyRows.children.length > 1) row.remove();
    });
    penaltyRows.append(row);
  }

  function ensurePenaltyRow() {
    if (!penaltyRows.children.length) createPenaltyRow();
  }

  function historyTitle(event) {
    if (event.type === "goal") return `${event.minute}' Tor ${teamName(event.team, opponent())}`;
    const teams = [...new Set(event.penalties.map(item => teamName(item.team, opponent())))].join(" + ");
    return `${event.minute}' Strafe(n) ${teams}`;
  }

  function historyDetail(event) {
    if (event.type === "goal") return `${event.period}. Drittel · ${goalPlayerLine(event)}`;
    return `${event.period}. Drittel · ${event.penalties.map(item => `${item.duration} min ${item.reason}`).join(" · ")}`;
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
    output.focus();
    output.setSelectionRange(output.value.length, output.value.length);
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
    document.querySelector(`#period${event.period}`).checked = true;
    minuteInput.value = String(event.minute);
    if (event.type === "goal") {
      document.querySelector(event.team === "mighty" ? "#actionGoalMighty" : "#actionGoalOpponent").checked = true;
      syncActionFields();
      fillPlayerSelect(goalPlayer, rosterForTeam(event.team, opponent()), event.player?.name || "");
      const style = document.querySelector(`input[name='goalStyle'][value='${event.style || "classic"}']`);
      if (style) style.checked = true;
    } else {
      document.querySelector("#actionPenalty").checked = true;
      syncActionFields();
      penaltyRows.replaceChildren();
      event.penalties.forEach(createPenaltyRow);
    }
    window.scrollTo({ top: form.offsetTop - 10, behavior: "smooth" });
  }

  function validateContext() {
    const minute = selectedMinute();
    const period = selectedPeriod();
    if (!Number.isInteger(minute) || minute < 1 || minute > 60) throw new Error("Bitte eine Spielminute zwischen 1 und 60 eingeben.");
    if (![1, 2, 3].includes(period)) throw new Error("Bitte das Drittel auswählen.");
    return { minute, period };
  }

  form.addEventListener("change", event => {
    if (event.target.name === "action") syncActionFields();
    if (event.target.name === "period") syncContext();
  });
  minuteInput.addEventListener("change", syncContext);
  opponentSelect.addEventListener("change", () => {
    state.opponentId = opponentSelect.value;
    saveState(state);
    syncScore();
    syncActionFields();
    for (const row of penaltyRows.children) {
      const team = row.querySelector("[data-field='team']").value;
      fillPlayerSelect(row.querySelector("[data-field='player']"), rosterForTeam(team, opponent()));
      row.querySelector("[data-field='team'] option[value='opponent']").textContent = opponent().shortName;
    }
  });

  for (const button of document.querySelectorAll("[data-minute-step]")) {
    button.addEventListener("click", () => {
      const current = Number.parseInt(minuteInput.value, 10) || 1;
      const step = Number.parseInt(button.dataset.minuteStep, 10);
      minuteInput.value = String(Math.min(60, Math.max(1, current + step)));
      syncContext();
    });
  }

  document.querySelector("#addPenalty").addEventListener("click", () => createPenaltyRow());
  document.querySelector("#cancelEdit").addEventListener("click", cancelEdit);

  form.addEventListener("submit", event => {
    event.preventDefault();
    errorBox.hidden = true;
    try {
      const { minute, period } = validateContext();
      const action = selectedAction();
      let tickerEvent;
      if (action === "PENALTY") {
        const penalties = [...penaltyRows.children].map(penaltyRowData);
        if (!penalties.length) throw new Error("Bitte mindestens eine Strafe erfassen.");
        tickerEvent = { id: editingId || uid(), type: "penalty", minute, period, penalties };
      } else {
        const team = selectedGoalTeam();
        const roster = rosterForTeam(team, opponent());
        tickerEvent = {
          id: editingId || uid(), type: "goal", team, minute, period,
          player: playerFromSelect(goalPlayer, roster),
          style: new FormData(form).get("goalStyle") || "classic"
        };
      }
      const existingIndex = editingId ? state.history.findIndex(item => item.id === editingId) : -1;
      if (existingIndex >= 0) state.history.splice(existingIndex, 1, tickerEvent);
      else state.history.push(tickerEvent);
      state.period = period;
      state.minute = minute;
      saveState(state);
      renderHistory();
      setOutput(formatEventText(tickerEvent, state.history, opponent()));
      cancelEdit();
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

  document.querySelector("#periodSummaryButton").addEventListener("click", () => {
    try { setOutput(formatPeriodSummary(state.history, selectedPeriod(), opponent())); }
    catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  });
  document.querySelector("#finalSummaryButton").addEventListener("click", () => setOutput(formatFinalSummary(state.history, opponent())));

  copyButton.addEventListener("click", async () => {
    if (!output.value.trim()) { errorBox.textContent = "Bitte zuerst einen Text erstellen."; errorBox.hidden = false; return; }
    try { await navigator.clipboard.writeText(output.value); }
    catch { output.focus(); output.select(); document.execCommand("copy"); output.setSelectionRange(output.value.length, output.value.length); }
    copyButton.dataset.copied = "true";
    copyButton.textContent = "Kopiert ✓";
    errorBox.hidden = true;
  });

  document.querySelector("#resetGame").addEventListener("click", () => {
    if (!window.confirm("Alle lokal gespeicherten Testaktionen und den Spielstand zurücksetzen?")) return;
    state = defaultState();
    editingId = null;
    saveState(state);
    opponentSelect.value = state.opponentId;
    minuteInput.value = "1";
    document.querySelector("#period1").checked = true;
    output.value = "";
    penaltyRows.replaceChildren();
    ensurePenaltyRow();
    cancelEdit();
    renderHistory();
  });

  ensurePenaltyRow();
  syncScore();
  syncActionFields();
  renderHistory();
}

if (typeof document !== "undefined") initialize();

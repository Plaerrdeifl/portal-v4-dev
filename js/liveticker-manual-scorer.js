import { MIGHTY_ROSTER, OPPONENTS } from "./liveticker-engine-v3.js";

export const GOAL_POSITION_ORDER = Object.freeze(["Sturm", "Verteidigung", "Tor"]);
export const PENALTY_POSITION_ORDER = Object.freeze(["Verteidigung", "Sturm", "Tor"]);

export function normalizeJerseyNumber(value) {
  return String(value ?? "").trim().replace(/^#/, "").trim();
}

export function findPlayerByNumber(roster, value) {
  const number = normalizeJerseyNumber(value);
  if (!number) return null;
  return roster.find(player => String(player.number || "").trim() === number) || null;
}

export function stripUnknownGoalPlaceholders(text) {
  const lines = String(text ?? "").split("\n");
  const cleaned = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "Torschütze noch offen" || trimmed === "Torschütze folgt") continue;
    if (/^Torschütze:\s*Torschütze noch offen$/i.test(trimmed)) continue;
    if (/Spielminute\s+[–-]\s+Torschütze noch offen$/i.test(trimmed)) {
      cleaned.push(line.replace(/\s+[–-]\s+Torschütze noch offen\s*$/i, ""));
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function initializeManualScorer() {
  if (typeof document === "undefined") return;

  const form = document.querySelector("#tickerForm");
  const goalPlayer = document.querySelector("#goalPlayer");
  const assist1 = document.querySelector("#assist1");
  const assist2 = document.querySelector("#assist2");
  const shootoutPlayer = document.querySelector("#shootoutPlayer");
  const shootoutTeam = document.querySelector("#shootoutTeam");
  const opponentSelect = document.querySelector("#opponentSelect");
  const penaltyRows = document.querySelector("#penaltyRows");
  const output = document.querySelector("#tickerOutput");
  if (!form || !goalPlayer || !assist1 || !assist2 || !opponentSelect || !penaltyRows || !output) return;
  if (document.querySelector("#goalNumberDirect")) return;

  const style = document.createElement("style");
  style.textContent = `
    .player-number-line{display:grid;grid-template-columns:74px minmax(0,1fr);gap:8px;align-items:end}
    .player-number-line .number-field,.player-number-line .player-select-field{display:grid;gap:6px;min-width:0}
    .player-number-line .jersey-number{min-height:50px;padding:0 6px;text-align:center;font-weight:900;appearance:textfield}
    .player-number-line .jersey-number::-webkit-outer-spin-button,.player-number-line .jersey-number::-webkit-inner-spin-button{appearance:none;margin:0}
    @media(max-width:360px){.player-number-line{grid-template-columns:66px minmax(0,1fr);gap:6px}}
  `;
  document.head.append(style);

  const historyList = document.querySelector("#historyList");
  const periodSummaryButton = document.querySelector("#periodSummaryButton");
  const finalSummaryButton = document.querySelector("#finalSummaryButton");
  let penaltyNumberCounter = 0;

  function selectedGoalTeam() {
    const action = new FormData(form).get("action");
    return action === "GOAL_OPPONENT" ? "opponent" : "mighty";
  }

  function rosterForTeam(team) {
    if (team === "mighty") return MIGHTY_ROSTER;
    return OPPONENTS[opponentSelect.value]?.roster || [];
  }

  function currentGoalRoster() {
    return rosterForTeam(selectedGoalTeam());
  }

  function reorderPlayerGroups(select, order) {
    if (!select) return;
    const groups = [...select.querySelectorAll("optgroup")];
    for (const position of order) {
      const group = groups.find(item => item.label === position);
      if (group) select.append(group);
    }
  }

  function reorderGoalAndShootout() {
    reorderPlayerGroups(goalPlayer, GOAL_POSITION_ORDER);
    reorderPlayerGroups(assist1, GOAL_POSITION_ORDER);
    reorderPlayerGroups(assist2, GOAL_POSITION_ORDER);
    reorderPlayerGroups(shootoutPlayer, GOAL_POSITION_ORDER);
  }

  function buildInlineNumberField(select, { id, getRoster, label = "Nr." }) {
    const field = select.closest(".field");
    if (!field || field.dataset.numberEnhanced === "true") return null;

    const existingLabel = field.querySelector("label");
    const line = document.createElement("div");
    line.className = "player-number-line";

    const numberField = document.createElement("div");
    numberField.className = "number-field";
    const numberLabel = document.createElement("label");
    numberLabel.className = "label";
    numberLabel.htmlFor = id;
    numberLabel.textContent = label;
    const numberInput = document.createElement("input");
    numberInput.id = id;
    numberInput.className = "jersey-number";
    numberInput.type = "text";
    numberInput.inputMode = "numeric";
    numberInput.autocomplete = "off";
    numberInput.placeholder = "#";
    numberInput.setAttribute("aria-label", `${label} direkt eingeben`);
    numberField.append(numberLabel, numberInput);

    const playerField = document.createElement("div");
    playerField.className = "player-select-field";
    if (existingLabel) playerField.append(existingLabel);
    playerField.append(select);
    line.append(numberField, playerField);

    field.replaceChildren(line);
    field.dataset.numberEnhanced = "true";

    function syncNumberFromSelect() {
      const player = getRoster().find(item => item.name === select.value);
      numberInput.value = player?.number || "";
    }

    function selectByNumber() {
      const raw = normalizeJerseyNumber(numberInput.value);
      if (!raw) {
        select.value = "";
        return;
      }
      const player = findPlayerByNumber(getRoster(), raw);
      if (!player) {
        select.value = "";
        return;
      }
      select.value = player.name;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    numberInput.addEventListener("input", selectByNumber);
    select.addEventListener("change", syncNumberFromSelect);
    syncNumberFromSelect();

    return { input: numberInput, select, sync: syncNumberFromSelect };
  }

  const goalPair = buildInlineNumberField(goalPlayer, {
    id: "goalNumberDirect",
    getRoster: currentGoalRoster,
    label: "Nr."
  });
  const assist1Pair = buildInlineNumberField(assist1, {
    id: "assist1NumberDirect",
    getRoster: currentGoalRoster,
    label: "Nr."
  });
  const assist2Pair = buildInlineNumberField(assist2, {
    id: "assist2NumberDirect",
    getRoster: currentGoalRoster,
    label: "Nr."
  });
  const goalPairs = [goalPair, assist1Pair, assist2Pair].filter(Boolean);

  function syncGoalPairs() {
    reorderGoalAndShootout();
    goalPairs.forEach(pair => pair.sync());
  }

  function enhancePenaltyRow(row) {
    if (!row || row.dataset.numberEnhanced === "true") {
      const existingPlayer = row?.querySelector("[data-field='player']");
      reorderPlayerGroups(existingPlayer, PENALTY_POSITION_ORDER);
      return;
    }
    const teamSelect = row.querySelector("[data-field='team']");
    const playerSelect = row.querySelector("[data-field='player']");
    if (!teamSelect || !playerSelect) return;

    reorderPlayerGroups(playerSelect, PENALTY_POSITION_ORDER);
    penaltyNumberCounter += 1;
    const pair = buildInlineNumberField(playerSelect, {
      id: `penaltyPlayerNumber${penaltyNumberCounter}`,
      getRoster: () => rosterForTeam(teamSelect.value),
      label: "Nr."
    });
    if (!pair) return;

    row.dataset.numberEnhanced = "true";
    row._numberPair = pair;
    teamSelect.addEventListener("change", () => queueMicrotask(() => {
      reorderPlayerGroups(playerSelect, PENALTY_POSITION_ORDER);
      pair.sync();
    }));
  }

  function enhanceAllPenaltyRows() {
    penaltyRows.querySelectorAll(".penalty-row").forEach(enhancePenaltyRow);
  }

  function syncAllPenaltyNumbers() {
    penaltyRows.querySelectorAll(".penalty-row").forEach(row => {
      reorderPlayerGroups(row.querySelector("[data-field='player']"), PENALTY_POSITION_ORDER);
      row._numberPair?.sync();
    });
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceAllPenaltyRows));
  observer.observe(penaltyRows, { childList: true, subtree: true });
  enhanceAllPenaltyRows();

  function cleanOutput() {
    output.value = stripUnknownGoalPlaceholders(output.value);
  }

  form.addEventListener("change", event => {
    if (event.target.name === "action") queueMicrotask(syncGoalPairs);
  });
  opponentSelect.addEventListener("change", () => {
    queueMicrotask(syncGoalPairs);
    queueMicrotask(syncAllPenaltyNumbers);
  });
  shootoutTeam?.addEventListener("change", () => queueMicrotask(reorderGoalAndShootout));
  form.addEventListener("submit", () => queueMicrotask(cleanOutput));
  periodSummaryButton?.addEventListener("click", () => queueMicrotask(cleanOutput));
  finalSummaryButton?.addEventListener("click", () => queueMicrotask(cleanOutput));
  historyList?.addEventListener("click", event => {
    if (!event.target?.dataset?.edit) return;
    queueMicrotask(syncGoalPairs);
    queueMicrotask(enhanceAllPenaltyRows);
    queueMicrotask(syncAllPenaltyNumbers);
  });

  reorderGoalAndShootout();
  syncGoalPairs();
}

if (typeof document !== "undefined") queueMicrotask(initializeManualScorer);

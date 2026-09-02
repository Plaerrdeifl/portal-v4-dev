import { MIGHTY_ROSTER, OPPONENTS } from "./liveticker-engine-v3.js";

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
  const opponentSelect = document.querySelector("#opponentSelect");
  const output = document.querySelector("#tickerOutput");
  if (!form || !goalPlayer || !opponentSelect || !output || document.querySelector("#goalNumberDirect")) return;

  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `
    <label class="label" for="goalNumberDirect">Trikotnummer direkt</label>
    <input id="goalNumberDirect" type="text" inputmode="numeric" autocomplete="off" placeholder="z. B. 84">
    <p id="goalNumberHint" class="hint">Nummer eingeben = Spieler wird automatisch ausgewählt.</p>`;
  goalPlayer.closest(".field")?.after(field);

  const numberInput = field.querySelector("#goalNumberDirect");
  const hint = field.querySelector("#goalNumberHint");
  const historyList = document.querySelector("#historyList");
  const periodSummaryButton = document.querySelector("#periodSummaryButton");
  const finalSummaryButton = document.querySelector("#finalSummaryButton");

  function selectedGoalTeam() {
    const action = new FormData(form).get("action");
    return action === "GOAL_OPPONENT" ? "opponent" : "mighty";
  }

  function currentRoster() {
    if (selectedGoalTeam() === "mighty") return MIGHTY_ROSTER;
    return OPPONENTS[opponentSelect.value]?.roster || [];
  }

  function selectByNumber() {
    const raw = normalizeJerseyNumber(numberInput.value);
    if (!raw) {
      hint.textContent = "Nummer eingeben = Spieler wird automatisch ausgewählt.";
      return;
    }
    const player = findPlayerByNumber(currentRoster(), raw);
    if (!player) {
      goalPlayer.value = "";
      hint.textContent = `#${raw} ist im gewählten Kader nicht hinterlegt.`;
      return;
    }
    goalPlayer.value = player.name;
    hint.textContent = `#${player.number} ${player.name} ausgewählt.`;
    goalPlayer.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function syncNumberFromSelect() {
    const player = currentRoster().find(item => item.name === goalPlayer.value);
    numberInput.value = player?.number || "";
    hint.textContent = player?.number
      ? `#${player.number} ${player.name} ausgewählt.`
      : "Nummer eingeben = Spieler wird automatisch ausgewählt.";
  }

  function cleanOutput() {
    output.value = stripUnknownGoalPlaceholders(output.value);
  }

  numberInput.addEventListener("input", selectByNumber);
  goalPlayer.addEventListener("change", syncNumberFromSelect);
  form.addEventListener("change", event => {
    if (event.target.name === "action") queueMicrotask(syncNumberFromSelect);
  });
  opponentSelect.addEventListener("change", () => queueMicrotask(syncNumberFromSelect));
  form.addEventListener("submit", () => queueMicrotask(cleanOutput));
  periodSummaryButton?.addEventListener("click", () => queueMicrotask(cleanOutput));
  finalSummaryButton?.addEventListener("click", () => queueMicrotask(cleanOutput));
  historyList?.addEventListener("click", event => {
    if (event.target?.dataset?.edit) queueMicrotask(syncNumberFromSelect);
  });

  syncNumberFromSelect();
}

if (typeof document !== "undefined") queueMicrotask(initializeManualScorer);

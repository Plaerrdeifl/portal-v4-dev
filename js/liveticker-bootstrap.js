await import("./runtime-config.js");
await import("./liveticker-output-templates.js?v=20260906-prod-freeze1");

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const { prepareLivetickerGameStorage } = await import("./liveticker-game-storage.js?v=20260906-prod-freeze1");

function runtimeOpponentSource() {
  return `const runtimeGame = globalThis.PD_LIVETICKER_GAME_CONTEXT || {};
const runtimeOpponentTeam = runtimeGame.opponentTeam || {};
const runtimeOpponentId = runtimeGame.opponentKey || runtimeOpponentTeam.id || "calendar-opponent";
export const OPPONENTS = Object.freeze({
  [runtimeOpponentId]: Object.freeze({
    id: runtimeOpponentId,
    shortName: runtimeOpponentTeam.shortName || runtimeOpponentTeam.name || "Gegner",
    fullName: runtimeOpponentTeam.name || runtimeOpponentTeam.shortName || "Gegner",
    roster: Object.freeze(Array.isArray(runtimeOpponentTeam.players) ? runtimeOpponentTeam.players : [])
  })
});`;
}

function replaceEngineSection(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Liveticker-Engine passt nicht zum Kalender-Adapter (${label}).`);
  }
  return next;
}

async function importRuntimeEngine() {
  const response = await fetch("../js/liveticker-engine-v4.js", { cache: "no-store" });
  if (!response.ok) throw new Error("Liveticker-Engine konnte nicht geladen werden.");
  let source = await response.text();

  source = replaceEngineSection(
    source,
    /export const OPPONENTS\s*=\s*Object\.freeze\(\{[\s\S]*?\}\);\s*(?=export const PENALTY_REASONS)/,
    `${runtimeOpponentSource()}\n`,
    "Gegner"
  );
  source = replaceEngineSection(
    source,
    /function defaultState\(\)\s*\{[\s\S]*?\}\s*(?=function normalizeLoadedState)/,
    `function defaultState() {
  const runtimeId = globalThis.PD_LIVETICKER_GAME_CONTEXT?.opponentKey || Object.keys(OPPONENTS)[0];
  return { opponentId: runtimeId, minute: 1, history: [] };
}\n`,
    "Startzustand"
  );
  source = replaceEngineSection(
    source,
    /function rosterForTeam\(team,[^)]*\)\s*\{[\s\S]*?\}\s*(?=function fillPlayerSelect)/,
    `function rosterForTeam(team, opponent) {
  const ownRoster = globalThis.PD_LIVETICKER_GAME_CONTEXT?.ownTeam?.players;
  return team === "mighty" ? (Array.isArray(ownRoster) ? ownRoster : MIGHTY_ROSTER) : opponent.roster;
}\n`,
    "Kader"
  );

  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

try {
  await prepareLivetickerGameStorage();

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== STORAGE_KEY) return;
    try {
      const state = JSON.parse(value);
      if (state && Array.isArray(state.history)) {
        window.dispatchEvent(new CustomEvent("pd-liveticker-state-saved", { detail: { state } }));
      }
    } catch {}
  };

  await importRuntimeEngine();
  await import("./liveticker-v5-support.js?v=20260906-prod-freeze1");

  const opponentSelect = document.querySelector("#opponentSelect");
  if (opponentSelect) {
    opponentSelect.disabled = true;
    opponentSelect.setAttribute("aria-label", "Gegner aus dem ausgewählten Kalenderspiel");
  }
  document.querySelectorAll("[data-venue]").forEach(button => {
    button.disabled = true;
    button.title = "Wird automatisch aus dem Kalender übernommen";
  });
} catch (error) {
  console.error(error);
  const box = document.querySelector("#formError");
  if (box) {
    box.textContent = error?.message || "Liveticker konnte nicht geladen werden.";
    box.hidden = false;
  }
  document.querySelector("#tickerForm")?.setAttribute("aria-disabled", "true");
}

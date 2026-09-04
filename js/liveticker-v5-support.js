export const BEV_PENALTY_DURATIONS = Object.freeze(["2", "2+2", "5", "10", "20", "25", "2+10", "2+20", "5+10", "5+20", "2+5", "2+5+20"]);

export const BEV_PENALTY_REASONS = Object.freeze([
  "Halten", "Beinstellen", "Haken", "Stockschlag", "Behinderung", "Behinderung am Torhüter",
  "Hoher Stock", "Crosscheck", "Bandencheck", "Unerlaubter Körperangriff", "Check von hinten",
  "Check gegen Kopf oder Nacken", "Ellbogencheck", "Kniecheck", "Übertriebene Härte", "Slew-Footing",
  "Stockendenstoß", "Stockstich", "Faustkampf", "Werfen von Ausrüstung", "Spielverzögerung",
  "Zu viele Spieler auf dem Eis", "Illegale Auswechslung", "Schwalbe / Beschönigen", "Unsportliches Verhalten",
  "Beschimpfung von Offiziellen", "Tätlichkeit gegen Offizielle"
]);

const VENUE_KEY = "plaerrdeifl.livetickerPrototype.venue";

function readVenue() {
  try { return localStorage.getItem(VENUE_KEY) === "away" ? "away" : "home"; } catch { return "home"; }
}
function saveVenue(venue) { try { localStorage.setItem(VENUE_KEY, venue); } catch {} }

function replaceOptions(select, values, selected = "") {
  if (!select) return;
  const previous = selected || select.value;
  select.replaceChildren(...values.map(value => new Option(`${value} Min.`, value)));
  select.value = values.includes(previous) ? previous : values[0];
}
function replaceReasonOptions(select, selected = "") {
  if (!select) return;
  const previous = selected || select.value;
  select.replaceChildren(...BEV_PENALTY_REASONS.map(value => new Option(value, value)));
  select.value = BEV_PENALTY_REASONS.includes(previous) ? previous : BEV_PENALTY_REASONS[0];
}
function loadStoredEvent(id) {
  if (!id) return null;
  try {
    const state = JSON.parse(localStorage.getItem("plaerrdeifl.livetickerPrototype.v3") || "null");
    return Array.isArray(state?.history) ? state.history.find(event => event?.id === id) || null : null;
  } catch { return null; }
}
function patchPenaltyRows(storedEvent = null) {
  const rows = [...document.querySelectorAll("#penaltyRows .penalty-row")];
  rows.forEach((row, index) => {
    const stored = storedEvent?.type === "penalty" ? storedEvent.penalties?.[index] : null;
    replaceOptions(row.querySelector("[data-field='duration']"), BEV_PENALTY_DURATIONS, stored?.duration || "");
    replaceReasonOptions(row.querySelector("[data-field='reason']"), stored?.reason || "");
  });
}
function patchPenaltyRowsAfterCore(storedEvent = null) {
  queueMicrotask(() => patchPenaltyRows(storedEvent));
}
function swapScorePairs(text) { return text.replace(/\*(\d+):(\d+)\*/g, (_, left, right) => `*${right}:${left}*`); }
function swapFinalHeadline(text, opponentName) {
  const escaped = opponentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`Mighty Dogs (\\d+):(\\d+) ${escaped}`), (_, mighty, opponent) => `${opponentName} ${opponent}:${mighty} Mighty Dogs`);
}
function swapShootoutSummary(text, opponentName) {
  const escaped = opponentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`Treffer: Mighty Dogs (\\d+):(\\d+) ${escaped}`), (_, mighty, opponent) => `Treffer: ${opponentName} ${opponent}:${mighty} Mighty Dogs`);
}
function applyVenueToOutput(text, venue, opponentName) {
  if (venue !== "away" || !text) return text;
  let result = swapFinalHeadline(text, opponentName);
  result = swapShootoutSummary(result, opponentName);
  if (!/\*ENDSTAND\*/.test(result) && !/Treffer:/.test(result)) result = swapScorePairs(result);
  return result;
}
function installStyle() {
  const style = document.createElement("style");
  style.textContent = `.venue-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border:1px solid var(--line);border-radius:15px;background:var(--soft)}.venue-switch button{min-height:42px;border:1px solid transparent;border-radius:11px;background:transparent;color:#3f5269;font-weight:900}.venue-switch button[aria-pressed="true"]{border-color:rgba(13,121,232,.18);background:#fff;color:var(--blue-dark);box-shadow:0 3px 10px rgba(4,28,51,.09)}.score-top.away-game .mighty-team{order:3}.score-top.away-game .score-separator{order:2}.score-top.away-game .opponent-team{order:1}.shootout-quick{margin-top:7px;width:100%;min-height:42px;padding:7px 10px;border:1px solid var(--line);border-radius:12px;background:#f7faff;color:#04233f;font-size:.82rem;font-weight:900;text-align:center}.action-grid label[for="actionShootout"]{display:none!important}`;
  document.head.append(style);
}

function initializeEnhancements() {
  const scoreTop = document.querySelector(".score-top");
  const teams = scoreTop ? [...scoreTop.querySelectorAll(".team")] : [];
  const gameMeta = document.querySelector(".game-meta");
  const minuteInput = document.querySelector("#gameMinute");
  const actionShootout = document.querySelector("#actionShootout");
  const shootoutLabel = document.querySelector("label[for='actionShootout']");
  const form = document.querySelector("#tickerForm");
  const output = document.querySelector("#tickerOutput");
  const opponentSelect = document.querySelector("#opponentSelect");
  if (!scoreTop || teams.length < 2 || !gameMeta || !minuteInput || !actionShootout || !form || !output || !opponentSelect) return;
  installStyle();
  teams[0].classList.add("mighty-team"); teams[1].classList.add("opponent-team");
  let venue = readVenue();
  const venueWrap = document.createElement("div");
  venueWrap.className = "field";
  venueWrap.innerHTML = `<span class="label">Spielort</span><div class="venue-switch"><button type="button" data-venue="home">🏠 Heimspiel</button><button type="button" data-venue="away">🚌 Auswärtsspiel</button></div>`;
  gameMeta.parentNode.insertBefore(venueWrap, gameMeta);
  const venueButtons = [...venueWrap.querySelectorAll("[data-venue]")];
  function renderVenue() { scoreTop.classList.toggle("away-game", venue === "away"); venueButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.venue === venue))); }
  venueButtons.forEach(button => button.addEventListener("click", () => { venue = button.dataset.venue === "away" ? "away" : "home"; saveVenue(venue); renderVenue(); }));
  renderVenue();
  const minuteField = minuteInput.closest(".field");
  const quick = document.createElement("button"); quick.type = "button"; quick.className = "shootout-quick"; quick.textContent = "🏒 Penaltyschießen"; minuteField?.append(quick);
  if (shootoutLabel) shootoutLabel.hidden = true;
  quick.addEventListener("click", () => { actionShootout.checked = true; actionShootout.dispatchEvent(new Event("change", { bubbles: true })); document.querySelector("#shootoutFields")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); });

  patchPenaltyRows();
  form.addEventListener("change", event => {
    if (event.target?.name === "action") patchPenaltyRowsAfterCore();
  });
  form.addEventListener("click", event => {
    if (event.target?.closest?.("#addPenalty, #cancelEdit")) patchPenaltyRowsAfterCore();
  });
  document.querySelector("#resetGame")?.addEventListener("click", () => patchPenaltyRowsAfterCore());

  let pendingEditId = null;
  const historyList = document.querySelector("#historyList");
  historyList?.addEventListener("click", event => { pendingEditId = event.target?.dataset?.edit || null; }, true);
  historyList?.addEventListener("click", () => {
    if (pendingEditId) patchPenaltyRowsAfterCore(loadStoredEvent(pendingEditId));
    pendingEditId = null;
  });

  form.addEventListener("submit", () => {
    patchPenaltyRowsAfterCore();
    output.value = applyVenueToOutput(output.value, venue, opponentSelect.options[opponentSelect.selectedIndex]?.text || "Gegner");
  });
  document.querySelector("#periodSummaryButton")?.addEventListener("click", () => { output.value = applyVenueToOutput(output.value, venue, opponentSelect.options[opponentSelect.selectedIndex]?.text || "Gegner"); });
  document.querySelector("#finalSummaryButton")?.addEventListener("click", () => { output.value = applyVenueToOutput(output.value, venue, opponentSelect.options[opponentSelect.selectedIndex]?.text || "Gegner"); });
}
if (typeof document !== "undefined") initializeEnhancements();
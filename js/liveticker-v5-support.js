export const BEV_PENALTY_DURATIONS = Object.freeze(["2", "2+2", "5", "10", "2+10", "5+10", "20", "2+20", "5+20", "25", "2+5", "2+5+20"]);

export const PENALTY_DURATION_LABELS = Object.freeze({
  "2": "2 Min.",
  "2+2": "2 + 2 Min.",
  "5": "5 Min.",
  "10": "10 Min. Diszi",
  "2+10": "2 + Diszi",
  "5+10": "5 + Diszi",
  "20": "SD",
  "2+20": "2 + SD",
  "5+20": "5 + SD",
  "25": "Matchstrafe",
  "2+5": "2 + 5 Min.",
  "2+5+20": "2 + 5 + SD"
});

export const BEV_PENALTY_REASONS = Object.freeze([
  "Halten", "Beinstellen", "Haken", "Stockschlag", "Behinderung", "Behinderung am Torhüter",
  "Hoher Stock", "Crosscheck", "Bandencheck", "Unerlaubter Körperangriff", "Check von hinten",
  "Check gegen Kopf oder Nacken", "Ellbogencheck", "Kniecheck", "Übertriebene Härte", "Slew-Footing",
  "Stockendenstoß", "Stockstich", "Faustkampf", "Werfen von Ausrüstung", "Spielverzögerung",
  "Zu viele Spieler auf dem Eis", "Illegale Auswechslung", "Schwalbe / Beschönigen", "Unsportliches Verhalten",
  "Beschimpfung von Offiziellen", "Tätlichkeit gegen Offizielle"
]);

export const PENALTY_RECOMMENDATIONS = Object.freeze({
  "Halten": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Beinstellen": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Haken": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Stockschlag": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Behinderung": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Behinderung am Torhüter": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Hoher Stock": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "2+2", "5+20"]) }),
  "Crosscheck": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Bandencheck": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5", "5+20"]) }),
  "Unerlaubter Körperangriff": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5", "5+20"]) }),
  "Check von hinten": Object.freeze({ defaultDuration: "5+20", recommendedDurations: Object.freeze(["5+20"]) }),
  "Check gegen Kopf oder Nacken": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Ellbogencheck": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Kniecheck": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20"]) }),
  "Übertriebene Härte": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Slew-Footing": Object.freeze({ defaultDuration: "5+20", recommendedDurations: Object.freeze(["5+20"]) }),
  "Stockendenstoß": Object.freeze({ defaultDuration: "2+2", recommendedDurations: Object.freeze(["2+2", "5+20"]) }),
  "Stockstich": Object.freeze({ defaultDuration: "2+2", recommendedDurations: Object.freeze(["2+2", "5+20"]) }),
  "Faustkampf": Object.freeze({ defaultDuration: "5+20", recommendedDurations: Object.freeze(["5+20"]) }),
  "Werfen von Ausrüstung": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "5+20", "20"]) }),
  "Spielverzögerung": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Zu viele Spieler auf dem Eis": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]), benchPenalty: true }),
  "Illegale Auswechslung": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]), benchPenalty: true }),
  "Schwalbe / Beschönigen": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) }),
  "Unsportliches Verhalten": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "10", "20", "2+10", "2+20"]) }),
  "Beschimpfung von Offiziellen": Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2", "10", "20", "2+10", "2+20"]) }),
  "Tätlichkeit gegen Offizielle": Object.freeze({ defaultDuration: "20", recommendedDurations: Object.freeze(["20", "25"]) })
});

const VENUE_KEY = "plaerrdeifl.livetickerPrototype.venue";
const rowState = new WeakMap();

export function penaltyDurationLabel(value) {
  return PENALTY_DURATION_LABELS[String(value || "")] || `${value} Min.`;
}

export function penaltyRecommendation(reason) {
  return PENALTY_RECOMMENDATIONS[reason] || Object.freeze({ defaultDuration: "2", recommendedDurations: Object.freeze(["2"]) });
}

export function recommendedReasonsForDuration(duration) {
  return BEV_PENALTY_REASONS.filter(reason => penaltyRecommendation(reason).recommendedDurations.includes(duration));
}

export function isRecommendedPenaltyCombination(reason, duration) {
  return penaltyRecommendation(reason).recommendedDurations.includes(duration);
}

export function applyPenaltyTerminology(text) {
  if (!text) return text;
  const values = [...BEV_PENALTY_DURATIONS].sort((a, b) => b.length - a.length).map(value => value.replace(/\+/g, "\\+"));
  return String(text).replace(new RegExp(`\\b(${values.join("|")})\\s+min\\b`, "g"), (_, value) => penaltyDurationLabel(value));
}

function readVenue() {
  try { return localStorage.getItem(VENUE_KEY) === "away" ? "away" : "home"; } catch { return "home"; }
}
function saveVenue(venue) { try { localStorage.setItem(VENUE_KEY, venue); } catch {} }

function appendOptionGroup(select, label, values, makeLabel) {
  if (!values.length) return;
  const group = document.createElement("optgroup");
  group.label = label;
  values.forEach(value => group.append(new Option(makeLabel(value), value)));
  select.append(group);
}

function populateDurationOptions(select, reason, selected = "") {
  if (!select) return;
  const recommendation = penaltyRecommendation(reason);
  const recommended = BEV_PENALTY_DURATIONS.filter(value => recommendation.recommendedDurations.includes(value));
  const others = BEV_PENALTY_DURATIONS.filter(value => !recommended.includes(value));
  const previous = selected || select.value || recommendation.defaultDuration;
  select.replaceChildren();
  appendOptionGroup(select, "⭐ Empfohlen", recommended, value => value === recommendation.defaultDuration ? `${penaltyDurationLabel(value)} · Standard` : penaltyDurationLabel(value));
  appendOptionGroup(select, "Weitere Strafarten", others, penaltyDurationLabel);
  select.value = BEV_PENALTY_DURATIONS.includes(previous) ? previous : recommendation.defaultDuration;
}

function populateReasonOptions(select, duration, selected = "") {
  if (!select) return;
  const recommended = recommendedReasonsForDuration(duration);
  const others = BEV_PENALTY_REASONS.filter(reason => !recommended.includes(reason));
  const previous = selected || select.value || BEV_PENALTY_REASONS[0];
  select.replaceChildren();
  if (recommended.length) appendOptionGroup(select, "⭐ Empfohlen", recommended, value => value);
  appendOptionGroup(select, recommended.length ? "Weitere Gründe" : "Alle Gründe", others, value => value);
  select.value = BEV_PENALTY_REASONS.includes(previous) ? previous : BEV_PENALTY_REASONS[0];
}

function ensurePenaltyHint(row) {
  let hint = row.querySelector(".penalty-smart-hint");
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "penalty-smart-hint";
    row.append(hint);
  }
  return hint;
}

function renderPenaltyHint(row) {
  const duration = row.querySelector("[data-field='duration']")?.value || "";
  const reason = row.querySelector("[data-field='reason']")?.value || "";
  const hint = ensurePenaltyHint(row);
  const recommendation = penaltyRecommendation(reason);
  const recommended = isRecommendedPenaltyCombination(reason, duration);
  const bench = recommendation.benchPenalty ? " · Bankstrafe, Spieler optional" : "";
  hint.classList.toggle("special", !recommended);
  hint.textContent = recommended
    ? `⭐ Empfohlen · Standard für ${reason}: ${penaltyDurationLabel(recommendation.defaultDuration)}${bench}`
    : `Sonderfall · ${reason} + ${penaltyDurationLabel(duration)} bleibt trotzdem speicherbar${bench}`;
}

function enhancePenaltyRow(row, stored = null) {
  const duration = row.querySelector("[data-field='duration']");
  const reason = row.querySelector("[data-field='reason']");
  if (!duration || !reason) return;

  const reasonField = reason.closest(".field");
  const playerField = row.querySelector("[data-field='player']")?.closest(".field");
  if (reasonField && playerField && reasonField !== playerField && reasonField.nextElementSibling !== playerField) {
    playerField.parentNode?.insertBefore(reasonField, playerField);
  }

  const currentReason = stored?.reason || reason.value || BEV_PENALTY_REASONS[0];
  const currentDuration = stored?.duration || duration.value || penaltyRecommendation(currentReason).defaultDuration;
  populateDurationOptions(duration, currentReason, currentDuration);
  populateReasonOptions(reason, duration.value, currentReason);
  renderPenaltyHint(row);

  if (rowState.has(row)) return;
  const state = { lastExplicit: null };
  rowState.set(row, state);

  duration.addEventListener("change", () => {
    state.lastExplicit = "duration";
    const selectedReason = reason.value;
    populateReasonOptions(reason, duration.value, selectedReason);
    renderPenaltyHint(row);
  });

  reason.addEventListener("change", () => {
    const selectedReason = reason.value;
    const recommendation = penaltyRecommendation(selectedReason);
    const keepExplicitDuration = state.lastExplicit === "duration";
    const selectedDuration = keepExplicitDuration ? duration.value : recommendation.defaultDuration;
    populateDurationOptions(duration, selectedReason, selectedDuration);
    populateReasonOptions(reason, duration.value, selectedReason);
    state.lastExplicit = "reason";
    renderPenaltyHint(row);
  });
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
    enhancePenaltyRow(row, stored);
  });
}
function patchPenaltyRowsAfterCore(storedEvent = null) {
  queueMicrotask(() => patchPenaltyRows(storedEvent));
}

function patchPenaltyHistory() {
  document.querySelectorAll("#historyList .history-copy small").forEach(node => {
    node.textContent = applyPenaltyTerminology(node.textContent);
  });
}
function patchPenaltyHistoryAfterCore() { queueMicrotask(patchPenaltyHistory); }

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
  style.textContent = `.venue-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border:1px solid var(--line);border-radius:15px;background:var(--soft)}.venue-switch button{min-height:42px;border:1px solid transparent;border-radius:11px;background:transparent;color:#3f5269;font-weight:900}.venue-switch button[aria-pressed="true"]{border-color:rgba(13,121,232,.18);background:#fff;color:var(--blue-dark);box-shadow:0 3px 10px rgba(4,28,51,.09)}.score-top.away-game .mighty-team{order:3}.score-top.away-game .score-separator{order:2}.score-top.away-game .opponent-team{order:1}.shootout-quick{margin-top:7px;width:100%;min-height:42px;padding:7px 10px;border:1px solid var(--line);border-radius:12px;background:#f7faff;color:#04233f;font-size:.82rem;font-weight:900;text-align:center}.action-grid label[for="actionShootout"]{display:none!important}.penalty-smart-hint{margin:0;padding:8px 10px;border-radius:10px;background:#edf8f2;color:#17663e;font-size:.72rem;font-weight:800;line-height:1.35}.penalty-smart-hint.special{background:#fff7e8;color:#8a5900}`;
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
  patchPenaltyHistory();
  form.addEventListener("change", event => {
    if (event.target?.name === "action") patchPenaltyRowsAfterCore();
  });
  form.addEventListener("click", event => {
    if (event.target?.closest?.("#addPenalty, #cancelEdit")) patchPenaltyRowsAfterCore();
  });
  document.querySelector("#resetGame")?.addEventListener("click", () => {
    patchPenaltyRowsAfterCore();
    patchPenaltyHistoryAfterCore();
  });

  let pendingEditId = null;
  const historyList = document.querySelector("#historyList");
  historyList?.addEventListener("click", event => { pendingEditId = event.target?.dataset?.edit || null; }, true);
  historyList?.addEventListener("click", () => {
    if (pendingEditId) patchPenaltyRowsAfterCore(loadStoredEvent(pendingEditId));
    pendingEditId = null;
    patchPenaltyHistoryAfterCore();
  });

  function normalizeOutput() {
    const opponentName = opponentSelect.options[opponentSelect.selectedIndex]?.text || "Gegner";
    output.value = applyVenueToOutput(applyPenaltyTerminology(output.value), venue, opponentName);
  }

  form.addEventListener("submit", () => {
    patchPenaltyRowsAfterCore();
    patchPenaltyHistoryAfterCore();
    normalizeOutput();
  });
  document.querySelector("#periodSummaryButton")?.addEventListener("click", normalizeOutput);
  document.querySelector("#finalSummaryButton")?.addEventListener("click", normalizeOutput);
}
if (typeof document !== "undefined") initializeEnhancements();

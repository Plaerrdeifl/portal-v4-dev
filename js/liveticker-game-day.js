import {
  createWhatsappDeliveryRequest,
  createWhatsappStickerOnlyRequest,
  linkWhatsappStickerDelivery,
  loadWhatsappDeliveries,
  loadWhatsappStickerLibrary,
  WHATSAPP_DELIVERY_MODES
} from "./liveticker-whatsapp-stickers.js?v=20260916-game-day-r1";
import {
  activeGameDayStickers,
  deliveryComponentStatus,
  gameDayHeaderModel,
  gameDayTimeline,
  newActionId
} from "./liveticker-game-day-core.js";

const STATE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const GAME_DAY_QUERY = "game-day";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return parsed && Array.isArray(parsed.history)
      ? { ...parsed, minute: Math.max(1, Number(parsed.minute) || 1) }
      : { minute: 1, history: [] };
  } catch {
    return { minute: 1, history: [] };
  }
}

function playerOptions(players, selected = "", empty = "Noch offen") {
  return `<option value="">${escapeHtml(empty)}</option>${(Array.isArray(players) ? players : []).map(player => {
    const name = String(player?.name || "");
    const number = player?.number ? `#${player.number} · ` : "";
    return `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(`${number}${name}`)}</option>`;
  }).join("")}`;
}

function stickerCard(sticker, selectedId = "") {
  return `<button class="game-day-sticker" type="button" data-sticker-id="${escapeHtml(sticker.id)}" aria-pressed="${String(sticker.id === selectedId)}">
    ${sticker.previewDataUrl
      ? `<img src="${escapeHtml(sticker.previewDataUrl)}" alt="">`
      : '<span class="game-day-sticker-placeholder" aria-hidden="true">🖼</span>'}
    <span>${escapeHtml(sticker.name)}</span>
  </button>`;
}

function componentBadge(label, status) {
  const component = deliveryComponentStatus(status);
  return `<span class="game-day-component" data-tone="${component.tone}">${escapeHtml(label)} ${component.tone === "success" ? "✓" : escapeHtml(component.label)}</span>`;
}

function selectedValue(root, selector) {
  return String(root.querySelector(selector)?.value || "").trim();
}

function setNativeValue(selector, value) {
  const control = document.querySelector(selector);
  if (!control) return;
  control.value = String(value ?? "");
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function selectNativeAction(value) {
  const input = document.querySelector(`input[name="action"][value="${value}"]`);
  if (!input) throw new Error("Diese Liveticker-Aktion ist nicht verfügbar.");
  input.checked = true;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function deliveryErrorMessage(error) {
  const message = String(error?.message || "");
  if (/network|fetch|verbindung/i.test(message)) {
    return "Netzwerkstatus unklar. Erneut versuchen verwendet denselben Versand-Schlüssel.";
  }
  return message || "Der WhatsApp-Auftrag konnte nicht angelegt werden.";
}

function initializeGameDay() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") !== GAME_DAY_QUERY) return;
  const root = document.querySelector("#gameDayRoot");
  const game = window.PD_LIVETICKER_GAME_CONTEXT;
  if (!root || !game?.eventId) return;

  document.body.classList.add("game-day-active");
  root.hidden = false;

  const model = {
    state: { ...readState(), completedAt: window.PD_LIVETICKER_SERVER_STATE?.completedAt || null },
    stickers: [],
    deliveries: [],
    sheet: "",
    audience: "OUR_TEAM",
    selectedStickerId: "",
    linkedActionId: "",
    galleryReturn: "",
    draft: null,
    request: null,
    currentDeliveryId: "",
    requestError: "",
    loading: true,
    deliveryLoadError: "",
    pendingLinks: new Map(),
    notice: "",
    phaseLabel: "",
    messageDraft: "",
    freeTextDraft: ""
  };

  function opponentPlayers() {
    return Array.isArray(game.opponentTeam?.players) ? game.opponentTeam.players : [];
  }

  function ownPlayers() {
    return Array.isArray(game.ownTeam?.players) ? game.ownTeam.players : [];
  }

  function relevantStickers({ audience = model.audience, category = "", strictCategory = false } = {}) {
    return activeGameDayStickers(model.stickers, {
      audience,
      category,
      strictCategory,
      opponentTeamId: game.opponentTeam?.id || ""
    });
  }

  function selectedSticker() {
    return model.stickers.find(sticker => sticker.id === model.selectedStickerId) || null;
  }

  function deliveryForId(id) {
    return model.deliveries.find(delivery => delivery.id === id) || null;
  }

  function currentDelivery() {
    return deliveryForId(model.draft?.deliveryId || model.currentDeliveryId || "");
  }

  function deliveryStatusHtml(delivery = currentDelivery()) {
    if (model.requestError) return `<p class="game-day-status" data-tone="error">${escapeHtml(model.requestError)}</p>`;
    if (!delivery) return "";
    return `<div class="game-day-status" data-tone="${delivery.status === "SUCCEEDED" ? "success" : delivery.status === "FAILED" ? "error" : "pending"}">
      ${componentBadge("Sticker", delivery.stickerStatus)} ${componentBadge("Text", delivery.textStatus)}
    </div>`;
  }

  function deliveryStatusSlotHtml(delivery = currentDelivery()) {
    return `<div data-game-day-delivery-status>${deliveryStatusHtml(delivery)}</div>`;
  }

  function deliveryFingerprint() {
    return JSON.stringify({
      error: model.deliveryLoadError,
      deliveries: model.deliveries.map(item => [
        item.id,
        item.status,
        item.stickerStatus,
        item.textStatus,
        item.linkedActionId || "",
        item.stickerMessageId || "",
        item.textMessageId || "",
        item.stickerSentAt || "",
        item.textSentAt || ""
      ])
    });
  }

  function stickerGrid(stickers, selectedId = model.selectedStickerId) {
    if (!stickers.length) return '<p class="game-day-empty">Für diesen Kontext sind keine aktiven Sticker hinterlegt.</p>';
    return stickers.map(sticker => stickerCard(sticker, selectedId)).join("");
  }

  function renderHeader() {
    const header = gameDayHeaderModel({ state: model.state, game });
    return `<header class="game-day-topbar">
      <a class="game-day-back" href="./">← Normale Ansicht</a>
      <span class="game-day-live" data-state="${header.completed ? "final" : "live"}">${header.completed ? "SPIELENDE" : "● LIVE"}</span>
    </header>
    <section class="game-day-score-card" aria-label="Aktueller Spielstand">
      <div class="game-day-score">
        <span class="game-day-team">${escapeHtml(header.homeName)}</span>
        <span><strong class="game-day-score-value">${header.homeScore}</strong><span class="game-day-score-divider"> : </span><strong class="game-day-score-value">${header.awayScore}</strong></span>
        <span class="game-day-team">${escapeHtml(header.awayName)}</span>
      </div>
      <div class="game-day-clock">
        <strong>${escapeHtml(model.phaseLabel || header.period.label)}</strong>
        <div class="game-day-minute-control" aria-label="Spielminute einstellen">
          <button class="game-day-minute-button" type="button" data-game-minute-step="-1" aria-label="Eine Minute zurück">−</button>
          <label class="game-day-minute-value" for="gameDayCurrentMinute"><span>Spielminute</span><input id="gameDayCurrentMinute" class="game-day-minute-input" type="number" inputmode="numeric" min="1" step="1" value="${header.minute}"></label>
          <button class="game-day-minute-button" type="button" data-game-minute-step="1" aria-label="Eine Minute weiter">+</button>
        </div>
      </div>
      <div class="game-day-health"><span>Liveticker <b>✓</b></span><span>WhatsApp <b data-game-day-whatsapp-health>${model.deliveryLoadError ? "Status offen" : "✓"}</b></span></div>
    </section>`;
  }

  function openDraftStatusText() {
    const delivery = currentDelivery();
    return `Sticker ${delivery?.stickerStatus === "SENT" ? "✓" : delivery ? deliveryComponentStatus(delivery.stickerStatus).label : "noch nicht gesendet"} · Ticker-Daten noch offen`;
  }

  function renderOpenDraft() {
    if (!model.draft || !["goal", "against", "penalty"].includes(model.draft.kind)) return "";
    return `<section class="game-day-card game-day-open">
      <h2>OFFENE AKTION · ${model.draft.kind === "goal" ? "TOR" : model.draft.kind === "against" ? "GEGENTOR" : "STRAFE"}</h2>
      <p class="game-day-muted" data-game-day-open-status>${escapeHtml(openDraftStatusText())}</p>
      <button class="game-day-secondary" type="button" data-continue-draft>WEITER BEARBEITEN</button>
    </section>`;
  }

  function renderTimeline() {
    const items = gameDayTimeline(model.state.history, model.deliveries).slice(0, 10);
    return `<section class="game-day-card"><h2>Verlauf</h2><div class="game-day-timeline">
      ${items.length ? items.map(item => {
        if (item.kind === "action") {
          return `<article class="game-day-timeline-item"><div class="game-day-timeline-head"><span>${escapeHtml(item.minute ? `${item.minute}'` : "Spiel")}</span><span>${escapeHtml(item.label)}</span></div><div class="game-day-component-row"><span class="game-day-component" data-tone="success">Liveticker ✓</span></div></article>`;
        }
        const delivery = item.delivery;
        return `<article class="game-day-timeline-item"><div class="game-day-timeline-head"><span>${new Date(delivery.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span><span>${escapeHtml(item.label)}</span></div><div class="game-day-component-row">${componentBadge("Sticker", delivery.stickerStatus)}${componentBadge("Text", delivery.textStatus)}</div><p class="game-day-muted">${delivery.linkedActionId ? "↳ Mit Liveticker-Aktion verknüpft" : "Keine Aktion"}</p></article>`;
      }).join("") : '<p class="game-day-muted">Noch keine Aktionen oder Sticker-Versände.</p>'}
    </div></section>`;
  }

  function renderExistingActions() {
    const actions = [...model.state.history].reverse().slice(0, 5);
    if (!actions.length) return "";
    return `<section class="game-day-card"><h2>Sticker nachträglich hinzufügen</h2><div class="game-day-existing-actions">${actions.map(action => {
      const label = action.type === "goal" ? (action.team === "opponent" ? "Gegentor" : "Tor") : action.type === "penalty" ? "Strafe" : "Aktion";
      return `<div class="game-day-existing-action"><span>${escapeHtml(`${action.minute ? `${action.minute}' · ` : ""}${label}${action.player?.name ? ` · ${action.player.name}` : ""}`)}</span><button type="button" data-add-sticker-action="${escapeHtml(action.id)}">Sticker</button></div>`;
    }).join("")}</div></section>`;
  }

  function renderMain() {
    root.innerHTML = `<div class="game-day-root"><div class="game-day-shell">
      ${renderHeader()}
      ${model.notice ? `<p class="game-day-status" data-tone="success">${escapeHtml(model.notice)}</p>` : ""}
      ${renderOpenDraft()}
      <nav class="game-day-actions" aria-label="Spieltagsaktionen">
        <button class="game-day-action" type="button" data-open="goal">TOR</button>
        <button class="game-day-action" data-kind="against" type="button" data-open="against">GEGENTOR</button>
        <button class="game-day-action" data-kind="penalty" type="button" data-open="penalty">STRAFE</button>
        <button class="game-day-action" data-kind="secondary" type="button" data-open="info">INFO</button>
        <button class="game-day-action" type="button" data-open="stickers">STICKER</button>
        <button class="game-day-action" data-kind="secondary" type="button" data-open="video">VIDEOBEWEIS</button>
        <button class="game-day-action wide" data-kind="secondary" type="button" data-open="phase">DRITTEL / SPIELSTATUS</button>
      </nav>
      ${renderExistingActions()}
      <div data-game-day-timeline-slot>${renderTimeline()}</div>
      ${model.loading ? '<p class="game-day-muted">Sticker und Versandstatus werden geladen …</p>' : ""}
      <div data-game-day-delivery-error>${model.deliveryLoadError ? `<p class="game-day-status" data-tone="error">${escapeHtml(model.deliveryLoadError)}</p>` : ""}</div>
    </div></div>${renderSheet()}`;
  }

  function galleryTabs() {
    return `<div class="game-day-tabs" role="tablist" aria-label="Sticker-Gruppen">
      ${[["OUR_TEAM", "Unsere"], ["OPPONENT", "Gegner"], ["GENERAL", "Allgemein"]].map(([value, label]) => `<button class="game-day-tab" type="button" role="tab" data-audience="${value}" aria-selected="${String(model.audience === value)}">${label}</button>`).join("")}
    </div>`;
  }

  function renderStickerSheet() {
    const sticker = selectedSticker();
    const stickers = relevantStickers();
    return `<div class="game-day-sheet-backdrop" data-sheet-backdrop><section class="game-day-sheet" role="dialog" aria-modal="true" aria-labelledby="gameDaySheetTitle">
      <div class="game-day-sheet-head"><h2 id="gameDaySheetTitle">Sticker</h2><button class="game-day-close" type="button" data-close-sheet aria-label="Schließen">×</button></div>
      ${galleryTabs()}
      <div class="game-day-sticker-grid">${stickerGrid(stickers)}</div>
      ${sticker ? `<p class="game-day-status">Ausgewählt: ${escapeHtml(sticker.name)}${model.linkedActionId ? " · wird nur mit der vorhandenen Aktion verknüpft" : ""}</p>
        <button class="game-day-primary" type="button" data-send-sticker>JETZT SENDEN</button>
        ${model.linkedActionId ? "" : '<button class="game-day-secondary" type="button" data-show-sticker-text>MIT TEXT SENDEN</button>'}` : ""}
      ${model.sheet === "sticker-text" ? `<div class="game-day-field"><label for="gameDayFreeText">Freier Text</label><textarea id="gameDayFreeText" maxlength="4000" placeholder="Nachricht für WhatsApp">${escapeHtml(model.freeTextDraft)}</textarea></div><button class="game-day-primary" type="button" data-send-sticker-text>STICKER + TEXT SENDEN</button>` : ""}
      ${deliveryStatusSlotHtml()}
      ${model.requestError && model.request ? '<button class="game-day-secondary" type="button" data-retry-request>ANFRAGE SICHER ERNEUT SENDEN</button>' : ""}
    </section></div>`;
  }

  function actionStickerSection(kind) {
    const config = kind === "goal"
      ? { audience: "OUR_TEAM", category: "GOAL" }
      : kind === "against"
        ? { audience: "OPPONENT", category: "AGAINST" }
        : { audience: "OUR_TEAM", category: "PENALTY" };
    const stickers = relevantStickers({ ...config, strictCategory: true });
    const sticker = selectedSticker();
    return `<section><h3>Empfohlene Sticker</h3><div class="game-day-sticker-grid">${stickerGrid(stickers)}</div></section>
      <button class="game-day-secondary" type="button" data-all-action-stickers>ALLE STICKER</button>
      ${sticker ? `<button class="game-day-primary" type="button" data-send-action-sticker>STICKER JETZT SENDEN</button>` : ""}
      ${deliveryStatusSlotHtml(model.draft?.deliveryId ? deliveryForId(model.draft.deliveryId) : null)}`;
  }

  function renderGoalSheet(kind) {
    const isOpponent = kind === "against";
    const players = isOpponent ? opponentPlayers() : ownPlayers();
    const draft = model.draft || { kind, minute: model.state.minute, publishText: true, scorer: "", assist1: "", assist2: "" };
    return `<div class="game-day-sheet-backdrop" data-sheet-backdrop><section class="game-day-sheet" role="dialog" aria-modal="true" aria-labelledby="gameDaySheetTitle">
      <div class="game-day-sheet-head"><h2 id="gameDaySheetTitle">${isOpponent ? "GEGENTOR" : "TOR"}</h2><button class="game-day-close" type="button" data-close-sheet aria-label="Schließen">×</button></div>
      ${actionStickerSection(kind)}
      <div class="game-day-form-grid">
        <div class="game-day-field full"><label for="gameDayScorer">Torschütze${isOpponent ? " (optional)" : ""}</label><select id="gameDayScorer">${playerOptions(players, draft.scorer, "Noch unbekannt")}</select></div>
        <div class="game-day-field"><label for="gameDayAssist1">1. Assist</label><select id="gameDayAssist1">${playerOptions(players, draft.assist1, "Kein / offen")}</select></div>
        <div class="game-day-field"><label for="gameDayAssist2">2. Assist</label><select id="gameDayAssist2">${playerOptions(players, draft.assist2, "Kein / offen")}</select></div>
        <div class="game-day-field full"><label for="gameDayMinute">Spielminute</label><input id="gameDayMinute" type="number" inputmode="numeric" min="1" value="${escapeHtml(draft.minute)}"></div>
      </div>
      <label class="game-day-status"><input id="gameDayPublishText" type="checkbox"${draft.publishText !== false ? " checked" : ""}> WhatsApp-Text nach dem Speichern veröffentlichen</label>
      <button class="game-day-primary" type="button" data-save-action>${isOpponent ? "GEGENTOR" : "TOR"} EINTRAGEN</button>
      <p class="game-day-status" data-tone="error" data-form-error hidden></p>
    </section></div>`;
  }

  function penaltySourceOptions(field, selected = "") {
    const source = document.querySelector(`#penaltyRows [data-field="${field}"]`);
    if (!source) return "";
    return [...source.options].map(option => `<option value="${escapeHtml(option.value)}"${option.value === selected ? " selected" : ""}>${escapeHtml(option.textContent)}</option>`).join("");
  }

  function renderPenaltySheet() {
    const draft = model.draft || { kind: "penalty", minute: model.state.minute, publishText: true, player: "", duration: "2", reason: "", team: "mighty" };
    const players = draft.team === "opponent" ? opponentPlayers() : ownPlayers();
    return `<div class="game-day-sheet-backdrop" data-sheet-backdrop><section class="game-day-sheet" role="dialog" aria-modal="true" aria-labelledby="gameDaySheetTitle">
      <div class="game-day-sheet-head"><h2 id="gameDaySheetTitle">STRAFE</h2><button class="game-day-close" type="button" data-close-sheet aria-label="Schließen">×</button></div>
      ${actionStickerSection("penalty")}
      <div class="game-day-form-grid">
        <div class="game-day-field"><label for="gameDayPenaltyTeam">Team</label><select id="gameDayPenaltyTeam"><option value="mighty"${draft.team === "mighty" ? " selected" : ""}>Mighty Dogs</option><option value="opponent"${draft.team === "opponent" ? " selected" : ""}>${escapeHtml(game.opponentTeam?.shortName || "Gegner")}</option></select></div>
        <div class="game-day-field"><label for="gameDayPenaltyPlayer">Spieler</label><select id="gameDayPenaltyPlayer">${playerOptions(players, draft.player, "Noch unbekannt")}</select></div>
        <div class="game-day-field full"><span class="game-day-label">Strafdauer</span><div class="game-day-duration">${["2", "5", "10"].map(value => `<button type="button" data-duration="${value}" aria-pressed="${String(draft.duration === value)}">${value}</button>`).join("")}<button type="button" data-duration="other" aria-pressed="${String(!["2", "5", "10"].includes(draft.duration))}">andere</button></div><select id="gameDayPenaltyDuration">${penaltySourceOptions("duration", draft.duration)}</select></div>
        <div class="game-day-field full"><label for="gameDayPenaltyReason">Strafgrund</label><select id="gameDayPenaltyReason">${penaltySourceOptions("reason", draft.reason)}</select></div>
        <div class="game-day-field full"><label for="gameDayMinute">Spielminute</label><input id="gameDayMinute" type="number" inputmode="numeric" min="1" value="${escapeHtml(draft.minute)}"></div>
      </div>
      <label class="game-day-status"><input id="gameDayPublishText" type="checkbox"${draft.publishText !== false ? " checked" : ""}> WhatsApp-Text nach dem Speichern veröffentlichen</label>
      <button class="game-day-primary" type="button" data-save-action>STRAFE EINTRAGEN</button>
      <p class="game-day-status" data-tone="error" data-form-error hidden></p>
    </section></div>`;
  }

  function renderMessageSheet(kind) {
    const video = kind === "video";
    const category = video ? "VIDEO_REVIEW" : "GENERAL";
    const suggestions = relevantStickers({ audience: "GENERAL", category, strictCategory: video });
    return `<div class="game-day-sheet-backdrop" data-sheet-backdrop><section class="game-day-sheet" role="dialog" aria-modal="true" aria-labelledby="gameDaySheetTitle">
      <div class="game-day-sheet-head"><h2 id="gameDaySheetTitle">${video ? "VIDEOBEWEIS" : "INFO"}</h2><button class="game-day-close" type="button" data-close-sheet aria-label="Schließen">×</button></div>
      ${video ? '<p class="game-day-muted">Schnelle WhatsApp-Information. Eine eigene Schiedsrichter-State-Machine wird nicht erzeugt.</p>' : ""}
      <div class="game-day-sticker-grid">${stickerGrid(suggestions)}</div>
      ${video ? '<div class="game-day-duration"><button type="button" data-message-preset="Videobeweis läuft.">Review läuft</button><button type="button" data-message-preset="Tor bestätigt.">Tor bestätigt</button><button type="button" data-message-preset="Kein Tor.">Kein Tor</button><button type="button" data-message-preset="Entscheidung: ">Entscheidung</button></div>' : ""}
      <div class="game-day-field"><label for="gameDayMessage">Text</label><textarea id="gameDayMessage" maxlength="4000">${escapeHtml(model.messageDraft)}</textarea></div>
      <button class="game-day-primary" type="button" data-send-message>${model.selectedStickerId ? "STICKER + TEXT SENDEN" : "TEXT SENDEN"}</button>
      ${deliveryStatusSlotHtml()}
      ${model.requestError && model.request ? '<button class="game-day-secondary" type="button" data-retry-request>ANFRAGE SICHER ERNEUT SENDEN</button>' : ""}
    </section></div>`;
  }

  function renderPhaseSheet() {
    return `<div class="game-day-sheet-backdrop" data-sheet-backdrop><section class="game-day-sheet" role="dialog" aria-modal="true" aria-labelledby="gameDaySheetTitle">
      <div class="game-day-sheet-head"><h2 id="gameDaySheetTitle">Drittel / Spielstatus</h2><button class="game-day-close" type="button" data-close-sheet aria-label="Schließen">×</button></div>
      <p class="game-day-muted">Die Spielminute lässt sich oben wie in der normalen Ansicht direkt eingeben oder mit − / + ändern. Die Schnellwahl setzt zusätzlich den passenden Spielstatus.</p>
      ${[[1, "Vor dem Spiel", "Vor dem Spiel"], [1, "1. Drittel", "1. Drittel"], [20, "Pause nach dem 1. Drittel", "Pause"], [21, "2. Drittel", "2. Drittel"], [40, "Pause nach dem 2. Drittel", "Pause"], [41, "3. Drittel", "3. Drittel"], [61, "Verlängerung", "Verlängerung"], [61, "Penaltyschießen", "Penaltyschießen"], [61, "Spielende (Anzeige)", "Spielende"]].map(([minute, label, phase]) => `<button class="game-day-secondary" type="button" data-set-minute="${minute}" data-phase-label="${escapeHtml(phase)}">${label}</button>`).join("")}
      <a class="game-day-secondary" href="./" style="display:flex;align-items:center;justify-content:center;text-decoration:none">Weitere Spielstatus-Aktionen in normaler Ansicht</a>
    </section></div>`;
  }

  function renderSheet() {
    if (!model.sheet) return "";
    if (["stickers", "sticker-text"].includes(model.sheet)) return renderStickerSheet();
    if (["goal", "against"].includes(model.sheet)) return renderGoalSheet(model.sheet);
    if (model.sheet === "penalty") return renderPenaltySheet();
    if (["info", "video"].includes(model.sheet)) return renderMessageSheet(model.sheet);
    if (model.sheet === "phase") return renderPhaseSheet();
    return "";
  }

  function captureDraft() {
    if (!model.draft) return;
    model.draft.minute = Math.max(1, Number.parseInt(selectedValue(root, "#gameDayMinute"), 10) || model.state.minute);
    model.draft.publishText = root.querySelector("#gameDayPublishText")?.checked !== false;
    if (["goal", "against"].includes(model.draft.kind)) {
      model.draft.scorer = selectedValue(root, "#gameDayScorer");
      model.draft.assist1 = selectedValue(root, "#gameDayAssist1");
      model.draft.assist2 = selectedValue(root, "#gameDayAssist2");
    } else if (model.draft.kind === "penalty") {
      model.draft.team = selectedValue(root, "#gameDayPenaltyTeam") || "mighty";
      model.draft.player = selectedValue(root, "#gameDayPenaltyPlayer");
      model.draft.duration = selectedValue(root, "#gameDayPenaltyDuration") || "2";
      model.draft.reason = selectedValue(root, "#gameDayPenaltyReason");
    }
  }

  function captureSheetInputs() {
    captureDraft();
    if (["info", "video"].includes(model.sheet)) {
      model.messageDraft = selectedValue(root, "#gameDayMessage");
    }
    if (model.sheet === "sticker-text") {
      model.freeTextDraft = selectedValue(root, "#gameDayFreeText");
    }
  }

  function openAction(kind) {
    if (model.draft?.kind !== kind) {
      model.draft = { kind, minute: model.state.minute, publishText: true };
      if (["goal", "against"].includes(kind)) Object.assign(model.draft, { scorer: "", assist1: "", assist2: "" });
      if (kind === "penalty") Object.assign(model.draft, { team: "mighty", player: "", duration: "2", reason: "" });
      model.selectedStickerId = "";
    }
    model.sheet = kind;
    model.requestError = "";
    renderMain();
  }

  function openStickerGallery(linkedActionId = "") {
    model.sheet = "stickers";
    model.audience = "OUR_TEAM";
    model.selectedStickerId = "";
    model.linkedActionId = linkedActionId;
    model.galleryReturn = "";
    model.request = null;
    model.currentDeliveryId = "";
    model.requestError = "";
    model.freeTextDraft = "";
    renderMain();
  }

  async function refreshDeliveries() {
    const before = deliveryFingerprint();
    try {
      const result = await loadWhatsappDeliveries(game.eventId);
      model.deliveries = Array.isArray(result?.deliveries) ? result.deliveries : [];
      model.deliveryLoadError = "";
    } catch {
      model.deliveryLoadError = "Versandstatus ist bis zur Aktivierung der neuen DEV-Migration noch nicht verfügbar.";
    }
    return before !== deliveryFingerprint();
  }

  function visibleDeliveryStatus() {
    if (model.draft?.deliveryId && ["goal", "against", "penalty"].includes(model.draft.kind)) {
      return deliveryForId(model.draft.deliveryId);
    }
    return currentDelivery();
  }

  function patchDeliveryUi() {
    const health = root.querySelector("[data-game-day-whatsapp-health]");
    if (health) health.textContent = model.deliveryLoadError ? "Status offen" : "✓";

    const timeline = root.querySelector("[data-game-day-timeline-slot]");
    if (timeline) timeline.innerHTML = renderTimeline();

    const openStatus = root.querySelector("[data-game-day-open-status]");
    if (openStatus) openStatus.textContent = openDraftStatusText();

    const deliveryStatus = root.querySelector("[data-game-day-delivery-status]");
    if (deliveryStatus) deliveryStatus.innerHTML = deliveryStatusHtml(visibleDeliveryStatus());

    const errorSlot = root.querySelector("[data-game-day-delivery-error]");
    if (errorSlot) {
      errorSlot.innerHTML = model.deliveryLoadError
        ? `<p class="game-day-status" data-tone="error">${escapeHtml(model.deliveryLoadError)}</p>`
        : "";
    }
  }

  function setGameDayMinute(value, phaseLabel = "") {
    const minute = Math.max(1, Number.parseInt(value, 10) || 1);
    model.phaseLabel = phaseLabel;
    const gameDayInput = root.querySelector("#gameDayCurrentMinute");
    if (gameDayInput) gameDayInput.value = String(minute);
    setNativeValue("#gameMinute", minute);
    model.state = { ...readState(), completedAt: model.state.completedAt || null };
    return minute;
  }

  async function sendRequest(request, draft = null) {
    model.request = request;
    model.requestError = "";
    renderMain();
    try {
      const result = await request.send();
      model.currentDeliveryId = result?.delivery?.id || "";
      if (draft && model.currentDeliveryId) draft.deliveryId = model.currentDeliveryId;
      if (result?.delivery) {
        model.deliveries = [result.delivery, ...model.deliveries.filter(item => item.id !== result.delivery.id)];
      }
      await refreshDeliveries();
    } catch (error) {
      model.requestError = deliveryErrorMessage(error);
    }
    renderMain();
  }

  async function sendStickerOnly({ linkedActionId = model.linkedActionId, draft = null } = {}) {
    if (!model.selectedStickerId) return;
    const request = draft?.request || createWhatsappStickerOnlyRequest({
      eventId: game.eventId,
      stickerId: model.selectedStickerId,
      linkedActionId: linkedActionId || null
    });
    if (draft) draft.request = request;
    await sendRequest(request, draft);
  }

  async function sendCombined(message, { linkedActionId = null } = {}) {
    captureSheetInputs();
    const mode = model.selectedStickerId
      ? WHATSAPP_DELIVERY_MODES.STICKER_THEN_TEXT
      : WHATSAPP_DELIVERY_MODES.TEXT_ONLY;
    const request = model.request || createWhatsappDeliveryRequest({
      eventId: game.eventId,
      deliveryMode: mode,
      stickerId: model.selectedStickerId || null,
      message,
      linkedActionId
    });
    await sendRequest(request);
  }

  function saveStructuredAction() {
    captureDraft();
    const draft = model.draft;
    if (!draft) return;
    const before = [...model.state.history];
    try {
      selectNativeAction(draft.kind === "goal" ? "GOAL_MIGHTY" : draft.kind === "against" ? "GOAL_OPPONENT" : "PENALTY");
      setNativeValue("#gameMinute", draft.minute);
      if (["goal", "against"].includes(draft.kind)) {
        setNativeValue("#goalPlayer", draft.scorer);
        setNativeValue("#assist1", draft.assist1);
        setNativeValue("#assist2", draft.assist2);
      } else {
        const row = document.querySelector("#penaltyRows .penalty-row");
        if (!row) throw new Error("Die Strafenmaske ist nicht verfügbar.");
        setNativeValue("#penaltyRows [data-field='team']", draft.team);
        setNativeValue("#penaltyRows [data-field='duration']", draft.duration);
        setNativeValue("#penaltyRows [data-field='player']", draft.player);
        setNativeValue("#penaltyRows [data-field='reason']", draft.reason);
      }
      const publish = document.querySelector("#livetickerWhatsappPublish");
      if (publish) publish.checked = draft.publishText !== false;
      const noSticker = document.querySelector("#livetickerWhatsappStickerNone");
      if (noSticker) noSticker.checked = true;
      document.querySelector("#tickerForm")?.requestSubmit();
      const after = readState();
      const actionId = newActionId(before, after.history);
      if (!actionId) {
        const nativeError = document.querySelector("#formError");
        throw new Error(nativeError?.textContent || "Die Aktion konnte nicht gespeichert werden.");
      }
      model.state = after;
      if (draft.deliveryId) model.pendingLinks.set(actionId, draft.deliveryId);
      model.notice = `${draft.kind === "goal" ? "Tor" : draft.kind === "against" ? "Gegentor" : "Strafe"} gespeichert.`;
      model.draft = null;
      model.request = null;
      model.selectedStickerId = "";
      model.sheet = "";
      renderMain();
    } catch (error) {
      const box = root.querySelector("[data-form-error]");
      if (box) {
        box.textContent = error?.message || "Die Aktion konnte nicht gespeichert werden.";
        box.hidden = false;
      }
    }
  }

  async function flushPendingLinks() {
    for (const [actionId, jobId] of [...model.pendingLinks.entries()]) {
      try {
        const result = await linkWhatsappStickerDelivery({ jobId, actionId });
        if (result?.delivery) {
          model.deliveries = [result.delivery, ...model.deliveries.filter(item => item.id !== result.delivery.id)];
        }
        model.pendingLinks.delete(actionId);
      } catch (error) {
        console.warn("Sticker-Verknüpfung wird nach dem nächsten Sync erneut versucht.", error);
      }
    }
    renderMain();
  }

  root.addEventListener("click", event => {
    const button = event.target.closest("button, a");
    if (!button) return;
    const open = button.dataset.open;
    if (open) {
      if (["goal", "against", "penalty"].includes(open)) openAction(open);
      else if (open === "stickers") openStickerGallery();
      else {
        model.sheet = open;
        model.selectedStickerId = "";
        model.request = null;
        model.requestError = "";
        model.messageDraft = open === "video" ? "Videobeweis läuft." : "";
        renderMain();
      }
      return;
    }
    if (button.matches("[data-close-sheet]")) {
      captureSheetInputs();
      model.sheet = model.galleryReturn || "";
      model.galleryReturn = "";
      renderMain();
      return;
    }
    if (button.matches("[data-continue-draft]")) { model.sheet = model.draft.kind; renderMain(); return; }
    if (button.dataset.audience) {
      captureSheetInputs();
      model.audience = button.dataset.audience;
      model.selectedStickerId = "";
      renderMain();
      return;
    }
    if (button.dataset.stickerId) {
      captureSheetInputs();
      if (model.draft?.deliveryId && ["goal", "against", "penalty"].includes(model.draft.kind)) {
        model.requestError = "Für diese offene Aktion wurde bereits ein Sticker-Auftrag angelegt.";
        renderMain();
        return;
      }
      model.selectedStickerId = button.dataset.stickerId;
      if (model.draft && !model.draft.deliveryId) model.draft.request = null;
      model.request = null;
      model.requestError = "";
      renderMain();
      return;
    }
    if (button.matches("[data-show-sticker-text]")) { model.freeTextDraft = ""; model.sheet = "sticker-text"; renderMain(); return; }
    if (button.matches("[data-send-sticker]")) {
      if (model.galleryReturn && model.draft) {
        const returnSheet = model.galleryReturn;
        void sendStickerOnly({ draft: model.draft }).then(() => {
          model.sheet = returnSheet;
          model.galleryReturn = "";
          renderMain();
        });
      } else {
        void sendStickerOnly();
      }
      return;
    }
    if (button.matches("[data-send-action-sticker]")) { captureDraft(); void sendStickerOnly({ draft: model.draft }); return; }
    if (button.matches("[data-send-sticker-text]")) { void sendCombined(selectedValue(root, "#gameDayFreeText")); return; }
    if (button.matches("[data-send-message]")) { void sendCombined(selectedValue(root, "#gameDayMessage")); return; }
    if (button.matches("[data-retry-request]") && model.request) { void sendRequest(model.request, model.draft); return; }
    if (button.matches("[data-save-action]")) { saveStructuredAction(); return; }
    if (button.matches("[data-all-action-stickers]")) {
      captureDraft();
      model.audience = model.draft.kind === "against" ? "OPPONENT" : "OUR_TEAM";
      model.galleryReturn = model.draft.kind;
      model.sheet = "stickers";
      renderMain();
      return;
    }
    if (button.dataset.duration) {
      captureDraft();
      if (button.dataset.duration !== "other") model.draft.duration = button.dataset.duration;
      renderMain();
      return;
    }
    if (button.dataset.messagePreset != null) {
      model.messageDraft = button.dataset.messagePreset;
      renderMain();
      root.querySelector("#gameDayMessage")?.focus();
      return;
    }
    if (button.dataset.gameMinuteStep) {
      const input = root.querySelector("#gameDayCurrentMinute");
      const current = Number.parseInt(input?.value, 10) || Number(model.state.minute) || 1;
      setGameDayMinute(current + Number.parseInt(button.dataset.gameMinuteStep, 10));
      return;
    }
    if (button.dataset.setMinute) {
      setGameDayMinute(button.dataset.setMinute, button.dataset.phaseLabel || "");
      model.sheet = "";
      renderMain();
      return;
    }
    if (button.dataset.addStickerAction) openStickerGallery(button.dataset.addStickerAction);
  });

  root.addEventListener("change", event => {
    if (event.target.matches("#gameDayCurrentMinute")) {
      event.target.value = String(setGameDayMinute(event.target.value));
      return;
    }
    if (event.target.matches("#gameDayPenaltyTeam")) {
      captureDraft();
      model.draft.player = "";
      renderMain();
    }
  });

  window.addEventListener("pd-liveticker-state-saved", event => {
    captureSheetInputs();
    if (event.detail?.state) model.state = { ...event.detail.state, completedAt: model.state.completedAt || null };
    renderMain();
  });
  window.addEventListener("pd-liveticker-server-synced", event => {
    if (event.detail?.state) model.state = event.detail.state;
    void flushPendingLinks();
  });

  const poll = window.setInterval(async () => {
    const changed = await refreshDeliveries();
    if (changed) patchDeliveryUi();
  }, 3000);
  window.addEventListener("pagehide", () => clearInterval(poll), { once: true });

  renderMain();
  Promise.all([
    loadWhatsappStickerLibrary({ includeInactive: false }).then(stickers => { model.stickers = stickers; }),
    refreshDeliveries()
  ]).catch(error => {
    model.deliveryLoadError = error?.message || "Spieltagsdaten konnten nicht vollständig geladen werden.";
  }).finally(() => {
    captureSheetInputs();
    model.loading = false;
    renderMain();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") initializeGameDay();

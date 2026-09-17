import {
  activeWhatsappStickers,
  classicActionWhatsappStickers,
  gameSituationWhatsappStickers,
  generalWhatsappStickers,
  whatsappStickerDeliveryStatus
} from "./liveticker-whatsapp-sticker-core.js?v=20260917-classic-action-stickers-r1";

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const CONTROL_ID = "livetickerWhatsappPublish";
const STATUS_ID = "livetickerWhatsappPublishStatus";
const ACTION_STICKER_AREA_ID = "livetickerWhatsappActionStickers";
const GAME_STICKER_AREA_ID = "livetickerWhatsappGameStickers";
const GENERAL_STICKER_AREA_ID = "livetickerWhatsappGeneralStickers";
const MAX_MESSAGE_LENGTH = 4000;

function cleanAction(action) {
  if (!action || typeof action !== "object") return action;
  const { _whatsapp, ...clean } = action;
  return clean;
}

function cleanHistory(history) {
  return Array.isArray(history) ? history.map(cleanAction) : [];
}

function actionMap(history) {
  return new Map(cleanHistory(history).map(item => [item?.id, item]));
}

export function changedWhatsappActionIds(previousHistory, currentHistory) {
  const previous = actionMap(previousHistory);
  return cleanHistory(currentHistory)
    .filter(item => item?.id && !previous.has(item.id))
    .map(item => item.id);
}

export function attachWhatsappPublishIntent({ previousHistory, state, text, enabled = true, stickerId = "" }) {
  const currentHistory = Array.isArray(state?.history) ? state.history : [];
  const changedIds = changedWhatsappActionIds(previousHistory, currentHistory);
  const message = String(text ?? "");

  if (!enabled) return { attached: false, reason: "disabled", changedIds };
  if (changedIds.length !== 1) return { attached: false, reason: "ambiguous", changedIds };
  if (!message.trim()) return { attached: false, reason: "empty", changedIds };
  if (message.length > MAX_MESSAGE_LENGTH) return { attached: false, reason: "too_long", changedIds };

  const target = currentHistory.find(item => item?.id === changedIds[0]);
  if (!target) return { attached: false, reason: "missing", changedIds };

  const normalizedStickerId = String(stickerId || "").trim();
  target._whatsapp = Object.freeze(normalizedStickerId
    ? { publish: true, text: message, stickerId: normalizedStickerId }
    : { publish: true, text: message });
  return { attached: true, reason: "ready", changedIds };
}

function readStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return cleanHistory(parsed?.history);
  } catch {
    return [];
  }
}

function setControlStatus(text, state = "ready") {
  const node = document.getElementById(STATUS_ID);
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function installStyles() {
  if (document.querySelector("style[data-liveticker-whatsapp-publish]")) return;
  const style = document.createElement("style");
  style.dataset.livetickerWhatsappPublish = "true";
  style.textContent = `
    .liveticker-whatsapp-panel,.liveticker-sticker-area{display:grid;gap:10px;padding:10px 11px;border:1px solid #b9d7f5;border-radius:13px;background:#eef7ff;color:#073c68}
    .liveticker-whatsapp-publish{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;cursor:pointer}
    .liveticker-whatsapp-publish input{width:20px;height:20px;min-width:20px;margin:1px 0 0;accent-color:#0d79e8}
    .liveticker-whatsapp-publish-copy{display:grid;gap:2px;min-width:0}.liveticker-whatsapp-publish-copy strong{font-size:.79rem}.liveticker-whatsapp-publish-copy small{color:#526d86;font-size:.69rem;line-height:1.35}
    .liveticker-whatsapp-publish-copy small[data-state="error"]{color:#a92932;font-weight:850}
    .liveticker-sticker-area{padding:9px}.liveticker-sticker-area h3{margin:0;font-size:.82rem}.liveticker-sticker-area-copy{margin:0;color:#526d86;font-size:.69rem;line-height:1.35}.liveticker-whatsapp-extras{display:grid;gap:8px;min-width:0}.liveticker-sticker-details{border:1px solid #b9d7f5;border-radius:13px;background:#eef7ff;color:#073c68;overflow:hidden}.liveticker-sticker-details summary{min-height:46px;padding:10px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;list-style:none;font-size:.78rem;font-weight:950;cursor:pointer}.liveticker-sticker-details summary::-webkit-details-marker{display:none}.liveticker-sticker-details summary::after{content:"⌄"}.liveticker-sticker-details[open] summary::after{transform:rotate(180deg)}.liveticker-sticker-details-body{padding:0 9px 9px;display:grid;gap:8px;min-width:0}
    .liveticker-whatsapp-sticker-options{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(78px,92px);gap:7px;min-width:0;max-width:100%;overflow-x:auto;padding:2px 1px 5px;overscroll-behavior-inline:contain;scroll-snap-type:inline proximity}
    .liveticker-whatsapp-sticker-option{min-height:82px;padding:6px;border:1px solid #b9d7f5;border-radius:11px;background:#fff;display:grid;grid-template-rows:50px auto;gap:4px;place-items:center;color:#274760;font-size:.65rem;font-weight:900;text-align:center;line-height:1.05;scroll-snap-align:start}.liveticker-whatsapp-sticker-option[aria-pressed="true"]{border-color:#0d79e8;box-shadow:inset 0 0 0 2px rgba(13,121,232,.2);background:#f6fbff}.liveticker-whatsapp-sticker-option:disabled{opacity:.58}.liveticker-whatsapp-sticker-option img{display:block;width:50px;height:50px;object-fit:contain}.liveticker-whatsapp-sticker-empty{margin:0;color:#526d86;font-size:.68rem}.liveticker-whatsapp-sticker-send-now{min-height:42px;padding:7px 10px;border:1px solid #0d79e8;border-radius:10px;background:#0d79e8;color:#fff;font-size:.74rem;font-weight:950}.liveticker-whatsapp-sticker-send-now:disabled{opacity:.5}.liveticker-whatsapp-sticker-status{margin:0;padding:7px 9px;border-radius:10px;background:#f7faff;color:#526d86;font-size:.69rem;font-weight:850;line-height:1.35}.liveticker-whatsapp-sticker-status[data-tone="success"]{background:#eaf8f1;color:#087747}.liveticker-whatsapp-sticker-status[data-tone="pending"]{background:#fff8df;color:#725800}.liveticker-whatsapp-sticker-status[data-tone="error"]{background:#fff1f1;color:#a92932}.liveticker-whatsapp-sticker-actions{display:flex;gap:7px}.liveticker-whatsapp-sticker-actions button{flex:1}.liveticker-whatsapp-sticker-retry{min-height:40px;padding:7px 10px;border:1px solid #b9d7f5;border-radius:10px;background:#fff;color:#073c68;font-size:.72rem;font-weight:950}
  `;
  document.head.append(style);
}

function installControl() {
  const form = document.querySelector("#tickerForm");
  const submit = document.querySelector("#submitButton");
  if (!form || !submit || document.getElementById(CONTROL_ID)) return;

  installStyles();
  const actionGrid = form.querySelector(".action-grid");
  const actionPanel = document.createElement("section");
  actionPanel.id = ACTION_STICKER_AREA_ID;
  actionPanel.className = "liveticker-sticker-area";
  actionPanel.dataset.stickerArea = "action";
  actionPanel.innerHTML = '<h3>Aktionssticker</h3><div data-sticker-area-body><p class="liveticker-whatsapp-sticker-empty">Sticker werden geladen …</p></div>';
  actionGrid?.insertAdjacentElement("afterend", actionPanel);

  const extras = document.createElement("section");
  extras.className = "liveticker-whatsapp-extras";
  extras.innerHTML = `
    <details id="${GAME_STICKER_AREA_ID}" class="liveticker-sticker-details" data-sticker-area="game">
      <summary>Weitere Spielsticker</summary>
      <div class="liveticker-sticker-details-body" data-sticker-area-body><p class="liveticker-whatsapp-sticker-empty">Sticker werden geladen …</p></div>
    </details>
    <details id="${GENERAL_STICKER_AREA_ID}" class="liveticker-sticker-details" data-sticker-area="general">
      <summary>Allgemeine Sticker</summary>
      <div class="liveticker-sticker-details-body" data-sticker-area-body><p class="liveticker-whatsapp-sticker-empty">Sticker werden geladen …</p></div>
    </details>`;
  form.insertBefore(extras, submit);

  const panel = document.createElement("section");
  panel.className = "liveticker-whatsapp-panel";
  const label = document.createElement("label");
  label.className = "liveticker-whatsapp-publish";
  label.htmlFor = CONTROL_ID;
  label.innerHTML = `
    <input id="${CONTROL_ID}" type="checkbox" checked>
    <span class="liveticker-whatsapp-publish-copy">
      <strong>WhatsApp-Kanal</strong>
      <small id="${STATUS_ID}" data-state="ready">Neue Aktionen automatisch senden · Bearbeitungen werden nicht erneut veröffentlicht.</small>
    </span>
  `;
  panel.append(label);
  form.insertBefore(panel, submit);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function startBrowserIntegration() {
  installControl();
  let previousHistory = readStoredHistory();
  let stickerLibrary = [];
  let deliveries = [];
  let libraryError = "";
  let deliveryError = "";
  let linkingPending = false;
  const pendingLinks = new Map();
  const areas = {
    action: { selectedStickerId: "", request: null, deliveryId: "", linkedActionId: "", requestError: "", busy: false },
    game: { selectedStickerId: "", request: null, deliveryId: "", linkedActionId: "", requestError: "", busy: false },
    general: { selectedStickerId: "", request: null, deliveryId: "", linkedActionId: "", requestError: "", busy: false }
  };

  const eventId = () => String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.eventId || "").trim();
  const opponentTeamId = () => String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.opponentTeam?.id || "").trim();
  const selectedAction = () => String(document.querySelector('input[name="action"]:checked')?.value || "");
  const penaltyTeams = () => [...document.querySelectorAll('#penaltyRows [data-field="team"]')]
    .map(select => String(select.value || ""));
  const actionStickerBlockedByEdit = () => {
    const banner = document.getElementById("editingBanner");
    return banner?.hidden === false
      && banner.querySelector("span")?.textContent?.trim() === "Aktion wird bearbeitet";
  };
  const deliveryFor = area => deliveries.find(delivery => delivery.id === areas[area].deliveryId) || null;

  function stickersForArea(area) {
    if (area === "action") {
      return classicActionWhatsappStickers(stickerLibrary, {
        action: selectedAction(),
        opponentTeamId: opponentTeamId(),
        penaltyTeams: penaltyTeams()
      });
    }
    if (area === "game") return gameSituationWhatsappStickers(stickerLibrary, { opponentTeamId: opponentTeamId() });
    return generalWhatsappStickers(stickerLibrary);
  }

  function resetArea(area) {
    Object.assign(areas[area], {
      selectedStickerId: "",
      request: null,
      deliveryId: "",
      linkedActionId: "",
      requestError: "",
      busy: false
    });
  }

  function statusHtml(area) {
    const state = areas[area];
    if (state.requestError) {
      return `<p class="liveticker-whatsapp-sticker-status" data-tone="error">${escapeHtml(state.requestError)}</p><button class="liveticker-whatsapp-sticker-retry" type="button" data-retry-sticker-request="${area}"${state.busy ? " disabled" : ""}>ANFRAGE SICHER ERNEUT SENDEN</button>`;
    }
    const delivery = deliveryFor(area);
    if (!delivery) return state.busy
      ? '<p class="liveticker-whatsapp-sticker-status" data-tone="pending">WIRD GESENDET …</p>'
      : "";
    const status = whatsappStickerDeliveryStatus(delivery);
    const retry = status.retryable
      ? `<button class="liveticker-whatsapp-sticker-retry" type="button" data-retry-sticker-delivery="${area}"${state.busy ? " disabled" : ""}>ERNEUT SENDEN</button>`
      : "";
    const clear = delivery.stickerStatus === "SENT" && (area !== "action" || state.linkedActionId)
      ? `<button class="liveticker-whatsapp-sticker-retry" type="button" data-clear-sticker-area="${area}">WEITEREN STICKER AUSWÄHLEN</button>`
      : "";
    return `<p class="liveticker-whatsapp-sticker-status" data-tone="${status.tone}">${escapeHtml(`Sticker ${status.label}`)}</p><div class="liveticker-whatsapp-sticker-actions">${retry}${clear}</div>`;
  }

  function stickerCards(stickers, area, locked) {
    if (!stickers.length) return '<p class="liveticker-whatsapp-sticker-empty">Für diesen Bereich sind keine aktiven Sticker hinterlegt.</p>';
    return `<div class="liveticker-whatsapp-sticker-options">${stickers.map(sticker => `<button class="liveticker-whatsapp-sticker-option" type="button" data-select-sticker="${escapeHtml(sticker.id)}" data-sticker-area-name="${area}" aria-pressed="${String(areas[area].selectedStickerId === sticker.id)}"${locked ? " disabled" : ""}>${sticker.previewDataUrl ? `<img src="${escapeHtml(sticker.previewDataUrl)}" alt="">` : '<span aria-hidden="true">🖼</span>'}<span>${escapeHtml(sticker.name)}</span></button>`).join("")}</div>`;
  }

  function renderArea(area) {
    const root = document.querySelector(`[data-sticker-area="${area}"]`);
    const body = root?.querySelector("[data-sticker-area-body]");
    if (!body) return;
    if (libraryError) {
      body.innerHTML = `<p class="liveticker-whatsapp-sticker-status" data-tone="error">${escapeHtml(libraryError)}</p>`;
      return;
    }
    if (area === "action" && actionStickerBlockedByEdit()) {
      body.innerHTML = '<p class="liveticker-sticker-area-copy">Beim Bearbeiten einer bestehenden Aktion wird kein neuer WhatsApp-Sticker versendet.</p>';
      return;
    }
    const state = areas[area];
    const delivery = deliveryFor(area);
    const locked = Boolean(state.request || state.deliveryId || state.busy);
    const stickers = stickersForArea(area);
    const action = selectedAction();
    const mixedPenalty = area === "action" && action === "PENALTY" && new Set(penaltyTeams()).size > 1;
    const contextCopy = area === "action"
      ? state.linkedActionId
        ? "Aktionssticker der zuletzt gespeicherten Aktion."
        : mixedPenalty
        ? "Für gemischte Strafen beider Teams ist kein eindeutiger Aktionssticker verfügbar."
        : "Passender Sticker zur gewählten Aktion · immer separat ohne Text."
      : area === "game"
        ? "Timeout, Überzahl, Unterzahl, Drittelpause oder Spielstatus."
        : "Verein, Fans, Stimmung und allgemeine Reaktionen.";
    const sendButton = state.selectedStickerId && !locked
      ? `<button class="liveticker-whatsapp-sticker-send-now" type="button" data-send-sticker-area="${area}">Sticker sofort senden</button>`
      : "";
    body.innerHTML = `<p class="liveticker-sticker-area-copy">${escapeHtml(contextCopy)}</p>${stickerCards(stickers, area, locked)}${sendButton}${statusHtml(area)}${deliveryError && state.deliveryId ? `<p class="liveticker-whatsapp-sticker-status" data-tone="error">${escapeHtml(deliveryError)}</p>` : ""}`;
  }

  function renderStickerAreas() {
    renderArea("action");
    renderArea("game");
    renderArea("general");
  }

  async function services() {
    return import("./liveticker-whatsapp-stickers.js?v=20260917-classic-action-stickers-r1");
  }

  async function refreshDeliveries() {
    try {
      const { loadWhatsappDeliveries } = await services();
      const result = await loadWhatsappDeliveries(eventId());
      deliveries = Array.isArray(result?.deliveries) ? result.deliveries : [];
      deliveryError = "";
    } catch (error) {
      deliveryError = error?.message || "Versandstatus konnte nicht geladen werden.";
    }
    renderStickerAreas();
  }

  async function sendSticker(area) {
    const state = areas[area];
    if (!state?.selectedStickerId || state.deliveryId || state.busy) return;
    state.busy = true;
    state.requestError = "";
    renderArea(area);
    try {
      const { createWhatsappStickerOnlyRequest } = await services();
      state.request ||= createWhatsappStickerOnlyRequest({
        eventId: eventId(),
        stickerId: state.selectedStickerId,
        linkedActionId: null
      });
      const result = await state.request.send();
      if (!result?.delivery?.id) throw new Error("Der Sticker-Versandauftrag konnte nicht bestätigt werden.");
      state.deliveryId = result.delivery.id;
      if (result?.delivery) deliveries = [result.delivery, ...deliveries.filter(item => item.id !== result.delivery.id)];
      await refreshDeliveries();
    } catch (error) {
      state.requestError = error?.message || "Sticker konnte nicht gesendet werden.";
    } finally {
      state.busy = false;
      renderArea(area);
    }
  }

  async function retryDelivery(area) {
    const state = areas[area];
    const delivery = deliveryFor(area);
    if (!delivery || delivery.stickerStatus !== "FAILED" || state.busy) return;
    state.busy = true;
    renderArea(area);
    try {
      const { retryWhatsappDelivery } = await services();
      const result = await retryWhatsappDelivery({ eventId: eventId(), jobId: delivery.id });
      if (result?.delivery) deliveries = [result.delivery, ...deliveries.filter(item => item.id !== result.delivery.id)];
      deliveryError = "";
    } catch (error) {
      deliveryError = error?.message || "Der manuelle Versandversuch konnte nicht gestartet werden.";
    } finally {
      state.busy = false;
      await refreshDeliveries();
    }
  }

  async function flushPendingLinks() {
    if (!pendingLinks.size || linkingPending) return;
    linkingPending = true;
    try {
      const { linkWhatsappStickerDelivery } = await services();
      for (const [actionId, jobId] of [...pendingLinks.entries()]) {
        try {
          const result = await linkWhatsappStickerDelivery({ jobId, actionId });
          if (result?.delivery) deliveries = [result.delivery, ...deliveries.filter(item => item.id !== result.delivery.id)];
          pendingLinks.delete(actionId);
        } catch (error) {
          console.warn("Sticker-Verknüpfung wird nach dem nächsten Sync erneut versucht.", error);
        }
      }
    } catch (error) {
      console.warn("Sticker-Verknüpfung wird nach dem nächsten Sync erneut versucht.", error);
    } finally {
      linkingPending = false;
    }
    renderStickerAreas();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    if (!button) return;
    const area = button.dataset.stickerAreaName;
    if (area && button.dataset.selectSticker) {
      const state = areas[area];
      let delivery = deliveryFor(area);
      const completed = delivery?.stickerStatus === "SENT" && (area !== "action" || state.linkedActionId);
      if (completed) {
        resetArea(area);
        delivery = null;
      }
      if (state.request || state.busy || delivery) return;
      state.selectedStickerId = button.dataset.selectSticker;
      renderArea(area);
      return;
    }
    if (button.dataset.sendStickerArea) { void sendSticker(button.dataset.sendStickerArea); return; }
    if (button.dataset.retryStickerRequest) { void sendSticker(button.dataset.retryStickerRequest); return; }
    if (button.dataset.retryStickerDelivery) { void retryDelivery(button.dataset.retryStickerDelivery); return; }
    if (button.dataset.clearStickerArea) { resetArea(button.dataset.clearStickerArea); renderArea(button.dataset.clearStickerArea); return; }
    if (button.matches(".add-penalty,.remove-penalty,[data-edit],#cancelEdit")) queueMicrotask(renderStickerAreas);
  });

  const form = document.querySelector("#tickerForm");
  form?.addEventListener("submit", event => {
    const state = areas.action;
    if (!state.request || state.deliveryId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const error = document.getElementById("formError");
    if (error) {
      error.textContent = state.busy
        ? "Bitte kurz warten, bis die Sticker-Anfrage bestätigt wurde."
        : "Die Sticker-Anfrage ist noch ungeklärt. Bitte dieselbe Anfrage sicher erneut senden.";
      error.hidden = false;
    }
  }, { capture: true });
  form?.addEventListener("change", event => {
    if (event.target.name === "action" || event.target.matches?.('#penaltyRows [data-field="team"]')) {
      if (!areas.action.request && !areas.action.deliveryId) areas.action.selectedStickerId = "";
      queueMicrotask(() => renderArea("action"));
    }
  });

  const editingBanner = document.getElementById("editingBanner");
  if (editingBanner) new MutationObserver(() => renderArea("action"))
    .observe(editingBanner, { attributes: true, attributeFilter: ["hidden"] });

  void services().then(async ({ loadWhatsappStickerLibrary }) => {
    stickerLibrary = activeWhatsappStickers(await loadWhatsappStickerLibrary({ includeInactive: false }));
    libraryError = "";
    renderStickerAreas();
    await refreshDeliveries();
  }).catch(error => {
    libraryError = error?.message || "Sticker konnten nicht geladen werden.";
    renderStickerAreas();
  });

  const poll = window.setInterval(async () => {
    await refreshDeliveries();
    await flushPendingLinks();
  }, 1000);
  window.addEventListener("pagehide", () => clearInterval(poll), { once: true });

  window.addEventListener("pd-liveticker-state-saved", event => {
    const state = event.detail?.state;
    if (!state || !Array.isArray(state.history)) return;

    const control = document.getElementById(CONTROL_ID);
    const output = document.getElementById("tickerOutput");
    const result = attachWhatsappPublishIntent({
      previousHistory,
      state,
      text: output?.value || "",
      enabled: control?.checked !== false
    });

    previousHistory = cleanHistory(state.history);
    const actionId = result.changedIds.length === 1 ? result.changedIds[0] : "";
    if (actionId && areas.action.deliveryId && !areas.action.linkedActionId) {
      areas.action.linkedActionId = actionId;
      pendingLinks.set(actionId, areas.action.deliveryId);
    }
    if (actionId) {
      if (!areas.action.deliveryId) resetArea("action");
      renderArea("action");
    }

    if (result.reason === "too_long") {
      setControlStatus("Text ist länger als 4.000 Zeichen · Aktion wird gespeichert, aber nicht automatisch gesendet.", "error");
    } else if (control?.checked === false) {
      setControlStatus("Automatisches Senden ist für neue Aktionen ausgeschaltet.", "ready");
    } else {
      setControlStatus("Neue Aktionen automatisch senden · Bearbeitungen werden nicht erneut veröffentlicht.", "ready");
    }
  });

  window.addEventListener("pd-liveticker-server-synced", () => { void flushPendingLinks(); });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  startBrowserIntegration();
}

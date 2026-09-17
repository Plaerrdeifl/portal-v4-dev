import {
  activeWhatsappStickers,
  classicActionWhatsappStickers,
  situationWhatsappStickers,
  whatsappStickerDeliveryStatus,
  whatsappTextDeliveryForAction,
  whatsappTextDeliveryStatus
} from "./liveticker-whatsapp-sticker-core.js?v=20260917-classic-situation-status-r1";

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const CONTROL_ID = "livetickerWhatsappPublish";
const STATUS_ID = "livetickerWhatsappPublishStatus";
const ACTION_STICKER_AREA_ID = "livetickerWhatsappActionStickers";
const WHATSAPP_PANEL_ID = "livetickerWhatsappPanel";
const SUBMIT_ROW_ID = "livetickerSubmitRow";
const TEXT_STATUS_ID = "livetickerTextDeliveryStatus";
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
    .liveticker-sticker-area{padding:9px}.liveticker-sticker-area h3{margin:0;font-size:.82rem}.liveticker-sticker-area-copy{margin:0;color:#526d86;font-size:.69rem;line-height:1.35}
    .liveticker-whatsapp-sticker-options{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(78px,92px);gap:7px;min-width:0;max-width:100%;overflow-x:auto;padding:2px 1px 5px;overscroll-behavior-inline:contain;scroll-snap-type:inline proximity}
    .liveticker-whatsapp-sticker-option{min-height:82px;padding:6px;border:1px solid #b9d7f5;border-radius:11px;background:#fff;display:grid;grid-template-rows:50px auto;gap:4px;place-items:center;color:#274760;font-size:.65rem;font-weight:900;text-align:center;line-height:1.05;scroll-snap-align:start}.liveticker-whatsapp-sticker-option[aria-pressed="true"]{border-color:#0d79e8;box-shadow:inset 0 0 0 2px rgba(13,121,232,.2);background:#f6fbff}.liveticker-whatsapp-sticker-option:disabled{opacity:.58}.liveticker-whatsapp-sticker-option img{display:block;width:50px;height:50px;object-fit:contain}.liveticker-whatsapp-sticker-empty{margin:0;color:#526d86;font-size:.68rem}.liveticker-whatsapp-sticker-send-now{min-height:42px;padding:7px 10px;border:1px solid #0d79e8;border-radius:10px;background:#0d79e8;color:#fff;font-size:.74rem;font-weight:950}.liveticker-whatsapp-sticker-send-now:disabled{opacity:.5}.liveticker-whatsapp-sticker-status{margin:0;padding:7px 9px;border-radius:10px;background:#f7faff;color:#526d86;font-size:.69rem;font-weight:850;line-height:1.35}.liveticker-whatsapp-sticker-status[data-tone="success"]{background:#eaf8f1;color:#087747}.liveticker-whatsapp-sticker-status[data-tone="pending"]{background:#fff8df;color:#725800}.liveticker-whatsapp-sticker-status[data-tone="error"]{background:#fff1f1;color:#a92932}.liveticker-whatsapp-sticker-actions{display:flex;gap:7px}.liveticker-whatsapp-sticker-actions button{flex:1}.liveticker-whatsapp-sticker-retry{min-height:40px;padding:7px 10px;border:1px solid #b9d7f5;border-radius:10px;background:#fff;color:#073c68;font-size:.72rem;font-weight:950}
  `;
  document.head.append(style);
}

function installControl() {
  const form = document.querySelector("#tickerForm");
  const submitRow = document.getElementById(SUBMIT_ROW_ID);
  if (!form || !submitRow || document.getElementById(CONTROL_ID)) return;

  installStyles();
  const actionGrid = form.querySelector(".action-grid");
  const actionPanel = document.createElement("section");
  actionPanel.id = ACTION_STICKER_AREA_ID;
  actionPanel.className = "liveticker-sticker-area";
  actionPanel.dataset.stickerArea = "action";
  actionPanel.innerHTML = '<h3>Aktionssticker</h3><div data-sticker-area-body><p class="liveticker-whatsapp-sticker-empty">Sticker werden geladen …</p></div>';
  actionGrid?.insertAdjacentElement("afterend", actionPanel);

  const panel = document.createElement("section");
  panel.id = WHATSAPP_PANEL_ID;
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
  form.insertBefore(panel, submitRow);
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
  let textActionId = "";
  let textRequestPending = false;
  let textStatusInitialized = false;
  let textRetryBusy = false;
  let transportRuntime = globalThis.PD_LIVETICKER_WHATSAPP_RUNTIME || { ready: false, wa: null, wpp: null };
  const pendingLinks = new Map();
  const areas = {
    action: { selectedStickerId: "", sourceAction: "", request: null, deliveryId: "", linkedActionId: "", requestError: "", busy: false }
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
  const transportReady = () => Boolean(transportRuntime?.ready);
  const transportMessage = () => {
    if (transportRuntime?.wa?.enabled === false) return "WA ist ausgeschaltet – Liveticker wird ohne WhatsApp gespeichert.";
    if (transportRuntime?.wa?.ready === false) return "WA ist nicht bereit – Liveticker wird ohne WhatsApp gespeichert.";
    if (transportRuntime?.wpp?.desiredConnected === false) return "WPP ist getrennt – Liveticker wird ohne WhatsApp gespeichert.";
    if (transportRuntime?.wpp?.ready === false) return "WPP ist nicht verbunden – Liveticker wird ohne WhatsApp gespeichert.";
    return "WhatsApp-Versand ist nicht bereit.";
  };

  function stickersForArea() {
    if (selectedAction() === "SITUATION") {
      return situationWhatsappStickers(stickerLibrary, { opponentTeamId: opponentTeamId() });
    }
    return classicActionWhatsappStickers(stickerLibrary, {
      action: selectedAction(),
      opponentTeamId: opponentTeamId(),
      penaltyTeams: penaltyTeams()
    });
  }

  function resetArea(area) {
    Object.assign(areas[area], {
      selectedStickerId: "",
      sourceAction: "",
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
      ? `<button class="liveticker-whatsapp-sticker-retry" type="button" data-retry-sticker-delivery="${area}"${state.busy || !transportReady() ? " disabled" : ""}>ERNEUT SENDEN</button>`
      : "";
    const clear = delivery.stickerStatus === "SENT" && (state.sourceAction === "SITUATION" || state.linkedActionId)
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
    const action = selectedAction();
    const heading = root.querySelector("h3");
    if (heading) heading.textContent = action === "SITUATION" ? "Situationssticker" : "Aktionssticker";
    if (action !== "SITUATION" && actionStickerBlockedByEdit()) {
      body.innerHTML = '<p class="liveticker-sticker-area-copy">Beim Bearbeiten einer bestehenden Aktion wird kein neuer WhatsApp-Sticker versendet.</p>';
      return;
    }
    const state = areas[area];
    const delivery = deliveryFor(area);
    const locked = Boolean(state.request || state.deliveryId || state.busy || !transportReady());
    const stickers = stickersForArea();
    const mixedPenalty = action === "PENALTY" && new Set(penaltyTeams()).size > 1;
    const contextCopy = action === "SITUATION"
      ? "Aktive Spiel-, Video- und allgemeine Sticker · immer separat ohne Liveticker-Aktion oder Text."
      : state.linkedActionId
        ? "Aktionssticker der zuletzt gespeicherten Aktion."
        : mixedPenalty
        ? "Für gemischte Strafen beider Teams ist kein eindeutiger Aktionssticker verfügbar."
        : "Passender Sticker zur gewählten Aktion · immer separat ohne Text.";
    const sendButton = state.selectedStickerId && !locked
      ? `<button class="liveticker-whatsapp-sticker-send-now" type="button" data-send-sticker-area="${area}">Sticker sofort senden</button>`
      : "";
    const transportCopy = transportReady() ? "" : `<p class="liveticker-whatsapp-sticker-status" data-tone="error">${escapeHtml(transportMessage())}</p>`;
    body.innerHTML = `<p class="liveticker-sticker-area-copy">${escapeHtml(contextCopy)}</p>${transportCopy}${stickerCards(stickers, area, locked)}${sendButton}${statusHtml(area)}${deliveryError && state.deliveryId ? `<p class="liveticker-whatsapp-sticker-status" data-tone="error">${escapeHtml(deliveryError)}</p>` : ""}`;
  }

  function renderStickerAreas() {
    renderArea("action");
  }

  async function services() {
    return import("./liveticker-whatsapp-stickers.js?v=20260917-classic-situation-status-r1");
  }

  function textDelivery() {
    return whatsappTextDeliveryForAction(deliveries, textActionId);
  }

  function renderTextDeliveryStatus() {
    const root = document.getElementById(TEXT_STATUS_ID);
    const label = root?.querySelector("[data-text-delivery-label]");
    const retry = root?.querySelector("[data-retry-text-delivery]");
    if (!root || !label || !retry) return;
    const delivery = textDelivery();
    if (!delivery && !textRequestPending) {
      root.hidden = true;
      label.textContent = "";
      retry.hidden = true;
      return;
    }
    const status = delivery
      ? whatsappTextDeliveryStatus(delivery)
      : { label: "WIRD GESENDET …", tone: "pending", retryable: false };
    root.hidden = false;
    root.dataset.tone = status.tone;
    label.textContent = `TEXT ${status.label}`;
    retry.hidden = !status.retryable;
    retry.disabled = textRetryBusy || !transportReady();
    if (delivery) textRequestPending = delivery.textStatus === "PENDING";
  }

  function resetTextDeliveryStatus() {
    textActionId = "";
    textRequestPending = false;
    textStatusInitialized = true;
    textRetryBusy = false;
    renderTextDeliveryStatus();
  }

  function syncActionModeUi() {
    const situation = selectedAction() === "SITUATION";
    const submitRow = document.getElementById(SUBMIT_ROW_ID);
    const whatsappPanel = document.getElementById(WHATSAPP_PANEL_ID);
    if (submitRow) submitRow.hidden = situation;
    if (whatsappPanel) whatsappPanel.hidden = situation;
  }

  async function refreshDeliveries() {
    try {
      const { loadWhatsappDeliveries } = await services();
      const result = await loadWhatsappDeliveries(eventId());
      deliveries = Array.isArray(result?.deliveries) ? result.deliveries : [];
      deliveryError = "";
      if (!textStatusInitialized) {
        const latestTextDelivery = deliveries.find(delivery => delivery.linkedActionId
          && String(delivery.textStatus || "").toUpperCase() !== "NOT_REQUESTED");
        textActionId = String(latestTextDelivery?.linkedActionId || "");
        textRequestPending = latestTextDelivery?.textStatus === "PENDING";
        textStatusInitialized = true;
      }
    } catch (error) {
      deliveryError = error?.message || "Versandstatus konnte nicht geladen werden.";
    }
    renderStickerAreas();
    renderTextDeliveryStatus();
  }

  async function sendSticker(area) {
    const state = areas[area];
    if (!transportReady() || !state?.selectedStickerId || state.deliveryId || state.busy) return;
    state.busy = true;
    state.requestError = "";
    renderArea(area);
    try {
      const { createWhatsappStickerOnlyRequest } = await services();
      state.sourceAction ||= selectedAction();
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

  async function retryTextDelivery() {
    const delivery = textDelivery();
    if (!transportReady() || !delivery || delivery.textStatus !== "FAILED" || textRetryBusy) return;
    textRetryBusy = true;
    renderTextDeliveryStatus();
    try {
      const { retryWhatsappDelivery } = await services();
      const result = await retryWhatsappDelivery({ eventId: eventId(), jobId: delivery.id });
      if (result?.delivery) deliveries = [result.delivery, ...deliveries.filter(item => item.id !== result.delivery.id)];
      deliveryError = "";
      textRequestPending = true;
    } catch (error) {
      deliveryError = error?.message || "Der manuelle Textversuch konnte nicht gestartet werden.";
    } finally {
      textRetryBusy = false;
      await refreshDeliveries();
    }
  }

  async function retryDelivery(area) {
    const state = areas[area];
    const delivery = deliveryFor(area);
    if (!transportReady() || !delivery || delivery.stickerStatus !== "FAILED" || state.busy) return;
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
      const completed = delivery?.stickerStatus === "SENT" && (state.sourceAction === "SITUATION" || state.linkedActionId);
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
    if (button.hasAttribute("data-retry-text-delivery")) { void retryTextDelivery(); return; }
    if (button.dataset.clearStickerArea) { resetArea(button.dataset.clearStickerArea); renderArea(button.dataset.clearStickerArea); return; }
    if (button.dataset.edit) {
      textActionId = button.dataset.edit;
      textRequestPending = false;
      textStatusInitialized = true;
      queueMicrotask(() => { renderStickerAreas(); renderTextDeliveryStatus(); });
      return;
    }
    if (button.matches(".add-penalty,.remove-penalty,#cancelEdit")) queueMicrotask(renderStickerAreas);
  });

  const form = document.querySelector("#tickerForm");
  form?.addEventListener("submit", event => {
    if (selectedAction() === "SITUATION") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
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
      if (event.target.name === "action") {
        resetTextDeliveryStatus();
        const situationDelivery = deliveryFor("action");
        if (areas.action.sourceAction === "SITUATION" && situationDelivery?.stickerStatus === "SENT") {
          resetArea("action");
        }
      }
      if (!areas.action.request && !areas.action.deliveryId) areas.action.selectedStickerId = "";
      queueMicrotask(() => { syncActionModeUi(); renderArea("action"); });
    }
  });

  const editingBanner = document.getElementById("editingBanner");
  if (editingBanner) new MutationObserver(() => renderArea("action"))
    .observe(editingBanner, { attributes: true, attributeFilter: ["hidden"] });

  window.addEventListener("pd-liveticker-whatsapp-runtime", event => {
    transportRuntime = event.detail || { ready: false, wa: null, wpp: null };
    const control = document.getElementById(CONTROL_ID);
    if (control) control.disabled = !transportReady();
    if (!transportReady()) setControlStatus(transportMessage(), "error");
    else setControlStatus("Neue Aktionen automatisch senden · Bearbeitungen werden nicht erneut veröffentlicht.", "ready");
    renderStickerAreas();
    renderTextDeliveryStatus();
  });
  const initialControl = document.getElementById(CONTROL_ID);
  if (initialControl) initialControl.disabled = !transportReady();
  if (!transportReady()) setControlStatus(transportMessage(), "error");

  void services().then(async ({ loadWhatsappStickerLibrary }) => {
    stickerLibrary = activeWhatsappStickers(await loadWhatsappStickerLibrary({ includeInactive: false }));
    libraryError = "";
    renderStickerAreas();
    await refreshDeliveries();
  }).catch(error => {
    libraryError = error?.message || "Sticker konnten nicht geladen werden.";
    renderStickerAreas();
  });
  syncActionModeUi();

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
      enabled: control?.checked !== false && transportReady()
    });

    previousHistory = cleanHistory(state.history);
    const actionId = result.changedIds.length === 1 ? result.changedIds[0] : "";
    if (result.attached && actionId) {
      textActionId = actionId;
      textRequestPending = true;
      textStatusInitialized = true;
      renderTextDeliveryStatus();
    }
    if (actionId && areas.action.sourceAction !== "SITUATION" && areas.action.deliveryId && !areas.action.linkedActionId) {
      areas.action.linkedActionId = actionId;
      pendingLinks.set(actionId, areas.action.deliveryId);
    }
    if (actionId) {
      if (!areas.action.deliveryId) resetArea("action");
      renderArea("action");
    }

    if (result.reason === "too_long") {
      setControlStatus("Text ist länger als 4.000 Zeichen · Aktion wird gespeichert, aber nicht automatisch gesendet.", "error");
    } else if (!transportReady()) {
      setControlStatus(transportMessage(), "error");
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

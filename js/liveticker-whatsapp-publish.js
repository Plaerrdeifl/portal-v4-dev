import { activeWhatsappStickers } from "./liveticker-whatsapp-sticker-core.js";

const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const CONTROL_ID = "livetickerWhatsappPublish";
const STATUS_ID = "livetickerWhatsappPublishStatus";
const STICKER_PICKER_ID = "livetickerWhatsappStickerPicker";
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

function resetStickerPicker() {
  const none = document.getElementById("livetickerWhatsappStickerNone");
  if (none instanceof HTMLInputElement) none.checked = true;
}

function installStyles() {
  if (document.querySelector("style[data-liveticker-whatsapp-publish]")) return;
  const style = document.createElement("style");
  style.dataset.livetickerWhatsappPublish = "true";
  style.textContent = `
    .liveticker-whatsapp-panel{display:grid;gap:10px;padding:10px 11px;border:1px solid #b9d7f5;border-radius:13px;background:#eef7ff;color:#073c68}
    .liveticker-whatsapp-publish{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;cursor:pointer}
    .liveticker-whatsapp-publish input{width:20px;height:20px;min-width:20px;margin:1px 0 0;accent-color:#0d79e8}
    .liveticker-whatsapp-publish-copy{display:grid;gap:2px;min-width:0}.liveticker-whatsapp-publish-copy strong{font-size:.79rem}.liveticker-whatsapp-publish-copy small{color:#526d86;font-size:.69rem;line-height:1.35}
    .liveticker-whatsapp-publish-copy small[data-state="error"]{color:#a92932;font-weight:850}
    .liveticker-whatsapp-stickers{display:grid;gap:6px;min-width:0;border:0;padding:0;margin:0}.liveticker-whatsapp-stickers>legend{padding:0;font-size:.72rem;font-weight:900}
    .liveticker-whatsapp-sticker-options{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(78px,92px);gap:7px;overflow-x:auto;padding:2px 1px 5px;overscroll-behavior-inline:contain;scroll-snap-type:inline proximity}
    .liveticker-whatsapp-sticker-option{position:relative;scroll-snap-align:start}.liveticker-whatsapp-sticker-option input{position:absolute;width:1px;height:1px;opacity:0}.liveticker-whatsapp-sticker-option label{min-height:82px;padding:6px;border:1px solid #b9d7f5;border-radius:11px;background:#fff;display:grid;grid-template-rows:50px auto;gap:4px;place-items:center;color:#274760;font-size:.65rem;font-weight:900;text-align:center;line-height:1.05;cursor:pointer}.liveticker-whatsapp-sticker-option input:checked+label{border-color:#0d79e8;box-shadow:inset 0 0 0 2px rgba(13,121,232,.18)}
    .liveticker-whatsapp-sticker-option img{display:block;width:50px;height:50px;object-fit:contain}.liveticker-whatsapp-sticker-none{font-size:1.35rem;color:#7890a5}.liveticker-whatsapp-stickers:disabled{opacity:.58}.liveticker-whatsapp-sticker-empty{margin:0;color:#526d86;font-size:.68rem}
  `;
  document.head.append(style);
}

function installControl() {
  const form = document.querySelector("#tickerForm");
  const submit = document.querySelector("#submitButton");
  if (!form || !submit || document.getElementById(CONTROL_ID)) return;

  installStyles();
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
  const picker = document.createElement("fieldset");
  picker.id = STICKER_PICKER_ID;
  picker.className = "liveticker-whatsapp-stickers";
  picker.innerHTML = '<legend>Optionaler Sticker</legend><p class="liveticker-whatsapp-sticker-empty">Sticker werden geladen …</p>';
  panel.append(picker);
  form.insertBefore(panel, submit);
  label.querySelector("input")?.addEventListener("change", event => {
    picker.disabled = event.currentTarget.checked === false;
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

async function loadStickerPicker() {
  const picker = document.getElementById(STICKER_PICKER_ID);
  if (!picker) return;
  try {
    const { loadWhatsappStickerLibrary } = await import("./liveticker-whatsapp-stickers.js?v=20260916-game-day-r1");
    const stickers = activeWhatsappStickers(await loadWhatsappStickerLibrary({ includeInactive: false }));
    picker.innerHTML = `
      <legend>Optionaler Sticker</legend>
      <div class="liveticker-whatsapp-sticker-options">
        <span class="liveticker-whatsapp-sticker-option">
          <input id="livetickerWhatsappStickerNone" name="livetickerWhatsappSticker" type="radio" value="" checked>
          <label for="livetickerWhatsappStickerNone"><span class="liveticker-whatsapp-sticker-none" aria-hidden="true">—</span><span>Kein Sticker</span></label>
        </span>
        ${stickers.map((sticker, index) => `
          <span class="liveticker-whatsapp-sticker-option">
            <input id="livetickerWhatsappSticker${index}" name="livetickerWhatsappSticker" type="radio" value="${escapeHtml(sticker.id)}">
            <label for="livetickerWhatsappSticker${index}">
              ${sticker.previewDataUrl ? `<img src="${escapeHtml(sticker.previewDataUrl)}" alt="">` : '<span class="liveticker-whatsapp-sticker-none" aria-hidden="true">🖼</span>'}
              <span>${escapeHtml(sticker.name)}</span>
            </label>
          </span>
        `).join("")}
      </div>
    `;
  } catch {
    picker.innerHTML = '<legend>Optionaler Sticker</legend><p class="liveticker-whatsapp-sticker-empty">Sticker konnten nicht geladen werden · Versand bleibt ohne Sticker möglich.</p>';
  }
}

function startBrowserIntegration() {
  installControl();
  void loadStickerPicker();
  let previousHistory = readStoredHistory();

  window.addEventListener("pd-liveticker-state-saved", event => {
    const state = event.detail?.state;
    if (!state || !Array.isArray(state.history)) return;

    const control = document.getElementById(CONTROL_ID);
    const output = document.getElementById("tickerOutput");
    const result = attachWhatsappPublishIntent({
      previousHistory,
      state,
      text: output?.value || "",
      enabled: control?.checked !== false,
      stickerId: document.querySelector('input[name="livetickerWhatsappSticker"]:checked')?.value || ""
    });

    previousHistory = cleanHistory(state.history);
    if (result.attached) resetStickerPicker();

    if (result.reason === "too_long") {
      setControlStatus("Text ist länger als 4.000 Zeichen · Aktion wird gespeichert, aber nicht automatisch gesendet.", "error");
    } else if (control?.checked === false) {
      setControlStatus("Automatisches Senden ist für neue Aktionen ausgeschaltet.", "ready");
    } else {
      setControlStatus("Neue Aktionen automatisch senden · Bearbeitungen werden nicht erneut veröffentlicht.", "ready");
    }
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  startBrowserIntegration();
}

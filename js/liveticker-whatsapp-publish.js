const STORAGE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const CONTROL_ID = "livetickerWhatsappPublish";
const STATUS_ID = "livetickerWhatsappPublishStatus";
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

export function attachWhatsappPublishIntent({ previousHistory, state, text, enabled = true }) {
  const currentHistory = Array.isArray(state?.history) ? state.history : [];
  const changedIds = changedWhatsappActionIds(previousHistory, currentHistory);
  const message = String(text ?? "");

  if (!enabled) return { attached: false, reason: "disabled", changedIds };
  if (changedIds.length !== 1) return { attached: false, reason: "ambiguous", changedIds };
  if (!message.trim()) return { attached: false, reason: "empty", changedIds };
  if (message.length > MAX_MESSAGE_LENGTH) return { attached: false, reason: "too_long", changedIds };

  const target = currentHistory.find(item => item?.id === changedIds[0]);
  if (!target) return { attached: false, reason: "missing", changedIds };

  target._whatsapp = Object.freeze({ publish: true, text: message });
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
    .liveticker-whatsapp-publish{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;padding:10px 11px;border:1px solid #b9d7f5;border-radius:13px;background:#eef7ff;color:#073c68;cursor:pointer}
    .liveticker-whatsapp-publish input{width:20px;height:20px;min-width:20px;margin:1px 0 0;accent-color:#0d79e8}
    .liveticker-whatsapp-publish-copy{display:grid;gap:2px;min-width:0}.liveticker-whatsapp-publish-copy strong{font-size:.79rem}.liveticker-whatsapp-publish-copy small{color:#526d86;font-size:.69rem;line-height:1.35}
    .liveticker-whatsapp-publish-copy small[data-state="error"]{color:#a92932;font-weight:850}
  `;
  document.head.append(style);
}

function installControl() {
  const form = document.querySelector("#tickerForm");
  const submit = document.querySelector("#submitButton");
  if (!form || !submit || document.getElementById(CONTROL_ID)) return;

  installStyles();
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
  form.insertBefore(label, submit);
}

function startBrowserIntegration() {
  installControl();
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
      enabled: control?.checked !== false
    });

    previousHistory = cleanHistory(state.history);

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

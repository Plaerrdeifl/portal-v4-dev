import { auth } from "./auth.js";

export const M328_PENDING_ACTION_KEY = "pd:m328:pendingFanbusAction";
export const M328_REGISTRATION_FLOW_KEY = "pd:m328:registrationFlow";

const BUS_ORGA_CAPABILITIES = Object.freeze([
  "fanbus.manage",
  "fanbus.registrations.manage",
  "fanbus.operations.manage",
  "fanbus.payment_marker.manage"
]);

let observer = null;
let syncQueued = false;
let listenersBound = false;

export function hasM328BusOrgaAccess() {
  return BUS_ORGA_CAPABILITIES.some(code => auth.hasCapability(code));
}

export function m328FanbusRouteParams(hash = location.hash) {
  const raw = String(hash || "");
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

export function isM328BusOrgaContext(hash = location.hash) {
  const params = m328FanbusRouteParams(hash);
  return params.get("orga") === "1" || params.get("from") === "bus-orga";
}

function setRegistrationFlow(active) {
  try {
    if (active) sessionStorage.setItem(M328_REGISTRATION_FLOW_KEY, "1");
    else sessionStorage.removeItem(M328_REGISTRATION_FLOW_KEY);
  } catch {
    // Die Darstellungshilfe ist optional; die Fachlogik bleibt unverändert.
  }
}

export function isM328RegistrationFlow(hash = location.hash) {
  if (!isM328BusOrgaContext(hash)) return false;
  try {
    return sessionStorage.getItem(M328_REGISTRATION_FLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function queueM328FanbusAction(action, tripId = "") {
  const normalizedAction = String(action || "").trim();
  const payload = {
    action: normalizedAction,
    tripId: String(tripId || "").trim(),
    phase: "queued"
  };
  setRegistrationFlow(normalizedAction === "add-registration");
  sessionStorage.setItem(M328_PENDING_ACTION_KEY, JSON.stringify(payload));
}

function readPendingAction() {
  try {
    const raw = sessionStorage.getItem(M328_PENDING_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writePendingAction(payload) {
  try {
    sessionStorage.setItem(M328_PENDING_ACTION_KEY, JSON.stringify(payload));
  } catch {
    // Session-Hilfe ist optional; die Fachfunktionen bleiben unverändert erreichbar.
  }
}

function clearPendingAction() {
  try {
    sessionStorage.removeItem(M328_PENDING_ACTION_KEY);
  } catch {
    // Kein fachlicher Zustand hängt am Browsermarker.
  }
}

function leaveRegistrationFlow() {
  clearPendingAction();
  setRegistrationFlow(false);
  location.hash = "#/bus-orga";
}

function ensureStyle() {
  if (document.getElementById("m328BusOrgaSeparationStyle")) return;
  const style = document.createElement("style");
  style.id = "m328BusOrgaSeparationStyle";
  style.textContent = `
    #m310FanbusPage:not([data-m328-orga-context="true"]) #m310AddTripButton,
    #m310FanbusPage:not([data-m328-orga-context="true"]) #m326RegularRidersButton,
    #m310FanbusPage:not([data-m328-orga-context="true"]) #m326PersonGroupsButton,
    #m310FanbusPage:not([data-m328-orga-context="true"]) #m310FanbusSettingsButton,
    #m310FanbusPage:not([data-m328-orga-context="true"]) .v4-m310-trip-nav,
    #m310FanbusPage:not([data-m328-orga-context="true"]) .v4-m310-more-actions {
      display:none !important;
    }

    .m328-bus-orga-entry {
      width:auto;
      min-height:38px;
      padding:7px 10px;
    }

    .m328-bus-orga-return {
      width:auto;
      min-height:36px;
      margin-bottom:8px;
      padding:6px 9px;
    }

    #v4Dialog.m328-registration-flow {
      width:min(100vw,760px);
      max-width:760px;
      height:100dvh;
      max-height:100dvh;
      margin:0 auto;
      padding:0;
      border:0;
      border-radius:0;
      background:var(--bg);
    }

    #v4Dialog.m328-registration-flow::backdrop {
      background:var(--bg);
    }

    #v4Dialog.m328-registration-flow .v4-dialog-shell {
      display:flex;
      flex-direction:column;
      width:100%;
      min-height:100%;
      max-height:100dvh;
      border:0;
      border-radius:0;
      box-shadow:none;
      background:var(--bg);
    }

    #v4Dialog.m328-registration-flow .v4-dialog-shell > header {
      position:sticky;
      top:0;
      z-index:2;
      gap:10px;
      padding:calc(12px + env(safe-area-inset-top)) 16px 12px;
      border-bottom:1px solid var(--line);
      background:var(--bg);
    }

    #v4Dialog.m328-registration-flow [data-v4-dialog-close] {
      width:auto;
      min-width:0;
      min-height:38px;
      padding:7px 10px;
      border:1px solid var(--line);
      border-radius:12px;
      font-size:.82rem;
      font-weight:800;
      white-space:nowrap;
    }

    #v4Dialog.m328-registration-flow #v4DialogBody {
      flex:1 1 auto;
      width:100%;
      max-width:720px;
      margin:0 auto;
      padding:16px 16px calc(24px + env(safe-area-inset-bottom));
      overflow:auto;
    }

    #v4Dialog.m328-registration-flow #v4DialogKicker {
      font-size:.7rem;
      font-weight:800;
      letter-spacing:.04em;
    }

    #v4Dialog.m328-registration-flow #v4DialogTitle {
      margin-top:2px;
      font-size:1.35rem;
      line-height:1.1;
    }

    #v4Dialog.m328-registration-flow .v4-m326-composer-actions {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
      margin-bottom:12px;
    }

    #v4Dialog.m328-registration-flow .v4-m326-composer-actions .button {
      width:100%;
      min-height:46px;
    }

    #v4Dialog.m328-registration-flow .m328-registration-intro {
      margin:0 0 12px;
      color:var(--muted);
      font-size:.82rem;
      line-height:1.4;
    }

    #v4Dialog.m328-registration-flow .v4-m326-person-filters {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px;
    }

    #v4Dialog.m328-registration-flow .v4-m326-person-filters .button {
      width:100%;
      min-height:42px;
      white-space:normal;
    }

    #v4Dialog.m328-registration-flow .dialog-actions {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
      width:100%;
    }

    #v4Dialog.m328-registration-flow .dialog-actions .button {
      width:100%;
    }

    @media(max-width:520px) {
      #v4Dialog.m328-registration-flow #v4DialogBody {
        padding-inline:12px;
      }

      #v4Dialog.m328-registration-flow .v4-m326-composer-actions,
      #v4Dialog.m328-registration-flow .v4-m326-person-filters {
        grid-template-columns:1fr 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensurePortalEntry(root) {
  const host = root?.querySelector(".m327-fanbus-user-actions");
  if (!host || !hasM328BusOrgaAccess()) return;
  let button = document.getElementById("m328BusOrgaEntry");
  if (!button) {
    button = document.createElement("button");
    button.id = "m328BusOrgaEntry";
    button.type = "button";
    button.className = "button small secondary m328-bus-orga-entry";
    button.textContent = "🚌 Bus-Orga";
    button.addEventListener("click", () => {
      clearPendingAction();
      setRegistrationFlow(false);
      location.hash = "#/bus-orga";
    });
    host.appendChild(button);
  }
}

function ensureOrgaReturn(root) {
  const orgaContext = isM328BusOrgaContext();
  let button = root?.querySelector("[data-m328-return]");
  if (!orgaContext) {
    button?.remove();
    return;
  }

  if (isM328RegistrationFlow()) {
    button?.remove();
    return;
  }

  if (button) return;
  const heading = root?.querySelector(".v4-m310-heading-copy");
  if (!heading) return;
  button = document.createElement("button");
  button.type = "button";
  button.className = "button small ghost m328-bus-orga-return";
  button.dataset.m328Return = "";
  button.textContent = "← Bus-Orga";
  button.addEventListener("click", () => {
    clearPendingAction();
    setRegistrationFlow(false);
    location.hash = "#/bus-orga";
  });
  heading.prepend(button);
}

function registrationDialog() {
  const dialog = document.getElementById("v4Dialog");
  return dialog?.open ? dialog : null;
}

function bindRegistrationDialog(dialog) {
  if (!dialog || dialog.dataset.m328RegistrationBound === "true") return;
  dialog.dataset.m328RegistrationBound = "true";
  dialog.addEventListener("v4dialogclose", () => {
    if (!isM328RegistrationFlow()) return;
    const composerWasClosing = Boolean(dialog.querySelector("#m326ManualComposerForm"));
    if (!composerWasClosing) return;
    setTimeout(leaveRegistrationFlow, 0);
  });
}

function enhanceRegistrationDialog() {
  const dialog = registrationDialog();
  if (!dialog) return;
  bindRegistrationDialog(dialog);

  const active = isM328RegistrationFlow();
  dialog.classList.toggle("m328-registration-flow", active);
  if (!active) return;

  const close = dialog.querySelector("[data-v4-dialog-close]");
  if (close) {
    close.textContent = "← Zurück";
    close.setAttribute("aria-label", "Zurück");
  }

  const composer = dialog.querySelector("#m326ManualComposerForm");
  if (composer) {
    const title = dialog.querySelector("#v4DialogTitle");
    if (title) title.textContent = "Anmeldung";
    const addPerson = composer.querySelector("[data-m326-add-person]");
    const addGroup = composer.querySelector("[data-m326-add-group]");
    if (addPerson) addPerson.textContent = "Person auswählen";
    if (addGroup) addGroup.textContent = "Gruppe hinzufügen";
    if (!composer.querySelector(".m328-registration-intro")) {
      const intro = document.createElement("p");
      intro.className = "m328-registration-intro";
      intro.textContent = "Wähle Mitglieder, Portaluser, Stammfahrer oder Gäste aus. Mehrere Personen können gemeinsam angemeldet werden.";
      composer.prepend(intro);
    }
  }

  const personPicker = dialog.querySelector("[data-m326-person-form]");
  if (personPicker) {
    const title = dialog.querySelector("#v4DialogTitle");
    if (title) title.textContent = "Person auswählen";
  }
}

function visibleTripTrigger(tripId) {
  const escaped = CSS.escape(tripId);
  const candidates = [...document.querySelectorAll(`[data-m310-open-trip="${escaped}"]`)];
  return candidates.find(item => item.offsetParent !== null) || candidates[0] || null;
}

function runPendingAction(root) {
  if (!root || !isM328BusOrgaContext()) return;
  const pending = readPendingAction();
  if (!pending?.action) return;

  if (pending.action === "new-trip") {
    const addButton = document.getElementById("m310AddTripButton");
    if (!addButton) return;
    clearPendingAction();
    addButton.click();
    return;
  }

  if (!pending.tripId) {
    clearPendingAction();
    return;
  }

  if (pending.action === "add-registration" && pending.phase === "participants-opened") {
    const addRegistration = document.querySelector("[data-m310-add-registration]");
    if (!addRegistration) return;
    clearPendingAction();
    addRegistration.click();
    return;
  }

  const record = visibleTripTrigger(pending.tripId);
  if (!record) return;
  if (record.getAttribute("aria-expanded") !== "true") {
    record.click();
    if (pending.action === "trip") {
      clearPendingAction();
    }
    return;
  }

  const escaped = CSS.escape(pending.tripId);
  if (pending.action === "participants" || pending.action === "add-registration") {
    const button = root.querySelector(`[data-m310-participants="${escaped}"]`);
    if (!button) return;
    if (pending.action === "add-registration") {
      writePendingAction({ ...pending, phase: "participants-opened" });
    } else {
      clearPendingAction();
    }
    button.click();
    return;
  }

  if (pending.action === "occupancy") {
    const button = root.querySelector(`[data-m310-occupancy="${escaped}"]`);
    if (!button) return;
    clearPendingAction();
    button.click();
    return;
  }

  if (pending.action === "edit-trip") {
    const button = root.querySelector(`[data-m310-edit-mode="${escaped}"]`);
    if (!button) return;
    clearPendingAction();
    button.click();
    return;
  }

  clearPendingAction();
}

function sync() {
  const root = document.getElementById("m310FanbusPage");
  if (!root) {
    enhanceRegistrationDialog();
    return;
  }
  root.dataset.m328OrgaContext = isM328BusOrgaContext() ? "true" : "false";
  ensurePortalEntry(root);
  ensureOrgaReturn(root);
  runPendingAction(root);
  enhanceRegistrationDialog();
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
}

function bindGlobalListeners() {
  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener("hashchange", queueSync);
  document.addEventListener("click", event => {
    const back = event.target?.closest?.(
      "[data-m325-back],[data-m310-settings-back],[data-m326-back]"
    );
    if (!back || !isM328BusOrgaContext()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearPendingAction();
    setRegistrationFlow(false);
    location.hash = "#/bus-orga";
  }, true);
}

export function setupM328BusOrgaShell() {
  ensureStyle();
  bindGlobalListeners();
  if (!observer && document.body) {
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  sync();
}

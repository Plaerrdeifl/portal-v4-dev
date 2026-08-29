import { auth } from "./auth.js";

export const M328_PENDING_ACTION_KEY = "pd:m328:pendingFanbusAction";

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

export function queueM328FanbusAction(action, tripId = "") {
  const payload = {
    action: String(action || "").trim(),
    tripId: String(tripId || "").trim(),
    phase: "queued"
  };
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
    location.hash = "#/bus-orga";
  });
  heading.prepend(button);
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
  if (!root) return;
  root.dataset.m328OrgaContext = isM328BusOrgaContext() ? "true" : "false";
  ensurePortalEntry(root);
  ensureOrgaReturn(root);
  runPendingAction(root);
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
    location.hash = "#/bus-orga";
  }, true);
}

export function setupM328BusOrgaShell() {
  ensureStyle();
  bindGlobalListeners();
  if (!observer && document.body) {
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  sync();
}

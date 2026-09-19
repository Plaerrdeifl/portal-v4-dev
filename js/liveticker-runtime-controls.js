import { api } from "./api.js";
import { wppTogglePresentation } from "./liveticker-wpp-state.js?v=20260919-wpp-toggle-r1";

const WA_WORKER_CODE = "LIVETICKER_WHATSAPP";
const REFRESH_MS = 5000;
const TRANSITION_REFRESH_MS = 1000;
const STATUS_FAILURE_THRESHOLD = 3;

const wa = {
  control: document.getElementById("whatsappWorkerControl"),
  status: document.getElementById("whatsappWorkerStatus"),
  dot: document.getElementById("whatsappWorkerDot"),
  toggle: document.getElementById("whatsappWorkerToggle"),
  hint: document.getElementById("whatsappWorkerHint")
};
const wpp = {
  control: document.getElementById("wppControl"),
  status: document.getElementById("wppStatus"),
  dot: document.getElementById("wppDot"),
  toggle: document.getElementById("wppToggle"),
  hint: document.getElementById("wppHint")
};

let waRuntime = { enabled: false, ready: false, state: "UNREACHABLE" };
let wppRuntime = { desiredConnected: true, ready: false, state: "UNREACHABLE", error: null };
let waBusy = false;
let wppBusy = false;
let refreshTimer = 0;
let waStatusFailures = 0;
let wppStatusFailures = 0;

function workerLabel(state) {
  if (state === "ACTIVE") return "AKTIV";
  if (state === "STARTING") return "STARTET …";
  if (state === "DISABLED") return "AUS";
  return "FEHLER";
}

function wppLabel(state) {
  if (state === "CONNECTED") return "VERBUNDEN";
  if (state === "CONNECTING") return "VERBINDET …";
  if (state === "DISCONNECTING") return "TRENNT …";
  if (state === "DISCONNECTED") return "GETRENNT";
  if (state === "ERROR") return "FEHLER";
  return "NICHT ERREICHBAR";
}


function setDot(node, state, activeStates) {
  if (!node) return;
  node.classList.toggle("active", activeStates.includes(state));
  node.classList.toggle("starting", state === "STARTING" || state === "CONNECTING" || state === "DISCONNECTING");
  node.classList.toggle("error", state === "UNREACHABLE" || state === "ERROR");
}

function transportSnapshot() {
  return Object.freeze({
    ready: Boolean(waRuntime?.ready && wppRuntime?.ready),
    wa: waRuntime,
    wpp: wppRuntime
  });
}

function publishSnapshot() {
  const snapshot = transportSnapshot();
  globalThis.PD_LIVETICKER_WHATSAPP_RUNTIME = snapshot;
  window.dispatchEvent(new CustomEvent("pd-liveticker-whatsapp-runtime", { detail: snapshot }));
}

function render() {
  const waState = String(waRuntime?.state || "UNREACHABLE");
  const wppState = String(wppRuntime?.state || "UNREACHABLE");

  if (wa.status) wa.status.textContent = workerLabel(waState);
  setDot(wa.dot, waState, ["ACTIVE"]);
  if (wa.toggle) {
    wa.toggle.disabled = waBusy;
    wa.toggle.textContent = waBusy ? "Speichert …" : waRuntime?.enabled ? "Ausschalten" : "Einschalten";
  }
  if (wa.hint) {
    wa.hint.textContent = waRuntime?.ready
      ? "WhatsApp-Worker aktiv – neue Aufträge werden verarbeitet."
      : waRuntime?.enabled
        ? "WhatsApp-Worker wird aktiviert. Versand bleibt bis zum Heartbeat gesperrt."
        : "WhatsApp-Worker pausiert – neue Nachrichten werden nicht eingereiht.";
  }

  if (wpp.status) wpp.status.textContent = wppLabel(wppState);
  setDot(wpp.dot, wppState, ["CONNECTED"]);
  if (wpp.toggle) {
    const presentation = wppTogglePresentation(wppRuntime, wppBusy);
    wpp.toggle.disabled = presentation.disabled;
    wpp.toggle.textContent = presentation.label;
  }
  if (wpp.hint) {
    if (wppRuntime?.ready || wppState === "CONNECTED") {
      wpp.hint.textContent = "WPP-Session verbunden.";
    } else if (wppState === "CONNECTING") {
      wpp.hint.textContent = "WPP-Session wird verbunden.";
    } else if (wppState === "DISCONNECTING") {
      wpp.hint.textContent = "WPP-Session wird getrennt.";
    } else if (wppState === "DISCONNECTED") {
      wpp.hint.textContent = wppRuntime?.desiredConnected === false
        ? "WPP-Session absichtlich getrennt."
        : "WPP-Session ist getrennt. Erneut verbinden möglich.";
    } else if (wppRuntime?.error) {
      wpp.hint.textContent = `WPP nicht bereit: ${wppRuntime.error}`;
    } else {
      wpp.hint.textContent = "WPP-Session ist nicht erreichbar. Erneut verbinden möglich.";
    }
  }

  publishSnapshot();
}

function transitionActive() {
  return ["CONNECTING", "DISCONNECTING"].includes(String(wppRuntime?.state || ""));
}

function scheduleRefresh(delay = transitionActive() ? TRANSITION_REFRESH_MS : REFRESH_MS) {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh(), delay);
}

function applyWaRefresh(result) {
  if (result.status === "fulfilled" && result.value) {
    waStatusFailures = 0;
    waRuntime = result.value;
    return;
  }
  waStatusFailures += 1;
  console.warn("WA runtime status refresh failed", result.reason);
  if (waStatusFailures >= STATUS_FAILURE_THRESHOLD) {
    waRuntime = { ...waRuntime, ready: false, state: "UNREACHABLE" };
  }
}

function applyWppRefresh(result) {
  if (result.status === "fulfilled" && result.value) {
    wppStatusFailures = 0;
    wppRuntime = result.value;
    return;
  }
  wppStatusFailures += 1;
  console.warn("WPP runtime status refresh failed", result.reason);
  if (wppStatusFailures >= STATUS_FAILURE_THRESHOLD) {
    wppRuntime = { ...wppRuntime, ready: false, state: "UNREACHABLE", error: result.reason?.message || "Status nicht verfügbar" };
  }
}

async function refresh() {
  if (waBusy || wppBusy) return scheduleRefresh(TRANSITION_REFRESH_MS);
  const [waResult, wppResult] = await Promise.allSettled([
    api.call("worker_runtime_status", { workerCode: WA_WORKER_CODE }),
    api.call("liveticker_wpp_runtime_status", {})
  ]);
  applyWaRefresh(waResult);
  applyWppRefresh(wppResult);
  render();
  scheduleRefresh();
}

async function toggleWa() {
  if (waBusy) return;
  waBusy = true;
  render();
  try {
    waRuntime = await api.call("worker_runtime_set", {
      workerCode: WA_WORKER_CODE,
      enabled: !Boolean(waRuntime?.enabled)
    });
  } catch (error) {
    waRuntime = { ...waRuntime, ready: false, state: "UNREACHABLE" };
    if (wa.hint) wa.hint.textContent = error?.message || "WA-Status konnte nicht geändert werden.";
  } finally {
    waBusy = false;
    render();
    scheduleRefresh(1200);
  }
}

async function toggleWpp() {
  if (wppBusy) return;
  const presentation = wppTogglePresentation(wppRuntime, false);
  if (presentation.disabled || typeof presentation.targetConnected !== "boolean") return;
  const targetConnected = presentation.targetConnected;
  const previous = wppRuntime;
  wppBusy = true;
  wppRuntime = {
    ...wppRuntime,
    desiredConnected: targetConnected,
    ready: false,
    state: targetConnected ? "CONNECTING" : "DISCONNECTING",
    error: null
  };
  render();
  try {
    wppRuntime = await api.call("liveticker_wpp_runtime_set", { connected: targetConnected });
    wppStatusFailures = 0;
  } catch (error) {
    wppRuntime = previous;
    if (wpp.hint) wpp.hint.textContent = error?.message || "WPP-Status konnte nicht geändert werden.";
  } finally {
    wppBusy = false;
    render();
    scheduleRefresh(250);
  }
}

wa.toggle?.addEventListener("click", () => void toggleWa());
wpp.toggle?.addEventListener("click", () => void toggleWpp());
window.addEventListener("pagehide", () => {
  if (refreshTimer) window.clearTimeout(refreshTimer);
}, { once: true });

render();
await refresh();

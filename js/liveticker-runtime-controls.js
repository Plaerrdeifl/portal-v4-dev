import { api } from "./api.js";

const WA_WORKER_CODE = "LIVETICKER_WHATSAPP";
const REFRESH_MS = 5000;

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
    wpp.toggle.disabled = wppBusy;
    wpp.toggle.textContent = wppBusy
      ? "Speichert …"
      : wppRuntime?.desiredConnected === false ? "Verbinden" : "Trennen";
  }
  if (wpp.hint) {
    wpp.hint.textContent = wppRuntime?.ready
      ? "WPP-Session verbunden."
      : wppRuntime?.desiredConnected === false
        ? "WPP-Session absichtlich getrennt."
        : wppRuntime?.error
          ? `WPP nicht bereit: ${wppRuntime.error}`
          : "WPP-Session wird verbunden oder ist nicht erreichbar.";
  }

  publishSnapshot();
}

function scheduleRefresh(delay = REFRESH_MS) {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refresh(), delay);
}

async function refresh() {
  if (waBusy || wppBusy) return scheduleRefresh(1500);
  try {
    const [waResult, wppResult] = await Promise.all([
      api.call("worker_runtime_status", { workerCode: WA_WORKER_CODE }),
      api.call("liveticker_wpp_runtime_status", {})
    ]);
    waRuntime = waResult || waRuntime;
    wppRuntime = wppResult || wppRuntime;
  } catch (error) {
    console.error("WhatsApp runtime status refresh failed", error);
    waRuntime = { ...waRuntime, ready: false, state: "UNREACHABLE" };
    wppRuntime = { ...wppRuntime, ready: false, state: "UNREACHABLE", error: error?.message || "Status nicht verfügbar" };
  }
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
  wppBusy = true;
  render();
  try {
    wppRuntime = await api.call("liveticker_wpp_runtime_set", {
      connected: wppRuntime?.desiredConnected === false
    });
  } catch (error) {
    wppRuntime = { ...wppRuntime, ready: false, state: "UNREACHABLE", error: error?.message || "WPP-Status konnte nicht geändert werden." };
  } finally {
    wppBusy = false;
    render();
    scheduleRefresh(1200);
  }
}

wa.toggle?.addEventListener("click", () => void toggleWa());
wpp.toggle?.addEventListener("click", () => void toggleWpp());
window.addEventListener("pagehide", () => {
  if (refreshTimer) window.clearTimeout(refreshTimer);
}, { once: true });

render();
await refresh();

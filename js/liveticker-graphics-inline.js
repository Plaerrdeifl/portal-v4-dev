import { api } from "./api.js";

const periodButton = document.getElementById("periodGraphicButton");
const finalButton = document.getElementById("finalGraphicButton");
const statusLine = document.getElementById("inlineGraphicStatus");

const STATUS_LABELS = Object.freeze({
  QUEUED: "Warteschlange",
  PROCESSING: "Wird erzeugt",
  SUCCEEDED: "Fertig",
  FAILED: "Fehlgeschlagen"
});

let currentGame = null;
let jobs = [];
let refreshTimer = 0;
let delayedRefreshTimer = 0;
let requestInFlight = false;
let enqueueInFlight = false;

function currentEventId() {
  return String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.eventId || "").trim();
}

function latestJob(kind) {
  return jobs.find(job => job?.kind === kind) || null;
}

function latestPeriodKind() {
  const minute = Number(currentGame?.minute || 0);
  if (minute >= 40) return "PERIOD_2";
  if (minute >= 20) return "PERIOD_1";
  return "";
}

function kindLabel(kind) {
  if (kind === "PERIOD_1") return "1. Drittel";
  if (kind === "PERIOD_2") return "2. Drittel";
  return "Endergebnis";
}

function jobStatus(job) {
  return job ? (STATUS_LABELS[job.status] || job.status || "Unbekannt") : "Noch nicht erzeugt";
}

function isActive(job) {
  return job?.status === "QUEUED" || job?.status === "PROCESSING";
}

function setButtonState(button, { ready, job, label }) {
  if (!button) return;
  const active = isActive(job);
  button.disabled = !ready || active || enqueueInFlight;
  button.classList.toggle("graphic-ready", ready && !active && !enqueueInFlight);
  button.dataset.graphicKind = label.kind || "";

  if (!ready) {
    button.textContent = label.unavailable;
    return;
  }
  if (job?.status === "QUEUED") {
    button.textContent = `${label.ready}: Warteschlange`;
    return;
  }
  if (job?.status === "PROCESSING") {
    button.textContent = `${label.ready}: Wird erzeugt …`;
    return;
  }
  if (job?.status === "SUCCEEDED") {
    button.textContent = `${label.ready}: Neu erzeugen`;
    return;
  }
  if (job?.status === "FAILED") {
    button.textContent = `${label.ready}: Erneut versuchen`;
    return;
  }
  button.textContent = label.ready;
}

function render() {
  if (!periodButton || !finalButton || !statusLine) return;

  const periodKind = latestPeriodKind();
  const periodJob = periodKind ? latestJob(periodKind) : null;
  const finalJob = latestJob("FINAL");
  const finalReady = Boolean(currentGame?.completedAt);

  setButtonState(periodButton, {
    ready: Boolean(periodKind),
    job: periodJob,
    label: {
      kind: periodKind,
      unavailable: "Zwischenstand-Grafik",
      ready: periodKind ? `Grafik ${kindLabel(periodKind)}` : "Zwischenstand-Grafik"
    }
  });

  setButtonState(finalButton, {
    ready: finalReady,
    job: finalJob,
    label: {
      kind: "FINAL",
      unavailable: "Endergebnis-Grafik",
      ready: "Endergebnis-Grafik"
    }
  });

  const periodText = periodKind
    ? `${kindLabel(periodKind)}: ${jobStatus(periodJob)}`
    : "Zwischenstand: ab Ende des 1. Drittels verfügbar";
  const finalText = finalReady
    ? `Endergebnis: ${jobStatus(finalJob)}`
    : "Endergebnis: nach Spielabschluss verfügbar";

  statusLine.textContent = `Grafiken · ${periodText} · ${finalText}`;
  statusLine.dataset.state = jobs.some(isActive) ? "active" : jobs.some(job => job?.status === "FAILED") ? "error" : "idle";
}

function clearRefreshTimer() {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = 0;
}

function scheduleActiveRefresh() {
  clearRefreshTimer();
  if (!jobs.some(isActive)) return;
  refreshTimer = window.setTimeout(() => refreshStatusOnly(), 2500);
}

async function refreshStatusOnly() {
  const eventId = currentEventId();
  if (!eventId || requestInFlight) return;
  requestInFlight = true;
  try {
    const snapshot = await api.call("liveticker_graphics_status", { eventId });
    jobs = Array.isArray(snapshot?.jobs) ? snapshot.jobs : [];
    render();
    scheduleActiveRefresh();
  } catch (error) {
    console.error("Liveticker graphics status refresh failed", error);
    if (statusLine) statusLine.textContent = `Grafiken · Status konnte nicht geladen werden: ${error?.message || "Unbekannter Fehler"}`;
  } finally {
    requestInFlight = false;
  }
}

async function refreshAll() {
  const eventId = currentEventId();
  clearRefreshTimer();
  if (!eventId || requestInFlight) {
    render();
    return;
  }

  requestInFlight = true;
  try {
    const [gamesSnapshot, statusSnapshot] = await Promise.all([
      api.call("liveticker_graphics_games"),
      api.call("liveticker_graphics_status", { eventId })
    ]);
    const games = Array.isArray(gamesSnapshot?.games) ? gamesSnapshot.games : [];
    currentGame = games.find(game => game?.eventId === eventId) || null;
    jobs = Array.isArray(statusSnapshot?.jobs) ? statusSnapshot.jobs : [];
    render();
    scheduleActiveRefresh();
  } catch (error) {
    console.error("Liveticker graphics inline load failed", error);
    if (statusLine) statusLine.textContent = `Grafiken · Status konnte nicht geladen werden: ${error?.message || "Unbekannter Fehler"}`;
  } finally {
    requestInFlight = false;
  }
}

function scheduleFullRefresh(delay = 700) {
  if (delayedRefreshTimer) window.clearTimeout(delayedRefreshTimer);
  delayedRefreshTimer = window.setTimeout(() => {
    delayedRefreshTimer = 0;
    refreshAll();
  }, delay);
}

async function enqueue(kind) {
  const eventId = currentEventId();
  if (!eventId || !kind || enqueueInFlight) return;

  enqueueInFlight = true;
  render();
  try {
    await api.call("liveticker_graphics_enqueue", { eventId, kind });
    await refreshAll();
  } catch (error) {
    console.error("Liveticker graphic enqueue failed", error);
    if (statusLine) statusLine.textContent = `Grafik konnte nicht erzeugt werden: ${error?.message || "Unbekannter Fehler"}`;
  } finally {
    enqueueInFlight = false;
    render();
  }
}

periodButton?.addEventListener("click", () => enqueue(latestPeriodKind()));
finalButton?.addEventListener("click", () => enqueue("FINAL"));

window.addEventListener("pd-liveticker-state-saved", () => scheduleFullRefresh(900));
document.getElementById("finalSummaryButton")?.addEventListener("click", () => scheduleFullRefresh(1200));
document.getElementById("gameSelect")?.addEventListener("change", () => scheduleFullRefresh(500));
window.addEventListener("pagehide", () => {
  clearRefreshTimer();
  if (delayedRefreshTimer) window.clearTimeout(delayedRefreshTimer);
});

render();
await refreshAll();

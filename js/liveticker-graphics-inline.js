import { api } from "./api.js";

const BUTTONS = Object.freeze({
  PERIOD_1: document.getElementById("period1OutputButton"),
  PERIOD_2: document.getElementById("period2OutputButton"),
  FINAL: document.getElementById("finalOutputButton")
});
const statusLine = document.getElementById("inlineGraphicStatus");
const artifactsBox = document.getElementById("inlineGraphicArtifacts");
const resultPanel = document.getElementById("graphicsResultPanel");
const resultTitle = document.getElementById("graphicsResultTitle");
const closeResults = document.getElementById("closeGraphicsResults");
const primaryOutputWrap = document.getElementById("primaryOutputWrap");
const primaryOutputButton = document.getElementById("primaryOutputButton");
const resultGenerateButton = document.getElementById("resultGenerateButton");
const outputStatusButtons = [...document.querySelectorAll("[data-output-status]")];
const minuteInput = document.getElementById("gameMinute");
const workerControl = document.getElementById("graphicWorkerControl");
const workerStatusLine = document.getElementById("graphicWorkerStatus");
const workerDot = document.getElementById("graphicWorkerDot");
const workerToggle = document.getElementById("graphicWorkerToggle");
const workerHint = document.getElementById("graphicWorkerHint");
const WORKER_CODE = "LIVETICKER_GRAPHICS";

const STATUS_LABELS = Object.freeze({
  QUEUED: "Warteschlange",
  PROCESSING: "Wird erzeugt",
  SUCCEEDED: "Fertig",
  FAILED: "Fehlgeschlagen"
});

const KINDS = Object.freeze(["PERIOD_1", "PERIOD_2", "FINAL"]);
let jobs = [];
let refreshTimer = 0;
let delayedRefreshTimer = 0;
let requestInFlight = false;
let enqueueInFlight = "";
let workerRuntime = null;
let workerRequestInFlight = false;
let workerRefreshTimer = 0;
let selectedArtifactKind = "";
let resultsOpen = false;

function currentEventId() {
  return String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.eventId || "").trim();
}

function currentOutputKind() {
  const minute = Math.max(1, Number.parseInt(minuteInput?.value || "1", 10) || 1);
  if (minute <= 20) return "PERIOD_1";
  if (minute <= 40) return "PERIOD_2";
  return "FINAL";
}

function latestJob(kind) {
  return jobs.find(job => job?.kind === kind) || null;
}

function kindLabel(kind) {
  if (kind === "PERIOD_1") return "1. Drittel";
  if (kind === "PERIOD_2") return "2. Drittel";
  return "Endergebnis";
}

function buttonLabel(kind) {
  return kind === "FINAL" ? "Ende" : kindLabel(kind);
}

function jobStatus(job) {
  return job ? (STATUS_LABELS[job.status] || job.status || "Unbekannt") : "Noch nicht erzeugt";
}

function isActive(job) {
  return job?.status === "QUEUED" || job?.status === "PROCESSING";
}

function setButtonState(kind) {
  const button = BUTTONS[kind];
  if (!button) return;
  const job = latestJob(kind);
  const active = isActive(job);
  const ready = Boolean(currentEventId()) && Boolean(workerRuntime?.ready);
  const enqueueing = enqueueInFlight === kind;

  button.disabled = !ready || active || enqueueing;
  button.classList.toggle("graphic-ready", ready && !active && !enqueueing);
  button.dataset.graphicKind = kind;

  const base = buttonLabel(kind);
  if (!ready) {
    button.textContent = base;
  } else if (enqueueing || job?.status === "QUEUED") {
    button.textContent = `${base} · wartet`;
  } else if (job?.status === "PROCESSING") {
    button.textContent = `${base} · läuft …`;
  } else if (job?.status === "SUCCEEDED") {
    button.textContent = `${base} · neu`;
  } else if (job?.status === "FAILED") {
    button.textContent = `${base} · erneut`;
  } else {
    button.textContent = base;
  }
}

function validArtifactUrl(value, download = false) {
  if (typeof value !== "string") return false;
  const pattern = download
    ? /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}\/download$/
    : /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}$/;
  return pattern.test(value);
}

function artifactRowsFor(job) {
  const artifacts = Array.isArray(job?.result?.artifacts) ? job.result.artifacts : [];
  return artifacts.filter(item =>
    ["POST", "STORY"].includes(item?.kind)
    && validArtifactUrl(item?.shareUrl)
    && validArtifactUrl(item?.downloadUrl, true)
    && item.downloadUrl === `${item.shareUrl}/download`
  );
}

function renderArtifacts() {
  if (!artifactsBox) return;
  artifactsBox.replaceChildren();
  const kind = selectedArtifactKind || KINDS.find(item => latestJob(item)?.status === "SUCCEEDED") || "";
  const job = kind ? latestJob(kind) : null;

  if (job?.status === "SUCCEEDED") {
    for (const artifact of artifactRowsFor(job)) {
      const row = document.createElement("div");
      row.className = "graphic-artifact";

      const title = document.createElement("strong");
      title.textContent = artifact.kind;
      row.append(title);

      const actions = document.createElement("div");
      actions.className = "graphic-artifact-actions";

      const open = document.createElement("a");
      open.href = artifact.shareUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Öffnen";
      actions.append(open);

      const share = document.createElement("button");
      share.type = "button";
      share.dataset.shareUrl = artifact.shareUrl;
      share.dataset.shareTitle = `${kindLabel(kind)} · ${artifact.kind}`;
      share.textContent = "Teilen";
      actions.append(share);

      const download = document.createElement("a");
      download.href = artifact.downloadUrl;
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      download.textContent = "Download";
      actions.append(download);

      row.append(actions);
      artifactsBox.append(row);
    }
  }

  artifactsBox.hidden = !artifactsBox.childElementCount;
  if (resultTitle) resultTitle.textContent = kind ? `${kindLabel(kind)} · Ausgabe` : "Ausgabe";
  if (resultPanel) resultPanel.hidden = !resultsOpen;
}

function renderOutputStatus() {
  for (const button of outputStatusButtons) {
    const kind = button.dataset.outputStatus || "";
    const job = latestJob(kind);
    const active = isActive(job);
    const done = job?.status === "SUCCEEDED";
    const failed = job?.status === "FAILED";
    const short = kind === "FINAL" ? "Ende" : kindLabel(kind);
    button.textContent = `${short} ${done ? "✓" : active ? "…" : failed ? "!" : "—"}`;
    button.disabled = !(done || failed);
    button.classList.toggle("ready", done);
    button.classList.toggle("active", active);
  }
}

function renderPrimaryOutput() {
  if (!primaryOutputButton) return;
  const minute = Math.max(1, Number.parseInt(minuteInput?.value || "1", 10) || 1);
  const kind = currentOutputKind();
  const job = latestJob(kind);
  const active = isActive(job) || enqueueInFlight === kind;
  const ready = Boolean(currentEventId()) && Boolean(workerRuntime?.ready);
  const atOutputMoment = minute === 20 || minute === 40 || minute >= 60;
  if (primaryOutputWrap) primaryOutputWrap.hidden = !atOutputMoment;
  primaryOutputButton.disabled = !ready || active;
  if (active) primaryOutputButton.textContent = `🏁 ${kindLabel(kind)} wird erstellt …`;
  else primaryOutputButton.textContent = `🏁 ${kindLabel(kind)} ausgeben`;
}

function renderResultGenerate() {
  if (!resultGenerateButton) return;
  const kind = selectedArtifactKind || currentOutputKind();
  const job = latestJob(kind);
  const active = isActive(job) || enqueueInFlight === kind;
  resultGenerateButton.disabled = !Boolean(workerRuntime?.ready) || active;
  resultGenerateButton.textContent = active ? "Wird erstellt …" : job?.status === "FAILED" ? "Erneut erstellen" : "Neu erstellen";
  resultGenerateButton.dataset.graphicKind = kind;
}

function workerStateLabel(state) {
  if (state === "ACTIVE") return "AKTIV";
  if (state === "STARTING") return "WIRD AKTIVIERT …";
  if (state === "UNREACHABLE") return "NICHT ERREICHBAR";
  return "AUS";
}

function renderWorker() {
  if (!workerControl) return;
  const state = String(workerRuntime?.state || "UNREACHABLE");
  const enabled = Boolean(workerRuntime?.enabled);
  const ready = Boolean(workerRuntime?.ready);
  if (workerStatusLine) workerStatusLine.textContent = workerStateLabel(state);
  if (workerDot) {
    workerDot.classList.toggle("active", state === "ACTIVE");
    workerDot.classList.toggle("starting", state === "STARTING");
    workerDot.classList.toggle("error", state === "UNREACHABLE");
  }
  if (workerToggle) {
    workerToggle.disabled = workerRequestInFlight;
    workerToggle.textContent = workerRequestInFlight ? "Speichert …" : enabled ? "Ausschalten" : "Einschalten";
  }
  if (workerHint) {
    workerHint.textContent = ready
      ? "Worker aktiv – Grafiken werden spätestens nach wenigen Sekunden verarbeitet."
      : enabled
        ? "Worker wird aktiviert. Grafik-Erstellung ist bis zum nächsten Heartbeat gesperrt."
        : "Worker deaktiviert – Grafik-Erstellung derzeit nicht möglich.";
  }
  for (const kind of KINDS) setButtonState(kind);
  renderPrimaryOutput();
}

function clearWorkerRefreshTimer() {
  if (workerRefreshTimer) window.clearTimeout(workerRefreshTimer);
  workerRefreshTimer = 0;
}

function scheduleWorkerRefresh(delay = 5000) {
  clearWorkerRefreshTimer();
  workerRefreshTimer = window.setTimeout(() => refreshWorkerStatus(), delay);
}

async function refreshWorkerStatus() {
  if (workerRequestInFlight) return;
  try {
    workerRuntime = await api.call("worker_runtime_status", { workerCode: WORKER_CODE });
    renderWorker();
  } catch (error) {
    console.error("Liveticker worker status refresh failed", error);
    workerRuntime = { enabled: false, ready: false, state: "UNREACHABLE" };
    renderWorker();
  } finally {
    scheduleWorkerRefresh(workerRuntime?.enabled && !workerRuntime?.ready ? 2500 : 10000);
  }
}

async function toggleWorker() {
  if (workerRequestInFlight) return;
  workerRequestInFlight = true;
  renderWorker();
  try {
    workerRuntime = await api.call("worker_runtime_set", { workerCode: WORKER_CODE, enabled: !Boolean(workerRuntime?.enabled) });
    renderWorker();
    scheduleWorkerRefresh(workerRuntime?.enabled ? 1500 : 10000);
  } catch (error) {
    console.error("Liveticker worker toggle failed", error);
    if (workerHint) workerHint.textContent = error?.message || "Worker-Status konnte nicht geändert werden.";
  } finally {
    workerRequestInFlight = false;
    renderWorker();
  }
}

function render() {
  renderWorker();
  for (const kind of KINDS) setButtonState(kind);
  renderOutputStatus();
  renderPrimaryOutput();
  renderResultGenerate();
  if (statusLine) {
    const kind = selectedArtifactKind || currentOutputKind();
    const job = latestJob(kind);
    statusLine.textContent = `${kindLabel(kind)} · ${jobStatus(job)}`;
    statusLine.dataset.state = isActive(job) ? "active" : job?.status === "FAILED" ? "error" : "idle";
  }
  renderArtifacts();
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
    if (statusLine) {
      statusLine.textContent = `Grafiken · Status konnte nicht geladen werden: ${error?.message || "Unbekannter Fehler"}`;
      statusLine.dataset.state = "error";
    }
  } finally {
    requestInFlight = false;
  }
}

async function refreshAll() {
  clearRefreshTimer();
  await refreshStatusOnly();
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
  if (!eventId || !KINDS.includes(kind) || enqueueInFlight) return;

  enqueueInFlight = kind;
  selectedArtifactKind = kind;
  resultsOpen = true;
  render();
  try {
    await api.call("liveticker_graphics_enqueue", { eventId, kind });
    await refreshAll();
  } catch (error) {
    console.error("Liveticker graphic enqueue failed", error);
    if (statusLine) {
      statusLine.textContent = `${kindLabel(kind)} · Grafik konnte nicht erzeugt werden: ${error?.message || "Unbekannter Fehler"}`;
      statusLine.dataset.state = "error";
    }
  } finally {
    enqueueInFlight = "";
    render();
  }
}

artifactsBox?.addEventListener("click", async event => {
  const button = event.target?.closest?.("button[data-share-url]");
  if (!button) return;
  const url = button.dataset.shareUrl || "";
  const title = button.dataset.shareTitle || "Liveticker-Grafik";
  if (!validArtifactUrl(url)) return;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      button.textContent = "Link kopiert ✓";
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Liveticker graphic share failed", error);
  }
});

for (const kind of KINDS) {
  BUTTONS[kind]?.addEventListener("click", () => enqueue(kind));
}

primaryOutputButton?.addEventListener("click", () => {
  const kind = currentOutputKind();
  BUTTONS[kind]?.click();
});

outputStatusButtons.forEach(button => button.addEventListener("click", () => {
  const kind = button.dataset.outputStatus || "";
  if (latestJob(kind)?.status !== "SUCCEEDED") return;
  selectedArtifactKind = kind;
  resultsOpen = true;
  render();
}));

closeResults?.addEventListener("click", () => {
  resultsOpen = false;
  renderArtifacts();
});

resultGenerateButton?.addEventListener("click", () => {
  const kind = resultGenerateButton.dataset.graphicKind || selectedArtifactKind || currentOutputKind();
  BUTTONS[kind]?.click();
});

minuteInput?.addEventListener("input", renderPrimaryOutput);
minuteInput?.addEventListener("change", renderPrimaryOutput);
workerToggle?.addEventListener("click", toggleWorker);

window.addEventListener("pd-liveticker-state-saved", () => scheduleFullRefresh(900));
window.addEventListener("pagehide", () => {
  clearRefreshTimer();
  if (delayedRefreshTimer) window.clearTimeout(delayedRefreshTimer);
  clearWorkerRefreshTimer();
});

render();
await Promise.all([refreshWorkerStatus(), refreshAll()]);

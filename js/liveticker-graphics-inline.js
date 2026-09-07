import { api } from "./api.js";

const BUTTONS = Object.freeze({
  PERIOD_1: document.getElementById("period1OutputButton"),
  PERIOD_2: document.getElementById("period2OutputButton"),
  FINAL: document.getElementById("finalOutputButton")
});
const statusLine = document.getElementById("inlineGraphicStatus");
const artifactsBox = document.getElementById("inlineGraphicArtifacts");

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

function currentEventId() {
  return String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.eventId || "").trim();
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
  const ready = Boolean(currentEventId());
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

  for (const kind of KINDS) {
    const job = latestJob(kind);
    if (job?.status !== "SUCCEEDED") continue;
    for (const artifact of artifactRowsFor(job)) {
      const row = document.createElement("div");
      row.className = "graphic-artifact";

      const title = document.createElement("strong");
      title.textContent = `${kindLabel(kind)} · ${artifact.kind}`;
      row.append(title);

      const actions = document.createElement("div");
      actions.className = "graphic-artifact-actions";

      const open = document.createElement("a");
      open.href = artifact.shareUrl;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Öffnen";
      actions.append(open);

      const download = document.createElement("a");
      download.href = artifact.downloadUrl;
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      download.textContent = "Download";
      actions.append(download);

      const share = document.createElement("button");
      share.type = "button";
      share.dataset.shareUrl = artifact.shareUrl;
      share.dataset.shareTitle = `${kindLabel(kind)} · ${artifact.kind}`;
      share.textContent = "Teilen";
      actions.append(share);

      row.append(actions);
      artifactsBox.append(row);
    }
  }

  artifactsBox.hidden = !artifactsBox.childElementCount;
}

function render() {
  for (const kind of KINDS) setButtonState(kind);
  if (!statusLine) return;

  statusLine.textContent = `Grafiken · ${KINDS.map(kind => `${kindLabel(kind)}: ${jobStatus(latestJob(kind))}`).join(" · ")}`;
  statusLine.dataset.state = jobs.some(isActive)
    ? "active"
    : jobs.some(job => job?.status === "FAILED") ? "error" : "idle";
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

window.addEventListener("pd-liveticker-state-saved", () => scheduleFullRefresh(900));
window.addEventListener("pagehide", () => {
  clearRefreshTimer();
  if (delayedRefreshTimer) window.clearTimeout(delayedRefreshTimer);
});

render();
await refreshAll();

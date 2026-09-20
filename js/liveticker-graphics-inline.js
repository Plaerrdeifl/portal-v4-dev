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
const resultWhatsappButton = document.getElementById("resultWhatsappButton");
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
let summarySendInFlight = new Set();
let summaryTextByKind = new Map();
let summaryStatusByKind = new Map();
let summaryDeliveryTracking = new Map();
let summaryDeliveryPollTimers = new Map();
let summaryDeliveryCheckInFlight = new Set();
let pendingFinalizationJobId = "";
let momentPromptKind = "";
let seenMomentEventId = "";
let seenOutputMoments = new Set();

const SUMMARY_CAPTION_KEY = "plaerrdeifl.liveticker.summary-caption.v1";
const SUMMARY_SENT_KEY = "plaerrdeifl.liveticker.summary-sent.v1";
const SUMMARY_DELIVERY_KEY = "plaerrdeifl.liveticker.summary-delivery.v1";
const OUTPUT_MOMENT_KEY = "plaerrdeifl.liveticker.output-moment.v1";
const LEGACY_SUMMARY_PENDING_KEY = "plaerrdeifl.liveticker.summary-whatsapp.v1";
const OUTPUT_MOMENTS = Object.freeze({
  20: "PERIOD_1",
  40: "PERIOD_2",
  60: "FINAL"
});

function currentEventId() {
  return String(globalThis.PD_LIVETICKER_GAME_CONTEXT?.eventId || "").trim();
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function newRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function localSummaryKey(prefix, jobId, eventId = currentEventId()) {
  return `${prefix}:${eventId}:${jobId}`;
}

function saveSummaryCaption(jobId, text) {
  if (!validUuid(jobId) || !text) return;
  try { localStorage.setItem(localSummaryKey(SUMMARY_CAPTION_KEY, jobId), text); } catch {}
}

function loadSummaryCaption(jobId) {
  if (!validUuid(jobId)) return "";
  try { return String(localStorage.getItem(localSummaryKey(SUMMARY_CAPTION_KEY, jobId)) || "").trim(); } catch { return ""; }
}

function markSummarySent(jobId) {
  if (!validUuid(jobId)) return;
  try { localStorage.setItem(localSummaryKey(SUMMARY_SENT_KEY, jobId), "1"); } catch {}
}

function wasSummarySent(jobId) {
  if (!validUuid(jobId)) return false;
  try { return localStorage.getItem(localSummaryKey(SUMMARY_SENT_KEY, jobId)) === "1"; } catch { return false; }
}

function saveSummaryDelivery(jobId, deliveryId) {
  if (!validUuid(jobId) || !validUuid(deliveryId)) return;
  try { localStorage.setItem(localSummaryKey(SUMMARY_DELIVERY_KEY, jobId), deliveryId); } catch {}
}

function loadSummaryDelivery(jobId) {
  if (!validUuid(jobId)) return "";
  try {
    const deliveryId = String(localStorage.getItem(localSummaryKey(SUMMARY_DELIVERY_KEY, jobId)) || "").trim();
    return validUuid(deliveryId) ? deliveryId : "";
  } catch {
    return "";
  }
}

function clearSummaryDeliveryPoll(kind) {
  const timer = summaryDeliveryPollTimers.get(kind);
  if (timer) window.clearTimeout(timer);
  summaryDeliveryPollTimers.delete(kind);
}

function scheduleSummaryDeliveryPoll(kind, delay = 1000) {
  clearSummaryDeliveryPoll(kind);
  summaryDeliveryPollTimers.set(kind, window.setTimeout(() => {
    summaryDeliveryPollTimers.delete(kind);
    void refreshSummaryDeliveryStatus(kind);
  }, delay));
}

async function refreshSummaryDeliveryStatus(kind) {
  if (!KINDS.includes(kind) || summaryDeliveryCheckInFlight.has(kind)) return;
  const tracking = summaryDeliveryTracking.get(kind);
  if (!tracking?.graphicJobId || !tracking?.deliveryId) return;
  const eventId = currentEventId();
  if (!eventId) return;

  summaryDeliveryCheckInFlight.add(kind);
  try {
    const snapshot = await api.call("liveticker_whatsapp_deliveries_list", { eventId });
    const deliveries = Array.isArray(snapshot?.deliveries) ? snapshot.deliveries : [];
    const delivery = deliveries.find(item => String(item?.id || "") === tracking.deliveryId) || null;
    const status = String(delivery?.status || "").toUpperCase();

    if (status === "SUCCEEDED") {
      markSummarySent(tracking.graphicJobId);
      summarySendInFlight.delete(kind);
      clearSummaryDeliveryPoll(kind);
      summaryStatusByKind.set(kind, {
        state: "success",
        text: `✅ ${kindLabel(kind)} · POST + Text erfolgreich an WhatsApp gesendet.`
      });
      render();
      return;
    }

    if (status === "FAILED") {
      summarySendInFlight.delete(kind);
      clearSummaryDeliveryPoll(kind);
      summaryStatusByKind.set(kind, {
        state: "error",
        text: `${kindLabel(kind)} · WhatsApp-Versand fehlgeschlagen.`
      });
      render();
      return;
    }

    summarySendInFlight.add(kind);
    summaryStatusByKind.set(kind, {
      state: "active",
      text: `${kindLabel(kind)} · POST + Text werden an WhatsApp gesendet …`
    });
    render();
    scheduleSummaryDeliveryPoll(kind, 1000);
  } catch (error) {
    console.error("Liveticker summary WhatsApp status refresh failed", error);
    summaryStatusByKind.set(kind, {
      state: "active",
      text: `${kindLabel(kind)} · WhatsApp-Status wird geprüft …`
    });
    render();
    scheduleSummaryDeliveryPoll(kind, 2000);
  } finally {
    summaryDeliveryCheckInFlight.delete(kind);
  }
}

function trackSummaryDelivery(kind, graphicJobId, deliveryId) {
  if (!KINDS.includes(kind) || !validUuid(graphicJobId) || !validUuid(deliveryId)) return;
  summaryDeliveryTracking.set(kind, { graphicJobId, deliveryId });
  saveSummaryDelivery(graphicJobId, deliveryId);
  summarySendInFlight.add(kind);
  void refreshSummaryDeliveryStatus(kind);
}

function resumeSummaryDeliveryTracking() {
  for (const kind of KINDS) {
    const job = latestJob(kind);
    const graphicJobId = String(job?.jobId || "");
    if (!validUuid(graphicJobId)) continue;
    const deliveryId = loadSummaryDelivery(graphicJobId);
    if (!deliveryId) continue;
    const current = summaryDeliveryTracking.get(kind);
    if (current?.graphicJobId === graphicJobId && current?.deliveryId === deliveryId) continue;
    trackSummaryDelivery(kind, graphicJobId, deliveryId);
  }
}

function clearLegacyPendingSummary() {
  const eventId = currentEventId();
  if (!eventId) return;
  try { localStorage.removeItem(`${LEGACY_SUMMARY_PENDING_KEY}:${eventId}`); } catch {}
}

function outputMomentStorageKey(eventId = currentEventId()) {
  return `${OUTPUT_MOMENT_KEY}:${eventId}`;
}

function ensureOutputMomentState() {
  const eventId = currentEventId();
  if (eventId === seenMomentEventId) return;
  seenMomentEventId = eventId;
  momentPromptKind = "";
  seenOutputMoments = new Set();
  if (!eventId) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(outputMomentStorageKey(eventId)) || "[]");
    if (Array.isArray(parsed)) {
      for (const kind of parsed) if (KINDS.includes(kind)) seenOutputMoments.add(kind);
    }
  } catch {}
}

function persistOutputMoments() {
  if (!seenMomentEventId) return;
  try { localStorage.setItem(outputMomentStorageKey(seenMomentEventId), JSON.stringify([...seenOutputMoments])); } catch {}
}

function exactOutputMomentKind() {
  const minute = Math.max(1, Number.parseInt(minuteInput?.value || "1", 10) || 1);
  return OUTPUT_MOMENTS[minute] || "";
}

function syncOutputMomentPrompt() {
  ensureOutputMomentState();
  const kind = exactOutputMomentKind();
  if (!kind) {
    momentPromptKind = "";
    return "";
  }
  if (momentPromptKind === kind) return kind;
  if (seenOutputMoments.has(kind)) {
    momentPromptKind = "";
    return "";
  }
  seenOutputMoments.add(kind);
  persistOutputMoments();
  momentPromptKind = kind;
  return kind;
}

function postArtifactForJob(job) {
  return artifactRowsFor(job).find(item => item?.kind === "POST") || null;
}

function whatsappImageFilename(artifact, kind, jobId) {
  const raw = String(artifact?.filename || "").split(/[\\/]/).pop() || "";
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  if (/^[A-Za-z0-9._-]{1,96}[.]png$/i.test(cleaned)) return cleaned;
  return `liveticker_${String(kind || "summary").toLowerCase()}_${String(jobId || "").slice(0, 8)}.png`;
}

function summaryTextFromOutput(kind) {
  if (!KINDS.includes(kind)) return "";
  BUTTONS[kind]?.click();
  const text = String(document.getElementById("tickerOutput")?.value || "").trim();
  if (text) summaryTextByKind.set(kind, text);
  return text || summaryTextByKind.get(kind) || "";
}

function summaryStatus(kind) {
  return summaryStatusByKind.get(kind) || null;
}

async function sendSummaryToWhatsapp(kind) {
  if (!KINDS.includes(kind) || summarySendInFlight.has(kind)) return;
  const job = latestJob(kind);
  if (job?.status !== "SUCCEEDED") return;
  const post = postArtifactForJob(job);
  if (!post || !validArtifactUrl(post.downloadUrl, true)) return;

  const text = summaryTextFromOutput(kind) || loadSummaryCaption(job.jobId);
  if (!text || text.length > 4000) {
    summaryStatusByKind.set(kind, {
      state: "error",
      text: `${kindLabel(kind)} · Text fehlt – WhatsApp nicht gesendet.`
    });
    render();
    return;
  }

  summarySendInFlight.add(kind);
  summaryStatusByKind.set(kind, {
    state: "active",
    text: `${kindLabel(kind)} · POST + Text werden an WhatsApp übergeben …`
  });
  render();
  try {
    const queued = await api.call("liveticker_whatsapp_delivery_enqueue", {
      eventId: currentEventId(),
      deliveryMode: "IMAGE_WITH_CAPTION",
      idempotencyKey: newRequestId(),
      imageUrl: post.downloadUrl,
      imageFilename: whatsappImageFilename(post, kind, job.jobId),
      message: text
    });
    const deliveryId = String(queued?.delivery?.id || "");
    if (!validUuid(deliveryId)) throw new Error("WhatsApp-Delivery-ID fehlt.");
    saveSummaryCaption(job.jobId, text);
    trackSummaryDelivery(kind, job.jobId, deliveryId);
  } catch (error) {
    console.error("Liveticker summary WhatsApp enqueue failed", error);
    summaryStatusByKind.set(kind, {
      state: "error",
      text: `${kindLabel(kind)} · WhatsApp-Versand fehlgeschlagen: ${error?.message || "Unbekannter Fehler"}`
    });
  } finally {
    if (!summaryDeliveryTracking.has(kind)) summarySendInFlight.delete(kind);
    render();
  }
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

function syncPendingFinalization() {
  if (!pendingFinalizationJobId) return;
  const job = latestJob("FINAL");
  if (!job || String(job.jobId || "") !== pendingFinalizationJobId) return;
  if (job.status === "FAILED") {
    pendingFinalizationJobId = "";
    return;
  }
  if (job.status !== "SUCCEEDED") return;
  const eventId = currentEventId();
  const jobId = pendingFinalizationJobId;
  pendingFinalizationJobId = "";
  window.dispatchEvent(new CustomEvent("pd-liveticker-final-output-ready", {
    detail: { eventId, jobId, kind: "FINAL" }
  }));
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
  button.disabled = !Boolean(currentEventId());
  button.dataset.graphicKind = kind;
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

const NEXTCLOUD_PUBLIC_HOST = "cloud.plaerrdeifl.de";

function nextcloudShareToken(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== NEXTCLOUD_PUBLIC_HOST || url.port || url.search || url.hash) return "";
    const match = /^\/s\/([A-Za-z0-9]{8,128})(?:\/download)?\/?$/.exec(url.pathname);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function publicDavUrl(artifact) {
  const token = nextcloudShareToken(artifact?.shareUrl) || nextcloudShareToken(artifact?.downloadUrl);
  return token ? `https://${NEXTCLOUD_PUBLIC_HOST}/public.php/dav/files/${encodeURIComponent(token)}` : "";
}

function safeGraphicFilename(value, fallback) {
  const candidate = String(value || fallback)
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return candidate && /^[^<>:"|?*]+\.png$/i.test(candidate) ? candidate : fallback;
}

function contentDispositionFilename(value) {
  const header = String(value || "");
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]?.trim().replace(/^"|"$/g, "");
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* use plain filename */ }
  }
  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header);
  return String(plain?.[1] || plain?.[2] || "").trim();
}

async function fetchGraphicArtifact(artifact) {
  const url = publicDavUrl(artifact);
  if (!url) throw new Error("LIVETICKER_GRAPHIC_SHARE_INVALID");
  const response = await fetch(url, { method: "GET", credentials: "omit", redirect: "follow" });
  if (!response.ok) throw new Error("LIVETICKER_GRAPHIC_FETCH_FAILED");
  const contentType = String(response.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "image/png") throw new Error("LIVETICKER_GRAPHIC_TYPE_INVALID");
  const blob = await response.blob();
  if (blob.type && blob.type.toLowerCase() !== "image/png") throw new Error("LIVETICKER_GRAPHIC_BLOB_INVALID");
  const expectedBytes = Number(artifact?.bytes);
  if (Number.isFinite(expectedBytes) && expectedBytes > 0 && blob.size !== expectedBytes) throw new Error("LIVETICKER_GRAPHIC_SIZE_MISMATCH");
  const fallback = safeGraphicFilename(artifact?.filename, `${String(artifact?.kind || "graphic").toLowerCase()}.png`);
  return { blob, filename: safeGraphicFilename(contentDispositionFilename(response.headers.get("Content-Disposition")), fallback) };
}

const graphicArtifactCache = new Map();
const GRAPHIC_ARTIFACT_CACHE_LIMIT = 6;

function graphicArtifactCacheKey(artifact) {
  return JSON.stringify([artifact.downloadUrl, artifact.sha256, artifact.bytes]);
}

function graphicArtifactEntry(artifact) {
  return graphicArtifactCache.get(graphicArtifactCacheKey(artifact)) || null;
}

function cachedGraphicArtifact(artifact) {
  return graphicArtifactEntry(artifact)?.prepared || null;
}

function supportsNativeGraphicShare() {
  return typeof File === "function"
    && typeof navigator?.share === "function"
    && typeof navigator?.canShare === "function";
}

function prefetchGraphicArtifact(artifact) {
  const key = graphicArtifactCacheKey(artifact);
  const existing = graphicArtifactCache.get(key);
  if (existing) return existing;
  const entry = { prepared: null, pending: true, failed: false };
  graphicArtifactCache.set(key, entry);
  if (graphicArtifactCache.size > GRAPHIC_ARTIFACT_CACHE_LIMIT) {
    graphicArtifactCache.delete(graphicArtifactCache.keys().next().value);
  }
  // iOS file sharing must start from the original tap. Prepare the PNG before
  // enabling the button so navigator.share() can run synchronously on tap.
  void fetchGraphicArtifact(artifact).then(
    prepared => {
      entry.prepared = prepared;
      entry.pending = false;
      if (resultsOpen) renderArtifacts();
    },
    () => {
      entry.pending = false;
      entry.failed = true;
      if (resultsOpen) renderArtifacts();
    }
  );
  return entry;
}

function downloadGraphicArtifact(artifact) {
  if (!validArtifactUrl(artifact?.downloadUrl, true)) return "invalid";
  globalThis.location.assign(artifact.downloadUrl);
  return "downloaded";
}

function handleGraphicShareError(error, artifact) {
  if (error?.name === "AbortError") return "cancelled";
  return downloadGraphicArtifact(artifact);
}

function deliverGraphicArtifact(artifact, label) {
  const prepared = cachedGraphicArtifact(artifact);
  try {
    if (prepared && typeof File === "function" && typeof navigator?.share === "function" && typeof navigator?.canShare === "function") {
      const file = new File([prepared.blob], prepared.filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        // Start sharing in the original click stack, before any promise handling.
        return navigator.share({ files: [file], title: label }).then(
          () => "shared",
          error => handleGraphicShareError(error, artifact)
        );
      }
    }
  } catch (error) {
    return handleGraphicShareError(error, artifact);
  }
  return downloadGraphicArtifact(artifact);
}

function renderArtifacts() {
  if (!artifactsBox) return;
  artifactsBox.replaceChildren();
  const kind = selectedArtifactKind || KINDS.find(item => latestJob(item)?.status === "SUCCEEDED") || "";
  const job = kind ? latestJob(kind) : null;

  if (job?.status === "SUCCEEDED") {
    const artifacts = artifactRowsFor(job);
    for (const artifact of artifacts) {
      const entry = prefetchGraphicArtifact(artifact);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "graphic-artifact-button";
      button.dataset.graphicArtifact = artifact.kind;
      const baseLabel = artifact.kind === "POST" ? "Post" : "Story";
      const waitingForNativeShare = supportsNativeGraphicShare() && Boolean(entry?.pending) && !entry?.prepared && !entry?.failed;
      button.disabled = waitingForNativeShare;
      if (waitingForNativeShare) button.setAttribute("aria-busy", "true");
      button.textContent = waitingForNativeShare ? `${baseLabel} wird vorbereitet …` : baseLabel;
      button.addEventListener("click", () => {
        const label = `${kindLabel(kind)} · ${baseLabel}`;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = "Teilen …";
        const resetButton = () => {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.textContent = baseLabel;
        };
        Promise.resolve(deliverGraphicArtifact(artifact, label)).then(resetButton, resetButton);
      });
      artifactsBox.append(button);
    }
  }

  artifactsBox.hidden = !artifactsBox.childElementCount;
  if (resultTitle) resultTitle.textContent = kind ? `${kindLabel(kind)} · Ausgabe` : "Ausgabe";
  if (resultPanel) resultPanel.hidden = !resultsOpen;
}

function renderOutputStatus() {
  const hasEvent = Boolean(currentEventId());
  for (const button of outputStatusButtons) {
    const kind = button.dataset.outputStatus || "";
    const job = latestJob(kind);
    const active = isActive(job);
    const done = job?.status === "SUCCEEDED";
    const failed = job?.status === "FAILED";
    const short = kind === "FINAL" ? "Ende" : kindLabel(kind);
    button.textContent = `${short} ${done ? "✓" : active ? "…" : failed ? "!" : "—"}`;
    button.disabled = !hasEvent;
    button.classList.toggle("ready", done);
    button.classList.toggle("active", active);
  }
}

function renderPrimaryOutput() {
  if (!primaryOutputButton) return;
  const kind = syncOutputMomentPrompt();
  const visible = Boolean(kind) && !resultsOpen;
  if (primaryOutputWrap) primaryOutputWrap.hidden = !visible;
  primaryOutputButton.disabled = !visible;
  primaryOutputButton.dataset.graphicKind = kind;
  primaryOutputButton.textContent = visible
    ? `🏁 ${kindLabel(kind)} öffnen`
    : "🏁 Ausgabe öffnen";
}

function renderResultGenerate() {
  if (!resultGenerateButton) return;
  const kind = selectedArtifactKind || currentOutputKind();
  const job = latestJob(kind);
  const active = isActive(job) || enqueueInFlight === kind;
  resultGenerateButton.disabled = !Boolean(workerRuntime?.ready) || active;
  resultGenerateButton.textContent = active
    ? "Wird erstellt …"
    : job?.status === "FAILED"
      ? "Erneut erstellen"
      : "Neu erstellen";
  resultGenerateButton.dataset.graphicKind = kind;
}

function renderResultWhatsapp() {
  if (!resultWhatsappButton) return;
  const kind = selectedArtifactKind || currentOutputKind();
  const job = latestJob(kind);
  const post = job?.status === "SUCCEEDED" ? postArtifactForJob(job) : null;
  const sending = summarySendInFlight.has(kind);
  const sendable = Boolean(post) && validArtifactUrl(post?.downloadUrl, true);
  resultWhatsappButton.disabled = !sendable || sending;
  resultWhatsappButton.dataset.graphicKind = kind;
  if (sending) {
    resultWhatsappButton.textContent = "📲 Wird an WhatsApp übergeben …";
  } else if (!sendable) {
    resultWhatsappButton.textContent = "📲 Zuerst Flyer erstellen";
  } else {
    resultWhatsappButton.textContent = wasSummarySent(job.jobId)
      ? "📲 Erneut an WhatsApp senden"
      : "📲 An WhatsApp senden";
  }
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
    globalThis.PD_LIVETICKER_STATUS_POPOVERS?.close?.(workerControl);
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
  renderResultWhatsapp();
  if (statusLine) {
    const kind = selectedArtifactKind || currentOutputKind();
    const job = latestJob(kind);
    const notice = summaryStatus(kind);
    if (notice) {
      statusLine.textContent = notice.text;
      statusLine.dataset.state = notice.state === "error" ? "error" : notice.state === "active" ? "active" : notice.state === "success" ? "success" : "idle";
      statusLine.hidden = false;
    } else {
      statusLine.textContent = `${kindLabel(kind)} · ${jobStatus(job)}`;
      statusLine.dataset.state = isActive(job) ? "active" : job?.status === "FAILED" ? "error" : "idle";
      statusLine.hidden = job?.status === "SUCCEEDED";
    }
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
    syncPendingFinalization();
    resumeSummaryDeliveryTracking();
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

async function enqueue(kind, captionText = "") {
  const eventId = currentEventId();
  if (!eventId || !KINDS.includes(kind) || enqueueInFlight) return;

  enqueueInFlight = kind;
  selectedArtifactKind = kind;
  resultsOpen = true;
  summaryStatusByKind.set(kind, {
    state: "active",
    text: `${kindLabel(kind)} · Flyer wird neu erstellt …`
  });
  render();
  try {
    const queued = await api.call("liveticker_graphics_enqueue", { eventId, kind });
    const jobId = String(queued?.jobId || "");
    if (kind === "FINAL" && validUuid(jobId)) pendingFinalizationJobId = jobId;
    if (validUuid(jobId) && captionText) saveSummaryCaption(jobId, captionText);
    summaryStatusByKind.set(kind, {
      state: "active",
      text: `${kindLabel(kind)} · Flyer wird erstellt; WhatsApp-Versand erfolgt erst nach Klick.`
    });
    await refreshAll();
    syncPendingFinalization();
    const job = latestJob(kind);
    if (job?.status === "SUCCEEDED") {
      summaryStatusByKind.set(kind, {
        state: "success",
        text: `${kindLabel(kind)} · Flyer fertig. Jetzt an WhatsApp senden oder manuell teilen.`
      });
    }
  } catch (error) {
    console.error("Liveticker graphic enqueue failed", error);
    summaryStatusByKind.set(kind, {
      state: "error",
      text: `${kindLabel(kind)} · Grafik konnte nicht erzeugt werden: ${error?.message || "Unbekannter Fehler"}`
    });
  } finally {
    enqueueInFlight = "";
    render();
  }
}

function openResults(kind) {
  if (!KINDS.includes(kind)) return;
  selectedArtifactKind = kind;
  resultsOpen = true;
  render();
}


primaryOutputButton?.addEventListener("click", () => {
  const kind = momentPromptKind;
  if (!KINDS.includes(kind)) return;
  momentPromptKind = "";
  summaryTextFromOutput(kind);
  openResults(kind);
});

outputStatusButtons.forEach(button => button.addEventListener("click", () => {
  const kind = button.dataset.outputStatus || "";
  if (!KINDS.includes(kind)) return;
  summaryTextFromOutput(kind);
  openResults(kind);
}));

window.addEventListener("pd-liveticker-graphics-open", event => {
  const kind = String(event.detail?.kind || "");
  if (!KINDS.includes(kind)) return;
  summaryTextFromOutput(kind);
  openResults(kind);
});

window.addEventListener("pd-liveticker-summary-requested", event => {
  const kind = String(event.detail?.kind || "");
  const text = String(event.detail?.text || "").trim();
  if (!KINDS.includes(kind) || !text || text.length > 4000) return;
  summaryTextByKind.set(kind, text);
});

closeResults?.addEventListener("click", () => {
  resultsOpen = false;
  render();
});

resultGenerateButton?.addEventListener("click", () => {
  const kind = resultGenerateButton.dataset.graphicKind || selectedArtifactKind || currentOutputKind();
  if (!KINDS.includes(kind)) return;
  const text = summaryTextFromOutput(kind);
  summaryStatusByKind.delete(kind);
  void enqueue(kind, text);
});

resultWhatsappButton?.addEventListener("click", () => {
  const kind = resultWhatsappButton.dataset.graphicKind || selectedArtifactKind || currentOutputKind();
  void sendSummaryToWhatsapp(kind);
});

function handleMinuteDisplayChange() {
  syncOutputMomentPrompt();
  render();
  if (resultsOpen) void refreshStatusOnly();
}

minuteInput?.addEventListener("input", handleMinuteDisplayChange);
minuteInput?.addEventListener("change", handleMinuteDisplayChange);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refreshAll();
});
window.addEventListener("pageshow", () => void refreshAll());
workerToggle?.addEventListener("click", toggleWorker);

window.addEventListener("pd-liveticker-state-saved", () => scheduleFullRefresh(900));
window.addEventListener("pagehide", () => {
  clearRefreshTimer();
  if (delayedRefreshTimer) window.clearTimeout(delayedRefreshTimer);
  clearWorkerRefreshTimer();
  for (const kind of KINDS) clearSummaryDeliveryPoll(kind);
});

clearLegacyPendingSummary();
syncOutputMomentPrompt();
render();
await Promise.all([refreshWorkerStatus(), refreshAll()]);

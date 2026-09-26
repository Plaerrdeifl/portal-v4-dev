import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";
import {
  deliverWhatsappJob,
  failedComponentForJob,
  isNewsletterChatStoreError,
  linkedTextRemainingDelayMs,
  mergeSentRecords,
  normalizeSentRecord,
  sendWithNewsletterRecovery,
  sentRecordFromJob,
  WHATSAPP_DELIVERY_WINDOW_MS,
  WHATSAPP_SEND_BUDGET_MS
} from "./delivery.mjs";
import {
  createWppStateReconciler,
  normalizeWppSnapshot
} from "./wpp-runtime.mjs";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "LIVETICKER_WORKER_TOKEN_FILE",
  "WAHA_API_KEY",
  "WAHA_CHANNEL_ID"
];

const RECOVERY_INTERVAL_MS = Number.parseInt(process.env.RECOVERY_INTERVAL_MS || "120000", 10);
const EDGE_TIMEOUT_MS = Number.parseInt(process.env.EDGE_TIMEOUT_MS || "10000", 10);
const WAHA_TIMEOUT_MS = Number.parseInt(process.env.WAHA_TIMEOUT_MS || "10000", 10);
const MEDIA_TEXT_DELAY_MS = 2000;
const REALTIME_HEARTBEAT_MS = 20000;
const WPP_TRANSITION_CHECK_MS = 15000;
const REALTIME_TOPIC = "realtime:liveticker-whatsapp-jobs";
const WAHA_BASE_URL = String(process.env.WAHA_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const WAHA_SESSION = String(process.env.WAHA_SESSION || "Liveticker_Test");
const WPP_CONTROL_OWNER = !["0", "false", "no", "observer"].includes(
  String(process.env.WPP_CONTROL_OWNER || "true").trim().toLowerCase()
);
const JOURNAL_FILE = String(
  process.env.WHATSAPP_SENT_JOURNAL_FILE
  || "/srv/docker/liveticker/whatsapp-worker/sent-journal.json"
);

for (const name of REQUIRED_ENV) {
  if (!String(process.env[name] || "").trim()) throw new Error(`Missing required environment variable: ${name}`);
}

const SUPABASE_URL = String(process.env.SUPABASE_URL).replace(/\/$/, "");
const PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY);
const EXPECTED_PROJECT_REF = String(process.env.EXPECTED_SUPABASE_PROJECT_REF);
const WORKER_TOKEN_FILE = String(process.env.LIVETICKER_WORKER_TOKEN_FILE);
const WAHA_API_KEY = String(process.env.WAHA_API_KEY);
const WAHA_CHANNEL_ID = String(process.env.WAHA_CHANNEL_ID);
const EDGE_URL = String(
  process.env.WHATSAPP_WORKER_EDGE_URL
  || `${SUPABASE_URL}/functions/v1/liveticker-whatsapp-worker`
);

const supabase = new URL(SUPABASE_URL);
if (supabase.protocol !== "https:" || supabase.hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`) {
  throw new Error("SUPABASE_URL does not match EXPECTED_SUPABASE_PROJECT_REF");
}
if (!PUBLISHABLE_KEY.startsWith("sb_publishable_") && PUBLISHABLE_KEY.split(".").length !== 3) {
  throw new Error("SUPABASE_PUBLISHABLE_KEY is not a supported publishable/anon key");
}
if (!WAHA_CHANNEL_ID.endsWith("@newsletter")) throw new Error("WAHA_CHANNEL_ID must be a WhatsApp Channel id ending in @newsletter");
if (!Number.isInteger(RECOVERY_INTERVAL_MS) || RECOVERY_INTERVAL_MS < 60000 || RECOVERY_INTERVAL_MS > 300000) {
  throw new Error("RECOVERY_INTERVAL_MS must be between 60000 and 300000");
}
if (!Number.isInteger(EDGE_TIMEOUT_MS) || EDGE_TIMEOUT_MS < 1000) throw new Error("EDGE_TIMEOUT_MS must be at least 1000");
if (!Number.isInteger(WAHA_TIMEOUT_MS) || WAHA_TIMEOUT_MS < 1000) throw new Error("WAHA_TIMEOUT_MS must be at least 1000");

const WORKER_TOKEN = readSecret(WORKER_TOKEN_FILE, 32);
const sentJournal = loadSentJournal();

let draining = false;
let drainAgain = false;
let websocket = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let messageRef = 0;
let shuttingDown = false;
let recoveryTimer = null;
const scheduledWakeTimers = new Map();
let waking = false;
let wakeAgain = false;
let workerEnabled = true;
let wppDesiredConnected = true;
let wppState = "UNKNOWN";

function log(event, details = {}) {
  const safe = { ts: new Date().toISOString(), event, ...details };
  process.stdout.write(`${JSON.stringify(safe)}\n`);
}

function safeError(error) {
  const text = String(error?.message || error || "UNKNOWN_ERROR");
  return text.replace(/[\r\n\t]+/g, " ").slice(0, 800);
}

function readSecret(path, minimumBytes) {
  const value = readFileSync(path, "utf8").trim();
  if (Buffer.byteLength(value, "utf8") < minimumBytes || value.length > 2048) {
    throw new Error(`Invalid secret file: ${path}`);
  }
  return value;
}

function loadSentJournal() {
  try {
    const parsed = JSON.parse(readFileSync(JOURNAL_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
    return new Map(
      Object.entries(parsed)
        .filter(([, value]) => value && typeof value === "object")
        .slice(-1000)
    );
  } catch {
    return new Map();
  }
}

function persistSentJournal() {
  mkdirSync(dirname(JOURNAL_FILE), { recursive: true, mode: 0o700 });
  const temporary = `${JOURNAL_FILE}.tmp`;
  writeFileSync(
    temporary,
    `${JSON.stringify(Object.fromEntries(sentJournal), null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  renameSync(temporary, JOURNAL_FILE);
}

function rememberSent(jobId, record) {
  sentJournal.set(jobId, record);
  while (sentJournal.size > 1000) {
    sentJournal.delete(sentJournal.keys().next().value);
  }
  persistSentJournal();
}

function forgetSent(jobId) {
  if (!sentJournal.delete(jobId)) return;
  if (!sentJournal.size) {
    try { unlinkSync(JOURNAL_FILE); } catch {}
    return;
  }
  persistSentJournal();
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function edge(body, timeoutMs = EDGE_TIMEOUT_MS) {
  const response = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "X-Liveticker-Worker-Token": WORKER_TOKEN,
      "Content-Type": "application/json",
      "User-Agent": "Plaerrdeifl-Liveticker-WhatsApp-DEV-Worker/1"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(1, Math.min(EDGE_TIMEOUT_MS, Math.floor(timeoutMs))))
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload?.ok !== true || !payload?.data || typeof payload.data !== "object") {
    throw new Error(`Worker gateway failed (${response.status})`);
  }
  return payload.data;
}

async function wahaRequest(path, { method = "GET" } = {}) {
  const response = await fetch(`${WAHA_BASE_URL}${path}`, {
    method,
    headers: { "X-Api-Key": WAHA_API_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(Math.max(1000, Math.min(WAHA_TIMEOUT_MS, 5000)))
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    const detail = String(
      typeof data === "string" ? data : data?.message || data?.error || ""
    ).replace(/[\r\n\t]+/g, " ").slice(0, 300);
    const error = new Error(`WAHA ${method} ${path} failed (${response.status})${detail ? `: ${detail}` : ""}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function readWppSnapshot() {
  try {
    const session = await wahaRequest(`/api/sessions/${encodeURIComponent(WAHA_SESSION)}`);
    return normalizeWppSnapshot(session);
  } catch (error) {
    return {
      state: "ERROR",
      status: "UNKNOWN",
      engineState: "UNKNOWN",
      inconsistent: false,
      error: safeError(error)
    };
  }
}

async function performWppAction(action) {
  const endpoint = {
    start: "start",
    restart: "restart",
    stop: "stop"
  }[action];
  if (!endpoint) throw new Error(`Unsupported WPP control action: ${action}`);
  const path = `/api/sessions/${encodeURIComponent(WAHA_SESSION)}/${endpoint}`;
  await wahaRequest(path, { method: "POST" });
  log("wpp_control_action", {
    action: action === "start" ? "connect" : action === "stop" ? "disconnect" : "restart"
  });
}

const wppReconciler = createWppStateReconciler({
  readSnapshot: readWppSnapshot,
  performAction: performWppAction,
  onEvent: log
});

async function refreshRuntimeControl(reason = "timer") {
  const observed = await readWppSnapshot();
  wppState = observed.state;
  try {
    const control = await edge({ action: "control", wppState, wppError: observed.error });
    workerEnabled = control?.worker?.enabled !== false;
    const requestedConnected = control?.wpp?.desiredConnected !== false;
    wppDesiredConnected = WPP_CONTROL_OWNER ? requestedConnected : true;
    const reconciliation = WPP_CONTROL_OWNER
      ? await wppReconciler.reconcile(wppDesiredConnected, observed)
      : {
          snapshot: observed,
          changed: false,
          transitionPending: observed.state === "CONNECTING",
          error: observed.error
        };
    wppState = reconciliation.snapshot.state;
    if (WPP_CONTROL_OWNER && (
      reconciliation.changed
      || reconciliation.error
      || wppState !== observed.state
    )) {
      await edge({
        action: "control",
        wppState,
        wppError: reconciliation.error || reconciliation.snapshot.error || null
      });
    }
    if (reconciliation.transitionPending) {
      scheduleQueueWake("wpp_transition", WPP_TRANSITION_CHECK_MS);
    }
  } catch (error) {
    // Backward-compatible during rollout: the process stays up, but the claim
    // gateway will remain the final authority once runtime-control RPCs exist.
    log("runtime_control_error", { reason, error: safeError(error) });
  }
  return workerEnabled && wppDesiredConnected && wppState === "CONNECTED";
}

async function claimJob() {
  const result = await edge({ action: "claim" });
  if (result.claimed === false) return null;
  const job = result.job;
  if (result.claimed !== true || !job?.id || !Number.isInteger(job.attemptCount)) {
    throw new Error("Worker gateway returned an invalid claim");
  }
  return job;
}

async function resolveStickerAsset(stickerId, timeoutMs = EDGE_TIMEOUT_MS) {
  const asset = await edge({ action: "sticker", stickerId }, timeoutMs);
  if (asset?.found === false) return null;
  if (!asset?.id || asset.id !== stickerId) throw new Error("Worker gateway returned an invalid sticker asset");
  return asset;
}

function extractWahaMessageId(data) {
  return String(
    data?.id
    || data?.messageId
    || data?.key?.id
    || data?._data?.id?._serialized
    || ""
  ).trim();
}

async function sendTextToWaha(job, timeoutMs = WAHA_TIMEOUT_MS) {
  const response = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
    method: "POST",
    headers: {
      "X-Api-Key": WAHA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: WAHA_CHANNEL_ID,
      text: job.message
    }),
    signal: AbortSignal.timeout(Math.max(1, Math.min(WAHA_TIMEOUT_MS, Math.floor(timeoutMs))))
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(`WAHA sendText failed (${response.status}): ${data?.message || data?.error || "request failed"}`);
  return {
    messageId: extractWahaMessageId(data),
    sentAt: new Date().toISOString()
  };
}

async function sendStickerToWaha(asset, timeoutMs = WAHA_TIMEOUT_MS) {
  const response = await fetch(`${WAHA_BASE_URL}/api/sendSticker`, {
    method: "POST",
    headers: {
      "X-Api-Key": WAHA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: WAHA_CHANNEL_ID,
      file: {
        mimetype: asset.mimetype,
        filename: asset.filename,
        data: asset.data
      }
    }),
    signal: AbortSignal.timeout(Math.max(1, Math.min(WAHA_TIMEOUT_MS, Math.floor(timeoutMs))))
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(
      `WAHA sendSticker failed (${response.status}): ${
        data?.message || data?.error || "request failed"
      }`
    );
  }
  return {
    messageId: extractWahaMessageId(data),
    sentAt: new Date().toISOString()
  };
}

async function sendImageToWaha(job, timeoutMs = WAHA_TIMEOUT_MS) {
  const imageUrl = String(job?.imageUrl || "").trim();
  const imageFilename = String(job?.imageFilename || "").trim();
  if (!/^https:\/\/cloud[.]plaerrdeifl[.]de\/s\/[A-Za-z0-9]{8,128}\/download$/.test(imageUrl)
      || !/^[A-Za-z0-9._-]{1,96}[.]png$/.test(imageFilename)) {
    throw new Error("Invalid Liveticker image delivery");
  }
  const response = await fetch(`${WAHA_BASE_URL}/api/sendImage`, {
    method: "POST",
    headers: {
      "X-Api-Key": WAHA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: WAHA_SESSION,
      chatId: WAHA_CHANNEL_ID,
      file: {
        mimetype: "image/png",
        filename: imageFilename,
        url: imageUrl
      },
      caption: String(job?.message || "")
    }),
    signal: AbortSignal.timeout(Math.max(1, Math.min(WAHA_TIMEOUT_MS, Math.floor(timeoutMs))))
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(
      `WAHA sendImage failed (${response.status}): ${
        data?.message || data?.error || "request failed"
      }`
    );
  }
  return {
    messageId: extractWahaMessageId(data),
    sentAt: new Date().toISOString()
  };
}

async function resolveNewsletterChannel(timeoutMs) {
  const response = await fetch(
    `${WAHA_BASE_URL}/api/${encodeURIComponent(WAHA_SESSION)}/channels/${encodeURIComponent(WAHA_CHANNEL_ID)}`,
    {
      method: "GET",
      headers: { "X-Api-Key": WAHA_API_KEY },
      signal: AbortSignal.timeout(Math.max(1, Math.min(WAHA_TIMEOUT_MS, Math.floor(timeoutMs))))
    }
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`WPP newsletter resolve failed (${response.status})`);
  }
  await response.body?.cancel();
}

async function markRetrying(job, error, timeoutMs) {
  if (!isNewsletterChatStoreError(error)) return job.attemptCount;
  const result = await edge({
    action: "retrying",
    jobId: job.id,
    attemptCount: job.attemptCount
  }, timeoutMs);
  if (!Number.isInteger(result?.attemptCount) || result.attemptCount <= job.attemptCount) {
    throw new Error("Worker gateway returned an invalid retry state");
  }
  job.attemptCount = result.attemptCount;
  return job.attemptCount;
}

function sentComponents(record) {
  const normalized = normalizeSentRecord(record);
  return {
    sticker: normalized.media ? {
      messageId: normalized.media.messageId || "",
      sentAt: normalized.media.sentAt
    } : null,
    text: normalized.text ? {
      messageId: normalized.text.messageId || "",
      sentAt: normalized.text.sentAt
    } : null,
    image: normalized.image ? {
      messageId: normalized.image.messageId || "",
      sentAt: normalized.image.sentAt
    } : null
  };
}

function remainingUntil(deadlineAt) {
  return Math.max(1, deadlineAt - Date.now());
}

async function markComplete(job, record, deadlineAt) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await edge({
        action: "complete",
        jobId: job.id,
        attemptCount: job.attemptCount,
        wahaMessageId: record.messageId || null,
        sentAt: record.sentAt,
        components: sentComponents(record)
      }, remainingUntil(deadlineAt));
    } catch (error) {
      lastError = error;
      const delay = attempt * 250;
      if (attempt < 3 && Date.now() + delay < deadlineAt) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}

async function markFailed(job, error, record, deadlineAt) {
  let failedComponent = null;
  try {
    failedComponent = failedComponentForJob(job, record);
  } catch {}
  try {
    return await edge({
      action: "fail",
      jobId: job.id,
      attemptCount: job.attemptCount,
      error: safeError(error),
      failedComponent,
      components: sentComponents(record)
    }, remainingUntil(deadlineAt));
  } catch (failError) {
    log("job_fail_record_error", { jobId: job.id, error: safeError(failError) });
    return null;
  }
}

async function processJob(job) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + WHATSAPP_DELIVERY_WINDOW_MS;
  const sendDeadlineAt = startedAt + WHATSAPP_SEND_BUDGET_MS;
  log("job_claimed", { jobId: job.id, attempt: job.attemptCount });

  const recovered = sentJournal.has(job.id);
  let sentRecord = mergeSentRecords(
    sentJournal.get(job.id),
    sentRecordFromJob(job)
  );
  if (recovered) log("job_send_recovered", { jobId: job.id });

  const sendWithRecovery = send => sendWithNewsletterRecovery({
    send,
    remainingMs: () => sendDeadlineAt - Date.now(),
    resolveNewsletter: timeoutMs => resolveNewsletterChannel(timeoutMs),
    markRetrying: async error => {
      const timeoutMs = Math.max(1, Math.min(750, sendDeadlineAt - Date.now()));
      await markRetrying(job, error, timeoutMs);
      log("job_send_retrying", { jobId: job.id, attempt: job.attemptCount });
    }
  });

  try {
    if (!sentRecord.text) {
      const linkedTextDelayMs = linkedTextRemainingDelayMs(job, Date.now(), MEDIA_TEXT_DELAY_MS);
      if (linkedTextDelayMs > 0) {
        log("job_linked_text_delayed", { jobId: job.id, delayMs: linkedTextDelayMs });
        await new Promise(resolve => setTimeout(resolve, linkedTextDelayMs));
      }
    }
    const delivery = await deliverWhatsappJob({
      job,
      sentRecord,
      resolveSticker: stickerId => resolveStickerAsset(stickerId, Math.max(1, sendDeadlineAt - Date.now())),
      sendSticker: asset => sendWithRecovery(timeoutMs => sendStickerToWaha(asset, timeoutMs)),
      sendText: currentJob => sendWithRecovery(timeoutMs => sendTextToWaha(currentJob, timeoutMs)),
      sendImage: currentJob => sendWithRecovery(timeoutMs => sendImageToWaha(currentJob, timeoutMs)),
      remember: record => {
        sentRecord = normalizeSentRecord(record);
        rememberSent(job.id, sentRecord);
      },
      waitAfterSticker: () => new Promise(resolve => setTimeout(resolve, MEDIA_TEXT_DELAY_MS))
    });
    sentRecord = delivery.sentRecord;
    if (delivery.stickerSentThisRun) {
      log("job_media_sent", { jobId: job.id, stickerId: job.stickerId });
    }
    if (delivery.imageSentThisRun) {
      log("job_image_sent", { jobId: job.id, imageFilename: job.imageFilename });
    }
  } catch (error) {
    await markFailed(job, error, sentRecord, deadlineAt);
    log("job_send_failed", {
      jobId: job.id,
      attempt: job.attemptCount,
      retryable: false,
      error: safeError(error),
      durationMs: Date.now() - startedAt
    });
    return;
  }

  try {
    await markComplete(job, sentRecord, deadlineAt);
    forgetSent(job.id);
    log("job_succeeded", { jobId: job.id, durationMs: Date.now() - startedAt });
  } catch (error) {
    // The local journal is intentionally retained. A later controlled
    // reconciliation can complete the same job without resending a component.
    log("job_complete_error", { jobId: job.id, error: safeError(error), durationMs: Date.now() - startedAt });
  }
}

async function drainQueue(reason = "wake") {
  if (!workerEnabled || !wppDesiredConnected || wppState !== "CONNECTED") return;
  if (draining) {
    drainAgain = true;
    return;
  }

  draining = true;
  try {
    do {
      drainAgain = false;
      while (!shuttingDown) {
        const job = await claimJob();
        if (!job?.id) break;
        await processJob(job);
      }
    } while (drainAgain && !shuttingDown);
  } catch (error) {
    log("drain_error", { reason, error: safeError(error) });
  } finally {
    draining = false;
  }
}

function realtimeAvailableDelay(payload) {
  const value = String(payload?.availableAt || "").trim();
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? Math.min(RECOVERY_INTERVAL_MS * 2, Math.max(0, timestamp - Date.now()))
    : 0;
}

function scheduleQueueWake(reason, delayMs = 0) {
  if (shuttingDown) return;
  const dueAt = Date.now() + Math.max(0, delayMs);
  if (delayMs <= 0) {
    void wakeQueue(reason);
    return;
  }
  const bucket = Math.ceil(dueAt / 1000) * 1000;
  if (scheduledWakeTimers.has(bucket)) return;
  if (scheduledWakeTimers.size >= 512) return;
  const timer = setTimeout(() => {
    scheduledWakeTimers.delete(bucket);
    void wakeQueue(reason);
  }, Math.max(0, bucket - Date.now()));
  timer.unref();
  scheduledWakeTimers.set(bucket, timer);
}

async function wakeQueue(reason = "wake") {
  if (waking) {
    wakeAgain = true;
    return;
  }
  waking = true;
  try {
    do {
      wakeAgain = false;
      const ready = await refreshRuntimeControl(reason);
      if (ready) await drainQueue(reason);
    } while (wakeAgain && !shuttingDown);
  } finally {
    waking = false;
  }
}

function nextRef() {
  messageRef += 1;
  return String(messageRef);
}

function websocketUrl() {
  const url = new URL(SUPABASE_URL);
  url.protocol = "wss:";
  url.pathname = "/realtime/v1/websocket";
  url.search = "";
  url.searchParams.set("apikey", PUBLISHABLE_KEY);
  url.searchParams.set("vsn", "1.0.0");
  return url.toString();
}

function sendRealtime(message) {
  if (websocket?.readyState === WebSocket.OPEN) websocket.send(JSON.stringify(message));
}

function clearRealtimeTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  heartbeatTimer = null;
  reconnectTimer = null;
}

function scheduleReconnect() {
  if (shuttingDown || reconnectTimer) return;
  const delays = [1000, 2000, 5000, 10000, 30000];
  const delay = delays[Math.min(reconnectAttempt, delays.length - 1)];
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRealtime();
  }, delay);
  log("realtime_reconnect_scheduled", { delayMs: delay });
}

function connectRealtime() {
  if (shuttingDown) return;
  clearRealtimeTimers();

  const ws = new WebSocket(websocketUrl());
  websocket = ws;
  let joinRef = "";

  ws.addEventListener("open", () => {
    reconnectAttempt = 0;
    joinRef = nextRef();
    sendRealtime({
      topic: REALTIME_TOPIC,
      event: "phx_join",
      payload: {
        config: {
          broadcast: { ack: false, self: false },
          presence: { enabled: false },
          postgres_changes: [],
          private: false
        }
      },
      ref: joinRef,
      join_ref: joinRef
    });

    heartbeatTimer = setInterval(() => {
      sendRealtime({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() });
    }, REALTIME_HEARTBEAT_MS);
    log("realtime_connected");
  });

  ws.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }

    if (message.event === "phx_reply" && message.ref === joinRef) {
      if (message.payload?.status === "ok") {
        log("realtime_subscribed");
        scheduleQueueWake("realtime_join");
      } else {
        log("realtime_join_error", { error: safeError(message.payload?.response?.reason || "join rejected") });
      }
      return;
    }

    if (message.event === "broadcast" && message.payload?.event === "wake") {
      scheduleQueueWake(
        "realtime_wake",
        realtimeAvailableDelay(message.payload?.payload)
      );
      return;
    }

    if (message.event === "system" && message.payload?.status === "error") {
      log("realtime_system_error", { error: safeError(message.payload?.message || "system error") });
    }
  });

  ws.addEventListener("error", () => {
    log("realtime_socket_error");
  });

  ws.addEventListener("close", event => {
    if (websocket === ws) websocket = null;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    log("realtime_closed", { code: event.code });
    scheduleReconnect();
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutdown", { signal });
  clearRealtimeTimers();
  if (recoveryTimer) clearInterval(recoveryTimer);
  for (const timer of scheduledWakeTimers.values()) clearTimeout(timer);
  scheduledWakeTimers.clear();
  recoveryTimer = null;
  try { websocket?.close(1000, "shutdown"); } catch {}
  setTimeout(() => process.exit(0), draining ? 1500 : 50).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", error => log("unhandled_rejection", { error: safeError(error) }));
process.on("uncaughtException", error => {
  log("uncaught_exception", { error: safeError(error) });
  process.exitCode = 1;
});

log("worker_started", {
  environment: process.env.WORKER_ENVIRONMENT || "UNKNOWN",
  projectRef: EXPECTED_PROJECT_REF,
  recoveryIntervalMs: RECOVERY_INTERVAL_MS,
  wppControlOwner: WPP_CONTROL_OWNER
});

connectRealtime();
await wakeQueue("startup");
recoveryTimer = setInterval(() => scheduleQueueWake("recovery_poll"), RECOVERY_INTERVAL_MS);
recoveryTimer.unref();

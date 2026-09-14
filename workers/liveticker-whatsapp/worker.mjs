import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "LIVETICKER_WORKER_TOKEN_FILE",
  "WAHA_API_KEY",
  "WAHA_CHANNEL_ID"
];

const POLL_INTERVAL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "30000", 10);
const EDGE_TIMEOUT_MS = Number.parseInt(process.env.EDGE_TIMEOUT_MS || "10000", 10);
const WAHA_TIMEOUT_MS = Number.parseInt(process.env.WAHA_TIMEOUT_MS || "8000", 10);
const REALTIME_HEARTBEAT_MS = 20000;
const REALTIME_TOPIC = "realtime:liveticker-whatsapp-jobs";
const WAHA_BASE_URL = String(process.env.WAHA_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const WAHA_SESSION = String(process.env.WAHA_SESSION || "Liveticker_Test");
const JOURNAL_FILE = String(
  process.env.WHATSAPP_SENT_JOURNAL_FILE
  || "/srv/docker/liveticker/whatsapp-worker/sent-journal.json"
);
const MEDIA_ASSET_DIR = "/srv/docker/liveticker/whatsapp-worker/assets";
const GOAL_MEDIA_FILE = `${MEDIA_ASSET_DIR}/toooor.png`;
const PENALTY_MEDIA_FILE = `${MEDIA_ASSET_DIR}/strafe.png`;

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
if (!Number.isInteger(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 5000) throw new Error("POLL_INTERVAL_MS must be at least 5000");
if (!Number.isInteger(EDGE_TIMEOUT_MS) || EDGE_TIMEOUT_MS < 1000) throw new Error("EDGE_TIMEOUT_MS must be at least 1000");
if (!Number.isInteger(WAHA_TIMEOUT_MS) || WAHA_TIMEOUT_MS < 1000) throw new Error("WAHA_TIMEOUT_MS must be at least 1000");

const WORKER_TOKEN = readSecret(WORKER_TOKEN_FILE, 32);
const MEDIA_ASSETS = Object.freeze({
  goal: loadPngAsset(GOAL_MEDIA_FILE, "toooor.png"),
  penalty: loadPngAsset(PENALTY_MEDIA_FILE, "strafe.png")
});
const sentJournal = loadSentJournal();

let draining = false;
let drainAgain = false;
let websocket = null;
let heartbeatTimer = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let messageRef = 0;
let shuttingDown = false;

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

function loadPngAsset(path, filename) {
  const data = readFileSync(path);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 1024 || !data.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`Invalid PNG media asset: ${path}`);
  }
  return Object.freeze({
    filename,
    mimetype: "image/png",
    data: data.toString("base64")
  });
}

function loadWebpAsset(path, filename) {
  const data = readFileSync(path);
  if (
    data.length < 1024
    || data.subarray(0, 4).toString("ascii") !== "RIFF"
    || data.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error(`Invalid WebP media asset: ${path}`);
  }
  return Object.freeze({
    filename,
    mimetype: "image/webp",
    data: data.toString("base64")
  });
}

function mediaAssetForJob(job) {
  const text = String(job?.message || "");
  if (/(?:^|\n)Strafe\(n\)(?:\n|$)/i.test(text)) return MEDIA_ASSETS.penalty;
  if (/to+or[\s\S]{0,160}mighty dogs/i.test(text)) return MEDIA_ASSETS.goal;
  return null;
}

function normalizeSentRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (value.text && typeof value.text === "object") return { ...value };
  if (value.messageId || value.sentAt) {
    return {
      ...value,
      text: { messageId: value.messageId || "", sentAt: value.sentAt || new Date().toISOString() }
    };
  }
  return { ...value };
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

async function edge(body) {
  const response = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      "X-Liveticker-Worker-Token": WORKER_TOKEN,
      "Content-Type": "application/json",
      "User-Agent": "Plaerrdeifl-Liveticker-WhatsApp-DEV-Worker/1"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EDGE_TIMEOUT_MS)
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload?.ok !== true || !payload?.data || typeof payload.data !== "object") {
    throw new Error(`Worker gateway failed (${response.status})`);
  }
  return payload.data;
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

function extractWahaMessageId(data) {
  return String(
    data?.id
    || data?.messageId
    || data?.key?.id
    || data?._data?.id?._serialized
    || ""
  ).trim();
}

async function sendTextToWaha(job) {
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
    signal: AbortSignal.timeout(WAHA_TIMEOUT_MS)
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(`WAHA sendText failed (${response.status}): ${data?.message || data?.error || "request failed"}`);
  return {
    messageId: extractWahaMessageId(data),
    sentAt: new Date().toISOString()
  };
}

async function sendImageToWaha(asset) {
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
        mimetype: asset.mimetype,
        filename: asset.filename,
        data: asset.data
      },
      caption: ""
    }),
    signal: AbortSignal.timeout(WAHA_TIMEOUT_MS)
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(`WAHA sendImage failed (${response.status}): ${data?.message || data?.error || "request failed"}`);
  return {
    messageId: extractWahaMessageId(data),
    sentAt: new Date().toISOString()
  };
}

async function sendStickerToWaha(asset) {
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
    signal: AbortSignal.timeout(WAHA_TIMEOUT_MS)
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

async function markComplete(job, record) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await edge({
        action: "complete",
        jobId: job.id,
        attemptCount: job.attemptCount,
        wahaMessageId: record.messageId || null,
        sentAt: record.sentAt
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function markFailed(job, error) {
  try {
    return await edge({
      action: "fail",
      jobId: job.id,
      attemptCount: job.attemptCount,
      error: safeError(error)
    });
  } catch (failError) {
    log("job_fail_record_error", { jobId: job.id, error: safeError(failError) });
    return null;
  }
}

async function processJob(job) {
  const startedAt = Date.now();
  log("job_claimed", { jobId: job.id, attempt: job.attemptCount });

  const recovered = sentJournal.has(job.id);
  let sentRecord = normalizeSentRecord(sentJournal.get(job.id));
  if (recovered) log("job_send_recovered", { jobId: job.id });

  try {
    const mediaAsset = mediaAssetForJob(job);
    if (mediaAsset && !sentRecord.media) {
      const mediaRecord = mediaAsset === MEDIA_ASSETS.goal
        ? await sendStickerToWaha(mediaAsset)
        : await sendImageToWaha(mediaAsset);
      sentRecord = { ...sentRecord, media: mediaRecord };
      rememberSent(job.id, sentRecord);
      log("job_media_sent", { jobId: job.id, media: mediaAsset.filename });
    }

    if (!sentRecord.text) {
      const textRecord = await sendTextToWaha(job);
      sentRecord = {
        ...sentRecord,
        text: textRecord,
        messageId: textRecord.messageId,
        sentAt: textRecord.sentAt
      };
      rememberSent(job.id, sentRecord);
    } else if (!sentRecord.messageId || !sentRecord.sentAt) {
      sentRecord = {
        ...sentRecord,
        messageId: sentRecord.text.messageId || "",
        sentAt: sentRecord.text.sentAt || new Date().toISOString()
      };
      rememberSent(job.id, sentRecord);
    }
  } catch (error) {
    const result = await markFailed(job, error);
    log("job_send_failed", {
      jobId: job.id,
      attempt: job.attemptCount,
      retryable: Boolean(result?.retryable),
      error: safeError(error),
      durationMs: Date.now() - startedAt
    });
    return;
  }

  try {
    await markComplete(job, sentRecord);
    forgetSent(job.id);
    log("job_succeeded", { jobId: job.id, durationMs: Date.now() - startedAt });
  } catch (error) {
    // The local sent journal is intentionally kept. If this PROCESSING lease
    // is reclaimed later, the already delivered WhatsApp post is not sent a
    // second time; only completion is retried.
    log("job_complete_error", { jobId: job.id, error: safeError(error), durationMs: Date.now() - startedAt });
  }
}

async function drainQueue(reason = "wake") {
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
        void drainQueue("realtime_join");
      } else {
        log("realtime_join_error", { error: safeError(message.payload?.response?.reason || "join rejected") });
      }
      return;
    }

    if (message.event === "broadcast" && message.payload?.event === "wake") {
      void drainQueue("realtime_wake");
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
  pollIntervalMs: POLL_INTERVAL_MS
});

connectRealtime();
void drainQueue("startup");
const pollTimer = setInterval(() => void drainQueue("recovery_poll"), POLL_INTERVAL_MS);
pollTimer.unref();

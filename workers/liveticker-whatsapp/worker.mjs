const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EXPECTED_SUPABASE_PROJECT_REF",
  "WAHA_API_KEY",
  "WAHA_CHANNEL_ID"
];

const POLL_INTERVAL_MS = Number.parseInt(process.env.POLL_INTERVAL_MS || "10000", 10);
const WAHA_TIMEOUT_MS = Number.parseInt(process.env.WAHA_TIMEOUT_MS || "8000", 10);
const REALTIME_HEARTBEAT_MS = 20000;
const REALTIME_TOPIC = "realtime:liveticker-whatsapp-jobs";
const WAHA_BASE_URL = String(process.env.WAHA_BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const WAHA_SESSION = String(process.env.WAHA_SESSION || "default");

for (const name of REQUIRED_ENV) {
  if (!String(process.env[name] || "").trim()) throw new Error(`Missing required environment variable: ${name}`);
}

const SUPABASE_URL = String(process.env.SUPABASE_URL).replace(/\/$/, "");
const SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY);
const EXPECTED_PROJECT_REF = String(process.env.EXPECTED_SUPABASE_PROJECT_REF);
const WAHA_API_KEY = String(process.env.WAHA_API_KEY);
const WAHA_CHANNEL_ID = String(process.env.WAHA_CHANNEL_ID);

const supabase = new URL(SUPABASE_URL);
if (supabase.protocol !== "https:" || supabase.hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`) {
  throw new Error("SUPABASE_URL does not match EXPECTED_SUPABASE_PROJECT_REF");
}
if (!WAHA_CHANNEL_ID.endsWith("@newsletter")) throw new Error("WAHA_CHANNEL_ID must be a WhatsApp Channel id ending in @newsletter");
if (!Number.isInteger(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 1000) throw new Error("POLL_INTERVAL_MS must be at least 1000");
if (!Number.isInteger(WAHA_TIMEOUT_MS) || WAHA_TIMEOUT_MS < 1000) throw new Error("WAHA_TIMEOUT_MS must be at least 1000");

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

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function rpc(name, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(`RPC ${name} failed (${response.status}): ${data?.message || "request failed"}`);
  return data;
}

async function claimJob() {
  return rpc("pd_liveticker_whatsapp_worker_claim");
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

async function sendToWaha(job) {
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
  return extractWahaMessageId(data);
}

async function markComplete(jobId, wahaMessageId) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await rpc("pd_liveticker_whatsapp_worker_complete", {
        p_job_id: jobId,
        p_waha_message_id: wahaMessageId || null
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function markFailed(jobId, error) {
  try {
    return await rpc("pd_liveticker_whatsapp_worker_fail", {
      p_job_id: jobId,
      p_error: safeError(error)
    });
  } catch (failError) {
    log("job_fail_record_error", { jobId, error: safeError(failError) });
    return null;
  }
}

async function processJob(job) {
  const startedAt = Date.now();
  log("job_claimed", { jobId: job.id, attempt: job.attemptCount });

  let wahaMessageId = "";
  try {
    wahaMessageId = await sendToWaha(job);
  } catch (error) {
    const result = await markFailed(job.id, error);
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
    await markComplete(job.id, wahaMessageId);
    log("job_succeeded", { jobId: job.id, durationMs: Date.now() - startedAt });
  } catch (error) {
    // Do not mark a successfully sent WhatsApp message as FAILED. Keeping the
    // lease avoids an immediate duplicate; recovery happens only after the
    // PROCESSING lease expires if the database remains unreachable.
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
  url.searchParams.set("apikey", SERVICE_ROLE_KEY);
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
          postgres_changes: [{ event: "INSERT", schema: "app_modules", table: "liveticker_whatsapp_jobs" }],
          private: false
        },
        access_token: SERVICE_ROLE_KEY
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

    if (message.event === "postgres_changes") {
      void drainQueue("realtime_insert");
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

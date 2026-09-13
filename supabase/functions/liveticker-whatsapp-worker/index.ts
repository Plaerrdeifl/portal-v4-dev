const MAX_BODY_BYTES = 16_384;
const MAX_SECRET_LENGTH = 2_048;
const MIN_WORKER_TOKEN_BYTES = 32;
const WORKER_TOKEN_HEADER = "X-Liveticker-Worker-Token";
const EXPECTED_SUPABASE_HOST = "tpieykhhawszlzsoflnl.supabase.co";
const EXPECTED_TOKEN_SHA256 = "8ad104a328042fe7a10854836c99f7b86ee6933c7de022516b29ab398299af16";
const WORKER_VIEW = "pd_liveticker_whatsapp_jobs_worker";
const PROCESSING_LEASE_MS = 120_000;
const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;
class GatewayError extends Error {}

function response(status: number, body: JsonObject) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonObject, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isAttemptCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map(item => item.toString(16).padStart(2, "0")).join("");
}

async function authorized(request: Request) {
  const rawUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const token = request.headers.get(WORKER_TOKEN_HEADER) || "";
  if (!rawUrl || token.length > MAX_SECRET_LENGTH || encoder.encode(token).byteLength < MIN_WORKER_TOKEN_BYTES) return false;
  let hostname = "";
  try { hostname = new URL(rawUrl).hostname; } catch { return false; }
  if (hostname !== EXPECTED_SUPABASE_HOST) return false;
  const actual = await sha256Hex(token);
  if (actual.length !== EXPECTED_TOKEN_SHA256.length) return false;
  let diff = 0;
  for (let index = 0; index < EXPECTED_TOKEN_SHA256.length; index += 1) {
    diff |= actual.charCodeAt(index) ^ EXPECTED_TOKEN_SHA256.charCodeAt(index);
  }
  return diff === 0;
}

async function readJson(request: Request): Promise<unknown> {
  const length = request.headers.get("Content-Length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new GatewayError();
  if (!request.body) throw new GatewayError();
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) throw new GatewayError();
  try {
    return JSON.parse(raw);
  } catch {
    throw new GatewayError();
  }
}

function validBody(value: unknown): value is JsonObject {
  if (!isObject(value) || typeof value.action !== "string") return false;
  if (value.action === "claim") return exactKeys(value, ["action"]);
  if (value.action === "complete") {
    return exactKeys(value, ["action", "jobId", "attemptCount", "wahaMessageId", "sentAt"])
      && isUuid(value.jobId)
      && isAttemptCount(value.attemptCount)
      && (value.wahaMessageId === null || (typeof value.wahaMessageId === "string" && value.wahaMessageId.length <= 512))
      && typeof value.sentAt === "string"
      && !Number.isNaN(Date.parse(value.sentAt));
  }
  if (value.action === "fail") {
    return exactKeys(value, ["action", "jobId", "attemptCount", "error"])
      && isUuid(value.jobId)
      && isAttemptCount(value.attemptCount)
      && typeof value.error === "string"
      && value.error.length >= 1
      && value.error.length <= 1000;
  }
  return false;
}

function runtime() {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!url || !raw) throw new GatewayError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GatewayError();
  }
  if (!isObject(parsed)) throw new GatewayError();
  const key = [parsed.default, parsed.secret, parsed.service_role, ...Object.values(parsed)]
    .find(value => typeof value === "string" && value.trim());
  if (typeof key !== "string") throw new GatewayError();
  return { url: url.replace(/\/$/, ""), key: key.trim() };
}

async function rest(path: string, init: RequestInit = {}) {
  const config = runtime();
  const result = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await result.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!result.ok) throw new GatewayError();
  return data;
}

function viewUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${WORKER_VIEW}?${query.toString()}`;
}

function jobPayload(row: JsonObject) {
  return {
    id: String(row.id || ""),
    eventId: String(row.event_id || ""),
    clientActionId: String(row.client_action_id || ""),
    publicationVersion: Number(row.publication_version || 1),
    message: String(row.message || ""),
    attemptCount: Number(row.attempt_count || 0),
    createdAt: String(row.created_at || ""),
    workerReceivedAt: String(row.worker_received_at || ""),
  };
}

async function claim() {
  for (let pass = 0; pass < 5; pass += 1) {
    const now = new Date();
    const nowIso = now.toISOString();
    const staleIso = new Date(now.getTime() - PROCESSING_LEASE_MS).toISOString();
    const rows = await rest(viewUrl({
      select: "id,event_id,client_action_id,publication_version,message,status,attempt_count,next_attempt_at,claimed_at,created_at,worker_received_at",
      attempt_count: "lt.5",
      or: `(and(status.eq.PENDING,next_attempt_at.lte.${nowIso}),and(status.eq.FAILED,next_attempt_at.lte.${nowIso}),and(status.eq.PROCESSING,claimed_at.lt.${staleIso}))`,
      order: "created_at.asc,id.asc",
      limit: "1",
    }));
    if (!Array.isArray(rows) || !rows.length || !isObject(rows[0])) return { claimed: false };

    const candidate = rows[0];
    const id = String(candidate.id || "");
    const status = String(candidate.status || "");
    const attemptCount = Number(candidate.attempt_count || 0);
    if (!isUuid(id) || !["PENDING", "FAILED", "PROCESSING"].includes(status) || !Number.isSafeInteger(attemptCount)) throw new GatewayError();

    const params: Record<string, string> = {
      id: `eq.${id}`,
      status: `eq.${status}`,
      attempt_count: `eq.${attemptCount}`,
    };
    if (status === "PROCESSING") params.claimed_at = `lt.${staleIso}`;
    else params.next_attempt_at = `lte.${nowIso}`;

    const claimed = await rest(viewUrl(params), {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "PROCESSING",
        attempt_count: attemptCount + 1,
        claimed_at: nowIso,
        worker_received_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      }),
    });
    if (Array.isArray(claimed) && claimed.length === 1 && isObject(claimed[0])) {
      return { claimed: true, job: jobPayload(claimed[0]) };
    }
  }
  return { claimed: false };
}

async function rowById(jobId: string) {
  const rows = await rest(viewUrl({
    select: "id,status,attempt_count,completed_at,next_attempt_at",
    id: `eq.${jobId}`,
    limit: "1",
  }));
  return Array.isArray(rows) && rows.length && isObject(rows[0]) ? rows[0] : null;
}

async function complete(body: JsonObject) {
  const nowIso = new Date().toISOString();
  const rows = await rest(viewUrl({
    id: `eq.${String(body.jobId)}`,
    status: "eq.PROCESSING",
    attempt_count: `eq.${Number(body.attemptCount)}`,
  }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "SUCCEEDED",
      waha_message_id: body.wahaMessageId || null,
      waha_sent_at: String(body.sentAt),
      completed_at: nowIso,
      next_attempt_at: nowIso,
      last_error: null,
      updated_at: nowIso,
    }),
  });
  if (Array.isArray(rows) && rows.length === 1) return { completed: true, status: "SUCCEEDED" };
  const current = await rowById(String(body.jobId));
  if (current?.status === "SUCCEEDED") return { completed: true, status: "SUCCEEDED" };
  throw new GatewayError();
}

async function fail(body: JsonObject) {
  const attemptCount = Number(body.attemptCount);
  const delaySeconds = attemptCount === 1 ? 1 : attemptCount === 2 ? 5 : attemptCount === 3 ? 15 : 60;
  const retryable = attemptCount < 5;
  const now = new Date();
  const nextAttemptAt = retryable ? new Date(now.getTime() + delaySeconds * 1000).toISOString() : now.toISOString();
  const rows = await rest(viewUrl({
    id: `eq.${String(body.jobId)}`,
    status: "eq.PROCESSING",
    attempt_count: `eq.${attemptCount}`,
  }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "FAILED",
      next_attempt_at: nextAttemptAt,
      last_error: String(body.error).slice(0, 1000),
      updated_at: now.toISOString(),
    }),
  });
  if (Array.isArray(rows) && rows.length === 1) return { failed: true, retryable, nextAttemptAt: retryable ? nextAttemptAt : null };
  const current = await rowById(String(body.jobId));
  if (current?.status === "SUCCEEDED") return { failed: false, retryable: false, nextAttemptAt: null };
  throw new GatewayError();
}

Deno.serve(async request => {
  if (request.method !== "POST") return response(405, { ok: false, error: "Method not allowed" });
  try {
    if (!await authorized(request)) return response(401, { ok: false, error: "Unauthorized" });
    const body = await readJson(request);
    if (!validBody(body)) return response(400, { ok: false, error: "Invalid request" });
    const data = body.action === "claim"
      ? await claim()
      : body.action === "complete"
      ? await complete(body)
      : await fail(body);
    return response(200, { ok: true, data });
  } catch {
    return response(500, { ok: false, error: "Internal error" });
  }
});

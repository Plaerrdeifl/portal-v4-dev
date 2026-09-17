const MAX_BODY_BYTES = 16_384;
const MAX_SECRET_LENGTH = 2_048;
const MIN_WORKER_TOKEN_BYTES = 32;
const WORKER_TOKEN_HEADER = "X-Liveticker-Worker-Token";
const EXPECTED_SUPABASE_HOST = "tpieykhhawszlzsoflnl.supabase.co";
const EXPECTED_TOKEN_SHA256 = "8ad104a328042fe7a10854836c99f7b86ee6933c7de022516b29ab398299af16";
const WORKER_VIEW = "pd_liveticker_whatsapp_jobs_worker";
const STICKER_VIEW = "pd_liveticker_whatsapp_stickers_worker";
const STICKER_BUCKET = "liveticker-whatsapp-stickers";
const MAX_STICKER_BYTES = 100 * 1024;
const encoder = new TextEncoder();
const DELIVERY_MODES = new Set(["TEXT_ONLY", "STICKER_THEN_TEXT", "STICKER_ONLY"]);

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

function validSentComponent(value: unknown) {
  return value === null || (
    isObject(value)
    && exactKeys(value, ["messageId", "sentAt"])
    && typeof value.messageId === "string"
    && value.messageId.length <= 512
    && typeof value.sentAt === "string"
    && !Number.isNaN(Date.parse(value.sentAt))
  );
}

function validComponents(value: unknown) {
  return isObject(value)
    && exactKeys(value, ["sticker", "text"])
    && validSentComponent(value.sticker)
    && validSentComponent(value.text);
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
  if (value.action === "sticker") {
    return exactKeys(value, ["action", "stickerId"]) && isUuid(value.stickerId);
  }
  if (value.action === "complete") {
    const keysValid = exactKeys(value, ["action", "jobId", "attemptCount", "wahaMessageId", "sentAt"])
      || exactKeys(value, ["action", "jobId", "attemptCount", "wahaMessageId", "sentAt", "components"]);
    return keysValid
      && isUuid(value.jobId)
      && isAttemptCount(value.attemptCount)
      && (value.wahaMessageId === null || (typeof value.wahaMessageId === "string" && value.wahaMessageId.length <= 512))
      && typeof value.sentAt === "string"
      && !Number.isNaN(Date.parse(value.sentAt))
      && (!("components" in value) || validComponents(value.components));
  }
  if (value.action === "retrying") {
    return exactKeys(value, ["action", "jobId", "attemptCount"])
      && isUuid(value.jobId)
      && isAttemptCount(value.attemptCount)
      && Number(value.attemptCount) < 5;
  }
  if (value.action === "fail") {
    const keysValid = exactKeys(value, ["action", "jobId", "attemptCount", "error"])
      || exactKeys(value, ["action", "jobId", "attemptCount", "error", "failedComponent", "components"]);
    return keysValid
      && isUuid(value.jobId)
      && isAttemptCount(value.attemptCount)
      && typeof value.error === "string"
      && value.error.length >= 1
      && value.error.length <= 1000
      && (!("failedComponent" in value)
        || value.failedComponent === null
        || ["STICKER", "TEXT"].includes(String(value.failedComponent)))
      && (!("components" in value) || validComponents(value.components));
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
    message: row.message == null ? null : String(row.message),
    stickerId: row.sticker_id ? String(row.sticker_id) : null,
    deliveryMode: String(row.delivery_mode || ""),
    stickerStatus: String(row.sticker_status || ""),
    textStatus: String(row.text_status || ""),
    stickerMessageId: row.sticker_waha_message_id == null ? null : String(row.sticker_waha_message_id),
    stickerSentAt: row.sticker_sent_at == null ? null : String(row.sticker_sent_at),
    textMessageId: row.text_waha_message_id == null ? null : String(row.text_waha_message_id),
    textSentAt: row.text_sent_at == null ? null : String(row.text_sent_at),
    linkedActionId: row.linked_action_id == null ? null : String(row.linked_action_id),
    attemptCount: Number(row.attempt_count || 0),
    createdAt: String(row.created_at || ""),
    workerReceivedAt: String(row.worker_received_at || ""),
  };
}

async function claim() {
  for (let pass = 0; pass < 5; pass += 1) {
    const now = new Date();
    const nowIso = now.toISOString();
    const rows = await rest(viewUrl({
      select: "id,event_id,client_action_id,publication_version,message,sticker_id,delivery_mode,sticker_status,text_status,sticker_waha_message_id,sticker_sent_at,text_waha_message_id,text_sent_at,linked_action_id,status,attempt_count,next_attempt_at,claimed_at,created_at,worker_received_at",
      attempt_count: "lt.5",
      status: "eq.PENDING",
      next_attempt_at: `lte.${nowIso}`,
      order: "created_at.asc,id.asc",
      limit: "1",
    }));
    if (!Array.isArray(rows) || !rows.length || !isObject(rows[0])) return { claimed: false };

    const candidate = rows[0];
    const id = String(candidate.id || "");
    const status = String(candidate.status || "");
    const deliveryMode = String(candidate.delivery_mode || "");
    const attemptCount = Number(candidate.attempt_count || 0);
    if (!isUuid(id)
        || status !== "PENDING"
        || !DELIVERY_MODES.has(deliveryMode)
        || !Number.isSafeInteger(attemptCount)) throw new GatewayError();

    const params: Record<string, string> = {
      id: `eq.${id}`,
      status: `eq.${status}`,
      attempt_count: `eq.${attemptCount}`,
    };
    params.next_attempt_at = `lte.${nowIso}`;

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

async function retrying(body: JsonObject) {
  const currentAttempt = Number(body.attemptCount);
  const nextAttempt = currentAttempt + 1;
  const nowIso = new Date().toISOString();
  const rows = await rest(viewUrl({
    id: `eq.${String(body.jobId)}`,
    status: "eq.PROCESSING",
    attempt_count: `eq.${currentAttempt}`,
  }), {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      attempt_count: nextAttempt,
      updated_at: nowIso,
    }),
  });
  if (!Array.isArray(rows) || rows.length !== 1) throw new GatewayError();
  return { retrying: true, attemptCount: nextAttempt };
}

function encodedObjectName(value: string) {
  return value.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest).map(value => value.toString(16).padStart(2, "0")).join("");
}

async function stickerAsset(stickerId: string) {
  const rows = await rest(`${STICKER_VIEW}?${new URLSearchParams({
    select: "id,storage_path,mime_type,width,height,file_size,sha256",
    id: `eq.${stickerId}`,
    limit: "1"
  }).toString()}`);
  if (Array.isArray(rows) && rows.length === 0) return { found: false, id: stickerId };
  if (!Array.isArray(rows) || rows.length !== 1 || !isObject(rows[0])) throw new GatewayError();
  const row = rows[0];
  const storagePath = String(row.storage_path || "");
  const mimeType = String(row.mime_type || "");
  const fileSize = Number(row.file_size || 0);
  const expectedSha = String(row.sha256 || "");
  if (mimeType !== "image/webp"
      || Number(row.width) !== 512
      || Number(row.height) !== 512
      || !Number.isSafeInteger(fileSize)
      || fileSize < 1
      || fileSize > MAX_STICKER_BYTES
      || !/^stickers\/dev\/[0-9a-f-]{36}[.]webp$/i.test(storagePath)
      || !/^[0-9a-f]{64}$/.test(expectedSha)) throw new GatewayError();
  const config = runtime();
  const response = await fetch(
    `${config.url}/storage/v1/object/${STICKER_BUCKET}/${encodedObjectName(storagePath)}`,
    { headers: { apikey: config.key }, signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new GatewayError();
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== fileSize
      || bytes.byteLength < 20
      || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF"
      || String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
      || await sha256Bytes(bytes) !== expectedSha) throw new GatewayError();
  return {
    found: true,
    id: stickerId,
    filename: `${stickerId}.webp`,
    mimetype: mimeType,
    data: bytesToBase64(bytes)
  };
}

async function rowById(jobId: string) {
  const rows = await rest(viewUrl({
    select: "id,status,attempt_count,completed_at,next_attempt_at,delivery_mode,sticker_status,text_status,sticker_waha_message_id,sticker_sent_at,text_waha_message_id,text_sent_at",
    id: `eq.${jobId}`,
    limit: "1",
  }));
  return Array.isArray(rows) && rows.length && isObject(rows[0]) ? rows[0] : null;
}

function componentRequested(deliveryMode: string, component: "STICKER" | "TEXT") {
  if (component === "STICKER") return deliveryMode !== "TEXT_ONLY";
  return deliveryMode !== "STICKER_ONLY";
}

function sentComponent(value: unknown) {
  return isObject(value) && validSentComponent(value)
    ? { messageId: String(value.messageId || ""), sentAt: String(value.sentAt) }
    : null;
}

function componentPatch(row: JsonObject, body: JsonObject, completing: boolean) {
  const deliveryMode = String(row.delivery_mode || "");
  if (!DELIVERY_MODES.has(deliveryMode)) throw new GatewayError();
  const components = isObject(body.components) ? body.components : null;
  let sticker = components ? sentComponent(components.sticker) : null;
  let text = components ? sentComponent(components.text) : null;
  let failedComponent: "STICKER" | "TEXT" | null = body.failedComponent === "STICKER" || body.failedComponent === "TEXT"
    ? body.failedComponent
    : null;

  if ((sticker && !componentRequested(deliveryMode, "STICKER"))
      || (text && !componentRequested(deliveryMode, "TEXT"))) {
    throw new GatewayError();
  }

  if (!components && completing) {
    const legacy = {
      messageId: String(body.wahaMessageId || ""),
      sentAt: String(body.sentAt)
    };
    if (componentRequested(deliveryMode, "STICKER")) {
      sticker = deliveryMode === "STICKER_ONLY" ? legacy : { messageId: "", sentAt: legacy.sentAt };
    }
    if (componentRequested(deliveryMode, "TEXT")) text = legacy;
  }

  if (!completing && !failedComponent) {
    failedComponent = componentRequested(deliveryMode, "STICKER") && !sticker ? "STICKER" : "TEXT";
  }
  if (!completing && failedComponent && !componentRequested(deliveryMode, failedComponent)) {
    throw new GatewayError();
  }
  if (completing
      && ((componentRequested(deliveryMode, "STICKER") && !sticker)
        || (componentRequested(deliveryMode, "TEXT") && !text))) {
    throw new GatewayError();
  }
  if (!completing && failedComponent === "TEXT"
      && componentRequested(deliveryMode, "STICKER") && !sticker) {
    throw new GatewayError();
  }

  const state = (
    component: "STICKER" | "TEXT",
    sent: { messageId: string; sentAt: string } | null
  ) => {
    if (!componentRequested(deliveryMode, component)) return "NOT_REQUESTED";
    if (sent) return "SENT";
    if (!completing && failedComponent === component) return "FAILED";
    return "PENDING";
  };
  const stickerStatus = state("STICKER", sticker);
  const textStatus = state("TEXT", text);
  return {
    sticker_status: stickerStatus,
    sticker_waha_message_id: stickerStatus === "SENT" ? sticker?.messageId || null : null,
    sticker_sent_at: stickerStatus === "SENT" ? sticker?.sentAt || null : null,
    text_status: textStatus,
    text_waha_message_id: textStatus === "SENT" ? text?.messageId || null : null,
    text_sent_at: textStatus === "SENT" ? text?.sentAt || null : null,
  };
}

async function complete(body: JsonObject) {
  const nowIso = new Date().toISOString();
  const current = await rowById(String(body.jobId));
  if (!current) throw new GatewayError();
  if (current.status === "SUCCEEDED") return { completed: true, status: "SUCCEEDED" };
  const components = componentPatch(current, body, true);
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
      ...components,
    }),
  });
  if (Array.isArray(rows) && rows.length === 1) return { completed: true, status: "SUCCEEDED" };
  const after = await rowById(String(body.jobId));
  if (after?.status === "SUCCEEDED") return { completed: true, status: "SUCCEEDED" };
  throw new GatewayError();
}

async function fail(body: JsonObject) {
  const attemptCount = Number(body.attemptCount);
  const now = new Date();
  const nextAttemptAt = now.toISOString();
  const current = await rowById(String(body.jobId));
  if (!current) throw new GatewayError();
  if (current.status === "SUCCEEDED") return { failed: false, retryable: false, nextAttemptAt: null };
  const components = componentPatch(current, body, false);
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
      ...components,
    }),
  });
  if (Array.isArray(rows) && rows.length === 1) return { failed: true, retryable: false, nextAttemptAt: null };
  const after = await rowById(String(body.jobId));
  if (after?.status === "SUCCEEDED") return { failed: false, retryable: false, nextAttemptAt: null };
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
      : body.action === "sticker"
      ? await stickerAsset(String(body.stickerId))
      : body.action === "complete"
      ? await complete(body)
      : body.action === "retrying"
      ? await retrying(body)
      : await fail(body);
    return response(200, { ok: true, data });
  } catch {
    return response(500, { ok: false, error: "Internal error" });
  }
});

const MAX_BODY_BYTES = 16 * 1024;
const TURNSTILE_ACTION = "m310_fanbus_registration";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type RuntimeConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  turnstileSecret: string;
  turnstileHostnames: ReadonlySet<string>;
  allowedOrigins: ReadonlySet<string>;
  rateLimitSecret: Uint8Array;
};

type GuestRequest = {
  tripId: string;
  firstName: string;
  lastName: string;
  email: string;
  busPreference: "RUHIG" | "PARTY" | "EGAL";
  companions: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    busPreference: "RUHIG" | "PARTY" | "EGAL";
  }>;
  privacyConfirmed: true;
  termsConfirmed: true;
  idempotencyKey: string;
  turnstileToken: string;
};

type BodyReadResult =
  | { status: "ok"; bytes: Uint8Array }
  | { status: "too_large" | "read_error" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_HASH_PATTERN = /^[0-9a-f]{64}$/;
const REQUIRED_BODY_KEYS = Object.freeze([
  "tripId",
  "firstName",
  "lastName",
  "email",
  "busPreference",
  "privacyConfirmed",
  "termsConfirmed",
  "idempotencyKey",
  "turnstileToken"
]);
const ALLOWED_BODY_KEYS = new Set([...REQUIRED_BODY_KEYS, "companions"]);

function loadConfig(): RuntimeConfig | null {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const turnstileSecret = String(Deno.env.get("M310_TURNSTILE_SECRET") || "").trim();
  const rawHostnames = String(Deno.env.get("M310_TURNSTILE_HOSTNAMES") || "").trim();
  const rawOrigins = String(Deno.env.get("M310_ALLOWED_ORIGINS") || "").trim();
  const rawRateLimitSecret = String(Deno.env.get("M310_RATE_LIMIT_SECRET") || "");

  if (
    !supabaseUrl
    || !serviceRoleKey
    || !turnstileSecret
    || !rawHostnames
    || !rawOrigins
    || !rawRateLimitSecret.trim()
    || encoder.encode(rawRateLimitSecret).byteLength < 32
  ) {
    return null;
  }

  try {
    const parsedSupabaseUrl = new URL(supabaseUrl);
    const localHttp = parsedSupabaseUrl.protocol === "http:"
      && ["127.0.0.1", "localhost", "kong"].includes(parsedSupabaseUrl.hostname);
    if (
      (parsedSupabaseUrl.protocol !== "https:" && !localHttp)
      || parsedSupabaseUrl.origin !== supabaseUrl
      || parsedSupabaseUrl.pathname !== "/"
      || parsedSupabaseUrl.search
      || parsedSupabaseUrl.hash
      || parsedSupabaseUrl.username
      || parsedSupabaseUrl.password
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const hostnames = rawHostnames.split(",").map(value => value.trim().toLowerCase());
  if (
    hostnames.some(value => !value || value.length > 253 || !/^[a-z0-9.-]+$/.test(value))
  ) {
    return null;
  }

  const origins = rawOrigins.split(",").map(value => value.trim());
  for (const origin of origins) {
    try {
      const parsedOrigin = new URL(origin);
      if (
        parsedOrigin.protocol !== "https:"
        || parsedOrigin.origin !== origin
        || parsedOrigin.pathname !== "/"
        || parsedOrigin.search
        || parsedOrigin.hash
        || parsedOrigin.username
        || parsedOrigin.password
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    turnstileSecret,
    turnstileHostnames: new Set(hostnames),
    allowedOrigins: new Set(origins),
    rateLimitSecret: encoder.encode(rawRateLimitSecret)
  };
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  origin?: string
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {})
    }
  });
}

function errorResponse(status: number, code: string, message: string, origin?: string) {
  return jsonResponse(status, { ok: false, code, message }, origin);
}

function hasJsonContentType(request: Request) {
  return /^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?\s*$/i
    .test(request.headers.get("Content-Type") || "");
}

function declaredBodyTooLarge(request: Request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength === null) return false;
  if (!/^[0-9]+$/.test(contentLength)) return null;

  const byteLength = Number(contentLength);
  return !Number.isSafeInteger(byteLength) || byteLength > MAX_BODY_BYTES;
}

async function readRawBody(request: Request): Promise<BodyReadResult> {
  if (!request.body) return { status: "ok", bytes: new Uint8Array() };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { status: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // The unusable stream is intentionally not logged.
    }
    return { status: "read_error" };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: "ok", bytes: body };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseGuestRequest(value: unknown): GuestRequest | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value);
  if (
    REQUIRED_BODY_KEYS.some(key => !Object.hasOwn(value, key))
    || keys.some(key => !ALLOWED_BODY_KEYS.has(key))
  ) {
    return null;
  }

  const companions = value.companions === undefined ? [] : value.companions;

  if (
    typeof value.tripId !== "string"
    || !UUID_PATTERN.test(value.tripId)
    || typeof value.firstName !== "string"
    || value.firstName.trim().length < 1
    || value.firstName.trim().length > 120
    || typeof value.lastName !== "string"
    || value.lastName.trim().length < 1
    || value.lastName.trim().length > 120
    || typeof value.email !== "string"
    || value.email.trim().length < 3
    || value.email.trim().length > 320
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())
    || typeof value.busPreference !== "string"
    || !["RUHIG", "PARTY", "EGAL"].includes(value.busPreference)
    || !Array.isArray(companions)
    || companions.length > 19
    || !companions.every(companion => isPlainObject(companion)
      && Object.keys(companion).every(key => ["firstName", "lastName", "email", "busPreference"].includes(key))
      && typeof companion.firstName === "string" && companion.firstName.trim().length >= 1 && companion.firstName.trim().length <= 120
      && typeof companion.lastName === "string" && companion.lastName.trim().length >= 1 && companion.lastName.trim().length <= 120
      && (companion.email === undefined || (typeof companion.email === "string" && (!companion.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companion.email.trim()))))
      && typeof companion.busPreference === "string" && ["RUHIG", "PARTY", "EGAL"].includes(companion.busPreference))
    || value.privacyConfirmed !== true
    || value.termsConfirmed !== true
    || typeof value.idempotencyKey !== "string"
    || !UUID_V4_PATTERN.test(value.idempotencyKey)
    || typeof value.turnstileToken !== "string"
    || value.turnstileToken.length < 1
    || value.turnstileToken.length > 2048
  ) {
    return null;
  }

  return {
    tripId: value.tripId,
    firstName: value.firstName.trim(),
    lastName: value.lastName.trim(),
    email: value.email.trim(),
    busPreference: value.busPreference as GuestRequest["busPreference"],
    companions: companions.map(companion => ({
      firstName: String(companion.firstName).trim(), lastName: String(companion.lastName).trim(),
      ...(typeof companion.email === "string" && companion.email.trim() ? { email: companion.email.trim() } : {}),
      busPreference: companion.busPreference as GuestRequest["busPreference"]
    })),
    privacyConfirmed: true,
    termsConfirmed: true,
    idempotencyKey: value.idempotencyKey,
    turnstileToken: value.turnstileToken
  };
}

function normalizeIpCandidate(rawValue: string) {
  let candidate = rawValue.trim();
  if (!candidate || candidate.length > 64 || /[\u0000-\u0020\u007f]/.test(candidate)) {
    return null;
  }

  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
    const octets = candidate.split(".").map(Number);
    return octets.every(octet => Number.isInteger(octet) && octet >= 0 && octet <= 255)
      ? octets.join(".")
      : null;
  }

  if (!candidate.includes(":") || !/^[0-9a-f:.]+$/i.test(candidate)) return null;
  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    return hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

function requestSource(request: Request) {
  const cloudflareIp = request.headers.get("CF-Connecting-IP");
  if (cloudflareIp) return normalizeIpCandidate(cloudflareIp);

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (!forwardedFor) return null;
  return normalizeIpCandidate(forwardedFor.split(",", 1)[0] || "");
}

function lowercaseHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sourceHash(source: string, secret: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(source));
  const hash = lowercaseHex(new Uint8Array(signature));
  return SOURCE_HASH_PATTERN.test(hash) ? hash : null;
}

async function verifyTurnstile(
  request: GuestRequest,
  remoteIp: string,
  config: RuntimeConfig
) {
  const form = new URLSearchParams({
    secret: config.turnstileSecret,
    response: request.turnstileToken,
    remoteip: remoteIp,
    idempotency_key: request.idempotencyKey
  });

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return false;

    const result: unknown = await response.json();
    return isPlainObject(result)
      && result.success === true
      && result.action === TURNSTILE_ACTION
      && typeof result.hostname === "string"
      && config.turnstileHostnames.has(result.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function outcomeResponse(outcome: string, origin: string) {
  if (outcome === "CREATED" || outcome === "WAITLISTED" || outcome === "ALREADY_ACTIVE") {
    return jsonResponse(200, {
      ok: true,
      code: "ACCEPTED",
      outcome,
      message: outcome === "WAITLISTED" ? "Die gesamte Anmeldung wurde auf die Warteliste gesetzt." : "Die Fanbus-Anmeldung wurde entgegengenommen."
    }, origin);
  }

  if (outcome === "INVALID_REQUEST") {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }

  if (outcome === "DUPLICATE") {
    return errorResponse(
      409,
      "CONFLICT",
      "Die Anmeldung konnte in dieser Zusammenstellung nicht gespeichert werden.",
      origin
    );
  }

  if (outcome === "INTERNAL_ERROR") {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  const safeOutcomes: Record<string, string> = {
    FULL: "Die Fanbusfahrt ist ausgebucht.",
    NOT_STARTED: "Die Anmeldung hat noch nicht begonnen.",
    CLOSED: "Die Anmeldung ist geschlossen.",
    UNAVAILABLE: "Diese Fanbusfahrt ist aktuell nicht verfügbar."
  };
  const message = safeOutcomes[outcome];
  return message
    ? errorResponse(409, outcome, message, origin)
    : errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
}

Deno.serve(async request => {
  const config = loadConfig();
  if (!config) {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.");
  }

  const origin = request.headers.get("Origin") || "";
  if (!origin || !config.allowedOrigins.has(origin)) {
    return errorResponse(403, "ORIGIN_REJECTED", "Die Anfrage ist nicht zulässig.");
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Die Anfrage ist nicht zulässig.", origin);
  }
  if (!hasJsonContentType(request)) {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }

  const declaredSize = declaredBodyTooLarge(request);
  if (declaredSize === null) {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }
  if (declaredSize) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "Die Anfrage ist zu groß.", origin);
  }

  const bodyResult = await readRawBody(request);
  if (bodyResult.status === "too_large") {
    return errorResponse(413, "REQUEST_TOO_LARGE", "Die Anfrage ist zu groß.", origin);
  }
  if (bodyResult.status !== "ok") {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(decoder.decode(bodyResult.bytes));
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }

  const guestRequest = parseGuestRequest(parsedBody);
  if (!guestRequest) {
    return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
  }

  const source = requestSource(request);
  if (!source) {
    return errorResponse(400, "INVALID_REQUEST", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  if (!await verifyTurnstile(guestRequest, source, config)) {
    return errorResponse(403, "TURNSTILE_REJECTED", "Die Sicherheitsprüfung ist fehlgeschlagen.", origin);
  }

  let hashedSource: string | null;
  try {
    hashedSource = await sourceHash(source, config.rateLimitSecret);
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }
  if (!hashedSource) {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  let rpcResponse: Response;
  try {
    rpcResponse = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/m310_submit_guest_fanbus_registration`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_payload: {
            tripId: guestRequest.tripId,
            firstName: guestRequest.firstName,
            lastName: guestRequest.lastName,
            email: guestRequest.email,
            busPreference: guestRequest.busPreference,
            companions: guestRequest.companions,
            privacyConfirmed: guestRequest.privacyConfirmed,
            termsConfirmed: guestRequest.termsConfirmed
          },
          p_idempotency_key: guestRequest.idempotencyKey,
          p_source_hash: hashedSource
        })
      }
    );
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  let rpcResult: unknown;
  try {
    rpcResult = await rpcResponse.json();
  } catch {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  if (!rpcResponse.ok) {
    const rpcError = isPlainObject(rpcResult) ? rpcResult : {};
    if (rpcError.code === "P3101") {
      return errorResponse(429, "RATE_LIMITED", "Bitte versuche es später erneut.", origin);
    }
    if (rpcError.code === "P0002") {
      return errorResponse(409, "UNAVAILABLE", "Diese Fanbusfahrt ist aktuell nicht verfügbar.", origin);
    }
    if (rpcError.code === "22023") {
      return errorResponse(400, "INVALID_REQUEST", "Die Eingaben sind ungültig.", origin);
    }
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  if (!isPlainObject(rpcResult) || typeof rpcResult.outcome !== "string") {
    return errorResponse(500, "INTERNAL_ERROR", "Die Anfrage konnte nicht verarbeitet werden.", origin);
  }

  return outcomeResponse(rpcResult.outcome, origin);
});

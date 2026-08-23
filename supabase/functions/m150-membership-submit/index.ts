const MAX_BODY_BYTES = 16 * 1024;
const REPLAY_WINDOW_SECONDS = 300;

const TIMESTAMP_HEADER = "X-M150-Timestamp";
const IDEMPOTENCY_HEADER = "X-M150-Idempotency-Key";
const SIGNATURE_HEADER = "X-M150-Signature";

const SUCCESS_RESPONSE = Object.freeze({
  ok: true,
  message: "Der Antrag wurde entgegengenommen."
});

const ERROR_RESPONSE = Object.freeze({
  ok: false,
  message: "Die Anfrage konnte nicht verarbeitet werden."
});

const INPUT_ERROR_CODES = Object.freeze([
  "M150_PUBLIC_INTAKE_INVALID_PAYLOAD",
  "M150_PUBLIC_INTAKE_ADULT_REQUIRED",
  "M150_PUBLIC_INTAKE_DECLARATION_REQUIRED",
  "M150_IDEMPOTENCY_KEY_REUSED"
]);

const RELEASE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const RELEASE_RUN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const RELEASE_ENVIRONMENT_PATTERN = /^[A-Z][A-Z0-9_-]{1,31}$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

type BodyReadResult =
  | { status: "ok"; bytes: Uint8Array }
  | { status: "too_large" | "read_error" };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function successResponse() {
  return jsonResponse(200, SUCCESS_RESPONSE);
}

function errorResponse(status: number) {
  return jsonResponse(status, ERROR_RESPONSE);
}

function hasJsonContentType(request: Request) {
  const contentType = request.headers.get("Content-Type") || "";
  return /^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?\s*$/i
    .test(contentType);
}

function declaredBodyTooLarge(request: Request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength === null) return false;
  if (!/^[0-9]+$/.test(contentLength)) return null;

  const byteLength = Number(contentLength);
  return !Number.isSafeInteger(byteLength) || byteLength > MAX_BODY_BYTES;
}

async function readRawBody(request: Request): Promise<BodyReadResult> {
  if (!request.body) {
    return { status: "ok", bytes: new Uint8Array() };
  }

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
      // The request stream is already unusable; no details are exposed or logged.
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

function lowercaseHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function signatureBytes(signatureHex: string) {
  const pairs = signatureHex.match(/.{2}/g);
  return Uint8Array.from(pairs || [], pair => Number.parseInt(pair, 16));
}

async function sha256Hex(rawBody: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", rawBody);
  return lowercaseHex(new Uint8Array(digest));
}

async function verifySignature(
  secretBytes: Uint8Array,
  suppliedSignature: Uint8Array,
  timestamp: string,
  idempotencyKey: string,
  bodySha256Hex: string
) {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureBase = `${timestamp}\n${idempotencyKey}\n${bodySha256Hex}`;

  return crypto.subtle.verify(
    "HMAC",
    hmacKey,
    suppliedSignature,
    encoder.encode(signatureBase)
  );
}

function isInputRpcError(responseText: string) {
  return INPUT_ERROR_CODES.some(code => responseText.includes(code));
}

function releaseBypassHeaders(request: Request) {
  const token = String(request.headers.get("X-PD-Release-Bypass") || "").trim();
  const runId = String(request.headers.get("X-PD-Release-Run") || "").trim();
  const environment = String(request.headers.get("X-PD-Environment") || "").trim().toUpperCase();
  if (
    !RELEASE_TOKEN_PATTERN.test(token)
    || !RELEASE_RUN_PATTERN.test(runId)
    || !RELEASE_ENVIRONMENT_PATTERN.test(environment)
  ) return {};
  return {
    "X-PD-Release-Bypass": token,
    "X-PD-Release-Run": runId,
    "X-PD-Environment": environment
  };
}

function platformRpcError(responseText: string) {
  if (responseText.includes('"code":"P0902"')) {
    return jsonResponse(423, { ok: false, code: "PLATFORM_READ_ONLY", message: "Anträge sind aktuell vorübergehend pausiert." });
  }
  if (responseText.includes('"code":"P0903"')) {
    return jsonResponse(503, { ok: false, code: "PLATFORM_MAINTENANCE", message: "Die Plattform befindet sich aktuell im Wartungsmodus." });
  }
  if (responseText.includes('"code":"P0901"')) {
    return jsonResponse(503, { ok: false, code: "PLATFORM_WRITE_UNAVAILABLE", message: "Anträge sind aktuell nicht verfügbar." });
  }
  return null;
}

Deno.serve(async request => {
  if (request.method !== "POST") {
    return errorResponse(405);
  }

  if (!hasJsonContentType(request)) {
    return errorResponse(400);
  }

  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
  const suppliedSignatureHex = request.headers.get(SIGNATURE_HEADER);

  if (!timestamp || !/^[0-9]+$/.test(timestamp)) {
    return errorResponse(401);
  }

  if (
    !idempotencyKey
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(idempotencyKey)
  ) {
    return errorResponse(400);
  }

  if (!suppliedSignatureHex || !/^[0-9a-f]{64}$/.test(suppliedSignatureHex)) {
    return errorResponse(401);
  }

  const contentLengthResult = declaredBodyTooLarge(request);
  if (contentLengthResult === null) {
    return errorResponse(400);
  }
  if (contentLengthResult) {
    return errorResponse(413);
  }

  const hmacSecret = Deno.env.get("M150_INTAKE_HMAC_SECRET");
  if (!hmacSecret) {
    return errorResponse(500);
  }
  const hmacSecretBytes = encoder.encode(hmacSecret);
  if (hmacSecretBytes.byteLength < 32) {
    return errorResponse(500);
  }

  const bodyResult = await readRawBody(request);
  if (bodyResult.status === "too_large") {
    return errorResponse(413);
  }
  if (bodyResult.status !== "ok") {
    return errorResponse(400);
  }

  const rawBody = bodyResult.bytes;
  const bodySha256Hex = await sha256Hex(rawBody);

  const suppliedUnixSeconds = Number(timestamp);
  const serverUnixSeconds = Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(suppliedUnixSeconds)
    || Math.abs(serverUnixSeconds - suppliedUnixSeconds) > REPLAY_WINDOW_SECONDS
  ) {
    return errorResponse(401);
  }

  let signatureIsValid = false;
  try {
    signatureIsValid = await verifySignature(
      hmacSecretBytes,
      signatureBytes(suppliedSignatureHex),
      timestamp,
      idempotencyKey,
      bodySha256Hex
    );
  } catch {
    return errorResponse(500);
  }

  if (!signatureIsValid) {
    return errorResponse(401);
  }

  let payload: Record<string, unknown>;
  try {
    const rawJson = decoder.decode(rawBody);
    const parsedPayload: unknown = JSON.parse(rawJson);
    if (
      parsedPayload === null
      || typeof parsedPayload !== "object"
      || Array.isArray(parsedPayload)
    ) {
      return errorResponse(400);
    }
    payload = parsedPayload as Record<string, unknown>;
  } catch {
    return errorResponse(400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(500);
  }

  let rpcResponse: Response;
  try {
    rpcResponse = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/m150_submit_membership_application`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          ...releaseBypassHeaders(request)
        },
        body: JSON.stringify({
          p_payload: payload,
          p_idempotency_key: idempotencyKey
        })
      }
    );
  } catch {
    return errorResponse(500);
  }

  let rpcText: string;
  try {
    rpcText = await rpcResponse.text();
  } catch {
    return errorResponse(500);
  }

  if (!rpcResponse.ok) {
    const platformError = platformRpcError(rpcText);
    if (platformError) return platformError;
    return errorResponse(isInputRpcError(rpcText) ? 400 : 500);
  }

  let rpcData: unknown;
  try {
    rpcData = JSON.parse(rpcText);
  } catch {
    return errorResponse(500);
  }

  if (
    rpcData === null
    || typeof rpcData !== "object"
    || Array.isArray(rpcData)
    || (rpcData as Record<string, unknown>).accepted !== true
    || typeof (rpcData as Record<string, unknown>).created !== "boolean"
  ) {
    return errorResponse(500);
  }

  return successResponse();
});

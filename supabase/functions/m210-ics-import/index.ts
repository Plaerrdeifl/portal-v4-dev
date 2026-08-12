import {
  IcsValidationError,
  MAX_ICS_BYTES,
  SOURCE_KEY,
  parseIcsFile,
  plausibleIcsMimeType,
  previewFingerprint
} from "./ics-parser.js";

const MAX_REQUEST_BYTES = MAX_ICS_BYTES + 64 * 1024;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

type RuntimeConfig = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  allowedOrigins: ReadonlySet<string>;
};

type BodyReadResult =
  | { status: "ok"; bytes: Uint8Array }
  | { status: "too_large" | "read_error" };

function loadConfig(): RuntimeConfig | null {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const rawOrigins = String(Deno.env.get("M210_ALLOWED_ORIGINS") || "").trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !rawOrigins) return null;

  try {
    const parsed = new URL(supabaseUrl);
    const local = parsed.protocol === "http:" && ["127.0.0.1", "localhost", "kong"].includes(parsed.hostname);
    if ((parsed.protocol !== "https:" && !local) || parsed.origin !== supabaseUrl || parsed.pathname !== "/") return null;
  } catch {
    return null;
  }

  const origins = rawOrigins.split(",").map(value => value.trim());
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const local = parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname);
      if ((parsed.protocol !== "https:" && !local) || parsed.origin !== origin || parsed.pathname !== "/") return null;
    } catch {
      return null;
    }
  }
  return { supabaseUrl, anonKey, serviceRoleKey, allowedOrigins: new Set(origins) };
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function jsonResponse(status: number, body: Record<string, unknown>, origin?: string) {
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
  return jsonResponse(status, { ok: false, error: { code, message } }, origin);
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  return match && match[1].length <= 8192 ? match[1] : null;
}

async function authenticatedUserId(token: string, config: RuntimeConfig) {
  let response: Response;
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const user: unknown = await response.json();
    if (!user || typeof user !== "object") return null;
    const id = (user as Record<string, unknown>).id;
    return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function rpc(name: string, payload: Record<string, unknown>, config: RuntimeConfig) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000)
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("INVALID_RPC_RESPONSE");
  }
  if (!response.ok) {
    const error = result && typeof result === "object" ? result as Record<string, unknown> : {};
    const code = typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
    const message = typeof error.message === "string" ? error.message : "Der Import konnte nicht verarbeitet werden.";
    const rpcError = new Error(message) as Error & { code: string };
    rpcError.code = code;
    throw rpcError;
  }
  return result as Record<string, unknown>;
}

function declaredRequestTooLarge(request: Request) {
  const raw = request.headers.get("Content-Length");
  if (raw === null) return false;
  if (!/^\d+$/.test(raw)) return true;
  const size = Number(raw);
  return !Number.isSafeInteger(size) || size > MAX_REQUEST_BYTES;
}

async function readRawBody(request: Request): Promise<BodyReadResult> {
  if (!request.body) return { status: "ok", bytes: new Uint8Array() };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { status: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* unreadable request body */ }
    return { status: "read_error" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: "ok", bytes };
}

function mapRpcError(error: Error & { code?: string }, origin: string) {
  if (error.code === "42501") return errorResponse(403, "FORBIDDEN", "Die Berechtigung events.manage ist erforderlich.", origin);
  if (error.code === "P2101") return errorResponse(409, "PREVIEW_STALE", "Die Vorschau ist nicht mehr aktuell. Bitte analysiere die Datei erneut.", origin);
  if (error.code === "22023") return errorResponse(400, "INVALID_IMPORT", error.message, origin);
  return errorResponse(500, "INTERNAL_ERROR", "Der Import konnte nicht verarbeitet werden.", origin);
}

Deno.serve(async request => {
  const config = loadConfig();
  if (!config) return errorResponse(500, "INTERNAL_ERROR", "Der Importdienst ist nicht konfiguriert.");

  const origin = request.headers.get("Origin") || "";
  if (!origin || !config.allowedOrigins.has(origin)) {
    return errorResponse(403, "ORIGIN_REJECTED", "Die Anfrage ist nicht zulässig.");
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== "POST") return errorResponse(405, "METHOD_NOT_ALLOWED", "Die Anfrage ist nicht zulässig.", origin);
  if (declaredRequestTooLarge(request)) return errorResponse(413, "REQUEST_TOO_LARGE", "Die Anfrage ist zu groß.", origin);
  if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get("Content-Type") || "")) {
    return errorResponse(400, "INVALID_REQUEST", "Die Importanfrage ist ungültig.", origin);
  }

  const token = bearerToken(request);
  if (!token) return errorResponse(401, "AUTH_REQUIRED", "Anmeldung erforderlich.", origin);
  const actorId = await authenticatedUserId(token, config);
  if (!actorId) return errorResponse(401, "AUTH_REQUIRED", "Anmeldung erforderlich.", origin);

  const body = await readRawBody(request);
  if (body.status === "too_large") return errorResponse(413, "REQUEST_TOO_LARGE", "Die Anfrage ist zu groß.", origin);
  if (body.status !== "ok") return errorResponse(400, "INVALID_REQUEST", "Die Importanfrage ist ungültig.", origin);

  let form: FormData;
  try {
    form = await new Response(body.bytes, {
      headers: { "Content-Type": request.headers.get("Content-Type") || "" }
    }).formData();
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Die Importanfrage ist ungültig.", origin);
  }
  const action = form.get("action");
  const sourceKey = form.get("sourceKey");
  const file = form.get("file");
  const suppliedFingerprint = form.get("previewFingerprint");
  if ((action !== "preview" && action !== "confirm") || sourceKey !== SOURCE_KEY || !(file instanceof File)) {
    return errorResponse(400, "INVALID_REQUEST", "Die Importanfrage ist ungültig.", origin);
  }
  if (file.size > MAX_ICS_BYTES) return errorResponse(413, "FILE_TOO_LARGE", "Die ICS-Datei darf höchstens 1 MiB groß sein.", origin);
  if (!plausibleIcsMimeType(file.type)) {
    return errorResponse(400, "INVALID_FILE_TYPE", "Der Dateityp ist nicht mit einem ICS-Kalender kompatibel.", origin);
  }
  if (action === "confirm" && (typeof suppliedFingerprint !== "string" || !FINGERPRINT_PATTERN.test(suppliedFingerprint))) {
    return errorResponse(400, "INVALID_REQUEST", "Der Vorschau-Fingerprint fehlt oder ist ungültig.", origin);
  }

  let parsed;
  try {
    parsed = await parseIcsFile(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (error) {
    if (error instanceof IcsValidationError) return errorResponse(400, error.code, error.message, origin);
    return errorResponse(400, "INVALID_ICS", "Die ICS-Datei konnte nicht verarbeitet werden.", origin);
  }

  try {
    const preview = await rpc("m210_ics_import_preview", {
      p_actor: actorId,
      p_source_type: parsed.sourceType,
      p_source_key: parsed.sourceKey,
      p_records: parsed.records
    }, config);
    const state = preview.state;
    const fingerprint = await previewFingerprint(parsed, state);

    if (action === "preview") {
      const { state: _state, ...safePreview } = preview;
      return jsonResponse(200, { ok: true, data: { ...safePreview, previewFingerprint: fingerprint } }, origin);
    }
    if (fingerprint !== suppliedFingerprint) {
      return errorResponse(409, "PREVIEW_STALE", "Die Vorschau ist nicht mehr aktuell. Bitte analysiere die Datei erneut.", origin);
    }

    const result = await rpc("m210_ics_import_confirm", {
      p_actor: actorId,
      p_source_type: parsed.sourceType,
      p_source_key: parsed.sourceKey,
      p_original_filename: parsed.originalFilename,
      p_file_sha256: parsed.fileSha256,
      p_file_size: parsed.fileSize,
      p_records: parsed.records,
      p_expected_state: state,
      p_preview_fingerprint: fingerprint
    }, config);
    return jsonResponse(200, { ok: true, data: result }, origin);
  } catch (error) {
    return mapRpcError(error as Error & { code?: string }, origin);
  }
});

const RUNTIME_CONTRACTS = {
  "tpieykhhawszlzsoflnl.supabase.co": {
    environment: "DEV",
    portalOrigin: "https://dev.plaerrdeifl.de"
  },
  "wplescvhlgctynkfwvrj.supabase.co": {
    environment: "PROD",
    portalOrigin: "https://portal.plaerrdeifl.de"
  }
} as const;

const BUCKET = "social-media-generator-library";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 128 * 1024;
type JsonObject = Record<string, unknown>;

type RuntimeConfig = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  environment: "DEV" | "PROD";
  portalOrigin: string;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function jsonResponse(status: number, body: JsonObject, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function fail(status: number, code: string, message: string, origin: string) {
  return jsonResponse(status, { ok: false, error: { code, message } }, origin);
}

function configuredSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isObject(parsed)) {
        const candidate = [parsed.default, parsed.secret, parsed.service_role, ...Object.values(parsed)]
          .find(value => typeof value === "string" && value.trim());
        if (typeof candidate === "string") return candidate.trim();
      }
    } catch { /* invalid below */ }
    return "";
  }
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

function loadConfig(): RuntimeConfig | null {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceRoleKey = configuredSecretKey();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || /[\r\n]/.test(serviceRoleKey)) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.origin !== supabaseUrl || url.pathname !== "/") return null;
    const contract = RUNTIME_CONTRACTS[url.hostname as keyof typeof RUNTIME_CONTRACTS];
    return contract ? { supabaseUrl, anonKey, serviceRoleKey, ...contract } : null;
  } catch {
    return null;
  }
}

function bearerToken(request: Request) {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("Authorization") || "");
  return match && match[1].length <= 8192 ? match[1] : null;
}

function encodedObjectName(value: string) {
  return value.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

async function readBoundedBody(request: Request) {
  const declared = request.headers.get("Content-Length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) return null;
  if (!request.body) return new Uint8Array();
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
        try { await reader.cancel(); } catch { /* bounded */ }
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function inspectImage(bytes: Uint8Array): { mimeType: string; width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50
      && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[12] === 0x49
      && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52) {
    return { mimeType: "image/png", width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }
  if (bytes.byteLength >= 30 && bytes[0] === 0x52 && bytes[1] === 0x49
      && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57
      && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8X") return { mimeType: "image/webp", width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
    if (chunk === "VP8L" && bytes[20] === 0x2f) return {
      mimeType: "image/webp",
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    };
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { mimeType: "image/webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
  }
  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = view.getUint16(offset + 2, false);
      if (length < 2 || offset + 2 + length > bytes.byteLength) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { mimeType: "image/jpeg", height: view.getUint16(offset + 5, false), width: view.getUint16(offset + 7, false) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function portalApi(config: RuntimeConfig, token: string, action: string, payload: JsonObject) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/pd_api`, {
    method: "POST",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_action: action, p_payload: payload }),
    signal: AbortSignal.timeout(20_000)
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(result) || result.ok !== true || !isObject(result.data)) return null;
  return result.data;
}

async function serviceRpc(config: RuntimeConfig, name: string, payload: JsonObject) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000)
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(result)) throw new Error("RPC_FAILED");
  return result;
}

async function storageUpload(config: RuntimeConfig, path: string, mime: string, bytes: Uint8Array) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(path)}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, "Content-Type": mime, "x-upsert": "false" },
    body: bytes, signal: AbortSignal.timeout(60_000)
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error("UPLOAD_FAILED");
}

async function storageDownload(config: RuntimeConfig, path: string) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(path)}`, {
    headers: { apikey: config.serviceRoleKey }, signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) { await response.body?.cancel(); return null; }
  return new Uint8Array(await response.arrayBuffer());
}

async function storageDelete(config: RuntimeConfig, path: string) {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(path)}`, {
      method: "DELETE", headers: { apikey: config.serviceRoleKey }, signal: AbortSignal.timeout(10_000)
    });
    await response.body?.cancel();
  } catch { /* best effort */ }
}

async function preview(request: Request, config: RuntimeConfig, token: string) {
  const mediaId = new URL(request.url).searchParams.get("mediaId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return fail(400, "MEDIA_ID_INVALID", "Das Medium ist ungültig.", config.portalOrigin);
  const auth = await portalApi(config, token, "social_media_generator_media_asset_authorize", { mediaId });
  const path = String(auth?.storageObjectPath || "");
  if (!auth || auth.storageBucket !== BUCKET || !/^library\/[0-9a-f-]{36}\/original[.](png|jpg|webp)$/i.test(path)) {
    return fail(404, "MEDIA_NOT_FOUND", "Das Medium wurde nicht gefunden.", config.portalOrigin);
  }
  const bytes = await storageDownload(config, path);
  if (!bytes || bytes.byteLength !== Number(auth.sizeBytes) || await sha256Hex(bytes) !== auth.sha256) {
    return fail(409, "MEDIA_INTEGRITY_INVALID", "Das Medium ist nicht konsistent.", config.portalOrigin);
  }
  return new Response(bytes, { status: 200, headers: {
    ...corsHeaders(config.portalOrigin), "Content-Type": String(auth.mimeType),
    "Content-Length": String(bytes.byteLength), "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  }});
}

Deno.serve(async request => {
  const config = loadConfig();
  if (!config) return new Response("Internal error", { status: 500 });
  const origin = request.headers.get("Origin") || "";
  if (origin !== config.portalOrigin) return fail(403, "ORIGIN_REJECTED", "Die Anfrage ist nicht zulässig.", config.portalOrigin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(config.portalOrigin) });
  const token = bearerToken(request);
  if (!token) return fail(401, "AUTH_REQUIRED", "Anmeldung erforderlich.", config.portalOrigin);
  if (request.method === "GET") return preview(request, config, token);
  if (request.method !== "POST" || !/^multipart\/form-data;\s*boundary=/i.test(request.headers.get("Content-Type") || "")) {
    return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.", config.portalOrigin);
  }
  const body = await readBoundedBody(request);
  if (!body) return fail(413, "REQUEST_TOO_LARGE", "Die Datei darf höchstens 10 MiB groß sein.", config.portalOrigin);
  let form: FormData;
  try { form = await new Response(body, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData(); }
  catch { return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.", config.portalOrigin); }
  const file = form.get("file");
  const type = String(form.get("type") || "UPLOAD").trim().toUpperCase();
  const title = String(form.get("title") || "").trim();
  if (form.get("action") !== "upload" || !(file instanceof File)
      || !["UPLOAD", "GENERAL", "BACKGROUND"].includes(type)
      || title.length < 1 || title.length > 160 || file.size < 1 || file.size > MAX_IMAGE_BYTES
      || file.name.length < 1 || file.name.length > 255 || /[\x00-\x1f/\\]/.test(file.name)) {
    return fail(400, "INVALID_FILE", "Bitte eine gültige PNG-, JPEG- oder WebP-Datei auswählen.", config.portalOrigin);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectImage(bytes);
  if (!inspected || inspected.width < 1 || inspected.height < 1 || inspected.width > 12000
      || inspected.height > 12000 || inspected.width * inspected.height > 80000000) {
    return fail(400, "INVALID_IMAGE", "Die Bilddatei oder ihre Abmessungen sind ungültig.", config.portalOrigin);
  }
  if (file.type && !["application/octet-stream", inspected.mimeType, ...(inspected.mimeType === "image/jpeg" ? ["image/jpg"] : [])].includes(file.type)) {
    return fail(400, "MIME_MISMATCH", "Der gemeldete Dateityp passt nicht zum Bildinhalt.", config.portalOrigin);
  }
  const authorization = await portalApi(config, token, "social_media_generator_media_upload_start", {
    type, title, filename: file.name, mimeType: inspected.mimeType,
    sizeBytes: bytes.byteLength, width: inspected.width, height: inspected.height
  });
  const uploadId = String(authorization?.uploadId || "");
  const storagePath = String(authorization?.storageObjectPath || "");
  if (!authorization || authorization.environment !== config.environment || authorization.storageBucket !== BUCKET
      || !/^[0-9a-f-]{36}$/i.test(uploadId)
      || !/^library\/[0-9a-f-]{36}\/original[.](png|jpg|webp)$/i.test(storagePath)) {
    return fail(403, "UPLOAD_NOT_AUTHORIZED", "Der Upload ist nicht zulässig.", config.portalOrigin);
  }
  const sha256 = await sha256Hex(bytes);
  try {
    await storageUpload(config, storagePath, inspected.mimeType, bytes);
    const queued = await serviceRpc(config, "pd_social_media_library_upload_queue", {
      p_upload_id: uploadId, p_storage_path: storagePath, p_sha256: sha256,
      p_size_bytes: bytes.byteLength, p_mime_type: inspected.mimeType,
      p_width: inspected.width, p_height: inspected.height
    });
    return jsonResponse(202, { ok: true, data: queued }, config.portalOrigin);
  } catch {
    await storageDelete(config, storagePath);
    return fail(500, "UPLOAD_FAILED", "Das Bild konnte nicht zur Verarbeitung übergeben werden.", config.portalOrigin);
  }
});

import {
  STICKER_HEIGHT,
  STICKER_SOURCE_MAX_BYTES,
  STICKER_WIDTH,
  StickerProcessingError,
  inspectStickerSource,
  normalizeStickerImage,
  validateStaticStickerWebp
} from "./image-processing.mjs";

const SUPABASE_HOST = "tpieykhhawszlzsoflnl.supabase.co";
const PORTAL_ORIGIN = "https://dev.plaerrdeifl.de";
const BUCKET = "liveticker-whatsapp-stickers";
const MAX_REQUEST_BYTES = STICKER_SOURCE_MAX_BYTES + 64 * 1024;
const DECLARED_SOURCE_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

type JsonObject = Record<string, unknown>;
type RuntimeConfig = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": PORTAL_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function jsonResponse(status: number, body: JsonObject, cors = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(cors ? corsHeaders() : {})
    }
  });
}

function fail(status: number, code: string, message: string, cors = false) {
  return jsonResponse(status, { ok: false, error: { code, message } }, cors);
}

function configuredSupabaseSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (rawSecretKeys) {
    try {
      const parsed: unknown = JSON.parse(rawSecretKeys);
      if (isObject(parsed)) {
        const candidate = [parsed.default, parsed.secret, parsed.service_role, ...Object.values(parsed)]
          .find(value => typeof value === "string" && value.trim());
        if (typeof candidate === "string") return candidate.trim();
      }
    } catch { /* invalid configuration below */ }
    return "";
  }
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

function loadConfig(): RuntimeConfig | null {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceRoleKey = configuredSupabaseSecretKey();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || /[\r\n]/.test(serviceRoleKey)) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" || url.origin !== supabaseUrl || url.pathname !== "/" || url.hostname !== SUPABASE_HOST) return null;
  } catch {
    return null;
  }
  return { supabaseUrl, anonKey, serviceRoleKey };
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
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function portalApi(config: RuntimeConfig, token: string, action: string, payload: JsonObject) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/pd_api`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
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
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000)
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(result)) throw new Error("RPC_FAILED");
  return result;
}

async function storageUpload(config: RuntimeConfig, objectName: string, bytes: Uint8Array) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(objectName)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      "Content-Type": "image/webp",
      "x-upsert": "false"
    },
    body: bytes,
    signal: AbortSignal.timeout(20_000)
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error("UPLOAD_FAILED");
}

async function storageDownload(config: RuntimeConfig, objectName: string) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(objectName)}`, {
    headers: { apikey: config.serviceRoleKey },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return validateStaticStickerWebp(bytes) ? bytes : null;
}

async function storageDelete(config: RuntimeConfig, objectName: string) {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(objectName)}`, {
      method: "DELETE",
      headers: { apikey: config.serviceRoleKey },
      signal: AbortSignal.timeout(10_000)
    });
    await response.body?.cancel();
  } catch { /* best-effort upload rollback */ }
}

async function storageDeleteManaged(config: RuntimeConfig, objectName: string) {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(objectName)}`, {
      method: "DELETE",
      headers: { apikey: config.serviceRoleKey },
      signal: AbortSignal.timeout(10_000)
    });
    await response.body?.cancel();
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

function stickerSlug(name: string, id: string) {
  const base = name.normalize("NFKD").replace(/ß/g, "ss").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-+$/g, "") || "sticker";
  return `${base}-${id.replace(/-/g, "").slice(0, 8)}`;
}

async function preview(config: RuntimeConfig, token: string, request: Request) {
  const stickerId = new URL(request.url).searchParams.get("stickerId") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stickerId)) {
    return fail(400, "INVALID_STICKER_ID", "Die Sticker-ID ist ungültig.", true);
  }
  const authorization = await portalApi(config, token, "liveticker_whatsapp_sticker_asset_authorize", { stickerId });
  const storagePath = String(authorization?.storagePath || "");
  if (!authorization || !/^stickers\/dev\/[0-9a-f-]{36}[.]webp$/i.test(storagePath)) {
    return fail(404, "STICKER_NOT_FOUND", "Der Sticker wurde nicht gefunden.", true);
  }
  const bytes = await storageDownload(config, storagePath);
  if (!bytes || bytes.byteLength !== Number(authorization.fileSize)) {
    return fail(409, "STICKER_ASSET_INVALID", "Das Sticker-Asset ist nicht konsistent.", true);
  }
  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function upload(config: RuntimeConfig, token: string, request: Request) {
  if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get("Content-Type") || "")) {
    return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.", true);
  }
  const body = await readBoundedBody(request);
  if (!body) return fail(413, "REQUEST_TOO_LARGE", "Der Sticker ist zu groß.", true);
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch {
    return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.", true);
  }
  if (form.get("action") !== "upload") return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.", true);
  const name = String(form.get("name") || "").trim();
  const file = form.get("file");
  if (name.length < 1 || name.length > 80 || !(file instanceof File)) {
    return fail(400, "INVALID_FILE", "Bitte Name und eine gültige Sticker-Quelldatei angeben.", true);
  }
  const declaredMimeType = String(file.type || "").toLowerCase();
  if (!DECLARED_SOURCE_MIME_TYPES.has(declaredMimeType)) {
    return fail(400, "INVALID_FILE_TYPE", "Sticker können als PNG, JPG/JPEG oder WebP hochgeladen werden.", true);
  }
  if (file.size < 1 || file.size > STICKER_SOURCE_MAX_BYTES) {
    return fail(413, "SOURCE_TOO_LARGE", "Die Quelldatei darf höchstens 5 MiB groß sein.", true);
  }
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  let source;
  try {
    source = inspectStickerSource(sourceBytes);
  } catch (error) {
    if (error instanceof StickerProcessingError) return fail(
      error.code === "SOURCE_TOO_LARGE" ? 413 : 400,
      error.code,
      error.message,
      true
    );
    return fail(400, "INVALID_IMAGE", "Die Datei ist kein unterstütztes, lesbares Bild.", true);
  }
  const normalizedDeclaredMime = declaredMimeType === "image/jpg" ? "image/jpeg" : declaredMimeType;
  if (normalizedDeclaredMime && normalizedDeclaredMime !== "application/octet-stream"
      && normalizedDeclaredMime !== source.mimeType) {
    return fail(400, "MIME_TYPE_MISMATCH", "Dateiinhalt und angegebener Bildtyp passen nicht zusammen.", true);
  }
  const authorization = await portalApi(config, token, "liveticker_whatsapp_sticker_upload_authorize", {
    name,
    sourceMimeType: source.mimeType,
    sourceSize: sourceBytes.byteLength
  });
  const actorId = String(authorization?.actorId || "");
  if (!authorization || authorization.environment !== "DEV" || authorization.name !== name
      || authorization.sourceMimeType !== source.mimeType
      || Number(authorization.sourceSize) !== sourceBytes.byteLength
      || !/^[0-9a-f-]{36}$/i.test(actorId)) {
    return fail(403, "FORBIDDEN", "Der Sticker darf nicht hochgeladen werden.", true);
  }
  let normalized;
  try {
    normalized = await normalizeStickerImage(sourceBytes);
  } catch (error) {
    if (error instanceof StickerProcessingError) return fail(422, error.code, error.message, true);
    return fail(422, "STICKER_PROCESSING_FAILED", "Der Sticker konnte nicht sicher aufbereitet werden.", true);
  }
  const bytes = normalized.bytes;
  const stickerId = crypto.randomUUID();
  const storagePath = `stickers/dev/${stickerId}.webp`;
  const slug = stickerSlug(name, stickerId);
  const sha256 = await sha256Hex(bytes);
  try {
    await storageUpload(config, storagePath, bytes);
    const sticker = await serviceRpc(config, "pd_liveticker_whatsapp_sticker_activate", {
      p_actor: actorId,
      p_sticker_id: stickerId,
      p_name: name,
      p_slug: slug,
      p_storage_path: storagePath,
      p_mime_type: "image/webp",
      p_sha256: sha256,
      p_file_size: bytes.byteLength,
      p_width: STICKER_WIDTH,
      p_height: STICKER_HEIGHT
    });
    return jsonResponse(200, { ok: true, data: { sticker } }, true);
  } catch {
    await storageDelete(config, storagePath);
    return fail(500, "STICKER_UPLOAD_FAILED", "Der Sticker konnte nicht gespeichert werden.", true);
  }
}

async function removeSticker(config: RuntimeConfig, token: string, request: Request) {
  const stickerId = new URL(request.url).searchParams.get("stickerId") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stickerId)) {
    return fail(400, "INVALID_STICKER_ID", "Die Sticker-ID ist ungültig.", true);
  }

  const authorization = await portalApi(
    config,
    token,
    "liveticker_whatsapp_sticker_delete_authorize",
    { stickerId }
  );
  const actorId = String(authorization?.actorId || "");
  const storagePath = String(authorization?.storagePath || "");
  if (!authorization
      || authorization.environment !== "DEV"
      || authorization.stickerId !== stickerId
      || !/^[0-9a-f-]{36}$/i.test(actorId)
      || !/^stickers\/dev\/[0-9a-f-]{36}[.]webp$/i.test(storagePath)) {
    return fail(403, "FORBIDDEN", "Der Sticker darf nicht gelöscht werden.", true);
  }

  let deleted;
  try {
    deleted = await serviceRpc(config, "pd_liveticker_whatsapp_sticker_delete", {
      p_actor: actorId,
      p_sticker_id: stickerId
    });
  } catch {
    return fail(409, "STICKER_DELETE_FAILED", "Der Sticker wird bereits verwendet oder konnte nicht gelöscht werden.", true);
  }

  if (deleted.deleted !== true
      || String(deleted.stickerId || "") !== stickerId
      || String(deleted.storagePath || "") !== storagePath) {
    return fail(500, "STICKER_DELETE_FAILED", "Der Sticker konnte nicht sicher gelöscht werden.", true);
  }

  const storageDeleted = await storageDeleteManaged(config, storagePath);
  if (!storageDeleted) console.warn("Sticker metadata deleted but storage cleanup failed", { stickerId });
  return jsonResponse(200, { ok: true, data: { deleted: true, stickerId, storageDeleted } }, true);
}

Deno.serve(async request => {
  const config = loadConfig();
  if (!config) return fail(500, "CONFIG_INVALID", "Der DEV-Stickerdienst ist nicht konfiguriert.");
  const origin = request.headers.get("Origin") || "";
  if (origin !== PORTAL_ORIGIN) return fail(403, "ORIGIN_REJECTED", "Die Anfrage ist nicht zulässig.");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  const token = bearerToken(request);
  if (!token) return fail(401, "AUTH_REQUIRED", "Anmeldung erforderlich.", true);
  if (request.method === "GET") return preview(config, token, request);
  if (request.method === "POST") return upload(config, token, request);
  if (request.method === "DELETE") return removeSticker(config, token, request);
  return fail(405, "METHOD_NOT_ALLOWED", "Die Anfrage ist nicht zulässig.", true);
});

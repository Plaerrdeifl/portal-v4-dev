const DEV_ORIGIN = "https://dev.plaerrdeifl.de";
const EXPECTED_SUPABASE_HOST = "tpieykhhawszlzsoflnl.supabase.co";
const BUCKET = "m340-publishing-templates";
const MAX_SVG_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_SVG_BYTES + 128 * 1024;
const REQUIRED_IDS = [
  "m340-destination",
  "m340-trip-label-brush",
  "m340-trip-label-text",
  "text34",
  "m340-date",
  "m340-game-start",
  "m340-price",
  "m340-registration-deadline-date",
  "m340-registration-deadline-time",
  "m340-boarding-1-time",
  "m340-boarding-1-place",
  "m340-boarding-1-detail",
  "m340-boarding-2-time",
  "m340-boarding-2-place",
  "m340-boarding-2-detail",
  "m340-contact-pascal-name",
  "m340-contact-pascal-phone",
  "m340-contact-luca-name",
  "m340-contact-luca-phone",
  "m340-qr-slot",
  "m340-qr-quiet-zone",
  "m340-qr-vector"
] as const;
const DIMENSIONS: Record<string, [number, number]> = {
  POST: [1080, 1350],
  STORY: [1080, 1920],
  LED: [1920, 1080]
};

type JsonObject = Record<string, unknown>;
type RuntimeConfig = { supabaseUrl: string; anonKey: string; serviceRoleKey: string };

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": DEV_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function jsonResponse(status: number, body: JsonObject, cors = true) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(cors ? corsHeaders() : {})
    }
  });
}

function fail(status: number, code: string, message: string, cors = true) {
  return jsonResponse(status, { ok: false, error: { code, message } }, cors);
}

function configuredSupabaseSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (rawSecretKeys) {
    try {
      const parsed: unknown = JSON.parse(rawSecretKeys);
      if (isObject(parsed)) {
        const preferred = [parsed.default, parsed.secret, parsed.service_role];
        const candidate = [...preferred, ...Object.values(parsed)]
          .find(value => typeof value === "string" && value.trim().length > 0);
        if (typeof candidate === "string") return candidate.trim();
      }
    } catch { /* invalid config below */ }
    return "";
  }
  return String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

function loadConfig(): RuntimeConfig | null {
  const rawUrl = String(Deno.env.get("SUPABASE_URL") || "").trim().replace(/\/+$/, "");
  const anonKey = String(Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceRoleKey = configuredSupabaseSecretKey();
  if (!rawUrl || !anonKey || !serviceRoleKey || /[\r\n]/.test(serviceRoleKey)) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== EXPECTED_SUPABASE_HOST || url.origin !== rawUrl || url.pathname !== "/") return null;
  } catch {
    return null;
  }
  return { supabaseUrl: rawUrl, anonKey, serviceRoleKey };
}

function bearerToken(request: Request) {
  const value = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
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

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const match = /^([0-9]+(?:\.[0-9]+)?)(?:px)?$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function attr(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return match?.[1];
}

function validateSvg(bytes: Uint8Array, kind: string) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "Die SVG-Datei ist nicht gültig UTF-8-kodiert.";
  }
  if (bytes.byteLength < 1000 || bytes.byteLength > MAX_SVG_BYTES) return "Die SVG-Datei hat eine ungültige Größe.";
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return "DOCTYPE/ENTITY ist in Flyer-Vorlagen nicht erlaubt.";
  if (/<\s*(?:script|foreignObject|iframe|object|embed|audio|video|link)\b/i.test(text)) return "Die SVG-Datei enthält nicht erlaubte Elemente.";
  if (/\son[a-z][a-z0-9_-]*\s*=/i.test(text) || /javascript\s*:/i.test(text)) return "Die SVG-Datei enthält nicht erlaubte aktive Inhalte.";

  for (const match of text.matchAll(/\b(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (href.startsWith("#")) continue;
    if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(href)) continue;
    return "Externe Ressourcen sind in Flyer-Vorlagen nicht erlaubt.";
  }

  const rootTag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!rootTag || !/<\/svg\s*>\s*$/i.test(text)) return "Die Datei ist kein vollständiges SVG-Dokument.";
  const expected = DIMENSIONS[kind];
  if (!expected) return "Unbekanntes Flyerformat.";
  const width = parseNumber(attr(rootTag, "width"));
  const height = parseNumber(attr(rootTag, "height"));
  const viewBoxRaw = attr(rootTag, "viewBox") || "";
  const viewBox = viewBoxRaw.trim().split(/[ ,]+/).map(Number);
  if (width !== expected[0] || height !== expected[1] || viewBox.length !== 4
      || viewBox.some(value => !Number.isFinite(value))
      || viewBox[0] !== 0 || viewBox[1] !== 0 || viewBox[2] !== expected[0] || viewBox[3] !== expected[1]) {
    return `Die Vorlage muss exakt ${expected[0]} × ${expected[1]} Pixel groß sein.`;
  }

  const ids = new Map<string, number>();
  for (const match of text.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    ids.set(match[1], (ids.get(match[1]) || 0) + 1);
  }
  for (const id of REQUIRED_IDS) {
    if (ids.get(id) !== 1) return `Technisches Vorlagenelement fehlt oder ist doppelt: ${id}`;
  }
  const brushTag = new RegExp(`<rect\\b[^>]*\\bid\\s*=\\s*["']m340-trip-label-brush["'][^>]*>`, "i").exec(text)?.[0]
    || new RegExp(`<rect\\b[^>]*\\bid\\s*=\\s*["']m340-trip-label-brush["'][^>]*/>`, "i").exec(text)?.[0];
  if (!brushTag || attr(brushTag, "transform") || ["x", "y", "width", "height"].some(name => parseNumber(attr(brushTag, name)) === null)) {
    return "Der dynamische Brush-Platzhalter ist ungültig.";
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
    headers: {
      apikey: config.serviceRoleKey,
      "Content-Type": "application/json"
    },
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
      "Content-Type": "image/svg+xml",
      "x-upsert": "false"
    },
    body: bytes,
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("UPLOAD_FAILED");
  }
  await response.body?.cancel();
}

async function storageDelete(config: RuntimeConfig, objectName: string) {
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${BUCKET}/${encodedObjectName(objectName)}`, {
      method: "DELETE",
      headers: { apikey: config.serviceRoleKey },
      signal: AbortSignal.timeout(10_000)
    });
    await response.body?.cancel();
  } catch { /* best effort rollback */ }
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin") || "";
  if (origin !== DEV_ORIGIN) return fail(403, "ORIGIN_REJECTED", "Die Anfrage ist nicht zulässig.", false);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED", "Die Anfrage ist nicht zulässig.");

  const config = loadConfig();
  if (!config) return fail(500, "CONFIG_INVALID", "Der Vorlagendienst ist nicht konfiguriert.");
  const token = bearerToken(request);
  if (!token) return fail(401, "AUTH_REQUIRED", "Anmeldung erforderlich.");
  if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get("Content-Type") || "")) {
    return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.");
  }

  const body = await readBoundedBody(request);
  if (!body) return fail(413, "REQUEST_TOO_LARGE", "Die Datei ist zu groß.");
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch {
    return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.");
  }
  if (form.get("action") !== "upload") return fail(400, "INVALID_REQUEST", "Die Upload-Anfrage ist ungültig.");
  const kind = String(form.get("kind") || "").trim().toUpperCase();
  const file = form.get("file");
  if (!DIMENSIONS[kind] || !(file instanceof File) || !/^[A-Za-z0-9ÄÖÜäöüß._ -]+\.svg$/.test(file.name)) {
    return fail(400, "INVALID_FILE", "Bitte eine gültige SVG-Vorlage auswählen.");
  }
  if (file.size < 1000 || file.size > MAX_SVG_BYTES) return fail(413, "INVALID_FILE_SIZE", "Die SVG-Datei darf höchstens 5 MiB groß sein.");
  if (file.type && !["image/svg+xml", "application/xml", "text/xml", "application/octet-stream"].includes(file.type)) {
    return fail(400, "INVALID_FILE_TYPE", "Der Dateityp ist keine SVG-Datei.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validationError = validateSvg(bytes, kind);
  if (validationError) return fail(400, "TEMPLATE_CONTRACT_INVALID", validationError);

  const authorization = await portalApi(config, token, "fanbus_publishing_template_upload_authorize", { kind, filename: file.name });
  if (!authorization) return fail(403, "FORBIDDEN", "Die Vorlage darf nicht ersetzt werden.");
  const actorId = String(authorization.actorId || "");
  const environment = String(authorization.environment || "");
  if (!/^[0-9a-f-]{36}$/i.test(actorId) || environment !== "DEV" || authorization.kind !== kind || authorization.filename !== file.name) {
    return fail(403, "FORBIDDEN", "Die Vorlage darf nicht ersetzt werden.");
  }

  const versionId = crypto.randomUUID();
  const objectName = `versions/dev/${actorId}/${versionId}.svg`;
  const sha256 = await sha256Hex(bytes);
  try {
    await storageUpload(config, objectName, bytes);
    const activated = await serviceRpc(config, "pd_m340_fanbus_publishing_template_activate", {
      p_actor: actorId,
      p_kind: kind,
      p_object_name: objectName,
      p_original_filename: file.name,
      p_sha256: sha256,
      p_bytes: bytes.byteLength
    });
    return jsonResponse(200, { ok: true, data: { ...activated, source: "CUSTOM" } });
  } catch {
    await storageDelete(config, objectName);
    return fail(500, "TEMPLATE_UPLOAD_FAILED", "Die SVG-Vorlage konnte nicht aktiviert werden.");
  }
});

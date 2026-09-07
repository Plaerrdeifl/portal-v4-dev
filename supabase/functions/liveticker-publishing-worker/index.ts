const MAX_BODY_BYTES = 65_536;
const MAX_SECRET_LENGTH = 2_048;
const MIN_WORKER_TOKEN_BYTES = 32;
const WORKER_TOKEN_HEADER = "X-Liveticker-Worker-Token";
const EXPECTED_TOKEN_SHA256 = "b70a4b43dbb9d1e65050fab9199b10b8f6ae67f03ba879cbec1484ee2548085d";
const CLAIM_RPC = "pd_liveticker_graphic_worker_claim";
const COMPLETE_RPC = "pd_liveticker_graphic_worker_complete";
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

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map(item => item.toString(16).padStart(2, "0")).join("");
}
async function authorized(request: Request) {
  const token = request.headers.get(WORKER_TOKEN_HEADER) || "";
  if (token.length > MAX_SECRET_LENGTH || encoder.encode(token).byteLength < MIN_WORKER_TOKEN_BYTES) return false;
  const actual = await sha256Hex(token);
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
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new GatewayError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new GatewayError();
  }
}

function validManifest(value: unknown) {
  if (!isObject(value) || value.schemaVersion !== 1 || !["PERIOD_1", "PERIOD_2", "FINAL"].includes(String(value.graphicKind)) || !Array.isArray(value.artifacts) || value.artifacts.length !== 2) return false;
  const kinds = new Set<string>();
  for (const item of value.artifacts) {
    if (!isObject(item)) return false;
    const kind = String(item.kind || "");
    if (!["POST", "STORY"].includes(kind) || kinds.has(kind)) return false;
    kinds.add(kind);
    if (typeof item.filename !== "string" || !/^[A-Za-z0-9._-]+\.png$/.test(item.filename)) return false;
    if (typeof item.nextcloudPath !== "string" || !item.nextcloudPath.startsWith("/Liveticker/") || item.nextcloudPath.includes("..") || item.nextcloudPath.includes("\\") || item.nextcloudPath.includes("?") || item.nextcloudPath.includes("#")) return false;
    if (typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(item.sha256)) return false;
    if (typeof item.bytes !== "number" || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes > 104_857_600) return false;
  }
  return kinds.has("POST") && kinds.has("STORY");
}

function validBody(value: unknown): value is JsonObject {
  if (!isObject(value) || typeof value.action !== "string") return false;
  if (value.action === "claim") return exactKeys(value, ["action"]);
  if (value.action !== "complete" || !exactKeys(value, ["action", "jobId", "claimToken", "success", "errorCode", "result"])) return false;
  if (!isUuid(value.jobId) || !isUuid(value.claimToken) || typeof value.success !== "boolean") return false;
  if (value.success) return (value.errorCode === null || value.errorCode === "") && validManifest(value.result);
  return typeof value.errorCode === "string" && /^[A-Z0-9_:-]{1,80}$/.test(value.errorCode) && value.result === null;
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
async function rpc(name: string, payload: JsonObject) {
  const config = runtime();
  const result = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
      "User-Agent": "Plaerrdeifl-Liveticker-Gateway/1",
    },
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    await result.body?.cancel();
    throw new GatewayError();
  }
  const data: unknown = await result.json();
  if (!isObject(data)) throw new GatewayError();
  return data;
}

Deno.serve(async request => {
  if (request.method !== "POST") return response(405, { ok: false, error: "Method not allowed" });
  try {
    if (!await authorized(request)) return response(401, { ok: false, error: "Unauthorized" });
    const body = await readJson(request);
    if (!validBody(body)) return response(400, { ok: false, error: "Invalid request" });
    const data = body.action === "claim"
      ? await rpc(CLAIM_RPC, {})
      : await rpc(COMPLETE_RPC, {
        p_job_id: body.jobId,
        p_claim_token: body.claimToken,
        p_success: body.success,
        p_error_code: body.errorCode,
        p_result_manifest: body.result,
      });
    return response(200, { ok: true, data });
  } catch {
    return response(500, { ok: false, error: "Internal error" });
  }
});

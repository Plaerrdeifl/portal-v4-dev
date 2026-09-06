const MAX_BODY_BYTES = 65_536;
const MIN_WORKER_TOKEN_BYTES = 32;
const MAX_SECRET_LENGTH = 2_048;
const WORKER_TOKEN_HEADER = "X-M340-Worker-Token";
const CLAIM_RPC = "pd_m340_fanbus_publishing_job_claim";
const COMPLETE_RPC = "pd_m340_fanbus_publishing_job_complete";

const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
};

class WorkerGatewayError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function jsonResponse(status: number, body: JsonObject) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function errorResponse(status: number) {
  const error = status === 401
    ? "Unauthorized"
    : status === 400
    ? "Invalid request"
    : status === 405
    ? "Method not allowed"
    : "Internal error";

  return jsonResponse(status, { ok: false, error });
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: JsonObject, expected: string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidArtifact(value: unknown) {
  if (!isObject(value) || !hasExactKeys(value, [
    "kind",
    "filename",
    "nextcloudPath",
    "sha256",
    "bytes"
  ])) return false;

  return ["QR", "POST", "STORY", "LED"].includes(String(value.kind))
    && typeof value.kind === "string"
    && typeof value.filename === "string"
    && value.filename.length >= 1
    && value.filename.length <= 160
    && /^[A-Za-z0-9._-]+[.]png$/.test(value.filename)
    && typeof value.nextcloudPath === "string"
    && value.nextcloudPath.length >= 1
    && value.nextcloudPath.length <= 500
    && value.nextcloudPath.startsWith("/Fanbus/")
    && !value.nextcloudPath.includes("..")
    && !value.nextcloudPath.includes("\\")
    && !value.nextcloudPath.includes("?")
    && !value.nextcloudPath.includes("#")
    && !/^https?:\/\//i.test(value.nextcloudPath)
    && typeof value.sha256 === "string"
    && /^[0-9a-f]{64}$/.test(value.sha256)
    && typeof value.bytes === "number"
    && Number.isSafeInteger(value.bytes)
    && value.bytes >= 1
    && value.bytes <= 104_857_600;
}

function isValidManifest(value: unknown) {
  if (!isObject(value)
      || !hasExactKeys(value, ["schemaVersion", "artifacts"])
      || value.schemaVersion !== 1
      || !Array.isArray(value.artifacts)
      || value.artifacts.length !== 4
      || !value.artifacts.every(isValidArtifact)) return false;

  const kinds = value.artifacts.map(artifact => (artifact as JsonObject).kind);
  return new Set(kinds).size === 4
    && ["QR", "POST", "STORY", "LED"].every(kind => kinds.includes(kind));
}

function isValidRequestBody(value: unknown): value is JsonObject {
  if (!isObject(value) || typeof value.action !== "string") return false;

  if (value.action === "claim") {
    return hasExactKeys(value, ["action"]);
  }

  if (value.action !== "complete" || !hasExactKeys(value, [
    "action",
    "jobId",
    "claimToken",
    "success",
    "errorCode",
    "result"
  ])) return false;

  if (!isUuid(value.jobId)
      || !isUuid(value.claimToken)
      || typeof value.success !== "boolean") return false;

  if (value.success) {
    return (value.errorCode === null || value.errorCode === "")
      && isValidManifest(value.result);
  }

  return typeof value.errorCode === "string"
    && value.errorCode.length >= 1
    && value.errorCode.length <= 80
    && /^[A-Z0-9_:-]+$/.test(value.errorCode)
    && value.result === null;
}

function configuredSupabaseSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (rawSecretKeys) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSecretKeys);
    } catch {
      throw new WorkerGatewayError("CONFIG_INVALID");
    }

    if (isObject(parsed)) {
      const preferred = [parsed.default, parsed.secret, parsed.service_role];
      const candidate = [...preferred, ...Object.values(parsed)]
        .find(value => typeof value === "string" && value.trim().length > 0);

      if (typeof candidate === "string") return candidate.trim();
    }

    throw new WorkerGatewayError("CONFIG_INVALID");
  }

  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  throw new WorkerGatewayError("CONFIG_INVALID");
}

function validatedSupabaseUrl() {
  const rawUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (!rawUrl) throw new WorkerGatewayError("CONFIG_INVALID");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new WorkerGatewayError("CONFIG_INVALID");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
    || (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "")
  ) {
    throw new WorkerGatewayError("CONFIG_INVALID");
  }

  return parsedUrl.origin;
}

function loadRuntimeConfig(): RuntimeConfig {
  const supabaseSecretKey = configuredSupabaseSecretKey();
  if (
    supabaseSecretKey.length > MAX_SECRET_LENGTH
    || /[\r\n]/.test(supabaseSecretKey)
  ) throw new WorkerGatewayError("CONFIG_INVALID");

  return {
    supabaseUrl: validatedSupabaseUrl(),
    supabaseSecretKey
  };
}

async function constantTimeTokenMatch(expected: string, supplied: string) {
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied))
  ]);
  const expectedBytes = new Uint8Array(expectedDigest);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  let difference = 0;

  for (let index = 0; index < expectedBytes.byteLength; index += 1) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }

  return difference === 0;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && (!/^[0-9]+$/.test(contentLength)
      || Number(contentLength) > MAX_BODY_BYTES)) {
    throw new WorkerGatewayError("REQUEST_INVALID");
  }

  if (!request.body) throw new WorkerGatewayError("REQUEST_INVALID");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new WorkerGatewayError("REQUEST_INVALID");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new WorkerGatewayError("REQUEST_INVALID");
  }
}

async function callWorkerRpc(
  config: RuntimeConfig,
  rpcName: typeof CLAIM_RPC | typeof COMPLETE_RPC,
  body: JsonObject
) {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/${rpcName}`,
      {
        method: "POST",
        headers: {
          apikey: config.supabaseSecretKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
  } catch {
    throw new WorkerGatewayError("RPC_FAILED");
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new WorkerGatewayError("RPC_FAILED");
  }

  try {
    const result: unknown = await response.json();
    if (!isObject(result)) throw new WorkerGatewayError("RPC_FAILED");
    return result;
  } catch {
    throw new WorkerGatewayError("RPC_FAILED");
  }
}

Deno.serve(async request => {
  if (request.method !== "POST") return errorResponse(405);

  const configuredWorkerToken = Deno.env.get("M340_WORKER_TOKEN");
  if (
    !configuredWorkerToken
    || configuredWorkerToken.length > MAX_SECRET_LENGTH
    || encoder.encode(configuredWorkerToken).byteLength < MIN_WORKER_TOKEN_BYTES
  ) return errorResponse(500);

  const suppliedWorkerToken = request.headers.get(WORKER_TOKEN_HEADER) || "";
  if (suppliedWorkerToken.length > MAX_SECRET_LENGTH) return errorResponse(401);

  let authenticated = false;
  try {
    authenticated = await constantTimeTokenMatch(
      configuredWorkerToken,
      suppliedWorkerToken
    );
  } catch {
    return errorResponse(500);
  }

  if (!authenticated) return errorResponse(401);

  let payload: unknown;
  try {
    payload = await readBoundedJson(request);
  } catch {
    return errorResponse(400);
  }
  if (!isValidRequestBody(payload)) return errorResponse(400);

  try {
    const config = loadRuntimeConfig();
    const result = payload.action === "claim"
      ? await callWorkerRpc(config, CLAIM_RPC, {})
      : await callWorkerRpc(config, COMPLETE_RPC, {
        p_job_id: payload.jobId,
        p_claim_token: payload.claimToken,
        p_success: payload.success,
        p_error_code: payload.errorCode,
        p_result_manifest: payload.result
      });

    return jsonResponse(200, { ok: true, data: result });
  } catch {
    return errorResponse(500);
  }
});

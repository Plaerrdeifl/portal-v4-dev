const MAX_BODY_BYTES = 131_072;
const MIN_WORKER_TOKEN_BYTES = 32;
const MAX_SECRET_LENGTH = 2_048;
const WORKER_TOKEN_HEADER = "X-Social-Media-Render-Worker-Token";

const RUNTIME_CONTRACTS = {
  "tpieykhhawszlzsoflnl.supabase.co": { environment: "DEV" },
  "wplescvhlgctynkfwvrj.supabase.co": { environment: "PROD" }
} as const;

const EXPECTED_TOKEN_SHA256_BY_HOST = {
  "tpieykhhawszlzsoflnl.supabase.co":
    "fac0f4a76b1448bcb1e7c1e97b1b7cb2398400133fe44a0d2c81ecde454ef49d"
} as const;

const RPC = {
  workStatus: "pd_social_media_render_worker_work_status",
  claim: "pd_social_media_render_worker_claim",
  heartbeat: "pd_social_media_render_worker_heartbeat",
  complete: "pd_social_media_render_worker_complete",
  cloudClaim: "pd_social_media_render_worker_cloud_claim",
  cloudHeartbeat: "pd_social_media_render_worker_cloud_heartbeat",
  cloudComplete: "pd_social_media_render_worker_cloud_complete",
  mediaClaim: "pd_social_media_library_worker_claim",
  mediaHeartbeat: "pd_social_media_library_worker_heartbeat",
  mediaComplete: "pd_social_media_library_worker_complete",
  livetickerClaim: "pd_social_media_liveticker_render_worker_claim",
  livetickerHeartbeat: "pd_social_media_liveticker_render_worker_heartbeat",
  livetickerComplete: "pd_social_media_liveticker_render_worker_complete"
} as const;

const MEDIA_BUCKET = "social-media-generator-library";

const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;

class GatewayError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function response(status: number, body: JsonObject) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
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
  return response(status, { ok: false, error });
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonObject, expected: string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isErrorCode(value: unknown) {
  return typeof value === "string"
    && /^[A-Z0-9_:-]{1,80}$/.test(value);
}

function isRenderManifest(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    "mimeType",
    "storagePath",
    "sha256",
    "sizeBytes",
    "rendererVersion",
    "compatibilityVersion"
  ])) return false;

  return value.mimeType === "image/png"
    && typeof value.storagePath === "string"
    && /^[A-Za-z0-9/_-]{1,240}[.]png$/.test(value.storagePath)
    && !value.storagePath.includes("..")
    && typeof value.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.sizeBytes === "number"
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes >= 1
    && value.sizeBytes <= 50 * 1024 * 1024
    && typeof value.rendererVersion === "string"
    && /^social-media-render-worker\/[0-9]+[.][0-9]+[.][0-9]+$/.test(value.rendererVersion)
    && typeof value.compatibilityVersion === "number"
    && Number.isSafeInteger(value.compatibilityVersion)
    && value.compatibilityVersion >= 1
    && value.compatibilityVersion <= 1000;
}

function isCloudResult(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    "nextcloudPath",
    "shareUrl",
    "downloadUrl",
    "filename",
    "sha256",
    "sizeBytes"
  ])) return false;

  return typeof value.nextcloudPath === "string"
    && value.nextcloudPath.startsWith("/Publishing/")
    && value.nextcloudPath.length <= 500
    && !value.nextcloudPath.includes("..")
    && !value.nextcloudPath.includes("\\")
    && !value.nextcloudPath.includes("?")
    && !value.nextcloudPath.includes("#")
    && typeof value.shareUrl === "string"
    && /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}$/.test(value.shareUrl)
    && value.downloadUrl === `${value.shareUrl}/download`
    && typeof value.filename === "string"
    && /^[A-Za-z0-9._-]{1,160}[.]png$/.test(value.filename)
    && typeof value.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.sizeBytes === "number"
    && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes >= 1
    && value.sizeBytes <= 50 * 1024 * 1024;
}

function isLivetickerArtifact(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    "kind", "shareUrl", "downloadUrl", "filename",
    "nextcloudPath", "sha256", "bytes"
  ])) return false;

  return (value.kind === "POST" || value.kind === "STORY")
    && typeof value.shareUrl === "string"
    && /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}$/.test(value.shareUrl)
    && value.downloadUrl === value.shareUrl + "/download"
    && typeof value.filename === "string"
    && /^[A-Za-z0-9._-]{1,160}[.]png$/.test(value.filename)
    && typeof value.nextcloudPath === "string"
    && value.nextcloudPath.startsWith("/Publishing/")
    && value.nextcloudPath.length <= 500
    && !value.nextcloudPath.includes("..")
    && !value.nextcloudPath.includes("\\")
    && typeof value.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.bytes === "number"
    && Number.isSafeInteger(value.bytes)
    && value.bytes >= 1
    && value.bytes <= 50 * 1024 * 1024;
}

function isLivetickerResult(value: unknown) {
  if (!isObject(value) || !exactKeys(value, ["sourceRevision", "artifacts"])) {
    return false;
  }
  if (typeof value.sourceRevision !== "number"
      || !Number.isSafeInteger(value.sourceRevision)
      || value.sourceRevision < 0
      || !Array.isArray(value.artifacts)
      || value.artifacts.length !== 2
      || !value.artifacts.every(isLivetickerArtifact)) {
    return false;
  }
  const kinds = value.artifacts.map(item => (item as JsonObject).kind).sort();
  return kinds[0] === "POST" && kinds[1] === "STORY";
}

function isMediaResult(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    "nextcloudPath", "mimeType", "sha256", "sizeBytes", "width", "height"
  ])) return false;
  return typeof value.nextcloudPath === "string"
    && /^\/Library\/(Uploads|General|Backgrounds)\/[0-9a-f-]{36}\/original[.](png|jpg|webp)$/i.test(value.nextcloudPath)
    && !value.nextcloudPath.includes("..")
    && ["image/png", "image/jpeg", "image/webp"].includes(String(value.mimeType))
    && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.sizeBytes === "number" && Number.isSafeInteger(value.sizeBytes)
    && value.sizeBytes >= 1 && value.sizeBytes <= 10 * 1024 * 1024
    && typeof value.width === "number" && Number.isSafeInteger(value.width)
    && typeof value.height === "number" && Number.isSafeInteger(value.height)
    && value.width >= 1 && value.width <= 12000
    && value.height >= 1 && value.height <= 12000;
}

function validBody(value: unknown): value is JsonObject {
  if (!isObject(value) || typeof value.action !== "string") return false;

  if (value.action === "work" || value.action === "claim"
      || value.action === "cloudClaim" || value.action === "mediaClaim"
      || value.action === "livetickerClaim") {
    return exactKeys(value, ["action"]);
  }

  if (value.action === "heartbeat" || value.action === "cloudHeartbeat") {
    return exactKeys(value, ["action", "jobId", "claimToken"])
      && isUuid(value.jobId)
      && isUuid(value.claimToken);
  }

  if (value.action === "livetickerHeartbeat") {
    return exactKeys(value, ["action", "requestId", "claimToken"])
      && isUuid(value.requestId) && isUuid(value.claimToken);
  }

  if (value.action === "mediaHeartbeat") {
    return exactKeys(value, ["action", "uploadId", "claimToken"])
      && isUuid(value.uploadId) && isUuid(value.claimToken);
  }

  if (value.action === "complete") {
    if (!exactKeys(value, [
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
        && isRenderManifest(value.result);
    }
    return isErrorCode(value.errorCode) && value.result === null;
  }

  if (value.action === "cloudComplete") {
    if (!exactKeys(value, [
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
        && isCloudResult(value.result);
    }
    return isErrorCode(value.errorCode) && value.result === null;
  }

  if (value.action === "livetickerComplete") {
    if (!exactKeys(value, [
      "action", "requestId", "claimToken", "success", "errorCode", "result"
    ])) return false;
    if (!isUuid(value.requestId) || !isUuid(value.claimToken)
        || typeof value.success !== "boolean") return false;
    if (value.success) {
      return (value.errorCode === null || value.errorCode === "")
        && isLivetickerResult(value.result);
    }
    return isErrorCode(value.errorCode) && value.result === null;
  }

  if (value.action === "mediaComplete") {
    if (!exactKeys(value, [
      "action", "uploadId", "claimToken", "success", "errorCode", "result"
    ])) return false;
    if (!isUuid(value.uploadId) || !isUuid(value.claimToken)
        || typeof value.success !== "boolean") return false;
    if (value.success) {
      return (value.errorCode === null || value.errorCode === "")
        && isMediaResult(value.result);
    }
    return isErrorCode(value.errorCode) && value.result === null;
  }

  return false;
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && (!/^[0-9]+$/.test(contentLength)
      || Number(contentLength) > MAX_BODY_BYTES)) {
    throw new GatewayError("REQUEST_INVALID");
  }
  if (!request.body) throw new GatewayError("REQUEST_INVALID");

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
        throw new GatewayError("REQUEST_INVALID");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new GatewayError("REQUEST_INVALID");
  }
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function expectedTokenSha256() {
  const rawUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (!rawUrl) return "";
  try {
    const hostname = new URL(rawUrl).hostname;
    return EXPECTED_TOKEN_SHA256_BY_HOST[
      hostname as keyof typeof EXPECTED_TOKEN_SHA256_BY_HOST
    ] || "";
  } catch {
    return "";
  }
}

async function authorizedWorkerToken(supplied: string) {
  const expected = expectedTokenSha256();
  if (!expected
      || supplied.length > MAX_SECRET_LENGTH
      || encoder.encode(supplied).byteLength < MIN_WORKER_TOKEN_BYTES) {
    return false;
  }
  const actual = await sha256Hex(supplied);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function configuredSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GatewayError("CONFIG_INVALID");
    }
    if (!isObject(parsed)) throw new GatewayError("CONFIG_INVALID");
    const candidate = [
      parsed.default,
      parsed.secret,
      parsed.service_role,
      ...Object.values(parsed)
    ].find(value => typeof value === "string" && value.trim().length > 0);
    if (typeof candidate === "string") return candidate.trim();
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  throw new GatewayError("CONFIG_INVALID");
}

function runtime() {
  const rawUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const key = configuredSecretKey();
  if (!rawUrl
      || key.length > MAX_SECRET_LENGTH
      || /[\r\n]/.test(key)) {
    throw new GatewayError("CONFIG_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new GatewayError("CONFIG_INVALID");
  }
  if (parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new GatewayError("CONFIG_INVALID");
  }

  const contract = RUNTIME_CONTRACTS[
    parsed.hostname as keyof typeof RUNTIME_CONTRACTS
  ];
  if (!contract) throw new GatewayError("CONFIG_INVALID");

  return {
    url: parsed.origin,
    key,
    environment: contract.environment
  };
}

async function rpc(name: string, payload: JsonObject) {
  const config = runtime();
  let result: Response;
  try {
    result = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        "Content-Type": "application/json",
        "User-Agent": "Plaerrdeifl-Social-Media-Render-Gateway/1"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new GatewayError("RPC_FAILED");
  }

  if (!result.ok) {
    await result.body?.cancel();
    throw new GatewayError("RPC_FAILED");
  }

  const data: unknown = await result.json().catch(() => null);
  if (!isObject(data)) throw new GatewayError("RPC_FAILED");
  return data;
}

function encodedObjectName(value: string) {
  return value.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

async function addMediaDownloadUrl(data: JsonObject) {
  if (data.claimed === false) return data;
  if (data.claimed !== true || !isObject(data.job)) {
    throw new GatewayError("MEDIA_CLAIM_INVALID");
  }
  const objectPath = data.job.storageObjectPath;
  if (data.job.storageBucket !== MEDIA_BUCKET || typeof objectPath !== "string"
      || !/^library\/[0-9a-f-]{36}\/original[.](png|jpg|webp)$/i.test(objectPath)) {
    throw new GatewayError("MEDIA_CLAIM_INVALID");
  }
  const config = runtime();
  let result: Response;
  try {
    result = await fetch(
      `${config.url}/storage/v1/object/sign/${MEDIA_BUCKET}/${encodedObjectName(objectPath)}`,
      {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 600 })
      }
    );
  } catch {
    throw new GatewayError("MEDIA_SIGN_FAILED");
  }
  if (!result.ok) {
    await result.body?.cancel();
    throw new GatewayError(`MEDIA_SIGN_FAILED_${result.status}`);
  }
  const signed: unknown = await result.json().catch(() => null);
  if (!isObject(signed) || typeof signed.signedURL !== "string") {
    throw new GatewayError("MEDIA_SIGN_RESPONSE_INVALID");
  }
  const signedUrl = signed.signedURL.startsWith("/object/sign/")
    ? `/storage/v1${signed.signedURL}`
    : signed.signedURL;
  const url = new URL(signedUrl, config.url);
  if (url.origin !== config.url
      || !url.pathname.startsWith(`/storage/v1/object/sign/${MEDIA_BUCKET}/`)
      || !url.searchParams.get("token")) {
    throw new GatewayError("MEDIA_SIGN_URL_INVALID");
  }
  return { ...data, job: { ...data.job, sourceUrl: url.href } };
}

Deno.serve(async request => {
  if (request.method !== "POST") return errorResponse(405);

  const supplied = request.headers.get(WORKER_TOKEN_HEADER) || "";
  let authorized = false;
  try {
    authorized = await authorizedWorkerToken(supplied);
  } catch {
    return errorResponse(500);
  }
  if (!authorized) return errorResponse(401);

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch {
    return errorResponse(400);
  }
  if (!validBody(body)) return errorResponse(400);

  try {
    let data: JsonObject;
    switch (body.action) {
      case "work":
        data = await rpc(RPC.workStatus, {});
        break;
      case "claim":
        data = await rpc(RPC.claim, {});
        break;
      case "heartbeat":
        data = await rpc(RPC.heartbeat, {
          p_job_id: body.jobId,
          p_claim_token: body.claimToken
        });
        break;
      case "complete":
        data = await rpc(RPC.complete, {
          p_job_id: body.jobId,
          p_claim_token: body.claimToken,
          p_success: body.success,
          p_error_code: body.errorCode,
          p_result_manifest: body.result
        });
        break;
      case "cloudClaim":
        data = await rpc(RPC.cloudClaim, {});
        break;
      case "cloudHeartbeat":
        data = await rpc(RPC.cloudHeartbeat, {
          p_job_id: body.jobId,
          p_claim_token: body.claimToken
        });
        break;
      case "cloudComplete":
        data = await rpc(RPC.cloudComplete, {
          p_job_id: body.jobId,
          p_claim_token: body.claimToken,
          p_success: body.success,
          p_error_code: body.errorCode,
          p_cloud_result: body.result
        });
        break;
      case "livetickerClaim":
        data = await rpc(RPC.livetickerClaim, {});
        break;
      case "livetickerHeartbeat":
        data = await rpc(RPC.livetickerHeartbeat, {
          p_request_id: body.requestId,
          p_claim_token: body.claimToken
        });
        break;
      case "livetickerComplete":
        data = await rpc(RPC.livetickerComplete, {
          p_request_id: body.requestId,
          p_claim_token: body.claimToken,
          p_success: body.success,
          p_error_code: body.errorCode,
          p_result_manifest: body.result
        });
        break;
      case "mediaClaim":
        data = await addMediaDownloadUrl(await rpc(RPC.mediaClaim, {}));
        break;
      case "mediaHeartbeat":
        data = await rpc(RPC.mediaHeartbeat, {
          p_upload_id: body.uploadId,
          p_claim_token: body.claimToken
        });
        break;
      case "mediaComplete":
        data = await rpc(RPC.mediaComplete, {
          p_upload_id: body.uploadId,
          p_claim_token: body.claimToken,
          p_success: body.success,
          p_error_code: body.errorCode,
          p_result: body.result
        });
        break;
      default:
        throw new GatewayError("REQUEST_INVALID");
    }

    return response(200, { ok: true, data });
  } catch (error) {
    console.error(
      "social-media-render-worker request failed",
      error instanceof GatewayError ? error.code : "UNEXPECTED"
    );
    return errorResponse(500);
  }
});

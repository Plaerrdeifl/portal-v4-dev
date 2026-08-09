import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const functionPath = "supabase/functions/m150-membership-submit/index.ts";
const documentationPath = "docs/M150_R1_F1_4B_PUBLIC_INTAKE_EDGE.md";

const [source, config] = await Promise.all([
  read(functionPath),
  read("supabase/config.toml")
]);

function block(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return text.slice(from, to);
}

test("F1.4B artifacts and function location are exact", async () => {
  const functionFiles = (await readdir(join(root, "supabase/functions/m150-membership-submit")))
    .sort();
  assert.deepEqual(functionFiles, ["index.ts"]);
  assert.ok((await stat(join(root, functionPath))).isFile());
  assert.ok((await stat(join(root, documentationPath))).isFile());

  const migrationNames = await readdir(join(root, "supabase/migrations"));
  assert.deepEqual(
    migrationNames.filter(name => /(?:f1[_-]?4b|public.*edge|membership.*submit)/i.test(name)),
    []
  );
});

test("only the M150 function receives its dedicated JWT bypass config", () => {
  const functionSections = [...config.matchAll(/^\[functions\.([^\]]+)\]$/gm)]
    .map(match => match[1]);
  assert.deepEqual(functionSections, [
    "send-web-push",
    "m150-membership-submit"
  ]);
  assert.equal(
    (config.match(/^\[functions\.m150-membership-submit\]$/gm) || []).length,
    1
  );
  assert.match(
    config,
    /^\[functions\.m150-membership-submit\]\r?\nverify_jwt = false\s*$/m
  );
  assert.match(
    config,
    /^\[functions\.send-web-push\]\r?\nverify_jwt = false\s*$/m
  );
});

test("transport accepts POST with JSON and the three M150 headers only", () => {
  assert.match(source, /request\.method !== "POST"[\s\S]+errorResponse\(405\)/);
  assert.match(source, /request\.headers\.get\("Content-Type"\)/);
  assert.match(source, /\^application\\\/json/);
  assert.match(source, /errorResponse\(400\)/);
  assert.match(source, /X-M150-Timestamp/);
  assert.match(source, /X-M150-Idempotency-Key/);
  assert.match(source, /X-M150-Signature/);
  assert.doesNotMatch(source, /request\.method\s*===\s*"GET"|URLSearchParams|searchParams/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin|\bcors\b|request\.method\s*===\s*"OPTIONS"/i);
});

test("timestamp and idempotency header syntax are transport-bound", () => {
  assert.match(source, /!\/\^\[0-9\]\+\$\/\.test\(timestamp\)/);
  assert.match(source, /Number\.isSafeInteger\(suppliedUnixSeconds\)/);
  assert.match(source, /Math\.floor\(Date\.now\(\) \/ 1000\)/);
  assert.match(source, /const REPLAY_WINDOW_SECONDS = 300/);
  assert.match(
    source,
    /Math\.abs\(serverUnixSeconds - suppliedUnixSeconds\) > REPLAY_WINDOW_SECONDS/
  );
  assert.doesNotMatch(source, /Date\.parse|toISOString|milliseconds/i);
  assert.match(
    source,
    /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-4\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$\/i/
  );
  assert.match(source, /p_idempotency_key: idempotencyKey/);
  assert.doesNotMatch(source, /randomUUID|crypto\.randomUUID|idempotency.*(?:hash|digest)/i);
});

test("raw body is bounded, hashed, authenticated, and only then parsed", () => {
  const handler = source.slice(source.indexOf("Deno.serve(async request => {"));
  const rawRead = handler.indexOf("await readRawBody(request)");
  const bodyHash = handler.indexOf("await sha256Hex(rawBody)");
  const replayCheck = handler.indexOf("Math.abs(serverUnixSeconds - suppliedUnixSeconds)");
  const hmacVerify = handler.indexOf("await verifySignature(");
  const jsonParse = handler.indexOf("JSON.parse(rawJson)");
  const rpcCall = handler.indexOf("/rest/v1/rpc/m150_submit_membership_application");

  for (const marker of [rawRead, bodyHash, replayCheck, hmacVerify, jsonParse, rpcCall]) {
    assert.ok(marker >= 0);
  }
  assert.ok(rawRead < bodyHash);
  assert.ok(bodyHash < replayCheck);
  assert.ok(replayCheck < hmacVerify);
  assert.ok(hmacVerify < jsonParse);
  assert.ok(jsonParse < rpcCall);

  assert.match(source, /const MAX_BODY_BYTES = 16 \* 1024/);
  assert.match(source, /Content-Length/);
  assert.match(source, /totalBytes > MAX_BODY_BYTES/);
  assert.match(source, /await reader\.cancel\(\)/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256", rawBody\)/);
  assert.match(source, /lowercaseHex\(new Uint8Array\(digest\)\)/);
});

test("HMAC-SHA256 uses the exact signature base and Web Crypto verification", () => {
  assert.ok(source.includes(
    "const signatureBase = `${timestamp}\\n${idempotencyKey}\\n${bodySha256Hex}`;"
  ));
  assert.match(source, /crypto\.subtle\.importKey\(/);
  assert.match(source, /\{ name: "HMAC", hash: "SHA-256" \}/);
  assert.match(source, /\["verify"\]/);
  assert.match(source, /crypto\.subtle\.verify\(/);
  assert.match(source, /Deno\.env\.get\("M150_INTAKE_HMAC_SECRET"\)/);
  assert.match(source, /hmacSecretBytes\.byteLength < 32/);
  assert.match(source, /\^\[0-9a-f\]\{64\}\$\/\.test\(suppliedSignatureHex\)/);
  assert.doesNotMatch(
    source,
    /expectedSignature|suppliedSignatureHex\s*===|===\s*suppliedSignatureHex|timingSafeEqual/
  );
});

test("the service-role key is Edge-internal and calls only the F1.4A RPC", () => {
  assert.match(source, /Deno\.env\.get\("SUPABASE_URL"\)/);
  assert.match(source, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(source, /\/rest\/v1\/rpc\/m150_submit_membership_application/);
  assert.match(source, /p_payload: payload/);
  assert.match(source, /p_idempotency_key: idempotencyKey/);
  assert.doesNotMatch(source, /request\.headers\.get\([^)]*SUPABASE/i);
  assert.doesNotMatch(source, /public\.pd_api|\bpd_api\b/i);
  assert.doesNotMatch(
    source,
    /app_private|app_fanclub|membership_applications|\b(?:insert|update|delete|select)\b/i
  );
});

test("success and error responses are neutral and status classes stay separated", () => {
  const successBody = block(source, "const SUCCESS_RESPONSE", "const ERROR_RESPONSE");
  const errorBody = block(source, "const ERROR_RESPONSE", "const INPUT_ERROR_CODES");

  assert.match(successBody, /ok: true/);
  assert.match(successBody, /Der Antrag wurde entgegengenommen\./);
  assert.doesNotMatch(
    successBody,
    /applicationId|created|duplicate|memberExists|portalUserExists|existingApplication|status|Board/i
  );
  assert.match(errorBody, /ok: false/);
  assert.match(errorBody, /Die Anfrage konnte nicht verarbeitet werden\./);
  assert.doesNotMatch(errorBody, /M150_|SQLSTATE|PostgREST|Supabase|stack|detail/i);

  assert.match(source, /return jsonResponse\(200, SUCCESS_RESPONSE\)/);
  for (const status of [400, 401, 405, 413, 500]) {
    assert.match(source, new RegExp(`errorResponse\\(${status}\\)`));
  }
  assert.match(source, /accepted !== true/);
  assert.match(source, /typeof \(rpcData as Record<string, unknown>\)\.created !== "boolean"/);
  assert.doesNotMatch(source, /return\s+(?:rpcData|rpcText|applicationId)\b/i);
});

test("the function has no PII or secret logging and no adjacent feature scope", () => {
  assert.doesNotMatch(source, /console\.|\.log\(|\.error\(|\.warn\(/);
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /wordpress|turnstile|rate.?limit|sendgrid|pdf|retention/i);
  assert.doesNotMatch(source, /Access-Control-Allow|Allow-Origin/i);
});

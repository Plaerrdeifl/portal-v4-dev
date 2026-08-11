import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const functionPath = "supabase/functions/m310-fanbus-register/index.ts";
const configPath = "supabase/config.toml";

const [source, config] = await Promise.all([
  read(functionPath),
  read(configPath)
]);

function block(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return text.slice(from, to);
}

test("M310 public Edge artifacts and JWT boundary are explicit", async () => {
  assert.ok((await stat(join(root, functionPath))).isFile());
  assert.ok((await stat(join(root, configPath))).isFile());
  assert.equal(
    (config.match(/^\[functions\.m310-fanbus-register\]$/gm) || []).length,
    1
  );
  assert.match(
    config,
    /^\[functions\.m310-fanbus-register\]\r?\nverify_jwt = false\s*$/m
  );
});

test("SUPABASE_URL permits HTTP only for the closed local and internal host list", () => {
  const loadConfig = block(source, "function loadConfig()", "function corsHeaders(");

  assert.match(
    loadConfig,
    /const localHttp = parsedSupabaseUrl\.protocol === "http:"\s*&& \["127\.0\.0\.1", "localhost", "kong"\]\.includes\(parsedSupabaseUrl\.hostname\);/
  );
  assert.match(
    loadConfig,
    /\(parsedSupabaseUrl\.protocol !== "https:" && !localHttp\)/
  );
  assert.match(loadConfig, /parsedSupabaseUrl\.origin !== supabaseUrl/);
  assert.match(loadConfig, /parsedSupabaseUrl\.pathname !== "\/"/);
  assert.match(loadConfig, /parsedSupabaseUrl\.search/);
  assert.match(loadConfig, /parsedSupabaseUrl\.hash/);
  assert.match(loadConfig, /parsedSupabaseUrl\.username/);
  assert.match(loadConfig, /parsedSupabaseUrl\.password/);
});

test("M310 public Edge transport and security boundaries remain closed", () => {
  const originCheck = source.indexOf('if (!origin || !config.allowedOrigins.has(origin))');
  const optionsCheck = source.indexOf('if (request.method === "OPTIONS")');
  assert.notEqual(originCheck, -1);
  assert.notEqual(optionsCheck, -1);
  assert.ok(originCheck < optionsCheck, "Origin muss vor OPTIONS geprüft werden.");

  assert.match(
    source,
    /request\.method === "OPTIONS"[\s\S]+new Response\(null, \{ status: 204/
  );
  assert.match(
    source,
    /request\.method !== "POST"[\s\S]+errorResponse\(405/
  );
  assert.match(
    source,
    /!hasJsonContentType\(request\)[\s\S]+errorResponse\(400/
  );
  assert.match(source, /TURNSTILE_VERIFY_URL/);
  assert.match(source, /!await verifyTurnstile\(guestRequest, source, config\)/);

  const rpcNames = [...source.matchAll(/\/rest\/v1\/rpc\/([a-z0-9_]+)/g)]
    .map(match => match[1]);
  assert.deepEqual(rpcNames, ["m310_submit_guest_fanbus_registration"]);

  assert.equal(
    (source.match(/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /console\.(?:log|error)\s*\(/);
});

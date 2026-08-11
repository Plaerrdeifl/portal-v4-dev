import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const generator = resolve(
  root,
  "scripts",
  "write-runtime-config.mjs"
);

function generatorEnvironment(siteKey) {
  const env = {
    ...process.env,
    M310_TURNSTILE_SECRET: "private-turnstile-secret-sentinel",
    SUPABASE_SERVICE_ROLE_KEY: "private-service-role-sentinel",
    M310_RATE_LIMIT_SECRET: "private-rate-limit-sentinel"
  };

  if (siteKey === undefined) {
    delete env.M310_TURNSTILE_SITE_KEY;
  } else {
    env.M310_TURNSTILE_SITE_KEY = siteKey;
  }

  return env;
}

async function runGenerator(output, siteKey) {
  return execFileAsync(
    process.execPath,
    [
      generator,
      "--url",
      "https://example.supabase.co",
      "--key",
      "sb_publishable_m310_runtime_test_key",
      "--environment",
      "DEV",
      "--output",
      output
    ],
    {
      cwd: root,
      env: generatorEnvironment(siteKey)
    }
  );
}

function parseRuntime(source) {
  const match = source.match(
    /^window\.PD_RUNTIME_CONFIG = Object\.freeze\(([\s\S]+)\);\s*$/
  );

  assert.ok(match, "Runtime-Konfiguration besitzt das erwartete Format.");
  return JSON.parse(match[1]);
}

test("M310 Turnstile site key is required and written as public runtime config", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "pd-m310-runtime-config-")
  );
  const output = join(directory, "runtime-config.js");

  try {
    await runGenerator(
      output,
      "  public-m310-turnstile-site-key  "
    );

    const source = await readFile(output, "utf8");
    const runtime = parseRuntime(source);

    assert.equal(
      runtime.m310TurnstileSiteKey,
      "public-m310-turnstile-site-key"
    );

    for (const forbidden of [
      "M310_TURNSTILE_SECRET",
      "private-turnstile-secret-sentinel",
      "SUPABASE_SERVICE_ROLE_KEY",
      "private-service-role-sentinel",
      "M310_RATE_LIMIT_SECRET",
      "private-rate-limit-sentinel"
    ]) {
      assert.doesNotMatch(source, new RegExp(forbidden));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("M310 Turnstile site key cannot be missing", async () => {
  const output = join(
    tmpdir(),
    `pd-m310-runtime-missing-${process.pid}.js`
  );

  await assert.rejects(
    runGenerator(output, undefined),
    /M310_TURNSTILE_SITE_KEY ist für DEV und PROD erforderlich/
  );
});

test("M310 Turnstile placeholder cannot be used for a real build", async () => {
  const output = join(
    tmpdir(),
    `pd-m310-runtime-placeholder-${process.pid}.js`
  );

  await assert.rejects(
    runGenerator(output, "  YOUR_TURNSTILE_SITE_KEY  "),
    /M310_TURNSTILE_SITE_KEY ist für DEV und PROD erforderlich/
  );
});

test("M310 runtime generator and PR workflow retain their security boundaries", async () => {
  const [source, workflow] = await Promise.all([
    readFile(generator, "utf8"),
    readFile(
      resolve(root, ".github", "workflows", "validate-pull-request.yml"),
      "utf8"
    )
  ]);

  assert.match(source, /process\.env\.M310_TURNSTILE_SITE_KEY/);
  assert.match(source, /m310TurnstileSiteKey/);
  assert.match(source, /environment === "PROD"/);
  assert.match(source, /LEGAL_IMPRINT_URL/);
  assert.match(source, /LEGAL_PRIVACY_URL/);
  assert.doesNotMatch(source, /M310_TURNSTILE_SECRET/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /M310_RATE_LIMIT_SECRET/);

  assert.match(
    workflow,
    /M310_TURNSTILE_SITE_KEY: \$\{\{ vars\.M310_TURNSTILE_SITE_KEY \}\}/
  );
  assert.match(
    workflow,
    /grep -q '\"m310TurnstileSiteKey\":' dist\/js\/runtime-config\.js/
  );
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /pages: write/);
  assert.doesNotMatch(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(workflow, /\bdeploy(?:ment)?\b/i);
});

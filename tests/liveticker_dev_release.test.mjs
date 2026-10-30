import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(join(root, "integrations/liveticker/release.json"), "utf8"));
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "pd-liveticker-release-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "scripts"));
  await cp(join(root, "scripts/integrate-liveticker-release.mjs"), join(dir, "scripts/integrate-liveticker-release.mjs"));
  await cp(join(root, "integrations/liveticker"), join(dir, "integrations/liveticker"), { recursive: true });
  await mkdir(join(dir, "dist/cockpit"), { recursive: true });
  await writeFile(join(dir, "dist/cockpit/runtime-config.js"), JSON.stringify({
    environment: "DEV",
    supabaseUrl: "https://tpieykhhawszlzsoflnl.supabase.co",
    supabasePublishableKey: "sb_publishable_liveticker_fixture"
  }, null, 2));
  return dir;
}

function integrate(dir, overrides = {}) {
  return exec(process.execPath, [join(dir, "scripts/integrate-liveticker-release.mjs")], {
    cwd: dir,
    env: {
      ...process.env,
      PORTAL_ENVIRONMENT: "DEV",
      SUPABASE_EXPECTED_PROJECT_REF: "tpieykhhawszlzsoflnl",
      ...overrides
    }
  });
}

test("versioned Liveticker embed contains no runtime NODE_ENV access in entry or chunks", async () => {
  const js = manifest.files.filter((file) => /^embed\/.*\.js$/.test(file.path));
  assert.ok(js.some((file) => file.path === "embed/module.js"));
  assert.ok(js.some((file) => file.path.startsWith("embed/chunks/")));
  for (const file of js) {
    const code = await readFile(join(root, manifest.artifactRoot, file.path), "utf8");
    assert.equal(/\bprocess\s*\.\s*env\s*\.\s*NODE_ENV\b/.test(code), false, file.path);
  }
});

test("existing integrator verifies release hashes and copies the complete DEV release unchanged", async (t) => {
  const dir = await fixture(t);
  await integrate(dir);
  for (const file of manifest.files) {
    const deployedPath = file.path.replace(/^standalone\//, "");
    const buffer = await readFile(join(dir, "dist/liveticker", deployedPath));
    assert.equal(buffer.length, file.bytes, file.path);
    assert.equal(hash(buffer), file.sha256, file.path);
  }
  assert.deepEqual(await readFile(join(dir, "dist/liveticker/runtime-config.js")),
    await readFile(join(dir, "dist/cockpit/runtime-config.js")));
  const pwa = JSON.parse(await readFile(join(dir, "dist/liveticker/manifest.webmanifest"), "utf8"));
  assert.equal(pwa.id, "/liveticker/");
  assert.equal(pwa.scope, "/liveticker/");
  assert.equal(pwa.start_url, "/liveticker/");
  assert.match(await readFile(join(dir, "dist/liveticker/registerSW.js"), "utf8"),
    /register\('\/liveticker\/sw\.js', \{ scope: '\/liveticker\/' \}\)/);
});

test("Liveticker integration rejects non-DEV environments and the wrong project", async (t) => {
  const dir = await fixture(t);
  for (const overrides of [
    { PORTAL_ENVIRONMENT: "LOCAL" },
    { PORTAL_ENVIRONMENT: "" },
    { SUPABASE_EXPECTED_PROJECT_REF: "wrong-project" }
  ]) {
    await assert.rejects(integrate(dir, overrides), /feste DEV-Supabase-Projekt/);
  }
});

test("Liveticker integration rejects a corrupted release hash", async (t) => {
  const dir = await fixture(t);
  const invalid = structuredClone(manifest);
  invalid.files[0].sha256 = "0".repeat(64);
  await writeFile(join(dir, "integrations/liveticker/release.json"), JSON.stringify(invalid));
  await assert.rejects(integrate(dir), /Liveticker-Hash falsch/);
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
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

const rootFiles = [
  "index.html",
  "fanbus-anmeldung.html",
  "offline.html",
  "favicon.ico",
  "manifest.webmanifest",
  "service-worker.js"
];

const directories = [
  "assets",
  "components",
  "css",
  "js",
  "pages"
];

test("M310 standalone registration is part of every static build artifact contract", async () => {
  const buildSource = await readFile(
    join(root, "scripts", "build-static.mjs"),
    "utf8"
  );

  assert.match(
    buildSource,
    /const files = \[[\s\S]*?"fanbus-anmeldung\.html"[\s\S]*?\];/
  );
  assert.match(
    buildSource,
    /new Set\(\["LOCAL", "DEV", "PROD"\]\)/
  );

  const fixture = await mkdtemp(
    join(tmpdir(), "pd-m310-static-build-")
  );

  try {
    await Promise.all([
      ...rootFiles.map(file =>
        cp(join(root, file), join(fixture, file))
      ),
      ...directories.map(directory =>
        cp(
          join(root, directory),
          join(fixture, directory),
          { recursive: true }
        )
      )
    ]);

    await mkdir(join(fixture, "scripts"), {
      recursive: true
    });

    await Promise.all([
      cp(
        join(root, "scripts", "build-static.mjs"),
        join(fixture, "scripts", "build-static.mjs")
      ),
      cp(
        join(root, "scripts", "write-runtime-config.mjs"),
        join(fixture, "scripts", "write-runtime-config.mjs")
      )
    ]);

    const env = {
      ...process.env,
      PORTAL_ENVIRONMENT: "DEV",
      SUPABASE_URL:
        "https://tpieykhhawszlzsoflnl.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_m310_static_build_test_key",
      SUPABASE_EXPECTED_PROJECT_REF:
        "tpieykhhawszlzsoflnl",
      M310_TURNSTILE_SITE_KEY:
        "public-m310-static-build-test-key"
    };

    delete env.SUPABASE_ANON_KEY;
    delete env.LEGAL_IMPRINT_URL;
    delete env.LEGAL_PRIVACY_URL;
    delete env.GOOGLE_CLIENT_ID;

    await execFileAsync(
      process.execPath,
      [join(fixture, "scripts", "build-static.mjs")],
      {
        cwd: fixture,
        env
      }
    );

    const [sourceStandalone, builtStandalone, builtIndex] =
      await Promise.all([
        readFile(join(root, "fanbus-anmeldung.html"), "utf8"),
        readFile(
          join(fixture, "dist", "fanbus-anmeldung.html"),
          "utf8"
        ),
        readFile(join(fixture, "dist", "index.html"), "utf8")
      ]);

    assert.equal(builtStandalone, sourceStandalone);
    assert.notEqual(builtStandalone, builtIndex);
    assert.match(
      builtStandalone,
      /<html lang="de" data-route="fanbus-registration">/
    );
    assert.match(
      builtStandalone,
      /<title>Fanbus-Anmeldung · Plärrdeifl<\/title>/
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

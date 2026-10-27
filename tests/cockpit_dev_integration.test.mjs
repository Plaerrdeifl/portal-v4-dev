import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const fixture = await mkdtemp(join(tmpdir(), "pd-cockpit-integration-"));

await Promise.all([
  mkdir(join(fixture, "scripts"), { recursive: true }),
  cp(
    join(root, "integrations", "cockpit"),
    join(fixture, "integrations", "cockpit"),
    { recursive: true }
  )
]);
await cp(
  join(root, "scripts", "integrate-cockpit-release.mjs"),
  join(fixture, "scripts", "integrate-cockpit-release.mjs")
);

after(async () => {
  await rm(fixture, { recursive: true, force: true });
});

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function devEnvironment(overrides = {}) {
  return {
    ...process.env,
    PORTAL_ENVIRONMENT: "DEV",
    SUPABASE_URL: "https://tpieykhhawszlzsoflnl.supabase.co",
    VITE_SUPABASE_URL: "https://tpieykhhawszlzsoflnl.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_cockpit_integration_test_key",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_cockpit_integration_test_key",
    SUPABASE_EXPECTED_PROJECT_REF: "tpieykhhawszlzsoflnl",
    GOOGLE_CLIENT_ID: "123456789012-cockpit-test.apps.googleusercontent.com",
    VITE_GOOGLE_CLIENT_ID: "123456789012-cockpit-test.apps.googleusercontent.com",
    VITE_APP_ENV: "DEV",
    VITE_BASE_PATH: "/cockpit/",
    VITE_PORTAL_BASE_URL: "https://dev.plaerrdeifl.de/portal",
    VITE_PORTAL_ASSET_BASE_URL: "https://dev.plaerrdeifl.de",
    M310_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    ...overrides
  };
}

async function integrate(name, environment = devEnvironment()) {
  const output = join(fixture, "dist", name);

  await execFileAsync(
    process.execPath,
    [
      join(fixture, "scripts", "integrate-cockpit-release.mjs"),
      "--output",
      output
    ],
    {
      cwd: fixture,
      env: environment
    }
  );

  return output;
}

async function filesBelow(directory, current = directory) {
  const paths = [];

  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name);

    if (entry.isDirectory()) {
      paths.push(...await filesBelow(directory, absolute));
    } else {
      paths.push(absolute.slice(directory.length + 1).replaceAll("\\", "/"));
    }
  }

  return paths.sort();
}

async function snapshot(directory) {
  const result = {};

  for (const path of await filesBelow(directory)) {
    result[path] = digest(await readFile(join(directory, path)));
  }

  return result;
}

function parseRuntime(source) {
  const match = source.match(
    /^window\.PD_RUNTIME_CONFIG = Object\.freeze\(([\s\S]+)\);\s*$/
  );

  assert.ok(match, "Cockpit runtime-config.js besitzt das erwartete Format.");
  return JSON.parse(match[1]);
}

test("versioned Cockpit release pins the private source and every generated file", async () => {
  const metadata = JSON.parse(await readFile(
    join(root, "integrations", "cockpit", "release.json"),
    "utf8"
  ));

  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.environment, "DEV");
  assert.equal(metadata.sourceRepository, "Plaerrdeifl/fanszene-cockpit");
  assert.equal(metadata.sourceCommit, "e381f4484d01367f4a65e3bd4e143e5b1f4f4b01");
  assert.equal(
    metadata.sourcePackageLockSha256,
    "f0e8680fd6b0cc39e0267255a17d780a98f246ae1a06eb175635a45dd8598a27"
  );
  assert.equal(metadata.sourceBuildCommand, "npm ci && npm run check");
  assert.match(metadata.artifactSha256, /^[0-9a-f]{64}$/);

  const output = await integrate("release-contract");
  assert.deepEqual(
    (await filesBelow(output)).sort(),
    [
      ...metadata.files.map(file => file.path),
      "404.html",
      "runtime-config.js"
    ].sort()
  );
});

test("Cockpit runtime is DEV-only, public, complete and fail-closed", async () => {
  const output = await integrate("runtime-contract");
  const [index, manifestSource, worker, runtimeSource] = await Promise.all([
    readFile(join(output, "index.html"), "utf8"),
    readFile(join(output, "manifest.webmanifest"), "utf8"),
    readFile(join(output, "service-worker.js"), "utf8"),
    readFile(join(output, "runtime-config.js"), "utf8")
  ]);
  const manifest = JSON.parse(manifestSource);
  const runtime = parseRuntime(runtimeSource);

  assert.match(index, /<title>Fanszene Schweinfurt Cockpit<\/title>/);
  assert.match(index, /src="\/cockpit\/runtime-config\.js"/);
  assert.equal(manifest.id, "/cockpit/");
  assert.equal(manifest.start_url, "/cockpit/");
  assert.equal(manifest.scope, "/cockpit/");
  assert.match(worker, /const COCKPIT_PATH = '\/cockpit\/'/);
  assert.match(worker, /url\.pathname === COCKPIT_RUNTIME_CONFIG\) return false/);
  assert.equal(runtime.environment, "DEV");
  assert.equal(runtime.supabaseUrl, "https://tpieykhhawszlzsoflnl.supabase.co");
  assert.equal(runtime.portalBaseUrl, "https://dev.plaerrdeifl.de/portal");
  assert.equal(runtime.assetBaseUrl, "https://dev.plaerrdeifl.de");
  assert.equal(runtime.googleClientId, "123456789012-cockpit-test.apps.googleusercontent.com");
  assert.doesNotMatch(
    runtimeSource,
    /service[_-]?role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/i
  );

  const bundlePaths = (await filesBelow(output)).filter(path => path.endsWith(".js"));
  const bundles = (await Promise.all(
    bundlePaths.map(path => readFile(join(output, path), "utf8"))
  )).join("\n");

  assert.match(bundles, /contract-pending/);
  assert.match(bundles, /keine vorläufige Freigabe/);
});

test("missing or divergent DEV browser configuration stops the Cockpit build", async () => {
  const missingGoogle = devEnvironment();
  delete missingGoogle.GOOGLE_CLIENT_ID;
  delete missingGoogle.VITE_GOOGLE_CLIENT_ID;

  await assert.rejects(
    integrate("missing-google", missingGoogle),
    /fehlt die Google Web Client-ID/
  );

  await assert.rejects(
    integrate("wrong-project", devEnvironment({
      SUPABASE_URL: "https://wrongproject.supabase.co",
      VITE_SUPABASE_URL: "https://wrongproject.supabase.co"
    })),
    /gehört nicht zum festgelegten DEV-Projekt/
  );

  await assert.rejects(
    integrate("wrong-portal-base", devEnvironment({
      VITE_PORTAL_BASE_URL: "https://dev.plaerrdeifl.de/not-portal"
    })),
    /muss auf den kanonischen DEV-Portalpfad zeigen/
  );

  await assert.rejects(
    integrate("prod-refused", devEnvironment({ PORTAL_ENVIRONMENT: "PROD" })),
    /ausschließlich für PORTAL_ENVIRONMENT=DEV/
  );
});

test("Cockpit files expose a root-only route contract with an isolated 404", async () => {
  const output = await integrate("http-contract");
  const [index, notFound, manifestSource, worker, runtimeSource, headers, redirects] = await Promise.all([
    readFile(join(output, "index.html"), "utf8"),
    readFile(join(output, "404.html"), "utf8"),
    readFile(join(output, "manifest.webmanifest"), "utf8"),
    readFile(join(output, "service-worker.js"), "utf8"),
    readFile(join(output, "runtime-config.js"), "utf8"),
    readFile(join(root, "_headers"), "utf8"),
    readFile(join(root, "_redirects"), "utf8")
  ]);

  assert.match(index, /Fanszene Schweinfurt Cockpit/);
  assert.match(notFound, /data-cockpit-route-contract="root-only-v1"/);
  assert.match(notFound, /href="\/cockpit\/"/);
  assert.doesNotMatch(notFound, /data-route="login"|Plärrdeifl Portal/);
  assert.equal(JSON.parse(manifestSource).scope, "/cockpit/");
  assert.match(worker, /const COCKPIT_PATH = '\/cockpit\/'/);
  assert.equal(parseRuntime(runtimeSource).environment, "DEV");

  assert.match(
    headers,
    /\/cockpit\/manifest\.webmanifest\n\s+Content-Type: application\/manifest\+json; charset=utf-8/
  );
  assert.match(
    headers,
    /\/cockpit\/service-worker\.js[\s\S]*?Content-Type: application\/javascript; charset=utf-8/
  );
  assert.match(
    headers,
    /\/cockpit\/runtime-config\.js[\s\S]*?Cache-Control: no-store[\s\S]*?Content-Type: application\/javascript; charset=utf-8/
  );
  assert.doesNotMatch(redirects, /^\/cockpit(?:\/|\s)/m);
  assert.doesNotMatch(redirects, /^\/\* /m);
});

test("portal build is deterministic and leaves existing app artifacts unchanged", async () => {
  const buildFixture = await mkdtemp(join(tmpdir(), "pd-cockpit-static-build-"));
  const rootFiles = [
    "index.html",
    "fanbus-anmeldung.html",
    "offline.html",
    "favicon.ico",
    "manifest.webmanifest",
    "service-worker.js",
    "_headers",
    "_redirects"
  ];
  const directories = [
    "assets",
    "bus-orga",
    "components",
    "css",
    "js",
    "pages",
    "events",
    "fanbus",
    "liveticker",
    "integrations"
  ];

  try {
    await Promise.all([
      ...rootFiles.map(file => cp(join(root, file), join(buildFixture, file))),
      ...directories.map(directory => cp(
        join(root, directory),
        join(buildFixture, directory),
        { recursive: true }
      )),
      mkdir(join(buildFixture, "scripts"), { recursive: true })
    ]);
    await Promise.all([
      cp(
        join(root, "scripts", "build-static.mjs"),
        join(buildFixture, "scripts", "build-static.mjs")
      ),
      cp(
        join(root, "scripts", "write-runtime-config.mjs"),
        join(buildFixture, "scripts", "write-runtime-config.mjs")
      ),
      cp(
        join(root, "scripts", "integrate-cockpit-release.mjs"),
        join(buildFixture, "scripts", "integrate-cockpit-release.mjs")
      )
    ]);

    const build = async () => execFileAsync(
      process.execPath,
      [join(buildFixture, "scripts", "build-static.mjs")],
      { cwd: buildFixture, env: devEnvironment() }
    );

    await build();
    const first = await snapshot(join(buildFixture, "dist"));
    await build();
    const second = await snapshot(join(buildFixture, "dist"));

    assert.deepEqual(second, first);

    for (const path of [
      "index.html",
      "events/index.html",
      "fanbus/index.html",
      "liveticker/index.html"
    ]) {
      assert.equal(
        digest(await readFile(join(buildFixture, "dist", path))),
        digest(await readFile(join(root, path))),
        `${path} wurde durch die Cockpit-Integration verändert.`
      );
    }

    const [portalIndex, cockpitIndex, cockpitNotFound, redirects, headers, portalWorker] = await Promise.all([
      readFile(join(buildFixture, "dist", "index.html"), "utf8"),
      readFile(join(buildFixture, "dist", "cockpit", "index.html"), "utf8"),
      readFile(join(buildFixture, "dist", "cockpit", "404.html"), "utf8"),
      readFile(join(buildFixture, "dist", "_redirects"), "utf8"),
      readFile(join(buildFixture, "dist", "_headers"), "utf8"),
      readFile(join(buildFixture, "dist", "service-worker.js"), "utf8")
    ]);

    assert.match(portalIndex, /<title>Plärrdeifl Portal<\/title>/);
    assert.match(cockpitIndex, /<title>Fanszene Schweinfurt Cockpit<\/title>/);
    assert.notEqual(cockpitIndex, portalIndex);
    assert.match(cockpitNotFound, /data-cockpit-route-contract="root-only-v1"/);
    assert.notEqual(cockpitNotFound, portalIndex);
    assert.doesNotMatch(redirects, /^\/cockpit(?:\/|\s)/m);
    assert.doesNotMatch(redirects, /^\/\* /m);
    assert.match(headers, /\/cockpit\/runtime-config\.js[\s\S]*Cache-Control: no-store/);

    const cockpitGuard = portalWorker.indexOf('url.pathname === "/cockpit"');
    const navigationHandler = portalWorker.indexOf('request.mode === "navigate"');
    assert.ok(cockpitGuard >= 0 && cockpitGuard < navigationHandler);
    assert.match(portalWorker, /url\.pathname\.startsWith\("\/cockpit\/"\)/);

    await execFileAsync(
      process.execPath,
      [join(buildFixture, "scripts", "build-static.mjs")],
      {
        cwd: buildFixture,
        env: devEnvironment({
          PORTAL_ENVIRONMENT: "PROD",
          VITE_APP_ENV: "PROD",
          SUPABASE_URL: "https://prodfixture.supabase.co",
          VITE_SUPABASE_URL: "https://prodfixture.supabase.co",
          SUPABASE_EXPECTED_PROJECT_REF: "prodfixture",
          LEGAL_IMPRINT_URL: "https://example.com/imprint",
          LEGAL_PRIVACY_URL: "https://example.com/privacy"
        })
      }
    );

    await assert.rejects(
      readFile(join(buildFixture, "dist", "cockpit", "index.html")),
      error => error?.code === "ENOENT"
    );
  } finally {
    await rm(buildFixture, { recursive: true, force: true });
  }
});

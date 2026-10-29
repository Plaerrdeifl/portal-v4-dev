import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
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
  assert.equal(metadata.sourceCommit, "ad14e4b3c48582469510a72fda8045e68b51f682");
  assert.equal(
    metadata.sourcePackageLockSha256,
    "f0e8680fd6b0cc39e0267255a17d780a98f246ae1a06eb175635a45dd8598a27"
  );
  assert.equal(metadata.sourceBuildCommand, "npm ci && npm run check");
  assert.match(metadata.artifactSha256, /^[0-9a-f]{64}$/);
  assert.ok(metadata.files.some(file => file.path === "offline.html"));

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

test("Cockpit runtime is DEV-only, public and bound to the AP-03/R3 contracts", async () => {
  const output = await integrate("runtime-contract");
  const [index, manifestSource, offline, worker, runtimeSource] = await Promise.all([
    readFile(join(output, "index.html"), "utf8"),
    readFile(join(output, "manifest.webmanifest"), "utf8"),
    readFile(join(output, "offline.html"), "utf8"),
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
  assert.match(offline, /data-cockpit-offline-shell="standalone-v1"/);
  assert.match(offline, /Du bist offline/);
  assert.doesNotMatch(offline, /<script\b|runtime-config\.js|localStorage|sessionStorage|Liveticker|Bild-Generator/i);
  assert.match(worker, /const COCKPIT_PATH = '\/cockpit\/'/);
  assert.match(worker, /shell-v2/);
  assert.match(worker, /COCKPIT_OFFLINE_DOCUMENT = `\$\{COCKPIT_PATH\}offline\.html`/);
  assert.match(worker, /response\.redirected/);
  assert.match(worker, /caches\.delete\(key\)/);
  assert.doesNotMatch(worker, /COCKPIT_OFFLINE_DOCUMENT = `\$\{COCKPIT_PATH\}index\.html`/);
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

  for (const contractMarker of [
    "/rest/v1/rpc/pd_api",
    "p_action",
    "p_payload",
    "Ungültige API-Antwort.",
    "Anmeldung erforderlich.",
    "cockpit_access_get",
    "cockpit_admin_users_list",
    "cockpit_admin_user_get",
    "cockpit_admin_access_set",
    "cockpit_admin_personal_capabilities_set",
    "identityCreationAvailable",
    "schemaVersion",
    "cockpit-backend",
    "SYSTEM_ADMIN",
    "ADMIN",
    "USER",
    "liveticker.manage",
    "social_media_generator.use",
    "personallyAssigned",
    "activeSocialMediaTeam",
    "effectiveAllowed",
    "Der serverseitige Cockpit-Zugangsvertrag ist ungültig.",
    "Kein Cockpit-Zugang",
    "Keine Fachmodule freigegeben"
  ]) {
    assert.ok(
      bundles.includes(contractMarker),
      `AP-03/R3-Vertragsmarker fehlt im Cockpit-Bundle: ${contractMarker}`
    );
  }

  assert.doesNotMatch(bundles, /contract-pending|keine vorläufige Freigabe/);
  assert.doesNotMatch(bundles, /portal\.admin/);
  assert.match(bundles, /identityCreationAvailable:!1/);
  assert.match(bundles, /\.schemaVersion!==1\|\|.\.userId!==/);
  assert.match(
    bundles,
    /\.active\?[^?]{0,20}\.allowed\?\{allowed:!0,source:`cockpit-backend`/
  );
  assert.match(
    bundles,
    /Object\.freeze\(\[\{id:`liveticker`,label:`Liveticker`[\s\S]{0,400}\{id:`bild-generator`,label:`Bild-Generator`/
  );
  assert.match(
    bundles,
    /id===`liveticker`\?[^:]{0,200}\.permissions\.liveticker\.effectiveAllowed:[^)]{0,200}\.permissions\.generator\.effectiveAllowed/
  );
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
  const [index, notFound, offline, manifestSource, worker, runtimeSource, headers, redirects] = await Promise.all([
    readFile(join(output, "index.html"), "utf8"),
    readFile(join(output, "404.html"), "utf8"),
    readFile(join(output, "offline.html"), "utf8"),
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
  assert.match(offline, /data-cockpit-offline-shell="standalone-v1"/);
  assert.doesNotMatch(offline, /data-route="login"|Plärrdeifl Portal/);
  assert.equal(JSON.parse(manifestSource).scope, "/cockpit/");
  assert.match(worker, /const COCKPIT_PATH = '\/cockpit\/'/);
  assert.match(worker, /shell-v2/);
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
  assert.match(
    headers,
    /\/cockpit\/offline\.html\n\s+Content-Type: text\/html; charset=utf-8/
  );
  assert.deepEqual(
    redirects.split(/\r?\n/).filter(line => line.startsWith("/cockpit")),
    ["/cockpit/offline.html /cockpit/offline 200"]
  );
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

    const [portalIndex, cockpitIndex, cockpitNotFound, cockpitOffline, redirects, headers, portalWorker] = await Promise.all([
      readFile(join(buildFixture, "dist", "index.html"), "utf8"),
      readFile(join(buildFixture, "dist", "cockpit", "index.html"), "utf8"),
      readFile(join(buildFixture, "dist", "cockpit", "404.html"), "utf8"),
      readFile(join(buildFixture, "dist", "cockpit", "offline.html"), "utf8"),
      readFile(join(buildFixture, "dist", "_redirects"), "utf8"),
      readFile(join(buildFixture, "dist", "_headers"), "utf8"),
      readFile(join(buildFixture, "dist", "service-worker.js"), "utf8")
    ]);

    assert.match(portalIndex, /<title>Plärrdeifl Portal<\/title>/);
    assert.match(cockpitIndex, /<title>Fanszene Schweinfurt Cockpit<\/title>/);
    assert.notEqual(cockpitIndex, portalIndex);
    assert.match(cockpitNotFound, /data-cockpit-route-contract="root-only-v1"/);
    assert.notEqual(cockpitNotFound, portalIndex);
    assert.match(cockpitOffline, /data-cockpit-offline-shell="standalone-v1"/);
    assert.notEqual(cockpitOffline, portalIndex);
    assert.deepEqual(
      redirects.split(/\r?\n/).filter(line => line.startsWith("/cockpit")),
      ["/cockpit/offline.html /cockpit/offline 200"]
    );
    assert.deepEqual(
      redirects.split(/\r?\n/).filter(line => /^\/\s+/.test(line)),
      ["/ /cockpit/ 302"],
      "Nur der exakte DEV-Root-Pfad darf aufs Cockpit weiterleiten."
    );
    assert.equal(
      redirects,
      `/ /cockpit/ 302\n${await readFile(join(root, "_redirects"), "utf8")}`,
      "Sämtliche bestehenden OAuth-/Cockpit-Redirects bleiben unverändert."
    );
    assert.doesNotMatch(redirects, /^\/\* /m);
    assert.match(headers, /\/cockpit\/runtime-config\.js[\s\S]*Cache-Control: no-store/);

    // The replacement worker is intentionally NOT an app worker: it only
    // unregisters its own obsolete root scope and preserves all caches.
    assert.match(portalWorker, /Cockpit DEV: retire the previous root-scope Portal PWA/);
    assert.match(portalWorker, /self\.registration\.unregister\(\)/);
    assert.match(portalWorker, /self\.skipWaiting\(\)/);
    assert.doesNotMatch(portalWorker, /caches\.|caches\[|cache\.delete|clients\.claim|addAll\(/);
    const registered = new Map();
    let unregistered = 0;
    let skippedWaiting = 0;
    const rootScope = "https://dev.plaerrdeifl.de/";
    const self = {
      location: { href: `${rootScope}service-worker.js` },
      registration: {
        scope: rootScope,
        unregister: async () => { unregistered += 1; return true; }
      },
      skipWaiting: async () => { skippedWaiting += 1; },
      addEventListener: (name, handler) => registered.set(name, handler)
    };
    runInNewContext(portalWorker, { self, URL, Promise });
    assert.deepEqual([...registered.keys()].sort(), ["activate", "install"]);
    let installed;
    registered.get("install")({ waitUntil: promise => { installed = promise; } });
    await installed;
    assert.equal(skippedWaiting, 1);
    let activated;
    registered.get("activate")({ waitUntil: promise => { activated = promise; } });
    await activated;
    assert.equal(unregistered, 1, "Nur die eigene Root-Registrierung wird abgemeldet.");

    self.registration.scope = `${rootScope}fanbus/`;
    registered.get("activate")({ waitUntil: promise => { activated = promise; } });
    await activated;
    assert.equal(unregistered, 1, "Fanbus-Scope darf nie abgemeldet werden.");
    self.registration.scope = rootScope;
    self.location.href = `${rootScope}cockpit/service-worker.js`;
    registered.get("activate")({ waitUntil: promise => { activated = promise; } });
    await activated;
    assert.equal(unregistered, 1, "Cockpit-Worker darf nie abgemeldet werden.");

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
    assert.equal(
      await readFile(join(buildFixture, "dist", "_redirects"), "utf8"),
      await readFile(join(root, "_redirects"), "utf8"),
      "PROD darf weder Root-Cockpit-Redirect noch neue Cockpit-Artefakte enthalten."
    );
    assert.equal(
      await readFile(join(buildFixture, "dist", "service-worker.js"), "utf8"),
      await readFile(join(root, "service-worker.js"), "utf8"),
      "PROD muss den originalen Portal-Service-Worker exakt behalten."
    );

    await writeFile(
      join(buildFixture, "js", "runtime-config.js"),
      "window.PD_RUNTIME_CONFIG = Object.freeze({ environment: \"LOCAL\" });\n"
    );

    await execFileAsync(
      process.execPath,
      [join(buildFixture, "scripts", "build-static.mjs")],
      {
        cwd: buildFixture,
        env: devEnvironment({
          PORTAL_ENVIRONMENT: "LOCAL",
          VITE_APP_ENV: "LOCAL",
          SUPABASE_URL: "",
          VITE_SUPABASE_URL: "",
          SUPABASE_PUBLISHABLE_KEY: "",
          VITE_SUPABASE_PUBLISHABLE_KEY: ""
        })
      }
    );

    await assert.rejects(
      readFile(join(buildFixture, "dist", "cockpit", "offline.html")),
      error => error?.code === "ENOENT"
    );
    assert.equal(
      await readFile(join(buildFixture, "dist", "_redirects"), "utf8"),
      await readFile(join(root, "_redirects"), "utf8"),
      "LOCAL darf keine DEV-Root-Umleitung übernehmen."
    );
    assert.equal(
      await readFile(join(buildFixture, "dist", "service-worker.js"), "utf8"),
      await readFile(join(root, "service-worker.js"), "utf8"),
      "LOCAL muss den originalen Portal-Service-Worker exakt behalten."
    );
  } finally {
    await rm(buildFixture, { recursive: true, force: true });
  }
});

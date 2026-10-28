#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dirname, "..");
const releaseMetadataPath = resolve(
  root,
  "integrations",
  "cockpit",
  "release.json"
);
const cockpitNotFoundPath = resolve(
  root,
  "integrations",
  "cockpit",
  "404.html"
);

const { values } = parseArgs({
  options: {
    output: {
      type: "string",
      default: resolve(root, "dist", "cockpit")
    }
  },
  strict: true
});

const output = resolve(values.output);
const expectedOutputParent = resolve(root, "dist");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalized(value) {
  return String(value || "").trim();
}

function withoutTrailingSlash(value) {
  return normalized(value).replace(/\/+$/, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeReleasePath(value) {
  const path = normalized(value);

  assert(
    path
      && !path.startsWith("/")
      && !path.startsWith("\\")
      && !path.includes("\\")
      && !path.split("/").includes("..")
      && !path.split("/").includes("."),
    `Ungültiger Cockpit-Artefaktpfad: ${path || "<leer>"}`
  );

  return path;
}

async function listFiles(directory, current = directory) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(current, entry.name);
    const stats = await lstat(absolute);

    assert(
      !stats.isSymbolicLink(),
      "Cockpit-Artefakte dürfen keine symbolischen Links enthalten."
    );

    if (stats.isDirectory()) {
      files.push(...await listFiles(directory, absolute));
      continue;
    }

    assert(
      stats.isFile(),
      "Cockpit-Artefakte dürfen nur reguläre Dateien enthalten."
    );

    files.push(relative(directory, absolute).split(sep).join("/"));
  }

  return files.sort();
}

function selectMatchingRuntimeValue(primaryName, fallbackName) {
  const primary = normalized(process.env[primaryName]);
  const fallback = normalized(process.env[fallbackName]);

  if (primary && fallback) {
    assert(
      primary === fallback,
      `${primaryName} und ${fallbackName} müssen denselben öffentlichen Browserwert enthalten.`
    );
  }

  return primary || fallback;
}

function validateDevRuntime() {
  const environment = normalized(process.env.PORTAL_ENVIRONMENT).toUpperCase();
  const viteEnvironment = normalized(process.env.VITE_APP_ENV).toUpperCase();

  assert(
    environment === "DEV",
    "Die Cockpit-Integration ist ausschließlich für PORTAL_ENVIRONMENT=DEV zulässig."
  );

  if (viteEnvironment) {
    assert(
      viteEnvironment === "DEV",
      "VITE_APP_ENV muss für die Cockpit-Integration DEV sein."
    );
  }

  const supabaseUrl = withoutTrailingSlash(
    selectMatchingRuntimeValue("SUPABASE_URL", "VITE_SUPABASE_URL")
  );
  const publishableKey = selectMatchingRuntimeValue(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY"
  );
  const googleClientId = selectMatchingRuntimeValue(
    "GOOGLE_CLIENT_ID",
    "VITE_GOOGLE_CLIENT_ID"
  );
  const expectedProjectRef = normalized(
    process.env.SUPABASE_EXPECTED_PROJECT_REF
  );
  const devProjectRef = "tpieykhhawszlzsoflnl";

  assert(supabaseUrl, "Für das DEV-Cockpit fehlt die Supabase URL.");
  assert(publishableKey, "Für das DEV-Cockpit fehlt der Supabase Browser-Schlüssel.");
  assert(googleClientId, "Für das DEV-Cockpit fehlt die Google Web Client-ID.");
  assert(
    expectedProjectRef === devProjectRef,
    "Das DEV-Cockpit muss an den festgelegten Supabase-DEV-Projekt-Ref gebunden sein."
  );

  let parsedSupabase;

  try {
    parsedSupabase = new URL(supabaseUrl);
  } catch {
    throw new Error("Die Supabase URL des DEV-Cockpits ist ungültig.");
  }

  assert(
    parsedSupabase.protocol === "https:"
      && parsedSupabase.origin === `https://${devProjectRef}.supabase.co`
      && !parsedSupabase.username
      && !parsedSupabase.password,
    "Die Supabase URL des DEV-Cockpits gehört nicht zum festgelegten DEV-Projekt."
  );

  assert(
    publishableKey.length >= 20
      && !/service[_-]?role|sb_secret_/i.test(publishableKey),
    "Der Supabase Browser-Schlüssel des DEV-Cockpits ist nicht öffentlich verwendbar."
  );

  assert(
    /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(googleClientId),
    "Die Google Web Client-ID des DEV-Cockpits ist ungültig."
  );

  const canonicalOrigin = "https://dev.plaerrdeifl.de";
  const portalBaseUrl = withoutTrailingSlash(
    process.env.VITE_PORTAL_BASE_URL || `${canonicalOrigin}/portal`
  );
  const assetBaseUrl = withoutTrailingSlash(
    process.env.VITE_PORTAL_ASSET_BASE_URL || canonicalOrigin
  );

  assert(
    portalBaseUrl === `${canonicalOrigin}/portal`,
    "VITE_PORTAL_BASE_URL muss auf den kanonischen DEV-Portalpfad zeigen."
  );
  assert(
    assetBaseUrl === canonicalOrigin,
    "VITE_PORTAL_ASSET_BASE_URL muss auf den kanonischen DEV-Origin zeigen."
  );

  return {
    environment: "DEV",
    supabaseUrl,
    supabasePublishableKey: publishableKey,
    googleClientId,
    portalBaseUrl,
    assetBaseUrl
  };
}

async function validateRelease() {
  const metadata = JSON.parse(await readFile(releaseMetadataPath, "utf8"));

  assert(metadata.schemaVersion === 1, "Unbekanntes Cockpit-Release-Schema.");
  assert(metadata.environment === "DEV", "Das Cockpit-Artefakt muss DEV-only sein.");
  assert(
    metadata.sourceRepository === "Plaerrdeifl/fanszene-cockpit",
    "Das Cockpit-Artefakt besitzt ein unerwartetes Quellrepository."
  );
  assert(
    /^[0-9a-f]{40}$/.test(metadata.sourceCommit),
    "Die Cockpit-Quell-SHA ist ungültig."
  );
  assert(
    /^[0-9a-f]{64}$/.test(metadata.sourcePackageLockSha256),
    "Der Cockpit-package-lock-Nachweis ist ungültig."
  );
  assert(
    metadata.artifactRoot === "integrations/cockpit/release",
    "Der Cockpit-Artefaktpfad ist ungültig."
  );
  assert(
    /^[0-9a-f]{64}$/.test(metadata.artifactSha256),
    "Der Cockpit-Artefakt-Hash ist ungültig."
  );
  assert(
    Array.isArray(metadata.files) && metadata.files.length > 0,
    "Das Cockpit-Artefakt besitzt keine Dateiliste."
  );

  const releaseRoot = resolve(root, metadata.artifactRoot);
  assert(
    releaseRoot.startsWith(`${resolve(root, "integrations", "cockpit")}${sep}`),
    "Das Cockpit-Artefakt liegt außerhalb des Integrationsbereichs."
  );

  const actualPaths = await listFiles(releaseRoot);
  const expectedPaths = metadata.files.map(file => safeReleasePath(file.path));
  const uniquePaths = new Set(expectedPaths);

  assert(
    uniquePaths.size === expectedPaths.length,
    "Die Cockpit-Artefaktliste enthält doppelte Pfade."
  );
  assert(
    JSON.stringify(actualPaths) === JSON.stringify([...expectedPaths].sort()),
    "Cockpit-Artefakt und versionierte Dateiliste weichen voneinander ab."
  );

  let canonicalManifest = "";

  for (const file of metadata.files) {
    const path = safeReleasePath(file.path);
    const bytes = await readFile(resolve(releaseRoot, path));
    const digest = sha256(bytes);

    assert(Number.isSafeInteger(file.bytes) && file.bytes >= 0, `Ungültige Dateigröße für ${path}.`);
    assert(file.bytes === bytes.byteLength, `Dateigröße des Cockpit-Artefakts stimmt nicht: ${path}.`);
    assert(file.sha256 === digest, `SHA-256 des Cockpit-Artefakts stimmt nicht: ${path}.`);
    canonicalManifest += `${digest}  ${bytes.byteLength}  ${path}\n`;
  }

  assert(
    sha256(canonicalManifest) === metadata.artifactSha256,
    "Der Gesamt-Hash des Cockpit-Artefakts stimmt nicht."
  );

  for (const required of [
    "index.html",
    "manifest.webmanifest",
    "offline.html",
    "service-worker.js",
    "icons/cockpit-192.png",
    "icons/cockpit-512.png",
    "icons/cockpit-maskable-192.png",
    "icons/cockpit-maskable-512.png"
  ]) {
    assert(uniquePaths.has(required), `Cockpit-Artefaktdatei fehlt: ${required}.`);
  }

  assert(
    actualPaths.some(path => /^assets\/[^/]+\.js$/.test(path))
      && actualPaths.some(path => /^assets\/[^/]+\.css$/.test(path)),
    "Das Cockpit-Artefakt enthält nicht die erwarteten JS- und CSS-Bundles."
  );
  assert(
    !uniquePaths.has("runtime-config.js"),
    "runtime-config.js darf nicht Teil des versionierten Cockpit-Artefakts sein."
  );

  const [index, manifestSource, offline, worker] = await Promise.all([
    readFile(resolve(releaseRoot, "index.html"), "utf8"),
    readFile(resolve(releaseRoot, "manifest.webmanifest"), "utf8"),
    readFile(resolve(releaseRoot, "offline.html"), "utf8"),
    readFile(resolve(releaseRoot, "service-worker.js"), "utf8")
  ]);
  const manifest = JSON.parse(manifestSource);

  assert(
    /<title>Fanszene Schweinfurt Cockpit<\/title>/.test(index),
    "Das Cockpit-Artefakt besitzt nicht den erwarteten Inhalt."
  );
  assert(
    /src="\/cockpit\/runtime-config\.js"/.test(index),
    "Das Cockpit lädt seine Runtime-Konfiguration nicht aus /cockpit/."
  );
  assert(
    /href="\/cockpit\/manifest\.webmanifest"/.test(index)
      && /(?:src|href)="\/cockpit\/assets\//.test(index),
    "Cockpit-Manifest oder Assets sind nicht auf /cockpit/ begrenzt."
  );

  assert(manifest.id === "/cockpit/", "Die Cockpit-Manifest-ID ist nicht isoliert.");
  assert(manifest.start_url === "/cockpit/", "Die Cockpit-Start-URL ist nicht isoliert.");
  assert(manifest.scope === "/cockpit/", "Der Cockpit-Manifest-Scope ist nicht isoliert.");
  assert(
    manifest.icons.every(icon => String(icon.src).startsWith("/cockpit/icons/")),
    "Die Cockpit-Manifest-Icons liegen außerhalb von /cockpit/."
  );

  assert(
    /data-cockpit-offline-shell="standalone-v1"/.test(offline)
      && /<title>Cockpit offline<\/title>/.test(offline)
      && /Du bist offline/.test(offline),
    "Die eigenständige Cockpit-Offline-Oberfläche fehlt oder ist ungültig."
  );
  assert(
    !/<script\b|runtime-config\.js|localStorage|sessionStorage|Liveticker|Bild-Generator/i.test(offline),
    "Die Cockpit-Offline-Oberfläche darf keine Runtime-, Auth- oder Fachmodulabhängigkeit enthalten."
  );

  assert(
    /const COCKPIT_PATH = '\/cockpit\/'/.test(worker),
    "Der Cockpit-Service-Worker besitzt keinen festen /cockpit/-Pfad."
  );
  assert(
    /shell-v2/.test(worker)
      && /COCKPIT_OFFLINE_DOCUMENT = `\$\{COCKPIT_PATH\}offline\.html`/.test(worker)
      && /response\.redirected/.test(worker),
    "Der Cockpit-Service-Worker besitzt nicht den redirect-sicheren Offline-Vertrag v2."
  );
  assert(
    /url\.pathname === COCKPIT_RUNTIME_CONFIG\) return false/.test(worker),
    "Der Cockpit-Service-Worker schließt runtime-config.js nicht aus."
  );
  assert(
    /key\.startsWith\(COCKPIT_CACHE_PREFIX\) && key !== COCKPIT_CACHE/.test(worker)
      && /caches\.delete\(key\)/.test(worker),
    "Der Cockpit-Service-Worker migriert alte Cockpit-Caches nicht kontrolliert."
  );
  assert(
    !/COCKPIT_OFFLINE_DOCUMENT = `\$\{COCKPIT_PATH\}index\.html`/.test(worker),
    "index.html darf nicht als Cockpit-Offline-Navigationsfallback dienen."
  );
  assert(
    !/skipWaiting|location\.reload/.test(worker),
    "Der Cockpit-Service-Worker enthält einen unzulässigen Übernahme- oder Reload-Pfad."
  );

  const bundles = await Promise.all(
    actualPaths
      .filter(path => /^assets\/[^/]+\.js$/.test(path))
      .map(path => readFile(resolve(releaseRoot, path), "utf8"))
  );
  const applicationBundle = bundles.join("\n");

  for (const requiredContractMarker of [
    "/rest/v1/rpc/pd_api",
    "p_action",
    "p_payload",
    "Ungültige API-Antwort.",
    "Anmeldung erforderlich.",
    "cockpit_access_get",
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
    assert(
      applicationBundle.includes(requiredContractMarker),
      `Das Cockpit-Artefakt enthält den AP-03/R1-Vertragsmarker nicht: ${requiredContractMarker}`
    );
  }

  assert(
    !applicationBundle.includes("contract-pending")
      && !applicationBundle.includes("keine vorläufige Freigabe"),
    "Das Cockpit-Artefakt enthält noch den abgelösten AP-02-Vertragsstatus."
  );
  assert(
    !applicationBundle.includes("portal.admin"),
    "Das Cockpit-Artefakt darf portal.admin nicht als lokale Zugangsquelle auswerten."
  );
  assert(
    /\.schemaVersion!==1\|\|.\.userId!==/.test(applicationBundle)
      && /\.active\?[^?]{0,20}\.allowed\?\{allowed:!0,source:`cockpit-backend`/.test(applicationBundle),
    "Das Cockpit-Artefakt bindet AP-03/R1 nicht an Schema, Sessionbenutzer und serverseitige Freigabe."
  );
  assert(
    /Object\.freeze\(\[\{id:`liveticker`,label:`Liveticker`[\s\S]{0,400}\{id:`bild-generator`,label:`Bild-Generator`/.test(applicationBundle)
      && /id===`liveticker`\?[^:]{0,200}\.permissions\.liveticker\.effectiveAllowed:[^)]{0,200}\.permissions\.generator\.effectiveAllowed/.test(applicationBundle),
    "Das Cockpit-Artefakt begrenzt die Navigation nicht nachweisbar auf die zwei effektiven Fachrechte."
  );

  return { metadata, releaseRoot };
}

async function validateNotFoundPage() {
  const source = await readFile(cockpitNotFoundPath, "utf8");

  assert(
    /<title>Cockpit-Seite nicht gefunden<\/title>/.test(source)
      && /data-cockpit-route-contract="root-only-v1"/.test(source),
    "Die Cockpit-404-Seite besitzt nicht den erwarteten Root-only-Vertrag."
  );
  assert(
    /href="\/cockpit\/"/.test(source),
    "Die Cockpit-404-Seite führt nicht zum unterstützten Einstieg zurück."
  );
  assert(
    !/data-route="login"|<title>Plärrdeifl Portal<\/title>/.test(source),
    "Die Cockpit-404-Seite darf kein Portal-Fallback enthalten."
  );
}

assert(
  output === expectedOutputParent || output.startsWith(`${expectedOutputParent}${sep}`),
  "Das Cockpit darf nur in den dist-Ausgabebaum integriert werden."
);

const runtime = validateDevRuntime();
const { metadata, releaseRoot } = await validateRelease();
await validateNotFoundPage();

await rm(output, { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await cp(releaseRoot, output, { recursive: true });
await cp(cockpitNotFoundPath, resolve(output, "404.html"));

const runtimeSource =
  "window.PD_RUNTIME_CONFIG = Object.freeze(" +
  JSON.stringify(runtime, null, 2) +
  ");\n";

await writeFile(
  resolve(output, "runtime-config.js"),
  runtimeSource,
  { encoding: "utf8", mode: 0o600 }
);

console.log(
  `Cockpit ${metadata.sourceCommit} verifiziert und nach ${output} integriert.`
);

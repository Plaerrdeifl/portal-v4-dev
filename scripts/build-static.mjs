import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const runtimeOutput = resolve(dist, "js", "runtime-config.js");

const files = [
  "index.html",
  "fanbus-anmeldung.html",
  "offline.html",
  "favicon.ico",
  "manifest.webmanifest",
  "service-worker.js"
];

const directories = [
  "assets",
  "bus-orga",
  "components",
  "css",
  "js",
  "pages"
];

const optionalFiles = [
  "_headers",
  "_redirects",
  "liveticker-local-handoff.html"
];

const optionalDirectories = [
  "oauth",
  "liveticker",
  "events",
  "fanbus"
];

const allowedEnvironments = new Set(["LOCAL", "DEV", "PROD"]);
const environment = String(
  process.env.PORTAL_ENVIRONMENT || ""
).trim().toUpperCase();

if (!allowedEnvironments.has(environment)) {
  throw new Error(
    "PORTAL_ENVIRONMENT muss ausdrücklich LOCAL, DEV oder PROD sein."
  );
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(dist, file));
}

for (const directory of directories) {
  await cp(
    resolve(root, directory),
    resolve(dist, directory),
    { recursive: true }
  );
}

for (const file of optionalFiles) {
  try {
    await access(resolve(root, file), constants.R_OK);
  } catch {
    continue;
  }

  await cp(resolve(root, file), resolve(dist, file));
}

for (const directory of optionalDirectories) {
  try {
    await access(resolve(root, directory), constants.R_OK);
  } catch {
    continue;
  }

  await cp(
    resolve(root, directory),
    resolve(dist, directory),
    { recursive: true }
  );
}

try {
  await access(
    resolve(root, "oauth", "consent", "index.html"),
    constants.R_OK
  );
  await cp(
    resolve(root, "oauth", "consent", "index.html"),
    resolve(dist, "oauth-consent.html")
  );
} catch {
  // OAuth is optional for isolated/static fixtures.
}

/*
 * Eine möglicherweise vorhandene lokale Runtime-Konfiguration wird nach dem
 * Kopieren immer entfernt. DEV und PROD dürfen sie niemals übernehmen.
 */
await rm(runtimeOutput, { force: true });

const supabaseUrl = String(
  process.env.SUPABASE_URL || ""
).trim().replace(/\/$/, "");

const publishableKey = String(
  process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || ""
).trim();

const expectedProjectRef = String(
  process.env.SUPABASE_EXPECTED_PROJECT_REF || ""
).trim();

const devProjectRef = "tpieykhhawszlzsoflnl";

function validateRemoteProject(url, projectRef) {
  if (!/^[a-z0-9]+$/.test(projectRef)) {
    throw new Error(
      "SUPABASE_EXPECTED_PROJECT_REF fehlt oder ist ungültig."
    );
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL ist ungültig.");
  }

  const expectedHost = `${projectRef}.supabase.co`;

  if (
    parsedUrl.protocol !== "https:"
    || parsedUrl.hostname !== expectedHost
    || parsedUrl.username
    || parsedUrl.password
  ) {
    throw new Error(
      `SUPABASE_URL gehört nicht zum erwarteten Projekt ${projectRef}.`
    );
  }
}

async function generateRuntimeConfig() {
  await execFileAsync(
    process.execPath,
    [
      resolve(root, "scripts", "write-runtime-config.mjs"),
      "--environment",
      environment,
      "--output",
      runtimeOutput
    ],
    {
      cwd: root,
      env: process.env
    }
  );
}

const eventsRuntimeOutput = resolve(dist, "events", "runtime-config.js");
const eventsIndex = resolve(dist, "events", "index.html");
const fanbusRuntimeOutput = resolve(dist, "fanbus", "runtime-config.js");
const fanbusIndex = resolve(dist, "fanbus", "index.html");
const cockpitOutput = resolve(dist, "cockpit");

if (environment === "LOCAL") {
  if (Boolean(supabaseUrl) !== Boolean(publishableKey)) {
    throw new Error(
      "Für LOCAL müssen Supabase URL und Browser-Schlüssel gemeinsam angegeben werden."
    );
  }

  if (supabaseUrl && publishableKey) {
    await generateRuntimeConfig();
  } else {
    const localRuntime = resolve(root, "js", "runtime-config.js");

    try {
      await access(localRuntime, constants.R_OK);
    } catch {
      throw new Error(
        "Für LOCAL fehlt eine lesbare js/runtime-config.js."
      );
    }

    await cp(localRuntime, runtimeOutput);
  }
} else {
  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Für DEV und PROD sind SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY erforderlich."
    );
  }

  validateRemoteProject(supabaseUrl, expectedProjectRef);

  if (
    environment === "DEV"
    && expectedProjectRef !== devProjectRef
  ) {
    throw new Error(
      "DEV muss an das festgelegte Supabase-DEV-Projekt gebunden sein."
    );
  }

  if (
    environment === "PROD"
    && expectedProjectRef === devProjectRef
  ) {
    throw new Error(
      "PROD darf nicht mit dem Supabase-DEV-Projekt gebaut werden."
    );
  }

  await generateRuntimeConfig();
}

if (environment === "DEV") {
  await execFileAsync(
    process.execPath,
    [
      resolve(root, "scripts", "integrate-cockpit-release.mjs"),
      "--output",
      cockpitOutput
    ],
    {
      cwd: root,
      env: process.env
    }
  );

  // DEV-only source-owned Liveticker release: standalone PWA plus Cockpit module.
  await execFileAsync(
    process.execPath,
    [resolve(root, "scripts", "integrate-liveticker-release.mjs")],
    { cwd: root, env: process.env }
  );

  // Exact DEV root entry only. Keep the legacy root files and worker intact
  // until the separately verified browser/PWA migration can retire them.
  // Never ship this redirect in LOCAL or PROD builds.
  const redirectsPath = resolve(dist, "_redirects");
  let redirects = "";

  try {
    redirects = await readFile(redirectsPath, "utf8");
  } catch (error) {
    // Minimal/isolated DEV builds can omit the optional _redirects file.
    if (error?.code !== "ENOENT") throw error;
  }

  if (redirects.split(/\r?\n/).some(line => /^\/\s+/.test(line))) {
    throw new Error("Bereits vorhandener Root-Redirect verhindert die Cockpit-DEV-Umstellung.");
  }

  await writeFile(redirectsPath, `/ /cockpit/ 302\n${redirects}`);

  // DEV-only retirement of the obsolete root-scope Portal worker.
  // Existing registrations receive this as an update: no precache, fetch,
  // push or notification handlers are installed. This worker unregisters
  // only itself (scope /). All caches and other PWA registrations are kept,
  // so no existing browser data is deleted as a side effect.
  const devRootWorkerRetirement = `/* Cockpit DEV: retire the previous root-scope Portal PWA. */
self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const script = new URL(self.location.href);
    if (
      scope.origin !== script.origin
      || scope.pathname !== "/"
      || script.pathname !== "/service-worker.js"
    ) return;
    await self.registration.unregister();
  })());
});
`;
  await writeFile(resolve(dist, "service-worker.js"), devRootWorkerRetirement);
}

try {
  await access(eventsIndex, constants.R_OK);
  await cp(runtimeOutput, eventsRuntimeOutput);
} catch {
  // Events is optional until its DEV integration is enabled.
}

try {
  await access(fanbusIndex, constants.R_OK);
  await cp(runtimeOutput, fanbusRuntimeOutput);
} catch {
  // Fanbus is optional until its DEV integration is enabled.
}

console.log(
  `Statisches Portal für ${environment} erfolgreich nach dist gebaut.`
);

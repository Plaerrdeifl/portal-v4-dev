import { access, cp, mkdir, rm } from "node:fs/promises";
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

console.log(
  `Statisches Portal für ${environment} erfolgreich nach dist gebaut.`
);
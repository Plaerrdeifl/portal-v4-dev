import { access, cp, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

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

const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(
  process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || ""
).trim();

if (supabaseUrl && publishableKey) {
  await execFileAsync(
    process.execPath,
    [
      resolve(root, "scripts", "write-runtime-config.mjs"),
      "--environment",
      "DEV",
      "--output",
      resolve(dist, "js", "runtime-config.js")
    ],
    {
      cwd: root,
      env: process.env
    }
  );

  console.log("DEV-Runtime-Konfiguration aus Umgebungsvariablen erzeugt.");
} else {
  const localRuntime = resolve(root, "js", "runtime-config.js");

  try {
    await access(localRuntime, constants.R_OK);
  } catch {
    throw new Error(
      "SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY fehlen und es existiert keine lokale Runtime-Konfiguration."
    );
  }

  console.log("Vorhandene lokale DEV-Runtime-Konfiguration übernommen.");
}

console.log("Statisches Portal erfolgreich nach dist gebaut.");
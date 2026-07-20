#!/usr/bin/env node

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    key: { type: "string" },
    environment: { type: "string", default: "DEV" },
    output: { type: "string", default: "js/runtime-config.js" }
  },
  strict: true
});

const url = String(values.url || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const key = String(values.key || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const environment = String(values.environment || "DEV").trim().toUpperCase();
const output = resolve(values.output);

if (!url || !key) {
  throw new Error("Supabase URL und Publishable Key sind erforderlich.");
}

let parsed;
try { parsed = new URL(url); }
catch { throw new Error("Die Supabase URL ist ungültig."); }

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHosts.has(parsed.hostname))) {
  throw new Error("Nur HTTPS oder lokale HTTP-Adressen sind zulässig.");
}

if (key.length < 20 || /service[_-]?role/i.test(key)) {
  throw new Error("Der angegebene Browser-Schlüssel ist ungültig oder nicht öffentlich verwendbar.");
}

const content = `window.PD_RUNTIME_CONFIG = Object.freeze(${JSON.stringify({
  supabaseUrl: url,
  supabasePublishableKey: key,
  environment
}, null, 2)});\n`;

await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp-${process.pid}`;
await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
await rename(temporary, output);
console.log(`Runtime-Konfiguration erzeugt: ${output}`);
console.log(`Umgebung: ${environment}`);
console.log("Der öffentliche Browser-Schlüssel wurde nicht ausgegeben.");

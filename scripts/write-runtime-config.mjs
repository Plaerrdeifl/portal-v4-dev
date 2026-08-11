#!/usr/bin/env node

import {
  mkdir,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: {
      type: "string"
    },
    key: {
      type: "string"
    },
    environment: {
      type: "string",
      default: "DEV"
    },
    output: {
      type: "string",
      default: "js/runtime-config.js"
    }
  },
  strict: true
});

const url = String(
  values.url
  || process.env.SUPABASE_URL
  || ""
).trim().replace(/\/$/, "");

const key = String(
  values.key
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || ""
).trim();

const environment = String(
  values.environment || "DEV"
).trim().toUpperCase();

const googleClientId = String(
  process.env.GOOGLE_CLIENT_ID || ""
).trim();

const m310TurnstileSiteKey = String(
  process.env.M310_TURNSTILE_SITE_KEY || ""
).trim();

const legalImprintUrl = String(
  process.env.LEGAL_IMPRINT_URL || ""
).trim();

const legalPrivacyUrl = String(
  process.env.LEGAL_PRIVACY_URL || ""
).trim();

const output = resolve(values.output);

if (!url || !key) {
  throw new Error(
    "Supabase URL und Publishable Key sind erforderlich."
  );
}

if (
  environment !== "DEV"
  && environment !== "PROD"
) {
  throw new Error(
    "Die Umgebung muss exakt DEV oder PROD sein."
  );
}

if (
  !m310TurnstileSiteKey
  || m310TurnstileSiteKey === "YOUR_TURNSTILE_SITE_KEY"
) {
  throw new Error(
    "M310_TURNSTILE_SITE_KEY ist für DEV und PROD erforderlich " +
    "und darf kein Platzhalter sein."
  );
}

let parsed;

try {
  parsed = new URL(url);
}
catch {
  throw new Error(
    "Die Supabase URL ist ungültig."
  );
}

const localHosts = new Set([
  "127.0.0.1",
  "localhost",
  "::1"
]);

if (
  parsed.protocol !== "https:"
  && !(
    parsed.protocol === "http:"
    && localHosts.has(parsed.hostname)
  )
) {
  throw new Error(
    "Nur HTTPS oder lokale HTTP-Adressen sind zulässig."
  );
}

if (
  key.length < 20
  || /service[_-]?role/i.test(key)
) {
  throw new Error(
    "Der angegebene Browser-Schlüssel ist ungültig " +
    "oder nicht öffentlich verwendbar."
  );
}

function privateHostname(value) {
  const host = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (
    host === "localhost"
    || host === "::1"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.startsWith("fc")
    || host.startsWith("fd")
    || host.startsWith("fe80:")
  ) {
    return true;
  }

  const parts = host.split(".");

  if (
    parts.length !== 4
    || parts.some(part => !/^\d+$/.test(part))
  ) {
    return false;
  }

  const numbers = parts.map(Number);

  if (
    numbers.some(number => number < 0 || number > 255)
  ) {
    return false;
  }

  return (
    numbers[0] === 0
    || numbers[0] === 10
    || numbers[0] === 127
    || (
      numbers[0] === 169
      && numbers[1] === 254
    )
    || (
      numbers[0] === 172
      && numbers[1] >= 16
      && numbers[1] <= 31
    )
    || (
      numbers[0] === 192
      && numbers[1] === 168
    )
    || numbers[0] >= 224
  );
}

function validateLegalUrl(
  value,
  label,
  required
) {
  if (!value) {
    if (required) {
      throw new Error(
        label + " ist für PROD erforderlich."
      );
    }

    return "";
  }

  let legalUrl;

  try {
    legalUrl = new URL(value);
  }
  catch {
    throw new Error(
      label + " ist keine gültige URL."
    );
  }

  if (
    legalUrl.protocol !== "https:"
    || legalUrl.username
    || legalUrl.password
    || privateHostname(legalUrl.hostname)
  ) {
    throw new Error(
      label + " muss eine öffentliche HTTPS-URL sein."
    );
  }

  return legalUrl.href;
}

const requireLegalUrls =
  environment === "PROD";

const imprintUrl = validateLegalUrl(
  legalImprintUrl,
  "LEGAL_IMPRINT_URL",
  requireLegalUrls
);

const privacyUrl = validateLegalUrl(
  legalPrivacyUrl,
  "LEGAL_PRIVACY_URL",
  requireLegalUrls
);

const runtime = {
  supabaseUrl: url,
  supabasePublishableKey: key,
  m310TurnstileSiteKey,
  environment,
  legalImprintUrl: imprintUrl,
  legalPrivacyUrl: privacyUrl
};

if (googleClientId) {
  runtime.googleClientId = googleClientId;
}

const content =
  "window.PD_RUNTIME_CONFIG = Object.freeze(" +
  JSON.stringify(runtime, null, 2) +
  ");\n";

await mkdir(
  dirname(output),
  {
    recursive: true
  }
);

const temporary =
  output + ".tmp-" + process.pid;

await writeFile(
  temporary,
  content,
  {
    encoding: "utf8",
    mode: 0o600
  }
);

await rename(
  temporary,
  output
);

console.log(
  "Runtime-Konfiguration erzeugt: " +
  output
);

console.log(
  "Umgebung: " +
  environment
);

console.log(
  "Rechtliche Links konfiguriert: " +
  (
    imprintUrl && privacyUrl
      ? "JA"
      : "NEIN"
  )
);

console.log(
  "Der öffentliche Browser-Schlüssel wurde nicht ausgegeben."
);

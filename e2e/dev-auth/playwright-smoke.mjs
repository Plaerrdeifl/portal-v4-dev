import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  CHROMIUM_PROFILE_PATH,
  DEV_FANBUS_URL,
  DEV_ORIGIN,
  DEV_PROJECT_REF,
  DEV_SUPABASE_ORIGIN,
  E2E_USER_ID,
} from "./constants.mjs";
import { assertMagicLink } from "./guards.mjs";
import { requestMagicLink } from "./ipc-client.mjs";

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const moduleName = process.env.PD_E2E_PLAYWRIGHT_MODULE || "playwright";
  if (moduleName !== "playwright" && !moduleName.startsWith("/")) {
    throw new Error("PLAYWRIGHT_MODULE_INVALID");
  }
  const loaded = require(moduleName);
  if (!loaded?.chromium) throw new Error("PLAYWRIGHT_CHROMIUM_UNAVAILABLE");
  return loaded;
}

async function storedUserId(page) {
  return page.evaluate((projectRef) => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`sb-${projectRef}-auth-token`)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        const id = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
        if (typeof id === "string") return id;
      } catch {
        // Only the user id is allowed to leave the browser context.
      }
    }
    return null;
  }, DEV_PROJECT_REF);
}

async function verifyAuthenticatedFanbus(page) {
  await page.waitForURL(
    (url) => url.origin === DEV_ORIGIN && ["/fanbus", "/fanbus/"].includes(url.pathname),
    { timeout: 30_000 },
  );
  await page.getByRole("heading", { name: "Fanbus", exact: true }).waitFor();
  await page.locator(".fanbus-overview").waitFor({ state: "visible", timeout: 30_000 });
  if (await page.getByText("Anmeldung erforderlich", { exact: true }).isVisible()) {
    throw new Error("AUTHENTICATED_FANBUS_NOT_VISIBLE");
  }
  if ((await storedUserId(page)) !== E2E_USER_ID) {
    throw new Error("AUTHENTICATED_USER_MISMATCH");
  }
}

export function extractTokenHash(actionLink) {
  const link = new URL(assertMagicLink(actionLink));
  const tokenHash = link.searchParams.get("token_hash") || link.searchParams.get("token");
  if (!tokenHash) throw new Error("MAGIC_LINK_TOKEN_HASH_MISSING");
  return tokenHash;
}

export async function bootstrapBrowserSession(page, tokenHash) {
  await page.goto(`${DEV_ORIGIN}/`, { waitUntil: "load", timeout: 30_000 });
  const userId = await page.evaluate(
    async ({ expectedEnvironment, expectedProjectRef, expectedSupabaseOrigin, tokenHash }) => {
      const runtime = window.PD_RUNTIME_CONFIG;
      if (!runtime || typeof runtime !== "object") {
        throw new Error("RUNTIME_CONFIG_MISSING");
      }

      const environment = String(runtime.environment || "").trim().toUpperCase();
      const supabaseUrl = String(runtime.supabaseUrl || "").trim();
      let projectRef;
      try {
        projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      } catch {
        throw new Error("RUNTIME_SUPABASE_URL_INVALID");
      }
      if (
        environment !== expectedEnvironment ||
        supabaseUrl !== expectedSupabaseOrigin ||
        projectRef !== expectedProjectRef
      ) {
        throw new Error("RUNTIME_DEV_IDENTITY_MISMATCH");
      }

      const publicKey = String(
        runtime.supabasePublishableKey || runtime.supabaseAnonKey || "",
      ).trim();
      if (!publicKey || typeof window.supabase?.createClient !== "function") {
        throw new Error("BROWSER_SUPABASE_UNAVAILABLE");
      }

      const client = window.supabase.createClient(supabaseUrl, publicKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });
      if (error) throw new Error("BROWSER_VERIFY_OTP_FAILED");
      return data?.session?.user?.id ?? null;
    },
    {
      expectedEnvironment: "DEV",
      expectedProjectRef: DEV_PROJECT_REF,
      expectedSupabaseOrigin: DEV_SUPABASE_ORIGIN,
      tokenHash,
    },
  );
  if (userId !== E2E_USER_ID) throw new Error("BOOTSTRAP_USER_MISMATCH");
  return userId;
}

export function isReadOnlyRpc(request) {
  const url = new URL(request.url());
  if (url.origin !== DEV_SUPABASE_ORIGIN || !url.pathname.startsWith("/rest/v1/")) {
    return true;
  }
  if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return true;
  if (request.method() !== "POST") return false;
  if (url.pathname === "/rest/v1/rpc/pd_public_platform_status") {
    return request.postData() === "{}";
  }
  if (url.pathname !== "/rest/v1/rpc/pd_api") return false;
  try {
    const body = request.postDataJSON();
    return (
      ["bootstrap", "fanbus_trips_list"].includes(body?.p_action) &&
      body?.p_payload &&
      typeof body.p_payload === "object" &&
      !Array.isArray(body.p_payload) &&
      Object.keys(body.p_payload).length === 0
    );
  } catch {
    return false;
  }
}

async function enforceReadOnlyFanbus(context) {
  const violations = [];
  await context.route(`${DEV_SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    if (isReadOnlyRpc(route.request())) {
      await route.continue();
      return;
    }
    violations.push("blocked-non-read-request");
    await route.abort("blockedbyclient");
  });
  return () => {
    if (violations.length) throw new Error("NON_READ_REQUEST_BLOCKED");
  };
}

async function launch(chromium, profilePath) {
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    acceptDownloads: false,
    serviceWorkers: "allow",
  });
  const assertReadOnly = await enforceReadOnlyFanbus(context);
  return { context, assertReadOnly };
}

export async function runSmoke({
  playwright = loadPlaywright(),
  requestLink = requestMagicLink,
  profilePath = CHROMIUM_PROFILE_PATH,
} = {}) {
  const profile = await stat(profilePath);
  if (!profile.isDirectory()) throw new Error("CHROMIUM_PROFILE_MISSING");

  const tokenHash = extractTokenHash(await requestLink());
  let launched = await launch(playwright.chromium, profilePath);
  try {
    const { context } = launched;
    const page = context.pages()[0] ?? (await context.newPage());
    await bootstrapBrowserSession(page, tokenHash);
    await page.goto(DEV_FANBUS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await verifyAuthenticatedFanbus(page);
    launched.assertReadOnly();
  } finally {
    await launched.context.close();
  }

  launched = await launch(playwright.chromium, profilePath);
  try {
    const { context } = launched;
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(DEV_FANBUS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await verifyAuthenticatedFanbus(page);
    launched.assertReadOnly();
  } finally {
    await launched.context.close();
  }
  return { ok: true, sessionPersisted: true, userId: E2E_USER_ID };
}

async function main() {
  try {
    const result = await runSmoke();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write("PD E2E Fanbus smoke failed; sensitive details suppressed.\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}

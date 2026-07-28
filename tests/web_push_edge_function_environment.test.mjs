import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const functionSource = readFileSync(
  join(
    root,
    "supabase",
    "functions",
    "send-web-push",
    "index.ts",
  ),
  "utf8",
);

const configSource = readFileSync(
  join(root, "supabase", "config.toml"),
  "utf8",
);

test("web push requires an explicit VAPID subject", () => {
  assert.match(
    functionSource,
    /const subject = env\("VAPID_SUBJECT"\);/,
  );

  assert.doesNotMatch(
    functionSource,
    /https:\/\/plaerrdeifl\.github\.io/i,
  );

  assert.doesNotMatch(
    functionSource,
    /Deno\.env\.get\("VAPID_SUBJECT"\)\s*\|\|/,
  );
});

test("web push uses the project-provided secret key", () => {
  assert.match(
    functionSource,
    /Deno\.env\.get\("SUPABASE_SECRET_KEYS"\)/,
  );

  assert.match(
    functionSource,
    /apikey:\s*key/,
  );

  assert.doesNotMatch(
    functionSource,
    /Authorization\s*:/,
  );
});

test("web push authenticates through its dispatch secret", () => {
  assert.match(
    functionSource,
    /x-push-dispatch-secret/,
  );

  assert.match(
    functionSource,
    /pd_push_validate_dispatch_secret/,
  );

  assert.match(
    configSource,
    /\[functions\.send-web-push\][\s\S]*verify_jwt\s*=\s*false/,
  );
});
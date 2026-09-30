import test from "node:test";
import assert from "node:assert/strict";

import {
  DEV_CANONICAL_ORIGIN,
  resolveAllowedOrigins
} from "../supabase/functions/m210-ics-import/origin-policy.js";

test("M210 uses the canonical DEV origin instead of the stale configured Pages origin", () => {
  const origins = resolveAllowedOrigins(
    "https://tpieykhhawszlzsoflnl.supabase.co",
    "https://portal-v4-dev.pages.dev"
  );

  assert.deepEqual([...origins], [DEV_CANONICAL_ORIGIN]);
  assert.equal(origins.has("https://dev.plaerrdeifl.de"), true);
  assert.equal(origins.has("https://portal-v4-dev.pages.dev"), false);
});

test("M210 keeps explicit origin configuration for non-DEV runtimes", () => {
  const origins = resolveAllowedOrigins(
    "https://example.supabase.co",
    "https://plaerrdeifl.de,https://portal.plaerrdeifl.de"
  );

  assert.deepEqual([...origins], [
    "https://plaerrdeifl.de",
    "https://portal.plaerrdeifl.de"
  ]);
});

test("M210 rejects malformed fallback origin configuration", () => {
  assert.equal(
    resolveAllowedOrigins("https://example.supabase.co", "not-an-origin"),
    null
  );
  assert.equal(
    resolveAllowedOrigins("http://127.0.0.1:54321", ""),
    null
  );
});

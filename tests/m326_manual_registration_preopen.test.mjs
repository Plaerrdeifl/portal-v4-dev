import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/dev-overlays/20260828_m326_manual_registration_before_public_open.sql",
  import.meta.url
);

async function migrationSource() {
  return readFile(migrationUrl, "utf8");
}

test("manual fanbus registrations may use DRAFT or PUBLISHED trips", async () => {
  const source = await migrationSource();

  assert.match(
    source,
    /v_source = 'MANUAL' and v_trip\.status not in \('DRAFT', 'PUBLISHED'\)/
  );
  assert.match(
    source,
    /v_source <> 'MANUAL' and v_trip\.status <> 'PUBLISHED'/
  );
});

test("only MANUAL registration bypasses the public opening timestamp", async () => {
  const source = await migrationSource();

  assert.match(
    source,
    /v_source <> 'MANUAL' and v_now < v_trip\.registration_opens_at then\s+v_outcome := 'NOT_STARTED'/
  );
  assert.doesNotMatch(
    source,
    /v_source = 'MANUAL' and v_now >= v_trip\.registration_closes_at/
  );
});

test("the patch preserves the M330 cancellation wrapper and existing close checks", async () => {
  const source = await migrationSource();

  assert.match(source, /fanbus_submit_booking_core_before_m330_r1/);
  assert.match(source, /status not in \('DRAFT', 'PUBLISHED'\)/);
  assert.doesNotMatch(source, /create or replace function app_private\.fanbus_submit_booking_core\(/i);
  assert.match(source, /M326_MANUAL_PREOPEN_STATUS_PATCH_TARGET_MISSING/);
  assert.match(source, /M326_MANUAL_PREOPEN_WINDOW_PATCH_TARGET_MISSING/);
});

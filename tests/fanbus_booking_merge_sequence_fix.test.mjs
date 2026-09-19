import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260919232755_fix_fanbus_booking_merge_sequence_collision.sql", import.meta.url),
  "utf8"
);

test("booking merge uses collision-free temporary participant sequences", () => {
  assert.match(migration, /v_temp_base integer/);
  assert.match(migration, /row_number\(\) over/);
  assert.match(migration, /participant_sequence=v_temp_base\+ranked\.temporary_rank/);
  assert.match(migration, /set booking_id=v_target\.id/);
  assert.match(migration, /participant_sequence=ranked\.final_sequence/);
  assert.doesNotMatch(migration, /participant_sequence=participant_sequence\+1000000/);
});

test("booking merge still preserves primary role and audit contract", () => {
  assert.match(migration, /booking_role=case/);
  assert.match(migration, /FANBUS_BOOKINGS_MERGED/);
  assert.match(migration, /'scope','BOOKING_MERGE'/);
});

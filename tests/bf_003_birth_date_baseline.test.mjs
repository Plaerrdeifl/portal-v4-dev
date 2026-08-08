import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("BF-003 repairs only the existing birth_date baseline", async () => {
  const [repair, existingState, sqlTest] = await Promise.all([
    read(
      "supabase/migrations/20260808140000_repair_birth_date_baseline_bf_003.sql"
    ),
    read(
      "supabase/migrations/20260724133000_add_role_aware_dashboard_r1.sql"
    ),
    read("supabase/tests/bf_003_birth_date.sql")
  ]);

  assert.match(repair, /add column if not exists birth_date date/);
  assert.match(repair, /alter column birth_date drop default/);
  assert.match(repair, /alter column birth_date drop not null/);
  assert.match(repair, /members_birth_date_reasonable_check/);
  assert.match(repair, /birth_date >= date '1900-01-01'/);
  assert.doesNotMatch(repair, /create or replace function/i);
  assert.doesNotMatch(repair, /\b(?:grant|revoke)\b/i);
  assert.doesNotMatch(repair, /public\.pd_api|app_modules\.events/i);

  assert.match(existingState, /'birthDate', member\.birth_date/);
  assert.match(
    existingState,
    /nullif\(p_payload ->> 'birthDate', ''\)::date/
  );
  assert.match(existingState, /birth_date = v_birth_date/);
  assert.match(existingState, /'changedFields',[\s\S]*?'birthDate'/);
  assert.match(
    existingState,
    /revoke all on function\s+app_private\.api_member_detail\(jsonb\)/
  );
  assert.match(
    existingState,
    /revoke all on function\s+app_private\.api_save_member\(jsonb\)/
  );

  assert.match(sqlTest, /attribute\.atttypid = 'date'::regtype/);
  assert.match(sqlTest, /date '1899-12-31'/);
  assert.match(sqlTest, /'member_detail'/);
  assert.match(sqlTest, /'save_member'/);
  assert.match(sqlTest, /Unberechtigter Aufrufer/);
  assert.match(sqlTest, /has_function_privilege/);
});

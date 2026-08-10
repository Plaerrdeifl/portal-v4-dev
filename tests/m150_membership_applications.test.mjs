import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const modelPath = "supabase/migrations/20260808150000_add_membership_application_model_r1.sql";
const apiPath = "supabase/migrations/20260808151000_add_membership_application_internal_api_r1.sql";
const conversionModelPath = "supabase/migrations/20260809001000_add_membership_application_conversion_r1.sql";
const conversionApiPath = "supabase/migrations/20260809002000_add_membership_application_conversion_api_r1.sql";

test("M150 F1.2A model is isolated, constrained, immutable and default-deny", async () => {
  const model = await read(modelPath);

  assert.match(model, /create table app_fanclub\.membership_applications/i);
  assert.match(model, /create table app_fanclub\.membership_application_board_roster/i);
  assert.match(model, /create table app_fanclub\.membership_application_votes/i);
  for (const status of ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]) {
    assert.match(model, new RegExp(`'${status}'`));
  }
  assert.match(model, /primary key \(application_id, voter_user_id\)/i);
  assert.match(model, /vote in \('YES', 'NO'\)/i);
  assert.match(model, /M150_SUBMITTED_AT_IMMUTABLE/);
  assert.match(model, /M150_VOTE_IMMUTABLE/);
  assert.match(model, /M150_BOARD_SNAPSHOT_IMMUTABLE/);
  assert.match(model, /M150_VOTE_REQUIRES_PENDING_APPLICATION/);
  assert.match(model, /enable row level security/gi);
  assert.match(model, /revoke all on table app_fanclub\.membership_applications[\s\S]+from public, anon, authenticated/i);
  assert.match(model, /revoke all on table app_fanclub\.membership_application_votes[\s\S]+from public, anon, authenticated/i);
  assert.match(model, /revoke all on table app_fanclub\.membership_application_board_roster[\s\S]+from public, anon, authenticated/i);
  assert.doesNotMatch(model, /\b(sepa|iban|bic)\b/i);
});

test("M150 F1.2A uses the dynamic five-office board and no privilege fallback", async () => {
  const model = await read(modelPath);
  const api = await read(apiPath);

  for (const office of ["VORSTAND_1", "VORSTAND_2", "VORSTAND_3", "KASSIER", "SCHRIFTFUEHRER"]) {
    assert.match(api, new RegExp(`'${office}'`));
  }
  assert.match(api, /office_slots[\s\S]+members[\s\S]+user_member_links[\s\S]+users/i);
  assert.match(api, /member\.status = 'ACTIVE'/);
  assert.match(api, /portal_user\.status = 'ACTIVE'/);
  assert.match(api, /count\(distinct board\.user_id\)[\s\S]+<> 5/i);
  assert.match(api, /M150_BOARD_INCOMPLETE/);
  assert.match(api, /M150_BOARD_SNAPSHOT_INCOMPLETE/);
  assert.match(api, /M150_BOARD_ROSTER_CHANGED/);
  assert.match(model, /primary key \(application_id, office_code\)/i);
  assert.match(model, /unique \(application_id, voter_user_id\)/i);
  assert.match(api, /create trigger membership_applications_capture_board_roster[\s\S]+after insert/i);
  assert.match(api, /insert into app_fanclub\.membership_application_board_roster[\s\S]+from app_private\.m150_current_board\(\)/i);
  assert.match(api, /membership_application_board_roster[\s\S]+except[\s\S]+m150_current_board\(\)/i);
  assert.match(api, /m150_current_board\(\)[\s\S]+except[\s\S]+membership_application_board_roster/i);
  assert.match(api, /m150_lock_board_roster\(\)[\s\S]+for share of office/i);
  assert.equal(
    (api.match(/perform app_private\.m150_lock_board_roster\(\)/g) ?? []).length,
    3
  );
  assert.equal(
    (api.match(/perform app_private\.m150_assert_board_ready\(v_id\)/g) ?? []).length,
    2
  );
  assert.doesNotMatch(api, /update\s+app_fanclub\.membership_application_board_roster/i);
  assert.doesNotMatch(api, /portal\.admin|members\.manage/i);
});

test("M150 F1.2A implements majority, reason and Berlin calendar-day rules", async () => {
  const api = await read(apiPath);

  assert.match(api, /v_yes >= 3/);
  assert.match(api, /v_no >= 3/);
  assert.match(api, /v_vote = 'NO' and v_no = 2 and v_reason is null/i);
  assert.match(api, /M150_DECISIVE_NO_REASON_REQUIRED/);
  assert.match(api, /for update/i);
  assert.match(api, /M150_REVISION_CONFLICT/);
  assert.match(api, /M150_VOTE_ALREADY_EXISTS/);
  assert.match(api, /at time zone 'Europe\/Berlin'\)::date \+ 7/i);
  assert.doesNotMatch(api, /interval\s+'168 hours'/i);
  assert.match(api, /M150_MANUAL_DECISION_REASON_REQUIRED/);
  assert.match(api, /M150_MAJORITY_MUST_NOT_BE_OVERWRITTEN/);
  assert.match(api, /decision_method = 'SEVEN_DAY_MANUAL'/i);
});

test("M150 F1.2A decision-state constraint distinguishes majority and manual approval", async () => {
  const model = await read(modelPath);

  assert.match(
    model,
    /status = 'APPROVED'[\s\S]+decision_method = 'VOTE_MAJORITY'/i
  );
  assert.match(
    model,
    /status = 'APPROVED'[\s\S]+decision_method = 'SEVEN_DAY_MANUAL'[\s\S]+decision_reason_internal is not null/i
  );
  assert.match(
    model,
    /status = 'REJECTED'[\s\S]+decision_method in \('VOTE_MAJORITY', 'SEVEN_DAY_MANUAL'\)[\s\S]+decision_reason_internal is not null/i
  );
});

test("M150 F1.2A exposes only the four authenticated dispatcher actions", async () => {
  const api = await read(apiPath);

  for (const action of [
    "membership_applications_list",
    "membership_application_detail",
    "membership_application_vote",
    "membership_application_manual_decide"
  ]) {
    assert.match(api, new RegExp(`when '${action}'`));
  }
  assert.match(api, /rename to pd_api_before_membership_applications_r1/i);
  assert.match(api, /revoke all on function public\.pd_api_before_membership_applications_r1\(text, jsonb\)[\s\S]+from public, anon, authenticated/i);
  assert.match(api, /revoke all on function public\.pd_api\(text, jsonb\)[\s\S]+from public, anon, authenticated/i);
  assert.match(api, /grant execute on function public\.pd_api\(text, jsonb\)[\s\S]+to authenticated/i);
  assert.doesNotMatch(api, /grant execute[\s\S]+to anon/i);
  assert.equal((api.match(/create or replace function public\./gi) ?? []).length, 1);
  assert.doesNotMatch(api, /service_role/i);
});

test("M150 F1.2A provides conservative hints and data-minimal audit without adjacent writes", async () => {
  const model = await read(modelPath);
  const api = await read(apiPath);
  const combined = `${model}\n${api}`;

  assert.match(api, /membersByEmail/);
  assert.match(api, /membersByIdentity/);
  assert.match(api, /membersByPhone/);
  assert.match(api, /portalUsersByEmail/);
  assert.match(api, /pendingApplications/);
  assert.match(api, /MEMBERSHIP_APPLICATION_VOTE_CAST/);
  assert.match(api, /MEMBERSHIP_APPLICATION_AUTO_APPROVED/);
  assert.match(api, /MEMBERSHIP_APPLICATION_AUTO_REJECTED/);
  assert.match(api, /MEMBERSHIP_APPLICATION_SEVEN_DAY_DECIDED/);
  assert.match(api, /'sevenDayDecision', true/);
  assert.doesNotMatch(combined, /(?:insert into|update|delete from)\s+app_fanclub\.members\b/i);
  assert.doesNotMatch(combined, /(?:insert into|update|delete from)\s+app_portal\.access_requests\b/i);
  assert.doesNotMatch(combined, /(?:insert into|update|delete from)\s+app_fanclub\.(?:finance_|contribution_)/i);
  assert.doesNotMatch(combined, /applicant_message[\s\S]{0,160}members\.notes/i);
});

test("M150 F1.2A documentation and SQL verification are present", async () => {
  const docs = await read("docs/M150_R1_F1_2A_MEMBERSHIP_APPLICATION_WORKFLOW.md");
  const sqlTest = await read("supabase/tests/m150_membership_applications.sql");
  assert.match(docs, /F1\.2A/);
  assert.match(docs, /Europe\/Berlin/);
  assert.match(sqlTest, /M150_BOARD_INCOMPLETE/);
  assert.match(sqlTest, /M150_BOARD_SNAPSHOT_INCOMPLETE/);
  assert.match(sqlTest, /M150_BOARD_ROSTER_CHANGED/);
  assert.match(sqlTest, /Admin ohne Amt durfte voten oder erzeugte eine Mutation/);
  assert.match(sqlTest, /APPROVED \+ SEVEN_DAY_MANUAL ohne internen Grund/);
  assert.match(sqlTest, /APPROVED \+ VOTE_MAJORITY ohne Grund/);
  assert.match(sqlTest, /PORTAL_CORE_STRUCTURE_OK/);
});

test("M150 F1.2B conversion metadata is atomic, constrained and immutable", async () => {
  const model = await read(conversionModelPath);

  for (const column of [
    "converted_at",
    "converted_by",
    "converted_member_id",
    "conversion_mode"
  ]) {
    assert.match(model, new RegExp(`add column ${column}`));
  }
  for (const mode of [
    "NEW_MEMBER",
    "REACTIVATE_EXISTING",
    "RESOLVE_EXISTING_ACTIVE"
  ]) {
    assert.match(model, new RegExp(`'${mode}'`));
  }
  assert.match(model, /membership_applications_conversion_state_check/);
  assert.match(model, /converted_at is null[\s\S]+converted_by is null[\s\S]+converted_member_id is null[\s\S]+conversion_mode is null/i);
  assert.match(model, /converted_at is not null[\s\S]+converted_by is not null[\s\S]+converted_member_id is not null[\s\S]+conversion_mode is not null/i);
  assert.match(model, /status = 'APPROVED'[\s\S]+converted_at is not null[\s\S]+converted_by is not null[\s\S]+converted_member_id is not null[\s\S]+conversion_mode is not null/i);
  assert.match(model, /M150_CONVERSION_IMMUTABLE/);
  assert.match(model, /before update on app_fanclub\.membership_applications/i);
  assert.match(model, /references app_portal\.users\(id\) on delete restrict/i);
  assert.match(model, /references app_fanclub\.members\(id\) on delete restrict/i);
});

test("M150 F1.2B implements the three explicit, revision-safe conversion modes", async () => {
  const coreModel = await read(
    "supabase/migrations/20260719230000_create_portal_core_tables.sql"
  );
  const api = await read(conversionApiPath);

  assert.match(coreModel, /member_code text not null unique default app_private\.next_member_code\(\)/i);
  assert.match(api, /create or replace function app_private\.api_membership_application_convert\(p_payload jsonb\)/i);
  assert.match(api, /m150_require_current_board_member\(\)/);
  assert.doesNotMatch(api, /require_capability|portal\.admin|members\.manage/i);
  assert.match(api, /M150_REVISION_CONFLICT/);
  assert.match(api, /status <> 'APPROVED'/);
  assert.match(api, /M150_APPLICATION_ALREADY_CONVERTED/);
  assert.match(api, /from app_fanclub\.membership_applications[\s\S]+for update/i);
  assert.match(api, /from app_fanclub\.members[\s\S]+for update/i);

  const memberInsert = api.match(
    /insert into app_fanclub\.members\s*\(([\s\S]*?)\)\s*values/i
  );
  assert.ok(memberInsert);
  assert.doesNotMatch(memberInsert[1], /member_code/i);
  assert.match(memberInsert[1], /birth_date/);
  assert.match(api, /submitted_at at time zone 'Europe\/Berlin'\)::date/gi);
  assert.match(api, /M150_NEW_MEMBER_TARGET_FORBIDDEN/);
  assert.match(api, /p_payload \? 'targetMemberId'/);
  assert.match(api, /M150_TARGET_MEMBER_REQUIRED/);
  assert.match(api, /M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER/);
  assert.match(api, /app_fanclub\.office_slots[\s\S]+office\.member_id = v_member_id/i);
  assert.match(api, /M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW/);
  assert.match(api, /app_fanclub\.office_slots[\s\S]+M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW[\s\S]+update app_fanclub\.members/i);
  assert.match(api, /M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER/);
  assert.match(api, /when 'membership_application_convert'/);
});

test("M150 F1.2B keeps existing member data, portal access and finance isolated", async () => {
  const api = await read(conversionApiPath);
  const reactivation = api.slice(
    api.indexOf("if v_mode = 'REACTIVATE_EXISTING'"),
    api.indexOf("update app_fanclub.membership_applications")
  );

  assert.match(reactivation, /set status = 'ACTIVE'/);
  assert.match(reactivation, /left_on = null/);
  assert.match(reactivation, /joined_on = \(v_application\.submitted_at at time zone 'Europe\/Berlin'\)::date/);
  for (const field of [
    "member_code",
    "first_name",
    "last_name",
    "birth_date",
    "email",
    "phone",
    "street",
    "house_number",
    "postal_code",
    "city",
    "notes"
  ]) {
    assert.doesNotMatch(reactivation, new RegExp(`set[\\s\\S]*${field}\\s*=`));
  }
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_portal\.(?:access_requests|users|user_member_links)\b/i);
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_fanclub\.(?:office_slots|finance_|contribution_)/i);
  assert.doesNotMatch(api, /(?:update|delete from)\s+app_fanclub\.office_slots\b/i);
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_fanclub\.membership_application_votes\b/i);
  assert.doesNotMatch(api, /applicant_message[\s\S]{0,160}notes/i);
});

test("M150 F1.2B exposes conversion details and data-minimal audit through pd_api only", async () => {
  const api = await read(conversionApiPath);
  const docs = await read("docs/M150_R1_F1_2B_MEMBERSHIP_CONVERSION.md");
  const sqlTest = await read("supabase/tests/m150_membership_applications.sql");

  for (const field of [
    "convertedAt",
    "convertedBy",
    "convertedMemberId",
    "conversionMode"
  ]) {
    assert.match(api, new RegExp(`'${field}'`));
  }
  assert.match(api, /MEMBERSHIP_APPLICATION_CONVERTED/);
  assert.match(api, /'previousStatus'/);
  assert.match(api, /'previousJoinedOn'/);
  assert.match(api, /'previousLeftOn'/);
  assert.match(api, /'newMemberCreated'/);
  assert.match(api, /'memberMutationPerformed'/);
  assert.match(api, /rename to pd_api_before_membership_application_conversion_r1/i);
  assert.match(api, /revoke all on function app_private\.api_membership_application_convert\(jsonb\)[\s\S]+from public, anon, authenticated/i);
  assert.match(api, /revoke all on function public\.pd_api\(text, jsonb\)[\s\S]+from public, anon, authenticated/i);
  assert.match(api, /grant execute on function public\.pd_api\(text, jsonb\)[\s\S]+to authenticated/i);
  assert.doesNotMatch(api, /grant execute[\s\S]+to anon/i);
  assert.match(docs, /D-017/);
  assert.match(docs, /Europe\/Berlin/);
  assert.match(sqlTest, /Admin ohne Amt durfte konvertieren oder erzeugte eine Mutation/);
  assert.match(sqlTest, /Zweite NEW_MEMBER Conversion war nicht idempotent/);
  assert.match(sqlTest, /M210-Regression nach F1\.2B/);
});

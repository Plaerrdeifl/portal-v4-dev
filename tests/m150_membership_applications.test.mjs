import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const modelPath = "supabase/migrations/20260808150000_add_membership_application_model_r1.sql";
const apiPath = "supabase/migrations/20260808151000_add_membership_application_internal_api_r1.sql";

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

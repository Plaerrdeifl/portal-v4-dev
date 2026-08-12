import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260809143000_add_m150_membership_communication_core_r1.sql";
const sqlTestPath = "supabase/tests/m150_membership_communication.sql";

const [migration, sqlTest, moduleSource, wordpressPlugin, documentation] = await Promise.all([
  read(migrationPath),
  read(sqlTestPath),
  read("js/modules/membership-applications.js"),
  read("wordpress/plugins/plaerrdeifl-m150-membership/plaerrdeifl-m150-membership.php"),
  read("docs/M150_R1_F1_6A_COMMUNICATION_CORE.md")
]);

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

const outboxTable = sourceBlock(
  migration,
  "create table app_private.membership_application_email_outbox",
  "create index membership_application_email_outbox_pending_idx"
);
const claimFunction = sourceBlock(
  migration,
  "create function app_private.m150_membership_email_claim()",
  "create function public.m150_membership_email_claim()"
);
const completeFunction = sourceBlock(
  migration,
  "create function app_private.m150_membership_email_complete(",
  "create function public.m150_membership_email_complete("
);
const voteFunction = sourceBlock(
  migration,
  "create or replace function app_private.api_membership_application_vote",
  "create or replace function app_private.api_membership_application_manual_decide"
);
const manualFunction = sourceBlock(
  migration,
  "create or replace function app_private.api_membership_application_manual_decide",
  "create table app_private.membership_application_email_outbox"
);

test("F1.6A migration and SQL verification exist at the exact paths", () => {
  assert.match(migration, /20260809143000|membership_application_email_outbox/);
  assert.match(sqlTest, /M150 F1\.6A communication contract/);
  assert.match(documentation, /M150 R1 \/ F1\.6A/);
});

test("applicant notice is rejection-specific, plain text, and limited to 2000", () => {
  assert.match(migration, /add column rejection_applicant_notice text/);
  assert.match(migration, /length\(rejection_applicant_notice\) between 1 and 2000/);
  assert.match(migration, /position\('<' in rejection_applicant_notice\) = 0/);
  assert.match(migration, /position\('>' in rejection_applicant_notice\) = 0/);
  assert.match(migration, /M150_REJECTION_APPLICANT_NOTICE_IMMUTABLE/);
  assert.match(voteFunction, /if v_vote = 'NO'[\s\S]*m150_rejection_applicant_notice/);
  assert.match(voteFunction, /v_new_status = 'REJECTED'[\s\S]*then v_notice else null/);
  assert.match(manualFunction, /if v_decision = 'REJECTED'[\s\S]*m150_rejection_applicant_notice/);
  assert.match(manualFunction, /v_decision = 'REJECTED'[\s\S]*then v_notice else null/);
  assert.doesNotMatch(migration, /rejection_applicant_notice\s*=\s*(?:v_reason|decision_reason_internal)/);
  assert.doesNotMatch(migration, /decision_reason_internal\s*=\s*(?:v_notice|rejection_applicant_notice)/);
});

test("outbox has exactly the three event types and four states", () => {
  const emailTypes = sourceBlock(
    outboxTable,
    "membership_application_email_outbox_type_check",
    "membership_application_email_outbox_status_check"
  );
  const states = sourceBlock(
    outboxTable,
    "membership_application_email_outbox_status_check",
    "membership_application_email_outbox_attempts_check"
  );
  assert.deepEqual([...emailTypes.matchAll(/'([A-Z]+)'/g)].map(match => match[1]), [
    "RECEIPT",
    "REJECTION",
    "ADMISSION"
  ]);
  assert.deepEqual([...states.matchAll(/'([A-Z]+)'/g)].map(match => match[1]), [
    "PENDING",
    "SENDING",
    "SENT",
    "FAILED"
  ]);
  assert.match(outboxTable, /unique \(application_id, email_type\)/);
});

test("outbox stores only technical delivery metadata and has RLS", () => {
  for (const column of [
    "id",
    "application_id",
    "email_type",
    "status",
    "attempts",
    "available_at",
    "claim_token",
    "claimed_at",
    "claim_expires_at",
    "sent_at",
    "last_error_code",
    "created_at",
    "updated_at"
  ]) {
    assert.match(outboxTable, new RegExp(`\\b${column}\\b`));
  }
  assert.doesNotMatch(
    outboxTable,
    /recipient_email|first_name|last_name|birth_date|phone|street|house_number|postal_code|city|applicant_message|decision_reason_internal|applicant_notice/i
  );
  assert.match(migration, /alter table app_private\.membership_application_email_outbox[\s\S]*enable row level security/);
  assert.match(
    migration,
    /revoke all on table app_private\.membership_application_email_outbox[\s\S]*from public, anon, authenticated, service_role/
  );
});

test("authoritative triggers enqueue receipt, rejection, and converted admission", () => {
  assert.match(migration, /after insert on app_fanclub\.membership_applications[\s\S]*m150_enqueue_membership_receipt/);
  assert.match(migration, /old\.status is distinct from 'REJECTED' and new\.status = 'REJECTED'/);
  assert.match(migration, /old\.converted_at is null and new\.converted_at is not null/);
  assert.match(migration, /new\.conversion_mode not in \([\s\S]*'NEW_MEMBER'[\s\S]*'REACTIVATE_EXISTING'[\s\S]*'RESOLVE_EXISTING_ACTIVE'/);
  assert.match(migration, /on conflict \(application_id, email_type\) do nothing/);
  assert.doesNotMatch(migration, /new\.status = 'APPROVED'[\s\S]{0,160}m150_enqueue_membership_email\(new\.id, 'ADMISSION'/);
  assert.doesNotMatch(migration, /'WITHDRAWN'\s*\)[\s\S]{0,120}m150_enqueue_membership_email/);
});

test("claim is atomic, leased for ten minutes, and limited to five attempts", () => {
  assert.match(claimFunction, /for update skip locked/i);
  assert.match(claimFunction, /outbox\.attempts < 5/);
  assert.match(claimFunction, /status = 'SENDING'/);
  assert.match(claimFunction, /attempts = outbox\.attempts \+ 1/);
  assert.match(claimFunction, /claim_token = extensions\.gen_random_uuid\(\)/);
  assert.match(claimFunction, /claim_expires_at = now\(\) \+ interval '10 minutes'/);
  assert.match(claimFunction, /outbox\.claim_expires_at < now\(\)/);
  assert.match(claimFunction, /outbox\.attempts >= 5/);
});

test("claim response exposes only required delivery data", () => {
  for (const key of [
    "claimed",
    "outboxId",
    "claimToken",
    "emailType",
    "recipientEmail",
    "firstName"
  ]) {
    assert.match(claimFunction, new RegExp(`'${key}'`));
  }
  assert.match(
    claimFunction,
    /when claimed\.email_type = 'REJECTION' then jsonb_build_object\([\s\S]*'applicantNotice', application\.rejection_applicant_notice/
  );
  assert.doesNotMatch(
    claimFunction,
    /decision_reason_internal|reason_internal|birth_date|phone|street|house_number|postal_code|city|applicant_message|votes|board_roster/i
  );
});

test("claim and complete wrappers are service-role-only", () => {
  assert.match(
    migration,
    /revoke all on function public\.m150_membership_email_claim\(\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.m150_membership_email_claim\(\)[\s\S]*to service_role/
  );
  assert.match(
    migration,
    /revoke all on function public\.m150_membership_email_complete\(uuid, uuid, boolean, text\)[\s\S]*from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.m150_membership_email_complete\(uuid, uuid, boolean, text\)[\s\S]*to service_role/
  );
  assert.doesNotMatch(migration, /grant execute[\s\S]{0,180}to (?:anon|authenticated)/i);
});

test("complete validates the current token and implements sent, retry, and failed", () => {
  assert.match(completeFunction, /for update/);
  assert.match(completeFunction, /v_outbox\.claim_token is distinct from p_claim_token/);
  assert.match(completeFunction, /v_outbox\.claim_expires_at < now\(\)/);
  assert.match(completeFunction, /set status = 'SENT'/);
  assert.match(completeFunction, /sent_at = now\(\)/);
  assert.match(completeFunction, /v_outbox\.attempts >= 5 then 'FAILED' else 'PENDING'/);
  assert.match(completeFunction, /now\(\) \+ interval '5 minutes'/);
  assert.match(completeFunction, /length\(v_error_code\) > 80/);
  assert.match(completeFunction, /v_error_code !~ '\^\[A-Z0-9_:-\]\+\$'/);
});

test("SQL contract covers runtime event and delivery boundaries", () => {
  for (const phrase of [
    "Idempotency-Retry",
    "Erste NO-Stimme",
    "Zweite NO-Stimme",
    "REJECTED-Transition",
    "Manuelle REJECTED-Transition",
    "NEW_MEMBER",
    "REACTIVATE_EXISTING",
    "RESOLVE_EXISTING_ACTIVE",
    "WITHDRAWN",
    "10-Minuten-Lease",
    "fünf Minuten",
    "falschen Claim-Token",
    "FAILED"
  ]) {
    assert.match(sqlTest, new RegExp(phrase, "i"));
  }
});

test("F1.6A contains no provider, browser mail, WordPress mail, M210, or M000 change", () => {
  const implementation = `${migration}\n${moduleSource}`;
  assert.doesNotMatch(
    implementation,
    /wp_mail|php\s+mail|smtp|sendgrid|mailgun|resend|brevo|pg_net|net\.http|functions\/v1.*mail/i
  );
  assert.doesNotMatch(moduleSource, /m150_membership_email_(?:claim|complete)|email_outbox/);
  assert.doesNotMatch(migration, /events_list|pd_public_events|M210|M000/);
  assert.doesNotMatch(wordpressPlugin, /wp_mail\s*\(/i);
});

test("documentation fixes provider idempotency and F1.6B boundaries", () => {
  for (const phrase of [
    "RECEIPT",
    "REJECTION",
    "ADMISSION",
    "FOR UPDATE SKIP LOCKED",
    "10 Minuten",
    "fünf Minuten",
    "maximal fünf",
    "service_role",
    "outboxId",
    "F1.6B",
    "keine E-Mail",
    "kein WordPress-Mail",
    "kein(?:en)? Portalzugang",
    "Finance",
    "SEPA"
  ]) {
    assert.match(documentation, new RegExp(phrase, "i"));
  }
});

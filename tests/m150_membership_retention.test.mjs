import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = "supabase/migrations/20260809190000_add_m150_membership_retention_r1.sql";
const sqlTestPath = "supabase/tests/m150_membership_retention.sql";
const documentationPath = "docs/M150_R1_F1_7A_RETENTION_MINIMIZATION.md";

const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");
const [migration, sqlTest, coreContract, documentation] = await Promise.all([
  read(migrationPath),
  read(sqlTestPath),
  read("tests/core_contract.test.mjs"),
  read(documentationPath)
]);

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

const minimizationTrigger = sourceBlock(
  migration,
  "create function app_private.m150_minimize_membership_application_message()",
  "update app_fanclub.membership_applications"
);
const backfill = sourceBlock(
  migration,
  "update app_fanclub.membership_applications",
  "create function app_private.m150_membership_retention_run()"
);
const retentionFunction = sourceBlock(
  migration,
  "create function app_private.m150_membership_retention_run()",
  "create function public.m150_membership_retention_run()"
);

test("F1.7A artifacts exist at the exact paths and core order is extended", () => {
  assert.match(migration, /m150_membership_retention_run/);
  assert.match(sqlTest, /M150 F1\.7A retention and minimization contract/);
  assert.match(documentation, /M150 R1 \/ F1\.7A/);
  assert.match(
    coreContract,
    /"20260809143000_add_m150_membership_communication_core_r1\.sql",\s+"20260809190000_add_m150_membership_retention_r1\.sql"/
  );
});

test("applicant message is minimized only on first successful conversion", () => {
  assert.match(minimizationTrigger, /before update of converted_at/);
  assert.match(minimizationTrigger, /old\.converted_at is null and new\.converted_at is not null/);
  assert.match(minimizationTrigger, /new\.applicant_message := null/);
  assert.equal((minimizationTrigger.match(/new\.applicant_message := null/g) || []).length, 1);
  assert.doesNotMatch(
    minimizationTrigger,
    /new\.(?:first_name|last_name|birth_date|email|phone|street|house_number|postal_code|city|submitted_at|declaration_version|statutes_version|statutes_reference|declaration_confirmed|statutes_confirmed|decision_method|decided_at|decided_by|decision_reason_internal|rejection_applicant_notice|applicant_notice)\s*:=/
  );
});

test("backfill changes only applicant message on already converted Applications", () => {
  assert.match(backfill, /set applicant_message = null/);
  assert.match(backfill, /where converted_at is not null/);
  assert.match(backfill, /and applicant_message is not null/);
  assert.doesNotMatch(backfill, /revision\s*=|updated_at\s*=|converted_(?:at|by|member_id)\s*=|conversion_mode\s*=/);
});

test("retention has exactly the three twelve-month anchors and excludes APPROVED", () => {
  assert.match(retentionFunction, /clock_timestamp\(\) - interval '12 months'/);
  assert.match(retentionFunction, /status = 'PENDING' and application\.submitted_at <= v_cutoff/);
  assert.match(retentionFunction, /status = 'REJECTED' and application\.decided_at <= v_cutoff/);
  assert.match(retentionFunction, /status = 'WITHDRAWN' and application\.updated_at <= v_cutoff/);
  assert.doesNotMatch(retentionFunction, /'APPROVED'/);
  assert.match(retentionFunction, /STALE_PENDING/);
  assert.match(retentionFunction, /REJECTED_12_MONTHS/);
  assert.match(retentionFunction, /WITHDRAWN_12_MONTHS/);
});

test("retention is deterministic, race-aware, skip-locked, and fixed to 100", () => {
  assert.match(retentionFunction, /status = 'SENDING'/);
  assert.ok((retentionFunction.match(/status = 'SENDING'/g) || []).length >= 2);
  assert.match(retentionFunction, /order by retention_anchor, application\.id/);
  assert.match(retentionFunction, /limit 100/);
  assert.match(retentionFunction, /for update of application skip locked/);
  assert.match(retentionFunction, /order by outbox\.id\s+for update/);
  assert.match(migration, /m150_membership_retention_run\(\)/);
  assert.doesNotMatch(migration, /m150_membership_retention_run\([^)]*[a-z_]+[^)]*\)/i);
});

test("RESTRICT children are removed in order before the Application", () => {
  const idempotencyDelete = retentionFunction.indexOf(
    "delete from app_private.membership_application_intake_idempotency"
  );
  const votesDelete = retentionFunction.indexOf(
    "delete from app_fanclub.membership_application_votes"
  );
  const applicationDelete = retentionFunction.indexOf(
    "delete from app_fanclub.membership_applications"
  );
  assert.ok(idempotencyDelete >= 0);
  assert.ok(idempotencyDelete < votesDelete);
  assert.ok(votesDelete < applicationDelete);
  assert.doesNotMatch(migration, /\b(?:drop|alter)\s+constraint\b|on delete cascade/i);
});

test("retention audit and return contain only minimal technical data", () => {
  const audit = sourceBlock(
    retentionFunction,
    "perform app_private.log_audit(",
    "delete from app_fanclub.membership_applications"
  );
  assert.match(audit, /MEMBERSHIP_APPLICATION_RETENTION_PURGED/);
  assert.match(audit, /'membership_application'/);
  assert.match(audit, /'status', v_application\.status/);
  assert.match(audit, /'retentionReason', v_application\.retention_reason/);
  assert.doesNotMatch(
    audit,
    /first_name|last_name|email|phone|street|birth_date|applicant_message|applicant_notice|decision_reason/i
  );
  assert.match(
    retentionFunction,
    /jsonb_build_object\(\s*'purged',[\s\S]*'pending',[\s\S]*'rejected',[\s\S]*'withdrawn'/
  );
});

test("public wrapper is parameterless, delegated, and service-role-only", () => {
  assert.match(
    migration,
    /create function public\.m150_membership_retention_run\(\)[\s\S]*select app_private\.m150_membership_retention_run\(\)/
  );
  assert.match(
    migration,
    /revoke all on function app_private\.m150_membership_retention_run\(\)\s+from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /revoke all on function public\.m150_membership_retention_run\(\)\s+from public, anon, authenticated, service_role/
  );
  assert.match(
    migration,
    /grant execute on function public\.m150_membership_retention_run\(\)\s+to service_role/
  );
});

test("SQL verification covers minimization, retention, cascades, audit, and boundaries", () => {
  for (const phrase of [
    "applicant_message is null",
    "submitted_at",
    "decided_at",
    "updated_at",
    "PENDING",
    "REJECTED",
    "WITHDRAWN",
    "APPROVED",
    "membership_application_votes",
    "membership_application_intake_idempotency",
    "membership_application_board_roster",
    "membership_application_email_outbox",
    "SENDING",
    "MEMBERSHIP_APPLICATION_RETENTION_PURGED",
    "service_role",
    "finance_accounts"
  ]) {
    assert.match(sqlTest, new RegExp(phrase, "i"));
  }
});

test("F1.7A adds no API action, cron, Edge Function, WordPress, Finance, M210, or M000", () => {
  assert.doesNotMatch(
    migration,
    /public\.pd_api|pg_cron|cron\.|functions\/v1|edge function|wordpress|wp_|finance_|contribution_|M210|M000/i
  );
});

test("documentation fixes operational and RC boundaries", () => {
  for (const phrase of [
    "applicant_message",
    "12 Monate",
    "submitted_at",
    "decided_at",
    "updated_at",
    "100",
    "FOR UPDATE SKIP LOCKED",
    "SENDING",
    "Idempotency",
    "Votes",
    "Board-Roster",
    "Outbox",
    "MEMBERSHIP_APPLICATION_RETENTION_PURGED",
    "service_role",
    "keine Browser-Schnittstelle",
    "Betriebsaktivierung",
    "kein WordPress",
    "Finance",
    "SEPA",
    "kein PROD",
    "WITHDRAWN-Workflow",
    "RC"
  ]) {
    assert.match(documentation, new RegExp(phrase, "i"));
  }
  assert.match(documentation, /kein(?:en)?\s+Cron/i);
  assert.match(documentation, /kein(?:en neuen)?\s+Portalzugang/i);
});

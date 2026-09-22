import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("contribution member list has a case-insensitive client-side search", async () => {
  const fanclub = await read("js/modules/fanclub.js");

  assert.match(fanclub, /id="contributionMemberSearchInput"[^>]+type="search"/);
  assert.match(fanclub, /placeholder="Mitglied suchen …"/);
  assert.match(fanclub, /memberName\(member\)\.toLocaleLowerCase\("de-DE"\)/);
  assert.match(fanclub, /data-contribution-member-search/);
  assert.match(fanclub, /Keine passenden Mitglieder gefunden\./);
});

test("pending contribution reports expose an explicit edit-before-confirm flow", async () => {
  const fanclub = await read("js/modules/fanclub.js");

  assert.match(fanclub, /function paymentReportEditForm\(report\)/);
  assert.match(fanclub, /data-dialog-edit-payment/);
  assert.match(fanclub, /call\("update_contribution_payment_report", values\)/);
  assert.match(fanclub, /bleibt zur Prüfung offen/);
  assert.match(fanclub, /erst durch die anschließende Bestätigung gebucht/);
});

test("report update RPC remains pending, authorized and revision-safe", async () => {
  const migration = await read(
    "supabase/migrations/20260922172732_edit_pending_contribution_payment_reports.sql"
  );

  assert.match(migration, /require_capability\('finance\.manage'\)/);
  assert.match(migration, /v_report\.status <> 'PENDING'/);
  assert.match(migration, /v_expected_revision <> v_report\.revision/);
  assert.match(migration, /using errcode = 'PT409'/);
  assert.match(migration, /payment_method = v_payment_method/);
  assert.match(migration, /paid_on = v_paid_on/);
  assert.match(migration, /revision = revision \+ 1/);
  assert.doesNotMatch(migration, /insert into app_fanclub\.finance_entries/i);
  assert.match(migration, /when 'update_contribution_payment_report' then 'USER_MUTATION'/);
  assert.match(migration, /api_update_contribution_payment_report/);
  assert.match(migration, /from public, anon, authenticated, service_role/);
});

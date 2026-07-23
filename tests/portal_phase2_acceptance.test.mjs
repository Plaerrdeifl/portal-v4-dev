import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const migrationPath =
  "supabase/migrations/20260722190000_finalize_portal_phase2_acceptance.sql";

test("resolved contribution payments preserve history without blocking cleanup", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /season_id_snapshot uuid/);
  assert.match(migration, /member_id_snapshot uuid/);
  assert.match(migration, /member_name_snapshot text not null/);
  assert.match(migration, /season_name_snapshot text not null/);
  assert.match(migration, /on delete set null/);
  assert.match(migration, /contribution_payment_reports_set_snapshot/);
  assert.match(migration, /api_fanclub_snapshot_before_portal_phase2_acceptance/);
  assert.match(migration, /report\.status = 'PENDING'/);
  assert.match(migration, /report\.status = 'CONFIRMED'/);
  assert.match(migration, /report\.status in \('REJECTED', 'REVERSED'\)/);
  assert.match(migration, /resolvedPaymentReportsPreserved/);
  assert.match(migration, /Storniere die Buchung zuerst/);
});

test("global API status distinguishes business validation from transport failures", async () => {
  const api = await read("js/api.js");

  assert.match(api, /let transportFailure = false/);
  assert.match(api, /transportFailure = true/);
  assert.match(api, /lastError = transportFailure \? error : null/);
  assert.doesNotMatch(api, /catch \(error\) \{\s*lastError = error;/);
});

test("shared dialogs provide inline validation and styled confirmation", async () => {
  const common = await read("js/modules/common.js");

  assert.match(common, /function bindInlineValidation/);
  assert.match(common, /field\.validationMessage/);
  assert.match(common, /export function confirmAction/);
  assert.match(common, /v4-confirm-copy/);
  assert.doesNotMatch(common, /return window\.confirm/);
});

test("fanclub acceptance fixes board layout, payment cleanup and ledger colors", async () => {
  const fanclub = await read("js/modules/fanclub.js");

  assert.match(fanclub, /v4-board-grid\$\{editing \? " is-editing" : ""\}/);
  assert.match(fanclub, /keine offene oder wirksame Zahlung mehr besteht/);
  assert.match(fanclub, /Offene Meldungen müssen abgelehnt/);
  assert.equal((fanclub.match(/is-income/g) || []).length >= 2, true);
  assert.equal((fanclub.match(/is-expense/g) || []).length >= 2, true);
});

test("portal-wide CSS covers every approved module and compact state", async () => {
  const css = await read("css/app.css");

  assert.match(css, /Portal Phase 2 – portalweiter Abnahme- und Designstandard/);
  assert.match(css, /\.v4-member-filterbar\{[\s\S]*min-height:0!important/);
  assert.match(css, /\.v4-board-grid \.v4-office-card:first-child/);
  assert.match(css, /\.v4-board-grid\.is-editing/);
  assert.match(css, /\.user-menu-actions/);
  assert.match(css, /\.v4-dialog \.form-grid/);
  assert.match(css, /\.tasks-page \.v4-toolbar/);
  assert.match(css, /\.v4-team-card/);
  assert.match(css, /\.dashboard-widget-grid/);
  assert.match(css, /\.v4-compact-entry\.is-income/);
  assert.match(css, /\.v4-compact-entry\.is-expense/);
  assert.match(css, /@media\(display-mode:standalone\)/);
});

test("cache busting identifies portal phase two acceptance", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-bottom-backdrop-final-r1/);
  assert.match(config, /20260723-ios-standalone-bottom-backdrop-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-bottom-backdrop-final-r1-20260723/);
});

test("manual acceptance checklist covers mobile, PWA and financial workflows", async () => {
  const checklist = await read("docs/PHASE2_PORTAL_ACCEPTANCE_CHECKLIST.md");

  assert.match(checklist, /iPhone als installierte PWA/);
  assert.match(checklist, /REJECTED erlaubt das Entfernen/);
  assert.match(checklist, /Jede Einnahmezeile ist hellgrün/);
  assert.match(checklist, /Aufgaben, Teams und Dashboard/);
});

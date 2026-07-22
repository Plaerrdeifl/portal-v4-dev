import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

function block(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

test("fanclub finalization protects member data and keeps technical codes internal", async () => {
  const [migration, fanclub] = await Promise.all([
    read("supabase/migrations/20260721193000_finalize_fanclub_review.sql"),
    read("js/modules/fanclub.js")
  ]);

  assert.match(migration, /can_manage_member_details/);
  assert.match(migration, /is_office_holder\(p_user_id\)/);
  assert.match(migration, /v_base - 'members' - 'offices'/);
  assert.match(migration, /'memberPhone'/);
  assert.match(migration, /api_member_detail/);
  assert.match(migration, /api_save_offices_before_admin_only/);
  assert.match(migration, /require_capability\('portal\.admin'\)/);
  assert.match(migration, /when|v_action = 'member_detail'/);
  assert.match(migration, /SAISON_/);
  assert.match(migration, /BEITRAG_/);
  assert.match(migration, /api_save_contribution_season_before_internal_code/);
  assert.match(migration, /api_save_contribution_class_before_internal_code/);

  const members = block(fanclub, "function renderMembers", "function renderOffices");
  assert.match(members, /Mitglied seit/);
  assert.match(members, /data-view-member/);
  assert.doesNotMatch(members, /member\.email|member\.phone|member\.city|member\.memberCode/);
  assert.match(fanclub, /call\("member_detail"/);

  const season = block(fanclub, "function seasonForm", "function openSeason");
  const contributionClass = block(fanclub, "function classForm", "function openContributionClass");
  assert.doesNotMatch(season, /name="code"|Kurzcode/);
  assert.doesNotMatch(contributionClass, /name="code"|Kurzcode/);
});

test("fanclub mobile review is compact and drill-down based", async () => {
  const [fanclub, css, ui, app, pages, index, worker] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css"),
    read("js/ui.js"),
    read("js/app.js"),
    read("js/pages.js"),
    read("index.html"),
    read("service-worker.js")
  ]);

  assert.match(fanclub, /data-office-code=/);
  assert.match(fanclub, /v4-board-save/);
  assert.match(css, /data-office-code="VORSTAND_1"/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

  assert.match(fanclub, /v4-contribution-status/);
  assert.match(fanclub, /Bezahlt/);
  assert.match(fanclub, /data-open-contribution/);

  assert.match(fanclub, /v4-account-grid-compact/);
  assert.match(fanclub, /data-open-finance-account/);
  assert.match(fanclub, /financeManagementButton/);
  assert.match(fanclub, /financeEntrySearch/);
  assert.match(fanclub, /data-open-finance-entry/);
  assert.doesNotMatch(fanclub, /id="financeAccountFilter"/);

  assert.match(ui, /title: "Zur Startseite"/);
  assert.match(app, /setAuthTransition/);
  assert.match(app, /await auth\.initialize\(\)/);
  assert.doesNotMatch(app, /window\.setTimeout\(\(\) => \{\s*auth\.initialize/);
  assert.match(pages, /context\.onGoogleCredential/);
  assert.doesNotMatch(index, /data-auth-ready/);
  assert.doesNotMatch(index, /data-startup-state/);
  assert.match(index, /20260722-ui-foundation-p1-runtime-1/);
  assert.match(worker, /pd-portal-v4-ui-foundation-p1-runtime-20260722-1/);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("project-wide compact interaction standard is documented and linked", async () => {
  const [standard, readme] = await Promise.all([
    read("docs/UX_INTERACTION_STANDARD.md"),
    read("README.md")
  ]);

  assert.match(standard, /gesamtes Portal V4/);
  assert.match(standard, /kleine graue Schaltfläche/);
  assert.match(standard, /Antippbare Datensätze und Chevron/);
  assert.match(standard, /Lesen vor Bearbeiten/);
  assert.match(standard, /Verschachtelte kleine Scrollbereiche sind zu vermeiden/);
  assert.match(readme, /UX_INTERACTION_STANDARD\.md/);
});

test("fanclub uses compact headings, search, filters and drill-down rows", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.match(fanclub, /memberSearchInput/);
  assert.match(fanclub, /showInactiveMembers/);
  assert.match(fanclub, />\+ Mitglied</);
  assert.match(fanclub, /v4-member-compact-row/);
  assert.match(fanclub, /v4-row-chevron/);
  assert.match(fanclub, /boardEditMode/);
  assert.match(fanclub, /manageBoardButton/);

  assert.match(fanclub, /Nicht zugeordnet/);
  assert.match(fanclub, /In Prüfung/);
  assert.match(css, /\.v4-contribution-status\.is-unassigned/);
  assert.match(css, /\.v4-contribution-status\.is-pending/);
  assert.match(fanclub, />\+ Beitragsklasse</);
  assert.match(fanclub, /contributionManagementButton/);
  assert.doesNotMatch(fanclub, /id="addContributionSeasonButton"/);
  assert.doesNotMatch(fanclub, /id="editContributionSeasonButton"/);

  assert.match(css, /Projektweiter UX-Interaktionsstandard/);
  assert.match(css, /button\.v4-heading-action/);
  assert.match(css, /\.v4-settings-row/);
});

test("cashbook is compact, typed, searchable and paginated without nested scrolling", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.match(fanclub, /\{ value: "CASH", label: "Bar" \}/);
  assert.match(fanclub, /\{ value: "BANK", label: "Bankkonto" \}/);
  assert.match(fanclub, /v4-account-detail-summary/);
  assert.match(fanclub, /entries\.length\} Buchungen/);
  assert.match(fanclub, /showMoreFinanceEntries/);
  assert.match(fanclub, /CASHBOOK_PAGE_SIZE/);
  assert.match(fanclub, /applyCashbookEntryVisibility/);
  assert.match(fanclub, /signedMoney\(entry\)/);
  assert.match(fanclub, /Verwaltung <span aria-hidden="true">›<\/span>/);

  assert.match(css, /\.v4-compact-entry-list,\.v4-cashbook-ledger\{max-height:none!important;overflow:visible!important/);
  assert.ok(css.includes('html[data-portal-area="portal"]:not([data-route="profile"]) .view>.page{padding-bottom:calc'));
});

test("cache busting identifies phase-one runtime acceptance fix", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-pwa-bottom-nav-final-r1/);
  assert.match(config, /20260723-pwa-bottom-nav-final-r1/);
  assert.match(worker, /pd-portal-v4-pwa-bottom-nav-final-r1-20260723/);
});

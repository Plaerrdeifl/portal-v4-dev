import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("personal dashboard defines only the approved widget catalog", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  for (const key of [
    "member_count",
    "contribution",
    "open_contributions",
    "birthdays",
    "own_tasks",
    "team_tasks",
    "finance",
    "board_tasks"
  ]) {
    assert.match(dashboard, new RegExp(`key: "${key}"`));
  }

  assert.match(
    dashboard,
    /const __V4_PERSONAL_DASHBOARD_WIDGETS_R1__ = true;/
  );
});

test("dashboard supports small compact standard and wide widget sizes", async () => {
  const [dashboard, css] = await Promise.all([
    read("js/modules/dashboard.js"),
    read("css/app.css")
  ]);

  assert.match(
    dashboard,
    /const ALL_SIZES = \["small", "compact", "standard", "wide"\]/
  );
  assert.match(css, /\.dashboard-widget\.widget-size-small\{[\s\S]*grid-column:span 3/);
  assert.match(css, /\.dashboard-widget\.widget-size-compact\{[\s\S]*grid-column:span 4/);
  assert.match(css, /\.dashboard-widget\.widget-size-standard\{[\s\S]*grid-column:span 6/);
  assert.match(css, /\.dashboard-widget\.widget-size-wide\{[\s\S]*grid-column:span 12/);
});

test("mobile dashboard retains two base columns", async () => {
  const css = await read("css/app.css");
  const marker = css.indexOf("/* V4 PERSONAL DASHBOARD WIDGETS R1 */");

  assert.ok(marker >= 0);

  const block = css.slice(marker);

  assert.match(
    block,
    /@media\(max-width:700px\)\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/
  );
  assert.match(
    block,
    /\.dashboard-widget\.widget-size-compact\{[\s\S]*grid-column:span 1/
  );
  assert.match(
    block,
    /\.dashboard-widget\.widget-size-standard,[\s\S]*grid-column:span 2/
  );
});

test("dashboard editor provides visibility size ordering and defaults", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(dashboard, /Dashboard anpassen/);
  assert.match(dashboard, /data-dashboard-move="-1"/);
  assert.match(dashboard, /data-dashboard-move="1"/);
  assert.match(dashboard, /draggable="true"/);
  assert.match(dashboard, /data-dashboard-reset/);
  assert.match(dashboard, /saveDashboardPreferences/);
});

test("dashboard page exposes only the compact customize toolbar", async () => {
  const page = await read("pages/dashboard.html");

  assert.match(page, /id="dashboardToolbar"/);
  assert.match(page, /id="dashboardCustomizeButton"/);
  assert.match(page, /id="dashboardWidgets"/);
  assert.doesNotMatch(page, /<h2>/);
});

test("Supabase migration validates and isolates dashboard preferences", async () => {
  const migration = await read(
    "supabase/migrations/20260724193000_add_personal_dashboard_widgets_r1.sql"
  );

  assert.match(
    migration,
    /create table app_portal\.user_dashboard_preferences/
  );
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /create or replace function app_private\.normalize_dashboard_layout/
  );
  assert.match(
    migration,
    /alter function public\.pd_api\(text, jsonb\)[\s\S]*rename to pd_api_core_before_dashboard_widgets_r1/
  );
  assert.match(
    migration,
    /p_action = 'saveDashboardPreferences'/
  );
  assert.match(
    migration,
    /p_action = 'dashboard'/
  );
  assert.match(
    migration,
    /revoke all on function[\s\S]*pd_api_core_before_dashboard_widgets_r1/
  );
});

test("personal dashboard remains active under the current shell release", async () => {
  const [
    index,
    pages,
    worker,
    dashboard
  ] = await Promise.all([
    read("index.html"),
    read("js/pages.js"),
    read("service-worker.js"),
    read("js/modules/dashboard.js")
  ]);

  assert.match(
    index,
    /name="pd-release" content="20260730-google-signin-stable-width-r2"/
  );

  assert.match(
    index,
    /app\.css\?v=20260730-google-signin-stable-width-r2/
  );

  assert.equal(
    (
      pages.match(
        /modules\/dashboard\.js\?v=20260724-dashboard-delivery-corr2&feature=20260724-personal-dashboard-widgets-r1-fix4/g
      ) || []
    ).length,
    2
  );

  assert.match(
    worker,
    /pd-portal-v4-personal-dashboard-widgets-r1-fix4-20260724/
  );

  assert.match(
    worker,
    /pd-portal-v4-dashboard-layout-corr3-20260724/
  );

  assert.match(
    dashboard,
    /const cards = \[\];/
  );

  assert.match(
    dashboard,
    /panel\.classList\.toggle\("is-empty", cards\.length === 0\)/
  );

  assert.match(
    dashboard,
    /panel\.innerHTML = cards\.join\(""\)/
  );
});

test("core migration contract includes personal dashboard migration", async () => {
  const coreContract = await read("tests/core_contract.test.mjs");

  assert.match(
    coreContract,
    /"20260724193000_add_personal_dashboard_widgets_r1.sql"/
  );
  assert.match(
    coreContract,
    /"20260724133000_add_role_aware_dashboard_r1\.sql",\s*"20260724193000_add_personal_dashboard_widgets_r1.sql"/
  );
});

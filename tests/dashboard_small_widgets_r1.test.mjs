import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("small size is limited to approved metric widgets", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(
    dashboard,
    /const ALL_SIZES = \["small", "compact", "standard", "wide"\]/
  );
  assert.match(
    dashboard,
    /const SMALL_METRIC_ROW_KEYS = \["member_count", "open_contributions", "finance"\]/
  );
  assert.match(
    dashboard,
    /allowedSizes: widget\.allowSmall[\s\S]*ALL_SIZES[\s\S]*ALL_SIZES\.filter\(size => size !== "small"\)/
  );

  for (const key of ["member_count", "open_contributions", "finance"]) {
    assert.match(
      dashboard,
      new RegExp(`key: "${key}"[\\s\\S]{0,180}allowSmall: true`)
    );
  }
});

test("small row preset selects reveals and orders the three widgets", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(dashboard, /data-dashboard-small-row/);
  assert.match(dashboard, /3er-Kennzahlenreihe/);
  assert.match(dashboard, /select\.value = "small"/);
  assert.match(dashboard, /checkbox\.checked = true/);
  assert.match(dashboard, /SMALL_METRIC_ROW_KEYS\.slice\(\)\.reverse\(\)/);
});

test("mobile small widgets form a three-card row", async () => {
  const css = await read("css/app.css");
  const marker = css.indexOf("/* V4 DASHBOARD SMALL WIDGETS R1 */");
  assert.ok(marker >= 0);
  const block = css.slice(marker);

  assert.match(
    block,
    /@media\(max-width:700px\)\{[\s\S]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/
  );
  assert.match(
    block,
    /\.dashboard-widget\.widget-size-small\{[\s\S]*grid-column:span 2/
  );
  assert.match(
    block,
    /\.dashboard-widget\.widget-size-compact\{[\s\S]*grid-column:span 3/
  );
  assert.match(
    block,
    /\.dashboard-widget\.widget-size-standard,[\s\S]*grid-column:span 6/
  );
});

test("small cards use dedicated short titles", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(
    dashboard,
    /const SMALL_TITLES = \{[\s\S]*member_count: "Mitglieder"[\s\S]*open_contributions: "Offen"[\s\S]*finance: "Kassen"/
  );
  assert.match(
    dashboard,
    /normalizedSize === "small"[\s\S]*SMALL_TITLES\[key\]/
  );
});

test("Supabase accepts small and all previous sizes", async () => {
  const migration = await read(
    "supabase/migrations/20260725010000_add_dashboard_small_widget_size_r1.sql"
  );

  assert.match(
    migration,
    /v_size not in \('small', 'compact', 'standard', 'wide'\)/
  );
  assert.match(
    migration,
    /create or replace function app_private\.normalize_dashboard_layout/
  );
});

test("small widgets remain additive under the current shell release", async () => {
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
    /name="pd-release" content="20260731-login-first-true-single-paint-r3"/
  );

  assert.match(
    index,
    /app\.css\?v=20260731-login-first-true-single-paint-r3/
  );

  assert.equal(
    (
      pages.match(
        /modules\/dashboard\.js\?v=20260724-dashboard-delivery-corr2&feature=20260724-personal-dashboard-widgets-r1-fix4&small=20260725-dashboard-small-widgets-r1/g
      ) || []
    ).length,
    2
  );

  assert.match(
    worker,
    /pd-portal-v4-login-first-true-single-paint-r3-20260731/
  );

  assert.match(
    worker,
    /pd-portal-v4-personal-dashboard-widgets-r1-fix4-20260724/
  );

  assert.match(
    dashboard,
    /const __V4_DASHBOARD_SMALL_WIDGETS_R1__ = true;/
  );
});

test("core contract includes small-size migration", async () => {
  const coreContract = await read("tests/core_contract.test.mjs");

  assert.match(
    coreContract,
    /"20260724193000_add_personal_dashboard_widgets_r1\.sql",\s*"20260725010000_add_dashboard_small_widget_size_r1.sql"/
  );
});

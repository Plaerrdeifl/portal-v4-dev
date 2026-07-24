import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("dashboard layout corr1 keeps role-aware logic but uses new card structure", async () => {
  const dashboard = await read("js/modules/dashboard.js");

  assert.match(
    dashboard,
    /const __V4_DASHBOARD_ROLE_AWARE_R1__ = true;/
  );
  assert.match(
    dashboard,
    /const __V4_DASHBOARD_LAYOUT_CORR1__ = true;/
  );
  assert.match(dashboard, /v4-dashboard-card-layout/);
  assert.match(dashboard, /v4-dashboard-card-meta/);
  assert.match(dashboard, /v4-dashboard-card-content/);
  assert.match(dashboard, /data-dashboard-task-id=/);
  assert.match(dashboard, /navigate\(\s*"tasks"/);
});

test("dashboard css forces readable desktop and mobile layout", async () => {
  const css = await read("css/app.css");

  assert.match(css, /V4 DASHBOARD LAYOUT CORR1/);
  assert.match(css, /\.v4-dashboard-primary-value\{/);
  assert.doesNotMatch(css, /dashboard-hero/);
  assert.match(css, /\.v4-dashboard-card-layout\{/);
  assert.match(css, /grid-template-columns:minmax\(180px,220px\) minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /grid-template-columns:1fr;/);
  assert.match(css, /\.dashboard-page\{/);
  assert.match(css, /padding-bottom:calc\(150px \+ var\(--mobile-safe-bottom\)\)/);
  const block = css.slice(css.indexOf("/* V4 DASHBOARD LAYOUT CORR1 */"));
  assert.doesNotMatch(block, /safe-area-inset-bottom/);
});

test("service worker rotates dashboard layout cache", async () => {
  const worker = await read("service-worker.js");

  assert.match(
    worker,
    /pd-portal-v4-dashboard-layout-corr1-20260724/
  );
  assert.match(
    worker,
    /pd-portal-v4-dashboard-role-aware-r1-20260724/
  );
});

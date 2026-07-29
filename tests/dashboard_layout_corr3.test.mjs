import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("dashboard corr3 removes the fixed side column", async () => {
  const css = await read("css/app.css");
  const marker = css.indexOf("/* V4 DASHBOARD LAYOUT CORR3 */");

  assert.ok(marker >= 0);

  const block = css.slice(marker);

  assert.match(
    block,
    /\.v4-dashboard-card-layout\{[\s\S]*grid-template-columns:minmax\(0,1fr\)/
  );
  assert.doesNotMatch(
    block,
    /grid-template-columns:minmax\(180px,220px\)/
  );
  assert.match(
    block,
    /\.v4-dashboard-card-meta\{[\s\S]*display:flex/
  );
});

test("dashboard corr3 disables arbitrary inherited word breaking", async () => {
  const css = await read("css/app.css");
  const block = css.slice(
    css.indexOf("/* V4 DASHBOARD LAYOUT CORR3 */")
  );

  assert.match(
    block,
    /\.dashboard-widget,\s*\.dashboard-widget \*\{[\s\S]*overflow-wrap:normal/
  );
  assert.match(block, /word-break:normal/);
  assert.match(block, /hyphens:none/);
  assert.match(
    block,
    /\.v4-dashboard-detail-row span\{[\s\S]*overflow-wrap:normal/
  );
});

test("dashboard corr3 uses balanced desktop and full-width responsive cards", async () => {
  const css = await read("css/app.css");
  const block = css.slice(
    css.indexOf("/* V4 DASHBOARD LAYOUT CORR3 */")
  );

  assert.match(
    block,
    /\.dashboard-widget\.v4-dashboard-birthdays,[\s\S]*grid-column:span 8/
  );
  assert.match(
    block,
    /\.dashboard-widget\.v4-dashboard-metric-card\{[\s\S]*grid-column:span 4/
  );
  assert.match(block, /@media\(max-width:1000px\)/);
  assert.match(block, /grid-column:1\/-1/);
});

test("dashboard corr3 resets the old nested status bubble", async () => {
  const css = await read("css/app.css");
  const block = css.slice(
    css.indexOf("/* V4 DASHBOARD LAYOUT CORR3 */")
  );

  assert.match(
    block,
    /\.v4-dashboard-status-summary span\{[\s\S]*padding:0;[\s\S]*background:transparent/
  );
});

test("dashboard corr3 remains active under the current shell release", async () => {
  const [index, worker] = await Promise.all([
    read("index.html"),
    read("service-worker.js")
  ]);

  assert.match(
    index,
    /name="pd-release" content="20260729-login-first-auth-gate-r1"/
  );

  assert.match(
    index,
    /app\.css\?v=20260729-login-first-auth-gate-r1/
  );

  assert.match(
    worker,
    /pd-portal-v4-dashboard-layout-corr3-20260724/
  );

  assert.match(
    worker,
    /pd-portal-v4-dashboard-delivery-corr2-20260724/
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

const shellRelease =
  "20260802-pwa-install-guidance-r1";

const dashboardRelease =
  "20260724-dashboard-delivery-corr2";

test("current shell versions every required entry point while retaining dashboard delivery", async () => {
  const [
    index,
    config,
    app,
    pages,
    install,
    worker
  ] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("js/app.js"),
    read("js/pages.js"),
    read("js/install.js"),
    read("service-worker.js")
  ]);

  assert.match(
    index,
    new RegExp(
      `name="pd-release" content="${shellRelease}"`
    )
  );

  assert.match(
    index,
    new RegExp(
      `css/app\\.css\\?v=${shellRelease}`
    )
  );

  assert.match(
    index,
    new RegExp(
      `js/app\\.js\\?v=${shellRelease}`
    )
  );

  assert.match(
    config,
    new RegExp(
      `service-worker\\.js\\?v=${shellRelease}`
    )
  );

  assert.match(
    app,
    new RegExp(
      `pages\\.js\\?v=${shellRelease}`
    )
  );

  assert.match(
    app,
    new RegExp(
      `install\\.js\\?v=${shellRelease}`
    )
  );

  assert.match(
    pages,
    new RegExp(
      `modules/dashboard\\.js\\?v=${dashboardRelease}`
    )
  );

  assert.equal(
    (
      pages.match(
        new RegExp(
          `modules/dashboard\\.js\\?v=${dashboardRelease}`,
          "g"
        )
      ) || []
    ).length,
    2
  );

  assert.match(
    install,
    /function announceWaitingUpdate()/
  );

  assert.match(
    install,
    /registration.waiting/
  );

  assert.match(
    install,
    /await registration.update()/
  );

  assert.match(
    worker,
    /pd-portal-v4-dashboard-delivery-corr2-20260724/
  );

  assert.match(
    worker,
    /pd-portal-v4-dashboard-layout-corr1-20260724/
  );
});

test("dashboard layout implementation remains present", async () => {
  const [css, dashboard] = await Promise.all([
    read("css/app.css"),
    read("js/modules/dashboard.js")
  ]);

  assert.match(
    css,
    /V4 DASHBOARD LAYOUT CORR1/
  );

  assert.match(
    css,
    /.v4-dashboard-card-layout{/
  );

  assert.match(
    css,
    /@media\(max-width:980px\)/
  );

  assert.match(
    dashboard,
    /const __V4_DASHBOARD_LAYOUT_CORR1__ = true;/
  );
});

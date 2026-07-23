import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(
  path.join(root, relativePath),
  "utf8"
);

test("desktop sidebar never exposes horizontal navigation scrolling", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /\.nav button\{width:100%;min-width:0;/
  );
  assert.match(
    css,
    /\.sidebar \.nav-main\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;/
  );
});

test("smart dialog forms preserve proportional mobile fields", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.match(
    css,
    /\.v4-dialog \.form-grid:not\(\.v4-smart-form\)/
  );
  assert.match(
    css,
    /\.v4-smart-form\{[^}]*repeat\(12,minmax\(0,1fr\)\)/
  );
  assert.match(
    fanclub,
    /<label class="v4-field-half">E-Mail/
  );
  assert.match(
    fanclub,
    /<label class="v4-field-half">Telefon/
  );
  assert.match(
    fanclub,
    /function seasonForm[\s\S]+v4-smart-form[\s\S]+v4-field-half">Beginn[\s\S]+v4-field-half">Ende/
  );
});

test("finance account summaries separate names balances and chevrons", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.match(fanclub, /v4-account-summary-button/);
  assert.match(
    css,
    /grid-template-areas:"name arrow" "balance arrow"/
  );
  assert.match(css, /\.v4-account-summary-button \.v4-row-chevron/);
});

test("contribution totals use ledger-compatible state colors", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.match(fanclub, /v4-contribution-summary-card is-confirmed/);
  assert.match(fanclub, /v4-contribution-summary-card is-open/);
  assert.match(fanclub, /v4-contribution-summary-card is-pending/);
  assert.match(
    css,
    /\.v4-contribution-summary-card\.is-confirmed[\s\S]+var\(--portal-income-bg\)/
  );
  assert.match(
    css,
    /\.v4-contribution-summary-card\.is-open[\s\S]+var\(--portal-expense-bg\)/
  );
  assert.match(
    css,
    /\.v4-contribution-summary-card\.is-pending[\s\S]+var\(--portal-pending-bg\)/
  );
});

test("standalone PWA uses the full dynamic viewport", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /@media\(display-mode:standalone\) and \(max-width:860px\)/
  );
  assert.match(css, /height:100dvh/);
  assert.match(
    css,
    /\.view\{[\s\S]*overflow-y:auto!important;/
  );
  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav\{[\s\S]*bottom:calc\(0px - var\(--safe-top\)\)!important;/
  );
});

test("cache busting identifies final mobile shell R1", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(config, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-bottom-alignment-final-r1-20260723/);
});

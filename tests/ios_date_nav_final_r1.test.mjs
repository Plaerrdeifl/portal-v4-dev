import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("mobile safe area is bounded independently from the raw iOS inset", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(
    tokens,
    /--mobile-safe-bottom:clamp\(0px,var\(--safe-bottom\),34px\)/
  );
  assert.match(
    css,
    /height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );
  assert.match(
    css,
    /padding:\s*4px\s*max\(8px,var\(--safe-right\)\)\s*var\(--mobile-safe-bottom\)/
  );
  assert.doesNotMatch(
    css,
    /height:calc\(var\(--mobile-nav-height\) \+ var\(--safe-bottom\)\)/
  );
});

test("all navigation-dependent mobile spacing uses the bounded inset", async () => {
  const css = await read("css/app.css");

  for (const required of [
    "calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 16px)",
    "calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 8px)",
    "calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 10px)",
    "calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 12px)",
    "calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 14px)"
  ]) {
    assert.match(css, new RegExp(
      required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ));
  }
});

test("iOS date controls have one fixed shared geometry", async () => {
  const css = await read("css/app.css");

  for (const required of [
    "-webkit-appearance:none!important",
    "height:42px!important",
    "min-height:42px!important",
    "max-height:42px!important",
    "block-size:42px!important",
    "min-block-size:42px!important",
    "max-block-size:42px!important",
    "::-webkit-date-and-time-value",
    "::-webkit-datetime-edit",
    "::-webkit-calendar-picker-indicator"
  ]) {
    assert.match(css, new RegExp(
      required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ));
  }
});

test("smart forms constrain intrinsic date width and preserve a real column gap", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /\.v4-smart-form\{[\s\S]*gap:9px 12px!important/
  );
  assert.match(
    css,
    /\.v4-smart-form>\[class\*="v4-field-"\]\{min-width:0!important;max-width:100%!important;contain:inline-size\}/
  );
  assert.match(
    css,
    /\.v4-smart-form>label:has\(>input\[type="date"\]\)\{overflow:hidden\}/
  );
  assert.match(
    css,
    /@media\(max-width:430px\)\{\.v4-smart-form\{gap:8px 12px!important\}/
  );
});

test("cache busting identifies the iOS date and navigation final release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260722-ios-date-nav-final-r1/);
  assert.match(config, /20260722-ios-date-nav-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-date-nav-final-r1-20260722/);
});

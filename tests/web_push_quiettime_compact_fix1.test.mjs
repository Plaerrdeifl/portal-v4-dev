import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("quiet-time fields stay compact on iOS", async () => {
  const css = await read("css/app.css");
  const worker = await read("service-worker.js");

  assert.match(css, /V4 WEB PUSH QUIETTIME COMPACT FIX1/);
  assert.match(
    css,
    /\.v4-push-quiet-grid\{[\s\S]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/
  );
  assert.match(
    css,
    /input\[type="time"\][\s\S]+-webkit-appearance:none!important/
  );
  assert.match(css, /block-size:34px!important/);
  assert.match(css, /max-height:34px!important/);
  assert.match(css, /font-size:16px!important/);
  assert.match(css, /::-webkit-date-and-time-value/);
  assert.match(css, /::-webkit-datetime-edit/);
  assert.match(css, /::-webkit-datetime-edit-fields-wrapper/);
  assert.match(css, /::-webkit-calendar-picker-indicator/);
  assert.match(
    css,
    /\.v4-push-quiet-grid\.is-disabled label[\s\S]+pointer-events:none!important/
  );

  assert.match(worker, /pd-portal-v4-push-newtasks-quiettime-r1-20260723/);
});

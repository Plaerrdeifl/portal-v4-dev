import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("measured iPhone geometry is addressed by the opaque status-bar mode", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /apple-mobile-web-app-status-bar-style" content="black"/
  );
  assert.doesNotMatch(index, /black-translucent/);
});

test("standalone navigation uses the real 34px-class safe area instead of ten pixels", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /--mobile-safe-bottom:var\(--safe-bottom\)/
  );
  assert.doesNotMatch(
    css,
    /@media\(display-mode:standalone\)[\s\S]*?--mobile-safe-bottom:10px/
  );
});

test("diagnostic and unreachable backdrop are removed", async () => {
  const [index, css] = await Promise.all([
    read("index.html"),
    read("css/app.css")
  ]);

  assert.doesNotMatch(index, /standalone-geometry-diagnostic/);
  assert.doesNotMatch(css, /\.mobile-bottom-nav::after/);
});

test("cache identifies the opaque status-bar bottom-navigation release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(config, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(
    worker,
    /pd-portal-v4-task-history-r1-30min-20260723/
  );
});

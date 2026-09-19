import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("action and situation stickers wrap in a maximum four-column grid without horizontal overflow", async () => {
  const publish = await read("js/liveticker-whatsapp-publish.js");

  assert.match(publish, /\.liveticker-whatsapp-sticker-options\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(publish, /\.liveticker-whatsapp-sticker-options\{[^}]*max-width:100%;[^}]*width:100%;[^}]*overflow:visible/);
  assert.doesNotMatch(publish, /\.liveticker-whatsapp-sticker-options\{[^}]*grid-auto-flow:column/);
  assert.doesNotMatch(publish, /\.liveticker-whatsapp-sticker-options\{[^}]*overflow-x:auto/);
  assert.doesNotMatch(publish, /\.liveticker-whatsapp-sticker-options\{[^}]*grid-auto-columns/);

  assert.match(publish, /\.liveticker-whatsapp-sticker-option\{[^}]*width:100%;[^}]*min-width:0;[^}]*overflow:hidden/);
  assert.match(publish, /\.liveticker-whatsapp-sticker-option span\{[^}]*overflow-wrap:anywhere/);
  assert.match(publish, /@media\(max-width:360px\)\{\.liveticker-whatsapp-sticker-options\{gap:5px\}/);
});

test("sticker grid cache marker is propagated through the liveticker module chain", async () => {
  const [html, auth, bootstrap] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js")
  ]);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260919-dev-live-safety-r1/);
  assert.match(auth, /liveticker-bootstrap\.js\?v=20260919-live-safety-r1/);
  assert.match(bootstrap, /liveticker-whatsapp-publish\.js\?v=20260919-live-safety-r1/);
});

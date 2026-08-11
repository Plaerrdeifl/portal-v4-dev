import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("M310 standalone page owns a route-scoped vertical scroll contract", async () => {
  const html = await readFile(
    resolve(root, "fanbus-anmeldung.html"),
    "utf8"
  );
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

  assert.ok(styleMatch, "Standalone-Inline-Style fehlt.");

  const inlineStyle = styleMatch[1];
  const scrollContract = inlineStyle.match(
    /html\[data-route="fanbus-registration"\],\s*html\[data-route="fanbus-registration"\] body\s*\{([^}]*)\}/
  );

  assert.ok(
    scrollContract,
    "Der routenspezifische Standalone-Scroll-Vertrag fehlt."
  );

  const declarations = scrollContract[1];

  assert.match(declarations, /height:auto!important;/);
  assert.match(declarations, /min-height:100%;/);
  assert.match(declarations, /max-height:none!important;/);
  assert.match(declarations, /overflow-x:hidden!important;/);
  assert.match(declarations, /overflow-y:auto!important;/);
  assert.doesNotMatch(declarations, /height:100(?:d|s|l)?vh/);
  assert.doesNotMatch(declarations, /touch-action/);
  assert.doesNotMatch(
    declarations,
    /overscroll-behavior|-webkit-overflow-scrolling/
  );

  assert.doesNotMatch(
    inlineStyle,
    /(?:^|})\s*(?:html|body)\s*(?:,|\{)/m
  );
  assert.doesNotMatch(
    inlineStyle,
    /data-portal-area|\.app-shell|\.app-main|\.view/
  );
});

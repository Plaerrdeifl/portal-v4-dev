import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(
  path.join(root, relativePath),
  "utf8"
);

test("mobile navigation has one exact content height plus safe area", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(
    css,
    /\.mobile-bottom-nav\{[\s\S]*height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\);[\s\S]*max-height:calc/
  );
  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav\{[\s\S]*height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)!important/
  );
});

test("dialogs and account menus shrink to content and scroll only when needed", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /\.v4-dialog-shell\{[\s\S]*display:flex!important;[\s\S]*flex-direction:column!important;[\s\S]*height:auto!important/
  );
  assert.match(
    css,
    /#v4DialogBody\{[\s\S]*flex:0 1 auto!important;[\s\S]*padding:13px 16px!important/
  );
  assert.match(
    css,
    /\.user-menu-panel\{[\s\S]*display:flex!important;[\s\S]*bottom:auto!important;[\s\S]*height:auto!important/
  );
  assert.match(
    css,
    /\.user-profile-dialog-shell\{[\s\S]*display:flex!important;[\s\S]*height:auto!important/
  );
  assert.match(
    css,
    /#v4DialogBody>\.dialog-actions\{[\s\S]*margin:13px -16px -13px!important/
  );
});

test("smart forms survive every mobile media query", async () => {
  const [css, fanclub, ui] = await Promise.all([
    read("css/app.css"),
    read("js/modules/fanclub.js"),
    read("js/ui.js")
  ]);

  assert.match(
    css,
    /\.v4-dialog \.form-grid:not\(\.v4-smart-form\),\s*\.user-profile-dialog \.form-grid:not\(\.v4-smart-form\)/
  );
  assert.doesNotMatch(
    css,
    /@media\(max-width:860px\)\{[\s\S]*?\.v4-dialog \.form-grid,\s*\.user-profile-dialog \.form-grid\{/
  );
  assert.match(
    fanclub,
    /v4-field-nine">Straße[\s\S]*v4-field-three">Hausnummer/
  );
  assert.match(
    fanclub,
    /v4-field-three">PLZ[\s\S]*v4-field-nine">Ort/
  );
  assert.match(
    ui,
    /memberChangeRequestForm" class="form-grid user-profile-form v4-smart-form"/
  );
  assert.match(
    ui,
    /directProfileForm" class="form-grid user-profile-form v4-smart-form"/
  );
});

test("module rhythm uses one shared panel gap without doubled child margins", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.module-panel\{\s*display:grid;\s*gap:10px;/
  );
  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.module-panel>\*\{\s*margin-block:0!important;/
  );
});

test("manual checklist identifies every final visual inspection location", async () => {
  const checklist = await read(
    "docs/PHASE2_PORTAL_ACCEPTANCE_CHECKLIST.md"
  );

  for (const required of [
    "Dashboard öffnen",
    "Fanclub → Mitglieder",
    "Beitragsjahr anlegen und bearbeiten",
    "Fanclub → Kasse → Verwaltung",
    "Modulabstände",
    "Benutzermenü und Profil"
  ]) {
    assert.match(checklist, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("cache busting identifies final visual consistency R1", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(config, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-bottom-alignment-final-r1-20260723/);
});

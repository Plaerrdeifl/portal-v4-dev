import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("user menu hidden state always overrides flex display", async () => {
  const css = await read("css/app.css");
  assert.match(
    css,
    /\.user-menu-panel\[hidden\],\s*\.user-menu-backdrop\[hidden\]\{\s*display:none!important;/
  );
});

test("user menu supports direct close, backdrop close and focus return", async () => {
  const ui = await read("js/ui.js");
  assert.match(ui, /let userMenuReturnFocus = null/);
  assert.match(ui, /backdrop\.addEventListener\("click"[\s\S]*closeUserMenu\(\)/);
  assert.match(ui, /panel\.querySelector\("\[data-close-user-menu\]"\)[\s\S]*closeUserMenu\(\)/);
  assert.match(ui, /returnTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(ui, /event\.key === "Escape"[\s\S]*closeUserMenu\(\)/);
});

test("dialog actions do not reserve viewport safe area", async () => {
  const css = await read("css/app.css");
  assert.match(css, /#v4DialogBody>\.dialog-actions\{[\s\S]*padding:10px 16px!important;/);
  assert.match(
    css,
    /@media\(max-width:860px\)\{[\s\S]*#v4DialogBody>\.dialog-actions\{[\s\S]*padding:9px 13px!important;/
  );
  assert.doesNotMatch(
    css,
    /#v4DialogBody>\.dialog-actions\{[\s\S]*safe-area-inset-bottom/
  );
});

test("mobile navigation is compact and still includes the real safe area", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);
  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(css, /min-height:56px;\s*height:56px;/);
  assert.match(
    css,
    /height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );
});

test("native iOS date controls match the shared field geometry", async () => {
  const css = await read("css/app.css");
  assert.match(css, /input\[type="date"\][\s\S]*-webkit-appearance:none!important/);
  assert.match(css, /block-size:42px!important/);
  assert.match(css, /min-block-size:42px!important/);
  assert.match(css, /max-block-size:42px!important/);
  assert.match(css, /::-webkit-date-and-time-value/);
  assert.match(css, /::-webkit-datetime-edit/);
  assert.match(css, /\.v4-smart-form>label:has\(>input\[type="date"\]\)\{overflow:hidden\}/);
  assert.match(
    css,
    /\.v4-smart-form>\.v4-field-four\{grid-column:span 6!important\}/
  );
});

test("mobile transfer uses semantic smart-form account rows", async () => {
  const fanclub = await read("js/modules/fanclub.js");
  assert.match(fanclub, /function transferForm[\s\S]*v4-smart-form/);
  assert.equal(
    (fanclub.match(/v4-field-half v4-field-account-select/g) || []).length,
    2
  );
  assert.match(
    fanclub,
    /v4-field-half">Betrag[\s\S]*v4-field-half">Buchungsdatum/
  );
});

test("cache busting identifies global UI completion R1", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);
  assert.match(index, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(config, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(worker, /pd-portal-v4-task-history-r1-30min-20260723/);
});

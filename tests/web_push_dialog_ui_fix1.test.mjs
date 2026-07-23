import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(path, "utf8");

test("Web Push dialog follows portal style and scrolls on iPhone", async () => {
  const push = await read("js/push.js");
  const css = await read("css/app.css");
  const worker = await read("service-worker.js");

  assert.match(
    push,
    /id="pushSettingsBody" class="v4-push-scroll-region"/
  );
  assert.doesNotMatch(push, /<span class="subtle">Benutzermenü<\/span>/);

  assert.match(css, /V4 WEB PUSH DIALOG UI FIX1/);
  assert.match(
    css,
    /#pushSettingsBody\.v4-push-scroll-region[\s\S]+overflow-y:auto!important/
  );
  assert.match(css, /-webkit-overflow-scrolling:touch!important/);
  assert.match(css, /touch-action:pan-y!important/);
  assert.match(
    css,
    /\.v4-push-dialog \.v4-dialog-shell[\s\S]+grid-template-rows:auto minmax\(0,1fr\)/
  );
  assert.match(
    css,
    /\.v4-switch-row input\[type="checkbox"\][\s\S]+appearance:none!important/
  );
  assert.match(css, /width:44px!important/);
  assert.match(css, /height:26px!important/);
  assert.match(css, /\.v4-push-summary[\s\S]+grid-template-columns:1\.2fr 1fr \.75fr/);
  assert.match(
    css,
    /\.v4-push-preferences>\.button\[type="submit"\][\s\S]+position:sticky!important/
  );
  assert.match(
    css,
    /\[data-disable-push\][\s\S]+background:#fff4f5!important/
  );

  assert.match(worker, /pd-portal-v4-web-push-dialog-ui-fix1-20260723/);
});

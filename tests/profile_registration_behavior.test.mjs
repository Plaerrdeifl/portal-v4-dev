import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("required profile names are normalized independently", async () => {
  globalThis.window = {
    PD_RUNTIME_CONFIG: {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
  globalThis.location = { hash: "#/profile" };

  const module = await import(
    "../js/modules/profile.js?profile-test=" + Date.now()
  );

  assert.equal(module.normalizeRequiredName("  Benny  "), "Benny");
  assert.equal(module.normalizeRequiredName("   "), "");
  assert.equal(module.normalizeRequiredName(null), "");
});

test("profile registration remains retryable and keyboard accessible", async () => {
  const [profile, ui, css, page] = await Promise.all([
    read("js/modules/profile.js"),
    read("js/ui.js"),
    read("css/app.css"),
    read("pages/profile.html")
  ]);

  assert.equal(page.includes('id="profileFirstName"'), true);
  assert.equal(page.includes('id="profileLastName"'), true);
  assert.equal(page.includes("required"), true);

  assert.equal(profile.includes("normalizeRequiredName"), true);
  assert.equal(profile.includes("setCustomValidity"), true);
  assert.equal(profile.includes("scrollIntoView"), true);
  assert.equal(profile.includes("window.visualViewport"), true);
  assert.equal(profile.includes("{ once: true });\n\n  bindCommon"), false);
  assert.equal(profile.includes("firstName: names.firstName"), true);
  assert.equal(profile.includes("lastName: names.lastName"), true);

  assert.equal(ui.includes("const profileRequired = auth.requiresProfile();"), true);
  assert.equal(
    ui.includes('[createRouteButton("profile", routes().profile, "mobile-nav-button")]'),
    true
  );

  assert.equal(
    css.includes("Mobile Profilregistrierung mit virtueller Tastatur"),
    true
  );
  assert.equal(css.includes("--profile-keyboard-inset"), true);
  assert.equal(
    css.includes(
      'html[data-route="profile"] .view{height:100%!important;min-height:0!important;overflow-x:hidden!important;overflow-y:auto!important'
    ),
    true
  );
  assert.equal(css.includes("-webkit-overflow-scrolling:touch"), true);
  assert.equal(css.includes("touch-action:pan-y!important"), true);
  assert.equal(
    css.includes(
      "padding-bottom:calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + var(--profile-keyboard-inset) + 32px)!important"
    ),
    true
  );
});

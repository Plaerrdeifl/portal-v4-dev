import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("mobile portal round one follows the approved layout rules", async () => {
  const [css, fanclub, ui, app, index, sidebar, worker] = await Promise.all([
    read("css/app.css"),
    read("js/modules/fanclub.js"),
    read("js/ui.js"),
    read("js/app.js"),
    read("index.html"),
    read("components/sidebar.html"),
    read("service-worker.js")
  ]);

  assert.equal(css.includes("Mobile Portal Layout und Fanclub"), true);
  assert.equal(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), true);
  assert.equal(css.includes(".v4-table tbody tr{display:grid!important"), true);
  assert.equal(css.includes("bottom:calc(var(--mobile-nav-height) + var(--mobile-safe-bottom) + 10px)!important"), true);
  assert.equal(css.includes(".sidebar .nav-main{flex:1 1 auto;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}"), true);
  assert.equal(css.includes(".sidebar .nav-footer{flex:0 0 auto;overflow:visible;position:relative;z-index:2;"), true);
  assert.equal(css.includes('html[data-portal-area="portal"] .sidebar{overflow:hidden!important;padding-bottom:calc(18px + var(--mobile-nav-height) + var(--mobile-safe-bottom))!important}'), true);
  assert.equal(css.includes('.sidebar .nav button[data-route="install"]{margin-top:0}'), true);
  assert.equal(css.includes(".topbar-home-button{display:none!important}"), true);
  assert.equal(css.includes('data-route="login"'), false);
  assert.equal(
    css.includes(".public-login-inline{min-height:0!important"),
    true
  );

  assert.equal(fanclub.includes('["offices", "Vorstand"]'), true);
  assert.equal(fanclub.includes('["cashbook", "Kasse"]'), true);
  assert.equal(fanclub.includes("Unsere Mitglieder"), true);
  assert.equal(fanclub.includes("Unser Vorstand"), true);
  assert.equal(fanclub.includes("Unsere Fanclub-Kassen"), true);
  assert.equal(fanclub.includes("1. Vorstand"), true);
  assert.equal(fanclub.includes("auth.isAdmin()"), true);
  assert.equal(fanclub.includes("v4-board-phone"), true);
  assert.equal(fanclub.includes("<th>PD-ID</th>"), false);
  assert.equal(fanclub.includes("showMemberCodes"), false);


  for (const markup of [index, sidebar]) {
    assert.equal(markup.includes('class="portal-home-entry"'), true);
    assert.equal(markup.includes('data-route="home"'), true);
    assert.equal(markup.includes('<span>Zur Startseite</span>'), true);
    assert.equal(markup.includes('id="portalNavFooter" class="nav nav-footer" aria-label="Portalnavigation" aria-hidden="true" hidden'), true);
  }
  assert.equal(ui.includes("footerNav.replaceChildren"), false);
  assert.equal(ui.includes("footerNav.hidden = !authenticatedPortal;"), true);

  assert.equal(ui.includes("prepareResponsiveTables"), true);
  assert.equal(ui.includes('leftKey === "install"'), true);
  assert.equal(app.includes('label: "Online"'), false);
  assert.equal(app.includes('label: "Live"'), true);
  assert.equal(app.includes('label: "Lädt …"'), true);
  assert.equal(index.includes("20260723-bottom-nav-geometry-final-r2"), true);
  assert.equal(worker.includes("pd-portal-v4-bottom-nav-geometry-final-r2-20260723"), true);
});

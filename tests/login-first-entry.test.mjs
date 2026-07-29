import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(
    new URL("../" + path, import.meta.url),
    "utf8"
  );
}

test(
  "login-first entry is the only signed-out surface",
  async () => {
    const [
      index,
      router,
      app,
      gate,
      ui,
      config,
      runtimeWriter,
      manifest,
      worker,
      css
    ] = await Promise.all([
      source("index.html"),
      source("js/router.js"),
      source("js/app.js"),
      source("js/auth-gate.js"),
      source("js/ui.js"),
      source("js/config.js"),
      source("scripts/write-runtime-config.mjs"),
      source("manifest.webmanifest"),
      source("service-worker.js"),
      source("css/app.css")
    ]);

    assert.match(
      index,
      /id="authGate"/
    );

    assert.match(
      index,
      /id="environmentBadge"[\s\S]*?hidden/
    );

    assert.match(
      index,
      /DEV-PORTAL/
    );

    assert.match(
      index,
      /id="appShell"[\s\S]*?hidden[\s\S]*?inert/
    );

    assert.match(
      index,
      /data-legal-separator/
    );

    assert.doesNotMatch(
      index,
      /data-prerendered-public-home/
    );

    assert.doesNotMatch(
      index,
      />Aktuelles</
    );

    assert.doesNotMatch(
      index,
      />Termine</
    );

    assert.doesNotMatch(
      index,
      />Über uns</
    );

    assert.doesNotMatch(
      index,
      />Kontakt</
    );

    assert.doesNotMatch(
      index,
      />Portal installieren</
    );

    assert.match(
      router,
      /location\.hash \|\| "#\/login"/
    );

    assert.doesNotMatch(
      router,
      /publicOrder/
    );

    assert.match(
      app,
      /showChecking/
    );

    assert.match(
      app,
      /authenticatedTarget/
    );

    assert.match(
      app,
      /replaceHash\("#\/login"\);[\s\S]*?await renderRoute\(\);/
    );

    assert.match(
      gate,
      /environment !== "DEV"/
    );

    assert.match(
      gate,
      /CONFIG\.legal\.imprintUrl/
    );

    assert.match(
      gate,
      /CONFIG\.legal\.privacyUrl/
    );

    assert.match(
      gate,
      /privateHostname/
    );

    assert.match(
      ui,
      /if \(!auth\.isAuthenticated\(\)\) \{[\s\S]*?return \[\];/
    );

    assert.match(
      config,
      /legal:/
    );

    assert.match(
      runtimeWriter,
      /LEGAL_IMPRINT_URL/
    );

    assert.match(
      runtimeWriter,
      /LEGAL_PRIVACY_URL/
    );

    assert.match(
      runtimeWriter,
      /environment === "PROD"/
    );

    assert.match(
      runtimeWriter,
      /environment !== "DEV"[\s\S]*?environment !== "PROD"/
    );

    const parsedManifest = JSON.parse(manifest);

    assert.equal(
      parsedManifest.start_url,
      "./#/login"
    );

    assert.equal(
      Object.hasOwn(parsedManifest, "shortcuts"),
      false
    );

    assert.match(
      worker,
      /\.\/js\/auth-gate\.js/
    );

    for (const publicPage of [
      "home",
      "news",
      "dates",
      "about",
      "contact",
      "install"
    ]) {
      assert.doesNotMatch(
        worker,
        new RegExp(
          "\\./pages/" + publicPage + "\\.html"
        )
      );
    }

    assert.match(
      css,
      /\.environment-badge/
    );

    assert.match(
      css,
      /\.auth-gate/
    );
  }
);

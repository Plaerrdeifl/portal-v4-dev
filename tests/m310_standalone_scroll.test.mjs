import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("M310 standalone page owns a route-scoped vertical scroll contract", async () => {
  const [html, registrationScript] = await Promise.all([
    readFile(resolve(root, "fanbus-anmeldung.html"), "utf8"),
    readFile(resolve(root, "js", "fanbus-registration.js"), "utf8")
  ]);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

  assert.ok(styleMatch, "Standalone-Inline-Style fehlt.");

  const inlineStyle = styleMatch[1];
  const rootContract = inlineStyle.match(
    /html\[data-route="fanbus-registration"\]\s*\{([^}]*)\}/
  );
  const bodyContract = inlineStyle.match(
    /html\[data-route="fanbus-registration"\] body\s*\{([^}]*)\}/
  );

  assert.ok(
    rootContract,
    "Der routenspezifische Root-Scroll-Vertrag fehlt."
  );
  assert.ok(
    bodyContract,
    "Der routenspezifische Body-Vertrag fehlt."
  );

  const rootDeclarations = rootContract[1];
  const bodyDeclarations = bodyContract[1];

  assert.match(rootDeclarations, /height:auto!important;/);
  assert.match(rootDeclarations, /min-height:100%;/);
  assert.match(rootDeclarations, /max-height:none!important;/);
  assert.match(rootDeclarations, /overflow-x:hidden!important;/);
  assert.match(rootDeclarations, /overflow-y:auto!important;/);

  assert.match(bodyDeclarations, /height:auto!important;/);
  assert.match(bodyDeclarations, /min-height:100%;/);
  assert.match(bodyDeclarations, /max-height:none!important;/);
  assert.match(bodyDeclarations, /overflow-x:clip!important;/);
  assert.match(bodyDeclarations, /overflow-y:visible!important;/);

  assert.equal(
    (rootDeclarations + bodyDeclarations).match(/overflow-y:auto!important;/g)
      ?.length,
    1
  );
  assert.doesNotMatch(
    rootDeclarations + bodyDeclarations,
    /height:100(?:d|s|l)?vh|touch-action/
  );
  assert.doesNotMatch(
    html + registrationScript,
    /\b(?:wheel|touchmove)\b/i
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

test("M310 WordPress links use the canonical extensionless registration route", async () => {
  const plugin = await readFile(
    resolve(
      root,
      "wordpress",
      "plugins",
      "plaerrdeifl-m310-fanbus",
      "plaerrdeifl-m310-fanbus.php"
    ),
    "utf8"
  );
  const validationStart = plugin.indexOf(
    "private static function validated_portal_url"
  );
  const validationEnd = plugin.indexOf(
    "private static function validated_https_url",
    validationStart
  );
  const httpsValidationEnd = plugin.indexOf(
    "private static function validated_publishable_key",
    validationEnd
  );
  const renderStart = plugin.indexOf(
    "private static function render_trip"
  );
  const renderEnd = plugin.indexOf(
    "private static function status_presentation",
    renderStart
  );

  assert.ok(validationStart >= 0 && validationEnd > validationStart);
  assert.ok(httpsValidationEnd > validationEnd);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);

  const portalValidation = plugin.slice(validationStart, validationEnd);
  const httpsValidation = plugin.slice(validationEnd, httpsValidationEnd);
  const renderTrip = plugin.slice(renderStart, renderEnd);

  assert.match(
    plugin,
    /https:\/\/portal\.example\.de\/fanbus-anmeldung'/
  );
  assert.doesNotMatch(
    plugin,
    /https:\/\/portal\.example\.de\/fanbus-anmeldung\.html'/
  );
  assert.match(
    portalValidation,
    /array\('\/fanbus-anmeldung', '\/fanbus-anmeldung\.html'\)/
  );
  assert.match(
    portalValidation,
    /\$path === '\/fanbus-anmeldung\.html'[\s\S]*?substr\(\$url, 0, -5\)/
  );
  assert.doesNotMatch(portalValidation, /str_ends_with/);
  assert.match(
    httpsValidation,
    /str_contains\(\$raw, '\?'\)[\s\S]*?str_contains\(\$raw, '#'\)/
  );
  assert.match(
    httpsValidation,
    /strtolower\([\s\S]*?\) !== 'https'/
  );
  assert.match(
    renderTrip,
    /add_query_arg\('trip', \$trip\['tripId'\], \$portal_url\)/
  );
  assert.doesNotMatch(renderTrip, /fanbus-anmeldung\.html/);
});

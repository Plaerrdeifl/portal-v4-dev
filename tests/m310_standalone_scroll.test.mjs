import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Startmarker fehlt: ${startMarker}`);
  assert.notEqual(end, -1, `Endmarker fehlt: ${endMarker}`);
  return source.slice(start, end);
}

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

test("M310 portal and WordPress use the same canonical registration deep link", async () => {
  const [fanbuses, plugin, registrationScript] = await Promise.all([
    readFile(resolve(root, "js", "modules", "fanbuses.js"), "utf8"),
    readFile(
      resolve(
        root,
        "wordpress",
        "plugins",
        "plaerrdeifl-m310-fanbus",
        "plaerrdeifl-m310-fanbus.php"
      ),
      "utf8"
    ),
    readFile(resolve(root, "js", "fanbus-registration.js"), "utf8")
  ]);
  const tripDetail = sourceBlock(
    fanbuses,
    "function tripDetailMarkup(trip, tripStops = [])",
    "function openTripDetail(trip)"
  );
  const renderTrip = sourceBlock(
    plugin,
    "private static function render_trip",
    "private static function status_presentation"
  );
  const initialize = sourceBlock(
    registrationScript,
    "async function initialize()",
    "elements.portalForm.addEventListener"
  );

  const portalLink = tripDetail.match(
    /href="(\.\/fanbus-anmeldung)\?trip=\$\{escapeAttr\(trip\.id\)\}"/
  );
  const wordpressLink = plugin.match(
    /'https:\/\/portal\.example\.de(\/fanbus-anmeldung)'/
  );

  assert.ok(portalLink, "Der interne kanonische M310-Link fehlt.");
  assert.ok(wordpressLink, "Der kanonische WordPress-Pfad fehlt.");
  assert.equal(
    new URL(portalLink[1], "https://portal.example.de/").pathname,
    wordpressLink[1]
  );
  assert.doesNotMatch(tripDetail, /fanbus-anmeldung\.html/);
  assert.match(tripDetail, /\?trip=\$\{escapeAttr\(trip\.id\)\}/);
  assert.match(renderTrip, /add_query_arg\('trip', \$trip\['tripId'\], \$portal_url\)/);
  assert.match(renderTrip, /href="<\?php echo esc_url\(\$deep_link\); \?>"/);
  assert.match(
    initialize,
    /new URLSearchParams\(window\.location\.search\)\.get\("trip"\) \|\| ""/
  );
  assert.match(initialize, /if \(!UUID_PATTERN\.test\(tripId\)\)/);
  assert.match(initialize, /trip = await loadTrip\(tripId\)/);
});

test("M310 canonical navigation keeps the existing service-worker safety contract", async () => {
  const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
  const fetchHandler = sourceBlock(
    worker,
    'self.addEventListener("fetch", event => {',
    "function routeWithNotification"
  );
  const pushContract = worker.slice(worker.indexOf("function routeWithNotification"));

  assert.match(
    fetchHandler,
    /if \(request\.mode === "navigate"\) \{[\s\S]*?event\.respondWith\(fetch\(request, \{ cache: "no-store" \}\)\.then\(response => response\.ok \? response : offlineDocument\(\)\)\.catch\(offlineDocument\)\);[\s\S]*?return;/
  );
  assert.match(
    worker,
    /async function offlineDocument\(\) \{[\s\S]*?caches\.match\("\.\/offline\.html", \{ ignoreSearch: true \}\)/
  );
  assert.doesNotMatch(fetchHandler, /fanbus-anmeldung/);
  assert.match(pushContract, /self\.addEventListener\("push"/);
  assert.match(pushContract, /self\.addEventListener\("notificationclick"/);
  assert.match(pushContract, /client\.navigate\(targetUrl\)/);
  assert.match(pushContract, /self\.clients\.openWindow\(targetUrl\)/);
});

test("M310 WordPress presentation is portal-scoped, readable and mobile-safe", async () => {
  const pluginRoot = resolve(
    root,
    "wordpress",
    "plugins",
    "plaerrdeifl-m310-fanbus"
  );
  const [plugin, style] = await Promise.all([
    readFile(resolve(pluginRoot, "plaerrdeifl-m310-fanbus.php"), "utf8"),
    readFile(resolve(pluginRoot, "assets", "m310-fanbus.css"), "utf8")
  ]);

  assert.match(plugin, /^ \* Version: 1\.0\.4$/m);
  assert.match(plugin, /private const VERSION = '1\.0\.4'/);
  assert.match(style, /\.pd-m310-fanbus\s*\{[\s\S]+color:\s*var\(--pd-m310-ink\)/);
  assert.match(style, /\.pd-m310-fanbus \.pd-m310-title\s*\{[\s\S]+color:\s*var\(--pd-m310-ink\)[\s\S]+white-space:\s*normal/);
  assert.match(style, /\.pd-m310-fanbus \.pd-m310-meta-item dd\s*\{[\s\S]+color:\s*var\(--pd-m310-ink\)/);
  assert.doesNotMatch(style, /pd-m310-departure-info/);
  assert.doesNotMatch(plugin, /<strong>Abfahrtsinfo<\/strong>/);
  assert.doesNotMatch(
    plugin,
    /Freie Plätze|remainingCapacity|activeRegistrationCount/
  );

  const wordpressPublicTripRender = sourceBlock(
    plugin,
    "private static function render_trip",
    "private static function status_presentation"
  );

  assert.doesNotMatch(
    wordpressPublicTripRender,
    /departureInfo|Freie Plätze|remainingCapacity|activeRegistrationCount/
  );
  assert.match(plugin, /<details class="pd-m310-trip">/);
  assert.match(plugin, /private static function registration_window_text/);
  assert.match(plugin, /'Anmeldeschluss: '/);
  assert.match(plugin, /'Anmeldung ansehen'/);
  assert.match(plugin, /<summary class="pd-m310-summary">/);
  assert.match(plugin, /class="pd-m310-chevron"/);
  assert.match(
    style,
    /\.pd-m310-fanbus \.pd-m310-grid\s*\{[\s\S]+grid-template-columns:\s*1fr/
  );

  assert.match(style, /\.pd-m310-fanbus \.pd-m310-status-open\s*\{[\s\S]+background:\s*#e7f8ef[\s\S]+color:\s*#0f6940/);
  assert.match(style, /\.pd-m310-fanbus \.pd-m310-link:visited[\s\S]+background:\s*var\(--pd-m310-blue\)[\s\S]+color:\s*#ffffff/);
  assert.match(style, /@media \(max-width: 36rem\)[\s\S]+overflow-x:\s*hidden[\s\S]+\.pd-m310-fanbus \.pd-m310-link\s*\{[\s\S]+width:\s*100%/);
  assert.match(style, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(style, /@media \(max-width: 36rem\)[\s\S]+\.pd-m310-fanbus \.pd-m310-meta\s*\{[\s\S]+grid-template-columns:\s*1fr/);
  assert.doesNotMatch(style, /(?:^|})\s*(?:html|body|a|button|h[1-6]|p|dl|dt|dd|\*)\s*(?:,|\{)/m);

  assert.match(plugin, /private const RPC_PATH = '\/rest\/v1\/rpc\/pd_public_fanbus_trips'/);
  assert.match(
    plugin,
    /private const STOPS_RPC_PATH = '\/rest\/v1\/rpc\/pd_public_fanbus_trip_boarding_stops'/
  );
  assert.equal(
    (plugin.match(/\/rest\/v1\/rpc\/[a-z0-9_]+/g) || []).length,
    2
  );
  assert.match(plugin, /private static function load_public_trip_stops/);
  assert.match(plugin, /private static function validated_stop/);
  assert.match(
    plugin,
    /Die Zustiegsorte können aktuell nicht geladen werden\./
  );
  assert.match(plugin, /'OPEN' => array\('label' => 'Offen', 'class' => 'pd-m310-status-open'\)/);
  assert.match(plugin, /add_query_arg\('trip', \$trip\['tripId'\], \$portal_url\)/);
});

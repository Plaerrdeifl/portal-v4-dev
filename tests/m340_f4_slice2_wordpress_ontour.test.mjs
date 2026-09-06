import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const pluginRoot = path.join(
  root,
  "wordpress",
  "plugins",
  "plaerrdeifl-m310-fanbus"
);
const [plugin, style, client, pluginDirectories] = await Promise.all([
  readFile(path.join(pluginRoot, "plaerrdeifl-m310-fanbus.php"), "utf8"),
  readFile(path.join(pluginRoot, "assets", "m310-fanbus.css"), "utf8"),
  readFile(path.join(pluginRoot, "assets", "m340-ontour.js"), "utf8"),
  readdir(path.join(root, "wordpress", "plugins"), { withFileTypes: true })
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Start marker missing: ${start}`);
  assert.notEqual(to, -1, `End marker missing: ${end}`);
  return source.slice(from, to);
}

function phpPayloadKeys(source) {
  return [...source.matchAll(/^\s*'([^']+)'\s*=>/gm)].map(match => match[1]);
}

test("Slice 2 extends only the existing M310 WordPress plugin at version 1.1.0", () => {
  const m340Plugins = pluginDirectories
    .filter(entry => entry.isDirectory() && /m340/i.test(entry.name))
    .map(entry => entry.name);
  assert.deepEqual(m340Plugins, []);
  assert.match(plugin, /^ \* Version: 1\.1\.0$/m);
  assert.match(plugin, /private const VERSION = '1\.1\.0'/);
  assert.match(
    plugin,
    /add_shortcode\('plaerrdeifl_fanbusfahrten', array\(self::class, 'render_shortcode'\)\)/
  );
});

test("OnTour routing is lifecycle-based, subdirectory-safe and limited to the frozen slug", () => {
  const routing = section(
    plugin,
    "public static function route_ontour_request()",
    "private static function requested_ontour_slug()"
  );
  const requestPath = section(
    plugin,
    "private static function requested_ontour_slug()",
    "private static function valid_ontour_slug("
  );
  const slugValidation = section(
    plugin,
    "private static function valid_ontour_slug(",
    "private static function disable_ontour_cache()"
  );

  assert.match(
    plugin,
    /add_action\(\s*'template_redirect',\s*array\(self::class, 'route_ontour_request'\),\s*0\s*\)/
  );
  assert.doesNotMatch(plugin, /add_rewrite_rule|flush_rewrite_rules|flush_rewrite_rules_hard/);
  assert.match(requestPath, /wp_parse_url\([\s\S]*\$_SERVER\['REQUEST_URI'\][\s\S]*PHP_URL_PATH/);
  assert.match(requestPath, /wp_parse_url\(home_url\('\/'\), PHP_URL_PATH\)/);
  assert.match(requestPath, /\^\/ontour\/\(\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\)\/\?\$/);
  assert.match(slugValidation, /strlen\(\$value\) >= 1/);
  assert.match(slugValidation, /strlen\(\$value\) <= 48/);
  assert.match(plugin, /ONTOUR_SLUG_PATTERN = '\/\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$\/D'/);
  assert.match(routing, /disable_ontour_cache\(\)/);
  assert.match(routing, /status_header\(200\)/);
});

test("resolver RPC receives only p_slug and enforces the complete response contract", () => {
  const resolver = section(
    plugin,
    "private static function load_ontour_resolution(",
    "private static function validated_ontour_resolution("
  );
  const resolverPayload = section(
    resolver,
    "$body = wp_json_encode(array(",
    "));"
  );
  const validation = section(
    plugin,
    "private static function validated_ontour_resolution(",
    "private static function send_ontour_referral("
  );

  assert.match(
    plugin,
    /ONTOUR_RESOLVER_RPC_PATH\s*=\s*'\/rest\/v1\/rpc\/pd_public_fanbus_ontour_resolve'/
  );
  assert.deepEqual(phpPayloadKeys(resolverPayload), ["p_slug"]);
  for (const mode of ["SINGLE", "MULTIPLE", "FALLBACK"]) {
    assert.match(validation, new RegExp(`'${mode}'`));
  }
  assert.match(validation, /\$value\['place'\]\['slug'\] !== \$requested_slug/);
  assert.match(validation, /validated_trip\(\$raw_trip\)/);
  assert.match(validation, /array\('OPEN', 'WAITLIST'\)/);
  assert.match(validation, /\$trip_count !== 1/);
  assert.match(validation, /\$trip_count < 2/);
  assert.match(validation, /\$trip_count !== 0/);
  assert.doesNotMatch(validation, /https?:\/\//);
});

test("SINGLE tracks best effort and always uses the configured direct 302 target", () => {
  const routing = section(
    plugin,
    "public static function route_ontour_request()",
    "private static function requested_ontour_slug()"
  );
  const referral = section(
    plugin,
    "private static function send_ontour_referral(",
    "private static function portal_trip_url("
  );
  const target = section(
    plugin,
    "private static function portal_trip_url(",
    "private static function render_ontour_page("
  );

  assert.match(routing, /\$resolution\['mode'\] === 'SINGLE'/);
  assert.ok(
    routing.indexOf("send_ontour_referral(") < routing.indexOf("wp_redirect(")
  );
  assert.match(routing, /send_ontour_referral\([\s\S]*false[\s\S]*\);/);
  assert.match(routing, /wp_redirect\(\$target, 302,/);
  assert.doesNotMatch(routing, /\b301\b/);
  assert.match(target, /add_query_arg\('trip', \$trip_id, \$portal_url\)/);
  assert.match(referral, /'blocking' => \$blocking/);
  assert.match(referral, /catch \(Throwable\)/);
  assert.doesNotMatch(routing, /if\s*\([^)]*send_ontour_referral/);
});

test("MULTIPLE renders direct links in resolver order without another resolver request", () => {
  const page = section(
    plugin,
    "private static function render_ontour_page(",
    "private static function render_ontour_multiple("
  );
  const multiple = section(
    plugin,
    "private static function render_ontour_multiple(",
    "public static function render_shortcode()"
  );

  assert.match(page, /get_header\(\)/);
  assert.match(page, /<main/);
  assert.match(page, /get_footer\(\)/);
  assert.match(multiple, /foreach \(\$trips as \$trip\)/);
  assert.match(multiple, /Fanbusfahrten nach/);
  assert.match(multiple, /format_event_date\(\$trip\['eventDate'\]\)/);
  assert.match(multiple, /format_event_time\(\$trip\['eventTime'\]\)/);
  assert.match(multiple, /\$trip\['displayTitle'\]/);
  assert.match(multiple, /format_price\(\$trip\['priceCents'\]\)/);
  assert.match(multiple, /format_timestamp\(\$trip\['registrationClosesAt'\]\)/);
  assert.match(multiple, /status_presentation\(\$trip\['registrationStatus'\]\)/);
  assert.match(multiple, /portal_trip_url\(\$portal_url, \$trip\['tripId'\]\)/);
  assert.match(multiple, /href="<\?php echo esc_url\(\$target\); \?>"/);
  assert.match(multiple, /data-pd-m340-referral/);
  assert.doesNotMatch(multiple, /load_ontour_resolution|route_ontour_request/);
  assert.doesNotMatch(client, /pd_public_fanbus_ontour_resolve|\/ontour\//);
});

test("MULTIPLE referral is fire-and-forget and never takes over navigation", () => {
  assert.doesNotMatch(client, /preventDefault\s*\(/);
  assert.match(client, /navigator\.sendBeacon\(config\.ajaxUrl, body\)/);
  assert.match(client, /window\.fetch\(config\.ajaxUrl,[\s\S]*method: "POST"/);
  assert.match(client, /keepalive: true/);
  assert.match(client, /credentials: "omit"/);
  assert.match(client, /\.catch\(function \(\) \{\}\)/);
  assert.doesNotMatch(client, /window\.location|location\.href|setTimeout|await\b/);
});

test("public AJAX accepts only slug and tripId and calls only the fixed referral RPC", () => {
  const handler = section(
    plugin,
    "public static function handle_ontour_referral_ajax()",
    "private static function load_ontour_resolution("
  );
  const referral = section(
    plugin,
    "private static function send_ontour_referral(",
    "private static function portal_trip_url("
  );
  const referralPayload = section(
    referral,
    "$body = wp_json_encode(array(",
    "));"
  );

  assert.match(plugin, /ONTOUR_AJAX_ACTION = 'pd_m340_track_referral'/);
  assert.match(plugin, /'wp_ajax_' \. self::ONTOUR_AJAX_ACTION/);
  assert.match(plugin, /'wp_ajax_nopriv_' \. self::ONTOUR_AJAX_ACTION/);
  assert.match(handler, /\$allowed_keys = array\('action', 'slug', 'tripId'\)/);
  assert.match(handler, /valid_ontour_slug\(\$slug\)/);
  assert.match(handler, /valid_uuid\(\$trip_id\)/);
  assert.match(handler, /send_ontour_referral\(\$config, \$slug, \$trip_id, true\)/);
  assert.match(
    plugin,
    /ONTOUR_REFERRAL_RPC_PATH\s*=\s*'\/rest\/v1\/rpc\/pd_public_fanbus_trip_referral_track'/
  );
  assert.deepEqual(phpPayloadKeys(referralPayload), ["p_slug", "p_trip_id"]);

  const trackingSources = `${handler}\n${referral}\n${client}`;
  assert.doesNotMatch(
    trackingSources,
    /REMOTE_ADDR|HTTP_USER_AGENT|\$_COOKIE|localStorage|sessionStorage|deviceId|fingerprint/i
  );
});

test("FALLBACK reuses the M310 overview inside the active theme", () => {
  const page = section(
    plugin,
    "private static function render_ontour_page(",
    "private static function render_ontour_multiple("
  );
  assert.match(page, /get_header\(\)/);
  assert.match(page, /<main/);
  assert.match(page, /self::render_shortcode\(\)/);
  assert.match(page, /get_footer\(\)/);
  assert.doesNotMatch(page, /wp_redirect|load_public_trips\(/);
});

test("OnTour requests are non-cacheable and never use permanent redirects", () => {
  const cache = section(
    plugin,
    "private static function disable_ontour_cache()",
    "public static function handle_ontour_referral_ajax()"
  );
  const routing = section(
    plugin,
    "public static function route_ontour_request()",
    "private static function requested_ontour_slug()"
  );
  assert.match(cache, /defined\('DONOTCACHEPAGE'\)/);
  assert.match(cache, /define\('DONOTCACHEPAGE', true\)/);
  assert.match(cache, /nocache_headers\(\)/);
  assert.doesNotMatch(routing, /\b301\b/);
});

test("M340 adds no secret, open redirect or direct Supabase table boundary", () => {
  const defaults = section(
    plugin,
    "private static function default_settings()",
    "private static function settings()"
  );
  const m340Methods = section(
    plugin,
    "private static function enqueue_ontour_assets()",
    "public static function render_shortcode()"
  );
  assert.deepEqual(phpPayloadKeys(defaults), [
    "supabase_url",
    "publishable_key",
    "portal_registration_url"
  ]);
  assert.doesNotMatch(m340Methods, /service.?role|authorization['"]?\s*=>|secret/i);
  assert.doesNotMatch(m340Methods, /\/rest\/v1\/(?!rpc\/)|fanbus_publishing_(?:places|place_keys|event_places|place_landing_daily|trip_referral_daily)/);
  assert.doesNotMatch(m340Methods, /\$_GET|redirect_to|return_url|target_url/);
  assert.match(m340Methods, /portal_trip_url\(\$portal_url, \$trip\['tripId'\]\)/);
  assert.match(m340Methods, /esc_html/);
  assert.match(m340Methods, /esc_attr/);
  assert.match(m340Methods, /esc_url/);
  assert.match(style, /\.pd-m340-ontour/);
});

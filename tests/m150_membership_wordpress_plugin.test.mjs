import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(
  repositoryRoot,
  'wordpress',
  'plugins',
  'plaerrdeifl-m150-membership',
);
const pluginPath = path.join(pluginRoot, 'plaerrdeifl-m150-membership.php');
const publicScriptPath = path.join(pluginRoot, 'assets', 'm150-membership.js');
const adminScriptPath = path.join(pluginRoot, 'assets', 'm150-membership-admin.js');
const stylesheetPath = path.join(pluginRoot, 'assets', 'm150-membership.css');
const documentationPath = path.join(
  repositoryRoot,
  'docs',
  'M150_R1_F1_5A_WORDPRESS_PUBLIC_FORM.md',
);

const [pluginSource, publicScript, adminScript, stylesheet, documentation] =
  await Promise.all([
    readFile(pluginPath, 'utf8'),
    readFile(publicScriptPath, 'utf8'),
    readFile(adminScriptPath, 'utf8'),
    readFile(stylesheetPath, 'utf8'),
    readFile(documentationPath, 'utf8'),
  ]);

function sourceSection(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Start marker missing: ${start}`);
  assert.notEqual(endIndex, -1, `End marker missing: ${end}`);
  return source.slice(startIndex, endIndex);
}

function quotedKeys(source) {
  return [...source.matchAll(/^\s*'([^']+)'\s*=>/gm)].map((match) => match[1]);
}

test('F1.5A consists of the exact plugin structure and the two contract artifacts', async () => {
  const pluginFiles = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await collect(entryPath);
      } else {
        pluginFiles.push(path.relative(pluginRoot, entryPath).replaceAll('\\', '/'));
      }
    }
  }
  await collect(pluginRoot);

  assert.deepEqual(pluginFiles.sort(), [
    'assets/m150-membership-admin.js',
    'assets/m150-membership.css',
    'assets/m150-membership.js',
    'plaerrdeifl-m150-membership.php',
  ]);
  assert.match(pluginSource, /Requires PHP:\s*8\.3/);
  assert.match(pluginSource, /add_shortcode\(\s*'plaerrdeifl_mitglied_werden'/);
  assert.match(documentation, /M150-R1 \/ F1\.5A/);
  assert.doesNotMatch(pluginSource, /vendor\/autoload|require_once\s*\([^)]*vendor|node_modules/i);
});

test('admin uses one exact, secret-free settings option and WordPress media', () => {
  const defaults = sourceSection(
    pluginSource,
    'private static function default_settings()',
    'private static function settings()',
  );
  assert.deepEqual(quotedKeys(defaults), [
    'privacy_page_id',
    'statutes_attachment_id',
    'minor_form_attachment_id',
    'declaration_version',
    'statutes_version',
    'statutes_reference',
  ]);
  assert.match(pluginSource, /OPTION_NAME\s*=\s*'plaerrdeifl_m150_settings'/);
  assert.match(pluginSource, /add_options_page\([\s\S]*?'manage_options'/);
  assert.match(pluginSource, /current_user_can\(\s*'manage_options'\s*\)/);
  assert.match(pluginSource, /check_admin_referer\(/);
  assert.match(pluginSource, /register_setting\(/);
  assert.match(pluginSource, /wp_enqueue_media\(\)/);
  assert.match(pluginSource, /m150-membership-admin\.js/);
  assert.match(adminScript, /window\.wp\.media\(/);
  assert.match(adminScript, /library:\s*\{type:\s*'application\/pdf'\}/);
  assert.match(adminScript, /input\.value\s*=\s*String\(attachment\.id\)/);
  assert.match(adminScript, /input\.value\s*=\s*'0'/);
  assert.doesNotMatch(defaults, /secret|edge|url|firstName|lastName|birthDate|email|phone/i);
});

test('documents are validated by ID and URLs are resolved dynamically', () => {
  assert.match(pluginSource, /absint\(\$value\)/);
  assert.match(pluginSource, /get_post_mime_type\(\$attachment_id\)\s*!==\s*'application\/pdf'/);
  assert.match(pluginSource, /\$attachment->post_type\s*!==\s*'attachment'/);
  assert.match(pluginSource, /wp_get_attachment_url\(\$attachment_id\)/);
  assert.match(pluginSource, /\$page->post_type\s*!==\s*'page'/);
  assert.match(pluginSource, /\$page->post_status\s*!==\s*'publish'/);
  assert.match(pluginSource, /get_permalink\(\$page_id\)/);
  assert.match(pluginSource, /data-pd-m150-media-id/);
  assert.doesNotMatch(
    sourceSection(pluginSource, 'private static function default_settings()', 'private static function settings()'),
    /_url|https?:\/\//i,
  );
});

test('public form contains only the specified fields and separate confirmations', () => {
  const allowedInput = sourceSection(
    pluginSource,
    '$allowed_keys = array(',
    '$required_keys = array(',
  );
  assert.deepEqual(
    [...allowedInput.matchAll(/^\s*'([^']+)',?$/gm)].map((match) => match[1]),
    [
      'firstName',
      'lastName',
      'birthDate',
      'email',
      'phone',
      'street',
      'houseNumber',
      'postalCode',
      'city',
      'applicantMessage',
      'declarationConfirmed',
      'statutesConfirmed',
      'cf-turnstile-response',
    ],
  );
  assert.match(pluginSource, /name="declarationConfirmed"[\s\S]*?required/);
  assert.match(pluginSource, /name="statutesConfirmed"[\s\S]*?required/);
  assert.doesNotMatch(pluginSource, /name="privacyConfirmed"/);
  assert.match(pluginSource, /privacy_url[\s\S]*?Datenschutzhinweise/);
  assert.match(pluginSource, /statutes_url[\s\S]*?Satzung als PDF/);
  assert.match(pluginSource, /minor_url[\s\S]*?Papierantrag/);
  assert.doesNotMatch(allowedInput, /Version|Reference|attachment|url/i);
});

test('versions are sanitized settings and are authoritative in the Edge payload', () => {
  assert.match(pluginSource, /sanitize_text_field\(wp_unslash\(\$value\)\)/);
  assert.match(pluginSource, /text_slice\(\$clean,\s*\$maxlength\)/);
  const edgePayload = sourceSection(
    pluginSource,
    '$edge_payload = array(',
    '$raw_json = wp_json_encode(',
  );
  assert.deepEqual(quotedKeys(edgePayload), [
    'firstName',
    'lastName',
    'birthDate',
    'email',
    'phone',
    'street',
    'houseNumber',
    'postalCode',
    'city',
    'applicantMessage',
    'declarationConfirmed',
    'declarationVersion',
    'statutesConfirmed',
    'statutesVersion',
    'statutesReference',
  ]);
  assert.match(edgePayload, /declarationVersion'\s*=>\s*\$config\['settings'\]\['declaration_version'\]/);
  assert.match(edgePayload, /statutesVersion'\s*=>\s*\$config\['settings'\]\['statutes_version'\]/);
  assert.match(edgePayload, /statutesReference'\s*=>\s*\$config\['settings'\]\['statutes_reference'\]/);
});

test('REST is POST-only and performs authoritative validation and the 18+ gate', () => {
  assert.match(pluginSource, /REST_NAMESPACE\s*=\s*'plaerrdeifl\/v1'/);
  assert.match(pluginSource, /REST_ROUTE\s*=\s*'\/m150-membership-application'/);
  assert.match(pluginSource, /'methods'\s*=>\s*WP_REST_Server::CREATABLE/);
  assert.match(pluginSource, /get_method\(\)\s*!==\s*'POST'/);
  assert.match(pluginSource, /array_diff\(array_keys\(\$input\),\s*\$allowed_keys\)/);
  assert.match(pluginSource, /is_email\(\$clean\['email'\]\)/);
  assert.match(pluginSource, /DateTimeZone\(\s*'Europe\/Berlin'\s*\)/);
  assert.match(pluginSource, /\$birth_date->modify\(\s*'\+18 years'\s*\)\s*>\s*\$today/);

  const underageGate = sourceSection(
    pluginSource,
    "if ($birth_date->modify('+18 years') > $today)",
    '$idempotency_key = wp_generate_uuid4()',
  );
  assert.doesNotMatch(underageGate, /send_edge_request|wp_remote_post|update_option|insert|save/i);
  assert.match(underageGate, /minorFormUrl/);
});

test('Turnstile is explicit client-side and verified server-side without remoteip', () => {
  assert.match(pluginSource, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(publicScript, /window\.turnstile\.render\(/);
  assert.match(publicScript, /action:\s*'m150_membership_application'/);
  assert.match(publicScript, /'cf-turnstile-response'/);
  assert.match(publicScript, /window\.turnstile\.reset\(/);
  assert.match(pluginSource, /TURNSTILE_VERIFY_URL\s*=\s*'https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify'/);
  assert.match(pluginSource, /strlen\(\$turnstile_token\)\s*>\s*2048/);
  const verification = sourceSection(
    pluginSource,
    'private static function verify_turnstile(',
    'private static function send_edge_request(',
  );
  assert.match(verification, /for\s*\(\$attempt\s*=\s*0;\s*\$attempt\s*<\s*2;/);
  assert.match(verification, /'idempotency_key'\s*=>\s*\$idempotency_key/);
  assert.match(
    verification,
    /\(\$result\['success'\]\s*\?\?\s*null\)\s*!==\s*true/,
  );
  assert.match(verification, /TURNSTILE_ACTION,\s*\$result\['action'\]/);
  assert.match(verification, /wp_parse_url\(home_url\(\),\s*PHP_URL_HOST\)/);
  assert.match(verification, /hash_equals\(\$expected_hostname,\s*\$result\['hostname'\]\)/);
  assert.doesNotMatch(verification, /remoteip/i);
});

test('rate limiting stores only a salted source hash and a short-lived count', () => {
  const rateLimit = sourceSection(
    pluginSource,
    'private static function consume_rate_limit()',
    'private static function verify_turnstile(',
  );
  assert.match(pluginSource, /RATE_LIMIT_ATTEMPTS\s*=\s*6/);
  assert.match(pluginSource, /RATE_LIMIT_TTL\s*=\s*900/);
  assert.match(rateLimit, /\$_SERVER\['REMOTE_ADDR'\]/);
  assert.match(rateLimit, /hash_hmac\(\s*'sha256',\s*\$remote_address,\s*wp_salt\('nonce'\)\s*\)/);
  assert.match(rateLimit, /get_transient\(\$transient_key\)/);
  assert.match(rateLimit, /set_transient\(\$transient_key,\s*\$attempts\s*\+\s*1,\s*self::RATE_LIMIT_TTL\)/);
  assert.doesNotMatch(rateLimit, /HTTP_X_FORWARDED_FOR|firstName|lastName|birthDate|email|phone|street|message/i);
});

test('one raw JSON body is hashed, signed, and retried unchanged', () => {
  assert.equal((pluginSource.match(/wp_json_encode\s*\(/g) || []).length, 1);
  assert.match(pluginSource, /\$idempotency_key\s*=\s*wp_generate_uuid4\(\)/);
  assert.match(pluginSource, /\$body_hash\s*=\s*hash\(\s*'sha256',\s*\$raw_json\s*\)/);
  assert.match(pluginSource, /\$timestamp\s*=\s*\(string\)\s*time\(\)/);
  assert.match(pluginSource, /\$signature_base\s*=\s*\$timestamp\s*\.\s*"\\n"[\s\S]*?\.\s*\$idempotency_key\s*\.\s*"\\n"[\s\S]*?\.\s*\$body_hash/);
  assert.match(pluginSource, /hash_hmac\(\s*'sha256',\s*\$signature_base,/);
  const edgeRequest = sourceSection(
    pluginSource,
    'private static function send_edge_request(',
    'private static function digital_configuration()',
  );
  assert.match(edgeRequest, /for\s*\(\$attempt\s*=\s*0;\s*\$attempt\s*<\s*2;/);
  assert.match(edgeRequest, /'X-M150-Timestamp'\s*=>\s*\$timestamp/);
  assert.match(edgeRequest, /'X-M150-Idempotency-Key'\s*=>\s*\$idempotency_key/);
  assert.match(edgeRequest, /'X-M150-Signature'\s*=>\s*\$signature/);
  assert.match(edgeRequest, /'Content-Type'\s*=>\s*'application\/json'/);
  assert.match(edgeRequest, /'body'\s*=>\s*\$raw_json/);
});

test('configuration fails closed and keeps infrastructure secrets server-side', () => {
  for (const constantName of [
    'PD_M150_EDGE_URL',
    'PD_M150_INTAKE_HMAC_SECRET',
    'PD_M150_TURNSTILE_SITE_KEY',
    'PD_M150_TURNSTILE_SECRET_KEY',
  ]) {
    assert.match(pluginSource, new RegExp(`'${constantName}'`));
  }
  for (const removedName of [
    'PD_M150_PRIVACY_URL',
    'PD_M150_STATUTES_URL',
    'PD_M150_MINOR_FORM_URL',
    'PD_M150_DECLARATION_VERSION',
    'PD_M150_STATUTES_VERSION',
    'PD_M150_STATUTES_REFERENCE',
  ]) {
    assert.doesNotMatch(pluginSource, new RegExp(removedName));
  }
  assert.match(pluginSource, /strlen\(\$hmac_secret\)\s*<\s*32/);
  assert.match(pluginSource, /if\s*\(\$config\s*===\s*null\)[\s\S]*?technisch nicht verf/);
  assert.doesNotMatch(publicScript, /PD_M150_INTAKE_HMAC_SECRET|PD_M150_TURNSTILE_SECRET_KEY|PD_M150_EDGE_URL/);
  assert.doesNotMatch(pluginSource, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('browser talks only to WordPress and keeps no application data', () => {
  assert.match(publicScript, /fetch\(form\.dataset\.restUrl/);
  assert.match(publicScript, /method:\s*'POST'/);
  assert.match(publicScript, /JSON\.stringify\(payload\)/);
  assert.doesNotMatch(publicScript, /supabase|functions\/v1|service[_-]?role/i);
  assert.doesNotMatch(publicScript, /localStorage|sessionStorage|document\.cookie|indexedDB/i);
  assert.doesNotMatch(pluginSource, /register_post_type|update_post_meta|add_post_meta|update_user_meta|add_user_meta|CREATE TABLE/i);
  assert.doesNotMatch(pluginSource, /error_log|trigger_error|var_dump|print_r\s*\(/i);
  assert.doesNotMatch(publicScript, /console\.(?:log|info|warn|error)/);
});

test('public transport excludes Turnstile and exposes only neutral results', () => {
  const edgePayload = sourceSection(
    pluginSource,
    '$edge_payload = array(',
    '$raw_json = wp_json_encode(',
  );
  assert.doesNotMatch(edgePayload, /turnstile|token/i);
  assert.match(pluginSource, /\$edge_status\s*===\s*200[\s\S]*?\$edge_data\['ok'\][\s\S]*?===\s*true/);
  assert.match(pluginSource, /Dein Mitgliedsantrag wurde entgegengenommen\./);
  assert.doesNotMatch(pluginSource, /applicationId|memberExists|portalUserExists|SQLSTATE|PostgREST|M150_PUBLIC_/);
  assert.doesNotMatch(pluginSource, /app_fanclub|membership_applications|public\.pd_api|supabase/i);
});

test('CSS and documentation preserve the F1.5A boundaries', () => {
  const selectors = stylesheet
    .split('{')
    .slice(0, -1)
    .map((chunk) => chunk.slice(chunk.lastIndexOf('}') + 1).trim())
    .filter((selector) => selector && !selector.startsWith('@'));
  assert.ok(selectors.every((selector) => selector.includes('.pd-m150-')));
  assert.match(documentation, /keine dauerhafte WordPress-Antragsspeicherung/i);
  assert.match(documentation, /kein(?:en)? Service-Role-Key/i);
  assert.match(documentation, /sorgeberechtigten Person/i);
  assert.match(documentation, /Satzungs-PDF und Datenschutzseite/i);
  assert.match(documentation, /Erklärungsversion/i);
  assert.match(documentation, /Satzungsversion/i);
  assert.match(documentation, /Satzungsreferenz/i);
  assert.match(documentation, /keine rechtliche Aussage[\s\S]*Schriftform/i);
  assert.doesNotMatch(
    pluginSource,
    /\b(?:finance|sepa|payment|portal access)\b/i,
  );
});


test('M150 Turnstile browser failures are visible and token reads are fail-safe', () => {
  assert.match(
    pluginSource,
    /Version:\s*1\.0\.4/,
  );
  assert.match(
    pluginSource,
    /private const VERSION\s*=\s*'1\.0\.4'/,
  );

  assert.match(
    publicScript,
    /'response-field':\s*true/,
  );
  assert.match(
    publicScript,
    /'response-field-name':\s*'cf-turnstile-response'/,
  );

  assert.match(
    publicScript,
    /'error-callback':\s*function/,
  );
  assert.match(
    publicScript,
    /'expired-callback':\s*function/,
  );
  assert.match(
    publicScript,
    /'timeout-callback':\s*function/,
  );
  assert.match(
    publicScript,
    /'unsupported-callback':\s*function/,
  );

  assert.match(
    publicScript,
    /\[name="cf-turnstile-response"\]/,
  );

  assert.doesNotMatch(
    publicScript,
    /turnstile\.getResponse\s*\(/,
  );

  assert.match(
    publicScript,
    /Die Sicherheitsprüfung konnte nicht geladen werden/,
  );
  assert.match(
    publicScript,
    /Die Sicherheitsprüfung ist abgelaufen/,
  );
  assert.match(
    publicScript,
    /Die Sicherheitsprüfung hat zu lange gedauert/,
  );
  assert.match(
    publicScript,
    /nicht unterstützt/,
  );

  assert.match(
    publicScript,
    /try\s*\{[\s\S]*?window\.turnstile\.reset\(widgetId\)[\s\S]*?\}\s*catch/,
  );
});



test('M150 birth date UI is browser-independent and keeps one server value', () => {
  assert.match(
    pluginSource,
    /Version:\s*1\.0\.4/,
  );

  assert.match(
    pluginSource,
    /private const VERSION\s*=\s*'1\.0\.4'/,
  );

  assert.match(
    pluginSource,
    /render_public_birth_date\(\)/,
  );

  assert.doesNotMatch(
    pluginSource,
    /render_public_input\('birthDate'[\s\S]*?'date'/,
  );

  assert.match(
    pluginSource,
    /data-pd-m150-birth-day/,
  );

  assert.match(
    pluginSource,
    /data-pd-m150-birth-month/,
  );

  assert.match(
    pluginSource,
    /data-pd-m150-birth-year/,
  );

  assert.match(
    pluginSource,
    /type="hidden"[\s\S]*?name="birthDate"[\s\S]*?data-pd-m150-birth-date/,
  );

  assert.match(
    pluginSource,
    /<select[\s\S]*?data-pd-m150-birth-year[\s\S]*?required/,
  );

  assert.match(
    pluginSource,
    /\$current_year[\s\S]*?\$year\s*=\s*\$current_year[\s\S]*?\$year\s*>=\s*1900[\s\S]*?\$year--/,
  );

  assert.doesNotMatch(
    pluginSource,
    /data-pd-m150-birth-year[\s\S]*?inputmode="numeric"/,
  );

  assert.match(
    pluginSource,
    />Tag</,
  );

  assert.match(
    pluginSource,
    />Monat</,
  );

  assert.match(
    pluginSource,
    />Jahr</,
  );

  assert.match(
    pluginSource,
    /Januar[\s\S]*?Februar[\s\S]*?März[\s\S]*?Dezember/,
  );

  assert.match(
    publicScript,
    /const BIRTH_DATE_MIN_YEAR\s*=\s*1900/,
  );

  assert.match(
    publicScript,
    /timeZone:\s*'Europe\/Berlin'/,
  );

  assert.match(
    publicScript,
    /function birthDateElements\(/,
  );

  assert.match(
    publicScript,
    /\!\(year instanceof HTMLSelectElement\)/,
  );

  assert.match(
    publicScript,
    /function birthDateResult\(/,
  );

  assert.match(
    publicScript,
    /function validateBirthDate\(/,
  );

  assert.match(
    publicScript,
    /Date\.UTC\(/,
  );

  assert.match(
    publicScript,
    /result\.elements\.hidden\.value\s*=\s*result\.valid/,
  );

  assert.match(
    publicScript,
    /Bitte gib dein Geburtsdatum vollständig ein\./,
  );

  assert.match(
    publicScript,
    /Dieses Geburtsdatum ist ungültig\./,
  );

  assert.match(
    publicScript,
    /Das Geburtsdatum darf nicht in der Zukunft liegen\./,
  );

  assert.match(
    publicScript,
    /Bitte prüfe das angegebene Geburtsjahr\./,
  );

  assert.match(
    publicScript,
    /setAttribute\('aria-invalid', 'true'\)/,
  );

  assert.match(
    publicScript,
    /clearBirthDateNotice\(form\)/,
  );

  assert.match(
    publicScript,
    /validateBirthDate\(form, true, true\)/,
  );

  assert.doesNotMatch(
    publicScript,
    /birthDate\.min\s*=/,
  );

  assert.doesNotMatch(
    publicScript,
    /birthDate\.max\s*=/,
  );

  assert.match(
    stylesheet,
    /\.pd-m150-membership \.pd-m150-birthdate-inputs/,
  );

  assert.match(
    stylesheet,
    /\.pd-m150-membership \.pd-m150-birthdate-field[\s\S]*?grid-column:\s*1\s*\/\s*-1/,
  );

  assert.match(
    stylesheet,
    /grid-template-columns:\s*6rem 12rem 8rem/,
  );

  assert.match(
    stylesheet,
    /max-width:\s*27\.5rem/,
  );

  assert.match(
    stylesheet,
    /@media \(max-width:\s*42rem\)[\s\S]*?grid-template-columns:\s*0\.8fr 1\.4fr 1fr/,
  );

  assert.match(
    stylesheet,
    /\.pd-m150-membership \.pd-m150-field-error/,
  );
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const functionPath = "supabase/functions/m150-membership-email-dispatch/index.ts";
const configPath = "supabase/config.toml";
const documentationPath = "docs/M150_R1_F1_6B_EMAIL_DELIVERY.md";

const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");
const [functionSource, config, documentation] = await Promise.all([
  read(functionPath),
  read(configPath),
  read(documentationPath)
]);

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

test("F1.6B files and Edge Function configuration use the exact paths", () => {
  assert.match(functionSource, /Deno\.serve\(async request/);
  assert.match(documentation, /M150 R1 \/ F1\.6B/);
  assert.match(
    config,
    /\[functions\.m150-membership-email-dispatch\]\s+verify_jwt\s*=\s*false/
  );
});

test("dispatch is POST-only, has no CORS surface, and authenticates its own secret", () => {
  assert.match(functionSource, /request\.method !== "POST"/);
  assert.doesNotMatch(functionSource, /Access-Control-Allow|\bCORS\b|request\.method === "OPTIONS"/i);
  assert.match(functionSource, /X-M150-Mail-Dispatch-Secret/);
  assert.match(functionSource, /M150_MAIL_DISPATCH_SECRET/);
  assert.match(functionSource, /MIN_DISPATCH_SECRET_BYTES = 32/);
  assert.match(functionSource, /byteLength < MIN_DISPATCH_SECRET_BYTES/);
  assert.match(functionSource, /constantTimeSecretMatch/);
  assert.match(functionSource, /if \(!authenticated\) return errorResponse\(401\)/);
});

test("all runtime configuration is validated before the first claim", () => {
  const handler = sourceBlock(functionSource, "Deno.serve", "});\n");
  assert.ok(handler.indexOf("loadRuntimeConfig()") < handler.indexOf("claimNextEvent(config)"));
  for (const name of [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SERVICE_ROLE_KEY",
    "M150_SMTP_HOST",
    "M150_SMTP_PORT",
    "M150_SMTP_USER",
    "M150_SMTP_PASSWORD",
    "M150_EMAIL_FROM",
    "M150_EMAIL_REPLY_TO"
  ]) {
    assert.match(functionSource, new RegExp(name));
  }
  assert.ok(functionSource.includes("return /[\\r\\n]/.test(value);"));
  assert.doesNotMatch(functionSource, /console\./);
  assert.doesNotMatch(functionSource, /error\.message|error\.stack/);
});

test("delivery uses only the F1.6A claim and complete RPCs", () => {
  assert.match(functionSource, /\/rest\/v1\/rpc\/m150_membership_email_claim/);
  assert.match(functionSource, /\/rest\/v1\/rpc\/m150_membership_email_complete/);
  assert.match(functionSource, /p_outbox_id: claim\.outboxId/);
  assert.match(functionSource, /p_claim_token: claim\.claimToken/);
  assert.match(functionSource, /p_success: success/);
  assert.match(functionSource, /p_error_code: errorCode/);
  assert.doesNotMatch(
    functionSource,
    /membership_application_email_outbox|app_fanclub|membership_applications/
  );
});

test("batch is sequential, fixed at five events, and remains at most ten", () => {
  const batchLimitMatch = functionSource.match(/const BATCH_LIMIT = ([0-9]+);/);
  const batchBlock = sourceBlock(
    functionSource,
    "while (processed < BATCH_LIMIT)",
    "return jsonResponse(200"
  );
  assert.match(functionSource, /const BATCH_LIMIT = 5/);
  assert.ok(batchLimitMatch);
  assert.ok(Number(batchLimitMatch[1]) <= 10);
  assert.match(functionSource, /while \(processed < BATCH_LIMIT\)/);
  assert.doesNotMatch(
    functionSource,
    /request\.(?:json|text|formData)\(|new URL\(request\.url\)|searchParams/
  );
  assert.doesNotMatch(batchBlock, /Promise\.(?:all|allSettled)\(/);
  assert.ok(
    functionSource.indexOf("await completeEvent")
      < functionSource.indexOf("processed += 1")
  );
});

test("there are exactly three fixed M150 templates with text and HTML", () => {
  const templateBlock = sourceBlock(functionSource, "function buildEmail", "type Mailbox");
  assert.deepEqual(
    [...templateBlock.matchAll(/case "([A-Z]+)"/g)].map(match => match[1]),
    ["RECEIPT", "REJECTION", "ADMISSION"]
  );
  assert.equal((templateBlock.match(/subject:/g) || []).length, 3);
  assert.equal((templateBlock.match(/text:/g) || []).length, 3);
  assert.equal((templateBlock.match(/html:/g) || []).length, 3);
});

test("applicant notice is rejection-only and all HTML application text is escaped", () => {
  const receipt = sourceBlock(functionSource, 'case "RECEIPT"', 'case "REJECTION"');
  const rejection = sourceBlock(functionSource, 'case "REJECTION"', 'case "ADMISSION"');
  const admission = sourceBlock(functionSource, 'case "ADMISSION"', "type Mailbox");
  assert.doesNotMatch(receipt, /applicantNotice/);
  assert.match(rejection, /claim\.applicantNotice/);
  assert.match(rejection, /escapedHtmlWithBreaks\(applicantNotice\)/);
  assert.doesNotMatch(admission, /applicantNotice/);
  assert.match(functionSource, /escapeHtml\(claim\.firstName\)/);
  for (const escaped of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) {
    assert.match(functionSource, new RegExp(escaped.replace("&", "&")));
  }
  assert.doesNotMatch(
    functionSource,
    /decisionReasonInternal|decision_reason_internal|reasonInternal|reason_internal|votes?|boardRoster/i
  );
});

test("lima-city transport uses implicit TLS SMTP authentication and is time-bounded", () => {
  assert.match(
    functionSource,
    /Deno\.connectTls\(\{\s*hostname: config\.smtpHost,\s*port: config\.smtpPort\s*\}\)/
  );
  assert.doesNotMatch(functionSource, /Deno\.(?:connect|startTls)\(/);
  assert.match(functionSource, /session\.command\("AUTH LOGIN", \[334\]\)/);
  assert.match(functionSource, /base64Utf8\(config\.smtpUser\)/);
  assert.match(functionSource, /base64Utf8\(config\.smtpPassword\)/);
  assert.match(functionSource, /session\.command\("DATA", \[354\]\)/);
  assert.match(functionSource, /Reply-To: \$\{addressHeader\(replyTo\)\}/);
  assert.match(functionSource, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(functionSource, /Content-Type: text\/html; charset=UTF-8/);
  assert.doesNotMatch(functionSource, /RESEND|api\.resend\.com/i);
  assert.match(functionSource, /sha256Hex\(claim\.outboxId\)/);
  assert.match(functionSource, /Message-ID: <m150-\$\{outboxHash\}@\$\{sender\.domain\}>/);
  assert.doesNotMatch(functionSource, /crypto\.randomUUID|Math\.random|gen_random_uuid/);
  assert.match(functionSource, /const PROVIDER_TIMEOUT_MS = 15_000/);
  assert.match(functionSource, /connection\?\.close\(\)/);
});

test("only accepted SMTP delivery completes successfully and failures remain technical", () => {
  assert.match(functionSource, /await session\.data\(message\)/);
  assert.match(functionSource, /await this\.expect\(\[250\]\)/);
  assert.match(functionSource, /`PROVIDER_SMTP_\$\{code\}`/);
  assert.match(functionSource, /"PROVIDER_NETWORK"/);
  assert.match(functionSource, /"PROVIDER_TIMEOUT"/);
  assert.match(functionSource, /"PROVIDER_PROTOCOL"/);
  assert.match(functionSource, /completeEvent\(config, claim, true, null\)/);
  assert.match(functionSource, /completeEvent\(config, claim, false, providerErrorCode\)/);
  assert.doesNotMatch(functionSource, /console\.|error\.message|error\.stack/);
});

test("implementation contains no browser, WordPress, cron, or deployment integration", () => {
  assert.doesNotMatch(
    functionSource,
    /wp_mail|wordpress|php\s+mail|window\.|document\.|localStorage|serviceWorker|cron|schedule|deploy|production|prod\b/i
  );
});

test("documentation records operational boundaries and prerequisites", () => {
  for (const phrase of [
    "Supabase Edge Function",
    "F1.6A",
    "Claim",
    "Complete",
    "outboxId",
    "24 Stunden",
    "Restrisiko",
    "RECEIPT",
    "REJECTION",
    "ADMISSION",
    "Applicant Notice",
    "M150_MAIL_DISPATCH_SECRET",
    "keine PII",
    "kein WordPress-Mail",
    "kein Browser-Mail",
    "Finance",
    "SEPA",
    "Domain-Verifikation",
    "kein PROD"
  ]) {
    assert.match(documentation, new RegExp(phrase, "i"));
  }
  assert.match(documentation, /kein(?:e E-Mail erzeugt|en)?\s+Portalzugang/i);
  assert.match(documentation, /kein(?:en)?\s+Cron/i);
});

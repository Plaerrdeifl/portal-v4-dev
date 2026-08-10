const BATCH_LIMIT = 5;
const PROVIDER_TIMEOUT_MS = 15_000;
const MIN_DISPATCH_SECRET_BYTES = 32;
const MAX_EMAIL_HEADER_LENGTH = 320;
const MAX_API_KEY_LENGTH = 2048;

const DISPATCH_SECRET_HEADER = "X-M150-Mail-Dispatch-Secret";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const encoder = new TextEncoder();

type EmailType = "RECEIPT" | "REJECTION" | "ADMISSION";

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  resendApiKey: string;
  emailFrom: string;
  emailReplyTo?: string;
};

type ClaimedEvent = {
  outboxId: string;
  claimToken: string;
  emailType: EmailType;
  recipientEmail: string;
  firstName: string;
  applicantNotice?: string | null;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

class DispatchError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function errorResponse(status: number) {
  return jsonResponse(status, {
    ok: false,
    error: status === 401 ? "Unauthorized" : status === 405
      ? "Method not allowed"
      : "Internal error"
  });
}

function hasCrlf(value: string) {
  return /[\r\n]/.test(value);
}

function requiredEnvironmentValue(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new DispatchError("CONFIG_INVALID");
  return value;
}

function configuredSupabaseSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (rawSecretKeys) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSecretKeys);
    } catch {
      throw new DispatchError("CONFIG_INVALID");
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const keys = parsed as Record<string, unknown>;
      const preferred = [keys.default, keys.secret, keys.service_role];
      const candidate = [...preferred, ...Object.values(keys)]
        .find(value => typeof value === "string" && value.trim().length > 0);

      if (typeof candidate === "string") return candidate.trim();
    }

    throw new DispatchError("CONFIG_INVALID");
  }

  const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyServiceRoleKey) return legacyServiceRoleKey;

  throw new DispatchError("CONFIG_INVALID");
}

function validatedSupabaseUrl() {
  const rawUrl = requiredEnvironmentValue("SUPABASE_URL");
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new DispatchError("CONFIG_INVALID");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol)
    || parsedUrl.username
    || parsedUrl.password
    || parsedUrl.search
    || parsedUrl.hash
    || (parsedUrl.pathname !== "/" && parsedUrl.pathname !== "")
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }

  return parsedUrl.origin;
}

function validatedMailHeader(name: string, required: boolean) {
  const rawValue = Deno.env.get(name);
  if (rawValue === undefined || rawValue.trim() === "") {
    if (required) throw new DispatchError("CONFIG_INVALID");
    return undefined;
  }

  const value = rawValue.trim();
  if (value.length > MAX_EMAIL_HEADER_LENGTH || hasCrlf(value)) {
    throw new DispatchError("CONFIG_INVALID");
  }
  return value;
}

function loadRuntimeConfig(): RuntimeConfig {
  const resendApiKey = requiredEnvironmentValue("RESEND_API_KEY");
  if (resendApiKey.length > MAX_API_KEY_LENGTH || hasCrlf(resendApiKey)) {
    throw new DispatchError("CONFIG_INVALID");
  }
  const supabaseSecretKey = configuredSupabaseSecretKey();
  if (
    supabaseSecretKey.length > MAX_API_KEY_LENGTH
    || hasCrlf(supabaseSecretKey)
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }

  return {
    supabaseUrl: validatedSupabaseUrl(),
    supabaseSecretKey,
    resendApiKey,
    emailFrom: validatedMailHeader("M150_EMAIL_FROM", true) as string,
    emailReplyTo: validatedMailHeader("M150_EMAIL_REPLY_TO", false)
  };
}

async function constantTimeSecretMatch(expected: string, supplied: string) {
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied))
  ]);
  const expectedBytes = new Uint8Array(expectedDigest);
  const suppliedBytes = new Uint8Array(suppliedDigest);
  let difference = 0;

  for (let index = 0; index < expectedBytes.byteLength; index += 1) {
    difference |= expectedBytes[index] ^ suppliedBytes[index];
  }

  return difference === 0;
}

function rpcHeaders(secretKey: string) {
  return {
    apikey: secretKey,
    "Content-Type": "application/json"
  };
}

async function claimNextEvent(config: RuntimeConfig): Promise<ClaimedEvent | null> {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/m150_membership_email_claim`,
      {
        method: "POST",
        headers: rpcHeaders(config.supabaseSecretKey),
        body: "{}"
      }
    );
  } catch {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  const claim = payload as Record<string, unknown>;
  if (claim.claimed === false) return null;

  if (
    claim.claimed !== true
    || typeof claim.outboxId !== "string"
    || typeof claim.claimToken !== "string"
    || !isEmailType(claim.emailType)
    || typeof claim.recipientEmail !== "string"
    || claim.recipientEmail.length === 0
    || typeof claim.firstName !== "string"
    || claim.firstName.length === 0
    || (
      claim.emailType === "REJECTION"
      && claim.applicantNotice !== undefined
      && claim.applicantNotice !== null
      && typeof claim.applicantNotice !== "string"
    )
  ) {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  return {
    outboxId: claim.outboxId,
    claimToken: claim.claimToken,
    emailType: claim.emailType,
    recipientEmail: claim.recipientEmail,
    firstName: claim.firstName,
    applicantNotice: claim.emailType === "REJECTION"
      ? claim.applicantNotice as string | null | undefined
      : undefined
  };
}

function isEmailType(value: unknown): value is EmailType {
  return value === "RECEIPT" || value === "REJECTION" || value === "ADMISSION";
}

async function completeEvent(
  config: RuntimeConfig,
  claim: ClaimedEvent,
  success: boolean,
  errorCode: string | null
) {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/m150_membership_email_complete`,
      {
        method: "POST",
        headers: rpcHeaders(config.supabaseSecretKey),
        body: JSON.stringify({
          p_outbox_id: claim.outboxId,
          p_claim_token: claim.claimToken,
          p_success: success,
          p_error_code: errorCode
        })
      }
    );
  } catch {
    throw new DispatchError("COMPLETE_RPC_FAILED");
  }

  await response.body?.cancel();
  if (!response.ok) throw new DispatchError("COMPLETE_RPC_FAILED");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapedHtmlWithBreaks(value: string) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

function buildEmail(claim: ClaimedEvent): EmailContent {
  const greetingText = `Servus ${claim.firstName},`;
  const greetingHtml = `<p>Servus ${escapeHtml(claim.firstName)},</p>`;
  const closingText = "Viele Grüße\nDeine Plärrdeifl";
  const closingHtml = "<p>Viele Grüße<br>Deine Plärrdeifl</p>";

  switch (claim.emailType) {
    case "RECEIPT":
      return {
        subject: "Dein Mitgliedsantrag bei den Plärrdeifl ist eingegangen",
        text: `${greetingText}\n\nwir haben deinen Mitgliedsantrag bei den Plärrdeifl erhalten.\n\nDer Vorstand prüft deinen Antrag. Sobald es Neuigkeiten gibt, melden wir uns bei dir.\n\n${closingText}`,
        html: `${greetingHtml}<p>Wir haben deinen Mitgliedsantrag bei den Plärrdeifl erhalten.</p><p>Der Vorstand prüft deinen Antrag. Sobald es Neuigkeiten gibt, melden wir uns bei dir.</p>${closingHtml}`
      };

    case "REJECTION": {
      const applicantNotice = claim.applicantNotice?.trim();
      const noticeText = applicantNotice
        ? `\n\nZusätzliche Mitteilung:\n${applicantNotice}`
        : "";
      const noticeHtml = applicantNotice
        ? `<p><strong>Zusätzliche Mitteilung:</strong><br>${escapedHtmlWithBreaks(applicantNotice)}</p>`
        : "";

      return {
        subject: "Dein Mitgliedsantrag bei den Plärrdeifl",
        text: `${greetingText}\n\ndein Mitgliedsantrag bei den Plärrdeifl wurde nicht angenommen.${noticeText}\n\n${closingText}`,
        html: `${greetingHtml}<p>Dein Mitgliedsantrag bei den Plärrdeifl wurde nicht angenommen.</p>${noticeHtml}${closingHtml}`
      };
    }

    case "ADMISSION":
      return {
        subject: "Willkommen bei den Plärrdeifl",
        text: `${greetingText}\n\nder Aufnahmeprozess wurde erfolgreich abgeschlossen. Herzlich willkommen im Fanclub der Plärrdeifl!\n\n${closingText}`,
        html: `${greetingHtml}<p>Der Aufnahmeprozess wurde erfolgreich abgeschlossen. Herzlich willkommen im Fanclub der Plärrdeifl!</p>${closingHtml}`
      };
  }

  throw new DispatchError("CLAIM_RPC_FAILED");
}

async function sendWithResend(
  config: RuntimeConfig,
  claim: ClaimedEvent,
  email: EmailContent
): Promise<string | null> {
  const body: Record<string, unknown> = {
    from: config.emailFrom,
    to: [claim.recipientEmail],
    subject: email.subject,
    text: email.text,
    html: email.html
  };
  if (config.emailReplyTo) body.reply_to = config.emailReplyTo;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": claim.outboxId
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch {
    return "PROVIDER_NETWORK";
  } finally {
    clearTimeout(timeout);
  }

  await response.body?.cancel();
  if (response.status >= 200 && response.status < 300) return null;
  return `PROVIDER_HTTP_${response.status}`;
}

Deno.serve(async request => {
  if (request.method !== "POST") return errorResponse(405);

  const configuredDispatchSecret = Deno.env.get("M150_MAIL_DISPATCH_SECRET");
  if (
    !configuredDispatchSecret
    || encoder.encode(configuredDispatchSecret).byteLength < MIN_DISPATCH_SECRET_BYTES
  ) {
    return errorResponse(500);
  }

  const suppliedDispatchSecret = request.headers.get(DISPATCH_SECRET_HEADER) || "";
  let authenticated = false;
  try {
    authenticated = await constantTimeSecretMatch(
      configuredDispatchSecret,
      suppliedDispatchSecret
    );
  } catch {
    return errorResponse(500);
  }

  if (!authenticated) return errorResponse(401);

  try {
    const config = loadRuntimeConfig();
    let processed = 0;
    let sent = 0;
    let failed = 0;

    while (processed < BATCH_LIMIT) {
      const claim = await claimNextEvent(config);
      if (!claim) break;

      const email = buildEmail(claim);
      const providerErrorCode = await sendWithResend(config, claim, email);

      if (providerErrorCode === null) {
        await completeEvent(config, claim, true, null);
        sent += 1;
      } else {
        await completeEvent(config, claim, false, providerErrorCode);
        failed += 1;
      }
      processed += 1;
    }

    return jsonResponse(200, { ok: true, processed, sent, failed });
  } catch {
    return errorResponse(500);
  }
});

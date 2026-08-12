const BATCH_LIMIT = 5;
const PROVIDER_TIMEOUT_MS = 15_000;
const MIN_DISPATCH_SECRET_BYTES = 32;
const MAX_EMAIL_HEADER_LENGTH = 320;
const MAX_SECRET_LENGTH = 2048;
const MAX_SMTP_RESPONSE_BYTES = 64 * 1024;

const DISPATCH_SECRET_HEADER = "X-M150-Mail-Dispatch-Secret";

const encoder = new TextEncoder();

type EmailType = "RECEIPT" | "REJECTION" | "ADMISSION";

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
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

class SmtpProviderError extends Error {
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

function validatedSmtpHost() {
  const host = requiredEnvironmentValue("M150_SMTP_HOST");
  if (
    host.length > 253
    || !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(host)
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }
  return host.toLowerCase();
}

function validatedSmtpPort() {
  const rawPort = requiredEnvironmentValue("M150_SMTP_PORT");
  if (!/^[0-9]{1,5}$/.test(rawPort)) {
    throw new DispatchError("CONFIG_INVALID");
  }

  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new DispatchError("CONFIG_INVALID");
  }
  return port;
}

function validatedSecret(name: string) {
  const value = Deno.env.get(name);
  if (value === undefined || value.length === 0 || value.length > MAX_SECRET_LENGTH) {
    throw new DispatchError("CONFIG_INVALID");
  }
  return value;
}

function loadRuntimeConfig(): RuntimeConfig {
  const supabaseSecretKey = configuredSupabaseSecretKey();
  if (
    supabaseSecretKey.length > MAX_SECRET_LENGTH
    || hasCrlf(supabaseSecretKey)
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }
  const emailFrom = validatedMailHeader("M150_EMAIL_FROM", true) as string;
  const emailReplyTo = validatedMailHeader("M150_EMAIL_REPLY_TO", false);
  if (
    !parseMailbox(emailFrom, true)
    || (emailReplyTo && !parseMailbox(emailReplyTo, true))
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }

  return {
    supabaseUrl: validatedSupabaseUrl(),
    supabaseSecretKey,
    smtpHost: validatedSmtpHost(),
    smtpPort: validatedSmtpPort(),
    smtpUser: validatedSecret("M150_SMTP_USER"),
    smtpPassword: validatedSecret("M150_SMTP_PASSWORD"),
    emailFrom,
    emailReplyTo
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

type Mailbox = {
  address: string;
  domain: string;
  displayName?: string;
};

function parseMailbox(value: string, allowDisplayName: boolean): Mailbox | null {
  let address = value.trim();
  let displayName: string | undefined;

  if (allowDisplayName && address.endsWith(">")) {
    const match = address.match(/^(.*)<([^<>]+)>$/);
    if (!match) return null;
    displayName = match[1].trim().replace(/^"(.*)"$/, "$1").trim();
    address = match[2].trim();
  }

  if (
    address.length > 254
    || !/^[\x21-\x7e]+$/.test(address)
    || /[<>()[\]:;,\\"]/.test(address)
  ) {
    return null;
  }

  const separator = address.lastIndexOf("@");
  if (
    separator <= 0
    || separator !== address.indexOf("@")
    || separator === address.length - 1
  ) {
    return null;
  }

  const domain = address.slice(separator + 1);
  if (
    !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(domain)
  ) {
    return null;
  }

  return { address, domain: domain.toLowerCase(), displayName };
}

function base64Utf8(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeHeaderText(value: string) {
  const chunks: string[] = [];
  let current = "";

  for (const character of value) {
    if (current && encoder.encode(current + character).byteLength > 42) {
      chunks.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current) chunks.push(current);

  return chunks
    .map(chunk => `=?UTF-8?B?${base64Utf8(chunk)}?=`)
    .join("\r\n ");
}

function addressHeader(mailbox: Mailbox) {
  if (!mailbox.displayName) return mailbox.address;
  return `${encodeHeaderText(mailbox.displayName)} <${mailbox.address}>`;
}

function mimeBase64(value: string) {
  return base64Utf8(value).match(/.{1,76}/g)?.join("\r\n") || "";
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value))
  );
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function buildSmtpMessage(
  claim: ClaimedEvent,
  email: EmailContent,
  sender: Mailbox,
  recipient: Mailbox,
  replyTo?: Mailbox
) {
  const outboxHash = await sha256Hex(claim.outboxId);
  const boundary = `m150-${outboxHash.slice(0, 32)}`;
  const headers = [
    `From: ${addressHeader(sender)}`,
    `To: ${recipient.address}`,
    `Subject: ${encodeHeaderText(email.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <m150-${outboxHash}@${sender.domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  if (replyTo) headers.splice(2, 0, `Reply-To: ${addressHeader(replyTo)}`);

  return [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(email.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(email.html),
    `--${boundary}--`
  ].join("\r\n");
}

class SmtpSession {
  private buffer = "";
  private responseBytes = 0;
  private readonly decoder = new TextDecoder();

  constructor(private readonly connection: Deno.Conn) {}

  private async write(value: string) {
    const bytes = encoder.encode(value);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = await this.connection.write(bytes.subarray(offset));
      if (written <= 0) throw new SmtpProviderError("PROVIDER_PROTOCOL");
      offset += written;
    }
  }

  async writeLine(value: string) {
    await this.write(`${value}\r\n`);
  }

  private async readLine() {
    while (!this.buffer.includes("\n")) {
      const chunk = new Uint8Array(4096);
      const read = await this.connection.read(chunk);
      if (read === null) throw new SmtpProviderError("PROVIDER_PROTOCOL");
      this.responseBytes += read;
      if (this.responseBytes > MAX_SMTP_RESPONSE_BYTES) {
        throw new SmtpProviderError("PROVIDER_PROTOCOL");
      }
      this.buffer += this.decoder.decode(chunk.subarray(0, read), { stream: true });
    }

    const end = this.buffer.indexOf("\n");
    const line = this.buffer.slice(0, end).replace(/\r$/, "");
    this.buffer = this.buffer.slice(end + 1);
    return line;
  }

  private async readReply() {
    let replyCode: number | undefined;

    for (let lineCount = 0; lineCount < 100; lineCount += 1) {
      const line = await this.readLine();
      const match = line.match(/^([0-9]{3})([ -])/);
      if (!match) throw new SmtpProviderError("PROVIDER_PROTOCOL");

      const code = Number(match[1]);
      if (replyCode === undefined) replyCode = code;
      if (code !== replyCode) throw new SmtpProviderError("PROVIDER_PROTOCOL");
      if (match[2] === " ") return code;
    }

    throw new SmtpProviderError("PROVIDER_PROTOCOL");
  }

  async expect(expectedCodes: number[]) {
    this.responseBytes = 0;
    const code = await this.readReply();
    if (!expectedCodes.includes(code)) {
      throw new SmtpProviderError(`PROVIDER_SMTP_${code}`);
    }
  }

  async command(value: string, expectedCodes: number[]) {
    await this.writeLine(value);
    await this.expect(expectedCodes);
  }

  async data(message: string) {
    const dotStuffed = message.replace(/(^|\r\n)\./g, "$1..");
    await this.write(`${dotStuffed}\r\n.\r\n`);
    await this.expect([250]);
  }
}

async function sendWithSmtp(
  config: RuntimeConfig,
  claim: ClaimedEvent,
  email: EmailContent
): Promise<string | null> {
  let connection: Deno.Conn | undefined;
  let timedOut = false;
  let timeoutId: number | undefined;

  const delivery = async () => {
    const sender = parseMailbox(config.emailFrom, true);
    const recipient = parseMailbox(claim.recipientEmail, false);
    const replyTo = config.emailReplyTo
      ? parseMailbox(config.emailReplyTo, true)
      : undefined;
    if (!sender || !recipient || (config.emailReplyTo && !replyTo)) {
      throw new SmtpProviderError("PROVIDER_ADDRESS_INVALID");
    }

    const message = await buildSmtpMessage(
      claim,
      email,
      sender,
      recipient,
      replyTo
    );
    const establishedConnection = await Deno.connectTls({
      hostname: config.smtpHost,
      port: config.smtpPort
    });
    if (timedOut) {
      establishedConnection.close();
      throw new SmtpProviderError("PROVIDER_TIMEOUT");
    }
    connection = establishedConnection;

    const session = new SmtpSession(connection);
    await session.expect([220]);
    await session.command(`EHLO ${sender.domain}`, [250]);
    await session.command("AUTH LOGIN", [334]);
    await session.command(base64Utf8(config.smtpUser), [334]);
    await session.command(base64Utf8(config.smtpPassword), [235]);
    await session.command(`MAIL FROM:<${sender.address}>`, [250]);
    await session.command(`RCPT TO:<${recipient.address}>`, [250, 251]);
    await session.command("DATA", [354]);
    await session.data(message);
  };

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        connection?.close();
      } catch {
        // The provider result remains a controlled timeout if the socket is closed.
      }
      reject(new SmtpProviderError("PROVIDER_TIMEOUT"));
    }, PROVIDER_TIMEOUT_MS);
  });

  try {
    await Promise.race([delivery(), timeout]);
    return null;
  } catch (error) {
    if (error instanceof SmtpProviderError) return error.code;
    return timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK";
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    try {
      connection?.close();
    } catch {
      // The SMTP transaction has already been classified above.
    }
  }
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
      const providerErrorCode = await sendWithSmtp(config, claim, email);

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

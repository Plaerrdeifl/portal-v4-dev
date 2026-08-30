import webpush from "npm:web-push@3.6.7";

const encoder = new TextEncoder();
const DISPATCH_SECRET_HEADER = "x-m020-notification-dispatch-secret";
const MIN_DISPATCH_SECRET_BYTES = 32;
const MAX_SECRET_LENGTH = 8192;
const MAX_EMAIL_HEADER_LENGTH = 998;
const MAX_SMTP_RESPONSE_BYTES = 256 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;
const BATCH_LIMIT = 5;
const FANBUS_CONTACT_EMAIL = "fanbus@plaerrdeifl.de";
const FANBUS_WHATSAPP_USERNAME = "@plaerrdeifl";
const FANBUS_WHATSAPP_URL = "https://wa.me/plaerrdeifl";
const FANBUS_LUCA_PHONE = "0174 6681046";
const FANBUS_PASCAL_PHONE = "0172 9744908";

type Channel = "EMAIL" | "PUSH";

type Claim = {
  outboxId: string;
  claimToken: string;
  eventId: string;
  notificationType: string;
  category: string;
  channel: Channel;
  recipientAddress: string | null;
  push: {
    subscriptionId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  } | null;
  payload: Record<string, unknown>;
  deepLink: string;
  attemptCount: number;
  maxAttempts: number;
  badgeCount: number;
};

type RuntimeConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
  emailReplyTo?: string;
  portalBaseUrl?: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
};

type DeliveryResult = {
  success: boolean;
  retryable: boolean;
  errorCode?: string;
  providerMessageId?: string;
  retryAfterSeconds?: number;
  disablePushSubscription?: boolean;
};

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

type Mailbox = {
  address: string;
  domain: string;
  displayName?: string;
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
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function errorResponse(status: number) {
  return jsonResponse(status, { ok: false });
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

function validatedPortalBaseUrl() {
  const raw = Deno.env.get("M020_PORTAL_BASE_URL")?.trim();
  if (!raw) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new DispatchError("CONFIG_INVALID");
  }

  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new DispatchError("CONFIG_INVALID");
  }

  return parsed.toString().replace(/\/$/, "");
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
  if (!/^[0-9]{1,5}$/.test(rawPort)) throw new DispatchError("CONFIG_INVALID");
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
  if (supabaseSecretKey.length > MAX_SECRET_LENGTH || hasCrlf(supabaseSecretKey)) {
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

  const vapidSubject = requiredEnvironmentValue("VAPID_SUBJECT");
  if (
    hasCrlf(vapidSubject)
    || (!vapidSubject.startsWith("mailto:") && !vapidSubject.startsWith("https://"))
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
    emailReplyTo,
    portalBaseUrl: validatedPortalBaseUrl(),
    vapidPublicKey: validatedSecret("VAPID_PUBLIC_KEY"),
    vapidPrivateKey: validatedSecret("VAPID_PRIVATE_KEY"),
    vapidSubject
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

async function claimBatch(config: RuntimeConfig): Promise<Claim[]> {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/pd_notification_claim_batch`,
      {
        method: "POST",
        headers: rpcHeaders(config.supabaseSecretKey),
        body: JSON.stringify({ p_limit: BATCH_LIMIT })
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

  if (!Array.isArray(payload)) throw new DispatchError("CLAIM_RPC_FAILED");

  return payload.map(validateClaim);
}

function validateClaim(value: unknown): Claim {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  const claim = value as Record<string, unknown>;
  if (
    typeof claim.outboxId !== "string"
    || typeof claim.claimToken !== "string"
    || typeof claim.eventId !== "string"
    || typeof claim.notificationType !== "string"
    || typeof claim.category !== "string"
    || (claim.channel !== "EMAIL" && claim.channel !== "PUSH")
    || !claim.payload
    || typeof claim.payload !== "object"
    || Array.isArray(claim.payload)
    || typeof claim.deepLink !== "string"
    || typeof claim.attemptCount !== "number"
    || typeof claim.maxAttempts !== "number"
    || typeof claim.badgeCount !== "number"
  ) {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  if (
    claim.channel === "EMAIL"
    && (typeof claim.recipientAddress !== "string" || !parseMailbox(claim.recipientAddress, false))
  ) {
    throw new DispatchError("CLAIM_RPC_FAILED");
  }

  if (claim.channel === "PUSH") {
    const push = claim.push;
    if (!push || typeof push !== "object" || Array.isArray(push)) {
      throw new DispatchError("CLAIM_RPC_FAILED");
    }
    const p = push as Record<string, unknown>;
    if (
      typeof p.subscriptionId !== "string"
      || typeof p.endpoint !== "string"
      || !p.endpoint.startsWith("https://")
      || typeof p.p256dh !== "string"
      || !p.p256dh
      || typeof p.auth !== "string"
      || !p.auth
    ) {
      throw new DispatchError("CLAIM_RPC_FAILED");
    }
  }

  return claim as unknown as Claim;
}

async function completeDelivery(
  config: RuntimeConfig,
  claim: Claim,
  result: DeliveryResult
) {
  let response: Response;
  try {
    response = await fetch(
      `${config.supabaseUrl}/rest/v1/rpc/pd_notification_complete`,
      {
        method: "POST",
        headers: rpcHeaders(config.supabaseSecretKey),
        body: JSON.stringify({
          p_payload: {
            outboxId: claim.outboxId,
            claimToken: claim.claimToken,
            success: result.success,
            retryable: result.retryable,
            errorCode: result.errorCode || "",
            providerMessageId: result.providerMessageId || "",
            retryAfterSeconds: result.retryAfterSeconds ?? null,
            disablePushSubscription: result.disablePushSubscription === true
          }
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

function asString(value: unknown, max = 2000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function templateData(claim: Claim) {
  const raw = claim.payload.data;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
}

function absolutePortalLink(config: RuntimeConfig, deepLink: string) {
  if (!config.portalBaseUrl || !deepLink.startsWith("#/")) return "";
  return `${config.portalBaseUrl}/${deepLink}`;
}

function emailShell(textBody: string, htmlBody: string, link: string): EmailContent {
  const linkText = link ? `\n\nIm Portal öffnen: ${link}` : "";
  const linkHtml = link
    ? `<p><a href="${escapeHtml(link)}">Im Portal öffnen</a></p>`
    : "";
  return {
    subject: "",
    text: `${textBody}${linkText}`,
    html: `${htmlBody}${linkHtml}`
  };
}

function fanbusBookingContext(data: Record<string, unknown>) {
  const bookingNumber = asString(data.bookingNumber, 40).trim();
  if (!/^(?:FB|DEV)-[0-9]{2}-[0-9]{6,}$/.test(bookingNumber)) return null;

  return {
    text: `\n\nBuchungsnummer: ${bookingNumber}\nBitte gib diese Buchungsnummer bei Rückfragen mit an.\n\nFragen zu deiner Buchung?\nE-Mail: ${FANBUS_CONTACT_EMAIL}\nWhatsApp: ${FANBUS_WHATSAPP_USERNAME}\nLuca: ${FANBUS_LUCA_PHONE}\nPascal: ${FANBUS_PASCAL_PHONE}\nOder melde dich direkt bei Luca oder Pascal.`,
    html: `<section><p><strong>Buchungsnummer:</strong> ${escapeHtml(bookingNumber)}<br><small>Bitte gib diese Buchungsnummer bei Rückfragen mit an.</small></p><p><strong>Fragen zu deiner Buchung?</strong><br>E-Mail: <a href="mailto:${FANBUS_CONTACT_EMAIL}">${FANBUS_CONTACT_EMAIL}</a><br>WhatsApp: <a href="${FANBUS_WHATSAPP_URL}">${FANBUS_WHATSAPP_USERNAME}</a><br>Luca: <a href="tel:+491746681046">${FANBUS_LUCA_PHONE}</a><br>Pascal: <a href="tel:+491729744908">${FANBUS_PASCAL_PHONE}</a><br>Oder melde dich direkt bei Luca oder Pascal.</p></section>`
  };
}

function withFanbusBookingContext(claim: Claim, email: EmailContent): EmailContent {
  const key = asString(claim.payload.templateKey, 120);
  if (!key.startsWith("fanbus.")) return email;

  const context = fanbusBookingContext(templateData(claim));
  if (!context) return email;

  const legacyContactText = /\n\nDu möchtest deine Anmeldung ändern oder stornieren\? Bitte wende dich an unsere BUS_ORGA\.(?:\n[^\n]+)*(?=\n\nViele Grüße)/;
  const legacyContactHtml = /<section><p><strong>Du möchtest deine Anmeldung ändern oder stornieren\?<\/strong><br>Bitte wende dich an unsere BUS_ORGA\.<\/p>(?:<ul>[\s\S]*?<\/ul>)?<\/section>/;
  let text = email.text.replace(legacyContactText, "");
  let html = email.html.replace(legacyContactHtml, "");

  const textClosing = "\n\nViele Grüße\nDeine Plärrdeifl";
  const htmlClosing = "<p>Viele Grüße<br>Deine Plärrdeifl</p>";
  const textLink = "\n\nIm Portal öffnen:";
  const htmlLink = '<p><a href="';

  if (text.includes(textClosing)) {
    text = text.replace(textClosing, `${context.text}${textClosing}`);
  } else if (text.includes(textLink)) {
    text = text.replace(textLink, `${context.text}${textLink}`);
  } else {
    text += context.text;
  }

  if (html.includes(htmlClosing)) {
    html = html.replace(htmlClosing, `${context.html}${htmlClosing}`);
  } else {
    const linkIndex = html.indexOf(htmlLink);
    html = linkIndex >= 0
      ? `${html.slice(0, linkIndex)}${context.html}${html.slice(linkIndex)}`
      : `${html}${context.html}`;
  }

  return { ...email, text, html };
}

function buildEmail(config: RuntimeConfig, claim: Claim): EmailContent {
  const key = asString(claim.payload.templateKey, 120);
  const data = templateData(claim);
  const firstName = asString(data.firstName, 120);
  const name = asString(data.name, 240) || firstName || "Mitglied";
  const affectedName = asString(data.affectedName, 240) || name;
  const projectedTripTitle = asString(data.tripTitle, 240).trim();
  if (key.startsWith("fanbus.") && (
    !projectedTripTitle || [
      "fanbusfahrt", "die fanbusfahrt", "der fanbusfahrt", "eine fanbusfahrt"
    ].includes(projectedTripTitle.toLowerCase())
  )) {
    throw new DispatchError("FANBUS_MAIL_LABEL_MISSING");
  }
  const tripTitle = projectedTripTitle || "der Fanbusfahrt";
  const applicantNotice = asString(data.applicantNotice, 2000).trim();
  const participantCount = Number(data.participantCount || 0);
  const organizationContact = data.organizationContact && typeof data.organizationContact === "object"
    ? data.organizationContact as Record<string, unknown>
    : {};
  const contactItems = (kind: "emails" | "phones") => (
    Array.isArray(organizationContact[kind]) ? organizationContact[kind] as unknown[] : []
  ).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const value = asString(record.value, kind === "emails" ? 320 : 40).trim();
    if (!value) return [];
    return [{ label: asString(record.label, 80).trim(), value }];
  });
  const publicContacts = [
    ...contactItems("emails").map(item => ({ ...item, type: "E-Mail" })),
    ...contactItems("phones").map(item => ({ ...item, type: "Telefon" }))
  ];
  const contactText = `\n\nDu möchtest deine Anmeldung ändern oder stornieren? Bitte wende dich an unsere BUS_ORGA.${publicContacts.length ? `\n${publicContacts.map(item => `${item.label || item.type}: ${item.value}`).join("\n")}` : ""}`;
  const contactHtml = `<section><p><strong>Du möchtest deine Anmeldung ändern oder stornieren?</strong><br>Bitte wende dich an unsere BUS_ORGA.</p>${publicContacts.length ? `<ul>${publicContacts.map(item => `<li>${escapeHtml(item.label || item.type)}: ${escapeHtml(item.value)}</li>`).join("")}</ul>` : ""}</section>`;
  const link = absolutePortalLink(config, claim.deepLink);
  const greetingText = firstName ? `Servus ${firstName},` : "Servus,";
  const greetingHtml = `<p>${escapeHtml(greetingText)}</p>`;
  const closingText = "Viele Grüße\nDeine Plärrdeifl";
  const closingHtml = "<p>Viele Grüße<br>Deine Plärrdeifl</p>";

  switch (key) {
    case "membership.receipt":
      return {
        subject: "Dein Mitgliedsantrag bei den Plärrdeifl ist eingegangen",
        text: `${greetingText}\n\nwir haben deinen Mitgliedsantrag bei den Plärrdeifl erhalten.\n\nDer Vorstand prüft deinen Antrag. Sobald es Neuigkeiten gibt, melden wir uns bei dir.\n\n${closingText}`,
        html: `${greetingHtml}<p>Wir haben deinen Mitgliedsantrag bei den Plärrdeifl erhalten.</p><p>Der Vorstand prüft deinen Antrag. Sobald es Neuigkeiten gibt, melden wir uns bei dir.</p>${closingHtml}`
      };

    case "membership.rejection": {
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

    case "membership.admission":
      return {
        subject: "Willkommen bei den Plärrdeifl",
        text: `${greetingText}\n\nder Aufnahmeprozess wurde erfolgreich abgeschlossen. Herzlich willkommen im Fanclub der Plärrdeifl!\n\n${closingText}`,
        html: `${greetingHtml}<p>Der Aufnahmeprozess wurde erfolgreich abgeschlossen. Herzlich willkommen im Fanclub der Plärrdeifl!</p>${closingHtml}`
      };

    case "membership.internal_new": {
      const base = emailShell(
        `Es liegt ein neuer Mitgliedsantrag von ${name} vor.`,
        `<p>Es liegt ein neuer Mitgliedsantrag von <strong>${escapeHtml(name)}</strong> vor.</p>`,
        link
      );
      return { ...base, subject: `Neuer Mitgliedsantrag – ${name}` };
    }

    case "access.internal_new": {
      const base = emailShell(
        `${name} bittet um Freischaltung für das Plärrdeifl-Portal.`,
        `<p><strong>${escapeHtml(name)}</strong> bittet um Freischaltung für das Plärrdeifl-Portal.</p>`,
        link
      );
      return { ...base, subject: `Neue Portal-Freischaltung – ${name}` };
    }

    case "access.approved":
      return {
        subject: "Dein Zugang zum Plärrdeifl-Portal wurde freigeschaltet",
        text: `${greetingText}\n\ndein Zugang zum Plärrdeifl-Portal wurde freigeschaltet. Du kannst dich jetzt anmelden.\n\n${closingText}`,
        html: `${greetingHtml}<p>Dein Zugang zum Plärrdeifl-Portal wurde freigeschaltet. Du kannst dich jetzt anmelden.</p>${closingHtml}`
      };

    case "access.rejected":
      return {
        subject: "Deine Anfrage für das Plärrdeifl-Portal",
        text: `${greetingText}\n\ndeine Anfrage für einen Portalzugang wurde abgelehnt.\n\n${closingText}`,
        html: `${greetingHtml}<p>Deine Anfrage für einen Portalzugang wurde abgelehnt.</p>${closingHtml}`
      };

    case "fanbus.booking.active":
    case "fanbus.booking.waitlisted": {
      const waitlist = key.endsWith("waitlisted");
      const stateText = waitlist
        ? "Deine Anmeldung wurde auf der Warteliste erfasst."
        : "Deine Anmeldung wurde bestätigt.";
      const base = emailShell(
        `${greetingText}\n\n${stateText}\nFahrt: ${tripTitle}${contactText}\n\n${closingText}`,
        `${greetingHtml}<p>${escapeHtml(stateText)}</p><p><strong>Fahrt:</strong> ${escapeHtml(tripTitle)}</p>${contactHtml}${closingHtml}`,
        link
      );
      return {
        ...base,
        subject: waitlist
          ? `Fanbus – Warteliste: ${tripTitle}`
          : `Fanbus – Anmeldung bestätigt: ${tripTitle}`
      };
    }

    case "fanbus.internal_new": {
      const countText = Number.isFinite(participantCount) && participantCount > 0
        ? `${participantCount} Person(en)`
        : "Eine neue Buchung";
      const base = emailShell(
        `${countText} für ${tripTitle} angemeldet. Buchungskontakt: ${name}.`,
        `<p><strong>${escapeHtml(countText)}</strong> für ${escapeHtml(tripTitle)} angemeldet.</p><p>Buchungskontakt: ${escapeHtml(name)}</p>`,
        link
      );
      return { ...base, subject: `Fanbus – neue Buchung: ${tripTitle}` };
    }

    case "fanbus.internal_extended": {
      const countText = Number.isFinite(participantCount) && participantCount > 0
        ? `${participantCount} Person(en)`
        : "Teilnehmer";
      const outcome = asString(data.status, 20) === "WAITLISTED"
        ? "Warteliste"
        : "aktive Teilnahme";
      const base = emailShell(
        `Eine bestehende Buchung für ${tripTitle} wurde um ${countText} erweitert. Ergebnis: ${outcome}.`,
        `<p>Eine bestehende Buchung für <strong>${escapeHtml(tripTitle)}</strong> wurde um <strong>${escapeHtml(countText)}</strong> erweitert.</p><p>Ergebnis: ${escapeHtml(outcome)}</p>`,
        link
      );
      return { ...base, subject: `Fanbus – Buchung erweitert: ${tripTitle}` };
    }

    case "fanbus.waitlist_promoted": {
      const personText = affectedName && affectedName !== name
        ? `Der Wartelistenplatz für ${affectedName} ist jetzt bestätigt.`
        : "Deine Anmeldung ist jetzt bestätigt.";
      const base = emailShell(
        `${greetingText}\n\nfür ${tripTitle} ist jetzt ein Platz frei. ${personText}\n\n${closingText}`,
        `${greetingHtml}<p>Für <strong>${escapeHtml(tripTitle)}</strong> ist jetzt ein Platz frei. ${escapeHtml(personText)}</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Platz frei: ${tripTitle}` };
    }

    case "fanbus.cancelled": {
      const personText = affectedName && affectedName !== name
        ? `Die Stornierung für ${affectedName} wurde erfasst.`
        : "Die Stornierung deiner Anmeldung wurde erfasst.";
      const base = emailShell(
        `${greetingText}\n\n${personText}\nFahrt: ${tripTitle}\n\n${closingText}`,
        `${greetingHtml}<p>${escapeHtml(personText)}</p><p><strong>Fahrt:</strong> ${escapeHtml(tripTitle)}</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Stornierung: ${tripTitle}` };
    }

    case "fanbus.trip_cancelled": {
      const cancellationReason = asString(data.cancellationReason, 240).trim();
      const eventDateRaw = asString(data.eventDate, 10);
      const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDateRaw)
        ? `${eventDateRaw.slice(8, 10)}.${eventDateRaw.slice(5, 7)}.${eventDateRaw.slice(0, 4)}`
        : eventDateRaw || "–";
      const bookingContext = "Deine Fanbusbuchung ist von dieser Absage betroffen.";
      const base = emailShell(
        `${greetingText}\n\nFahrt abgesagt\nFahrt: ${tripTitle}\nDatum: ${eventDate}\nGrund: ${cancellationReason}\n\n${bookingContext}\n\n${closingText}`,
        `${greetingHtml}<h2>Fahrt abgesagt</h2><p><strong>Fahrt:</strong> ${escapeHtml(tripTitle)}<br><strong>Datum:</strong> ${escapeHtml(eventDate)}<br><strong>Grund:</strong> ${escapeHtml(cancellationReason)}</p><p>${escapeHtml(bookingContext)}</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbusfahrt abgesagt – ${tripTitle}` };
    }

    case "fanbus.internal_cancelled": {
      const base = emailShell(
        `${affectedName} wurde bei ${tripTitle} storniert.`,
        `<p><strong>${escapeHtml(affectedName)}</strong> wurde bei ${escapeHtml(tripTitle)} storniert.</p>`,
        link
      );
      return { ...base, subject: `Fanbus – Stornierung: ${tripTitle}` };
    }

    case "fanbus.trip_price_changed": {
      const oldPriceCents = Number(data.oldPriceCents);
      const newPriceCents = Number(data.newPriceCents);
      const formatPrice = (value: number) =>
        Number.isFinite(value)
          ? `${(value / 100).toFixed(2).replace(".", ",")} €`
          : "–";
      const oldPrice = formatPrice(oldPriceCents);
      const newPrice = formatPrice(newPriceCents);
      const base = emailShell(
        `${greetingText}\n\nder Fahrtpreis für ${tripTitle} wurde von ${oldPrice} auf ${newPrice} geändert.\n\n${closingText}`,
        `${greetingHtml}<p>Der Fahrtpreis für <strong>${escapeHtml(tripTitle)}</strong> wurde von <strong>${escapeHtml(oldPrice)}</strong> auf <strong>${escapeHtml(newPrice)}</strong> geändert.</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Preis geändert: ${tripTitle}` };
    }

    case "fanbus.linked_event_changed": {
      const eventDateRaw = asString(data.eventDate, 10);
      const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDateRaw)
        ? `${eventDateRaw.slice(8, 10)}.${eventDateRaw.slice(5, 7)}.${eventDateRaw.slice(0, 4)}`
        : "";
      const dateText = eventDate ? `\nDatum: ${eventDate}` : "";
      const dateHtml = eventDate
        ? `<br><strong>Datum:</strong> ${escapeHtml(eventDate)}`
        : "";
      const base = emailShell(
        `${greetingText}\n\ndie Termin- oder Spieldaten für deine Fanbusfahrt wurden geändert.\nFahrt: ${tripTitle}${dateText}\nBitte prüfe die aktuellen Fahrtdaten.\n\n${closingText}`,
        `${greetingHtml}<p>Die Termin- oder Spieldaten für deine Fanbusfahrt wurden geändert.</p><p><strong>Fahrt:</strong> ${escapeHtml(tripTitle)}${dateHtml}</p><p>Bitte prüfe die aktuellen Fahrtdaten.</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Termin geändert: ${tripTitle}` };
    }

    case "fanbus.trip_departure_changed": {
      const base = emailShell(
        `${greetingText}\n\ndie Abfahrtszeit für ${tripTitle} wurde geändert. Bitte prüfe die aktuellen Fahrtdaten.\n\n${closingText}`,
        `${greetingHtml}<p>Die Abfahrtszeit für <strong>${escapeHtml(tripTitle)}</strong> wurde geändert. Bitte prüfe die aktuellen Fahrtdaten.</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Abfahrt geändert: ${tripTitle}` };
    }

    case "fanbus.boarding_time_changed": {
      const base = emailShell(
        `${greetingText}\n\ndie Zustiegszeit für ${tripTitle} wurde geändert. Bitte prüfe die aktuellen Fahrtdaten.\n\n${closingText}`,
        `${greetingHtml}<p>Die Zustiegszeit für <strong>${escapeHtml(tripTitle)}</strong> wurde geändert. Bitte prüfe die aktuellen Fahrtdaten.</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Zustiegszeit geändert: ${tripTitle}` };
    }

    case "fanbus.selected_boarding_stop_changed": {
      const personText = affectedName && affectedName !== name
        ? `Der hinterlegte Zustieg für ${affectedName} wurde geändert.`
        : "Dein hinterlegter Zustieg wurde geändert.";
      const base = emailShell(
        `${greetingText}\n\n${personText}\nFahrt: ${tripTitle}\nBitte prüfe die aktuellen Fahrtdaten.\n\n${closingText}`,
        `${greetingHtml}<p>${escapeHtml(personText)}</p><p><strong>Fahrt:</strong> ${escapeHtml(tripTitle)}</p><p>Bitte prüfe die aktuellen Fahrtdaten.</p>${closingHtml}`,
        link
      );
      return { ...base, subject: `Fanbus – Zustieg geändert: ${tripTitle}` };
    }

    case "task.generic": {
      const taskTitle = asString(data.taskTitle, 240) || "Aufgabe";
      const eventType = asString(data.eventType, 120);
      const base = emailShell(
        `Es gibt eine neue Meldung zur Aufgabe „${taskTitle}“.`,
        `<p>Es gibt eine neue Meldung zur Aufgabe <strong>${escapeHtml(taskTitle)}</strong>.</p>`,
        link
      );
      return {
        ...base,
        subject: eventType === "TASK_CREATED"
          ? `Neue Aufgabe – ${taskTitle}`
          : `Aufgabe aktualisiert – ${taskTitle}`
      };
    }

    default:
      throw new DispatchError("TEMPLATE_NOT_FOUND");
  }
}

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
  claim: Claim,
  email: EmailContent,
  sender: Mailbox,
  recipient: Mailbox,
  replyTo?: Mailbox
) {
  const outboxHash = await sha256Hex(claim.outboxId);
  const boundary = `m020-${outboxHash.slice(0, 32)}`;
  const headers = [
    `From: ${addressHeader(sender)}`,
    `To: ${recipient.address}`,
    `Subject: ${encodeHeaderText(email.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <m020-${outboxHash}@${sender.domain}>`,
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

function smtpErrorResult(code: string): DeliveryResult {
  const match = code.match(/^PROVIDER_SMTP_([0-9]{3})$/);
  if (match) {
    const smtpCode = Number(match[1]);
    return {
      success: false,
      retryable: smtpCode >= 400 && smtpCode < 500,
      errorCode: code
    };
  }

  return {
    success: false,
    retryable: ["PROVIDER_NETWORK", "PROVIDER_TIMEOUT", "PROVIDER_PROTOCOL"].includes(code),
    errorCode: code
  };
}

async function sendWithSmtp(
  config: RuntimeConfig,
  claim: Claim,
  email: EmailContent
): Promise<DeliveryResult> {
  let connection: Deno.Conn | undefined;
  let timedOut = false;
  let timeoutId: number | undefined;

  const delivery = async () => {
    const sender = parseMailbox(config.emailFrom, true);
    const recipient = claim.recipientAddress
      ? parseMailbox(claim.recipientAddress, false)
      : null;
    const replyTo = config.emailReplyTo
      ? parseMailbox(config.emailReplyTo, true)
      : undefined;

    if (!sender || !recipient || (config.emailReplyTo && !replyTo)) {
      throw new SmtpProviderError("PROVIDER_ADDRESS_INVALID");
    }

    const message = await buildSmtpMessage(claim, email, sender, recipient, replyTo);
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
        // classified as timeout below
      }
      reject(new SmtpProviderError("PROVIDER_TIMEOUT"));
    }, PROVIDER_TIMEOUT_MS);
  });

  try {
    await Promise.race([delivery(), timeout]);
    return { success: true, retryable: false };
  } catch (error) {
    if (error instanceof SmtpProviderError) return smtpErrorResult(error.code);
    return smtpErrorResult(timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_NETWORK");
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    try {
      connection?.close();
    } catch {
      // delivery outcome was already classified
    }
  }
}

function retryAfterSeconds(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const headers = (error as { headers?: unknown }).headers;
  if (!headers || typeof headers !== "object") return undefined;

  const raw = (headers as Record<string, unknown>)["retry-after"];
  if (typeof raw !== "string") return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds), 43_200)
    : undefined;
}

async function sendWithWebPush(
  config: RuntimeConfig,
  claim: Claim
): Promise<DeliveryResult> {
  if (!claim.push) {
    return { success: false, retryable: false, errorCode: "PUSH_SUBSCRIPTION_MISSING" };
  }

  const title = asString(claim.payload.title, 120) || "Plärrdeifl";
  const body = asString(claim.payload.body, 240);
  const payload = JSON.stringify({
    title,
    body,
    route: claim.deepLink || "#/dashboard",
    eventType: claim.notificationType,
    notificationId: claim.outboxId,
    badgeCount: Math.max(0, Math.trunc(claim.badgeCount || 0))
  });

  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );

  try {
    const response = await webpush.sendNotification(
      {
        endpoint: claim.push.endpoint,
        keys: {
          p256dh: claim.push.p256dh,
          auth: claim.push.auth
        }
      },
      payload,
      { TTL: 86_400, timeout: PROVIDER_TIMEOUT_MS }
    );

    return {
      success: true,
      retryable: false,
      providerMessageId: typeof response?.headers?.location === "string"
        ? response.headers.location.slice(0, 300)
        : undefined
    };
  } catch (error) {
    const statusCode = Number(
      (error as { statusCode?: unknown } | null)?.statusCode || 0
    );

    if (statusCode === 404 || statusCode === 410) {
      return {
        success: false,
        retryable: false,
        errorCode: `PUSH_HTTP_${statusCode}`,
        disablePushSubscription: true
      };
    }

    if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
      return {
        success: false,
        retryable: true,
        errorCode: statusCode ? `PUSH_HTTP_${statusCode}` : "PUSH_NETWORK",
        retryAfterSeconds: retryAfterSeconds(error)
      };
    }

    if (statusCode >= 400) {
      return {
        success: false,
        retryable: false,
        errorCode: `PUSH_HTTP_${statusCode}`
      };
    }

    return {
      success: false,
      retryable: true,
      errorCode: "PUSH_NETWORK"
    };
  }
}

async function deliver(config: RuntimeConfig, claim: Claim): Promise<DeliveryResult> {
  if (claim.channel === "EMAIL") {
    try {
      const email = withFanbusBookingContext(claim, buildEmail(config, claim));
      return await sendWithSmtp(config, claim, email);
    } catch (error) {
      if (error instanceof DispatchError) {
        return { success: false, retryable: false, errorCode: error.code };
      }
      return { success: false, retryable: false, errorCode: "TEMPLATE_INVALID" };
    }
  }

  return sendWithWebPush(config, claim);
}

Deno.serve(async request => {
  if (request.method !== "POST") return errorResponse(405);

  const configuredDispatchSecret = Deno.env.get("M020_NOTIFICATION_DISPATCH_SECRET");
  if (
    !configuredDispatchSecret
    || encoder.encode(configuredDispatchSecret).byteLength < MIN_DISPATCH_SECRET_BYTES
    || configuredDispatchSecret.length > MAX_SECRET_LENGTH
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
    const claims = await claimBatch(config);
    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const claim of claims) {
      const result = await deliver(config, claim);
      await completeDelivery(config, claim, result);

      if (result.success) sent += 1;
      else if (result.retryable) retried += 1;
      else failed += 1;
    }

    return jsonResponse(200, {
      ok: true,
      processed: claims.length,
      sent,
      retried,
      failed
    });
  } catch {
    return errorResponse(500);
  }
});

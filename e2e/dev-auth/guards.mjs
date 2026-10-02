import {
  DEV_FANBUS_URL,
  DEV_ORIGIN,
  DEV_PROJECT_REF,
  DEV_SUPABASE_ORIGIN,
  E2E_USER_ID,
  PROD_PROJECT_REF,
} from "./constants.mjs";

export class GuardError extends Error {
  constructor(code) {
    super(code);
    this.name = "GuardError";
    this.code = code;
  }
}

function fail(code) {
  throw new GuardError(code);
}

export function assertNoProdReference(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized.toLowerCase().includes(PROD_PROJECT_REF)) {
    fail("PROD_REF_FORBIDDEN");
  }
}

export function assertDevRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("INVALID_REQUEST");
  }
  assertNoProdReference(input);

  const allowedKeys = new Set([
    "action",
    "origin",
    "projectRef",
    "protocolVersion",
    "userId",
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    fail("UNEXPECTED_REQUEST_FIELD");
  }
  if (input.protocolVersion !== 1) fail("INVALID_PROTOCOL_VERSION");
  if (input.action !== "generate_magic_link") fail("INVALID_ACTION");
  if (input.projectRef !== DEV_PROJECT_REF) fail("DEV_PROJECT_REF_MISMATCH");
  if (input.origin !== DEV_ORIGIN) fail("DEV_ORIGIN_MISMATCH");
  if (input.userId !== E2E_USER_ID) fail("E2E_USER_NOT_ALLOWED");

  const origin = new URL(input.origin);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== DEV_ORIGIN ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    fail("DEV_ORIGIN_INVALID");
  }
  return input;
}

export function assertServiceCredential(value) {
  const credential = String(value ?? "").trim();
  assertNoProdReference(credential);
  if (!credential || credential.startsWith("sb_publishable_")) {
    fail("PRIVILEGED_CREDENTIAL_REQUIRED");
  }
  if (credential.startsWith("sb_secret_")) return credential;

  const parts = credential.split(".");
  if (parts.length !== 3) fail("PRIVILEGED_CREDENTIAL_REQUIRED");
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (payload?.role !== "service_role") fail("PRIVILEGED_CREDENTIAL_REQUIRED");
  } catch (error) {
    if (error instanceof GuardError) throw error;
    fail("PRIVILEGED_CREDENTIAL_REQUIRED");
  }
  return credential;
}

export function assertMagicLink(value) {
  assertNoProdReference(value);
  let link;
  try {
    link = new URL(value);
  } catch {
    fail("INVALID_MAGIC_LINK");
  }
  if (
    link.protocol !== "https:" ||
    link.origin !== DEV_SUPABASE_ORIGIN ||
    link.pathname !== "/auth/v1/verify" ||
    link.username ||
    link.password
  ) {
    fail("INVALID_MAGIC_LINK");
  }
  if (!link.searchParams.has("token") && !link.searchParams.has("token_hash")) {
    fail("INVALID_MAGIC_LINK");
  }
  const redirect = link.searchParams.get("redirect_to");
  if (redirect !== DEV_FANBUS_URL) fail("INVALID_MAGIC_LINK_REDIRECT");
  return link.toString();
}

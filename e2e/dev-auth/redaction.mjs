const SENSITIVE_PAIR =
  /([?&#]|\b)(access_token|refresh_token|token|token_hash|apikey|authorization)=([^\s&#]+)/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_KEY = /sb_secret_[A-Za-z0-9._-]+/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function redactSensitiveText(value, explicitSecrets = []) {
  let text = String(value ?? "");
  for (const secret of explicitSecrets) {
    if (secret) text = text.split(String(secret)).join("[REDACTED]");
  }
  return text
    .replace(SENSITIVE_PAIR, "$1$2=[REDACTED]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_KEY, "[REDACTED]")
    .replace(JWT, "[REDACTED]");
}

export function publicBrokerError(error) {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]{3,64}$/.test(error.code)
      ? error.code
      : "BROKER_REQUEST_FAILED";
  return { ok: false, error: { code } };
}

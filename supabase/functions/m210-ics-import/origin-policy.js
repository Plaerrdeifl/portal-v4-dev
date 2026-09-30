export const DEV_PROJECT_REF = "tpieykhhawszlzsoflnl";
export const DEV_CANONICAL_ORIGIN = "https://dev.plaerrdeifl.de";

function validOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const local = parsed.protocol === "http:"
      && ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if ((parsed.protocol !== "https:" && !local)
      || parsed.origin !== origin
      || parsed.pathname !== "/") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function projectRef(supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(parsed.hostname);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

export function resolveAllowedOrigins(supabaseUrl, rawOrigins) {
  if (projectRef(supabaseUrl) === DEV_PROJECT_REF) {
    return new Set([DEV_CANONICAL_ORIGIN]);
  }

  const raw = String(rawOrigins || "").trim();
  if (!raw) return null;

  const origins = raw.split(",").map(value => value.trim());
  if (!origins.length || origins.some(origin => !validOrigin(origin))) {
    return null;
  }
  return new Set(origins);
}

import { CONFIG } from "./config.js";

const MODES = new Set(["NORMAL", "READ_ONLY", "MAINTENANCE"]);
const RELEASE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const RELEASE_RUN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$/;
const RELEASE_ENVIRONMENT_PATTERN = /^[A-Z][A-Z0-9_-]{1,31}$/;

let state = Object.freeze({
  mode: "MAINTENANCE",
  message: "Der Plattformstatus konnte noch nicht sicher geprüft werden.",
  expectedEnd: null,
  revision: 0,
  available: false
});

function normalizeStatus(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !MODES.has(value.mode)
    || !Number.isInteger(value.revision)
    || value.revision < 1
    || !(value.message === null || value.message === undefined || typeof value.message === "string")
    || !(value.expectedEnd === null || value.expectedEnd === undefined || typeof value.expectedEnd === "string")
  ) {
    return null;
  }

  const expectedEnd = value.expectedEnd || null;
  if (expectedEnd && Number.isNaN(Date.parse(expectedEnd))) return null;

  return Object.freeze({
    mode: value.mode,
    message: String(value.message || "").trim() || null,
    expectedEnd,
    revision: value.revision,
    available: true
  });
}

function unavailableStatus() {
  return Object.freeze({
    mode: "MAINTENANCE",
    message: "Das Portal ist wegen einer technischen Prüfung vorübergehend nicht verfügbar.",
    expectedEnd: null,
    revision: 0,
    available: false
  });
}

export function platformMessage(code, fallback = "") {
  const messages = {
    PLATFORM_READ_ONLY: "Das Portal ist aktuell schreibgeschützt. Lesen ist weiterhin möglich.",
    PLATFORM_MAINTENANCE: "Das Portal befindet sich aktuell im Wartungsmodus.",
    PLATFORM_WRITE_UNAVAILABLE: "Schreibaktionen sind aktuell aus Sicherheitsgründen nicht verfügbar."
  };
  return messages[String(code || "")] || String(fallback || "Die Portalaktion ist fehlgeschlagen.");
}

export function formatExpectedEnd(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date);
}

export function releaseBypassHeaders() {
  const context = window.__PD_RELEASE_TEST_CONTEXT__;
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};

  const token = String(context.token || "").trim();
  const runId = String(context.runId || "").trim();
  const environment = String(context.environment || "").trim().toUpperCase();
  const configuredEnvironment = String(CONFIG.supabase.environment || "").trim().toUpperCase();

  if (
    !RELEASE_TOKEN_PATTERN.test(token)
    || !RELEASE_RUN_PATTERN.test(runId)
    || !RELEASE_ENVIRONMENT_PATTERN.test(environment)
    || environment !== configuredEnvironment
  ) {
    return {};
  }

  return {
    "X-PD-Release-Bypass": token,
    "X-PD-Release-Run": runId,
    "X-PD-Environment": environment
  };
}

export function hasReleaseTestContext() {
  return Object.keys(releaseBypassHeaders()).length === 3;
}

export const platformMode = Object.freeze({
  current() {
    return state;
  },

  async refresh() {
    if (!CONFIG.supabase.configured) {
      state = unavailableStatus();
      return state;
    }

    try {
      const response = await fetch(
        `${CONFIG.supabase.url.replace(/\/+$/, "")}/rest/v1/rpc/pd_public_platform_status`,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            apikey: CONFIG.supabase.publishableKey,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, max-age=0",
            Pragma: "no-cache"
          },
          body: "{}"
        }
      );
      if (!response.ok) throw new Error("PLATFORM_STATUS_UNAVAILABLE");
      const normalized = normalizeStatus(await response.json());
      if (!normalized) throw new Error("PLATFORM_STATUS_INVALID");
      state = normalized;
    } catch {
      state = unavailableStatus();
    }

    window.dispatchEvent(new CustomEvent("pd-platform-mode", { detail: state }));
    return state;
  },

  assertUserWriteAllowed() {
    if (state.mode === "NORMAL" && state.available) return;
    if (state.mode === "READ_ONLY" && state.available && hasReleaseTestContext()) return;
    const code = !state.available
      ? "PLATFORM_WRITE_UNAVAILABLE"
      : state.mode === "READ_ONLY"
        ? "PLATFORM_READ_ONLY"
        : "PLATFORM_MAINTENANCE";
    const error = new Error(platformMessage(code, state.message));
    error.code = code;
    throw error;
  }
});

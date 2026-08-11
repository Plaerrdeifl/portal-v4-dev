import { getSupabaseClient } from "./supabase-client.js";
import { CONFIG } from "./config.js";

let pendingRequests = 0;
let lastError = null;

export class ApiError extends Error {
  constructor(message, code = "PORTAL_API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

function emitActivity() {
  window.dispatchEvent(new CustomEvent("pd-api-state", {
    detail: {
      pending: pendingRequests,
      busy: pendingRequests > 0,
      error: lastError
    }
  }));
}

function unwrap(payload) {
  if (!payload || payload.ok !== true) {
    const error = payload?.error || {};
    throw new ApiError(
      error.message || "Die Portalaktion ist fehlgeschlagen.",
      error.code || "PORTAL_API_ERROR",
      error
    );
  }
  return payload.data;
}

export const api = Object.freeze({
  async call(action, payload = {}) {
    const client = getSupabaseClient();
    let transportFailure = false;

    pendingRequests += 1;
    lastError = null;
    emitActivity();

    try {
      let response;

      try {
        response = await client.rpc("pd_api", {
          p_action: String(action || ""),
          p_payload: payload || {}
        });
      } catch (error) {
        transportFailure = true;
        throw error;
      }

      const { data, error } = response;

      if (error) {
        transportFailure = true;
        throw new ApiError(
          error.message || "Supabase-Anfrage fehlgeschlagen.",
          error.code || "SUPABASE_RPC_ERROR",
          error
        );
      }

      return unwrap(data);
    } catch (error) {
      lastError = transportFailure ? error : null;
      throw error;
    } finally {
      pendingRequests = Math.max(0, pendingRequests - 1);
      emitActivity();
    }
  },

  async importIcs(action, file, sourceKey, previewFingerprint = "") {
    const client = getSupabaseClient();
    let transportFailure = false;
    pendingRequests += 1;
    lastError = null;
    emitActivity();

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (sessionError || !accessToken) {
        throw new ApiError("Anmeldung erforderlich.", "AUTH_REQUIRED", sessionError);
      }

      const form = new FormData();
      form.set("action", String(action || ""));
      form.set("sourceKey", String(sourceKey || ""));
      form.set("file", file);
      if (previewFingerprint) form.set("previewFingerprint", String(previewFingerprint));

      let response;
      try {
        response = await fetch(
          `${CONFIG.supabase.url.replace(/\/+$/, "")}/functions/v1/m210-ics-import`,
          {
            method: "POST",
            headers: {
              apikey: CONFIG.supabase.publishableKey,
              Authorization: `Bearer ${accessToken}`
            },
            body: form
          }
        );
      } catch (error) {
        transportFailure = true;
        throw error;
      }

      let result;
      try {
        result = await response.json();
      } catch {
        throw new ApiError("Der Importdienst hat ungültig geantwortet.", "INVALID_RESPONSE");
      }
      if (!response.ok || result?.ok !== true) {
        const error = result?.error || {};
        throw new ApiError(
          error.message || "Der Spielplanimport ist fehlgeschlagen.",
          error.code || `HTTP_${response.status}`,
          error
        );
      }
      return result.data;
    } catch (error) {
      lastError = transportFailure ? error : null;
      throw error;
    } finally {
      pendingRequests = Math.max(0, pendingRequests - 1);
      emitActivity();
    }
  },

  activity() {
    return {
      pending: pendingRequests,
      busy: pendingRequests > 0,
      error: lastError
    };
  }
});

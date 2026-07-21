import { getSupabaseClient } from "./supabase-client.js";

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

    pendingRequests += 1;
    lastError = null;
    emitActivity();

    try {
      const { data, error } = await client.rpc("pd_api", {
        p_action: String(action || ""),
        p_payload: payload || {}
      });

      if (error) {
        throw new ApiError(
          error.message || "Supabase-Anfrage fehlgeschlagen.",
          error.code || "SUPABASE_RPC_ERROR",
          error
        );
      }

      return unwrap(data);
    } catch (error) {
      lastError = error;
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

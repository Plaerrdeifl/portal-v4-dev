import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  if (!CONFIG.api.enabled || !CONFIG.api.baseUrl) {
    throw new ApiError("Die Apps-Script-API wird erst in Phase 2 verbunden.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONFIG.api.timeoutMs);
  const url = new URL(String(path || "").replace(/^\//, ""), CONFIG.api.baseUrl.endsWith("/") ? CONFIG.api.baseUrl : `${CONFIG.api.baseUrl}/`);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "omit",
      signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload && payload.ok === false)) {
      throw new ApiError(payload?.message || `API-Fehler ${response.status}`, response.status, payload);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new ApiError("Die API-Anfrage hat zu lange gedauert.");
    if (error instanceof ApiError) throw error;
    throw new ApiError(error?.message || "Netzwerkfehler");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function apiStatus() {
  return { enabled: CONFIG.api.enabled, configured: Boolean(CONFIG.api.baseUrl) };
}

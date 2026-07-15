import { CONFIG } from "./config.js";
import { performanceMonitor } from "./performance.js";

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

const TRANSPORT_ERROR_CODES = new Set([
  "API_DISABLED",
  "BRIDGE_TIMEOUT",
  "BRIDGE_LOAD_ERROR",
  "BRIDGE_NOT_READY",
  "BRIDGE_RETRY_FAILED",
  "BRIDGE_RESET",
  "REQUEST_TIMEOUT"
]);

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

export function isTransportError(error) {
  const code = String(error?.code || "").toUpperCase();
  if (TRANSPORT_ERROR_CODES.has(code)) return true;
  const text = String(error?.message || error || "");
  return /Brücke|Backend-Verbindung|antwortet nicht|zu lange gedauert|nicht vollständig verbunden/i.test(text);
}

class AppsScriptBridge {
  constructor() {
    this.channel = "";
    this.iframe = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.bridgeWindow = null;
    this.bridgeOrigin = "";
    this.readyResolver = null;
    this.connectionGeneration = 0;
    this.boundMessage = event => this.onMessage(event);
    window.addEventListener("message", this.boundMessage);
  }

  randomToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  }

  isAllowedOrigin(origin) {
    const value = String(origin || "");
    if (CONFIG.api.allowedBridgeOrigins.includes(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (
        url.hostname === "script.google.com" ||
        url.hostname === "script.googleusercontent.com" ||
        url.hostname.endsWith("-script.googleusercontent.com")
      );
    } catch (error) {
      return false;
    }
  }

  detachFrame() {
    this.iframe?.remove();
    this.iframe = null;
    this.bridgeWindow = null;
    this.bridgeOrigin = "";
    this.readyResolver = null;
  }

  rejectPending(reason) {
    const error = reason instanceof Error
      ? reason
      : new ApiError(String(reason || "Die Backend-Verbindung wurde neu aufgebaut."), "BRIDGE_RESET");
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  invalidate(reason = "Die Backend-Verbindung wird neu aufgebaut.") {
    this.connectionGeneration += 1;
    this.readyPromise = null;
    this.rejectPending(new ApiError(reason, "BRIDGE_RESET"));
    this.detachFrame();
  }

  connectOnce() {
    this.detachFrame();
    const generation = ++this.connectionGeneration;
    this.channel = this.randomToken();

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishError = error => {
        if (settled || generation !== this.connectionGeneration) return;
        settled = true;
        window.clearTimeout(timer);
        this.detachFrame();
        reject(error);
      };
      const finishReady = payload => {
        if (settled || generation !== this.connectionGeneration) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(payload || {});
      };

      const timer = window.setTimeout(() => {
        finishError(new ApiError("Die Apps-Script-Brücke antwortet nicht. Prüfe die aktive Web-App-Bereitstellung.", "BRIDGE_TIMEOUT"));
      }, CONFIG.api.readyTimeoutMs);

      const url = new URL(CONFIG.api.bridgeUrl);
      url.searchParams.set("channel", this.channel);
      url.searchParams.set("v", CONFIG.app.build);
      url.searchParams.set("connection", String(generation));

      this.iframe = document.createElement("iframe");
      this.iframe.id = "appsScriptBridge";
      this.iframe.className = "backend-bridge";
      this.iframe.title = "Plärrdeifl Backend-Verbindung";
      this.iframe.setAttribute("aria-hidden", "true");
      this.iframe.tabIndex = -1;
      this.iframe.src = url.toString();
      this.iframe.addEventListener("error", () => {
        finishError(new ApiError("Die Apps-Script-Brücke konnte nicht geladen werden.", "BRIDGE_LOAD_ERROR"));
      }, { once: true });

      this.readyResolver = finishReady;
      document.body.appendChild(this.iframe);
    });
  }

  initialize() {
    if (!CONFIG.api.enabled) {
      return Promise.reject(new ApiError("Die Backend-Verbindung ist deaktiviert.", "API_DISABLED"));
    }
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      let firstError;
      try {
        return await this.connectOnce();
      } catch (error) {
        firstError = error;
      }
      await wait(500);
      try {
        return await this.connectOnce();
      } catch (secondError) {
        throw new ApiError(
          secondError.message || firstError?.message || "Backend-Verbindung fehlgeschlagen.",
          secondError.code || "BRIDGE_RETRY_FAILED",
          { firstError: firstError?.message || "", secondError: secondError?.message || "" }
        );
      }
    })().catch(error => {
      this.readyPromise = null;
      throw error;
    });

    return this.readyPromise;
  }

  onMessage(event) {
    if (!this.iframe || !this.isAllowedOrigin(event.origin)) return;
    const message = event.data || {};
    if (message.source !== "pd-pwa-bridge" || message.channel !== this.channel) return;

    if (message.type === "ready") {
      this.bridgeWindow = event.source;
      this.bridgeOrigin = event.origin;
      if (this.readyResolver) {
        const resolve = this.readyResolver;
        this.readyResolver = null;
        resolve(message.payload || {});
      }
      return;
    }

    const requestId = String(message.requestId || "");
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    window.clearTimeout(pending.timer);
    const clientDurationMs = Math.max(0, performance.now() - pending.startedAt);

    if (message.type === "error") {
      const payload = message.payload || {};
      const error = new ApiError(payload.message || "Backendfehler", payload.code || "BACKEND_ERROR", payload.details || payload);
      performanceMonitor.record({ action: pending.action, clientDurationMs, ok: false, error: error.message });
      pending.reject(error);
      return;
    }

    performanceMonitor.record({
      action: pending.action,
      clientDurationMs,
      server: message.payload?.performance || null,
      ok: message.payload?.ok !== false
    });
    pending.resolve(message.payload);
  }

  async request(action, args = []) {
    await this.initialize();
    if (!this.bridgeWindow || !this.bridgeOrigin) {
      this.invalidate("Die Apps-Script-Brücke ist noch nicht vollständig verbunden.");
      throw new ApiError("Die Apps-Script-Brücke ist noch nicht vollständig verbunden.", "BRIDGE_NOT_READY");
    }

    const requestId = this.randomToken();
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        const error = new ApiError("Die Backend-Anfrage hat zu lange gedauert.", "REQUEST_TIMEOUT");
        performanceMonitor.record({ action, clientDurationMs: performance.now() - startedAt, ok: false, error: error.message });
        reject(error);
        this.invalidate("Die Backend-Verbindung reagierte nicht mehr und wird neu aufgebaut.");
      }, CONFIG.api.requestTimeoutMs);

      this.pending.set(requestId, { resolve, reject, timer, startedAt, action });
      try {
        this.bridgeWindow.postMessage({
          source: "pd-pwa-client",
          channel: this.channel,
          requestId,
          action,
          args: Array.isArray(args) ? args : []
        }, this.bridgeOrigin);
      } catch (error) {
        this.pending.delete(requestId);
        window.clearTimeout(timer);
        this.invalidate("Die Backend-Verbindung konnte nicht angesprochen werden.");
        reject(new ApiError(error?.message || "Die Backend-Verbindung konnte nicht angesprochen werden.", "BRIDGE_NOT_READY"));
      }
    });
  }
}

const bridge = new AppsScriptBridge();

function unwrap(result) {
  if (result && result.ok === false) {
    throw new ApiError(result.message || "Backendfehler", result.code || "BACKEND_RESPONSE", result.error?.details || result);
  }
  return result?.data !== undefined ? result.data : result;
}

export const api = Object.freeze({
  initialize() {
    return bridge.initialize();
  },
  reconnect() {
    bridge.invalidate("Die Backend-Verbindung wird neu aufgebaut.");
    return bridge.initialize();
  },
  async getConfig() {
    return unwrap(await bridge.request("config"));
  },
  async bootstrap(sessionToken = "") {
    return unwrap(await bridge.request("bootstrap", [sessionToken]));
  },
  async createGisChallenge() {
    return unwrap(await bridge.request("createGisChallenge"));
  },
  async loginWithGoogleCredential(credential, nonce) {
    return unwrap(await bridge.request("loginWithGoogleCredential", [credential, nonce]));
  },
  async submitAccessRequest(registrationToken, data) {
    return unwrap(await bridge.request("submitAccessRequest", [registrationToken, data || {}]));
  },
  async resumeSession(sessionToken) {
    return unwrap(await bridge.request("resumeSession", [sessionToken]));
  },
  async logout(sessionToken) {
    return unwrap(await bridge.request("logout", [sessionToken]));
  },
  async dispatch(sessionToken, functionName, ...args) {
    return unwrap(await bridge.request("dispatch", [sessionToken, functionName, args]));
  },
  async readBatch(sessionToken, calls) {
    return unwrap(await bridge.request("dispatch", [sessionToken, "apiReadBatch", [calls]]));
  },
  performance() {
    return performanceMonitor.summary();
  }
});

export function apiStatus() {
  return {
    enabled: CONFIG.api.enabled,
    configured: Boolean(CONFIG.api.bridgeUrl),
    transport: "apps-script-iframe-bridge"
  };
}

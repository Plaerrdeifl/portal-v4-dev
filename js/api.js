import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

class AppsScriptBridge {
  constructor() {
    this.channel = this.randomToken();
    this.iframe = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.bridgeWindow = null;
    this.bridgeOrigin = "";
    this.boundMessage = event => this.onMessage(event);
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

  initialize() {
    if (!CONFIG.api.enabled) {
      return Promise.reject(new ApiError("Die Backend-Verbindung ist deaktiviert.", "API_DISABLED"));
    }
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new ApiError("Die Apps-Script-Brücke antwortet nicht. Prüfe Bereitstellung und Phase-2-Backend.", "BRIDGE_TIMEOUT"));
      }, CONFIG.api.readyTimeoutMs);

      const url = new URL(CONFIG.api.bridgeUrl);
      url.searchParams.set("channel", this.channel);
      this.iframe = document.createElement("iframe");
      this.iframe.id = "appsScriptBridge";
      this.iframe.className = "backend-bridge";
      this.iframe.title = "Plärrdeifl Backend-Verbindung";
      this.iframe.setAttribute("aria-hidden", "true");
      this.iframe.tabIndex = -1;
      this.iframe.src = url.toString();
      this.iframe.addEventListener("error", () => {
        window.clearTimeout(timer);
        reject(new ApiError("Die Apps-Script-Brücke konnte nicht geladen werden.", "BRIDGE_LOAD_ERROR"));
      }, { once: true });

      this._resolveReady = payload => {
        window.clearTimeout(timer);
        resolve(payload || {});
      };

      window.addEventListener("message", this.boundMessage);
      document.body.appendChild(this.iframe);
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
      if (this._resolveReady) {
        this._resolveReady(message.payload || {});
        this._resolveReady = null;
      }
      return;
    }

    const pending = this.pending.get(String(message.requestId || ""));
    if (!pending) return;
    this.pending.delete(String(message.requestId || ""));
    window.clearTimeout(pending.timer);

    if (message.type === "error") {
      pending.reject(new ApiError(message.payload?.message || "Backendfehler", "BACKEND_ERROR", message.payload));
      return;
    }
    pending.resolve(message.payload);
  }

  async request(action, args = []) {
    await this.initialize();
    const requestId = this.randomToken();
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new ApiError("Die Backend-Anfrage hat zu lange gedauert.", "REQUEST_TIMEOUT"));
      }, CONFIG.api.requestTimeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });
      if (!this.bridgeWindow || !this.bridgeOrigin) {
        this.pending.delete(requestId);
        window.clearTimeout(timer);
        reject(new ApiError("Die Apps-Script-Brücke ist noch nicht vollständig verbunden.", "BRIDGE_NOT_READY"));
        return;
      }
      this.bridgeWindow.postMessage({
        source: "pd-pwa-client",
        channel: this.channel,
        requestId,
        action,
        args: Array.isArray(args) ? args : []
      }, this.bridgeOrigin);
    });
  }
}

const bridge = new AppsScriptBridge();

function unwrap(result) {
  if (result && result.ok === false) {
    throw new ApiError(result.message || "Backendfehler", result.code || "BACKEND_RESPONSE", result);
  }
  return result?.data !== undefined ? result.data : result;
}

export const api = Object.freeze({
  initialize() {
    return bridge.initialize();
  },
  async getConfig() {
    return unwrap(await bridge.request("config"));
  },
  async createGisChallenge() {
    return unwrap(await bridge.request("createGisChallenge"));
  },
  async loginWithGoogleCredential(credential, nonce) {
    return unwrap(await bridge.request("loginWithGoogleCredential", [credential, nonce]));
  },
  async createLoginUrl(frontendReturnUrl) {
    return unwrap(await bridge.request("createLoginUrl", [frontendReturnUrl]));
  },
  async exchangeTicket(ticket) {
    return unwrap(await bridge.request("exchangeTicket", [ticket]));
  },
  async resumeSession(sessionToken) {
    return unwrap(await bridge.request("resumeSession", [sessionToken]));
  },
  async logout(sessionToken) {
    return unwrap(await bridge.request("logout", [sessionToken]));
  },
  async dispatch(sessionToken, functionName, ...args) {
    return unwrap(await bridge.request("dispatch", [sessionToken, functionName, args]));
  }
});

export function apiStatus() {
  return {
    enabled: CONFIG.api.enabled,
    configured: Boolean(CONFIG.api.bridgeUrl),
    transport: "apps-script-iframe-bridge"
  };
}

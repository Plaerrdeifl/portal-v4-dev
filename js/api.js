import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, code = "API_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
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

  resetFrame() {
    this.iframe?.remove();
    this.iframe = null;
    this.bridgeWindow = null;
    this.bridgeOrigin = "";
    this.readyResolver = null;
  }

  connectOnce() {
    this.resetFrame();
    this.channel = this.randomToken();

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishError = error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.resetFrame();
        reject(error);
      };
      const finishReady = payload => {
        if (settled) return;
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
      await wait(650);
      try {
        return await this.connectOnce();
      } catch (secondError) {
        throw new ApiError(secondError.message || firstError?.message || "Backend-Verbindung fehlgeschlagen.", secondError.code || "BRIDGE_RETRY_FAILED", {
          firstError: firstError?.message || "",
          secondError: secondError?.message || ""
        });
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
        this.readyPromise = null;
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

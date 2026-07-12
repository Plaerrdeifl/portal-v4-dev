import { api } from "./api.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
const CHALLENGE_REFRESH_BUFFER_MS = 45 * 1000;
let libraryPromise = null;
let activeController = null;
let generationCounter = 0;

function loadLibrary() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (libraryPromise) return libraryPromise;

  libraryPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    const script = existing || document.createElement("script");
    const timer = window.setTimeout(() => reject(new Error("Google-Anmeldung konnte nicht geladen werden.")), 15000);

    const done = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts?.id) resolve(window.google.accounts.id);
      else reject(new Error("Google Identity Services ist nicht verfügbar."));
    };

    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      reject(new Error("Google-Anmeldedienst konnte nicht geladen werden."));
    }, { once: true });

    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.id) {
      done();
    }
  }).catch(error => {
    // Ein vorübergehender Ladefehler darf spätere Versuche nicht dauerhaft blockieren.
    libraryPromise = null;
    throw error;
  });

  return libraryPromise;
}

function validateClientId(clientId) {
  const value = String(clientId || "").trim();
  if (!/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)) {
    throw new Error("Die Google Client-ID im Backend ist ungültig oder unvollständig.");
  }
  return value;
}

function setContainerBusy(container, busy, label = "") {
  if (!container) return;
  container.classList.toggle("is-busy", Boolean(busy));
  container.setAttribute("aria-busy", busy ? "true" : "false");
  if (label) container.dataset.status = label;
  else delete container.dataset.status;
}

function destroyActiveController() {
  if (activeController) activeController.destroy();
  activeController = null;
}

export const googleIdentity = Object.freeze({
  async renderButton(container, { clientId, onCredential, onError } = {}) {
    if (!container) throw new Error("Google-Login-Platzhalter fehlt.");
    const safeClientId = validateClientId(clientId);

    destroyActiveController();

    const controller = {
      id: ++generationCounter,
      disposed: false,
      busy: false,
      refreshTimer: 0,
      challengeExpires: 0,

      destroy() {
        this.disposed = true;
        this.busy = false;
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = 0;
        setContainerBusy(container, false);
      },

      async refresh() {
        if (this.disposed || this.busy) return;
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = 0;
        container.replaceChildren();
        setContainerBusy(container, true, "Google-Anmeldung wird vorbereitet …");

        try {
          const [gis, challenge] = await Promise.all([loadLibrary(), api.createGisChallenge()]);
          if (this.disposed || activeController !== this) return;
          if (!challenge?.nonce) throw new Error("Das Backend hat keine sichere Google-Anmeldeanforderung geliefert.");

          this.challengeExpires = Number(challenge.expires || 0);
          const controllerId = this.id;
          const nonce = String(challenge.nonce);

          gis.initialize({
            client_id: safeClientId,
            callback: response => {
              if (this.disposed || activeController !== this || controllerId !== this.id || this.busy) return;
              const credential = String(response?.credential || "").trim();
              if (!credential) {
                Promise.resolve(onError?.(new Error("Google hat kein Anmeldetoken geliefert.")))
                  .finally(() => this.refresh())
                  .catch(() => null);
                return;
              }

              this.busy = true;
              window.clearTimeout(this.refreshTimer);
              setContainerBusy(container, true, "Google-Konto und Rechte werden geprüft …");

              Promise.resolve(onCredential?.({
                credential,
                nonce,
                selectBy: response?.select_by || ""
              })).then(outcome => {
                this.busy = false;
                if (!this.disposed && activeController === this) setContainerBusy(container, false);
                if (outcome?.refresh === false) return;
                return this.refresh();
              }).catch(error => {
                this.busy = false;
                if (!this.disposed && activeController === this) setContainerBusy(container, false);
                return Promise.resolve(onError?.(error))
                  .finally(() => this.refresh())
                  .catch(() => null);
              });
            },
            nonce,
            ux_mode: "popup",
            auto_select: false,
            cancel_on_tap_outside: true,
            context: "signin",
            itp_support: true,
            use_fedcm_for_prompt: true
          });

          container.replaceChildren();
          const width = Math.max(240, Math.min(360, Math.floor(container.getBoundingClientRect().width || 320)));
          gis.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left",
            width,
            locale: "de"
          });
          setContainerBusy(container, false);

          const refreshIn = Math.max(30 * 1000, this.challengeExpires - Date.now() - CHALLENGE_REFRESH_BUFFER_MS);
          this.refreshTimer = window.setTimeout(() => this.refresh(), refreshIn);
        } catch (error) {
          setContainerBusy(container, false);
          throw error;
        }
      }
    };

    activeController = controller;
    await controller.refresh();
    return controller;
  },

  destroyButton() {
    destroyActiveController();
  },

  disableAutoSelect() {
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch (error) {}
  }
});

import { api } from "./api.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
let libraryPromise = null;

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
    } else if (window.google?.accounts?.id) done();
  });
  return libraryPromise;
}

export const googleIdentity = Object.freeze({
  async renderButton(container, { clientId, onCredential, onError } = {}) {
    if (!container) throw new Error("Google-Login-Platzhalter fehlt.");
    if (!clientId) throw new Error("Google Client-ID fehlt in der Backend-Konfiguration.");

    container.replaceChildren();
    container.setAttribute("aria-busy", "true");
    try {
      const [gis, challenge] = await Promise.all([loadLibrary(), api.createGisChallenge()]);
      if (!challenge?.nonce) throw new Error("Das Backend hat keine sichere Google-Anmeldeanforderung geliefert.");

      gis.initialize({
        client_id: clientId,
        callback: response => {
          const credential = String(response?.credential || "").trim();
          if (!credential) {
            onError?.(new Error("Google hat kein Anmeldetoken geliefert."));
            return;
          }
          Promise.resolve(onCredential?.({ credential, nonce: challenge.nonce, selectBy: response?.select_by || "" }))
            .catch(error => onError?.(error));
        },
        nonce: challenge.nonce,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        itp_support: true
      });

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
      return { challengeExpires: Number(challenge.expires || 0) };
    } finally {
      container.removeAttribute("aria-busy");
    }
  },

  disableAutoSelect() {
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch (error) {}
  }
});

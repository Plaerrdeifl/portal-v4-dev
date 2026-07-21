const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client?hl=de";

let libraryPromise = null;
let initializedClientId = "";
let credentialHandler = null;
let noncePairPromise = null;

function googleIdentityApi() {
  return window.google?.accounts?.id || null;
}

function bytesToBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

async function createNoncePair() {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const nonce = bytesToBase64Url(random);
  const encoded = new TextEncoder().encode(nonce);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hashedNonce = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return { nonce, hashedNonce };
}

export function loadGoogleIdentityServices() {
  const available = googleIdentityApi();
  if (available) return Promise.resolve(available);
  if (libraryPromise) return libraryPromise;

  libraryPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    const script = existing || document.createElement("script");
    const timeout = window.setTimeout(() => {
      reject(new Error("Google Identity Services wurde nicht rechtzeitig geladen."));
    }, 12000);

    const finish = () => {
      window.clearTimeout(timeout);
      const api = googleIdentityApi();

      if (!api) {
        reject(new Error("Google Identity Services ist nicht verfügbar."));
        return;
      }

      resolve(api);
    };

    const fail = () => {
      window.clearTimeout(timeout);
      reject(new Error("Google Identity Services konnte nicht geladen werden."));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      document.head.append(script);
    }
  }).catch(error => {
    libraryPromise = null;
    throw error;
  });

  return libraryPromise;
}

async function initializeGoogleIdentity(clientId, onCredential) {
  const normalizedClientId = String(clientId || "").trim();

  if (!normalizedClientId) {
    throw new Error("Die öffentliche Google Client-ID fehlt.");
  }

  credentialHandler = onCredential;
  const api = await loadGoogleIdentityServices();

  if (!noncePairPromise) {
    noncePairPromise = createNoncePair();
  }

  const noncePair = await noncePairPromise;

  if (!initializedClientId) {
    api.initialize({
      client_id: normalizedClientId,
      callback: response => {
        credentialHandler?.(response, noncePair.nonce);
      },
      context: "signin",
      ux_mode: "popup",
      nonce: noncePair.hashedNonce,
      auto_select: false,
      itp_support: true,
      use_fedcm_for_button: true,
      button_auto_select: false
    });

    initializedClientId = normalizedClientId;
  } else if (initializedClientId !== normalizedClientId) {
    throw new Error("Google Identity Services wurde mit einer anderen Client-ID initialisiert.");
  }

  return api;
}

export async function renderGoogleSignInButton(
  element,
  { clientId, onCredential }
) {
  if (!element) {
    throw new Error("Der Platzhalter für die Google-Anmeldung fehlt.");
  }

  const api = await initializeGoogleIdentity(clientId, onCredential);
  element.replaceChildren();

  api.renderButton(element, {
    type: "standard",
    theme: "filled_blue",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    width: 320,
    locale: "de"
  });
}

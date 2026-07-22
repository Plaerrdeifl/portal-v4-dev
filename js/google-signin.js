const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client?hl=de";
const BUTTON_HORIZONTAL_INSET = 12;
const BUTTON_MIN_WIDTH = 200;
const BUTTON_MAX_WIDTH = 360;
const BUTTON_FALLBACK_WIDTH = 320;

let libraryPromise = null;
let initializedClientId = "";
let credentialHandler = null;
let noncePairPromise = null;
const resizeObservers = new WeakMap();
const renderedWidths = new WeakMap();

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

function numericWidth(value) {
  const width = Number(value || 0);
  return Number.isFinite(width) && width > 0 ? width : 0;
}

function elementWidth(element) {
  const directRect = typeof element.getBoundingClientRect === "function"
    ? numericWidth(element.getBoundingClientRect()?.width)
    : 0;
  const directClient = numericWidth(element.clientWidth);
  const parent = element.parentElement || null;
  const parentRect = typeof parent?.getBoundingClientRect === "function"
    ? numericWidth(parent.getBoundingClientRect()?.width)
    : 0;
  const parentClient = numericWidth(parent?.clientWidth);
  const viewport = numericWidth(window.visualViewport?.width || window.innerWidth);
  const viewportFallback = viewport > 0 ? Math.max(0, viewport - 60) : 0;

  return directRect || directClient || parentRect || parentClient || viewportFallback;
}

function availableButtonWidth(element) {
  const measured = elementWidth(element);
  const safeWidth = measured > 0
    ? Math.floor(measured - BUTTON_HORIZONTAL_INSET)
    : BUTTON_FALLBACK_WIDTH;

  return Math.max(
    BUTTON_MIN_WIDTH,
    Math.min(BUTTON_MAX_WIDTH, safeWidth)
  );
}

function afterLayout() {
  return new Promise(resolve => {
    const requestFrame = typeof window.requestAnimationFrame === "function"
      ? callback => window.requestAnimationFrame(callback)
      : typeof globalThis.requestAnimationFrame === "function"
        ? callback => globalThis.requestAnimationFrame(callback)
        : null;

    if (!requestFrame) {
      window.setTimeout(resolve, 0);
      return;
    }

    requestFrame(() => requestFrame(resolve));
  });
}

function drawButton(api, element) {
  const width = availableButtonWidth(element);
  const alreadyRendered = typeof element.hasChildNodes === "function"
    ? element.hasChildNodes()
    : Boolean(element.firstChild);

  if (renderedWidths.get(element) === width && alreadyRendered) return;

  renderedWidths.set(element, width);
  element.replaceChildren();
  api.renderButton(element, {
    type: "standard",
    theme: "filled_blue",
    size: "large",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    width,
    locale: "de"
  });
}

export async function renderGoogleSignInButton(
  element,
  { clientId, onCredential }
) {
  if (!element) {
    throw new Error("Der Platzhalter für die Google-Anmeldung fehlt.");
  }

  const api = await initializeGoogleIdentity(clientId, onCredential);
  await afterLayout();
  drawButton(api, element);

  resizeObservers.get(element)?.disconnect();
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      void afterLayout().then(() => drawButton(api, element));
    });
    observer.observe(element);
    resizeObservers.set(element, observer);
  }
}

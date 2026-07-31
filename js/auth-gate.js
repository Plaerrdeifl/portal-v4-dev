import { CONFIG } from "./config.js";
import {
  renderGoogleSignInButton
} from "./google-signin.js";

function element(id) {
  return document.getElementById(id);
}

function privateHostname(value) {
  const host = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (
    host === "localhost"
    || host === "::1"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.startsWith("fc")
    || host.startsWith("fd")
    || host.startsWith("fe80:")
  ) {
    return true;
  }

  const parts = host.split(".");

  if (
    parts.length !== 4
    || parts.some(part => !/^\d+$/.test(part))
  ) {
    return false;
  }

  const numbers = parts.map(Number);

  if (
    numbers.some(number => number < 0 || number > 255)
  ) {
    return false;
  }

  return (
    numbers[0] === 0
    || numbers[0] === 10
    || numbers[0] === 127
    || (
      numbers[0] === 169
      && numbers[1] === 254
    )
    || (
      numbers[0] === 172
      && numbers[1] >= 16
      && numbers[1] <= 31
    )
    || (
      numbers[0] === 192
      && numbers[1] === 168
    )
    || numbers[0] >= 224
  );
}

function validPublicUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);

    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || privateHostname(parsed.hostname)
    ) {
      return "";
    }

    return parsed.href;
  }
  catch {
    return "";
  }
}

function setLegalLink(selector, value) {
  const url = validPublicUrl(value);
  const link = document.querySelector(selector);

  if (!link) {
    return false;
  }

  link.hidden = !url;

  if (url) {
    link.href = url;
  }
  else {
    link.removeAttribute("href");
  }

  return Boolean(url);
}

export function syncLegalLinks() {
  const imprintVisible = setLegalLink(
    "[data-legal-imprint]",
    CONFIG.legal.imprintUrl
  );

  const privacyVisible = setLegalLink(
    "[data-legal-privacy]",
    CONFIG.legal.privacyUrl
  );

  const separator = document.querySelector(
    "[data-legal-separator]"
  );

  if (separator) {
    separator.hidden = !(
      imprintVisible && privacyVisible
    );
  }

  const footer = element("authLegalLinks");

  const authLayout =
    document.documentElement.dataset.authLayout === "true";

  if (footer) {
    footer.hidden =
      !authLayout
      || (!imprintVisible && !privacyVisible);
  }
}

export function setAuthLayout(active) {
  document.documentElement.dataset.authLayout =
    active ? "true" : "false";

  syncLegalLinks();
}

export function initializeAuthGate() {
  const environment = String(
    CONFIG.supabase.environment || "UNCONFIGURED"
  ).trim().toUpperCase();

  document.documentElement.dataset.environment =
    environment;

  const badge = element("environmentBadge");

  if (badge) {
    badge.hidden = environment !== "DEV";
  }

  syncLegalLinks();
}

function setOpeningCopy(status, detail) {
  const statusNode = element("authGateStatus");
  const detailNode = element("authGateDetail");

  if (statusNode) {
    statusNode.textContent =
      status || "Portal wird geöffnet …";
  }

  if (detailNode) {
    detailNode.textContent =
      detail || "Sichere Anmeldung wird vorbereitet.";
  }
}

export function showOpening(
  status = "Portal wird geöffnet …",
  detail = "Sichere Anmeldung wird vorbereitet."
) {
  const gate = element("authGate");
  const opening = element("authGateOpening");
  const login = element("authGateLogin");
  const shell = element("appShell");

  setAuthLayout(true);
  setOpeningCopy(status, detail);

  if (gate) {
    gate.hidden = false;
    gate.setAttribute("aria-busy", "true");
  }

  if (opening) {
    opening.hidden = false;
  }

  if (login) {
    login.hidden = true;
  }

  if (shell) {
    shell.hidden = true;
    shell.inert = true;
  }
}

export function showChecking(
  status = "Anmeldung wird geprüft …",
  detail = "Portalstatus und Berechtigungen werden geladen."
) {
  showOpening(status, detail);
}

function revealPreparedLogin(opening, login) {
  if (login) {
    login.removeAttribute("data-preparing");
    login.dataset.ready = "true";
    login.hidden = false;
  }

  if (opening) {
    opening.hidden = true;
  }
}

export async function showLogin({
  onCredential,
  errorMessage = ""
} = {}) {
  const gate = element("authGate");
  const opening = element("authGateOpening");
  const login = element("authGateLogin");
  const error = element("authGateError");
  const slot = element("googleSignInButton");
  const status = element("googleSignInStatus");
  const shell = element("appShell");

  setAuthLayout(true);

  if (shell) {
    shell.hidden = true;
    shell.inert = true;
  }

  if (gate) {
    gate.hidden = false;
    gate.setAttribute("aria-busy", "false");
  }

  const loginReady =
    login?.dataset.ready === "true";

  if (opening) {
    opening.hidden = loginReady;
  }

  if (login) {
    login.hidden = false;

    if (!loginReady) {
      login.dataset.preparing = "true";
    }
  }

  if (error) {
    error.textContent = String(errorMessage || "");
    error.hidden = !errorMessage;
  }

  if (status) {
    status.textContent = "";
  }

  if (!slot) {
    throw new Error(
      "Der neue Google-Anmeldebereich fehlt."
    );
  }

  slot.setAttribute("aria-busy", "false");

  if (!CONFIG.supabase.configured) {
    slot.replaceChildren();

    slot.textContent =
      "Die Portalverbindung ist noch nicht konfiguriert.";

    if (status) {
      status.textContent =
        "Die Anmeldung kann derzeit nicht gestartet werden.";
    }

    revealPreparedLogin(opening, login);
    return;
  }

  if (!CONFIG.auth.googleClientId) {
    slot.replaceChildren();

    slot.textContent =
      "Die öffentliche Google Client-ID fehlt.";

    revealPreparedLogin(opening, login);
    return;
  }

  try {
    await renderGoogleSignInButton(slot, {
      clientId: CONFIG.auth.googleClientId,

      onCredential: async (response, nonce) => {
        slot.setAttribute("aria-busy", "true");

        if (status) {
          status.textContent =
            "Google-Anmeldung wird sicher geprüft …";
        }

        if (typeof onCredential !== "function") {
          throw new Error(
            "Der neue Anmeldeübergang ist nicht verfügbar."
          );
        }

        await onCredential(response, nonce);
      }
    });

    revealPreparedLogin(opening, login);
  }
  catch (loadError) {
    slot.replaceChildren();

    slot.textContent =
      "Google-Anmeldung konnte nicht geladen werden.";

    if (status) {
      status.textContent = String(
        loadError?.message
        || "Google Identity Services ist nicht verfügbar."
      );
    }

    revealPreparedLogin(opening, login);
  }
}

export function showApp({
  authLayout = false
} = {}) {
  const gate = element("authGate");
  const shell = element("appShell");

  setAuthLayout(authLayout);

  if (gate) {
    gate.hidden = true;
    gate.setAttribute("aria-busy", "false");
  }

  if (shell) {
    shell.hidden = false;
    shell.inert = false;
  }
}

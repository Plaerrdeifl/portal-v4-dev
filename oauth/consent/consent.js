import { auth } from "/js/auth.js";
import { CONFIG } from "/js/config.js";
import { renderGoogleSignInButton } from "/js/google-signin.js";
import { getSupabaseClient } from "/js/supabase-client.js";

const authorizationId = new URLSearchParams(window.location.search)
  .get("authorization_id");

const loginPanel = document.getElementById("loginPanel");
const loginSlot = document.getElementById("googleSignInButton");
const consentPanel = document.getElementById("consentPanel");
const clientName = document.getElementById("clientName");
const scopeText = document.getElementById("scopeText");
const approveButton = document.getElementById("approveButton");
const denyButton = document.getElementById("denyButton");
const statusElement = document.getElementById("oauthStatus");
const leadElement = document.getElementById("oauthLead");

let currentAuthorization = null;
let loginRendered = false;
let actionPending = false;

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = "oauth-status";
  if (type) statusElement.classList.add(type);
}

function setActionPending(pending) {
  actionPending = pending;
  approveButton.disabled = pending;
  denyButton.disabled = pending;
}

function scopeLabel(scope) {
  const labels = {
    openid: "deine Identität",
    email: "deine E-Mail-Adresse",
    profile: "deinen Namen und dein Profil",
    phone: "deine Telefonnummer"
  };

  return labels[scope] || scope;
}

function describeScopes(rawScope) {
  const scopes = String(rawScope || "")
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean);

  if (!scopes.length) {
    return "Es werden nur die für die Anmeldung erforderlichen Kontodaten übertragen.";
  }

  const descriptions = scopes.map(scopeLabel);

  return `Freigegeben werden: ${descriptions.join(", ")}.`;
}

async function showLogin() {
  consentPanel.hidden = true;
  loginPanel.hidden = false;
  leadElement.textContent =
    "Melde dich mit demselben Google-Konto an, das du auch im Plärrdeifl Portal verwendest.";
  setStatus("Portal-Anmeldung erforderlich.");

  if (loginRendered) return;
  loginRendered = true;

  await renderGoogleSignInButton(loginSlot, {
    clientId: CONFIG.auth.googleClientId,
    onCredential: async (response, nonce) => {
      loginSlot.setAttribute("aria-busy", "true");
      setStatus("Google-Anmeldung wird geprüft …");

      try {
        const credential = String(response?.credential || "").trim();
        await auth.signInWithGoogleIdToken(credential, nonce);
        await loadAuthorization();
      } catch (error) {
        console.error("OAuth portal login failed", error);
        setStatus(
          error?.message || "Die Anmeldung konnte nicht abgeschlossen werden.",
          "error"
        );
      } finally {
        loginSlot.setAttribute("aria-busy", "false");
      }
    }
  });
}

async function ensureActivePortalUser() {
  await auth.initialize();

  let state = auth.current();

  if (!state.authenticated) {
    await showLogin();
    return false;
  }

  if (state.status === "LOADING") {
    await auth.refresh();
    state = auth.current();
  }

  if (!auth.isActive()) {
    loginPanel.hidden = true;
    consentPanel.hidden = true;
    leadElement.textContent =
      "Dein Portal-Konto ist nicht für die Nutzung freigeschaltet.";
    setStatus(
      "Für Nextcloud ist ein aktiver Plärrdeifl-Portalzugang erforderlich.",
      "error"
    );
    return false;
  }

  if (state.bootstrap?.nextcloudAccess !== true) {
    loginPanel.hidden = true;
    consentPanel.hidden = true;
    leadElement.textContent =
      "Dein Portal-Konto hat keinen Zugriff auf den gemeinsamen Nextcloud-Bereich.";
    setStatus(
      "Nextcloud ist für aktive Mitglieder des Social-Media-Teams und den aktuellen Vorstand freigegeben.",
      "error"
    );
    return false;
  }

  return true;
}

async function loadAuthorization() {
  if (!authorizationId) {
    loginPanel.hidden = true;
    consentPanel.hidden = true;
    leadElement.textContent = "Die Anmeldeanfrage ist unvollständig.";
    setStatus(
      "Es fehlt die authorization_id. Starte die Anmeldung bitte erneut aus Nextcloud.",
      "error"
    );
    return;
  }

  const active = await ensureActivePortalUser();
  if (!active) return;

  loginPanel.hidden = true;
  setStatus("Nextcloud-Anfrage wird geprüft …");

  const client = getSupabaseClient();
  const { data, error } =
    await client.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error) {
    throw error;
  }

  if (data?.redirect_url && !data?.authorization_id) {
    window.location.replace(data.redirect_url);
    return;
  }

  currentAuthorization = data;

  const requestedClientName =
    String(data?.client?.name || "").trim() || "Nextcloud";

  clientName.textContent = requestedClientName;
  scopeText.textContent = describeScopes(data?.scope);

  consentPanel.hidden = false;
  leadElement.textContent =
    "Du bist im Plärrdeifl Portal angemeldet. Bestätige jetzt die Verbindung zu Nextcloud.";
  setStatus("Bereit zum Verbinden.", "success");
}

async function finishAuthorization(decision) {
  if (actionPending || !currentAuthorization) return;

  setActionPending(true);
  setStatus(
    decision === "approve"
      ? "Nextcloud wird verbunden …"
      : "Anmeldung wird abgebrochen …"
  );

  try {
    const client = getSupabaseClient();
    const result = decision === "approve"
      ? await client.auth.oauth.approveAuthorization(authorizationId)
      : await client.auth.oauth.denyAuthorization(authorizationId);

    if (result.error) throw result.error;

    const redirectUrl = String(result.data?.redirect_url || "").trim();
    if (!redirectUrl) {
      throw new Error("Supabase hat keine Rücksprungadresse geliefert.");
    }

    window.location.replace(redirectUrl);
  } catch (error) {
    console.error("OAuth decision failed", error);
    setStatus(
      error?.message || "Die Nextcloud-Verbindung konnte nicht abgeschlossen werden.",
      "error"
    );
    setActionPending(false);
  }
}

approveButton.addEventListener("click", () => {
  void finishAuthorization("approve");
});

denyButton.addEventListener("click", () => {
  void finishAuthorization("deny");
});

loadAuthorization().catch(error => {
  console.error("OAuth consent initialization failed", error);
  loginPanel.hidden = true;
  consentPanel.hidden = true;
  setStatus(
    error?.message || "Die Nextcloud-Anmeldung konnte nicht vorbereitet werden.",
    "error"
  );
});

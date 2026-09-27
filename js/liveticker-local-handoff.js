import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { renderGoogleSignInButton } from "./google-signin.js";
import { getSupabaseClient } from "./supabase-client.js";

const TARGET_ORIGIN = "http://192.168.178.117";
const TARGET_URL = TARGET_ORIGIN + "/";
const SESSION_FRAGMENT_KEY = "pd_session";

const googleSlot = document.getElementById("googleSlot");
const openButton = document.getElementById("openButton");
const status = document.getElementById("status");

let googleRendered = false;
let handoffBusy = false;

function setStatus(message) {
  if (status) status.textContent = String(message || "");
}

function canHandoff() {
  return auth.current().authenticated && auth.hasCapability("liveticker.manage");
}

async function renderState() {
  const current = auth.current();

  if (current.authenticated) {
    googleSlot.hidden = true;

    if (canHandoff()) {
      openButton.hidden = false;
      setStatus("Bereit. Öffne jetzt den lokalen Liveticker.");
      return;
    }

    openButton.hidden = true;
    setStatus(
      current.status === "ACTIVE"
        ? "Dein Portal-Konto besitzt nicht die Berechtigung liveticker.manage."
        : "Dein Portal-Konto ist noch nicht aktiv."
    );
    return;
  }

  openButton.hidden = true;
  googleSlot.hidden = false;
  setStatus("Bitte mit deinem bestehenden Portal-Konto anmelden.");

  if (googleRendered) return;
  googleRendered = true;

  try {
    await renderGoogleSignInButton(googleSlot, {
      clientId: CONFIG.auth.googleClientId,
      onCredential: async (response, nonce) => {
        setStatus("Google-Anmeldung wird geprüft …");
        await auth.signInWithGoogleIdToken(response?.credential, nonce);
        await renderState();
      }
    });
  } catch (error) {
    googleRendered = false;
    setStatus(error?.message || "Google-Anmeldung konnte nicht geladen werden.");
  }
}

function sessionFragment(accessToken, refreshToken) {
  const payload = encodeURIComponent(JSON.stringify({
    accessToken,
    refreshToken
  }));
  return "#" + SESSION_FRAGMENT_KEY + "=" + payload;
}

async function openLocalLiveticker() {
  if (handoffBusy) return;
  if (!canHandoff()) {
    setStatus("Liveticker-Berechtigung ist nicht aktiv.");
    return;
  }

  handoffBusy = true;
  openButton.disabled = true;
  setStatus("Lokaler Liveticker wird vorbereitet …");

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("Aktive DEV-Portalsitzung fehlt.");
    }

    const target =
      TARGET_URL + sessionFragment(session.access_token, session.refresh_token);

    // Same-tab navigation is intentional for iOS: it avoids popup/opener
    // behavior. The fragment is never sent to either web server.
    window.location.assign(target);
  } catch (error) {
    handoffBusy = false;
    openButton.disabled = false;
    setStatus(error?.message || "Portalsitzung konnte nicht übergeben werden.");
  }
}

openButton?.addEventListener("click", () => {
  void openLocalLiveticker();
});

void auth.initialize()
  .then(renderState)
  .catch(error => {
    setStatus(error?.message || "DEV-Portalsitzung konnte nicht geprüft werden.");
  });

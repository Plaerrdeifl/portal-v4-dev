import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { renderGoogleSignInButton } from "./google-signin.js";
import { getSupabaseClient } from "./supabase-client.js";

const TARGET_ORIGIN = "http://192.168.178.117";
const TARGET_URL = TARGET_ORIGIN + "/?pd_handoff=1";

const googleSlot = document.getElementById("googleSlot");
const openButton = document.getElementById("openButton");
const status = document.getElementById("status");

let targetWindow = null;
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

async function sendSessionToTarget() {
  if (!targetWindow || handoffBusy) return;
  if (!canHandoff()) {
    setStatus("Liveticker-Berechtigung ist nicht mehr aktiv.");
    return;
  }

  handoffBusy = true;
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    const session = data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("Aktive DEV-Portalsitzung fehlt.");
    }

    targetWindow.postMessage(
      {
        type: "PD_LIVETICKER_SESSION",
        accessToken: session.access_token,
        refreshToken: session.refresh_token
      },
      TARGET_ORIGIN
    );
    setStatus("Portalsitzung wird an den lokalen Liveticker übergeben …");
  } catch (error) {
    setStatus(error?.message || "Portalsitzung konnte nicht übergeben werden.");
  } finally {
    handoffBusy = false;
  }
}

window.addEventListener("message", event => {
  if (event.origin !== TARGET_ORIGIN) return;
  if (!targetWindow || event.source !== targetWindow) return;

  if (event.data?.type === "PD_LIVETICKER_HANDOFF_READY") {
    void sendSessionToTarget();
    return;
  }

  if (event.data?.type === "PD_LIVETICKER_HANDOFF_ACK") {
    setStatus("Übergabe erfolgreich. Der lokale Liveticker ist angemeldet.");
  }
});

openButton?.addEventListener("click", () => {
  if (!canHandoff()) {
    setStatus("Liveticker-Berechtigung ist nicht aktiv.");
    return;
  }

  targetWindow = window.open(TARGET_URL, "pd-liveticker-local");
  if (!targetWindow) {
    setStatus("Safari hat das neue Fenster blockiert. Bitte Pop-ups für diese Seite erlauben.");
    return;
  }

  setStatus("Lokaler Liveticker wird geöffnet …");
});

void auth.initialize()
  .then(renderState)
  .catch(error => {
    setStatus(error?.message || "DEV-Portalsitzung konnte nicht geprüft werden.");
  });

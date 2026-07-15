import { auth } from "./auth.js";
import { showToast } from "./ui.js";
import { navigate } from "./router.js";
import { googleIdentity } from "./google-identity.js";
import { installState, requestInstall } from "./install.js";

const FEATURE_BUILD = "20260715-r71-m4-ui-race-hotfix-1";
let loginController = null;
let loginHydrationId = 0;
const moduleCache = new Map();
const moduleFailures = new Map();

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "");
}

function clean(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicConfig() {
  return auth.current().backend?.publicConfig || {};
}

function versionedModule(path, retry = 0) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${FEATURE_BUILD}${retry ? `&retry=${retry}` : ""}`;
}

async function feature(path, exportName, context = {}) {
  let promise = moduleCache.get(path);
  if (!promise) {
    const retry = moduleFailures.get(path) || 0;
    promise = import(versionedModule(path, retry));
    moduleCache.set(path, promise);
  }

  try {
    const module = await promise;
    moduleFailures.delete(path);
    if (typeof module[exportName] !== "function") throw new Error(`Modul ${exportName} fehlt.`);
    return module[exportName](context);
  } catch (error) {
    if (moduleCache.get(path) === promise) moduleCache.delete(path);
    moduleFailures.set(path, (moduleFailures.get(path) || 0) + 1);
    throw error;
  }
}

async function hydrateHome() {
  if (auth.isAuthenticated()) {
    navigate(auth.requiresProfile() ? "profile" : "dashboard");
    return;
  }
  const config = publicConfig();
  setText("publicHeadline", config.headline || "Herzlich willkommen bei den Schweinfurter Plärrdeifln");
  setText("publicConstructionText", config.note || "Das Plärrdeifl Portal befindet sich noch im Aufbau.");
}

async function simple(id, key, fallback) {
  setText(id, publicConfig()[key] || fallback);
}

async function hydrateInstall() {
  const button = document.getElementById("pageInstallButton");
  const instructions = document.getElementById("installInstructions");
  const result = document.getElementById("installResult");
  const render = () => {
    const state = installState();
    if (!instructions || !button) return;
    if (state.standalone) {
      instructions.textContent = "Das Portal ist bereits als App geöffnet.";
      button.hidden = true;
      return;
    }
    button.hidden = false;
    if (state.ios) {
      instructions.innerHTML = "<ol><li>In Safari öffnen.</li><li>Teilen wählen.</li><li>Zum Home-Bildschirm wählen.</li><li>Hinzufügen bestätigen.</li></ol>";
      button.textContent = "Anleitung anzeigen";
    } else if (state.promptAvailable) {
      instructions.textContent = "Dein Browser kann das Portal direkt als App installieren.";
      button.textContent = "Portal installieren";
    } else {
      instructions.innerHTML = "<p>Öffne das Browsermenü und wähle <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>.</p>";
      button.textContent = "Installationshinweis";
    }
  };
  button?.addEventListener("click", async () => {
    const state = installState();
    if (state.ios || !state.promptAvailable) {
      result.textContent = state.ios ? "Safari → Teilen → Zum Home-Bildschirm." : "Nutze den Installationsbefehl im Browsermenü.";
      return;
    }
    const output = await requestInstall();
    result.textContent = output.installed ? "Das Portal wurde installiert." : "Installation wurde nicht abgeschlossen.";
    render();
  });
  render();
}

function escapeAttr(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function registrationForm(registration) {
  const slot = document.getElementById("registrationSlot");
  if (!slot || !registration) return;
  const profile = registration.profile || {};
  slot.hidden = false;
  slot.innerHTML = `<div class="notice warning"><strong>Freischaltungsantrag vervollständigen</strong><br>Google hat kein bereits freigeschaltetes Benutzerkonto gefunden. Beide Namensfelder sind Pflichtfelder.</div><form id="registrationForm" class="form-grid" novalidate><label>Vorname *<input name="vorname" autocomplete="given-name" required maxlength="160" value="${escapeAttr(profile.vorname || "")}" aria-describedby="registrationFirstError"><small id="registrationFirstError" class="field-error"></small></label><label>Nachname *<input name="nachname" autocomplete="family-name" required maxlength="160" value="${escapeAttr(profile.nachname || "")}" aria-describedby="registrationLastError"><small id="registrationLastError" class="field-error"></small></label><div class="full dialog-actions"><button class="button primary" type="submit">Freischaltungsantrag senden</button></div></form>`;
  slot.querySelector("form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    data.vorname = clean(data.vorname);
    data.nachname = clean(data.nachname);
    document.getElementById("registrationFirstError").textContent = data.vorname ? "" : "Vorname fehlt.";
    document.getElementById("registrationLastError").textContent = data.nachname ? "" : "Nachname fehlt.";
    if (!data.vorname || !data.nachname) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Wird gesendet …";
    try {
      await auth.submitAccessRequest(data);
      slot.innerHTML = '<div class="notice success"><strong>Antrag gespeichert.</strong><br>Nach der Freigabe kannst du dich erneut mit Google anmelden.</div>';
      showToast("Freischaltungsantrag gespeichert.", "success", 5200);
    } catch (error) {
      showToast(error.message || "Antrag konnte nicht gespeichert werden.", "error", 6500);
      button.disabled = false;
      button.textContent = "Freischaltungsantrag senden";
    }
  });
}

async function hydrateLogin() {
  const hydrationId = ++loginHydrationId;
  googleIdentity.destroyButton();
  loginController = null;
  const current = auth.current();
  const retry = document.getElementById("loginRetryButton");
  const pill = document.getElementById("loginStatusPill");
  const slot = document.getElementById("googleSignInButton");
  setText("bridgeStatusText", current.backend ? `Verbunden · ${current.backend.version || current.backend.build || "Backend bereit"}` : "Backend nicht erreichbar.");
  setText("oauthStatusText", current.backend?.gisConfigured ? "Direkter Google-Popup-Login ist bereit." : "Google Client-ID fehlt oder ist ungültig.");

  if (current.registration) {
    registrationForm(current.registration);
    if (pill) {
      pill.textContent = "Angaben erforderlich";
      pill.className = "status-pill warning";
    }
    setText("loginMessage", "Vervollständige Vorname und Nachname.");
    return;
  }

  if (current.authenticated) {
    if (pill) {
      pill.textContent = current.profileRequired ? "Profil unvollständig" : "Angemeldet";
      pill.className = `status-pill ${current.profileRequired ? "warning" : "success"}`;
    }
    setText("loginMessage", current.profileRequired ? "Vorname und Nachname müssen ergänzt werden." : `Du bist als ${current.user?.name || "Portaluser"} angemeldet.`);
    slot.innerHTML = `<button id="loginHomeButton" class="button primary" type="button">${current.profileRequired ? "Profil vervollständigen" : "Zum Dashboard"}</button>`;
    document.getElementById("loginHomeButton")?.addEventListener("click", () => navigate(current.profileRequired ? "profile" : "dashboard"));
    return;
  }

  if (!current.backend?.gisConfigured || !current.backend?.googleClientId) {
    setText("loginMessage", "Direkter Google-Login ist noch nicht vollständig konfiguriert.");
    return;
  }

  const mount = async () => {
    if (hydrationId !== loginHydrationId) return;
    if (retry) retry.disabled = true;
    setText("loginMessage", "Google-Anmeldung wird sicher vorbereitet …");
    try {
      loginController = await googleIdentity.renderButton(slot, {
        clientId: current.backend.googleClientId,
        onCredential: async ({ credential, nonce }) => {
          const result = await auth.signInWithGoogleCredential(credential, nonce);
          if (result.authenticated) {
            googleIdentity.destroyButton();
            navigate(result.profileRequired ? "profile" : "dashboard");
            return { refresh: false };
          }
          if (result.registration) {
            registrationForm(result.registration);
            return { refresh: false };
          }
          return { refresh: true };
        },
        onError: async error => showToast(error.message || "Google-Anmeldung fehlgeschlagen.", "error", 6500)
      });
      if (pill) {
        pill.textContent = "Bereit";
        pill.className = "status-pill success";
      }
      setText("loginMessage", "Wähle dein Google-Konto aus.");
    } finally {
      if (retry) retry.disabled = false;
    }
  };

  retry?.addEventListener("click", mount);
  await mount();
}

export async function hydratePage(key, context = {}) {
  if (key !== "login") {
    loginHydrationId++;
    googleIdentity.destroyButton();
    loginController = null;
  }
  if (key === "home") return hydrateHome();
  if (key === "news") return simple("publicNewsText", "news", "Neuigkeiten werden hier veröffentlicht.");
  if (key === "dates") return simple("publicDatesText", "dates", "Kommende Termine werden hier angekündigt.");
  if (key === "about") return simple("publicAboutText", "about", "Hier entsteht die Vorstellung der Schweinfurter Plärrdeifl.");
  if (key === "contact") return simple("publicContactText", "contact", "Kontaktinformationen werden hier veröffentlicht.");
  if (key === "install") return hydrateInstall();
  if (key === "login") return hydrateLogin();
  if (key === "fanbuses") return;
  if (key === "profile") return feature("./modules/profile.js", "hydrateProfile", context);
  if (key === "dashboard") return feature("./modules/dashboard.js", "hydrateDashboard", context);
  if (key === "fanclub") return feature("./modules/fanclub.js", "hydrateFanclub", context);
  if (key === "tasks") return feature("./modules/tasks.js", "hydrateTasks", context);
  if (key === "teams") return feature("./modules/teams.js", "hydrateTeams", context);
  if (key === "admin") return feature("./modules/admin.js", "hydrateAdmin", context);
}

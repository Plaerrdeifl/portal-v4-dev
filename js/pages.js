import { auth } from "./auth.js";
import { showToast } from "./ui.js";
import { navigate } from "./router.js";
import { googleIdentity } from "./google-identity.js";
import { installState, requestInstall } from "./install.js";

const FEATURE_BUILD = "20260717-r71-m4-corr7-portal-separation";
let loginController = null;
let loginHydrationId = 0;
let loginMountPromise = null;
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

async function hydrateLogin(context = {}) {
  const hydrationId = ++loginHydrationId;
  const isActive = () => !context.signal?.aborted && hydrationId === loginHydrationId && context.isCurrent?.() !== false;
  googleIdentity.destroyButton();
  loginController = null;
  loginMountPromise = null;
  const current = auth.current();
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const registrationIntent = new URLSearchParams(query).get("intent") === "register";
  if (!current.registration && !current.authenticated) {
    setText("authKicker", registrationIntent ? "Sicher registrieren" : "Sicher anmelden");
    setText("authTitle", registrationIntent ? "Portalzugang anfordern" : "Willkommen zurück");
    if (registrationIntent) setText("loginMessage", "Bestätige zuerst dein Google-Konto. Anschließend kannst du deinen Freischaltungsantrag vervollständigen.");
  }
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
      pill.textContent = current.connectionPending ? "Verbindung wird geprüft" : current.profileRequired ? "Profil unvollständig" : "Angemeldet";
      pill.className = `status-pill ${current.connectionPending || current.profileRequired ? "warning" : "success"}`;
    }
    setText(
      "loginMessage",
      current.connectionPending
        ? "Deine Anmeldung bleibt erhalten. Die Backend-Verbindung wird automatisch wiederhergestellt."
        : current.profileRequired
          ? "Vorname und Nachname müssen ergänzt werden."
          : `Du bist als ${current.user?.name || "Portaluser"} angemeldet.`
    );
    slot.innerHTML = current.connectionPending
      ? '<button id="loginReconnectButton" class="button primary" type="button">Jetzt erneut verbinden</button>'
      : `<button id="loginHomeButton" class="button primary" type="button">${current.profileRequired ? "Profil vervollständigen" : "Zum Dashboard"}</button>`;
    document.getElementById("loginReconnectButton")?.addEventListener("click", async () => {
      const button = document.getElementById("loginReconnectButton");
      if (button) { button.disabled = true; button.textContent = "Verbindung wird geprüft …"; }
      try {
        const result = await auth.reconnect();
        if (!isActive()) return;
        navigate(result.profileRequired ? "profile" : "dashboard");
      } catch (error) {
        showToast(error.message || "Verbindung konnte noch nicht hergestellt werden.", "error", 6500);
        if (button) { button.disabled = false; button.textContent = "Jetzt erneut verbinden"; }
      }
    });
    document.getElementById("loginHomeButton")?.addEventListener("click", () => navigate(current.profileRequired ? "profile" : "dashboard"));
    return;
  }

  if (!current.backend?.gisConfigured || !current.backend?.googleClientId) {
    setText("loginMessage", "Direkter Google-Login ist noch nicht vollständig konfiguriert.");
    return;
  }

  const mount = async () => {
    if (!isActive()) return;
    if (loginMountPromise) return loginMountPromise;
    loginMountPromise = (async () => {
      if (retry) retry.disabled = true;
      setText("loginMessage", "Google-Anmeldung wird sicher vorbereitet …");
      try {
        loginController = await googleIdentity.renderButton(slot, {
          clientId: current.backend.googleClientId,
          onCredential: async ({ credential, nonce }) => {
            window.dispatchEvent(new CustomEvent("pd-auth-transition", {
              detail: {
                phase: "start",
                message: "Google-Anmeldung wird geprüft …",
                detail: "Sitzung, Rechte und Zielseite werden geladen. Du bleibst im Portal."
              }
            }));
            try {
              const result = await auth.signInWithGoogleCredential(credential, nonce);
              if (!isActive() && !result.authenticated) {
                window.dispatchEvent(new CustomEvent("pd-auth-transition", { detail: { phase: "end" } }));
                return { refresh: false };
              }
              if (result.authenticated) {
                googleIdentity.destroyButton();
                window.dispatchEvent(new CustomEvent("pd-auth-transition", {
                  detail: {
                    phase: "authenticated",
                    fallbackRoute: result.profileRequired ? "profile" : "dashboard"
                  }
                }));
                return { refresh: false };
              }
              window.dispatchEvent(new CustomEvent("pd-auth-transition", { detail: { phase: "end" } }));
              if (result.registration) {
                registrationForm(result.registration);
                return { refresh: false };
              }
              return { refresh: true };
            } catch (error) {
              window.dispatchEvent(new CustomEvent("pd-auth-transition", { detail: { phase: "error" } }));
              throw error;
            }
          },
          onError: async error => {
            if (isActive()) showToast(error.message || "Google-Anmeldung fehlgeschlagen.", "error", 6500);
          }
        });
        if (!isActive()) {
          googleIdentity.destroyButton();
          return;
        }
        if (pill) {
          pill.textContent = "Bereit";
          pill.className = "status-pill success";
        }
        setText("loginMessage", "Wähle dein Google-Konto aus.");
      } finally {
        if (retry && isActive()) retry.disabled = false;
      }
    })().finally(() => {
      loginMountPromise = null;
    });
    return loginMountPromise;
  };

  retry?.addEventListener("click", mount);
  await mount();
}


export function preloadAuthenticatedModules(keys = ["dashboard", "fanclub", "tasks", "teams", "admin"]) {
  const modules = {
    profile: "./modules/profile.js",
    dashboard: "./modules/dashboard.js",
    fanclub: "./modules/fanclub.js",
    tasks: "./modules/tasks.js",
    teams: "./modules/teams.js",
    admin: "./modules/admin.js"
  };
  return Promise.allSettled((keys || []).filter(key => modules[key]).map(key => {
    const path = modules[key];
    let promise = moduleCache.get(path);
    if (!promise) {
      promise = import(versionedModule(path, moduleFailures.get(path) || 0));
      moduleCache.set(path, promise);
    }
    return promise.catch(error => {
      if (moduleCache.get(path) === promise) moduleCache.delete(path);
      moduleFailures.set(path, (moduleFailures.get(path) || 0) + 1);
      throw error;
    });
  }));
}

export async function hydratePage(key, context = {}) {
  if (key !== "login") {
    loginHydrationId++;
    googleIdentity.destroyButton();
    loginController = null;
  }
  if (["home", "news", "dates", "about", "contact"].includes(key)) return;
  if (key === "install") return hydrateInstall();
  if (key === "login") return hydrateLogin(context);
  if (key === "fanbuses") return;
  if (key === "profile") return feature("./modules/profile.js", "hydrateProfile", context);
  if (key === "dashboard") return feature("./modules/dashboard.js", "hydrateDashboard", context);
  if (key === "fanclub") return feature("./modules/fanclub.js", "hydrateFanclub", context);
  if (key === "tasks") return feature("./modules/tasks.js", "hydrateTasks", context);
  if (key === "teams") return feature("./modules/teams.js", "hydrateTeams", context);
  if (key === "admin") return feature("./modules/admin.js", "hydrateAdmin", context);
}

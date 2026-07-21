import { auth } from "./auth.js";
import { renderGoogleSignInButton } from "./google-signin.js";
import { CONFIG } from "./config.js";
import { navigate } from "./router.js";
import { showToast } from "./ui.js";
import { installState, requestInstall } from "./install.js";

const moduleCache = new Map();

async function feature(path, exportName, context) {
  let modulePromise = moduleCache.get(path);
  if (!modulePromise) {
    modulePromise = import(path);
    moduleCache.set(path, modulePromise);
  }
  const module = await modulePromise;
  return module[exportName]?.(context);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function hydrateInstall() {
  const state = installState();
  const instructions = document.getElementById("installInstructions");
  const button = document.getElementById("pageInstallButton");
  if (instructions) {
    instructions.innerHTML = state.ios
      ? "<p>Öffne das Teilen-Menü und wähle <strong>Zum Home-Bildschirm</strong>.</p>"
      : "<p>Nutze den Installieren-Button oder das Installationssymbol deines Browsers.</p>";
  }
  if (button) {
    button.hidden = state.standalone || state.ios;
    button.addEventListener("click", async () => {
      const result = await requestInstall();
      setText("installResult", result.installed ? "Installation gestartet." : "Installation wird auf diesem Gerät derzeit nicht angeboten.");
    });
  }
}

async function hydrateLogin() {
  await auth.initialize();

  const slot = document.getElementById("googleSignInButton");
  const status = document.getElementById("googleSignInStatus");

  const setStatus = value => {
    if (status) status.textContent = value;
  };

  const render = async () => {
    const state = auth.current();
    if (!slot) return;

    if (!CONFIG.supabase.configured) {
      setText(
        "loginMessage",
        "Die lokale Runtime-Konfiguration wurde noch nicht erzeugt."
      );
      slot.innerHTML =
        '<div class="notice warning">Die Supabase-DEV-Verbindung ist noch nicht verfügbar.</div>';
      return;
    }

    if (!state.authenticated) {
      setText(
        "loginMessage",
        "Melde dich sicher mit deinem Google-Konto an."
      );

      if (!CONFIG.auth.googleClientId) {
        slot.innerHTML =
          '<div class="notice error">Die öffentliche Google Client-ID fehlt.</div>';
        setStatus("Die Anmeldung ist noch nicht vollständig konfiguriert.");
        return;
      }

      try {
        setStatus("");

        await renderGoogleSignInButton(slot, {
          clientId: CONFIG.auth.googleClientId,
          onCredential: async (response, nonce) => {
            slot.setAttribute("aria-busy", "true");
            setStatus("Google-Anmeldung wird sicher geprüft …");

            try {
              const nextState = await auth.signInWithGoogleIdToken(
                response?.credential,
                nonce
              );
              navigate(
                nextState.status === "ACTIVE" ? "dashboard" : "profile",
                null,
                true
              );
            } catch (error) {
              showToast(
                error?.message
                  || "Google-Anmeldung konnte nicht abgeschlossen werden.",
                "error",
                7000
              );
              setStatus("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
            } finally {
              slot.setAttribute("aria-busy", "false");
            }
          }
        });
      } catch (error) {
        slot.innerHTML =
          '<div class="notice error">Google-Anmeldung konnte nicht geladen werden.</div>';
        setStatus(error?.message || "Google Identity Services ist nicht verfügbar.");
        showToast(
          error?.message || "Google-Anmeldung konnte nicht geladen werden.",
          "error",
          7000
        );
      }

      return;
    }

    if (state.busy || state.status === "LOADING") {
      setText(
        "loginMessage",
        "Portalstatus und Berechtigungen werden geladen …"
      );
      slot.innerHTML =
        '<div class="notice">Anmeldung wird geprüft …</div>';
      setStatus("");
      return;
    }

    if (state.status === "ACTIVE") {
      setText(
        "loginMessage",
        `Du bist als ${state.user?.name || "Portaluser"} angemeldet.`
      );
      slot.innerHTML =
        '<button id="loginDashboardButton" class="button primary" type="button">Zum Dashboard</button>';
      document.getElementById("loginDashboardButton")
        ?.addEventListener("click", () => navigate("dashboard"));
      setStatus("");
      return;
    }

    setText(
      "loginMessage",
      "Dein Konto ist angemeldet. Schließe jetzt die Portalregistrierung ab."
    );
    slot.innerHTML =
      '<button id="loginProfileButton" class="button primary" type="button">Registrierung fortsetzen</button>';
    document.getElementById("loginProfileButton")
      ?.addEventListener("click", () => navigate("profile"));
    setStatus("");
  };

  await render();
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
  return Promise.allSettled(
    keys.filter(key => modules[key]).map(key => feature(modules[key], "noop", {}))
  );
}

export async function hydratePage(key, context = {}) {
  if (["home", "news", "dates", "about", "contact", "fanbuses"].includes(key)) return;
  if (key === "install") return hydrateInstall();
  if (key === "login") return hydrateLogin();
  if (key === "profile") return feature("./modules/profile.js", "hydrateProfile", context);
  if (key === "dashboard") return feature("./modules/dashboard.js", "hydrateDashboard", context);
  if (key === "fanclub") return feature("./modules/fanclub.js", "hydrateFanclub", context);
  if (key === "tasks") return feature("./modules/tasks.js", "hydrateTasks", context);
  if (key === "teams") return feature("./modules/teams.js", "hydrateTeams", context);
  if (key === "admin") return feature("./modules/admin.js", "hydrateAdmin", context);
}

import { auth } from "./auth.js";
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
  const current = auth.current();
  const slot = document.getElementById("googleSignInButton");
  const retry = document.getElementById("loginRetryButton");
  const pill = document.getElementById("loginStatusPill");

  setText(
    "bridgeStatusText",
    CONFIG.supabase.configured
      ? `Supabase ${CONFIG.supabase.environment} ist konfiguriert.`
      : "Supabase-Verbindung fehlt."
  );
  setText(
    "oauthStatusText",
    CONFIG.supabase.configured
      ? "Google-Anmeldung wird durch Supabase Auth verarbeitet."
      : "Google-Anmeldung ist noch nicht verfügbar."
  );

  const render = () => {
    const state = auth.current();
    if (!slot) return;

    if (!CONFIG.supabase.configured) {
      if (pill) {
        pill.textContent = "Nicht konfiguriert";
        pill.className = "status-pill warning";
      }
      setText("loginMessage", "Die lokale Runtime-Konfiguration wurde noch nicht erzeugt.");
      slot.innerHTML = '<div class="notice warning">Führe den V4-Core-Operator aus oder hinterlege die Supabase-DEV-Konfiguration.</div>';
      return;
    }

    if (!state.authenticated) {
      if (pill) {
        pill.textContent = "Bereit";
        pill.className = "status-pill success";
      }
      setText("loginMessage", "Melde dich sicher mit deinem Google-Konto an.");
      slot.innerHTML = '<button id="supabaseGoogleLogin" class="button primary v4-google-button" type="button"><span aria-hidden="true">G</span> Mit Google anmelden</button>';
      document.getElementById("supabaseGoogleLogin")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Weiter zu Google …";
        try {
          auth.rememberPostLoginRoute("#/dashboard");
          await auth.signInWithGoogle();
        } catch (error) {
          showToast(error?.message || "Google-Anmeldung konnte nicht gestartet werden.", "error", 6500);
          button.disabled = false;
          button.innerHTML = '<span aria-hidden="true">G</span> Mit Google anmelden';
        }
      });
      return;
    }

    if (state.busy || state.status === "LOADING") {
      if (pill) {
        pill.textContent = "Wird geprüft";
        pill.className = "status-pill warning";
      }
      setText("loginMessage", "Portalstatus und Berechtigungen werden geladen …");
      slot.innerHTML = '<div class="notice">Anmeldung wird geprüft …</div>';
      return;
    }

    if (state.status === "ACTIVE") {
      if (pill) {
        pill.textContent = "Angemeldet";
        pill.className = "status-pill success";
      }
      setText("loginMessage", `Du bist als ${state.user?.name || "Portaluser"} angemeldet.`);
      slot.innerHTML = '<button id="loginDashboardButton" class="button primary" type="button">Zum Dashboard</button>';
      document.getElementById("loginDashboardButton")?.addEventListener("click", () => navigate("dashboard"));
      return;
    }

    if (pill) {
      pill.textContent = state.status === "PENDING" ? "Freigabe ausstehend" : "Angaben erforderlich";
      pill.className = "status-pill warning";
    }
    setText("loginMessage", "Dein Konto ist angemeldet. Schließe jetzt die Portalregistrierung ab.");
    slot.innerHTML = '<button id="loginProfileButton" class="button primary" type="button">Registrierung fortsetzen</button>';
    document.getElementById("loginProfileButton")?.addEventListener("click", () => navigate("profile"));
  };

  render();
  retry?.addEventListener("click", async () => {
    try {
      await auth.refresh();
      render();
    } catch (error) {
      showToast(error?.message || "Status konnte nicht aktualisiert werden.", "error", 6500);
    }
  });
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

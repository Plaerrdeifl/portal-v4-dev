import { auth } from "./auth.js";
import { renderGoogleSignInButton } from "./google-signin.js";
import { CONFIG } from "./config.js?v=20260724-dashboard-delivery-corr2";
import { showToast } from "./ui.js";

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
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true
    || window.navigator.standalone === true;

  const instructions = document.getElementById("installInstructions");
  const result = document.getElementById("installResult");

  setText(
    "installIntro",
    standalone
      ? "Das Plärrdeifl Portal läuft bereits als installierte App."
      : "Füge das Plärrdeifl Portal über das Menü deines Smartphones zum Home-Bildschirm hinzu."
  );

  if (instructions) instructions.hidden = standalone;
  if (result) {
    result.hidden = !standalone;
    result.textContent = standalone
      ? "Das Portal ist auf diesem Gerät bereits als App geöffnet."
      : "";
  }
}

async function hydrateLogin(context = {}) {
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
      setText("loginMessage", "Die lokale Runtime-Konfiguration wurde noch nicht erzeugt.");
      slot.innerHTML = '<div class="notice warning">Die Supabase-DEV-Verbindung ist noch nicht verfügbar.</div>';
      return;
    }

    if (!state.authenticated) {
      setText("loginMessage", "Melde dich sicher mit deinem Google-Konto an.");
      if (!CONFIG.auth.googleClientId) {
        slot.innerHTML = '<div class="notice error">Die öffentliche Google Client-ID fehlt.</div>';
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
              if (typeof context.onGoogleCredential !== "function") {
                throw new Error("Der zentrale Anmeldeübergang ist nicht verfügbar.");
              }
              await context.onGoogleCredential(response, nonce);
            } catch (error) {
              showToast(error?.message || "Google-Anmeldung konnte nicht abgeschlossen werden.", "error", 7000);
              setStatus("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
            } finally {
              slot.setAttribute("aria-busy", "false");
            }
          }
        });
      } catch (error) {
        slot.innerHTML = '<div class="notice error">Google-Anmeldung konnte nicht geladen werden.</div>';
        setStatus(error?.message || "Google Identity Services ist nicht verfügbar.");
        showToast(error?.message || "Google-Anmeldung konnte nicht geladen werden.", "error", 7000);
      }
      return;
    }

    if (state.busy || state.status === "LOADING") {
      setText("loginMessage", "Portalstatus und Berechtigungen werden geladen …");
      slot.innerHTML = '<div class="notice">Anmeldung wird geprüft …</div>';
      setStatus("");
      return;
    }

    if (state.status === "ACTIVE") {
      setText("loginMessage", `Du bist als ${state.user?.name || "Portaluser"} angemeldet.`);
      slot.innerHTML = '<div class="notice success">Portalzugang ist aktiv.</div>';
      setStatus("");
      return;
    }

    setText("loginMessage", "Dein Konto ist angemeldet. Die Portalregistrierung wird vorbereitet.");
    slot.innerHTML = '<div class="notice">Registrierung wird vorbereitet …</div>';
    setStatus("");
  };

  await render();
}

export function preloadAuthenticatedModules(keys = ["dashboard", "dates", "fanclub", "tasks", "teams", "admin"]) {
  const modules = {
    profile: "./modules/profile.js",
    dashboard: "./modules/dashboard.js?v=20260724-dashboard-delivery-corr2&feature=20260724-personal-dashboard-widgets-r1-fix4&small=20260725-dashboard-small-widgets-r1",
    dates: "./modules/dates.js",
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
  if (["home", "news", "about", "contact"].includes(key)) return;
  if (key === "install") return hydrateInstall();
  if (key === "login") return hydrateLogin(context);
  if (key === "profile") return feature("./modules/profile.js", "hydrateProfile", context);
  if (key === "dashboard") return feature("./modules/dashboard.js?v=20260724-dashboard-delivery-corr2&feature=20260724-personal-dashboard-widgets-r1-fix4&small=20260725-dashboard-small-widgets-r1", "hydrateDashboard", context);
  if (key === "dates") return feature("./modules/dates.js", "hydrateDates", context);
  if (key === "fanbuses") {
    const result = await feature("./modules/fanbuses.js?v=20260826-p800-r2-final-direct-fix&groups=20260828-m310-r1&m327=20260828-m327-r1&completion=20260829-m328-final1&correction=20260830-m328-c1", "hydrateFanbuses", context);
    await feature("./m327-r1-acceptance-polish.js?v=20260829-m327-r1-acceptance1", "setupM327AcceptancePolish", context);
    await feature("./m328-bus-orga-shell.js?v=20260829-m328-r1-rider-reactivate2&completion=20260829-m328-final1", "setupM328BusOrgaShell", context);
    return result;
  }
  if (key === "bus-orga") {
    const result = await feature(
      "./modules/bus-orga-v3.js?v=20260829-m328-r1-next-trip-venue1&fix=20260829-m328-r1-next-trip-cancelled1&ux=20260829-m328-r1-registration-ux-correction1&modal=20260829-m328-r1-decision-click1&state=20260829-m328-r1-booking-state2&cards=20260829-m328-r1-active-person-cards2&rows=20260829-m328-r1-participant-row-edit1&prepared=20260829-m328-r1-prepared-density1&participant-click=20260829-m328-r1-active-person-click1&completion=20260829-m328-final1&correction=20260830-m328-c2&defaults=20260830-m328-draft-defaults1&tripedit=20260830-m328-trip-edit-compact1",
      "hydrateBusOrgaV3",
      context
    );
    await feature(
      "./modules/bus-orga-registration-flow-wording.js?v=20260829-m328-r1-flow-wording2",
      "setupM328RegistrationFlowWording",
      context
    );
    return result;
  }
  if (key === "fanclub") return feature("./modules/fanclub.js", "hydrateFanclub", context);
  if (key === "tasks") return feature("./modules/tasks.js", "hydrateTasks", context);
  if (key === "teams") return feature("./modules/teams.js", "hydrateTeams", context);
  if (key === "admin") return feature("./modules/admin.js", "hydrateAdmin", context);
}

import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import {
  currentRoute,
  legacyRouteRedirect,
  navigate,
  routes
} from "./router.js";
import { hydratePage } from "./pages.js";
import { activateUpdate, initializeInstall } from "./install.js";
import {
  bindGlobalUi,
  loadFragment,
  mountComponents,
  renderNavigation,
  setConnectionStatus,
  setRouteHeader,
  showToast,
  updateActiveNavigation,
  updateUserChrome
} from "./ui.js";

let renderSequence = 0;
let authEventQueued = false;
let apiActivity = api.activity();

const OAUTH_CHANNEL_NAME = "pd-v4-oauth";
const OAUTH_POPUP_NAME = "pdGoogleAuth";

let oauthChannel = null;
let oauthSyncPromise = null;
const handledOAuthMessages = new Set();

function hasOAuthCallback() {
  const params = new URLSearchParams(location.search);

  return (
    params.has("code")
    || params.has("error")
    || params.has("error_description")
  );
}

function cleanOAuthLocation(hash) {
  const target = new URL(location.href);
  target.search = "";
  target.hash = hash;
  history.replaceState(null, "", target.toString());
}

function oauthTarget(current, consumeStoredRoute = true) {
  if (!current.authenticated) return "#/login";
  if (current.status !== "ACTIVE") return "#/profile";

  const stored = consumeStoredRoute
    ? auth.consumePostLoginRoute()
    : "";

  return stored || "#/dashboard";
}

function notifyOAuthCompletion(detail) {
  const payload = {
    type: "pd-oauth-complete",
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...detail
  };

  try {
    window.opener?.postMessage(payload, location.origin);
  } catch (error) {
    console.debug("OAuth-Popup konnte den Öffner nicht direkt informieren", error);
  }

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  }
}

async function prepareOAuthReturn() {
  if (!hasOAuthCallback()) return false;

  const popupReturn = window.name === OAUTH_POPUP_NAME;
  const current = await auth.initialize();

  if (popupReturn) {
    notifyOAuthCompletion({
      ok: current.authenticated,
      message: current.error?.message || ""
    });

    window.close();
    return true;
  }

  cleanOAuthLocation(oauthTarget(current));
  document.documentElement.removeAttribute("data-oauth-return");
  return false;
}

async function acceptOAuthCompletion(detail = {}) {
  if (detail.type !== "pd-oauth-complete") return;

  if (detail.id && handledOAuthMessages.has(detail.id)) return;
  if (detail.id) handledOAuthMessages.add(detail.id);

  document.body.classList.remove("oauth-popup-open");
  window.dispatchEvent(
    new CustomEvent("pd-oauth-popup-finished", { detail })
  );

  if (!detail.ok) {
    showToast(
      detail.message || "Google-Anmeldung wurde nicht abgeschlossen.",
      "error",
      6500
    );
    return;
  }

  if (oauthSyncPromise) return oauthSyncPromise;

  oauthSyncPromise = auth.syncSession()
    .then(current => {
      if (!current.authenticated) {
        throw new Error(
          "Die Google-Anmeldung wurde abgeschlossen, aber die Sitzung konnte nicht übernommen werden."
        );
      }
    })
    .catch(error => {
      showToast(
        error?.message || "Google-Anmeldung konnte nicht übernommen werden.",
        "error",
        7000
      );
    })
    .finally(() => {
      oauthSyncPromise = null;
    });

  return oauthSyncPromise;
}

function bindOAuthPopupCompletion() {
  window.addEventListener("message", event => {
    if (event.origin !== location.origin) return;
    acceptOAuthCompletion(event.data);
  });

  if ("BroadcastChannel" in window) {
    oauthChannel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
    oauthChannel.addEventListener("message", event => {
      acceptOAuthCompletion(event.data);
    });
  }
}

function connectionState() {
  const current = auth.current();

  if (!navigator.onLine) {
    return { label: "Offline", type: "error" };
  }

  if (!CONFIG.supabase.configured) {
    return { label: "Fehler", type: "error" };
  }

  if (current.error || apiActivity.error) {
    return { label: "Fehler", type: "error" };
  }

  if (current.busy || apiActivity.busy) {
    return { label: "Lädt", type: "loading" };
  }

  if (!current.authenticated) {
    return { label: "Online", type: "success" };
  }

  if (current.status === "ACTIVE") {
    return { label: "Live", type: "success" };
  }

  if (current.status === "BLOCKED") {
    return { label: "Gesperrt", type: "error" };
  }

  return { label: "Prüfung", type: "loading" };
}

function updateChrome() {
  renderNavigation();
  updateUserChrome();
  updateActiveNavigation();

  const connection = connectionState();
  setConnectionStatus(connection.label, connection.type);
}

async function ensureAuthForRoute(key) {
  const route = routes()[key];
  if (!route || (route.public && key !== "login")) return;
  await auth.initialize();
}

function enforceRoute(key) {
  const route = routes()[key];
  if (!route) return "home";
  if (route.public) return key;

  if (!auth.isAuthenticated()) {
    auth.rememberPostLoginRoute(location.hash);
    return "login";
  }

  if (auth.requiresProfile()) return "profile";
  if (!auth.canAccessRoute(key)) return "dashboard";
  return key;
}

async function renderRoute() {
  if (legacyRouteRedirect()) return;

  const requested = currentRoute();
  await ensureAuthForRoute(requested);

  const allowed = enforceRoute(requested);

  if (allowed !== requested) {
    navigate(allowed, null, true);
    return;
  }

  const route = routes()[allowed];
  const renderId = ++renderSequence;

  setRouteHeader(route);
  updateChrome();
  document.documentElement.dataset.route = allowed;

  const view = document.getElementById("view");
  if (!view) return;

  try {
    const html = await loadFragment(`./pages/${route.page}`, {
      force: true
    });

    if (
      renderId !== renderSequence
      || currentRoute() !== allowed
    ) {
      return;
    }

    view.innerHTML = html;

    await hydratePage(allowed, {
      isCurrent: () =>
        renderId === renderSequence
        && currentRoute() === allowed
    });

    if (renderId !== renderSequence) return;

    view.focus({ preventScroll: true });
    view.scrollTo({ top: 0, behavior: "instant" });
  } catch (error) {
    if (renderId !== renderSequence) return;

    view.innerHTML = `<section class="page">
      <article class="card notice error">
        <h2>Seite konnte nicht geladen werden</h2>
        <p>${String(error?.message || error)}</p>
      </article>
    </section>`;

    showToast(
      error?.message || "Seite konnte nicht geladen werden.",
      "error",
      7000
    );
  }
}

function handleAuthChange() {
  if (authEventQueued) return;

  authEventQueued = true;

  window.setTimeout(async () => {
    authEventQueued = false;
    updateChrome();

    const current = auth.current();

    if (
      current.authenticated
      && !current.busy
      && current.status !== "LOADING"
    ) {
      const postLogin = auth.consumePostLoginRoute();

      if (postLogin) {
        const target =
          current.status === "ACTIVE"
            ? postLogin
            : "#/profile";

        if (location.hash !== target) {
          location.hash = target;
          return;
        }
      }

      if (currentRoute() === "login") {
        navigate(
          current.status === "ACTIVE"
            ? "dashboard"
            : "profile",
          null,
          true
        );
        return;
      }
    }

    if (
      !current.authenticated
      && !routes()[currentRoute()]?.public
    ) {
      navigate("login", null, true);
      return;
    }

    await renderRoute();
  }, 0);
}

async function refreshCurrentView() {
  try {
    if (auth.isAuthenticated()) {
      await auth.refresh();
    }

    await renderRoute();
    showToast("Ansicht wurde aktualisiert.", "success");
  } catch (error) {
    showToast(
      error?.message || "Aktualisierung fehlgeschlagen.",
      "error",
      6500
    );
  }
}

async function logout() {
  try {
    await auth.logout();
    navigate("home", null, true);
    showToast("Du wurdest abgemeldet.", "success");
  } catch (error) {
    showToast(
      error?.message || "Abmeldung fehlgeschlagen.",
      "error",
      6500
    );
  }
}

async function bootstrap() {
  const popupHandled = await prepareOAuthReturn();
  if (popupHandled) return;

  document.documentElement.removeAttribute("data-oauth-return");
  await mountComponents();

  bindGlobalUi({
    onRefresh: refreshCurrentView,
    onLogout: logout
  });

  bindOAuthPopupCompletion();
  initializeInstall();

  window.addEventListener("pd-update-available", () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.hidden = false;
  });

  document.getElementById("updateButton")
    ?.addEventListener("click", () => activateUpdate());

  document.getElementById("updateDismiss")
    ?.addEventListener("click", () => {
      const banner = document.getElementById("updateBanner");
      if (banner) banner.hidden = true;
    });

  navigator.serviceWorker?.addEventListener(
    "controllerchange",
    () => location.reload()
  );

  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("pd-auth-change", handleAuthChange);
  window.addEventListener("pd-api-state", event => {
    apiActivity = event.detail || api.activity();
    const connection = connectionState();
    setConnectionStatus(connection.label, connection.type);
  });

  window.addEventListener("online", refreshCurrentView);
  window.addEventListener("offline", updateChrome);

  if (!location.hash) {
    history.replaceState(null, "", "#/home");
  }

  await renderRoute();

  window.setTimeout(() => {
    auth.initialize().catch(error => {
      console.error(
        "Supabase Auth konnte nicht initialisiert werden",
        error
      );
    });
  }, 80);
}

bootstrap().catch(error => {
  console.error(error);
  showToast(
    error?.message || "Portalstart fehlgeschlagen.",
    "error",
    9000
  );
});

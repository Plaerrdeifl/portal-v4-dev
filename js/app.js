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
let authTransitionActive = false;

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
    return { label: "Lädt …", type: "loading" };
  }

  if (!current.authenticated) {
    return { label: "Live", type: "success" };
  }

  if (current.status === "ACTIVE") {
    return { label: "Live", type: "success" };
  }

  if (current.status === "BLOCKED") {
    return { label: "Fehler", type: "error" };
  }

  return { label: "Lädt …", type: "loading" };
}

function setAuthTransition(active, status = "Portal wird vorbereitet …") {
  authTransitionActive = Boolean(active);
  document.documentElement.dataset.authReady = active ? "false" : "true";

  const splash = document.getElementById("appSplash");
  if (!splash) return;

  splash.hidden = !active;
  splash.setAttribute("aria-busy", active ? "true" : "false");
  const statusNode = document.getElementById("splashStatus");
  if (statusNode && status) statusNode.textContent = status;
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
  if (authTransitionActive || authEventQueued) return;

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
  setAuthTransition(true, "Abmeldung wird abgeschlossen …");

  try {
    history.replaceState(null, "", "#/home");
    await auth.logout();
    updateChrome();
    await renderRoute();
    showToast("Du wurdest abgemeldet.", "success");
  } catch (error) {
    showToast(
      error?.message || "Abmeldung fehlgeschlagen.",
      "error",
      6500
    );
  } finally {
    setAuthTransition(false);
  }
}

async function bootstrap() {
  setAuthTransition(true, "Portalstatus wird geprüft …");
  const hadInitialHash = Boolean(location.hash);

  await mountComponents();

  bindGlobalUi({
    onRefresh: refreshCurrentView,
    onLogout: logout
  });

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
  window.addEventListener("pd-api-state", event => {
    apiActivity = event.detail || api.activity();
    const connection = connectionState();
    setConnectionStatus(connection.label, connection.type);
  });

  window.addEventListener("online", refreshCurrentView);
  window.addEventListener("offline", updateChrome);

  await auth.initialize();
  window.addEventListener("pd-auth-change", handleAuthChange);

  if (!hadInitialHash) {
    const current = auth.current();
    const initialRoute = !current.authenticated
      ? "home"
      : current.status === "ACTIVE"
        ? "dashboard"
        : "profile";
    history.replaceState(null, "", `#/${initialRoute}`);
  }

  await renderRoute();
  setAuthTransition(false);
}

bootstrap().catch(error => {
  setAuthTransition(false);
  console.error(error);
  showToast(
    error?.message || "Portalstart fehlgeschlagen.",
    "error",
    9000
  );
});

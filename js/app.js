import { CONFIG } from "./config.js";
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

function connectionState() {
  const current = auth.current();
  if (!CONFIG.supabase.configured) {
    return { label: "Supabase nicht konfiguriert", type: "warning" };
  }
  if (current.busy) {
    return { label: "Portalstatus wird geprüft", type: "warning" };
  }
  if (!current.authenticated) {
    return { label: "Öffentlicher Bereich", type: "success" };
  }
  if (current.status === "ACTIVE") {
    return { label: "Sicher verbunden", type: "success" };
  }
  if (current.status === "BLOCKED") {
    return { label: "Zugang gesperrt", type: "error" };
  }
  return { label: "Registrierung unvollständig", type: "warning" };
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
    const html = await loadFragment(`./pages/${route.page}`, { force: true });
    if (renderId !== renderSequence || currentRoute() !== allowed) return;
    view.innerHTML = html;
    await hydratePage(allowed, {
      isCurrent: () => renderId === renderSequence && currentRoute() === allowed
    });
    if (renderId !== renderSequence) return;
    view.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch (error) {
    if (renderId !== renderSequence) return;
    view.innerHTML = `<section class="page"><article class="card notice error"><h2>Seite konnte nicht geladen werden</h2><p>${String(error?.message || error)}</p></article></section>`;
    showToast(error?.message || "Seite konnte nicht geladen werden.", "error", 7000);
  }
}

function handleAuthChange() {
  if (authEventQueued) return;
  authEventQueued = true;
  window.setTimeout(async () => {
    authEventQueued = false;
    updateChrome();
    const current = auth.current();

    if (current.authenticated && !current.busy && current.status !== "LOADING") {
      const postLogin = auth.consumePostLoginRoute();
      if (postLogin) {
        const target = current.status === "ACTIVE" ? postLogin : "#/profile";
        if (location.hash !== target) {
          location.hash = target;
          return;
        }
      }
      if (currentRoute() === "login") {
        navigate(current.status === "ACTIVE" ? "dashboard" : "profile", null, true);
        return;
      }
    }

    if (!current.authenticated && !routes()[currentRoute()]?.public) {
      navigate("login", null, true);
      return;
    }

    await renderRoute();
  }, 0);
}

async function refreshCurrentView() {
  try {
    if (auth.isAuthenticated()) await auth.refresh();
    await renderRoute();
    showToast("Ansicht wurde aktualisiert.", "success");
  } catch (error) {
    showToast(error?.message || "Aktualisierung fehlgeschlagen.", "error", 6500);
  }
}

async function logout() {
  try {
    await auth.logout();
    navigate("home", null, true);
    showToast("Du wurdest abgemeldet.", "success");
  } catch (error) {
    showToast(error?.message || "Abmeldung fehlgeschlagen.", "error", 6500);
  }
}

async function bootstrap() {
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
  document.getElementById("updateButton")?.addEventListener("click", () => activateUpdate());
  document.getElementById("updateDismiss")?.addEventListener("click", () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.hidden = true;
  });
  navigator.serviceWorker?.addEventListener("controllerchange", () => location.reload());

  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("pd-auth-change", handleAuthChange);
  window.addEventListener("online", refreshCurrentView);
  window.addEventListener("offline", updateChrome);

  if (!location.hash) history.replaceState(null, "", "#/home");
  await renderRoute();

  window.setTimeout(() => {
    auth.initialize().catch(error => {
      console.error("Supabase Auth konnte nicht initialisiert werden", error);
    });
  }, 80);

  document.getElementById("buildLabel").textContent = `${CONFIG.app.version} · ${CONFIG.app.build}`;
}

bootstrap().catch(error => {
  console.error(error);
  showToast(error?.message || "Portalstart fehlgeschlagen.", "error", 9000);
});

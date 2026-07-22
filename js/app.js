import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import {
  currentRoute,
  legacyRouteRedirect,
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

function afterNextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function replaceHash(target) {
  const normalized = String(target || "#/home");
  const hash = normalized.startsWith("#/")
    ? normalized
    : `#/${normalized.replace(/^#?\/?/, "")}`;
  history.replaceState(null, "", hash);
}

function authenticatedTarget(current, consumeRemembered = false) {
  if (consumeRemembered) {
    const remembered = auth.consumePostLoginRoute();
    if (remembered && current.status === "ACTIVE") return remembered;
  }

  return current.status === "ACTIVE" ? "#/dashboard" : "#/profile";
}

function setAuthTransition(active, status = "Portal wird vorbereitet …") {
  authTransitionActive = Boolean(active);
  document.documentElement.dataset.authTransition = active ? "true" : "false";

  const shell = document.getElementById("appShell");
  if (shell) shell.inert = Boolean(active);

  const splash = document.getElementById("appSplash");
  if (!splash) return;

  splash.hidden = !active;
  splash.setAttribute("aria-busy", active ? "true" : "false");
  const statusNode = document.getElementById("splashStatus");
  if (statusNode && status) statusNode.textContent = status;
}

async function runAuthTransition({ status, operation, target, successMessage = "" }) {
  if (authTransitionActive) {
    throw new Error("Ein Anmeldewechsel wird bereits verarbeitet.");
  }

  setAuthTransition(true, status);
  ++renderSequence;

  try {
    const result = await operation();
    const resolvedTarget = typeof target === "function"
      ? target(result || auth.current())
      : target;

    replaceHash(resolvedTarget || "#/home");
    await renderRoute();
    await afterNextPaint();

    if (successMessage) showToast(successMessage, "success");
    return result;
  } finally {
    await afterNextPaint();
    setAuthTransition(false);
  }
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
    replaceHash(allowed);
    return renderRoute();
  }

  const route = routes()[allowed];
  const renderId = ++renderSequence;

  setRouteHeader(route);
  updateChrome();
  document.documentElement.dataset.route = allowed;

  const view = document.getElementById("view");
  if (!view) return;

  try {
    const html = await loadFragment(`./pages/${route.page}`);

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
        && currentRoute() === allowed,
      onGoogleCredential: signInWithGoogleCredential
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

  queueMicrotask(async () => {
    authEventQueued = false;
    updateChrome();

    const current = auth.current();
    if (current.busy || current.status === "LOADING") return;

    const route = routes()[currentRoute()];

    if (current.authenticated && currentRoute() === "login") {
      replaceHash(authenticatedTarget(current, true));
    } else if (!current.authenticated && !route?.public) {
      replaceHash("#/login");
    }

    await renderRoute();
  });
}

async function signInWithGoogleCredential(response, nonce) {
  return runAuthTransition({
    status: "Google-Anmeldung wird sicher geprüft …",
    operation: () => auth.signInWithGoogleIdToken(response?.credential, nonce),
    target: current => authenticatedTarget(current, true)
  });
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
    await runAuthTransition({
      status: "Abmeldung wird abgeschlossen …",
      operation: () => auth.logout(),
      target: "#/home",
      successMessage: "Du wurdest abgemeldet."
    });
  } catch (error) {
    showToast(
      error?.message || "Abmeldung fehlgeschlagen.",
      "error",
      6500
    );
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

  window.addEventListener("hashchange", () => {
    if (!authTransitionActive) renderRoute();
  });
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
    replaceHash(
      !current.authenticated
        ? "#/home"
        : authenticatedTarget(current)
    );
  }

  await renderRoute();
  await afterNextPaint();
  setAuthTransition(false);
}

bootstrap().catch(async error => {
  await afterNextPaint();
  setAuthTransition(false);
  console.error(error);
  showToast(
    error?.message || "Portalstart fehlgeschlagen.",
    "error",
    9000
  );
});

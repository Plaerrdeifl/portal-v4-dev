import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, fixedAuthenticatedOrder, navigate, routes } from "./router.js";

const fragmentCache = new Map();
const fragmentPromises = new Map();

function fragmentKey(path) {
  return new URL(path, location.href).href;
}

function abortError() {
  try {
    return new DOMException("Abgebrochen", "AbortError");
  } catch (error) {
    const fallback = new Error("Abgebrochen");
    fallback.name = "AbortError";
    return fallback;
  }
}

export function hasFragment(path) {
  return fragmentCache.has(fragmentKey(path));
}

export async function loadFragment(path, { signal, force = false } = {}) {
  const key = fragmentKey(path);
  if (!force && fragmentCache.has(key)) return fragmentCache.get(key);
  if (signal?.aborted) throw abortError();

  let promise = !force ? fragmentPromises.get(key) : null;
  if (!promise) {
    promise = fetch(path, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`Datei konnte nicht geladen werden: ${path}`);
        return response.text();
      })
      .then(text => {
        fragmentCache.set(key, text);
        return text;
      })
      .finally(() => {
        if (fragmentPromises.get(key) === promise) fragmentPromises.delete(key);
      });
    fragmentPromises.set(key, promise);
  }

  const text = await promise;
  if (signal?.aborted) throw abortError();
  return text;
}

export async function mountComponents() {
  const [sidebar, topbar] = await Promise.all([
    loadFragment("./components/sidebar.html"),
    loadFragment("./components/topbar.html")
  ]);
  document.getElementById("sidebarSlot").innerHTML = sidebar;
  document.getElementById("topbarSlot").innerHTML = topbar;
}

export function visibleRouteEntries() {
  if (!auth.isAuthenticated()) {
    return Object.entries(routes())
      .filter(([, route]) => route.public)
      .sort((a, b) => (a[1].publicOrder || 0) - (b[1].publicOrder || 0));
  }
  if (auth.requiresProfile()) return [["profile", routes().profile]];
  return fixedAuthenticatedOrder()
    .filter(key => auth.canAccessRoute(key))
    .map(key => [key, routes()[key]]);
}

export function renderNavigation() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  nav.replaceChildren(...visibleRouteEntries().map(([key, route]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.route = key;
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = route.icon;
    const label = document.createElement("span");
    label.textContent = route.title;
    button.append(icon, label);
    return button;
  }));
  updateActiveNavigation();
}

export function updateActiveNavigation() {
  const active = currentRoute();
  document.querySelectorAll("#mainNav [data-route]").forEach(element => {
    element.classList.toggle("active", element.dataset.route === active);
  });
}

export function updateUserChrome() {
  const current = auth.current();
  const summary = document.getElementById("userSummary");
  const logout = document.getElementById("logoutButton");
  if (summary) summary.hidden = !current.authenticated;
  if (logout) logout.hidden = !current.authenticated;
  if (current.authenticated && current.user) {
    const first = current.user.firstName || current.user.vorname || "";
    const last = current.user.lastName || current.user.nachname || "";
    const name = `${first} ${last}`.trim() || current.user.name || "Profil unvollständig";
    document.getElementById("userSummaryName").textContent = name;
    document.getElementById("userSummaryRole").textContent = current.profileRequired
      ? "Profilvervollständigung erforderlich"
      : (current.user.role || "Portaluser");
  }
}

export function bindGlobalUi({ onRefresh, onLogout } = {}) {
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-route]");
    if (target) {
      event.preventDefault();
      const params = new URLSearchParams();
      if (target.dataset.openTab) params.set("tab", target.dataset.openTab);
      navigate(target.dataset.route, params);
      closeMobileMenu();
      return;
    }
    if (event.target.closest("[data-close-menu]")) closeMobileMenu();
  });
  document.getElementById("mobileMenuToggle")?.addEventListener("click", openMobileMenu);
  document.getElementById("refreshButton")?.addEventListener("click", () => onRefresh?.());
  document.getElementById("logoutButton")?.addEventListener("click", () => onLogout?.());
  document.getElementById("buildLabel").textContent = `${CONFIG.app.version} · ${CONFIG.app.build}`;
}

export function setRouteHeader(route) {
  const title = document.getElementById("routeTitle");
  const subtitle = document.getElementById("routeSubtitle");
  if (title) title.textContent = route.title;
  if (subtitle) subtitle.textContent = route.subtitle;
  document.title = `${route.title} · ${CONFIG.app.name}`;
}

export function showToast(message, type = "info", duration = 3200) {
  const region = document.getElementById("toastRegion");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

export function setConnectionStatus(label, type = "success") {
  const status = document.getElementById("connectionStatus");
  if (status) {
    status.textContent = label;
    status.className = `status-pill ${type}`;
  }
}

export function openMobileMenu() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("mobileBackdrop")?.classList.add("show");
}

export function closeMobileMenu() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("mobileBackdrop")?.classList.remove("show");
}

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

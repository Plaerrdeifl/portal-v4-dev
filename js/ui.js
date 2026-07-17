import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, fixedAuthenticatedOrder, navigate, routes } from "./router.js";

const fragmentCache = new Map();
const fragmentPromises = new Map();
const MOBILE_PRIMARY = ["dashboard", "fanclub", "tasks", "teams"];

const ICONS = Object.freeze({
  home: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  fanclub: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tasks: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/></svg>',
  teams: '<svg viewBox="0 0 24 24"><path d="M8 11 3 6l3-3 5 5"/><path d="m16 11 5-5-3-3-5 5"/><path d="m8 13-5 5 3 3 5-5"/><path d="m16 13 5 5-3 3-5-5"/><path d="m9 9 6 6"/></svg>',
  fanbuses: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M7 19v2M17 19v2M4 11h16M8 7h8"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>',
  admin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.36.36.68.6 1 .3.3.68.46 1.1.5h.09v4h-.09c-.42.04-.8.2-1.1.5-.24.32-.45.64-.6 1Z"/></svg>',
  news: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  dates: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  about: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  contact: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  install: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4M12 5v8m-3-3 3 3 3-3"/></svg>',
  login: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
});

function iconMarkup(key) {
  return ICONS[key] || ICONS.more;
}

function fragmentKey(path) {
  return new URL(path, location.href).href;
}

function abortError() {
  try { return new DOMException("Abgebrochen", "AbortError"); }
  catch (error) { const fallback = new Error("Abgebrochen"); fallback.name = "AbortError"; return fallback; }
}

export function hasFragment(path) { return fragmentCache.has(fragmentKey(path)); }

export async function loadFragment(path, { signal, force = false } = {}) {
  const key = fragmentKey(path);
  if (!force && fragmentCache.has(key)) return fragmentCache.get(key);
  if (signal?.aborted) throw abortError();
  let promise = !force ? fragmentPromises.get(key) : null;
  if (!promise) {
    promise = fetch(path, { cache: "no-store" })
      .then(response => { if (!response.ok) throw new Error(`Datei konnte nicht geladen werden: ${path}`); return response.text(); })
      .then(text => { fragmentCache.set(key, text); return text; })
      .finally(() => { if (fragmentPromises.get(key) === promise) fragmentPromises.delete(key); });
    fragmentPromises.set(key, promise);
  }
  const text = await promise;
  if (signal?.aborted) throw abortError();
  return text;
}

export async function mountComponents() {
  const sidebarSlot = document.getElementById("sidebarSlot");
  const topbarSlot = document.getElementById("topbarSlot");
  if (sidebarSlot?.hasChildNodes() && topbarSlot?.hasChildNodes()) return;
  const [sidebar, topbar] = await Promise.all([
    loadFragment("./components/sidebar.html"),
    loadFragment("./components/topbar.html")
  ]);
  if (sidebarSlot) sidebarSlot.innerHTML = sidebar;
  if (topbarSlot) topbarSlot.innerHTML = topbar;
}

export function visibleRouteEntries() {
  const current = routes()[currentRoute()];
  if (current?.public || !auth.isAuthenticated()) {
    const entries = Object.entries(routes())
      .filter(([, route]) => route.public)
      .sort((a, b) => (a[1].publicOrder || 0) - (b[1].publicOrder || 0));
    if (auth.hasPersistedSession()) {
      entries.push(["dashboard", { ...routes().dashboard, title: "Portal öffnen", subtitle: "Gespeicherte Sitzung prüfen und Portal öffnen" }]);
    }
    return entries;
  }
  if (auth.requiresProfile()) return [["profile", routes().profile]];
  return fixedAuthenticatedOrder().filter(key => auth.canAccessRoute(key)).map(key => [key, routes()[key]]);
}

function createRouteButton(key, route, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.route = key;
  if (className) button.className = className;
  const icon = document.createElement("span");
  icon.className = "nav-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = iconMarkup(key);
  const label = document.createElement("span");
  label.textContent = route.title;
  button.append(icon, label);
  return button;
}

function createRegistrationButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.registrationRoute = "true";
  const icon = document.createElement("span");
  icon.className = "nav-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = iconMarkup("profile");
  const label = document.createElement("span");
  label.textContent = "Registrieren";
  button.append(icon, label);
  return button;
}

export function renderNavigation() {
  const entries = visibleRouteEntries();
  const nav = document.getElementById("mainNav");
  if (nav) {
    const buttons = entries.map(([key, route]) => createRouteButton(key, route));
    const publicArea = Boolean(routes()[currentRoute()]?.public) || !auth.isAuthenticated();
    if (publicArea) {
      const loginIndex = entries.findIndex(([key]) => key === "login");
      buttons.splice(loginIndex >= 0 ? loginIndex + 1 : buttons.length, 0, createRegistrationButton());
    }
    nav.replaceChildren(...buttons);
    window.dispatchEvent(new CustomEvent("pd-public-navigation-rendered"));
  }

  const mobileNav = document.getElementById("mobileNav");
  const moreRoutes = document.getElementById("mobileMoreRoutes");
  const authenticated = auth.isAuthenticated() && !auth.requiresProfile() && !routes()[currentRoute()]?.public;
  if (mobileNav) {
    mobileNav.hidden = !authenticated;
    if (authenticated) {
      const entryMap = new Map(entries);
      const primary = MOBILE_PRIMARY.filter(key => entryMap.has(key)).map(key => createRouteButton(key, entryMap.get(key), "mobile-nav-button"));
      const extras = entries.filter(([key]) => !MOBILE_PRIMARY.includes(key));
      if (extras.length) {
        const more = document.createElement("button");
        more.type = "button";
        more.id = "mobileMoreToggle";
        more.className = "mobile-nav-button";
        more.setAttribute("aria-haspopup", "dialog");
        more.innerHTML = `<span class="nav-icon" aria-hidden="true">${iconMarkup("more")}</span><span>Mehr</span>`;
        primary.push(more);
      }
      mobileNav.replaceChildren(...primary);
      if (moreRoutes) moreRoutes.replaceChildren(...extras.map(([key, route]) => createRouteButton(key, route, "mobile-more-route")));
    } else {
      mobileNav.replaceChildren();
      if (moreRoutes) moreRoutes.replaceChildren();
      closeMobileMore();
    }
  }
  updateActiveNavigation();
}

export function updateActiveNavigation() {
  const active = currentRoute();
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const registrationIntent = active === "login" && new URLSearchParams(query).get("intent") === "register";
  document.querySelectorAll("[data-route]").forEach(element => {
    const isActive = element.dataset.route === active && !(active === "login" && registrationIntent);
    element.classList.toggle("active", isActive);
    if (isActive) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-registration-route]").forEach(element => {
    element.classList.toggle("active", registrationIntent);
    if (registrationIntent) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current");
  });
  const more = document.getElementById("mobileMoreToggle");
  if (more) {
    const isExtra = auth.isAuthenticated() && !MOBILE_PRIMARY.includes(active);
    more.classList.toggle("active", isExtra);
    more.classList.toggle("more-active", isExtra);
  }
}

export function updateUserChrome() {
  const current = auth.current();
  const summary = document.getElementById("userSummary");
  const logout = document.getElementById("logoutButton");
  const mobileLogout = document.getElementById("mobileLogoutButton");
  if (summary) summary.hidden = !current.authenticated;
  if (logout) logout.hidden = !current.authenticated;
  if (mobileLogout) mobileLogout.hidden = !current.authenticated;
  if (current.authenticated && current.user) {
    const first = current.user.firstName || current.user.vorname || "";
    const last = current.user.lastName || current.user.nachname || "";
    const name = `${first} ${last}`.trim() || current.user.name || "Profil unvollständig";
    const role = current.profileRequired ? "Profilvervollständigung erforderlich" : (current.user.role || "Portaluser");
    const nameNode = document.getElementById("userSummaryName");
    const roleNode = document.getElementById("userSummaryRole");
    const avatar = document.getElementById("userAvatar");
    if (nameNode) nameNode.textContent = name;
    if (roleNode) roleNode.textContent = role;
    if (avatar) avatar.textContent = `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase() || "PD";
  }
}

export function bindGlobalUi({ onRefresh, onLogout } = {}) {
  document.addEventListener("click", event => {
    const registration = event.target.closest("[data-registration-route]");
    if (registration) {
      event.preventDefault();
      const params = new URLSearchParams({ intent: "register" });
      navigate("login", params);
      closeMobileMenu();
      closeMobileMore();
      return;
    }
    const target = event.target.closest("[data-route]");
    if (target) {
      event.preventDefault();
      const params = new URLSearchParams();
      if (target.dataset.openTab) params.set("tab", target.dataset.openTab);
      navigate(target.dataset.route, params);
      closeMobileMenu();
      closeMobileMore();
      return;
    }
    if (event.target.closest("[data-close-menu]")) closeMobileMenu();
    if (event.target.closest("[data-close-more]")) closeMobileMore();
    if (event.target.closest("#mobileMoreToggle")) openMobileMore();
  });
  document.getElementById("mobileMenuToggle")?.addEventListener("click", openMobileMenu);
  document.getElementById("refreshButton")?.addEventListener("click", () => onRefresh?.());
  document.getElementById("logoutButton")?.addEventListener("click", () => onLogout?.());
  document.getElementById("mobileRefreshButton")?.addEventListener("click", () => { closeMobileMore(); onRefresh?.(); });
  document.getElementById("mobileLogoutButton")?.addEventListener("click", () => { closeMobileMore(); onLogout?.(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeMobileMenu(); closeMobileMore(); } });
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
  if (status) { status.textContent = label; status.className = `status-pill ${type}`; }
}

export function openMobileMenu() {
  closeMobileMore();
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("mobileBackdrop")?.classList.add("show");
}

export function closeMobileMenu() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("mobileBackdrop")?.classList.remove("show");
}

export function openMobileMore() {
  closeMobileMenu();
  const panel = document.getElementById("mobileMorePanel");
  const backdrop = document.getElementById("mobileMoreBackdrop");
  if (!panel || !backdrop) return;
  panel.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add("mobile-more-open");
  panel.querySelector("button")?.focus();
}

export function closeMobileMore() {
  const panel = document.getElementById("mobileMorePanel");
  const backdrop = document.getElementById("mobileMoreBackdrop");
  if (panel) panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("mobile-more-open");
}

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

export function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }

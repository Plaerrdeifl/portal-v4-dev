import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, navigate, routes } from "./router.js";

export async function loadFragment(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Datei konnte nicht geladen werden: ${path}`);
  return response.text();
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
  const authenticated = auth.isAuthenticated();
  return Object.entries(routes()).filter(([key]) => {
    if (key === "login") return !authenticated;
    return auth.canAccessRoute(key);
  });
}

export function renderNavigation() {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  nav.innerHTML = visibleRouteEntries().map(([key, route]) => `
    <button type="button" data-route="${escapeAttr(key)}">
      <span class="nav-icon" aria-hidden="true">${escapeHtml(route.icon)}</span>
      <span>${escapeHtml(route.title)}</span>
    </button>`).join("");
  updateActiveNavigation();
}

export function updateActiveNavigation() {
  const active = currentRoute();
  document.querySelectorAll("[data-route]").forEach(element => {
    if (element.closest("#mainNav")) element.classList.toggle("active", element.dataset.route === active);
  });
}

export function updateUserChrome() {
  const current = auth.current();
  const summary = document.getElementById("userSummary");
  const logout = document.getElementById("logoutButton");
  if (summary) summary.hidden = !current.authenticated;
  if (logout) logout.hidden = !current.authenticated;

  if (current.authenticated && current.user) {
    const name = current.user.name || current.user.email || "Portaluser";
    const role = current.user.role || "Portaluser";
    const nameEl = document.getElementById("userSummaryName");
    const roleEl = document.getElementById("userSummaryRole");
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
  }
}

export function bindGlobalUi({ onRefresh, onLogout } = {}) {
  document.addEventListener("click", event => {
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      event.preventDefault();
      navigate(routeTarget.dataset.route);
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

export function applyLegacyLinks() {
  document.querySelectorAll("[data-legacy-link]").forEach(link => {
    link.href = CONFIG.urls.legacyPortal;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
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
  window.setTimeout(() => toast.remove(), duration);
}

export function setConnectionStatus(label, type = "success") {
  const status = document.getElementById("connectionStatus");
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill ${type}`;
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
  return String(value || "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

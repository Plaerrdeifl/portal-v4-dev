import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import {
  currentRoute,
  fixedAuthenticatedOrder,
  navigate,
  routes
} from "./router.js";

const fragmentCache = new Map();
const fragmentPromises = new Map();
const MOBILE_PRIMARY = ["dashboard", "fanclub", "tasks", "teams"];

let globalRefresh = null;
let globalLogout = null;

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
        if (!response.ok) {
          throw new Error(`Datei konnte nicht geladen werden: ${path}`);
        }
        return response.text();
      })
      .then(text => {
        fragmentCache.set(key, text);
        return text;
      })
      .finally(() => {
        if (fragmentPromises.get(key) === promise) {
          fragmentPromises.delete(key);
        }
      });

    fragmentPromises.set(key, promise);
  }

  const text = await promise;
  if (signal?.aborted) throw abortError();
  return text;
}

export async function mountComponents() {
  const sidebarSlot = document.getElementById("sidebarSlot");
  const topbarSlot = document.getElementById("topbarSlot");

  if (sidebarSlot?.hasChildNodes() && topbarSlot?.hasChildNodes()) {
    ensureUserMenu();
    return;
  }

  const [sidebar, topbar] = await Promise.all([
    loadFragment("./components/sidebar.html"),
    loadFragment("./components/topbar.html")
  ]);

  if (sidebarSlot) sidebarSlot.innerHTML = sidebar;
  if (topbarSlot) topbarSlot.innerHTML = topbar;
  ensureUserMenu();
}

function publicAreaActive() {
  return Boolean(routes()[currentRoute()]?.public) || !auth.isAuthenticated();
}

function syncBrandContext() {
  const publicArea = publicAreaActive();
  const label = publicArea ? "ÖFFENTLICHER BEREICH" : "PORTAL";
  const sidebarContext = document.getElementById("brandContext");
  const mobileContext = document.getElementById("mobileBrandContext");
  const sidebarCaption = document.querySelector(".sidebar-caption");

  if (sidebarContext) sidebarContext.textContent = label;
  if (mobileContext) mobileContext.textContent = label;
  if (sidebarCaption) {
    sidebarCaption.textContent = publicArea
      ? "Öffentlicher Bereich"
      : "Vereinsportal";
  }

  document.documentElement.dataset.portalArea = publicArea
    ? "public"
    : "portal";
}

export function visibleRouteEntries() {
  const current = routes()[currentRoute()];

  if (current?.public || !auth.isAuthenticated()) {
    const entries = Object.entries(routes())
      .filter(([key, route]) => route.public && key !== "login")
      .sort(
        (left, right) =>
          (left[1].publicOrder || 0) - (right[1].publicOrder || 0)
      );

    if (auth.hasPersistedSession()) {
      entries.push([
        "dashboard",
        {
          ...routes().dashboard,
          title: "Ins Portal",
          subtitle: "Gespeicherte Sitzung prüfen und Portal öffnen"
        }
      ]);
    } else {
      entries.push([
        "login",
        {
          ...routes().login,
          title: "Anmelden / Registrieren"
        }
      ]);
    }

    return entries;
  }

  if (auth.requiresProfile()) return [["profile", routes().profile]];

  return fixedAuthenticatedOrder()
    .filter(key => auth.canAccessRoute(key))
    .map(key => [key, routes()[key]]);
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

export function renderNavigation() {
  const entries = visibleRouteEntries();
  const nav = document.getElementById("mainNav");

  if (nav) {
    const buttons = entries.map(([key, route]) =>
      createRouteButton(key, route)
    );
    nav.replaceChildren(...buttons);
    window.dispatchEvent(new CustomEvent("pd-navigation-rendered"));
  }

  syncBrandContext();

  document.getElementById("mobileNav")?.remove();
  document.getElementById("mobileMoreBackdrop")?.remove();
  document.getElementById("mobileMorePanel")?.remove();
  updateActiveNavigation();
}

export function updateActiveNavigation() {
  const active = currentRoute();

  document.querySelectorAll("[data-route]").forEach(element => {
    const isActive = element.dataset.route === active;
    element.classList.toggle("active", isActive);

    if (isActive) {
      element.setAttribute("aria-current", "page");
    } else {
      element.removeAttribute("aria-current");
    }
  });

  const more = document.getElementById("mobileMoreToggle");
  if (more) {
    const isExtra =
      auth.isAuthenticated() && !MOBILE_PRIMARY.includes(active);
    more.classList.toggle("active", isExtra);
    more.classList.toggle("more-active", isExtra);
  }
}

function avatarMetadata(current) {
  return current.session?.user?.user_metadata || {};
}

function avatarUrl(current) {
  const metadata = avatarMetadata(current);
  return String(
    metadata.avatar_url
    || metadata.picture
    || ""
  ).trim();
}

function ensureUserMenu() {
  if (document.getElementById("userMenuPanel")) return;

  const backdrop = document.createElement("div");
  backdrop.id = "userMenuBackdrop";
  backdrop.className = "user-menu-backdrop";
  backdrop.dataset.closeUserMenu = "";
  backdrop.hidden = true;

  const panel = document.createElement("section");
  panel.id = "userMenuPanel";
  panel.className = "user-menu-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Benutzermenü");
  panel.hidden = true;

  document.body.append(backdrop, panel);
}

function profileField(label, value) {
  return `<div class="user-profile-value">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value || "–")}</strong>
  </div>`;
}

function memberRequestForm(member, pending) {
  if (!member) {
    return `<div class="notice">
      <strong>Keine Mitgliedsverknüpfung</strong>
      <p>Für dieses Portalprofil sind derzeit keine geschützten Fanclubdaten hinterlegt.</p>
    </div>`;
  }

  const requestData = pending?.requestedData || member;

  return `<form id="memberChangeRequestForm" class="form-grid user-profile-form">
    <label>Vorname
      <input name="firstName" required maxlength="160" value="${escapeAttr(requestData.firstName || "")}">
    </label>
    <label>Nachname
      <input name="lastName" required maxlength="160" value="${escapeAttr(requestData.lastName || "")}">
    </label>
    <label>E-Mail
      <input name="email" type="email" maxlength="320" value="${escapeAttr(requestData.email || "")}">
    </label>
    <label>Telefon
      <input name="phone" maxlength="80" value="${escapeAttr(requestData.phone || "")}">
    </label>
    <label>Straße
      <input name="street" maxlength="160" value="${escapeAttr(requestData.street || "")}">
    </label>
    <label>Hausnummer
      <input name="houseNumber" maxlength="40" value="${escapeAttr(requestData.houseNumber || "")}">
    </label>
    <label>PLZ
      <input name="postalCode" maxlength="20" value="${escapeAttr(requestData.postalCode || "")}">
    </label>
    <label>Ort
      <input name="city" maxlength="160" value="${escapeAttr(requestData.city || "")}">
    </label>
    <label class="full">Grund der Änderung
      <textarea name="reason" required minlength="3" maxlength="1000" rows="3">${escapeHtml(pending?.reason || "")}</textarea>
    </label>
    <div class="full dialog-actions">
      <button class="button primary" type="submit">
        ${pending ? "Offene Anfrage aktualisieren" : "Änderung beim Admin anfragen"}
      </button>
    </div>
  </form>`;
}

function ensureProfileDetailsDialog() {
  if (document.getElementById("userProfileDialog")) return;

  const dialog = document.createElement("dialog");
  dialog.id = "userProfileDialog";
  dialog.className = "user-profile-dialog";
  dialog.setAttribute("aria-label", "Profil und Daten");
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
}

function renderProfileDetails() {
  ensureProfileDetailsDialog();

  const dialog = document.getElementById("userProfileDialog");
  if (!dialog) return;

  const current = auth.current();
  const profile = current.bootstrap?.profile || {};
  const portal = profile.portal || current.user || {};
  const member = profile.member || null;
  const pending = profile.pendingRequest || null;

  dialog.innerHTML = `<div class="user-profile-dialog-shell">
    <header class="user-profile-dialog-header">
      <div>
        <span class="subtle">Konto</span>
        <h2>Profil und Daten</h2>
        <p>Portaldaten direkt bearbeiten; geschützte Mitgliedsdaten als Anfrage senden.</p>
      </div>
      <button class="icon-button" type="button" data-close-profile-details aria-label="Profil und Daten schließen">×</button>
    </header>

    <div class="user-profile-dialog-body">
      <section class="user-menu-section">
        <h3>Portalprofil</h3>
        <div class="user-profile-grid">
          ${profileField("Portal-ID", portal.userCode)}
          ${profileField("Login-E-Mail", portal.email || current.session?.user?.email)}
        </div>
        ${current.user ? `<form id="directProfileForm" class="form-grid user-profile-form">
          <label>Vorname
            <input name="firstName" required maxlength="160" value="${escapeAttr(portal.firstName || "")}">
          </label>
          <label>Nachname
            <input name="lastName" required maxlength="160" value="${escapeAttr(portal.lastName || "")}">
          </label>
          <div class="full dialog-actions">
            <button class="button primary" type="submit">Portalprofil speichern</button>
          </div>
        </form>` : `<div class="notice">
          <strong>Profil noch nicht freigeschaltet</strong>
          <p>Die Portaldaten können nach der Freischaltung bearbeitet werden.</p>
        </div>`}
      </section>

      <section class="user-menu-section">
        <div class="user-menu-section-heading">
          <div>
            <h3>Geschützte Mitgliedsdaten</h3>
            <p>${member
              ? `${escapeHtml(member.memberCode)} · Änderungen werden von einem Admin geprüft.`
              : "Keine offiziellen Mitgliedsdaten verknüpft."}</p>
          </div>
          ${pending ? '<span class="badge warning">Anfrage offen</span>' : ""}
        </div>
        ${memberRequestForm(member, pending)}
      </section>
    </div>
  </div>`;

  dialog.querySelector("[data-close-profile-details]")
    ?.addEventListener("click", () => dialog.close());

  dialog.querySelector("#directProfileForm")
    ?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      try {
        const values = Object.fromEntries(new FormData(form).entries());
        await auth.updateProfile({
          firstName: values.firstName,
          lastName: values.lastName
        });
        updateUserChrome();
        renderProfileDetails();
        showToast("Portalprofil wurde aktualisiert.", "success");
      } catch (error) {
        showToast(
          error?.message || "Portalprofil konnte nicht gespeichert werden.",
          "error",
          6500
        );
      } finally {
        if (button) button.disabled = false;
      }
    });

  dialog.querySelector("#memberChangeRequestForm")
    ?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      try {
        const values = Object.fromEntries(new FormData(form).entries());
        await api.call("submit_profile_change_request", {
          member: {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phone: values.phone,
            street: values.street,
            houseNumber: values.houseNumber,
            postalCode: values.postalCode,
            city: values.city
          },
          reason: values.reason
        });
        await auth.refresh();
        renderProfileDetails();
        showToast(
          "Änderungsanfrage wurde an die Administration gesendet.",
          "success"
        );
      } catch (error) {
        showToast(
          error?.message || "Änderungsanfrage konnte nicht gesendet werden.",
          "error",
          6500
        );
      } finally {
        if (button) button.disabled = false;
      }
    });
}

function openProfileDetails() {
  closeUserMenu();
  renderProfileDetails();

  const dialog = document.getElementById("userProfileDialog");
  if (!dialog) return;

  if (!dialog.open) dialog.showModal();
}

function renderUserMenu() {
  ensureUserMenu();

  const panel = document.getElementById("userMenuPanel");
  if (!panel) return;

  const current = auth.current();
  const profile = current.bootstrap?.profile || {};
  const portal = profile.portal || current.user || {};
  const member = profile.member || null;
  const pending = profile.pendingRequest || null;
  const fullName =
    `${portal.firstName || ""} ${portal.lastName || ""}`.trim()
    || current.user?.name
    || "Benutzer";

  panel.innerHTML = `<header class="user-menu-header">
    <div>
      <span class="subtle">Benutzermenü</span>
      <h2>${escapeHtml(fullName)}</h2>
      <p>${escapeHtml(portal.roleName || current.user?.role || "Portaluser")}</p>
    </div>
    <button class="icon-button" type="button" data-close-user-menu aria-label="Benutzermenü schließen">×</button>
  </header>

  <div class="user-menu-content">
    <div class="user-profile-grid">
      ${profileField("Portal-ID", portal.userCode)}
      ${profileField("Login-E-Mail", portal.email || current.session?.user?.email)}
      ${member ? profileField("Mitglied", member.memberCode) : ""}
    </div>
    ${pending ? `<div class="notice warning">
      <strong>Datenänderung in Prüfung</strong>
      <p>Eine Änderungsanfrage ist bereits offen.</p>
    </div>` : ""}
    <button class="button primary user-profile-open-button" type="button" data-open-profile-details>
      Profil und Daten öffnen
    </button>
  </div>

  <footer class="user-menu-footer">
    <button class="button secondary" type="button" data-user-refresh>Aktualisieren</button>
    <button class="button danger" type="button" data-user-logout>Abmelden</button>
  </footer>`;
}

function updateOverlayLock() {
  const sidebarOpen =
    document.getElementById("sidebar")?.classList.contains("open");
  const moreOpen =
    document.getElementById("mobileMorePanel")?.hidden === false;
  const userMenuOpen =
    document.getElementById("userMenuPanel")?.hidden === false;

  document.body.classList.toggle(
    "overlay-open",
    Boolean(sidebarOpen || moreOpen || userMenuOpen)
  );
}

function openUserMenu() {
  closeMobileMenu();
  closeMobileMore();
  ensureUserMenu();
  renderUserMenu();

  const panel = document.getElementById("userMenuPanel");
  const backdrop = document.getElementById("userMenuBackdrop");
  const toggle = document.getElementById("userSummary");

  if (!panel || !backdrop) return;

  panel.hidden = false;
  backdrop.hidden = false;
  toggle?.setAttribute("aria-expanded", "true");
  updateOverlayLock();

  window.setTimeout(() => {
    panel.querySelector("[data-close-user-menu]")?.focus();
  }, 0);
}

function closeUserMenu() {
  const panel = document.getElementById("userMenuPanel");
  const backdrop = document.getElementById("userMenuBackdrop");
  const toggle = document.getElementById("userSummary");

  if (panel) panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  toggle?.setAttribute("aria-expanded", "false");
  updateOverlayLock();
}

export function updateUserChrome() {
  syncBrandContext();

  const current = auth.current();
  const summary = document.getElementById("userSummary");
  const nameNode = document.getElementById("userSummaryName");
  const roleNode = document.getElementById("userSummaryRole");
  const avatar = document.getElementById("userAvatar");
  const image = document.getElementById("userAvatarImage");
  const initials = document.getElementById("userAvatarInitials");

  if (summary) summary.hidden = !current.authenticated;

  if (!current.authenticated || !current.user) {
    closeUserMenu();
    return;
  }

  const first = current.user.firstName || current.user.vorname || "";
  const last = current.user.lastName || current.user.nachname || "";
  const name =
    `${first} ${last}`.trim()
    || current.user.name
    || "Profil unvollständig";
  const role =
    current.status !== "ACTIVE"
      ? "Portalzugang noch nicht aktiv"
      : current.user.role || "Portaluser";
  const photo = avatarUrl(current);
  const fallback =
    `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase()
    || "PD";

  if (nameNode) nameNode.textContent = name;
  if (roleNode) roleNode.textContent = role;

  if (initials) {
    initials.textContent = fallback;
    initials.hidden = Boolean(photo);
  }

  if (image) {
    image.hidden = !photo;
    image.removeAttribute("src");

    if (photo) {
      image.src = photo;
      image.alt = "";
      image.onerror = () => {
        image.hidden = true;
        if (initials) initials.hidden = false;
        avatar?.classList.remove("has-photo");
      };
    }
  }

  avatar?.classList.toggle("has-photo", Boolean(photo));
}

export function bindGlobalUi({ onRefresh, onLogout } = {}) {
  globalRefresh = onRefresh || null;
  globalLogout = onLogout || null;
  ensureUserMenu();

  document.addEventListener("click", event => {
    const routeTarget = event.target.closest("button[data-route], a[data-route]");

    if (routeTarget) {
      event.preventDefault();
      const params = new URLSearchParams();

      if (routeTarget.dataset.openTab) {
        params.set("tab", routeTarget.dataset.openTab);
      }

      navigate(routeTarget.dataset.route, params);
      closeMobileMenu();
      closeMobileMore();
      closeUserMenu();
      return;
    }

    if (event.target.closest("[data-close-menu]")) {
      closeMobileMenu();
      return;
    }

    if (event.target.closest("[data-close-more]")) {
      closeMobileMore();
      return;
    }

    if (event.target.closest("[data-close-user-menu]")) {
      closeUserMenu();
      return;
    }

    if (event.target.closest("#mobileMoreToggle")) {
      openMobileMore();
      return;
    }

    if (event.target.closest("#userSummary")) {
      openUserMenu();
      return;
    }

    if (event.target.closest("[data-open-profile-details]")) {
      openProfileDetails();
      return;
    }

    if (event.target.closest("[data-user-refresh]")) {
      closeUserMenu();
      globalRefresh?.();
      return;
    }

    if (event.target.closest("[data-user-logout]")) {
      closeUserMenu();
      globalLogout?.();
    }
  });

  document.getElementById("mobileMenuToggle")
    ?.addEventListener("click", openMobileMenu);

  document.getElementById("mobileRefreshButton")
    ?.addEventListener("click", () => {
      closeMobileMore();
      globalRefresh?.();
    });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMobileMenu();
      closeMobileMore();
      closeUserMenu();
    }
  });
}

export function setRouteHeader(route) {
  syncBrandContext();

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
  if (!status) return;

  const text = status.querySelector("[data-status-text]");
  if (text) text.textContent = label;
  else status.textContent = label;

  status.className = `connection-indicator ${type}`;
  status.dataset.state = type;
}

export function openMobileMenu() {
  closeMobileMore();
  closeUserMenu();
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("mobileBackdrop")?.classList.add("show");
  updateOverlayLock();
}

export function closeMobileMenu() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("mobileBackdrop")?.classList.remove("show");
  updateOverlayLock();
}

export function openMobileMore() {
  closeMobileMenu();
  closeUserMenu();

  const panel = document.getElementById("mobileMorePanel");
  const backdrop = document.getElementById("mobileMoreBackdrop");

  if (!panel || !backdrop) return;

  panel.hidden = false;
  backdrop.hidden = false;
  updateOverlayLock();
  panel.querySelector("button")?.focus();
}

export function closeMobileMore() {
  const panel = document.getElementById("mobileMorePanel");
  const backdrop = document.getElementById("mobileMoreBackdrop");

  if (panel) panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  updateOverlayLock();
}

export function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>'"]/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]
  );
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

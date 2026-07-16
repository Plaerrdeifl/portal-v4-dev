(() => {
  "use strict";

  const SESSION_KEY = "pd_portal_pwa_session_r71_m4";
  const POST_LOGIN_KEY = "pd_m4_post_login_route";
  const PUBLIC_ROUTES = new Set(["home", "login", "news", "dates", "about", "contact", "install"]);
  const AUTH_ROUTES = new Set(["login", "profile"]);
  const ROUTE_LABELS = Object.freeze({ dashboard: "Dashboard", fanclub: "Fanclub", tasks: "Aufgaben", teams: "Teams", fanbuses: "Fanbusse", admin: "Administration" });
  let authState = {};
  let syncTimer = 0;
  let logoutInProgress = false;
  let forwardingLogout = false;
  let observerStarted = false;

  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

  function routeKey() {
    return String(location.hash || "#/home").replace(/^#\/?/, "").split(/[?&]/)[0] || "home";
  }

  function routeTab() {
    const hash = String(location.hash || "");
    const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
    return new URLSearchParams(query).get("tab") || "";
  }

  function setRouteState() {
    document.documentElement.dataset.route = routeKey();
  }

  function transitionOverlay() {
    return document.getElementById("authTransitionOverlay");
  }

  function showTransition(message, detail) {
    const overlay = transitionOverlay();
    if (!overlay) return;
    const status = overlay.querySelector("#authTransitionStatus");
    const description = overlay.querySelector("#authTransitionDetail");
    if (status) status.textContent = message;
    if (description) description.textContent = detail;
    overlay.classList.remove("is-complete");
    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-busy", "true");
    document.documentElement.dataset.authTransitionState = "loading";
  }

  function hideTransition(state = "complete") {
    const overlay = transitionOverlay();
    if (!overlay) return;
    overlay.setAttribute("aria-busy", "false");
    overlay.setAttribute("aria-hidden", "true");
    overlay.classList.add("is-complete");
    document.documentElement.dataset.authTransitionState = state;
  }

  function currentHashIsProtected() {
    const key = routeKey();
    return !PUBLIC_ROUTES.has(key) && key !== "profile";
  }

  function rememberCurrentRoute() {
    if (!currentHashIsProtected()) return;
    try { sessionStorage.setItem(POST_LOGIN_KEY, location.hash); } catch (error) {}
  }

  function closeMenu() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("mobileBackdrop")?.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
  }

  function openMenu() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("mobileBackdrop");
    if (!sidebar || !backdrop) return;
    sidebar.classList.add("open");
    backdrop.classList.add("show");
    document.body.classList.add("mobile-menu-open");
    window.setTimeout(() => document.querySelector("#mobileFullMenu button, #mobileFullMenu summary")?.focus(), 0);
  }

  function routeEntries() {
    const entries = [];
    document.querySelectorAll("#mainNav button[data-route]").forEach(button => {
      const key = String(button.dataset.route || "");
      if (!key || entries.some(item => item.key === key)) return;
      const icon = button.querySelector(".nav-icon")?.innerHTML || "";
      const spans = button.querySelectorAll("span");
      const label = ROUTE_LABELS[key] || clean(spans[spans.length - 1]?.textContent || button.textContent || key);
      entries.push({ key, icon, label });
    });
    return entries;
  }

  function createBottomButton(entry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-nav-button";
    button.dataset.uxRoute = entry.key;
    button.innerHTML = `<span class="nav-icon" aria-hidden="true">${entry.icon}</span><span>${escapeHtml(entry.label)}</span>`;
    return button;
  }

  function primaryRouteKeys(entries) {
    const available = new Set(entries.map(item => item.key));
    const preferred = available.has("fanclub")
      ? ["dashboard", "fanclub", "tasks", "teams"]
      : ["dashboard", "tasks", "teams", "fanbuses"];
    const selected = preferred.filter(key => available.has(key));
    for (const entry of entries) {
      if (selected.length >= 4) break;
      if (!["profile", "admin"].includes(entry.key) && !selected.includes(entry.key)) selected.push(entry.key);
    }
    return selected.slice(0, 4);
  }

  function renderBottomNavigation() {
    const nav = document.getElementById("mobileNav");
    if (!nav) return;
    const key = routeKey();
    const authenticated = Boolean(authState.authenticated && !authState.profileRequired);
    if (!authenticated || PUBLIC_ROUTES.has(key) || key === "profile") {
      nav.hidden = true;
      nav.replaceChildren();
      nav.style.removeProperty("--corr3-nav-count");
      delete nav.dataset.corr3Signature;
      return;
    }

    const entries = routeEntries();
    if (!entries.length) return;
    const byKey = new Map(entries.map(entry => [entry.key, entry]));
    const primaryKeys = primaryRouteKeys(entries);
    const signature = primaryKeys.join("|");
    if (nav.dataset.corr3Signature !== signature) {
      const buttons = primaryKeys.map(route => createBottomButton(byKey.get(route)));
      const more = document.createElement("button");
      more.type = "button";
      more.id = "mobileMoreToggle";
      more.className = "mobile-nav-button";
      more.dataset.uxMore = "true";
      more.setAttribute("aria-haspopup", "dialog");
      const moreIcon = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
      more.innerHTML = `<span class="nav-icon" aria-hidden="true">${moreIcon}</span><span>Mehr</span>`;
      buttons.push(more);
      nav.style.setProperty("--corr3-nav-count", String(buttons.length));
      nav.replaceChildren(...buttons);
      nav.dataset.corr3Signature = signature;
      nav.dataset.corr3Primary = primaryKeys.join(",");
    }
    nav.hidden = false;
    syncActiveNavigation();
  }

  function initials() {
    const user = authState.user || {};
    const first = clean(user.firstName || user.vorname || "");
    const last = clean(user.lastName || user.nachname || "");
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "PD";
  }

  function userName() {
    const user = authState.user || {};
    return clean(`${user.firstName || user.vorname || ""} ${user.lastName || user.nachname || ""}`) || clean(user.name) || "Portalbenutzer";
  }

  function permission(area) {
    if (authState.user?.isAdmin) return true;
    const value = authState.user?.permissions?.[area];
    return Boolean(value?.read || value?.write || value?.admin);
  }

  function subroutesFor(key) {
    const user = authState.user || {};
    const portal = authState.portal || {};
    const isBoard = Boolean(user.isAdmin || user.isBoard || (user.officeCodes || []).length);
    const hasTeam = Boolean(user.isAdmin || (user.teamRights || []).length);
    if (key === "fanclub") {
      return [
        ["overview", "Übersicht", true],
        ["members", "Mitglieder", permission("Mitglieder")],
        ["contributions", "Beiträge", permission("Beiträge")],
        ["paymentReports", "Zahlungsmeldungen", permission("Beiträge") && isBoard],
        ["cashbook", "Kassenbuch", permission("Kasse")],
        ["accounts", "Konten", permission("Konten")]
      ].filter(item => item[2]);
    }
    if (key === "tasks") {
      return [
        ["mine", "Meine Aufgaben", true],
        ["team", "Teamaufgaben", hasTeam],
        ["board", "Vorstandsaufgaben", isBoard],
        ["archive", "Archiv", true]
      ].filter(item => item[2]);
    }
    if (key === "teams") {
      return [
        ["overview", "Teamübersicht", true],
        ["mine", "Meine Teams", true],
        ["manage", "Teammitglieder verwalten", Boolean(portal.teamLeader || portal.teamAdmin || user.isAdmin)],
        ["functions", "Teamfunktionen", Boolean(portal.teamAdmin || user.isAdmin)]
      ].filter(item => item[2]);
    }
    return [];
  }

  function routeMarkup(entry) {
    const subs = subroutesFor(entry.key);
    if (!subs.length) {
      return `<button class="mobile-menu-route" type="button" data-ux-route="${escapeHtml(entry.key)}"><span class="nav-icon" aria-hidden="true">${entry.icon}</span><span class="mobile-menu-route-label">${escapeHtml(entry.label)}</span></button>`;
    }
    const links = subs.map(([tab, label]) => `<button class="mobile-menu-sublink" type="button" data-ux-route="${escapeHtml(entry.key)}" data-ux-tab="${escapeHtml(tab)}"><span>${escapeHtml(label)}</span></button>`).join("");
    return `<details class="mobile-menu-group" data-ux-group="${escapeHtml(entry.key)}"><summary><span class="nav-icon" aria-hidden="true">${entry.icon}</span><span class="mobile-menu-route-label">${escapeHtml(entry.label)}</span></summary><div class="mobile-menu-subroutes"><button class="mobile-menu-sublink" type="button" data-ux-route="${escapeHtml(entry.key)}"><span>Bereich öffnen</span></button>${links}</div></details>`;
  }

  function renderFullMenu() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    let menu = document.getElementById("mobileFullMenu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "mobileFullMenu";
      menu.className = "mobile-full-menu";
      sidebar.appendChild(menu);
    }

    const entries = routeEntries();
    const role = clean(authState.user?.role || (authState.user?.isAdmin ? "Admin" : "Portaluser"));
    const connection = clean(document.getElementById("connectionStatus")?.textContent || (authState.connectionPending ? "Verbindung wird wiederhergestellt" : "Sicher verbunden"));
    const version = clean(document.getElementById("buildLabel")?.textContent || "R7.1 · Milestone 4");
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || Boolean(navigator.standalone);
    const signature = JSON.stringify({ entries: entries.map(item => item.key), role, connection, version, standalone, user: userName(), permissions: authState.user?.permissions || {}, portal: authState.portal || {}, team: authState.user?.teamRights || [], offices: authState.user?.officeCodes || [] });
    if (menu.dataset.signature === signature) {
      syncActiveNavigation();
      return;
    }

    menu.dataset.signature = signature;
    menu.innerHTML = `<div class="mobile-full-menu-header"><strong>Portalübersicht</strong><button class="mobile-full-menu-close" type="button" data-ux-close-menu aria-label="Menü schließen">×</button></div>
      <section class="mobile-menu-account"><span class="mobile-menu-avatar" aria-hidden="true">${escapeHtml(initials())}</span><span class="mobile-menu-account-copy"><strong>${escapeHtml(userName())}</strong><span>${escapeHtml(role || "Portaluser")}</span></span><span class="mobile-menu-connection ${authState.connectionPending ? "warning" : ""}"><i aria-hidden="true"></i>${escapeHtml(connection)}</span></section>
      <section class="mobile-menu-section"><div class="mobile-menu-section-title">Alle Bereiche</div>${entries.map(routeMarkup).join("")}</section>
      <section class="mobile-menu-section"><div class="mobile-menu-section-title">App und Konto</div><div class="mobile-menu-actions"><button id="uxRefreshButton" class="mobile-menu-action" type="button">Ansicht aktualisieren</button>${standalone ? "" : '<button id="uxInstallButton" class="mobile-menu-action" type="button">App installieren</button>'}<button id="uxLogoutButton" class="mobile-menu-action danger" type="button">Abmelden</button></div><div class="mobile-menu-version">${escapeHtml(version)} · Backend und Rechte werden weiterhin serverseitig geprüft.</div></section>`;
    syncActiveNavigation();
  }

  function syncActiveNavigation() {
    const key = routeKey();
    const tab = routeTab();
    document.querySelectorAll("[data-ux-route]").forEach(element => {
      const active = element.dataset.uxRoute === key && (!element.dataset.uxTab || element.dataset.uxTab === tab);
      element.classList.toggle("active", active);
      if (active) element.setAttribute("aria-current", "page"); else element.removeAttribute("aria-current");
    });
    document.querySelectorAll("[data-ux-group]").forEach(group => {
      const active = group.dataset.uxGroup === key;
      group.classList.toggle("is-active", active);
      if (active) group.open = true;
    });
    const nav = document.getElementById("mobileNav");
    const primary = String(nav?.dataset.corr3Primary || "").split(",").filter(Boolean);
    const more = document.getElementById("mobileMoreToggle");
    if (more) {
      const active = Boolean(key && !primary.includes(key));
      more.classList.toggle("active", active);
      more.classList.toggle("more-active", active);
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setLoginNotice(message, type = "warning") {
    const notice = document.getElementById("loginNotice");
    if (!notice) return;
    if (!message) { notice.hidden = true; notice.textContent = ""; return; }
    notice.hidden = false;
    notice.className = `notice ${type}`;
    notice.textContent = message;
  }

  function registrationEmail() {
    return clean(authState.registration?.profile?.email || authState.notice?.email || "");
  }

  function enhanceRegistrationForm() {
    const form = document.getElementById("registrationForm");
    if (!form || form.querySelector(".auth-registration-account")) return;
    const account = document.createElement("div");
    account.className = "auth-registration-account";
    account.innerHTML = `<small>Google-Konto</small><strong>${escapeHtml(registrationEmail() || "Mit Google bestätigtes Konto")}</strong>`;
    form.prepend(account);
    const button = form.querySelector('button[type="submit"]');
    if (button && !button.disabled) button.textContent = "Freischaltung beantragen";
  }

  function pendingNotice() {
    const message = clean(authState.notice?.message || "");
    return /Freischaltungsantrag.*gespeichert|Antrag gespeichert|Freischaltung wird geprüft/i.test(message) ? message : "";
  }

  function renderPendingState(message) {
    const slot = document.getElementById("registrationSlot");
    const google = document.getElementById("googleSignInButton");
    if (!slot) return;
    if (google) google.hidden = true;
    slot.hidden = false;
    if (!slot.querySelector(".auth-pending-state")) {
      slot.innerHTML = `<div class="auth-pending-state"><span class="auth-pending-icon" aria-hidden="true">✓</span><h3>Antrag wurde übermittelt</h3><p>${escapeHtml(message || "Dein Zugang muss noch von einem Administrator freigegeben werden.")}</p><div class="auth-pending-actions"><button id="authStatusCheckButton" class="button primary" type="button">Status mit Google prüfen</button><button id="authPublicHomeButton" class="button ghost" type="button">Zur öffentlichen Startseite</button></div></div>`;
    }
  }

  function syncLoginView() {
    const page = document.querySelector(".login-page");
    if (!page) return;
    const notice = clean(authState.notice?.message || "");
    const registration = authState.registration;
    const pending = pendingNotice();

    if (registration) {
      setText("authKicker", "Zugang beantragen");
      setText("authTitle", "Freischaltung beantragen");
      setText("loginMessage", "Ergänze deine Angaben. Nach der Prüfung durch einen Administrator kannst du das Portal nutzen.");
      const pill = document.getElementById("loginStatusPill");
      if (pill) { pill.textContent = "Angaben erforderlich"; pill.className = "status-pill warning"; }
      const google = document.getElementById("googleSignInButton");
      if (google) google.hidden = true;
      setLoginNotice("Google hat noch keinen freigeschalteten Portalzugang gefunden. Vorname und Nachname sind Pflichtfelder.", "warning");
      enhanceRegistrationForm();
      return;
    }

    if (pending) {
      setText("authKicker", "Freischaltung");
      setText("authTitle", "Deine Freischaltung wird geprüft");
      setText("loginMessage", "Du erhältst Zugang, sobald ein Administrator deinen Antrag freigegeben hat.");
      const pill = document.getElementById("loginStatusPill");
      if (pill) { pill.textContent = "Wird geprüft"; pill.className = "status-pill warning"; }
      setLoginNotice("", "success");
      renderPendingState(pending);
      return;
    }

    setText("authKicker", "Sicher anmelden");
    setText("authTitle", /Sitzung.*abgelaufen|erneut anmelden/i.test(notice) ? "Sitzung abgelaufen" : "Willkommen zurück");
    if (/Sitzung.*abgelaufen|erneut anmelden/i.test(notice)) {
      setLoginNotice("Deine Sitzung ist abgelaufen. Melde dich erneut mit Google an; deine gewünschte Zielseite bleibt gespeichert.", "warning");
    } else if (/Offline|Verbindung/i.test(notice)) {
      setLoginNotice(notice, "warning");
    } else if (/abgemeldet/i.test(notice)) {
      setLoginNotice("Du wurdest sicher abgemeldet.", "success");
    } else if (notice && authState.notice?.type === "warning") {
      setLoginNotice(notice, "warning");
    }
  }

  function mirrorLoginError(message) {
    if (routeKey() !== "login" || !message) return;
    setLoginNotice(message, "error");
    setText("authTitle", "Anmeldung nicht möglich");
  }

  function syncAuthChrome() {
    syncLoginView();
    enhanceRegistrationForm();
  }

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      setRouteState();
      renderBottomNavigation();
      renderFullMenu();
      syncAuthChrome();
      syncActiveNavigation();
      const sidebar = document.getElementById("sidebar");
      document.body.classList.toggle("mobile-menu-open", Boolean(sidebar?.classList.contains("open")));
    }, 25);
  }

  function showLocalToast(message, type = "info") {
    const region = document.getElementById("toastRegion");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5200);
  }

  async function installApp() {
    closeMenu();
    try {
      const module = await import("./install.js");
      const state = module.installState();
      if (state.standalone) { showLocalToast("Das Portal ist bereits als App geöffnet.", "success"); return; }
      if (state.ios || !state.promptAvailable) {
        showLocalToast(state.ios ? "Safari: Teilen → Zum Home-Bildschirm → Hinzufügen." : "Nutze im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“.");
        return;
      }
      const result = await module.requestInstall();
      showLocalToast(result.installed ? "Das Portal wurde installiert." : "Installation wurde nicht abgeschlossen.", result.installed ? "success" : "info");
    } catch (error) {
      showLocalToast(error?.message || "Installation konnte nicht gestartet werden.", "error");
    }
  }

  function handleClick(event) {
    const target = event.target.closest("button, a, summary, [data-close-menu]");
    if (!target) return;

    if (target.closest("[data-ux-close-menu]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu();
      return;
    }

    if (target.closest("#mobileMoreToggle") || target.closest("[data-ux-more]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMenu();
      return;
    }

    const uxRoute = target.closest("[data-ux-route]");
    if (uxRoute) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const route = uxRoute.dataset.uxRoute;
      const tab = uxRoute.dataset.uxTab;
      location.hash = `#/${route}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
      closeMenu();
      return;
    }

    if (target.closest("#uxRefreshButton")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu();
      document.getElementById("refreshButton")?.click();
      return;
    }

    if (target.closest("#uxInstallButton")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      installApp();
      return;
    }

    if (target.closest("#authStatusCheckButton")) {
      event.preventDefault();
      location.hash = "#/login";
      location.reload();
      return;
    }

    if (target.closest("#authPublicHomeButton")) {
      event.preventDefault();
      location.hash = "#/home";
      return;
    }

    const uxLogout = target.closest("#uxLogoutButton, #profileLogoutButton");
    const nativeLogout = target.closest("#logoutButton, #mobileLogoutButton");
    if (uxLogout) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (logoutInProgress) return;
      logoutInProgress = true;
      closeMenu();
      showTransition("Du wirst abgemeldet …", "Sitzung und lokale Anmeldedaten werden sicher beendet.");
      forwardingLogout = true;
      document.getElementById("logoutButton")?.click();
      forwardingLogout = false;
      return;
    }
    if (nativeLogout) {
      if (forwardingLogout) return;
      if (logoutInProgress) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      logoutInProgress = true;
      showTransition("Du wirst abgemeldet …", "Sitzung und lokale Anmeldedaten werden sicher beendet.");
    }
  }

  function handleAuthChange(event) {
    authState = event.detail || {};
    if (!authState.authenticated && currentHashIsProtected() && !logoutInProgress) {
      rememberCurrentRoute();
      history.replaceState(null, "", "#/login");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    if (logoutInProgress && !authState.authenticated) {
      try { sessionStorage.removeItem(POST_LOGIN_KEY); } catch (error) {}
      window.setTimeout(() => {
        if (routeKey() !== "home") location.hash = "#/home";
        hideTransition("logged-out");
        logoutInProgress = false;
      }, 450);
    }
    scheduleSync();
  }

  function startObservers() {
    if (observerStarted) return;
    observerStarted = true;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          const toast = node.matches?.(".toast.error") ? node : node.querySelector?.(".toast.error");
          if (toast) mirrorLoginError(clean(toast.textContent));
        }
      }
      scheduleSync();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "aria-busy", "data-status"] });
    scheduleSync();
  }

  window.addEventListener("pd-auth-change", handleAuthChange, true);
  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("online", scheduleSync);
  window.addEventListener("offline", scheduleSync);
  window.addEventListener("storage", event => {
    if (event.key !== SESSION_KEY || !event.oldValue || event.newValue) return;
    logoutInProgress = true;
    showTransition("Du wurdest abgemeldet …", "Die Sitzung wurde in einem anderen Tab beendet. Das Portal wird sicher zurückgesetzt.");
    try { sessionStorage.removeItem(POST_LOGIN_KEY); } catch (error) {}
    window.setTimeout(() => { location.hash = "#/home"; location.reload(); }, 500);
  });
  document.addEventListener("click", handleClick, true);
  document.addEventListener("DOMContentLoaded", startObservers, { once: true });
  if (document.readyState !== "loading") startObservers();
})();

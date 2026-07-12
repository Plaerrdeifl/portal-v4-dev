import { auth } from "./auth.js";
import { applyLegacyLinks, escapeHtml, showToast } from "./ui.js";
import { navigate } from "./router.js";

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "");
}

function formatDateTime(value) {
  const date = new Date(Number(value || 0));
  if (!Number.isFinite(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function number(value) {
  return new Intl.NumberFormat("de-DE").format(Number(value || 0));
}

function money(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function statCard(title, value, icon) {
  return `<article class="card stat-card"><div class="card-icon">${escapeHtml(icon)}</div><h3>${escapeHtml(title)}</h3><strong>${escapeHtml(value)}</strong></article>`;
}

async function hydrateHome() {
  const current = auth.current();
  const actions = document.getElementById("homeActions");
  const grid = document.getElementById("homeUserGrid");
  const backendPill = document.getElementById("backendStatusPill");

  if (backendPill) {
    backendPill.textContent = current.backend ? "Verbunden" : "Nicht verbunden";
    backendPill.className = `status-pill ${current.backend ? "success" : "warning"}`;
  }

  if (!current.authenticated) {
    setText("homeStatus", "Anmeldung erforderlich");
    document.getElementById("homeStatus")?.classList.replace("success", "warning");
    setText("homeHeadline", "Willkommen im neuen Plärrdeifl Portal.");
    setText("homeText", "Die PWA ist mit Apps Script verbunden. Melde dich jetzt sicher mit Google an.");
    if (actions) actions.innerHTML = `<button id="homeLoginButton" class="button primary" type="button">Mit Google anmelden</button><a class="button ghost" data-legacy-link href="#">Bisheriges Portal öffnen</a>`;
    document.getElementById("homeLoginButton")?.addEventListener("click", () => navigate("login"));
    if (grid) grid.hidden = true;
    document.getElementById("homeDashboardButton")?.setAttribute("disabled", "disabled");
    applyLegacyLinks();
    return;
  }

  const user = current.user || {};
  setText("homeStatus", "Sicher angemeldet");
  const status = document.getElementById("homeStatus");
  if (status) status.className = "status-pill success";
  setText("homeHeadline", `Servus ${user.name || user.email || "Plärrdeifl"}!`);
  setText("homeText", "Deine Identität, Rolle und Portalrechte wurden vom Apps-Script-Backend bestätigt.");
  if (actions) actions.innerHTML = auth.canAccessRoute("dashboard")
    ? `<button class="button primary" type="button" data-route="dashboard">Dashboard öffnen</button><a class="button ghost" data-legacy-link href="#">Bisheriges Portal</a>`
    : `<a class="button primary" data-legacy-link href="#">Bisheriges Portal öffnen</a>`;
  if (grid) grid.hidden = false;
  setText("homeUserName", user.name || user.email || "–");
  setText("homeUserRole", `${user.role || "Portaluser"}${user.isAdmin ? " · Vollzugriff" : ""}`);
  setText("homeSessionExpiry", formatDateTime(current.expires));
  const dashboardButton = document.getElementById("homeDashboardButton");
  if (dashboardButton) dashboardButton.hidden = !auth.canAccessRoute("dashboard");
  applyLegacyLinks();
}

async function hydrateLogin() {
  const current = auth.current();
  const button = document.getElementById("googleLoginButton");
  const notice = document.getElementById("loginNotice");
  const pill = document.getElementById("loginStatusPill");

  if (current.notice && notice) {
    notice.hidden = false;
    notice.className = `notice ${current.notice.type || "info"}`;
    notice.textContent = current.notice.message + (current.notice.email ? ` (${current.notice.email})` : "");
  }

  if (current.authenticated) {
    if (pill) {
      pill.textContent = "Angemeldet";
      pill.className = "status-pill success";
    }
    setText("loginMessage", `Du bist als ${current.user?.name || current.user?.email || "Portaluser"} angemeldet.`);
    if (button) {
      button.textContent = "Zur Startseite";
      button.addEventListener("click", () => navigate("home"));
    }
    return;
  }

  button?.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Google-Anmeldung wird geöffnet …";
    try {
      await auth.login();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Mit Google anmelden";
      showToast(error.message || "Google-Anmeldung konnte nicht gestartet werden.", "error", 6000);
    }
  });
  applyLegacyLinks();
}

async function hydrateDashboard() {
  const target = document.getElementById("dashboardStats");
  const status = document.getElementById("dashboardStatus");
  try {
    const payload = await auth.call("apiGetStartStats");
    const stats = payload.stats || payload || {};
    if (target) target.innerHTML = [
      statCard("Mitglieder", number(stats.mitgliederAktiv || stats.mitglieder), "👥"),
      statCard("Offene Beiträge", number(stats.beitraegeOffen), "💶"),
      statCard("Offener Betrag", money(stats.beitraegeOffenBetrag), "📌"),
      statCard("Kontosumme", money(stats.kontoSumme), "🏦"),
      statCard("Buchungen", number(stats.buchungen), "📒"),
      statCard("Offene Aufgaben", number(stats.aufgabenOffen), "✅")
    ].join("");
    if (status) {
      status.textContent = "Live verbunden";
      status.className = "status-pill success";
    }
  } catch (error) {
    if (target) target.innerHTML = `<article class="card"><h3>Dashboard konnte nicht geladen werden</h3><p>${escapeHtml(error.message)}</p></article>`;
    if (status) {
      status.textContent = "Fehler";
      status.className = "status-pill warning";
    }
  }
}

export async function hydratePage(routeKey) {
  applyLegacyLinks();
  if (routeKey === "home") return hydrateHome();
  if (routeKey === "login") return hydrateLogin();
  if (routeKey === "dashboard") return hydrateDashboard();
}

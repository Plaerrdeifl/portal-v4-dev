import { auth } from "./auth.js";
import { showToast } from "./ui.js";
import { navigate } from "./router.js";
import { googleIdentity } from "./google-identity.js";
import { installState, requestInstall } from "./install.js";
import { hydrateDashboard } from "./modules/dashboard.js";
import { hydrateFanclub, hydrateCash } from "./modules/fanclub.js";
import { hydrateTeams } from "./modules/teams.js";
import { hydrateFanbus } from "./modules/fanbus.js";
import { hydrateBoard } from "./modules/board.js";
import { hydrateAdmin } from "./modules/admin.js?v=20260714-r71-perf-fast-r5";

let loginController = null;
let loginHydrationId = 0;

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "");
}

function publicConfig() {
  return auth.current().backend?.publicConfig || {};
}

function applyPublicBranding() {
  const cfg = publicConfig();
  const logo = document.getElementById("publicLogo");
  if (logo && cfg.logoUrl && /^https:\/\//i.test(cfg.logoUrl)) logo.src = cfg.logoUrl;
  if (cfg.primaryColor && /^#[0-9a-f]{6}$/i.test(cfg.primaryColor)) {
    document.documentElement.style.setProperty("--blue-800", cfg.primaryColor);
  }
}

async function hydrateHome() {
  if (auth.isAuthenticated()) {
    navigate("dashboard");
    return;
  }
  const cfg = publicConfig();
  applyPublicBranding();
  setText("publicHeadline", cfg.headline || "Herzlich willkommen");
  setText(
    "publicConstructionText",
    cfg.note || "Das Plärrdeifl Portal befindet sich noch im Aufbau. Die öffentlichen Inhalte werden Schritt für Schritt ergänzt."
  );
}

async function hydrateNews() {
  setText("publicNewsText", publicConfig().news || "Neuigkeiten werden hier veröffentlicht, sobald sie im Portal gepflegt sind.");
}

async function hydrateDates() {
  setText("publicDatesText", publicConfig().dates || "Kommende Veranstaltungen und Fanfahrten werden hier angekündigt.");
}

async function hydrateAbout() {
  setText("publicAboutText", publicConfig().about || "Hier entsteht die öffentliche Vorstellung der Schweinfurter Plärrdeifl.");
}

async function hydrateContact() {
  setText("publicContactText", publicConfig().contact || "Kontaktinformationen werden in der Portalverwaltung gepflegt und hier veröffentlicht.");
}

async function hydrateInstall() {
  const button = document.getElementById("pageInstallButton");
  const instructions = document.getElementById("installInstructions");
  const result = document.getElementById("installResult");

  const render = () => {
    const state = installState();
    if (!instructions || !button) return;

    if (state.standalone) {
      instructions.innerHTML = "<p><strong>Das Portal ist bereits als App geöffnet.</strong></p>";
      button.hidden = true;
      return;
    }

    button.hidden = false;
    if (state.ios) {
      instructions.innerHTML = `
        <ol>
          <li>Öffne diese Seite in Safari.</li>
          <li>Tippe auf <strong>Teilen</strong>.</li>
          <li>Wähle <strong>Zum Home-Bildschirm</strong>.</li>
          <li>Bestätige mit <strong>Hinzufügen</strong>.</li>
        </ol>`;
      button.textContent = "Anleitung anzeigen";
      return;
    }

    if (state.promptAvailable) {
      instructions.innerHTML = "<p>Dein Browser kann das Portal direkt als App installieren.</p>";
      button.textContent = "Portal installieren";
      return;
    }

    instructions.innerHTML = "<p>Öffne das Browsermenü und wähle <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>.</p>";
    button.textContent = "Installationshinweis";
  };

  button?.addEventListener("click", async () => {
    const state = installState();
    if (state.ios || !state.promptAvailable) {
      result.textContent = state.ios
        ? "Safari → Teilen → Zum Home-Bildschirm."
        : "Nutze im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“.";
      return;
    }
    const outcome = await requestInstall();
    result.textContent = outcome.installed ? "Das Portal wurde installiert." : "Installation wurde nicht abgeschlossen.";
    render();
  });

  window.addEventListener("pd-install-state-change", render, { once: true });
  render();
}

async function hydrateLogin() {
  const hydrationId = ++loginHydrationId;
  googleIdentity.destroyButton();
  loginController = null;

  const current = auth.current();
  const retry = document.getElementById("loginRetryButton");
  const notice = document.getElementById("loginNotice");
  const pill = document.getElementById("loginStatusPill");
  const bridgeText = document.getElementById("bridgeStatusText");
  const bridgeIcon = document.getElementById("bridgeStatusIcon");
  const oauthText = document.getElementById("oauthStatusText");
  const slot = document.getElementById("googleSignInButton");

  if (current.backend) {
    if (bridgeText) bridgeText.textContent = `Verbunden · ${current.backend.version || current.backend.build || "Backend bereit"}`;
    if (bridgeIcon) bridgeIcon.textContent = "✓";
    if (oauthText) {
      oauthText.textContent = current.backend.gisConfigured
        ? `Direkter Google-Popup-Login ist bereit (${current.backend.clientIdHint || "Client-ID geprüft"}).`
        : "Google Client-ID fehlt oder ist ungültig.";
    }
  } else {
    if (bridgeText) bridgeText.textContent = "Backend nicht erreichbar.";
    if (bridgeIcon) bridgeIcon.textContent = "!";
    if (oauthText) oauthText.textContent = "Noch nicht prüfbar.";
  }

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
    if (slot) slot.innerHTML = '<button id="loginHomeButton" class="button primary" type="button">Zum Dashboard</button>';
    document.getElementById("loginHomeButton")?.addEventListener("click", () => navigate("dashboard"));
    if (retry) retry.hidden = true;
    return;
  }

  if (!current.backend?.gisConfigured || !current.backend?.googleClientId) {
    if (pill) {
      pill.textContent = "Konfiguration fehlt";
      pill.className = "status-pill warning";
    }
    setText("loginMessage", "Direkter Google-Login ist im Backend noch nicht vollständig konfiguriert.");
    return;
  }

  const showError = error => {
    if (hydrationId !== loginHydrationId) return;
    if (pill) {
      pill.textContent = "Fehler";
      pill.className = "status-pill danger";
    }
    const message = error?.message || "Google-Anmeldung fehlgeschlagen.";
    setText("loginMessage", message);
    if (retry) retry.disabled = false;
    showToast(message, "error", 7000);
  };

  const mountGoogleButton = async () => {
    if (hydrationId !== loginHydrationId) return;
    if (retry) retry.disabled = true;
    if (pill) {
      pill.textContent = "Wird vorbereitet";
      pill.className = "status-pill warning";
    }
    setText("loginMessage", "Google-Anmeldung wird sicher vorbereitet …");

    try {
      loginController = await googleIdentity.renderButton(slot, {
        clientId: current.backend.googleClientId,
        onCredential: async ({ credential, nonce }) => {
          if (hydrationId !== loginHydrationId) return { refresh: false };
          if (pill) {
            pill.textContent = "Wird geprüft";
            pill.className = "status-pill warning";
          }
          if (retry) retry.disabled = true;
          setText("loginMessage", "Google-Konto, Sitzung und Rechte werden geprüft …");

          const result = await auth.signInWithGoogleCredential(credential, nonce);
          if (result.authenticated) {
            googleIdentity.destroyButton();
            navigate("dashboard");
            return { refresh: false };
          }

          const latest = auth.current();
          if (notice && latest.notice) {
            notice.hidden = false;
            notice.className = `notice ${latest.notice.type || "warning"}`;
            notice.textContent = latest.notice.message + (latest.notice.email ? ` (${latest.notice.email})` : "");
          }
          if (pill) {
            pill.textContent = "Freischaltung nötig";
            pill.className = "status-pill warning";
          }
          if (retry) retry.disabled = false;
          return { refresh: true };
        },
        onError: async error => {
          showError(error);
        }
      });

      if (hydrationId !== loginHydrationId) {
        loginController?.destroy();
        return;
      }
      if (pill) {
        pill.textContent = "Bereit";
        pill.className = "status-pill success";
      }
      setText("loginMessage", "Wähle dein freigeschaltetes Google-Konto aus.");
    } catch (error) {
      showError(error);
    } finally {
      if (retry && hydrationId === loginHydrationId) retry.disabled = false;
    }
  };

  retry?.addEventListener("click", mountGoogleButton);
  await mountGoogleButton();
}

export async function hydratePage(routeKey) {
  if (routeKey !== "login") {
    loginHydrationId += 1;
    googleIdentity.destroyButton();
    loginController = null;
  }

  if (routeKey === "home") return hydrateHome();
  if (routeKey === "news") return hydrateNews();
  if (routeKey === "dates") return hydrateDates();
  if (routeKey === "about") return hydrateAbout();
  if (routeKey === "contact") return hydrateContact();
  if (routeKey === "install") return hydrateInstall();
  if (routeKey === "login") return hydrateLogin();
  if (routeKey === "dashboard") return hydrateDashboard();
  if (routeKey === "fanclub") return hydrateFanclub();
  if (routeKey === "cash") return hydrateCash();
  if (routeKey === "teams") return hydrateTeams();
  if (routeKey === "board") return hydrateBoard();
  if (routeKey === "fanbus") return hydrateFanbus();
  if (routeKey === "admin") return hydrateAdmin();
}

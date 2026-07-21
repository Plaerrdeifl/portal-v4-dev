import { auth } from "../auth.js";
import { navigate } from "../router.js";
import { escapeHtml, showToast } from "../ui.js";

let releaseProfileViewport = () => {};

export function normalizeRequiredName(value) {
  return String(value ?? "").trim();
}

function fieldErrorNode(input) {
  const errorId = String(input?.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .find(Boolean);
  return errorId ? document.getElementById(errorId) : null;
}

function setNameValidity(input, label) {
  if (!input) return "";
  const value = normalizeRequiredName(input.value);
  const message = value ? "" : label + " ist erforderlich.";
  input.value = value;
  input.setCustomValidity(message);
  const error = fieldErrorNode(input);
  if (error) error.textContent = message;
  return value;
}

function scrollProfileControlIntoView(control) {
  if (!control) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.setTimeout(() => {
    if (!document.contains(control)) return;
    control.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, 80);
}

function bindProfileViewport(form) {
  releaseProfileViewport();
  const viewport = window.visualViewport;

  const updateKeyboardInset = () => {
    const inset = viewport
      ? Math.max(
        0,
        window.innerHeight - viewport.height - Number(viewport.offsetTop || 0)
      )
      : 0;
    document.documentElement.style.setProperty(
      "--profile-keyboard-inset",
      String(Math.round(inset)) + "px"
    );

    const active = document.activeElement;
    if (inset > 0 && active && form.contains(active)) {
      scrollProfileControlIntoView(active);
    }
  };

  const onFocusIn = event => {
    if (event.target?.matches?.("input, select, textarea, button")) {
      scrollProfileControlIntoView(event.target);
    }
  };

  form.addEventListener("focusin", onFocusIn);
  viewport?.addEventListener("resize", updateKeyboardInset);
  viewport?.addEventListener("scroll", updateKeyboardInset);
  updateKeyboardInset();

  const cleanup = () => {
    form.removeEventListener("focusin", onFocusIn);
    viewport?.removeEventListener("resize", updateKeyboardInset);
    viewport?.removeEventListener("scroll", updateKeyboardInset);
    window.removeEventListener("hashchange", cleanup);
    document.documentElement.style.removeProperty("--profile-keyboard-inset");
    if (releaseProfileViewport === cleanup) releaseProfileViewport = () => {};
  };

  releaseProfileViewport = cleanup;
  window.addEventListener("hashchange", cleanup, { once: true });
}

function validateProfileNames(first, last) {
  const firstName = setNameValidity(first, "Vorname");
  const lastName = setNameValidity(last, "Nachname");
  const invalid = !firstName ? first : (!lastName ? last : null);

  if (invalid) {
    try {
      invalid.focus({ preventScroll: true });
    } catch (error) {
      invalid.focus();
    }
    scrollProfileControlIntoView(invalid);
  }

  return { valid: Boolean(firstName && lastName), firstName, lastName };
}

function fieldValue(id, fallback = "") {
  const input = document.getElementById(id);
  if (input && !input.value) input.value = normalizeRequiredName(fallback);
  return input;
}

function replaceCard(content) {
  const card = document.querySelector(".auth-profile-card");
  if (card) card.innerHTML = content;
}

function statusCard(title, message, type = "warning", action = "") {
  return `
    <header class="auth-card-header">
      <span class="auth-eyebrow">Portalzugang</span>
      <div class="auth-title-row">
        <div class="auth-title-copy"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></div>
        <span class="status-pill ${type}">${escapeHtml(title)}</span>
      </div>
    </header>
    ${action}
    <div class="dialog-actions">
      <button id="profileRefreshButton" class="button secondary" type="button">Status aktualisieren</button>
      <button id="profileLogoutButton" class="button ghost" type="button">Abmelden</button>
    </div>`;
}

async function logout() {
  await auth.logout();
  navigate("home", null, true);
}

function bindCommon() {
  document.getElementById("profileLogoutButton")?.addEventListener("click", async () => {
    try { await logout(); }
    catch (error) { showToast(error?.message || "Abmeldung fehlgeschlagen.", "error", 6500); }
  });
  document.getElementById("profileRefreshButton")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await auth.refresh();
      await hydrateProfile();
    } catch (error) {
      showToast(error?.message || "Status konnte nicht aktualisiert werden.", "error", 6500);
      button.disabled = false;
    }
  });
}

export async function hydrateProfile() {
  releaseProfileViewport();
  await auth.initialize();
  const current = auth.current();

  if (!current.authenticated) {
    navigate("login", null, true);
    return;
  }

  if (current.status === "ACTIVE") {
    navigate("dashboard", null, true);
    return;
  }

  if (current.status === "PENDING") {
    replaceCard(statusCard(
      "Freigabe ausstehend",
      "Dein Antrag wurde übermittelt. Ein Administrator muss den Portalzugang freigeben.",
      "warning",
      `<div class="notice"><strong>${escapeHtml(current.request?.firstName || "")} ${escapeHtml(current.request?.lastName || "")}</strong><br>${escapeHtml(current.session?.user?.email || "")}</div>`
    ));
    bindCommon();
    return;
  }

  if (current.status === "INACTIVE") {
    replaceCard(statusCard("Zugang inaktiv", "Dein Portalzugang ist derzeit deaktiviert.", "warning"));
    bindCommon();
    return;
  }

  if (current.status === "BLOCKED") {
    replaceCard(statusCard("Zugang gesperrt", "Dein Portalzugang wurde gesperrt. Wende dich an die Administration.", "error"));
    bindCommon();
    return;
  }

  const isInitialization = current.status === "INITIALIZATION_REQUIRED";
  const isRejected = current.status === "REJECTED";
  const firstName = current.request?.firstName || current.suggestions?.firstName || "";
  const lastName = current.request?.lastName || current.suggestions?.lastName || "";

  const heading = document.getElementById("profileAuthTitle");
  const intro = document.querySelector(".auth-profile-card .auth-intro");
  const pill = document.querySelector(".auth-profile-card .status-pill");
  const notice = document.querySelector(".auth-profile-card .notice.warning");
  const form = document.getElementById("profileCompletionForm");

  if (heading) heading.textContent = isInitialization ? "Portal initialisieren" : "Portalzugang beantragen";
  if (intro) intro.textContent = isInitialization
    ? "Lege den ersten vollständigen Administrator mit dem lokal erzeugten Initialisierungscode an."
    : "Prüfe Vorname und Nachname und sende deinen Freischaltungsantrag ab.";
  if (pill) pill.textContent = isInitialization ? "Ersteinrichtung" : (isRejected ? "Erneuter Antrag" : "Registrierung");
  if (notice) {
    notice.innerHTML = isInitialization
      ? "<strong>Sichere Ersteinrichtung</strong><br>Der Initialisierungscode wurde außerhalb des Repositories erzeugt und kann genau einmal verwendet werden."
      : isRejected
        ? `<strong>Der letzte Antrag wurde abgelehnt.</strong><br>${escapeHtml(current.request?.decisionReason || "Du kannst die Angaben korrigieren und erneut einreichen.")}`
        : "<strong>Freischaltung erforderlich</strong><br>Nach dem Absenden prüft ein Administrator deinen Antrag.";
  }

  const first = fieldValue("profileFirstName", firstName);
  const last = fieldValue("profileLastName", lastName);
  if (isInitialization && form && !document.getElementById("profileBootstrapToken")) {
    const tokenLabel = document.createElement("label");
    tokenLabel.className = "full";
    tokenLabel.innerHTML = 'Initialisierungscode <span aria-hidden="true">*</span><input id="profileBootstrapToken" name="bootstrapToken" type="password" autocomplete="one-time-code" required maxlength="256"><small>Den Code findest du in der vom Operator genannten Datei außerhalb des Repositories.</small>';
    form.insertBefore(tokenLabel, form.querySelector(".dialog-actions"));
  }

  const submit = form?.querySelector('button[type="submit"]');
  if (submit) submit.textContent = isInitialization ? "Portal initialisieren" : "Freischaltung beantragen";

  for (const [input, label] of [[first, "Vorname"], [last, "Nachname"]]) {
    input?.addEventListener("input", () => {
      input.setCustomValidity("");
      const error = fieldErrorNode(input);
      if (error) error.textContent = "";
    });
    input?.addEventListener("blur", () => setNameValidity(input, label));
  }

  form?.addEventListener("invalid", event => {
    scrollProfileControlIntoView(event.target);
  }, true);

  if (form) bindProfileViewport(form);

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const names = validateProfileNames(first, last);
    if (!names.valid || !form.reportValidity()) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Wird sicher gespeichert …";
    try {
      const payload = {
        firstName: names.firstName,
        lastName: names.lastName
      };
      if (isInitialization) {
        payload.token = document.getElementById("profileBootstrapToken")?.value || "";
        await auth.claimInitialAdmin(payload);
        showToast("Portal wurde erfolgreich initialisiert.", "success", 5200);
        navigate("dashboard", null, true);
      } else {
        await auth.submitAccessRequest(payload);
        showToast("Freischaltungsantrag wurde übermittelt.", "success", 5200);
        await hydrateProfile();
      }
    } catch (error) {
      showToast(error?.message || "Speichern fehlgeschlagen.", "error", 7000);
      button.disabled = false;
      button.textContent = original;
    }
  });

  bindCommon();
}

export function noop() {}

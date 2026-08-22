import { api } from "./api.js";
import { auth } from "./auth.js";
import { CONFIG } from "./config.js";
import { renderGoogleSignInButton } from "./google-signin.js";
import { openDialog } from "./modules/common.js";
import { getSupabaseClient } from "./supabase-client.js";

const TURNSTILE_SCRIPT_ID = "m310-turnstile-api";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const runtime = window.PD_RUNTIME_CONFIG || {};
const turnstileSiteKey = String(runtime.m310TurnstileSiteKey || "").trim();

const elements = {
  trip: document.getElementById("m310PublicTrip"),
  panel: document.getElementById("m310RegistrationPanel"),
  title: document.getElementById("m310RegistrationTitle"),
  intro: document.getElementById("m310RegistrationIntro"),
  status: document.getElementById("m310RegistrationStatus"),
  memberLogin: document.getElementById("m310MemberLogin"),
  memberLoginToggle: document.getElementById("m310MemberLoginToggle"),
  memberLoginPanel: document.getElementById("m310MemberLoginPanel"),
  google: document.getElementById("m310GoogleSignIn"),
  portalForm: document.getElementById("m310PortalForm"),
  portalIdentity: document.getElementById("m310PortalIdentity"),
  guestForm: document.getElementById("m310GuestForm"),
  turnstile: document.getElementById("m310Turnstile")
};

let trip = null;
let turnstileWidgetId = null;
let turnstileToken = "";
let turnstileLibraryPromise = null;
let guestAttempt = null;
let portalAttempt = null;
let portalPreviewFingerprint = "";
let selectedCompanionListId = "";
let companionLists = [];
let companionListsLoadState = "PENDING";
let googleSignInReady = false;
let registrationComplete = false;
let modeRenderSequence = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEventDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin"
  }).format(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+02:00`));
}

function formatEventTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit noch offen";
}

function formatBerlinDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin"
  }).format(date);
}

function formatBerlinTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin"
  }).format(date);
}

function registrationStatusLabel(value) {
  return {
    NOT_STARTED: "Anmeldung noch nicht geöffnet",
    OPEN: "Anmeldung offen",
    WAITLIST: "Warteliste möglich",
    CLOSED: "Anmeldung geschlossen",
    CANCELLED: "Fahrt abgesagt",
    UNAVAILABLE: "Nicht verfügbar"
  }[value] || "Nicht verfügbar";
}

function registrationStatusClass(value) {
  if (value === "OPEN") return "success";
  if (value === "NOT_STARTED" || value === "WAITLIST") return "warning";
  if (value === "CANCELLED") return "error";
  return "";
}

function setStatus(message, type = "") {
  elements.status.textContent = message;
  elements.status.className = `notice fanbus-public-status${type ? ` ${type}` : ""}`;
  elements.status.hidden = !message;
}

function setFormBusy(form, busy) {
  for (const control of form.elements) control.disabled = Boolean(busy);
}

function unavailableTrip() {
  elements.trip.className = "empty-state";
  elements.trip.innerHTML = `
    <strong>Fanbusfahrt nicht verfügbar</strong>
    <p>Die ausgewählte Fahrt kann aktuell nicht angezeigt werden.</p>
    <a class="button secondary" href="./">Zum Portal</a>`;
  elements.panel.hidden = true;
}

function renderTrip() {
  if (!trip?.available) {
    unavailableTrip();
    return;
  }

  const statusClass = registrationStatusClass(trip.registrationStatus);
  const tripCancelled = trip.tripStatus === "CANCELLED";

  elements.trip.className = "entity-card fanbus-public-trip-card";
  elements.trip.innerHTML = `
    <div class="fanbus-public-trip-head">
      <span class="fanbus-public-trip-date">${escapeHtml(formatEventDate(trip.eventDate))} · ${escapeHtml(formatEventTime(trip.eventTime))}</span>
      <span class="fanbus-public-trip-status${statusClass ? ` ${statusClass}` : ""}">${escapeHtml(registrationStatusLabel(trip.registrationStatus))}</span>
    </div>
    <h2>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</h2>
    ${tripCancelled ? `
      <div class="notice error fanbus-trip-cancellation" role="status">
        <strong>Fahrt abgesagt</strong>
        <p>${escapeHtml(trip.cancellationReason || "Diese Fanbusfahrt findet nicht statt.")}</p>
        ${trip.cancelledAt ? `<small>Abgesagt am ${escapeHtml(formatBerlinDateTime(trip.cancelledAt))}</small>` : ""}
      </div>
    ` : ""}`;

  if (registrationComplete) {
    elements.panel.hidden = false;
    return;
  }

  if (!["OPEN", "WAITLIST"].includes(trip.registrationStatus)) {
    elements.panel.hidden = false;
    elements.title.textContent = registrationStatusLabel(trip.registrationStatus);
    elements.intro.textContent = tripCancelled
      ? "Diese Fanbusfahrt wurde abgesagt. Eine Anmeldung ist nicht möglich."
      : "Für diese Fahrt ist aktuell keine Anmeldung möglich.";
    elements.intro.hidden = false;
    elements.portalForm.hidden = true;
    elements.guestForm.hidden = true;
    elements.memberLogin.hidden = true;
    elements.google.hidden = true;
    setStatus("", "");
    return;
  }

  if (trip.registrationStatus === "WAITLIST") {
    elements.intro.textContent = Number(trip.remainingCapacity) > 0
      ? "Warteliste aktiv – freie Plätze werden zuerst aus der Warteliste vergeben."
      : "Fahrt aktuell voll – Anmeldung auf Warteliste möglich.";
  }

  elements.panel.hidden = false;
}

function appendReferenceConsent(target, prefix, linkText, suffix, reference) {
  target.replaceChildren(document.createTextNode(prefix));
  const normalized = String(reference || "").trim();

  try {
    const url = new URL(normalized);
    if (url.protocol === "https:" && !url.username && !url.password) {
      const link = document.createElement("a");
      link.className = "fanbus-public-legal-link";
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = linkText;
      target.append(link);
      target.append(document.createTextNode(suffix));
      return;
    }
  } catch {
    // Non-URL references are rendered as text only.
  }

  target.append(document.createTextNode(`${linkText}${suffix}`));
}

function renderConsentReferences() {
  appendReferenceConsent(
    document.getElementById("m310PortalPrivacyConsent"),
    "Ich bestätige die ",
    "Datenschutzhinweise",
    ".",
    trip.privacyReference
  );
  appendReferenceConsent(
    document.getElementById("m310PortalTermsConsent"),
    "Ich akzeptiere die ",
    "Teilnahmebedingungen",
    ".",
    trip.termsReference
  );
  appendReferenceConsent(
    document.getElementById("m310GuestPrivacyConsent"),
    "Ich bestätige die ",
    "Datenschutzhinweise",
    ".",
    trip.privacyReference
  );
  appendReferenceConsent(
    document.getElementById("m310GuestTermsConsent"),
    "Ich akzeptiere die ",
    "Teilnahmebedingungen",
    ".",
    trip.termsReference
  );
}

function removeTurnstile() {
  if (turnstileWidgetId !== null && window.turnstile) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {
      // Widget state is discarded locally without exposing details.
    }
  }
  turnstileWidgetId = null;
  turnstileToken = "";
  elements.turnstile.replaceChildren();
}

function resetTurnstile() {
  turnstileToken = "";
  if (turnstileWidgetId !== null && window.turnstile) {
    try {
      window.turnstile.reset(turnstileWidgetId);
    } catch {
      removeTurnstile();
    }
  }
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLibraryPromise) return turnstileLibraryPromise;

  turnstileLibraryPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    const script = existing || document.createElement("script");
    const timeout = window.setTimeout(() => reject(new Error("TURNSTILE_TIMEOUT")), 12000);

    const finish = () => {
      window.clearTimeout(timeout);
      window.turnstile ? resolve(window.turnstile) : reject(new Error("TURNSTILE_UNAVAILABLE"));
    };
    const fail = () => {
      window.clearTimeout(timeout);
      reject(new Error("TURNSTILE_UNAVAILABLE"));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      document.head.append(script);
    }
  }).catch(error => {
    turnstileLibraryPromise = null;
    throw error;
  });

  return turnstileLibraryPromise;
}

async function ensureTurnstile() {
  if (turnstileWidgetId !== null) return true;
  if (!turnstileSiteKey || turnstileSiteKey === "YOUR_TURNSTILE_SITE_KEY") return false;

  try {
    const turnstile = await loadTurnstile();
    if (turnstileWidgetId !== null) return true;
    turnstileWidgetId = turnstile.render(elements.turnstile, {
      sitekey: turnstileSiteKey,
      action: "m310_fanbus_registration",
      callback: token => { turnstileToken = String(token || ""); },
      "expired-callback": () => { turnstileToken = ""; },
      "error-callback": () => { turnstileToken = ""; },
      theme: "light",
      language: "de"
    });
    return true;
  } catch {
    return false;
  }
}

function attemptFor(currentAttempt, fingerprint) {
  return currentAttempt?.fingerprint === fingerprint
    ? currentAttempt
    : { fingerprint, key: crypto.randomUUID() };
}

function safeOutcomeMessage(outcome) {
  return {
    WAITLISTED: "Die gesamte Anmeldung wurde auf die Warteliste gesetzt.",
    NOT_STARTED: "Die Anmeldung hat noch nicht begonnen.",
    CLOSED: "Die Anmeldung ist geschlossen.",
    CANCELLED: "Diese Fanbusfahrt wurde abgesagt.",
    FANBUS_TRIP_CANCELLED: "Diese Fanbusfahrt wurde abgesagt.",
    UNAVAILABLE: "Diese Fanbusfahrt ist aktuell nicht verfügbar."
  }[outcome] || "Die Anmeldung konnte nicht verarbeitet werden.";
}

function finishRegistration(outcome = "CREATED") {
  registrationComplete = true;
  const waitlisted = outcome === "WAITLISTED";
  elements.title.textContent = waitlisted ? "Auf Warteliste eingetragen" : "Anmeldung bestätigt";
  elements.intro.hidden = false;
  elements.intro.textContent = waitlisted
    ? "Die gesamte gemeinsame Anmeldung wurde auf die Warteliste gesetzt."
    : "Deine gemeinsame Anmeldung wurde erfolgreich entgegengenommen.";
  elements.portalForm.hidden = true;
  elements.guestForm.hidden = true;
  elements.memberLogin.hidden = true;
  elements.memberLoginPanel.hidden = true;
  elements.google.hidden = true;
  removeTurnstile();
  setStatus(waitlisted ? "Die gesamte Anmeldung ist auf der Warteliste." : "Die Fanbus-Anmeldung wurde bestätigt.", waitlisted ? "warning" : "success");
}

function busPreferenceLabel(value) {
  return { EGAL: "Egal", RUHIG: "Ruhig", PARTY: "Party" }[value] || "Egal";
}

function busPreferenceOptions(selected = "EGAL") {
  return ["EGAL", "RUHIG", "PARTY"].map(value =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${busPreferenceLabel(value)}</option>`
  ).join("");
}

function resolvedBoardingStop(value) {
  const requested = String(value || "");
  if (!requested) return null;
  return (trip?.boardingStops || []).find(stop => [
    stop.id,
    stop.tripBoardingStopId,
    stop.boardingStopId
  ].some(candidate => String(candidate || "") === requested)) || null;
}

function resolvedBoardingStopValue(value) {
  const stop = resolvedBoardingStop(value);
  return String(stop?.id || value || "");
}

function boardingStopOptions(selected = "") {
  const resolved = resolvedBoardingStopValue(selected);
  return `<option value="">Bitte wählen</option>${(trip?.boardingStops || []).map(stop => `<option value="${escapeHtml(stop.id)}"${String(stop.id) === resolved ? " selected" : ""}>${escapeHtml(`${stop.label} · ${formatBerlinTime(stop.departureAt)}`)}</option>`).join("")}`;
}

function companionValues(member = {}) {
  return {
    firstName: String(member.firstName || ""),
    lastName: String(member.lastName || ""),
    email: String(member.email || ""),
    busPreference: String(member.busPreference || member.defaultBusPreference || "EGAL"),
    boardingStopId: resolvedBoardingStopValue(
      member.boardingStopId || member.defaultBoardingStopId || ""
    ),
    operationalNote: String(member.operationalNote || "")
  };
}

function companionMeta(values) {
  const parts = [busPreferenceLabel(values.busPreference)];
  const stop = resolvedBoardingStop(values.boardingStopId);
  if (stop?.label) parts.push(stop.label);
  else if (tripHasBoardingStops()) parts.push("Zustiegsort fehlt");
  if (values.operationalNote) parts.push("Hinweis");
  return parts.join(" · ");
}

function tripHasBoardingStops() {
  return Array.isArray(trip?.boardingStops) && trip.boardingStops.length > 0;
}

function companionCardDisplayName(card) {
  return [
    card.querySelector('[name="companionFirstName"]')?.value.trim(),
    card.querySelector('[name="companionLastName"]')?.value.trim()
  ].filter(Boolean).join(" ");
}

function companionCardHasValidBoardingStop(card) {
  if (!tripHasBoardingStops()) return true;
  const boardingStopId = card.querySelector('[name="companionBoardingStopId"]')?.value || "";
  return Boolean(boardingStopId && resolvedBoardingStop(boardingStopId));
}

function requestCompanionBoardingStop(mode, card) {
  const name = companionCardDisplayName(card);
  setStatus(
    name
      ? `Bitte wähle für ${name} einen Zustiegsort.`
      : "Bitte wähle für den Mitfahrer einen Zustiegsort.",
    "warning"
  );
  openCompanionEditor(mode, card);
}

function validateCompanionBoardingStops(form, mode) {
  if (!tripHasBoardingStops()) return true;
  const invalidCard = [...form.querySelectorAll("[data-m320-companion]")]
    .find(card => !companionCardHasValidBoardingStop(card));
  if (!invalidCard) return true;
  requestCompanionBoardingStop(mode, invalidCard);
  return false;
}

function companionMarkup(index, member = null) {
  const linked = Boolean(member?.linkedPortalUserId);
  const unavailable = linked && member.portalUserStatus !== "ACTIVE";
  const values = companionValues(member || {});
  const displayName = `${values.firstName} ${values.lastName}`.trim() || `Mitfahrer ${index + 1}`;
  return `<article class="fanbus-companion" data-m320-companion${member?.id ? ` data-m325-template-member-id="${escapeHtml(member.id)}"` : ""}${linked ? ` data-m325-linked-portal-user-id="${escapeHtml(member.linkedPortalUserId)}"` : ""}>
    <input type="hidden" name="companionFirstName" value="${escapeHtml(values.firstName)}">
    <input type="hidden" name="companionLastName" value="${escapeHtml(values.lastName)}">
    <input type="hidden" name="companionEmail" value="${escapeHtml(values.email)}">
    <input type="hidden" name="companionBusPreference" value="${escapeHtml(values.busPreference)}">
    <input type="hidden" name="companionBoardingStopId" value="${escapeHtml(values.boardingStopId)}">
    <input type="hidden" name="companionOperationalNote" value="${escapeHtml(values.operationalNote)}">
    <div class="fanbus-companion-person"><strong data-m325-companion-name>${escapeHtml(displayName)}</strong>${linked ? `<span class="v4-person-badges v4-m325-companion-identity-badges"><span class="v4-person-badge${unavailable ? " is-inactive" : ""}">${unavailable ? "Portaluser · inaktiv" : "Portaluser"}</span></span>` : ""}</div>
    <span class="fanbus-companion-meta" data-m325-companion-meta>${escapeHtml(companionMeta(values))}</span>
    <div class="fanbus-companion-actions"><button class="button small secondary" type="button" data-m325-edit-booking-companion>Ändern</button><button class="button small ghost fanbus-companion-remove" type="button" data-m320-remove-companion aria-label="Mitfahrer entfernen">×</button></div>
  </article>`;
}

function renderBoardingStopFields() {
  const hasStops = Array.isArray(trip?.boardingStops) && trip.boardingStops.length > 0;
  ["portal", "guest"].forEach(mode => {
    const label = document.querySelector(`[data-m325-primary-stop="${mode}"]`);
    const select = label?.querySelector("select");
    if (!label || !select) return;
    label.hidden = !hasStops;
    select.required = hasStops;
    select.innerHTML = hasStops ? boardingStopOptions() : "";
  });
}

function resetPortalSubmissionState() {
  portalAttempt = null;
  portalPreviewFingerprint = "";
  const previewBox = document.querySelector("[data-m325-duplicate-preview]");
  if (previewBox) {
    previewBox.hidden = true;
    previewBox.replaceChildren();
  }
  const submit = elements.portalForm.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Verbindlich anmelden";
}

function updateBookingSummary(mode) {
  const form = mode === "portal" ? elements.portalForm : elements.guestForm;
  const target = document.querySelector(`[data-m320-booking-summary="${mode}"]`);
  if (!form || !target) return;
  const companionCount = form.querySelectorAll("[data-m320-companion]").length;
  const total = companionCount + 1;
  target.textContent = `${total} ${total === 1 ? "Person wird" : "Personen werden"} angemeldet`;
  const count = document.querySelector(`[data-m320-companion-count="${mode}"]`);
  if (count) count.textContent = `${companionCount} ${companionCount === 1 ? "Person" : "Personen"}`;
  if (mode === "portal") resetPortalSubmissionState();
}

function refreshCompanionCard(card) {
  const values = companionValues({
    firstName: card.querySelector('[name="companionFirstName"]')?.value,
    lastName: card.querySelector('[name="companionLastName"]')?.value,
    busPreference: card.querySelector('[name="companionBusPreference"]')?.value,
    boardingStopId: card.querySelector('[name="companionBoardingStopId"]')?.value,
    operationalNote: card.querySelector('[name="companionOperationalNote"]')?.value
  });
  const name = `${values.firstName} ${values.lastName}`.trim();
  card.querySelector("[data-m325-companion-name]").textContent = name;
  card.querySelector("[data-m325-companion-meta]").textContent = companionMeta(values);
}

function writeCompanionCard(card, values) {
  const fields = {
    companionFirstName: values.firstName,
    companionLastName: values.lastName,
    companionEmail: values.email,
    companionBusPreference: values.busPreference,
    companionBoardingStopId: values.boardingStopId,
    companionOperationalNote: values.operationalNote
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = card.querySelector(`[name="${name}"]`);
    if (input) input.value = String(value || "");
  });
  refreshCompanionCard(card);
}

function bindCompanionCard(card, mode) {
  card.querySelector("[data-m325-edit-booking-companion]")?.addEventListener("click", () => {
    openCompanionEditor(mode, card);
  });
  card.querySelector("[data-m320-remove-companion]")?.addEventListener("click", () => {
    card.remove();
    if (!elements.portalForm.querySelector("[data-m325-template-member-id]")) {
      selectedCompanionListId = "";
    }
    updateBookingSummary(mode);
  });
}

function insertCompanion(mode, member) {
  const target = document.querySelector(`[data-m320-companions="${mode}"]`);
  if (!target || target.children.length >= 19) return null;
  target.insertAdjacentHTML("beforeend", companionMarkup(target.children.length, member));
  const card = target.lastElementChild;
  bindCompanionCard(card, mode);
  updateBookingSummary(mode);
  return card;
}

function companionEditorBody(linked, values) {
  const stopField = Array.isArray(trip?.boardingStops) && trip.boardingStops.length
    ? `<label class="v4-field-full">Zustiegsort<select name="boardingStopId" required>${boardingStopOptions(values.boardingStopId)}</select></label>`
    : "";
  return `<form class="form-grid v4-smart-form">
    ${linked
      ? `<div class="fanbus-public-identity-row v4-field-full"><strong>${escapeHtml(`${values.firstName} ${values.lastName}`.trim())}</strong><span class="v4-person-badge">Portaluser</span></div>`
      : `<label class="v4-field-half">Vorname<input name="firstName" maxlength="120" required value="${escapeHtml(values.firstName)}"></label><label class="v4-field-half">Nachname<input name="lastName" maxlength="120" required value="${escapeHtml(values.lastName)}"></label><label class="v4-field-full">E-Mail (optional)<input name="email" type="email" maxlength="320" value="${escapeHtml(values.email)}"></label>`}
    <label class="v4-field-full">Buswunsch<select name="busPreference" required>${busPreferenceOptions(values.busPreference)}</select></label>
    ${stopField}
    <label class="v4-field-full">Hinweis (optional)<textarea name="operationalNote" maxlength="240">${escapeHtml(values.operationalNote)}</textarea></label>
  </form>`;
}

function openCompanionEditor(mode, card = null) {
  const linked = Boolean(card?.dataset.m325LinkedPortalUserId);
  const current = companionValues(card ? {
    firstName: card.querySelector('[name="companionFirstName"]')?.value,
    lastName: card.querySelector('[name="companionLastName"]')?.value,
    email: card.querySelector('[name="companionEmail"]')?.value,
    busPreference: card.querySelector('[name="companionBusPreference"]')?.value,
    boardingStopId: card.querySelector('[name="companionBoardingStopId"]')?.value,
    operationalNote: card.querySelector('[name="companionOperationalNote"]')?.value
  } : {});
  openDialog({
    kicker: "Fanbus-Anmeldung",
    title: card ? "Mitfahrer ändern" : "Gast hinzufügen",
    body: companionEditorBody(linked, current),
    submitLabel: card ? "Änderungen übernehmen" : "Mitfahrer hinzufügen",
    onSubmit: async values => {
      const next = companionValues({
        firstName: linked ? current.firstName : values.firstName,
        lastName: linked ? current.lastName : values.lastName,
        email: linked ? "" : values.email,
        busPreference: values.busPreference,
        boardingStopId: values.boardingStopId,
        operationalNote: values.operationalNote
      });
      if (card) writeCompanionCard(card, next);
      else insertCompanion(mode, next);
      updateBookingSummary(mode);
    }
  });
}

function companionsFor(form) {
  return [...form.querySelectorAll("[data-m320-companion]")].map(card => {
    const linked = Boolean(card.dataset.m325LinkedPortalUserId);
    const email = card.querySelector('[name="companionEmail"]')?.value.trim() || "";
    const boardingStop = resolvedBoardingStop(
      card.querySelector('[name="companionBoardingStopId"]')?.value || ""
    );
    return {
      firstName: card.querySelector('[name="companionFirstName"]')?.value.trim() || "",
      lastName: card.querySelector('[name="companionLastName"]')?.value.trim() || "",
      ...(!linked && email ? { email } : {}),
      busPreference: card.querySelector('[name="companionBusPreference"]')?.value || "",
      ...(boardingStop?.id ? { boardingStopId: boardingStop.id } : {}),
      operationalNote: card.querySelector('[name="companionOperationalNote"]')?.value.trim() || "",
      ...(card.dataset.m325TemplateMemberId ? { templateMemberId: card.dataset.m325TemplateMemberId } : {})
    };
  });
}

async function loadCompanionLists() {
  companionListsLoadState = "PENDING";
  try {
    const data = await api.call("fanbus_companion_lists_list", {});
    companionLists = Array.isArray(data?.lists) ? data.lists : [];
    companionListsLoadState = "LOADED";
  } catch {
    companionLists = [];
    companionListsLoadState = "ERROR";
  }
  return companionLists;
}

function companionListMemberMarkup(member) {
    const unavailable = Boolean(member.linkedPortalUserId && member.portalUserStatus !== "ACTIVE");
    const identity = member.linkedPortalUserId
      ? `<span class="v4-person-badges v4-m325-companion-identity-badges"><span class="v4-person-badge${unavailable ? " is-inactive" : ""}">${unavailable ? "Portaluser · inaktiv" : "Portaluser"}</span></span>`
      : "";
  return `<label class="check-row fanbus-public-list-member"><input type="checkbox" name="member_${escapeHtml(member.id)}"${unavailable ? " disabled" : " checked"}><span class="v4-m325-template-person"><span class="v4-m325-template-person-name">${escapeHtml(`${member.firstName} ${member.lastName}`)}</span>${identity}</span></label>`;
}

function replaceTemplateCompanions(list, selected) {
  const target = document.querySelector('[data-m320-companions="portal"]');
  if (!target) return;
  target.querySelectorAll("[data-m325-template-member-id]").forEach(card => card.remove());
  selectedCompanionListId = list.id;
  selected.forEach(member => insertCompanion("portal", member));
  updateBookingSummary("portal");
}

function openCompanionListCreateDialog() {
  openDialog({
    kicker: "Mitfahrer",
    title: "Mitfahrerliste anlegen",
    body: `<form class="form-grid v4-smart-form">
      <p class="subtle v4-field-full">Noch keine Mitfahrerliste vorhanden.</p>
      <label class="v4-field-full">Listenname<input name="name" maxlength="120" required placeholder="z. B. Auswärtsfahrt"></label>
    </form>`,
    submitLabel: "Mitfahrerliste anlegen",
    onSubmit: async values => {
      const created = await api.call("fanbus_companion_list_upsert", { name: values.name });
      selectedCompanionListId = String(created?.id || "");
      await loadCompanionLists();
      window.setTimeout(openCompanionListDialog, 0);
    }
  });
}

function openCompanionListDialog() {
  if (companionListsLoadState === "ERROR") {
    openDialog({
      kicker: "Mitfahrer",
      title: "Mitfahrerliste",
      body: '<p class="subtle">Deine Mitfahrerliste konnte gerade nicht geladen werden. Bitte versuche es erneut.</p>'
    });
    return;
  }
  if (companionListsLoadState !== "LOADED") {
    openDialog({
      kicker: "Mitfahrer",
      title: "Mitfahrerliste",
      body: '<p class="subtle">Deine Mitfahrerliste wird gerade geladen.</p>'
    });
    return;
  }
  if (companionListsLoadState === "LOADED" && !companionLists.length) {
    openCompanionListCreateDialog();
    return;
  }
  const initialList = companionLists.find(list => list.id === selectedCompanionListId) || companionLists[0];
  const dialog = openDialog({
    kicker: "Mitfahrer",
    title: "Aus Mitfahrerliste",
    body: `<form class="fanbus-public-list-picker">
      <label>Liste<select name="listId">${companionLists.map(list => `<option value="${escapeHtml(list.id)}"${list.id === initialList.id ? " selected" : ""}>${escapeHtml(list.name)} (${list.members.length})</option>`).join("")}</select></label>
      <div class="fanbus-public-list-members" data-m325-public-list-members></div>
    </form>`,
    submitLabel: "Übernehmen",
    onSubmit: async values => {
      const list = companionLists.find(item => item.id === values.listId);
      const selected = (list?.members || []).filter(member => values[`member_${member.id}`] === "on");
      const existingGuests = elements.portalForm.querySelectorAll("[data-m320-companion]:not([data-m325-template-member-id])").length;
      if (!selected.length) throw new Error("Bitte wähle mindestens eine Person aus der Liste aus.");
      if (selected.length + existingGuests > 19) throw new Error("Die Auswahl enthält zu viele Mitfahrer.");
      replaceTemplateCompanions(list, selected);
    }
  });
  const select = dialog.querySelector('[name="listId"]');
  const members = dialog.querySelector("[data-m325-public-list-members]");
  const renderMembers = () => {
    const list = companionLists.find(item => item.id === select.value);
    members.innerHTML = (list?.members || []).map(companionListMemberMarkup).join("")
      || '<p class="subtle">Diese Liste enthält keine Personen.</p>';
  };
  select.addEventListener("change", renderMembers);
  renderMembers();
}

async function submitPortal(event) {
  event.preventDefault();
  if (!trip || registrationComplete || !elements.portalForm.reportValidity()) return;
  if (!validateCompanionBoardingStops(elements.portalForm, "portal")) return;

  const formData = new FormData(elements.portalForm);
  const payload = {
    tripId: trip.tripId,
    busPreference: String(formData.get("busPreference") || ""),
    ...(formData.get("boardingStopId") ? { boardingStopId: String(formData.get("boardingStopId")) } : {}),
    companions: companionsFor(elements.portalForm),
    privacyConfirmed: formData.get("privacyConfirmed") === "on",
    termsConfirmed: formData.get("termsConfirmed") === "on"
  };
  const fingerprint = JSON.stringify(payload);
  portalAttempt = attemptFor(portalAttempt, fingerprint);
  const templateCompanions = payload.companions.filter(item => item.templateMemberId);

  if (templateCompanions.length && portalPreviewFingerprint !== fingerprint) {
    setFormBusy(elements.portalForm, true);
    setStatus("Doppelte Anmeldungen werden serverseitig geprüft …");
    try {
      const preview = await api.call("fanbus_companion_duplicate_preview", {
        tripId: trip.tripId,
        participants: templateCompanions
      });
      const previewBox = document.querySelector("[data-m325-duplicate-preview]");
      if (!preview.canSubmit) {
        const labels = {
          ALREADY_REGISTERED: "Bereits angemeldet",
          CONFLICT: "Identitätskonflikt",
          UNAVAILABLE: "Nicht buchbar"
        };
        const issues = [];
        if (labels[preview.primaryStatus]) {
          issues.push(`Deine Anmeldung: ${labels[preview.primaryStatus]}`);
        }
        preview.members.forEach((item, index) => {
          if (!labels[item.status]) return;
          const companion = templateCompanions[index];
          const name = [companion?.firstName, companion?.lastName]
            .filter(Boolean)
            .join(" ") || `Person ${index + 1}`;
          issues.push(`${name}: ${labels[item.status]}`);
        });
        previewBox.hidden = false;
        previewBox.className = "notice full warning";
        previewBox.innerHTML = `<strong>Buchung nicht möglich</strong>${issues.length ? `<ul>${issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : "<p>Die Anmeldung enthält einen Konflikt und kann nicht abgesendet werden.</p>"}`;
        setStatus("Die Buchung kann wegen bestehender Anmeldungen oder Konflikten nicht bestätigt werden.", "warning");
        return;
      }
      portalPreviewFingerprint = fingerprint;
      previewBox.hidden = true;
      previewBox.replaceChildren();
    } catch {
      setStatus("Die Prüfung auf bestehende Anmeldungen konnte nicht durchgeführt werden.", "error");
      return;
    } finally {
      setFormBusy(elements.portalForm, false);
    }
  }

  setFormBusy(elements.portalForm, true);
  setStatus("Anmeldung wird übermittelt …");
  try {
    const action = templateCompanions.length
      ? "fanbus_companion_booking_submit"
      : "fanbus_self_register";
    const request = templateCompanions.length
      ? {
        ...payload,
        listId: selectedCompanionListId,
        participants: payload.companions,
        idempotencyKey: portalAttempt.key
      }
      : { ...payload, idempotencyKey: portalAttempt.key };
    if (templateCompanions.length) delete request.companions;
    const result = await api.call(action, request);
    if (["CREATED", "WAITLISTED", "ALREADY_ACTIVE"].includes(result?.outcome)) {
      const previewBox = document.querySelector("[data-m325-duplicate-preview]");
      if (previewBox) {
        previewBox.hidden = true;
        previewBox.replaceChildren();
      }
      finishRegistration(result.outcome);
      void refreshTripAfterSuccess();
      return;
    }
    setStatus(safeOutcomeMessage(result?.outcome), "warning");
  } catch {
    setStatus("Die Anmeldung konnte gerade nicht verarbeitet werden. Bitte versuche es erneut.", "error");
  } finally {
    if (!registrationComplete) setFormBusy(elements.portalForm, false);
  }
}

async function submitGuest(event) {
  event.preventDefault();
  if (!trip || registrationComplete || !elements.guestForm.reportValidity()) return;
  if (!validateCompanionBoardingStops(elements.guestForm, "guest")) return;
  if (!turnstileToken) {
    setStatus("Bitte führe zuerst die Sicherheitsprüfung durch.", "warning");
    return;
  }

  const formData = new FormData(elements.guestForm);
  const payload = {
    tripId: trip.tripId,
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    busPreference: String(formData.get("busPreference") || ""),
    ...(formData.get("boardingStopId") ? { boardingStopId: String(formData.get("boardingStopId")) } : {}),
    companions: companionsFor(elements.guestForm),
    privacyConfirmed: formData.get("privacyConfirmed") === "on",
    termsConfirmed: formData.get("termsConfirmed") === "on"
  };
  const fingerprint = JSON.stringify(payload);
  guestAttempt = attemptFor(guestAttempt, fingerprint);

  setFormBusy(elements.guestForm, true);
  setStatus("Anmeldung wird übermittelt …");
  let succeeded = false;
  try {
    const response = await fetch(
      `${CONFIG.supabase.url.replace(/\/+$/, "")}/functions/v1/m310-fanbus-register`,
      {
        method: "POST",
        credentials: "omit",
        headers: {
          apikey: CONFIG.supabase.publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          idempotencyKey: guestAttempt.key,
          turnstileToken
        })
      }
    );

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (response.ok && result?.ok === true && result?.code === "ACCEPTED") {
      succeeded = true;
      finishRegistration(result?.outcome === "WAITLISTED" ? "WAITLISTED" : "CREATED");
      void refreshTripAfterSuccess();
      return;
    }

    if (response.status === 429) {
      setStatus("Zu viele Versuche. Bitte versuche es später erneut.", "warning");
    } else if (response.status === 403 && result?.code === "TURNSTILE_REJECTED") {
      setStatus("Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuche es erneut.", "warning");
    } else if (["FULL", "NOT_STARTED", "CLOSED", "FANBUS_TRIP_CANCELLED", "UNAVAILABLE"].includes(result?.code)) {
      setStatus(safeOutcomeMessage(result.code), "warning");
    } else if (response.status >= 500) {
      setStatus("Die Anmeldung konnte gerade nicht verarbeitet werden. Bitte versuche es erneut.", "error");
    } else {
      setStatus("Bitte prüfe deine Eingaben und versuche es erneut.", "error");
    }
  } catch {
    setStatus("Die Anmeldung konnte gerade nicht übertragen werden. Bitte versuche es erneut.", "error");
  } finally {
    if (!succeeded) {
      resetTurnstile();
      setFormBusy(elements.guestForm, false);
    }
  }
}

async function toggleMemberLogin() {
  if (auth.current().authenticated) return;
  const opening = elements.memberLoginPanel.hidden;
  elements.memberLoginPanel.hidden = !opening;
  elements.google.hidden = !opening;
  elements.memberLoginToggle.setAttribute("aria-expanded", String(opening));
  if (!opening || googleSignInReady) return;

  try {
    await renderGoogleSignInButton(elements.google, {
      clientId: CONFIG.auth.googleClientId,
      onCredential: async (response, nonce) => {
        try {
          await auth.signInWithGoogleIdToken(response?.credential, nonce);
          await renderMode();
        } catch {
          setStatus("Die Portal-Anmeldung ist fehlgeschlagen. Die Gastanmeldung bleibt verfügbar.", "error");
        }
      }
    });
    googleSignInReady = true;
  } catch {
    setStatus("Die Google-Anmeldung ist aktuell nicht verfügbar. Die Gastanmeldung bleibt verfügbar.", "warning");
  }
}

async function renderMode() {
  const sequence = ++modeRenderSequence;
  if (!trip || !["OPEN", "WAITLIST"].includes(trip.registrationStatus) || registrationComplete) return;

  const current = auth.current();
  elements.portalForm.hidden = true;
  elements.guestForm.hidden = true;
  elements.memberLogin.hidden = true;
  elements.memberLoginPanel.hidden = true;
  elements.memberLoginToggle.setAttribute("aria-expanded", "false");
  elements.google.hidden = true;
  setStatus("", "");

  if (current.authenticated && current.status === "ACTIVE") {
    removeTurnstile();
    elements.title.textContent = "Deine Anmeldung";
    elements.intro.textContent = "";
    elements.intro.hidden = true;
    elements.portalIdentity.innerHTML = `<strong>${escapeHtml(current.user?.name || current.user?.email || "Portalprofil")}</strong><span class="v4-person-badge">Portaluser</span>`;
    await loadCompanionLists();
    if (sequence !== modeRenderSequence) return;
    elements.portalForm.hidden = false;
    updateBookingSummary("portal");
    return;
  }

  elements.title.textContent = "Anmeldung";
  elements.intro.textContent = current.authenticated
    ? "Dein Portalzugang ist nicht aktiv. Du kannst dich weiterhin als Gast anmelden."
    : "";
  elements.intro.hidden = !elements.intro.textContent;
  elements.guestForm.hidden = false;
  updateBookingSummary("guest");
  elements.guestForm.querySelector('button[type="submit"]').disabled = false;

  if (!current.authenticated) {
    elements.memberLogin.hidden = false;
  }

  const turnstileReady = await ensureTurnstile();
  if (sequence !== modeRenderSequence) return;
  if (!turnstileReady) {
    setStatus("Die Sicherheitsprüfung ist aktuell nicht verfügbar. Bitte versuche es später erneut.", "error");
    elements.guestForm.querySelector('button[type="submit"]').disabled = true;
  }
}

async function loadTrip(tripId) {
  if (!CONFIG.supabase.configured) return null;
  try {
    const [{ data, error }, { data: stopData, error: stopError }] = await Promise.all([
      getSupabaseClient().rpc("pd_public_fanbus_trip", {
      p_trip_id: tripId
      }),
      getSupabaseClient().rpc("pd_public_fanbus_trip_boarding_stops", { p_trip_id: tripId })
    ]);
    return error ? null : { ...data, boardingStops: stopError ? [] : (stopData?.stops || []) };
  } catch {
    return null;
  }
}

async function refreshTripAfterSuccess() {
  const tripId = trip?.tripId;
  if (!tripId) return;
  try {
    const refreshedTrip = await loadTrip(tripId);
    if (!refreshedTrip?.available) return;
    trip = refreshedTrip;
    renderTrip();
  } catch {
    // The accepted registration remains authoritative even when its display refresh fails.
  }
}

async function initialize() {
  const tripId = new URLSearchParams(window.location.search).get("trip") || "";
  if (!UUID_PATTERN.test(tripId)) {
    unavailableTrip();
    return;
  }

  trip = await loadTrip(tripId);
  if (!trip?.available) {
    unavailableTrip();
    return;
  }

  renderTrip();
  renderBoardingStopFields();
  if (!["OPEN", "WAITLIST"].includes(trip.registrationStatus)) return;

  renderConsentReferences();
  await auth.initialize();
  await renderMode();
}

elements.portalForm.addEventListener("submit", submitPortal);
elements.guestForm.addEventListener("submit", submitGuest);
document.querySelector('[data-m320-add-guest="portal"]')?.addEventListener("click", () => openCompanionEditor("portal"));
document.querySelector('[data-m320-add-guest="guest"]')?.addEventListener("click", () => openCompanionEditor("guest"));
document.querySelector("[data-m325-open-companion-list]")?.addEventListener("click", openCompanionListDialog);
elements.memberLoginToggle.addEventListener("click", () => { void toggleMemberLogin(); });
elements.portalForm.addEventListener("input", () => {
  resetPortalSubmissionState();
  updateBookingSummary("portal");
});
elements.guestForm.addEventListener("input", () => {
  guestAttempt = null;
  updateBookingSummary("guest");
});
window.addEventListener("pd-auth-change", () => { void renderMode(); });

void initialize();

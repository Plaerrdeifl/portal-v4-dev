import { api } from "./api.js";
import { auth } from "./auth.js";
import { CONFIG } from "./config.js";
import { renderGoogleSignInButton } from "./google-signin.js";
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

function formatMoney(cents) {
  return Number.isInteger(cents)
    ? new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR"
    }).format(cents / 100)
    : "–";
}

function registrationStatusLabel(value) {
  return {
    NOT_STARTED: "Anmeldung noch nicht geöffnet",
    OPEN: "Anmeldung offen",
    WAITLIST: "Warteliste möglich",
    CLOSED: "Anmeldung geschlossen",
    UNAVAILABLE: "Nicht verfügbar"
  }[value] || "Nicht verfügbar";
}

function registrationStatusClass(value) {
  if (value === "OPEN") return "success";
  if (value === "NOT_STARTED" || value === "WAITLIST") return "warning";
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
  elements.trip.className = "card empty-state";
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
  const remaining = Number.isInteger(trip.remainingCapacity)
    ? `${trip.remainingCapacity} von ${trip.capacity} Plätzen frei`
    : "Kapazität nicht verfügbar";

  elements.trip.className = "card entity-card";
  elements.trip.innerHTML = `
    <div class="entity-head">
      <div>
        <span class="subtle">${escapeHtml(formatEventDate(trip.eventDate))} · ${escapeHtml(formatEventTime(trip.eventTime))}</span>
        <h2>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</h2>
      </div>
      <span class="status-pill${statusClass ? ` ${statusClass}` : ""}">${escapeHtml(registrationStatusLabel(trip.registrationStatus))}</span>
    </div>
    ${trip.venue ? `<p class="subtle">${escapeHtml(trip.venue)}</p>` : ""}
    <div class="meta-grid">
      <div class="meta-item"><small>Abfahrt</small><strong>${escapeHtml(formatBerlinDateTime(trip.departureAt))}</strong></div>
      <div class="meta-item"><small>Fahrtpreis</small><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div>
      <div class="meta-item"><small>Freie Plätze</small><strong>${escapeHtml(remaining)}</strong></div>
      <div class="meta-item"><small>Anmeldezeitraum</small><strong>${escapeHtml(`${formatBerlinDateTime(trip.registrationOpensAt)} bis ${formatBerlinDateTime(trip.registrationClosesAt)}`)}</strong></div>
    </div>
    <p><strong>Abfahrtsinfo:</strong> ${escapeHtml(trip.departureInfo)}</p>`;

  if (!["OPEN", "WAITLIST"].includes(trip.registrationStatus)) {
    elements.panel.hidden = false;
    elements.title.textContent = registrationStatusLabel(trip.registrationStatus);
    elements.intro.textContent = "Für diese Fahrt ist aktuell keine Anmeldung möglich.";
    elements.portalForm.hidden = true;
    elements.guestForm.hidden = true;
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

function appendReferenceConsent(target, prefix, reference) {
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
      link.textContent = normalized;
      target.append(link);
      return;
    }
  } catch {
    // Non-URL references are rendered as text only.
  }

  target.append(document.createTextNode(normalized));
}

function renderConsentReferences() {
  appendReferenceConsent(
    document.getElementById("m310PortalPrivacyConsent"),
    "Ich bestätige die Datenschutzhinweise: ",
    trip.privacyReference
  );
  appendReferenceConsent(
    document.getElementById("m310PortalTermsConsent"),
    "Ich akzeptiere die Teilnahmebedingungen: ",
    trip.termsReference
  );
  appendReferenceConsent(
    document.getElementById("m310GuestPrivacyConsent"),
    "Ich bestätige die Datenschutzhinweise: ",
    trip.privacyReference
  );
  appendReferenceConsent(
    document.getElementById("m310GuestTermsConsent"),
    "Ich akzeptiere die Teilnahmebedingungen: ",
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
    UNAVAILABLE: "Diese Fanbusfahrt ist aktuell nicht verfügbar."
  }[outcome] || "Die Anmeldung konnte nicht verarbeitet werden.";
}

function finishRegistration(outcome = "CREATED") {
  registrationComplete = true;
  const waitlisted = outcome === "WAITLISTED";
  elements.title.textContent = waitlisted ? "Auf Warteliste eingetragen" : "Anmeldung bestätigt";
  elements.intro.textContent = waitlisted
    ? "Die gesamte gemeinsame Anmeldung wurde auf die Warteliste gesetzt."
    : "Deine gemeinsame Anmeldung wurde erfolgreich entgegengenommen.";
  elements.portalForm.hidden = true;
  elements.guestForm.hidden = true;
  elements.google.hidden = true;
  removeTurnstile();
  setStatus(waitlisted ? "Die gesamte Anmeldung ist auf der Warteliste." : "Die Fanbus-Anmeldung wurde bestätigt.", waitlisted ? "warning" : "success");
}

function companionMarkup(index, member = null) {
  const stopField = Array.isArray(trip?.boardingStops) && trip.boardingStops.length
    ? `<label class="full">Zustiegsort<select name="companionBoardingStopId" required>${boardingStopOptions()}</select></label>`
    : "";
  return `<article class="fanbus-companion" data-m320-companion${member?.id ? ` data-m325-template-member-id="${escapeHtml(member.id)}"` : ""}>
    <div class="fanbus-companion-head"><strong>Begleiter ${index + 1}</strong><button class="button small secondary" type="button" data-m320-remove-companion>Entfernen</button></div>
    <div class="form-grid"><label>Vorname<input name="companionFirstName" maxlength="120" required value="${escapeHtml(member?.firstName || "")}"></label><label>Nachname<input name="companionLastName" maxlength="120" required value="${escapeHtml(member?.lastName || "")}"></label><label class="full">E-Mail (optional)<input name="companionEmail" type="email" maxlength="320"></label><label class="full">Buswunsch<select name="companionBusPreference" required><option value="EGAL"${member?.defaultBusPreference === "EGAL" ? " selected" : ""}>Egal</option><option value="RUHIG"${member?.defaultBusPreference === "RUHIG" ? " selected" : ""}>Ruhig</option><option value="PARTY"${member?.defaultBusPreference === "PARTY" ? " selected" : ""}>Party</option></select></label>${stopField}<label class="full">Operativer Hinweis (optional)<textarea name="companionOperationalNote" maxlength="240">${escapeHtml(member?.operationalNote || "")}</textarea></label></div>
  </article>`;
}

function boardingStopOptions() {
  return `<option value="">Bitte wählen</option>${(trip?.boardingStops || []).map(stop => `<option value="${escapeHtml(stop.id)}">${escapeHtml(`${stop.label} · ${formatBerlinDateTime(stop.departureAt)}`)}</option>`).join("")}`;
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

function updateBookingSummary(mode) {
  const form = mode === "portal" ? elements.portalForm : elements.guestForm;
  const target = document.querySelector(`[data-m320-booking-summary="${mode}"]`);
  if (!form || !target) return;
  const companionCount = form.querySelectorAll("[data-m320-companion]").length;
  const primary = mode === "portal"
    ? String(elements.portalIdentity.textContent || "Portalprofil")
        .replace(/^Angemeldet als\s+/i, "")
    : [
      form.elements.namedItem("firstName")?.value,
      form.elements.namedItem("lastName")?.value
    ].map(value => String(value || "").trim()).filter(Boolean).join(" ") || "Gast-Hauptperson";
  const status = trip?.registrationStatus === "WAITLIST"
    ? "Wartelistenanmeldung"
    : "reguläre Anmeldung";
  target.textContent = `${companionCount + 1} ${companionCount === 0 ? "Person" : "Personen"} · Hauptperson: ${primary} · ${companionCount} ${companionCount === 1 ? "Begleiter" : "Begleiter"} · ${status}`;
}

function addCompanion(mode) {
  const target = document.querySelector(`[data-m320-companions="${mode}"]`);
  if (!target || target.children.length >= 19) return;
  target.insertAdjacentHTML("beforeend", companionMarkup(target.children.length));
  updateBookingSummary(mode);
  target.lastElementChild?.querySelector("[data-m320-remove-companion]")?.addEventListener("click", event => {
    event.currentTarget.closest("[data-m320-companion]")?.remove();
    [...target.children].forEach((card, index) => { card.querySelector("strong").textContent = `Begleiter ${index + 1}`; });
    updateBookingSummary(mode);
  });
}

function companionsFor(form) {
  return [...form.querySelectorAll("[data-m320-companion]")].map(card => ({
    firstName: card.querySelector('[name="companionFirstName"]')?.value.trim() || "",
    lastName: card.querySelector('[name="companionLastName"]')?.value.trim() || "",
    ...(card.querySelector('[name="companionEmail"]')?.value.trim() ? { email: card.querySelector('[name="companionEmail"]')?.value.trim() } : {}),
    busPreference: card.querySelector('[name="companionBusPreference"]')?.value || "",
    ...(card.querySelector('[name="companionBoardingStopId"]')?.value ? { boardingStopId: card.querySelector('[name="companionBoardingStopId"]')?.value } : {}),
    operationalNote: card.querySelector('[name="companionOperationalNote"]')?.value.trim() || "",
    ...(card.dataset.m325TemplateMemberId ? { templateMemberId: card.dataset.m325TemplateMemberId } : {})
  }));
}

async function loadCompanionLists() {
  const container = document.querySelector("[data-m325-companion-list]");
  const select = document.querySelector("[data-m325-companion-list-select]");
  if (!container || !select) return;
  try {
    const data = await api.call("fanbus_companion_lists_list", {});
    const lists = Array.isArray(data?.lists) ? data.lists : [];
    container.hidden = lists.length === 0;
    select.innerHTML = lists.map(list => `<option value="${escapeHtml(list.id)}">${escapeHtml(list.name)} (${list.members.length})</option>`).join("");
    select._m325Lists = lists;
    renderCompanionListMembers();
  } catch { container.hidden = true; }
}

function renderCompanionListMembers() {
  const select = document.querySelector("[data-m325-companion-list-select]");
  const target = document.querySelector("[data-m325-companion-list-members]");
  const list = select?._m325Lists?.find(item => item.id === select.value);
  if (!target) return;
  target.innerHTML = (list?.members || []).map(member => `<label class="check-row fanbus-companion"><input type="checkbox" value="${escapeHtml(member.id)}" data-m325-select-template checked><span>${escapeHtml(`${member.firstName} ${member.lastName}`)}</span></label>`).join("") || '<p class="subtle">Diese Liste enthält keine Personen.</p>';
}

function applyCompanionList() {
  const select = document.querySelector("[data-m325-companion-list-select]");
  const target = document.querySelector('[data-m320-companions="portal"]');
  const list = select?._m325Lists?.find(item => item.id === select.value);
  if (!list || !target) return;
  const selectedIds = [...document.querySelectorAll("[data-m325-select-template]:checked")].map(input => input.value);
  const selected = list.members.filter(member => selectedIds.includes(member.id));
  if (!selected.length) { setStatus("Bitte wähle mindestens eine Person aus der Liste.", "warning"); return; }
  if (selected.length > 19) { setStatus("Die Auswahl enthält zu viele Personen für eine gemeinsame Buchung.", "warning"); return; }
  selectedCompanionListId = list.id;
  target.replaceChildren();
  selected.forEach((member, index) => {
    target.insertAdjacentHTML("beforeend", companionMarkup(index, member));
    const card = target.lastElementChild;
    const stop = card?.querySelector('[name="companionBoardingStopId"]');
    const resolvedStop = (trip?.boardingStops || []).find(item => item.boardingStopId === member.defaultBoardingStopId);
    if (stop && resolvedStop) stop.value = resolvedStop.tripBoardingStopId || resolvedStop.id;
    card?.querySelector("[data-m320-remove-companion]")?.addEventListener("click", event => {
      event.currentTarget.closest("[data-m320-companion]")?.remove(); updateBookingSummary("portal");
    });
  });
  updateBookingSummary("portal");
}

async function submitPortal(event) {
  event.preventDefault();
  if (!trip || registrationComplete || !elements.portalForm.reportValidity()) return;

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
      const labels = { READY: "Bereit", ALREADY_REGISTERED: "Bereits angemeldet", CONFLICT: "Konflikt" };
      previewBox.hidden = false;
      previewBox.className = `notice full ${preview.canSubmit ? "success" : "warning"}`;
      previewBox.innerHTML = `<strong>Duplicate Preview</strong><p>Hauptperson: ${escapeHtml(labels[preview.primaryStatus] || preview.primaryStatus)}</p><ul>${preview.members.map((item, index) => `<li>${escapeHtml(templateCompanions[index]?.firstName || `Person ${index + 1}`)}: ${escapeHtml(labels[item.status] || item.status)}</li>`).join("")}</ul>`;
      if (!preview.canSubmit) {
        setStatus("Die Buchung kann wegen bestehender Anmeldungen oder Konflikten nicht bestätigt werden.", "warning");
        return;
      }
      portalPreviewFingerprint = fingerprint;
      elements.portalForm.querySelector('button[type="submit"]').textContent = "Geprüfte Buchung bestätigen";
      setStatus("Vorschau ist bereit. Bitte bestätige die Buchung jetzt erneut.", "success");
      return;
    } catch {
      setStatus("Die Duplicate Preview konnte nicht durchgeführt werden.", "error");
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
      finishRegistration(result.outcome);
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
      return;
    }

    if (response.status === 429) {
      setStatus("Zu viele Versuche. Bitte versuche es später erneut.", "warning");
    } else if (response.status === 403 && result?.code === "TURNSTILE_REJECTED") {
      setStatus("Die Sicherheitsprüfung ist fehlgeschlagen. Bitte versuche es erneut.", "warning");
    } else if (["FULL", "NOT_STARTED", "CLOSED", "UNAVAILABLE"].includes(result?.code)) {
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

async function renderMode() {
  const sequence = ++modeRenderSequence;
  if (!trip || !["OPEN", "WAITLIST"].includes(trip.registrationStatus) || registrationComplete) return;

  const current = auth.current();
  elements.portalForm.hidden = true;
  elements.guestForm.hidden = true;
  elements.google.hidden = true;
  setStatus("", "");

  if (current.authenticated && current.status === "ACTIVE") {
    removeTurnstile();
    elements.title.textContent = "Mit Portal anmelden";
    elements.intro.textContent = "Deine Identitätsdaten werden sicher aus deinem aktiven Portalprofil übernommen.";
    elements.portalIdentity.textContent = (current.user?.name || current.user?.email)
      ? `Angemeldet als ${current.user.name || current.user.email}`
      : "Mit aktivem Portalprofil angemeldet";
    elements.portalForm.hidden = false;
    await loadCompanionLists();
    updateBookingSummary("portal");
    return;
  }

  elements.title.textContent = "Als Gast anmelden";
  elements.intro.textContent = current.authenticated
    ? "Dein Portalzugang ist nicht aktiv. Du kannst dich weiterhin als Gast anmelden."
    : "Melde dich mit Google am Portal an oder nutze die Gastanmeldung.";
  elements.guestForm.hidden = false;
  updateBookingSummary("guest");
  elements.guestForm.querySelector('button[type="submit"]').disabled = false;

  if (!current.authenticated) {
    elements.google.hidden = false;
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
    } catch {
      setStatus("Die Google-Anmeldung ist aktuell nicht verfügbar. Die Gastanmeldung bleibt verfügbar.", "warning");
    }
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
document.querySelector('[data-m320-add-companion="portal"]')?.addEventListener("click", () => addCompanion("portal"));
document.querySelector('[data-m320-add-companion="guest"]')?.addEventListener("click", () => addCompanion("guest"));
document.querySelector("[data-m325-apply-companion-list]")?.addEventListener("click", applyCompanionList);
document.querySelector("[data-m325-companion-list-select]")?.addEventListener("change", renderCompanionListMembers);
elements.portalForm.addEventListener("input", () => {
  portalAttempt = null;
  portalPreviewFingerprint = "";
  const previewBox = document.querySelector("[data-m325-duplicate-preview]");
  if (previewBox) previewBox.hidden = true;
  const submit = elements.portalForm.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Verbindlich anmelden";
  updateBookingSummary("portal");
});
elements.guestForm.addEventListener("input", () => {
  guestAttempt = null;
  updateBookingSummary("guest");
});
window.addEventListener("pd-auth-change", () => { void renderMode(); });

void initialize();

import { auth } from "./auth.js";
import { openDialog } from "./modules/common.js";
import { getSupabaseClient } from "./supabase-client.js";

const PORTAL_FORM_ID = "m310PortalForm";
const GUEST_FORM_ID = "m310GuestForm";
const STYLE_ID = "m328R2PublicRegistrationFlowStyles";
const BACK_BUTTON_ID = "m328PublicBackToApp";
const RECEIPT_ID = "m328PublicBookingReceipt";
const BOOKING_NUMBER_PATTERN = /^(?:FB|DEV)-[0-9]{2}-[0-9]{6,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBMISSION_ACTIONS = new Set([
  "fanbus_self_register",
  "fanbus_companion_booking_submit"
]);

const reviewBypass = new WeakSet();
let lastSubmission = null;
let receiptLookupKey = "";
let scheduled = false;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedText(select) {
  if (!(select instanceof HTMLSelectElement)
      || select.hidden
      || select.closest("[hidden]")) return "";
  return cleanText(select.selectedOptions?.[0]?.textContent || "");
}

function tripIdFromLocation() {
  const value = new URLSearchParams(window.location.search).get("trip") || "";
  return UUID_PATTERN.test(value) ? value : "";
}

function storageKey(tripId) {
  return `m328FanbusReceipt:${tripId}`;
}

function rememberSubmission(tripId, idempotencyKey) {
  const normalizedTrip = String(tripId || "");
  const normalizedKey = String(idempotencyKey || "");
  if (!UUID_PATTERN.test(normalizedTrip) || !UUID_PATTERN.test(normalizedKey)) return;
  lastSubmission = { tripId: normalizedTrip, idempotencyKey: normalizedKey };
  receiptLookupKey = "";
  try {
    window.sessionStorage.setItem(storageKey(normalizedTrip), normalizedKey);
  } catch {
    // The receipt still works for the current page even without session storage.
  }
}

function restoreSubmission() {
  if (lastSubmission) return;
  const tripId = tripIdFromLocation();
  if (!tripId) return;
  try {
    const idempotencyKey = window.sessionStorage.getItem(storageKey(tripId)) || "";
    if (UUID_PATTERN.test(idempotencyKey)) {
      lastSubmission = { tripId, idempotencyKey };
    }
  } catch {
    // Session storage is optional.
  }
}

function capturePortalSubmission(event) {
  const action = String(event.detail?.action || "");
  if (!SUBMISSION_ACTIONS.has(action)) return;
  rememberSubmission(
    event.detail?.payload?.tripId,
    event.detail?.payload?.idempotencyKey
  );
}

function installGuestSubmissionCapture() {
  if (window.fetch?.m328PublicRegistrationCapture === true) return;
  const nativeFetch = window.fetch.bind(window);
  const wrappedFetch = (input, init) => {
    try {
      const rawUrl = typeof input === "string" || input instanceof URL
        ? String(input)
        : String(input?.url || "");
      const url = new URL(rawUrl, window.location.href);
      if (url.pathname.endsWith("/functions/v1/m310-fanbus-register")
          && typeof init?.body === "string") {
        const payload = JSON.parse(init.body);
        rememberSubmission(payload?.tripId, payload?.idempotencyKey);
      }
    } catch {
      // Capture must never change or block the actual registration request.
    }
    return nativeFetch(input, init);
  };
  Object.defineProperty(wrappedFetch, "m328PublicRegistrationCapture", {
    value: true
  });
  window.fetch = wrappedFetch;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #m325UserBoardingPreference{display:none!important}
    .fanbus-public-form>.p800-fanbus-review{display:none!important}
    .fanbus-public-shell{gap:9px}
    .fanbus-public-form{gap:10px!important;margin-top:8px!important}
    .fanbus-public-registration-panel{margin-top:10px!important;padding-top:11px!important}
    .fanbus-public-companion-section{gap:7px!important}
    .fanbus-public-consents{gap:7px!important;padding-top:6px!important}
    #${BACK_BUTTON_ID}{justify-self:start;width:auto;min-height:38px;margin-bottom:1px}
    .m328-public-review{display:grid;gap:10px}
    .m328-public-review>p{margin:0;color:var(--ink-500);font-size:.86rem;line-height:1.45}
    .m328-public-review-list{display:grid;gap:8px;padding:12px;border:1px solid var(--line,#d8e2ee);border-radius:13px;background:#f8fbff}
    .m328-public-review-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
    .m328-public-review-row span{color:var(--ink-500);font-size:.8rem}
    .m328-public-review-row strong{text-align:right;font-size:.88rem;overflow-wrap:anywhere}
    #${RECEIPT_ID}{display:grid;gap:3px;padding:13px 14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:#f8fbff}
    #${RECEIPT_ID} span{color:var(--ink-500);font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    #${RECEIPT_ID} strong{font-size:1.18rem;line-height:1.2;overflow-wrap:anywhere}
    #${RECEIPT_ID} small{color:var(--ink-500);font-size:.78rem;line-height:1.4}
    @media(max-width:620px){
      .fanbus-public-shell{gap:7px}
      .fanbus-public-form{gap:8px!important}
      .m328-public-review-row{gap:10px}
      #${BACK_BUTTON_ID}{min-height:36px;padding:6px 10px}
    }
  `;
  document.head.appendChild(style);
}

function formForEvent(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return null;
  return [PORTAL_FORM_ID, GUEST_FORM_ID].includes(form.id) ? form : null;
}

function companionNames(form) {
  return [...form.querySelectorAll(".fanbus-companion")]
    .map(item => cleanText(item.querySelector("strong")?.textContent))
    .filter(Boolean);
}

function primaryName(form) {
  if (form.id === PORTAL_FORM_ID) {
    return cleanText(document.querySelector("#m310PortalIdentity strong")?.textContent) || "Du";
  }
  const firstName = form.elements.namedItem("firstName")?.value || "";
  const lastName = form.elements.namedItem("lastName")?.value || "";
  return cleanText(`${firstName} ${lastName}`) || "1 Person";
}

function reviewData(form) {
  const names = [primaryName(form), ...companionNames(form)].filter(Boolean);
  return {
    trip: cleanText(document.querySelector("#m310PublicTrip h2")?.textContent) || "Fanbusfahrt",
    people: names.join(", "),
    stop: selectedText(form.elements.namedItem("boardingStopId")),
    busWish: selectedText(form.elements.namedItem("busPreference"))
  };
}

function reviewRow(label, value) {
  if (!value) return "";
  return `<div class="m328-public-review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function reviewMarkup(form) {
  const review = reviewData(form);
  return `<section class="m328-public-review" aria-label="Anmeldung prüfen">
    <p>Bitte prüfe deine Angaben. Erst mit dem nächsten Schritt wird die Anmeldung verbindlich abgesendet.</p>
    <div class="m328-public-review-list">
      ${reviewRow("Fahrt", review.trip)}
      ${reviewRow("Personen", review.people)}
      ${reviewRow("Zustieg", review.stop)}
      ${reviewRow("Buswunsch", review.busWish)}
    </div>
  </section>`;
}

function companionBoardingStopMissing(form) {
  const primaryStop = form.elements.namedItem("boardingStopId");
  if (!(primaryStop instanceof HTMLSelectElement) || primaryStop.options.length < 2) return false;
  return [...form.querySelectorAll("[data-m320-companion]")].some(card => {
    const value = card.querySelector('[name="companionBoardingStopId"]')?.value || "";
    return !value;
  });
}

function openRegistrationReview(form) {
  openDialog({
    kicker: "Fanbus-Anmeldung",
    title: "Anmeldung prüfen",
    body: reviewMarkup(form),
    submitLabel: "Jetzt verbindlich anmelden",
    onSubmit: async () => {
      reviewBypass.add(form);
      form.requestSubmit();
    }
  });
}

function interceptRegistrationSubmit(event) {
  const form = formForEvent(event);
  if (!form) return;
  if (reviewBypass.has(form)) {
    reviewBypass.delete(form);
    return;
  }
  if (!form.reportValidity() || companionBoardingStopMissing(form)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openRegistrationReview(form);
}

function updateReviewButtons() {
  [PORTAL_FORM_ID, GUEST_FORM_ID].forEach(id => {
    const form = document.getElementById(id);
    const button = form?.querySelector('button[type="submit"]');
    if (!(button instanceof HTMLButtonElement)) return;
    const status = cleanText(document.getElementById("m310RegistrationStatus")?.textContent);
    const sending = button.disabled && status.includes("Anmeldung wird übermittelt");
    button.dataset.p800IdleLabel = "Anmeldung prüfen";
    if (!sending && cleanText(button.textContent) !== "Anmeldung prüfen") {
      button.textContent = "Anmeldung prüfen";
    }
  });
}

function currentUserCanReturnToApp() {
  const current = auth.current();
  if (!current.authenticated || current.status !== "ACTIVE") return false;
  if (window.top !== window.self) return false;
  return new URLSearchParams(window.location.search).get("source") === "app";
}

function returnToApp() {
  window.location.assign("./#/fanbuses");
}

function updateBackButton() {
  const existing = document.getElementById(BACK_BUTTON_ID);
  if (!currentUserCanReturnToApp()) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const shell = document.querySelector(".fanbus-public-shell");
  if (!(shell instanceof HTMLElement)) return;
  const button = document.createElement("button");
  button.id = BACK_BUTTON_ID;
  button.className = "button small ghost";
  button.type = "button";
  button.textContent = "← Zurück zur App";
  button.addEventListener("click", returnToApp);
  shell.prepend(button);
}

function successState() {
  return cleanText(document.getElementById("m310RegistrationTitle")?.textContent);
}

function successAnchor() {
  const state = successState();
  const supported = ["Anmeldung bestätigt", "Auf Warteliste eingetragen", "Bereits angemeldet"];
  if (!supported.includes(state)) return null;
  const success = document.querySelector(".p800-fanbus-success");
  if (state !== "Bereits angemeldet" && !success) return null;
  return success || document.getElementById("m310RegistrationIntro");
}

function renderBookingReceipt(anchor, bookingNumber) {
  if (document.getElementById(RECEIPT_ID)) return;
  const receipt = document.createElement("section");
  receipt.id = RECEIPT_ID;
  receipt.setAttribute("aria-label", "Buchungsnummer");
  receipt.innerHTML = `<span>Buchungsnummer</span><strong>${escapeHtml(bookingNumber)}</strong><small>Bitte gib diese Nummer bei Rückfragen an.</small>`;
  if (anchor.classList?.contains("p800-fanbus-success")) anchor.prepend(receipt);
  else anchor.insertAdjacentElement("afterend", receipt);
}

async function loadBookingReceipt() {
  const anchor = successAnchor();
  if (!anchor || document.getElementById(RECEIPT_ID)) return;
  restoreSubmission();
  if (!lastSubmission) return;
  const lookupKey = `${lastSubmission.tripId}:${lastSubmission.idempotencyKey}`;
  if (receiptLookupKey === lookupKey) return;
  receiptLookupKey = lookupKey;
  try {
    const { data, error } = await getSupabaseClient().rpc(
      "pd_public_fanbus_booking_reference",
      {
        p_trip_id: lastSubmission.tripId,
        p_idempotency_key: lastSubmission.idempotencyKey
      }
    );
    if (error) throw error;
    const bookingNumber = cleanText(data?.bookingNumber);
    if (!BOOKING_NUMBER_PATTERN.test(bookingNumber)) return;
    renderBookingReceipt(anchor, bookingNumber);
  } catch {
    receiptLookupKey = "";
  }
}

function scan() {
  injectStyles();
  updateReviewButtons();
  updateBackButton();
  void loadBookingReceipt();
}

function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

export function setupM328PublicRegistrationFlow() {
  injectStyles();
  restoreSubmission();
  installGuestSubmissionCapture();
  window.addEventListener("pd-api-before-call", capturePortalSubmission);
  window.addEventListener("pd-auth-change", scheduleScan);
  document.addEventListener("submit", interceptRegistrationSubmit, true);
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "disabled"]
  });
  scheduleScan();
}

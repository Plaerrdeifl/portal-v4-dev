import { call, closeAllDialogs, escapeAttr, escapeHtml, openDialog } from "./modules/common.js";

const COMPOSER_SELECTOR = "#m326ManualComposerForm";
const MANUAL_BULK_ACTION = "fanbus_registration_create_manual_bulk";
const tripDefaultBoardingStops = new Map();
const tripBoardingStopLists = new Map();
let latestTripStopsTripId = "";
let pendingIndividualToast = null;
let manualListBaseline = null;
let pendingManualListRefresh = null;

function selectOptionsMarkup(select) {
  if (!(select instanceof HTMLSelectElement)) return "";
  return [...select.options].map(option => (
    `<option value="${escapeAttr(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.textContent || "")}</option>`
  )).join("");
}

function rememberTripContext(event) {
  const action = event.detail?.action;
  if (action === "fanbus_trips_list") {
    const trips = Array.isArray(event.detail?.data?.trips) ? event.detail.data.trips : [];
    trips.forEach(trip => {
      const tripId = String(trip?.id || "");
      if (!tripId) return;
      tripDefaultBoardingStops.set(tripId, String(trip?.defaultBoardingStopId || ""));
    });
    return;
  }

  if (action !== "fanbus_trip_boarding_stops_list") return;
  const tripId = String(event.detail?.payload?.tripId || "");
  if (!tripId) return;
  latestTripStopsTripId = tripId;
  tripBoardingStopLists.set(
    tripId,
    Array.isArray(event.detail?.data?.stops) ? event.detail.data.stops : []
  );
}

function tripDefaultStopValue(tripId) {
  const defaultBoardingStopId = tripDefaultBoardingStops.get(tripId) || "";
  if (!defaultBoardingStopId) return "";
  const stops = tripBoardingStopLists.get(tripId) || [];
  const stop = stops.find(item => item?.isActive !== false
    && String(item?.boardingStopId || "") === defaultBoardingStopId);
  return String(stop?.tripBoardingStopId || stop?.id || "");
}

function applyKnownTripDefaultStopFallback(form, cards) {
  const tripId = String(form.dataset.m326TripId || latestTripStopsTripId || "");
  if (!tripId) return false;
  form.dataset.m326TripId = tripId;

  const defaultValue = tripDefaultStopValue(tripId);
  if (!defaultValue) return false;

  cards.forEach(card => {
    const select = card.querySelector("[data-m326-person-stop]");
    if (!(select instanceof HTMLSelectElement) || select.value) return;
    if (![...select.options].some(option => option.value === defaultValue)) return;
    select.value = defaultValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  return true;
}

async function ensureTripDefaultStopFallback(form, cards) {
  if (applyKnownTripDefaultStopFallback(form, cards)) return;
  const tripId = String(form.dataset.m326TripId || latestTripStopsTripId || "");
  if (!tripId || tripDefaultBoardingStops.has(tripId)) return;

  try {
    const data = await call("fanbus_trips_list");
    const trips = Array.isArray(data?.trips) ? data.trips : [];
    trips.forEach(trip => {
      const id = String(trip?.id || "");
      if (!id) return;
      tripDefaultBoardingStops.set(id, String(trip?.defaultBoardingStopId || ""));
    });
    if (form.isConnected) applyKnownTripDefaultStopFallback(form, cards);
  } catch {
    // Fallback enrichment must never block the manual registration composer.
  }
}

function participantName(card) {
  return card.querySelector("[data-m326-composer-source] .v4-m326-composer-person strong")?.textContent?.trim()
    || "Teilnehmer";
}

function participantSource(card) {
  return card.querySelector("[data-m326-composer-source] .v4-m326-composer-person small")?.textContent?.trim()
    || "Person";
}

function participantSignature(card) {
  return `${participantSource(card)}\u0000${participantName(card)}`;
}

function participantFacts(card) {
  const stopSelect = card.querySelector("[data-m326-person-stop]");
  const preferenceSelect = card.querySelector("select[data-m326-person-preference]");
  const noteInput = card.querySelector("[data-m326-person-note]");
  const facts = [];

  if (stopSelect instanceof HTMLSelectElement) {
    const selected = stopSelect.selectedOptions[0];
    facts.push(selected?.value
      ? `Zustieg: ${selected.textContent?.trim() || "Ausgewählt"}`
      : "Zustieg: Bitte wählen");
  }

  if (preferenceSelect instanceof HTMLSelectElement) {
    const selected = preferenceSelect.selectedOptions[0];
    facts.push(`Buswunsch: ${selected?.textContent?.trim() || "Egal"}`);
  }

  if (String(noteInput?.value || "").trim()) facts.push("Hinweis hinterlegt");
  return facts;
}

function refreshComposerCard(card) {
  const button = card.querySelector("[data-m326-composer-open-detail]");
  if (!(button instanceof HTMLButtonElement)) return;

  const name = participantName(card);
  const source = participantSource(card);
  const facts = participantFacts(card);
  button.setAttribute("aria-label", `${name} öffnen und bearbeiten`);
  button.innerHTML = `<span class="v4-compact-record-copy">
    <strong>${escapeHtml(name)}</strong>
    <small>${escapeHtml(source)}</small>
    ${facts.length ? `<small>${facts.map(escapeHtml).join(" · ")}</small>` : ""}
  </span><span class="v4-row-chevron" aria-hidden="true">›</span>`;
}

function applyDetailValues(card, values) {
  const stopSelect = card.querySelector("[data-m326-person-stop]");
  const preferenceSelect = card.querySelector("select[data-m326-person-preference]");
  const noteInput = card.querySelector("[data-m326-person-note]");

  if (stopSelect instanceof HTMLSelectElement && values.boardingStopId !== undefined) {
    stopSelect.value = values.boardingStopId;
    stopSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (preferenceSelect instanceof HTMLSelectElement && values.busPreference !== undefined) {
    preferenceSelect.value = values.busPreference;
    preferenceSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (noteInput instanceof HTMLInputElement && values.operationalNote !== undefined) {
    noteInput.value = values.operationalNote;
    noteInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  refreshComposerCard(card);
}

function openParticipantDetail(card, composerForm) {
  const index = card.dataset.m326ComposerPerson || "";
  const stopSelect = card.querySelector("[data-m326-person-stop]");
  const preferenceSelect = card.querySelector("select[data-m326-person-preference]");
  const noteInput = card.querySelector("[data-m326-person-note]");
  const name = participantName(card);
  const hasPreference = preferenceSelect instanceof HTMLSelectElement;
  const hasStop = stopSelect instanceof HTMLSelectElement;
  const pairedFields = hasStop && hasPreference;

  const dialog = openDialog({
    title: name,
    kicker: "Teilnehmer bearbeiten",
    preserveParentOnSubmit: true,
    submitLabel: "Änderungen übernehmen",
    body: `<form class="form-grid v4-smart-form" data-m326-composer-detail>
      <button type="button" hidden tabindex="-1" aria-hidden="true" data-m326-detail-focus-anchor></button>
      ${hasStop ? `<label class="${pairedFields ? "v4-field-half" : "v4-field-full"}">Zustiegsort
        <select name="boardingStopId" required>${selectOptionsMarkup(stopSelect)}</select>
      </label>` : ""}
      ${hasPreference ? `<label class="${pairedFields ? "v4-field-half" : "v4-field-full"}">Buswunsch
        <select name="busPreference" required>${selectOptionsMarkup(preferenceSelect)}</select>
      </label>` : ""}
      <label class="v4-field-full">Operativer Hinweis (optional)
        <textarea name="operationalNote" maxlength="240">${escapeHtml(noteInput?.value || "")}</textarea>
      </label>
      <div class="v4-field-full v4-detail-actions">
        <button class="button danger" type="button" data-m326-detail-remove>Teilnehmer entfernen</button>
      </div>
    </form>`,
    onSubmit: async values => {
      applyDetailValues(card, values);
    }
  });

  dialog.querySelector("[data-m326-detail-remove]")?.addEventListener("click", () => {
    dialog.close();
    window.setTimeout(() => {
      const restoredCard = composerForm.querySelector(`[data-m326-composer-person="${CSS.escape(index)}"]`);
      restoredCard?.querySelector(`[data-m326-remove-person="${CSS.escape(index)}"]`)?.click();
    }, 0);
  });
}

function enhanceComposerCard(card, composerForm) {
  if (!(card instanceof HTMLElement)) return;

  if (card.dataset.m326OverviewEnhanced === "true") {
    refreshComposerCard(card);
    return;
  }
  card.dataset.m326OverviewEnhanced = "true";

  card.classList.remove("v4-m326-composer-card");
  card.style.setProperty("width", "100%", "important");
  card.style.setProperty("padding", "0", "important");
  card.style.setProperty("border", "0", "important");
  card.style.setProperty("background", "transparent", "important");
  card.style.setProperty("box-shadow", "none", "important");

  const source = document.createElement("div");
  source.dataset.m326ComposerSource = "true";
  source.hidden = true;
  source.setAttribute("aria-hidden", "true");
  source.style.setProperty("display", "none", "important");

  while (card.firstChild) source.appendChild(card.firstChild);
  card.appendChild(source);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "v4-compact-record v4-interactive-card v4-m326-composer-overview";
  button.dataset.m326ComposerOpenDetail = "true";
  button.style.setProperty("width", "100%", "important");
  button.style.setProperty("max-width", "none", "important");
  button.style.setProperty("margin", "0", "important");
  card.appendChild(button);

  source.addEventListener("change", () => refreshComposerCard(card));
  source.addEventListener("input", () => refreshComposerCard(card));
  button.addEventListener("click", () => openParticipantDetail(card, composerForm));
  refreshComposerCard(card);
}

function currentBookingMode(form) {
  const value = form.querySelector("[data-m326-booking-mode]")?.value
    || form.dataset.m326BookingMode
    || "GROUP";
  return value === "INDIVIDUAL" ? "INDIVIDUAL" : "GROUP";
}

function syncSubmitLabel(form, count) {
  const dialog = form.closest("dialog");
  const submit = dialog?.querySelector("#v4DialogSubmit");
  if (!(submit instanceof HTMLButtonElement)) return;

  if (count === 0) {
    submit.textContent = "Anmelden";
    submit.disabled = true;
    return;
  }
  submit.disabled = false;
  if (count === 1) {
    submit.textContent = "Person anmelden";
    return;
  }
  submit.textContent = currentBookingMode(form) === "INDIVIDUAL"
    ? `${count} Einzelanmeldungen erstellen`
    : `${count} Personen gemeinsam anmelden`;
}

function syncBookingOptions(form, cards) {
  const count = cards.length;
  const root = form.querySelector("[data-m326-composer]");
  let section = form.querySelector("[data-m326-booking-options]");

  if (count < 2) {
    section?.remove();
    form.dataset.m326BookingMode = "GROUP";
    form.dataset.m326PrimaryIndex = "0";
    form.dataset.m326PrimarySignature = cards[0] ? participantSignature(cards[0]) : "";
    syncSubmitLabel(form, count);
    return;
  }

  if (!section && root) {
    section = document.createElement("section");
    section.className = "form-grid v4-smart-form";
    section.dataset.m326BookingOptions = "true";
    section.innerHTML = `<label class="v4-field-full">Anmeldeart
      <select data-m326-booking-mode name="bookingMode">
        <option value="GROUP">Gemeinsame Anmeldung</option>
        <option value="INDIVIDUAL">Einzelanmeldungen</option>
      </select>
    </label>
    <label class="v4-field-full" data-m326-primary-field>Hauptperson
      <select data-m326-primary-participant name="primaryParticipantIndex"></select>
    </label>`;
    root.insertAdjacentElement("afterend", section);

    section.querySelector("[data-m326-booking-mode]")?.addEventListener("change", event => {
      form.dataset.m326BookingMode = event.currentTarget.value === "INDIVIDUAL"
        ? "INDIVIDUAL"
        : "GROUP";
      syncBookingOptions(form, [...form.querySelectorAll("[data-m326-composer-person]")]);
    });
    section.querySelector("[data-m326-primary-participant]")?.addEventListener("change", event => {
      const index = Number(event.currentTarget.value || 0);
      const liveCards = [...form.querySelectorAll("[data-m326-composer-person]")];
      form.dataset.m326PrimaryIndex = String(index);
      form.dataset.m326PrimarySignature = liveCards[index]
        ? participantSignature(liveCards[index])
        : "";
    });
  }

  const modeSelect = section?.querySelector("[data-m326-booking-mode]");
  const primaryField = section?.querySelector("[data-m326-primary-field]");
  const primarySelect = section?.querySelector("[data-m326-primary-participant]");
  if (!(modeSelect instanceof HTMLSelectElement)
      || !(primarySelect instanceof HTMLSelectElement)) return;

  const mode = form.dataset.m326BookingMode === "INDIVIDUAL" ? "INDIVIDUAL" : "GROUP";
  form.dataset.m326BookingMode = mode;
  modeSelect.value = mode;
  if (primaryField instanceof HTMLElement) primaryField.hidden = mode === "INDIVIDUAL";
  primarySelect.disabled = mode === "INDIVIDUAL";

  const storedSignature = form.dataset.m326PrimarySignature || "";
  let selectedIndex = cards.findIndex(card => participantSignature(card) === storedSignature);
  if (selectedIndex < 0) {
    selectedIndex = Math.min(Number(form.dataset.m326PrimaryIndex || 0), cards.length - 1);
  }
  if (selectedIndex < 0) selectedIndex = 0;

  primarySelect.replaceChildren(...cards.map((card, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = participantName(card);
    return option;
  }));
  primarySelect.value = String(selectedIndex);
  form.dataset.m326PrimaryIndex = String(selectedIndex);
  form.dataset.m326PrimarySignature = participantSignature(cards[selectedIndex]);

  syncSubmitLabel(form, count);
}

function updateComposerPresentation(form) {
  if (!(form instanceof HTMLFormElement)) return;

  const cards = [...form.querySelectorAll("[data-m326-composer-person]")];
  if (!applyKnownTripDefaultStopFallback(form, cards)) {
    void ensureTripDefaultStopFallback(form, cards);
  }
  cards.forEach(card => enhanceComposerCard(card, form));

  const count = cards.length;
  const actions = form.querySelector(".v4-m326-composer-actions");
  let counter = form.querySelector("[data-m326-composer-count]");
  if (!counter && actions) {
    counter = document.createElement("p");
    counter.className = "subtle";
    counter.dataset.m326ComposerCount = "true";
    actions.insertAdjacentElement("afterend", counter);
  }
  if (counter) {
    counter.textContent = count === 0
      ? "Noch keine Person ausgewählt"
      : count === 1
        ? "1 Person ausgewählt"
        : `${count} Personen ausgewählt`;
  }

  const legacySummary = form.querySelector("[data-m326-composer-summary]");
  if (legacySummary instanceof HTMLElement) {
    legacySummary.hidden = true;
    legacySummary.setAttribute("aria-hidden", "true");
    legacySummary.style.setProperty("display", "none", "important");
  }

  syncBookingOptions(form, cards);

  const consent = form.querySelector("[data-m326-composer-consent], .v4-compact-check");
  if (consent instanceof HTMLElement) {
    consent.dataset.m326ComposerConsent = "true";
    consent.classList.remove("v4-compact-check");
    consent.classList.add("check-row");
    consent.style.setProperty("width", "100%", "important");
    consent.style.setProperty("white-space", "normal", "important");
    consent.style.setProperty("align-items", "flex-start", "important");

    const checkbox = consent.querySelector('input[type="checkbox"]');
    if (checkbox instanceof HTMLInputElement) {
      checkbox.style.setProperty("width", "18px", "important");
      checkbox.style.setProperty("height", "18px", "important");
      checkbox.style.setProperty("min-width", "18px", "important");
      checkbox.style.setProperty("min-height", "18px", "important");
      checkbox.style.setProperty("flex", "0 0 18px", "important");
      checkbox.style.setProperty("margin", "2px 0 0", "important");
    }

    const text = consent.querySelector("span");
    if (text instanceof HTMLElement) {
      text.style.setProperty("min-width", "0", "important");
      text.style.setProperty("white-space", "normal", "important");
      text.style.setProperty("overflow", "visible", "important");
      text.style.setProperty("text-overflow", "clip", "important");
      text.style.setProperty("line-height", "1.35", "important");
    }
  }

  const consentText = consent?.querySelector("span");
  if (consentText) {
    consentText.textContent = count === 1
      ? "Die Person hat die Teilnahmebedingungen akzeptiert und wurde auf die Datenschutzhinweise hingewiesen."
      : "Alle Personen haben die Teilnahmebedingungen akzeptiert und wurden auf die Datenschutzhinweise hingewiesen.";
  }

  syncSubmitLabel(form, count);
}

function deriveBookingAttemptKey(value, mode, primaryIndex) {
  const match = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{8})([0-9a-f]{4})$/i.exec(String(value || ""));
  if (!match) return value;
  const discriminator = (mode === "INDIVIDUAL" ? 0x4000 : 0x2000) | (Number(primaryIndex) & 0x0fff);
  const suffix = (Number.parseInt(match[6], 16) ^ discriminator).toString(16).padStart(4, "0");
  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}-${match[5]}${suffix}`;
}

function enhanceManualBulkRequest(event) {
  if (event.detail?.action !== MANUAL_BULK_ACTION) return;
  const form = document.querySelector(COMPOSER_SELECTOR);
  const payload = event.detail?.payload;
  const count = Array.isArray(payload?.participants) ? payload.participants.length : 0;
  if (!(form instanceof HTMLFormElement) || !payload || count < 2) return;

  const mode = currentBookingMode(form);
  const primaryIndex = mode === "GROUP"
    ? Number(form.querySelector("[data-m326-primary-participant]")?.value || 0)
    : 0;

  payload.bookingMode = mode;
  if (mode === "GROUP") payload.primaryParticipantIndex = primaryIndex;
  else delete payload.primaryParticipantIndex;
  payload.idempotencyKey = deriveBookingAttemptKey(payload.idempotencyKey, mode, primaryIndex);
}

function rememberManualBulkResult(event) {
  if (event.detail?.action !== MANUAL_BULK_ACTION) return;
  const result = event.detail?.data;
  if (result?.bookingMode !== "INDIVIDUAL") return;
  const count = Number(result.participantCount || result.bookingCount || 0);
  const created = Number(result.createdCount || 0);
  const waitlisted = Number(result.waitlistedCount || 0);
  const message = waitlisted === count && count > 0
    ? `${count} Einzelanmeldungen wurden auf die Warteliste gesetzt.`
    : waitlisted > 0
      ? `${count} Einzelanmeldungen erstellt · ${created} bestätigt · ${waitlisted} Warteliste.`
      : `${count} Einzelanmeldungen wurden erstellt.`;
  pendingIndividualToast = {
    message,
    warning: waitlisted > 0,
    expiresAt: Date.now() + 12000
  };
}

function installToastCorrection() {
  const region = document.getElementById("toastRegion");
  if (!region || region.dataset.m326BookingToastBound === "true") return;
  region.dataset.m326BookingToastBound = "true";
  new MutationObserver(mutations => {
    if (!pendingIndividualToast || pendingIndividualToast.expiresAt < Date.now()) {
      pendingIndividualToast = null;
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement) || !node.classList.contains("toast")) continue;
        if (!/gemeinsam (?:angemeldet|auf die Warteliste gesetzt)/i.test(node.textContent || "")) continue;
        node.textContent = pendingIndividualToast.message;
        if (pendingIndividualToast.warning) {
          node.classList.remove("success");
          node.classList.add("warning");
        }
        pendingIndividualToast = null;
        return;
      }
    }
  }).observe(region, { childList: true });
}

function rememberManualListBaseline(event) {
  const button = event.target.closest?.("[data-m310-add-registration]");
  if (!button) return;
  const dialog = document.getElementById("v4Dialog");
  if (!dialog?.open) return;
  if (dialog.querySelector("#v4DialogTitle")?.textContent?.trim() !== "Teilnehmer und Anmeldungen") return;
  const body = dialog.querySelector("#v4DialogBody");
  manualListBaseline = {
    parentContextId: String(dialog.dataset.v4DialogContext || ""),
    count: dialog.querySelectorAll("[data-m320-registration-record]").length,
    scrollTop: Number(body?.scrollTop || 0)
  };
}

function trackManualListRefreshRequest(event) {
  if (event.detail?.action !== MANUAL_BULK_ACTION) return;
  const form = document.querySelector(COMPOSER_SELECTOR);
  const payload = event.detail?.payload;
  if (!(form instanceof HTMLFormElement) || !payload) return;
  const dialog = form.closest("dialog");
  pendingManualListRefresh = {
    tripId: String(payload.tripId || ""),
    composerContextId: String(dialog?.dataset.v4DialogContext || ""),
    parentContextId: String(manualListBaseline?.parentContextId || ""),
    baselineCount: Number.isInteger(manualListBaseline?.count) ? manualListBaseline.count : null,
    scrollTop: Number(manualListBaseline?.scrollTop || 0),
    expectedCount: Array.isArray(payload.participants) ? payload.participants.length : 0
  };
}

function freshParticipantsTrigger(tripId) {
  if (!tripId) return null;
  return [...document.querySelectorAll(`[data-m310-participants="${CSS.escape(tripId)}"]`)]
    .find(button => button instanceof HTMLButtonElement && button.isConnected && !button.disabled)
    || null;
}

function bindFreshListStackCleanup(dialog, freshContextId, staleContextId) {
  const handleClose = event => {
    if (event.detail?.contextId !== freshContextId) return;
    dialog.removeEventListener("v4dialogclose", handleClose);
    setTimeout(() => {
      if (dialog.open && dialog.dataset.v4DialogContext === staleContextId) {
        closeAllDialogs();
      }
    }, 0);
  };
  dialog.addEventListener("v4dialogclose", handleClose);
}

function reopenFreshParticipantList(pending, dialog) {
  const trigger = freshParticipantsTrigger(pending.tripId);
  if (!trigger) return;
  const staleContextId = String(dialog.dataset.v4DialogContext || "");
  const observer = new MutationObserver(() => {
    if (!dialog.open) return;
    const contextId = String(dialog.dataset.v4DialogContext || "");
    const title = dialog.querySelector("#v4DialogTitle")?.textContent?.trim() || "";
    if (!contextId || contextId === staleContextId || title !== "Teilnehmer und Anmeldungen") return;
    observer.disconnect();
    bindFreshListStackCleanup(dialog, contextId, staleContextId);
    const body = dialog.querySelector("#v4DialogBody");
    requestAnimationFrame(() => {
      if (body?.isConnected) body.scrollTop = pending.scrollTop;
    });
  });
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ["data-v4-dialog-context"],
    childList: true,
    subtree: true
  });
  trigger.click();
  setTimeout(() => observer.disconnect(), 5000);
}

function ensureManualListRefresh(pending) {
  const dialog = document.getElementById("v4Dialog");
  if (!dialog?.open) return;
  if (dialog.querySelector("#v4DialogTitle")?.textContent?.trim() !== "Teilnehmer und Anmeldungen") return;
  if (pending.parentContextId && dialog.dataset.v4DialogContext !== pending.parentContextId) return;

  const currentCount = dialog.querySelectorAll("[data-m320-registration-record]").length;
  const expectedCount = Math.max(0, Number(pending.expectedCount || 0));
  if (pending.baselineCount !== null && currentCount >= pending.baselineCount + expectedCount) return;
  reopenFreshParticipantList(pending, dialog);
}

function scheduleManualListRefresh(event) {
  if (event.detail?.action !== MANUAL_BULK_ACTION || !pendingManualListRefresh) return;
  const result = event.detail?.data;
  const pending = pendingManualListRefresh;
  pendingManualListRefresh = null;
  pending.expectedCount = Number(result?.participantCount || result?.bookingCount || pending.expectedCount || 0);

  const dialog = document.getElementById("v4Dialog");
  if (!dialog?.open || !pending.composerContextId) return;
  const handleClose = closeEvent => {
    if (closeEvent.detail?.contextId !== pending.composerContextId) return;
    dialog.removeEventListener("v4dialogclose", handleClose);
    setTimeout(() => ensureManualListRefresh(pending), 120);
  };
  dialog.addEventListener("v4dialogclose", handleClose);
}

function enhanceComposerForm(form) {
  if (!(form instanceof HTMLFormElement)) return;
  updateComposerPresentation(form);
  if (form.dataset.m326ComposerOverviewEnhanced === "true") return;
  form.dataset.m326ComposerOverviewEnhanced = "true";

  const root = form.querySelector("[data-m326-composer]");
  if (!root) return;
  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => updateComposerPresentation(form));
  });
  observer.observe(root, { childList: true });

  const dialog = form.closest("dialog");
  dialog?.addEventListener("close", () => observer.disconnect(), { once: true });
}

function scanComposer(root = document) {
  if (root instanceof Element && root.matches(COMPOSER_SELECTOR)) enhanceComposerForm(root);
  root.querySelectorAll?.(COMPOSER_SELECTOR).forEach(enhanceComposerForm);
}

document.addEventListener("click", rememberManualListBaseline, true);
window.addEventListener("pd-api-before-call", enhanceManualBulkRequest);
window.addEventListener("pd-api-before-call", trackManualListRefreshRequest);
window.addEventListener("pd-api-after-call", rememberTripContext);
window.addEventListener("pd-api-after-call", rememberManualBulkResult);
window.addEventListener("pd-api-after-call", scheduleManualListRefresh);
installToastCorrection();
scanComposer();

const composerObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scanComposer(node);
  }));
});
composerObserver.observe(document.body, { childList: true, subtree: true });
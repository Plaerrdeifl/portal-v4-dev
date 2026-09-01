import { call } from "./modules/common.js";

const FORM_SELECTOR = "[data-m326-person-form]";
const MAX_VISIBLE_RESULTS = 8;
const MANUAL_BULK_ACTION = "fanbus_registration_create_manual_bulk";
let pendingSingleManualToast = null;

function activeSourceFilter(form) {
  const active = [...form.querySelectorAll("[data-m326-source-filter]")]
    .find(button => !button.hidden && button.classList.contains("is-active"));
  return active?.dataset.m326SourceFilter || "ALL";
}

function personChoiceKey(person) {
  const type = String(person?.personType || "");
  const id = type === "MEMBER" ? person?.memberId : person?.portalUserId;
  return type && id ? `${type}:${id}` : "";
}

async function loadPersonDefaultStops() {
  try {
    const data = await call("fanbus_registration_people_list");
    const defaults = new Map();
    for (const person of Array.isArray(data?.people) ? data.people : []) {
      const key = personChoiceKey(person);
      const label = String(person?.defaultBoardingStopLabel || "").trim();
      if (key && person?.defaultBoardingStopId && label) {
        defaults.set(key, {
          boardingStopId: person.defaultBoardingStopId,
          label
        });
      }
    }
    return defaults;
  } catch {
    return new Map();
  }
}

function applyPreferredStopToComposer(index, preferredLabel) {
  const composer = document.getElementById("m326ManualComposerForm");
  const select = composer?.querySelector(`[data-m326-person-stop="${index}"]`);
  if (!select) return false;

  const label = String(preferredLabel || "").trim();
  if (!label) return true;

  const option = [...select.options].find(candidate => {
    const text = String(candidate.textContent || "").trim();
    return text === label || text.endsWith(` · ${label}`);
  });

  // Persönlicher Standard ist für diese Fahrt nicht aktiv: die bereits vom
  // Composer gesetzte Fahrt-Vorgabe bleibt bestehen.
  if (!option?.value) return true;

  if (select.value !== option.value) {
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

function setFlowVisible(element, visible) {
  element.hidden = !visible;
  element.setAttribute("aria-hidden", String(!visible));
  if (visible) {
    element.style.removeProperty("display");
  } else {
    element.style.setProperty("display", "none", "important");
  }
}

function enhancePicker(form) {
  if (!(form instanceof HTMLFormElement) || form.dataset.m326PickerEnhanced === "true") return;

  const query = form.elements.namedItem("query");
  const queryLabel = query?.closest("label");
  const filters = form.querySelector(".v4-m326-person-filters");
  const results = form.querySelector("[data-m326-person-results]");
  const guestFields = form.querySelector("[data-m326-guest-fields]");
  const legacyGuestButton = form.querySelector("[data-m326-new-guest]");
  if (!query || !queryLabel || !filters || !results || !guestFields || !legacyGuestButton) return;

  form.dataset.m326PickerEnhanced = "true";
  form.dataset.m326PickerMode = "person";

  // Die persönlichen Fanbus-Vorgaben werden parallel geladen. Beim Übernehmen
  // gilt: persönlicher aktiver Zustieg > Fahrtstandard > Bitte wählen.
  const personDefaultsPromise = loadPersonDefaultStops();

  // Der bestehende M326-Dialog fokussiert die Suche beim Öffnen.
  // Auf iOS würde dadurch direkt Tastatur bzw. nach dem Umbau der Select-Picker aufgehen.
  // Das Formular selbst dient deshalb während der Initialisierung als neutrales Fokusziel.
  form.tabIndex = -1;
  try {
    form.focus({ preventScroll: true });
  } catch {
    form.focus();
  }

  queryLabel.classList.add("v4-field-full", "full");
  filters.classList.add("v4-field-full", "full", "button-row");
  results.classList.add("v4-field-full", "full");
  guestFields.classList.remove("v4-smart-form");
  guestFields.querySelectorAll(".v4-field-full").forEach(element => element.classList.add("full"));
  legacyGuestButton.hidden = true;
  legacyGuestButton.style.setProperty("display", "none", "important");

  // "Alle" ist kein eigener ausgabender Personentyp. Ohne gewählten Typ bleibt
  // die Namenssuche intern trotzdem auf ALL, der leere visuelle Filter entfällt.
  form.querySelector('[data-m326-source-filter="ALL"]')?.remove();

  const modeLabel = document.createElement("label");
  modeLabel.className = "v4-field-full";
  modeLabel.textContent = "Art der Erfassung";

  const modeSelect = document.createElement("select");
  modeSelect.dataset.m326PickerModeSelect = "true";
  modeSelect.innerHTML = `
    <option value="person">Bestehende Person</option>
    <option value="guest">Neuer Gast</option>
  `;
  modeLabel.append(modeSelect);

  const personPane = document.createElement("div");
  personPane.className = "v4-field-full form-grid";
  personPane.dataset.m326PickerPersonPane = "true";
  personPane.setAttribute("aria-label", "Bestehende Person auswählen");

  const helper = document.createElement("p");
  helper.className = "subtle v4-field-full full";
  helper.setAttribute("role", "status");
  helper.textContent = "Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen.";

  const more = document.createElement("p");
  more.className = "subtle v4-field-full full";
  more.hidden = true;

  queryLabel.before(personPane);
  personPane.append(queryLabel, filters, helper, results, more);
  form.prepend(modeLabel);

  const filterButtons = [...form.querySelectorAll("[data-m326-source-filter]")]
    .filter(button => button !== legacyGuestButton);
  filterButtons.forEach(button => button.classList.add("small"));

  const updateResultLimit = () => {
    const buttons = [...results.querySelectorAll("[data-m326-choice]")];
    buttons.forEach((button, index) => {
      button.hidden = index >= MAX_VISIBLE_RESULTS;
    });
    const additional = Math.max(0, buttons.length - MAX_VISIBLE_RESULTS);
    more.hidden = results.hidden || additional === 0;
    more.textContent = additional
      ? `${additional} weitere Treffer – Suche bitte genauer.`
      : "";
  };

  const updatePersonVisibility = () => {
    if (form.dataset.m326PickerMode !== "person") return;
    const queryLength = String(query.value || "").trim().length;
    const filtered = activeSourceFilter(form) !== "ALL";
    const showResults = queryLength >= 2 || filtered;
    helper.hidden = showResults;
    results.hidden = !showResults;
    more.hidden = !showResults;
    if (showResults) requestAnimationFrame(updateResultLimit);
  };

  const setMode = mode => {
    const guest = mode === "guest";
    form.dataset.m326PickerMode = guest ? "guest" : "person";
    modeSelect.value = guest ? "guest" : "person";

    setFlowVisible(personPane, !guest);
    setFlowVisible(guestFields, guest);

    query.disabled = guest;
    filterButtons.forEach(button => {
      button.disabled = guest;
    });

    guestFields.querySelectorAll("input").forEach(input => {
      input.disabled = !guest;
      input.required = guest && input.name !== "email";
    });

    if (guest) {
      helper.hidden = true;
      results.hidden = true;
      more.hidden = true;
    } else {
      updatePersonVisibility();
    }
  };

  const neutralizeInitialFieldFocus = () => {
    if (!form.isConnected) return;
    const active = document.activeElement;
    const fieldHasInitialFocus = active === modeSelect
      || active === query
      || guestFields.contains(active);
    if (!fieldHasInitialFocus) return;
    try {
      form.focus({ preventScroll: true });
    } catch {
      form.focus();
    }
  };

  query.addEventListener("input", () => requestAnimationFrame(updatePersonVisibility));
  filterButtons.forEach(button => button.addEventListener("click", () => requestAnimationFrame(updatePersonVisibility)));
  modeSelect.addEventListener("change", () => setMode(modeSelect.value));

  // Vor dem bestehenden Choice-Handler merken wir uns den neuen Composer-Index.
  // Nach dessen Re-Render überschreibt ein aktiver Personenstandard den
  // Fahrtstandard; ist er für diese Fahrt nicht verfügbar, bleibt der
  // Fahrtstandard unangetastet.
  results.addEventListener("click", event => {
    const button = event.target.closest("[data-m326-choice]");
    if (!button) return;
    const choiceKey = button.dataset.m326Choice || "";
    const targetIndex = document.querySelectorAll(
      "#m326ManualComposerForm [data-m326-composer-person]"
    ).length;

    personDefaultsPromise.then(defaults => {
      const preferred = defaults.get(choiceKey);
      if (!preferred?.label) return;

      let attempts = 0;
      const apply = () => {
        attempts += 1;
        if (applyPreferredStopToComposer(targetIndex, preferred.label) || attempts >= 8) return;
        window.setTimeout(apply, 25);
      };
      window.setTimeout(apply, 0);
    });
  }, true);

  const resultObserver = new MutationObserver(() => {
    if (form.dataset.m326PickerMode === "person" && !results.hidden) {
      requestAnimationFrame(updateResultLimit);
    }
  });
  resultObserver.observe(results, { childList: true });

  const dialog = form.closest("dialog");
  dialog?.addEventListener("close", () => resultObserver.disconnect(), { once: true });

  setMode("person");

  // iOS kann den Fokus erst nach der DOM-Erweiterung auf den ersten Form-Control legen.
  // Zwei kurze Nachprüfungen verhindern das, ohne spätere Nutzereingaben anzutasten.
  requestAnimationFrame(neutralizeInitialFieldFocus);
  window.setTimeout(neutralizeInitialFieldFocus, 80);
}

function rememberSingleManualResult(event) {
  if (event.detail?.action !== MANUAL_BULK_ACTION) return;
  const result = event.detail?.data;
  const count = Number(result?.participantCount || result?.bookingCount || 0);
  if (count !== 1) return;
  const warning = result?.outcome === "WAITLISTED";
  pendingSingleManualToast = {
    message: warning
      ? "Person wurde auf die Warteliste gesetzt."
      : "Person wurde angemeldet.",
    warning,
    expiresAt: Date.now() + 12000
  };
}

function installSingleManualToastCorrection() {
  const region = document.getElementById("toastRegion");
  if (!region || region.dataset.m326SingleToastBound === "true") return;
  region.dataset.m326SingleToastBound = "true";
  new MutationObserver(mutations => {
    if (!pendingSingleManualToast || pendingSingleManualToast.expiresAt < Date.now()) {
      pendingSingleManualToast = null;
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement) || !node.classList.contains("toast")) continue;
        if (!/1 Personen wurden gemeinsam (?:angemeldet|auf die Warteliste gesetzt)/i.test(node.textContent || "")) continue;
        node.textContent = pendingSingleManualToast.message;
        if (pendingSingleManualToast.warning) {
          node.classList.remove("success");
          node.classList.add("warning");
        }
        pendingSingleManualToast = null;
        return;
      }
    }
  }).observe(region, { childList: true });
}

function scan(root = document) {
  if (root instanceof Element && root.matches(FORM_SELECTOR)) enhancePicker(root);
  root.querySelectorAll?.(FORM_SELECTOR).forEach(enhancePicker);
}

window.addEventListener("pd-api-after-call", rememberSingleManualResult);
installSingleManualToastCorrection();
scan();

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scan(node);
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

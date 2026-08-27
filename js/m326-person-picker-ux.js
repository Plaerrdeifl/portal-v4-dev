const FORM_SELECTOR = "[data-m326-person-form]";
const MAX_VISIBLE_RESULTS = 8;

function activeSourceFilter(form) {
  const active = [...form.querySelectorAll("[data-m326-source-filter]")]
    .find(button => !button.hidden && button.classList.contains("is-active"));
  return active?.dataset.m326SourceFilter || "ALL";
}

function setButtonState(button, active) {
  if (!button) return;
  button.classList.toggle("primary", active);
  button.classList.toggle("secondary", !active);
  button.setAttribute("aria-pressed", String(active));
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

  queryLabel.classList.add("v4-field-full");
  filters.classList.add("v4-field-full", "button-row");
  results.classList.add("v4-field-full");
  guestFields.classList.add("v4-smart-form");
  legacyGuestButton.hidden = true;

  const switcher = document.createElement("div");
  switcher.className = "v4-field-full button-row";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", "Art der Personenauswahl");

  const personButton = document.createElement("button");
  personButton.type = "button";
  personButton.className = "button primary";
  personButton.textContent = "Bestehende Person";
  personButton.dataset.m326PickerModeButton = "person";

  const guestButton = document.createElement("button");
  guestButton.type = "button";
  guestButton.className = "button secondary";
  guestButton.textContent = "Neuer Gast";
  guestButton.dataset.m326PickerModeButton = "guest";

  switcher.append(personButton, guestButton);

  const helper = document.createElement("p");
  helper.className = "subtle v4-field-full";
  helper.setAttribute("role", "status");
  helper.textContent = "Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen.";

  const more = document.createElement("p");
  more.className = "subtle v4-field-full";
  more.hidden = true;

  const personPane = document.createElement("section");
  personPane.className = "v4-field-full form-grid v4-smart-form";
  personPane.setAttribute("aria-label", "Bestehende Person auswählen");
  queryLabel.before(personPane);
  personPane.append(queryLabel, filters, helper, results, more);

  form.prepend(switcher);

  const filterButtons = [...form.querySelectorAll("[data-m326-source-filter]")]
    .filter(button => button !== legacyGuestButton);

  const syncFilterButtons = () => {
    filterButtons.forEach(button => {
      const active = button.classList.contains("is-active");
      setButtonState(button, active);
      button.classList.add("small");
    });
  };

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
    syncFilterButtons();
    if (showResults) requestAnimationFrame(updateResultLimit);
  };

  const setMode = mode => {
    const guest = mode === "guest";
    form.dataset.m326PickerMode = guest ? "guest" : "person";
    personPane.hidden = guest;
    guestFields.hidden = !guest;
    setButtonState(personButton, !guest);
    setButtonState(guestButton, guest);

    guestFields.querySelectorAll("input").forEach(input => {
      input.disabled = !guest;
      input.required = guest && input.name !== "email";
    });

    if (guest) {
      helper.hidden = true;
      results.hidden = true;
      more.hidden = true;
      requestAnimationFrame(() => form.elements.namedItem("firstName")?.focus());
    } else {
      updatePersonVisibility();
      requestAnimationFrame(() => query.focus());
    }
  };

  const scheduleVisibilityUpdate = () => requestAnimationFrame(updatePersonVisibility);
  query.addEventListener("input", scheduleVisibilityUpdate);
  filterButtons.forEach(button => button.addEventListener("click", scheduleVisibilityUpdate));
  personButton.addEventListener("click", () => setMode("person"));
  guestButton.addEventListener("click", () => setMode("guest"));

  const resultObserver = new MutationObserver(() => {
    if (form.dataset.m326PickerMode === "person" && !results.hidden) {
      requestAnimationFrame(updateResultLimit);
    }
  });
  resultObserver.observe(results, { childList: true });

  const dialog = form.closest("dialog");
  dialog?.addEventListener("close", () => resultObserver.disconnect(), { once: true });

  syncFilterButtons();
  setMode("person");
}

function scan(root = document) {
  if (root instanceof Element && root.matches(FORM_SELECTOR)) enhancePicker(root);
  root.querySelectorAll?.(FORM_SELECTOR).forEach(enhancePicker);
}

scan();

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scan(node);
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

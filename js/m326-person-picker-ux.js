const FORM_SELECTOR = "[data-m326-person-form]";
const MAX_VISIBLE_RESULTS = 8;

function activeSourceFilter(form) {
  const active = [...form.querySelectorAll("[data-m326-source-filter]")]
    .find(button => !button.hidden && button.classList.contains("is-active"));
  return active?.dataset.m326SourceFilter || "ALL";
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

  queryLabel.classList.add("v4-field-full", "full");
  filters.classList.add("v4-field-full", "full", "button-row");
  results.classList.add("v4-field-full", "full");
  guestFields.classList.remove("v4-smart-form");
  guestFields.querySelectorAll(".v4-field-full").forEach(element => element.classList.add("full"));
  legacyGuestButton.hidden = true;

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

    personPane.hidden = guest;
    personPane.setAttribute("aria-hidden", String(guest));
    guestFields.hidden = !guest;
    guestFields.setAttribute("aria-hidden", String(!guest));

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

  query.addEventListener("input", () => requestAnimationFrame(updatePersonVisibility));
  filterButtons.forEach(button => button.addEventListener("click", () => requestAnimationFrame(updatePersonVisibility)));
  modeSelect.addEventListener("change", () => setMode(modeSelect.value));

  const resultObserver = new MutationObserver(() => {
    if (form.dataset.m326PickerMode === "person" && !results.hidden) {
      requestAnimationFrame(updateResultLimit);
    }
  });
  resultObserver.observe(results, { childList: true });

  const dialog = form.closest("dialog");
  dialog?.addEventListener("close", () => resultObserver.disconnect(), { once: true });

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

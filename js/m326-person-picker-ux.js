const FORM_SELECTOR = "[data-m326-person-form]";
const STYLE_ID = "m326-person-picker-ux-style";
const MAX_VISIBLE_RESULTS = 8;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ${FORM_SELECTOR}[data-m326-picker-enhanced="true"] {
      display: grid;
      gap: 14px;
    }

    .m326-person-picker-intro {
      margin: 0;
      color: var(--ink-500, #66758a);
      font-size: .9rem;
      line-height: 1.45;
    }

    .m326-person-picker-switch {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 4;
      padding: 2px 0 8px;
      background: var(--surface, #fff);
    }

    .m326-person-picker-switch .button {
      width: 100%;
      min-height: 46px;
      padding-inline: 10px;
      white-space: normal;
      line-height: 1.15;
    }

    .m326-person-picker-switch .button[aria-selected="true"] {
      border-color: var(--blue-700, #176fc1);
      background: var(--blue-700, #176fc1);
      color: #fff;
    }

    .m326-person-picker-person-pane {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .m326-person-picker-person-pane > label {
      margin: 0;
    }

    .m326-person-picker-person-pane .v4-m326-person-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .m326-person-picker-person-pane .v4-m326-person-filters .button {
      flex: 0 1 auto;
      min-height: 40px;
      padding: 8px 11px;
    }

    .m326-person-picker-helper,
    .m326-person-picker-more {
      margin: 0;
      color: var(--ink-500, #66758a);
      font-size: .82rem;
      line-height: 1.4;
    }

    .m326-person-picker-results {
      max-height: min(44dvh, 390px);
      overflow: auto;
      overscroll-behavior: contain;
      padding-right: 2px;
      scrollbar-gutter: stable;
    }

    ${FORM_SELECTOR}[data-m326-picker-mode="guest"] [data-m326-guest-fields] {
      display: grid;
      gap: 12px;
      margin: 0;
    }

    ${FORM_SELECTOR}[data-m326-picker-mode="guest"] [data-m326-guest-fields] .dialog-actions {
      margin-top: 2px;
    }

    @media (max-width: 620px) {
      .m326-person-picker-switch {
        margin-inline: -2px;
      }

      .m326-person-picker-results {
        max-height: 42dvh;
      }

      ${FORM_SELECTOR}[data-m326-picker-enhanced="true"] .v4-m325-person-search-result {
        min-height: 50px;
        padding-block: 9px;
      }
    }
  `;
  document.head.append(style);
}

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

  ensureStyles();
  form.dataset.m326PickerEnhanced = "true";
  form.dataset.m326PickerMode = "person";

  const intro = document.createElement("p");
  intro.className = "m326-person-picker-intro";
  intro.textContent = "Bestehende Person suchen oder einen neuen Gast erfassen.";

  const switcher = document.createElement("div");
  switcher.className = "m326-person-picker-switch";
  switcher.setAttribute("role", "tablist");
  switcher.setAttribute("aria-label", "Art der Personenauswahl");

  const personTab = document.createElement("button");
  personTab.type = "button";
  personTab.className = "button secondary";
  personTab.textContent = "Person auswählen";
  personTab.setAttribute("role", "tab");
  personTab.setAttribute("aria-selected", "true");

  const guestTab = document.createElement("button");
  guestTab.type = "button";
  guestTab.className = "button secondary";
  guestTab.textContent = "Gast anlegen";
  guestTab.setAttribute("role", "tab");
  guestTab.setAttribute("aria-selected", "false");

  switcher.append(personTab, guestTab);
  form.prepend(intro, switcher);

  const personPane = document.createElement("section");
  personPane.className = "m326-person-picker-person-pane";
  personPane.setAttribute("aria-label", "Bestehende Person auswählen");
  queryLabel.before(personPane);
  personPane.append(queryLabel, filters, results);

  legacyGuestButton.hidden = true;
  results.classList.add("m326-person-picker-results");

  const helper = document.createElement("p");
  helper.className = "m326-person-picker-helper";
  helper.setAttribute("role", "status");
  helper.textContent = "Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen.";
  results.before(helper);

  const more = document.createElement("p");
  more.className = "m326-person-picker-more";
  more.hidden = true;
  results.after(more);

  const updateResultLimit = () => {
    const buttons = [...results.querySelectorAll("[data-m326-choice]")];
    buttons.forEach((button, index) => {
      button.hidden = index >= MAX_VISIBLE_RESULTS;
    });
    const additional = Math.max(0, buttons.length - MAX_VISIBLE_RESULTS);
    more.hidden = results.hidden || additional === 0;
    more.textContent = additional
      ? `${additional} weitere Treffer – Suche genauer, um sie einzugrenzen.`
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
    personPane.hidden = guest;
    guestFields.hidden = !guest;
    personTab.setAttribute("aria-selected", String(!guest));
    guestTab.setAttribute("aria-selected", String(guest));

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
  form.querySelectorAll("[data-m326-source-filter]").forEach(button => {
    if (button === legacyGuestButton) return;
    button.addEventListener("click", scheduleVisibilityUpdate);
  });

  personTab.addEventListener("click", () => setMode("person"));
  guestTab.addEventListener("click", () => setMode("guest"));

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

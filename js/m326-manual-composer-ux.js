import { escapeAttr, escapeHtml, openDialog } from "./modules/common.js";

const COMPOSER_SELECTOR = "#m326ManualComposerForm";

function selectOptionsMarkup(select) {
  if (!(select instanceof HTMLSelectElement)) return "";
  return [...select.options].map(option => (
    `<option value="${escapeAttr(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.textContent || "")}</option>`
  )).join("");
}

function participantName(card) {
  return card.querySelector("[data-m326-composer-source] .v4-m326-composer-person strong")?.textContent?.trim()
    || "Teilnehmer";
}

function participantSource(card) {
  return card.querySelector("[data-m326-composer-source] .v4-m326-composer-person small")?.textContent?.trim()
    || "Person";
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

  // Die Originalkarte enthält die Editierfelder und zeichnet deshalb selbst
  // bereits einen Rahmen. In der Übersicht bleibt nur die eine klickbare
  // Portalkarte sichtbar – ohne zusätzlichen äußeren Containerrahmen.
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

function updateComposerPresentation(form) {
  if (!(form instanceof HTMLFormElement)) return;

  const cards = [...form.querySelectorAll("[data-m326-composer-person]")];
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

  const dialog = form.closest("dialog");
  const submit = dialog?.querySelector("#v4DialogSubmit");
  if (submit instanceof HTMLButtonElement) {
    submit.textContent = count === 1
      ? "Person anmelden"
      : count > 1
        ? `${count} Personen anmelden`
        : "Anmelden";
    submit.disabled = count === 0;
  }
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

scanComposer();

const composerObserver = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scanComposer(node);
  }));
});
composerObserver.observe(document.body, { childList: true, subtree: true });

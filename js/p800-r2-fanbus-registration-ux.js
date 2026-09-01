const PORTAL_FORM_ID = "m310PortalForm";
const GUEST_FORM_ID = "m310GuestForm";

let lastReview = null;
let scheduled = false;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function selectedText(select) {
  if (!select || select.hidden || select.closest("[hidden]")) return "";
  return cleanText(select.selectedOptions?.[0]?.textContent || "");
}

function row(label, value) {
  if (!value) return "";
  return `<div class="p800-fanbus-review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeOptionLabels(root = document) {
  root.querySelectorAll('select[name="busPreference"] option').forEach(option => {
    const labels = { EGAL: "Egal", RUHIG: "Ruhig", PARTY: "Party" };
    if (labels[option.value] && option.textContent !== labels[option.value]) {
      option.textContent = labels[option.value];
    }
  });
}

function normalizeIdentity() {
  const identity = document.getElementById("m310PortalIdentity");
  if (!identity) return;
  identity.querySelectorAll(".v4-person-badge").forEach(badge => {
    if (cleanText(badge.textContent) === "Portaluser") badge.remove();
  });
  if (!identity.querySelector(".p800-self-registration-note")) {
    const note = document.createElement("small");
    note.className = "p800-self-registration-note";
    note.textContent = "Du meldest dich selbst an.";
    identity.appendChild(note);
  }
}

function normalizeCompanionControls() {
  document.querySelectorAll('[data-m320-add-guest="portal"],[data-m320-add-guest="guest"]').forEach(button => {
    if (cleanText(button.textContent) !== "+ Mitfahrer hinzufügen") {
      button.textContent = "+ Mitfahrer hinzufügen";
    }
  });

  const saved = document.querySelector("[data-m325-open-companion-list]");
  if (saved && cleanText(saved.textContent) !== "Gespeicherte Mitfahrer") {
    saved.textContent = "Gespeicherte Mitfahrer";
  }

  document.querySelectorAll("[data-m320-companion-count]").forEach(counter => {
    const raw = cleanText(counter.textContent);
    const match = raw.match(/^(\d+)\s+(?:Person|Personen|Mitfahrer)$/i);
    if (!match) return;
    const count = Number(match[1]);
    const portal = counter.dataset.m320CompanionCount === "portal";
    const next = portal ? `Du + ${count} Mitfahrer` : `${count} Mitfahrer`;
    if (raw !== next) counter.textContent = next;
  });
}

function preferenceSummaryText(root) {
  const select = root.querySelector("select");
  const value = selectedText(select);
  return value ? `Standard-Zustieg: ${value}` : "Standard-Zustieg festlegen";
}

function enhanceBoardingPreference() {
  const root = document.getElementById("m325UserBoardingPreference");
  if (!root || root.hidden || root.querySelector(":scope > .p800-preference-details")) return;
  if (!root.querySelector("select")) return;

  const details = document.createElement("details");
  details.className = "p800-preference-details";

  const summary = document.createElement("summary");
  summary.className = "p800-preference-summary";
  summary.textContent = preferenceSummaryText(root);

  const body = document.createElement("div");
  body.className = "p800-preference-body";
  while (root.firstChild) body.appendChild(root.firstChild);
  details.append(summary, body);
  root.appendChild(details);

  const select = body.querySelector("select");
  select?.addEventListener("change", () => {
    summary.textContent = preferenceSummaryText(root);
  });
}

function companionNames(form) {
  return [...form.querySelectorAll(".fanbus-companion")]
    .map(item => cleanText(item.querySelector("strong")?.textContent))
    .filter(Boolean);
}

function buildReview(form) {
  const portal = form.id === PORTAL_FORM_ID;
  const trip = cleanText(document.querySelector("#m310PublicTrip h2")?.textContent);
  const primaryName = portal
    ? cleanText(document.querySelector("#m310PortalIdentity strong")?.textContent)
    : cleanText(`${form.elements.namedItem("firstName")?.value || ""} ${form.elements.namedItem("lastName")?.value || ""}`);
  const names = [primaryName, ...companionNames(form)].filter(Boolean);
  const stop = selectedText(form.elements.namedItem("boardingStopId"));
  const busWish = selectedText(form.elements.namedItem("busPreference"));

  return {
    trip,
    people: names.length ? names.join(", ") : portal ? "Du" : "1 Person",
    count: names.length || 1,
    stop,
    busWish
  };
}

function reviewSignature(review) {
  return JSON.stringify(review);
}

function reviewMarkup(review) {
  const signature = escapeHtml(reviewSignature(review));
  return `
    <section class="p800-fanbus-review" data-p800-review-signature="${signature}" aria-label="Zusammenfassung deiner Anmeldung">
      <h3>Deine Anmeldung im Überblick</h3>
      ${row("Fahrt", review.trip)}
      ${row(review.count === 1 ? "Person" : "Personen", review.people)}
      ${row("Zustieg", review.stop)}
      ${row("Buswunsch", review.busWish)}
    </section>`;
}

function ensureReview(form) {
  if (form.hidden) return;
  let review = form.querySelector(":scope > .p800-fanbus-review");
  const next = buildReview(form);
  const signature = reviewSignature(next);
  lastReview = next;

  if (!review) {
    const duplicate = form.querySelector("[data-m325-duplicate-preview]");
    const actions = form.querySelector(".fanbus-public-actions");
    const anchor = duplicate || actions;
    if (!anchor) return;
    anchor.insertAdjacentHTML("beforebegin", reviewMarkup(next));
    return;
  }

  if (review.dataset.p800ReviewSignature !== signature) {
    review.outerHTML = reviewMarkup(next);
  }
}

function updateReviews() {
  [PORTAL_FORM_ID, GUEST_FORM_ID].forEach(id => {
    const form = document.getElementById(id);
    if (form && !form.hidden) ensureReview(form);
  });
}

function normalizeDialogCopy() {
  document.querySelectorAll("dialog h2").forEach(title => {
    const text = cleanText(title.textContent);
    if (text === "Gast hinzufügen") title.textContent = "Mitfahrer hinzufügen";
    if (text === "Mitfahrerliste anlegen") title.textContent = "Gespeicherte Mitfahrer einrichten";
  });

  document.querySelectorAll("dialog p").forEach(paragraph => {
    if (cleanText(paragraph.textContent) === "Noch keine Mitfahrerliste vorhanden.") {
      paragraph.textContent = "Du hast noch keine gespeicherten Mitfahrer.";
    }
  });

  document.querySelectorAll('dialog input[placeholder="z. B. Auswärtsfahrt"]').forEach(input => {
    input.placeholder = "z. B. Familie";
  });

  document.querySelectorAll("dialog button").forEach(button => {
    if (cleanText(button.textContent) === "Mitfahrerliste anlegen") {
      button.textContent = "Liste speichern";
    }
  });
}

function updateBusyButtons() {
  [PORTAL_FORM_ID, GUEST_FORM_ID].forEach(id => {
    const form = document.getElementById(id);
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.p800IdleLabel) {
      button.dataset.p800IdleLabel = cleanText(button.textContent);
    }

    const status = cleanText(document.getElementById("m310RegistrationStatus")?.textContent);
    const sending = button.disabled && status.includes("Anmeldung wird übermittelt");
    const next = sending ? "Anmeldung wird gesendet …" : button.dataset.p800IdleLabel;
    if (cleanText(button.textContent) !== next) button.textContent = next;
  });
}

function enhanceSuccess() {
  const title = document.getElementById("m310RegistrationTitle");
  const intro = document.getElementById("m310RegistrationIntro");
  if (!title || !intro || !lastReview) return;

  const state = cleanText(title.textContent);
  if (!["Anmeldung bestätigt", "Auf Warteliste eingetragen"].includes(state)) return;
  const panel = document.getElementById("m310RegistrationPanel");
  if (!panel || panel.querySelector(".p800-fanbus-success")) return;

  const section = document.createElement("section");
  section.className = "p800-fanbus-success";
  section.innerHTML = `${reviewMarkup(lastReview)}
    <a class="button primary" href="./#/fanbuses">Zurück zu den Fanbusfahrten</a>`;
  intro.insertAdjacentElement("afterend", section);

  if (state === "Anmeldung bestätigt") {
    intro.textContent = "Deine Anmeldung ist gespeichert. Hier siehst du noch einmal die wichtigsten Angaben.";
  } else {
    intro.textContent = "Deine Anmeldung steht auf der Warteliste. Hier siehst du noch einmal die wichtigsten Angaben.";
  }
}

function injectStyles() {
  if (document.getElementById("p800R2FanbusRegistrationStyles")) return;
  const style = document.createElement("style");
  style.id = "p800R2FanbusRegistrationStyles";
  style.textContent = `
    .fanbus-companion-remove{width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important}
    .p800-self-registration-note{display:block;margin-left:auto;color:var(--ink-500);font-size:.78rem;font-weight:700;text-align:right}
    .fanbus-user-preference{display:block!important;padding:0!important;border:0!important;background:transparent!important}
    .p800-preference-details{border:1px solid var(--line,#d8e2ee);border-radius:13px;background:#f8fbff;overflow:hidden}
    .p800-preference-summary{cursor:pointer;list-style:none;padding:12px 14px;color:var(--ink-700,#334155);font-weight:800}
    .p800-preference-summary::-webkit-details-marker{display:none}
    .p800-preference-summary::after{content:"Ändern";float:right;color:var(--blue-800);font-size:.8rem}
    .p800-preference-body{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:end;padding:0 12px 12px}
    .p800-preference-body label{min-width:0}
    .fanbus-public-booking-count{display:none}
    .p800-fanbus-review{display:grid;gap:8px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:#f8fbff}
    .p800-fanbus-review h3{margin:0 0 2px;font-size:1rem}
    .p800-fanbus-review-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .p800-fanbus-review-row span{color:var(--ink-500);font-size:.82rem}
    .p800-fanbus-review-row strong{text-align:right;font-size:.88rem;overflow-wrap:anywhere}
    .p800-fanbus-success{display:grid;gap:14px;margin-top:14px}
    @media(max-width:620px){
      .p800-preference-body{grid-template-columns:1fr 1fr}
      .p800-preference-body label{grid-column:1/-1}
      .p800-self-registration-note{max-width:42%}
    }
  `;
  document.head.appendChild(style);
}

function enhance() {
  injectStyles();
  normalizeOptionLabels();
  normalizeIdentity();
  normalizeCompanionControls();
  enhanceBoardingPreference();
  normalizeDialogCopy();
  updateReviews();
  updateBusyButtons();
  enhanceSuccess();
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

[PORTAL_FORM_ID, GUEST_FORM_ID].forEach(id => {
  const form = document.getElementById(id);
  form?.addEventListener("input", scheduleEnhance);
  form?.addEventListener("change", scheduleEnhance);
  form?.addEventListener("submit", () => {
    lastReview = buildReview(form);
    scheduleEnhance();
  });
});

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["hidden", "disabled"]
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
} else {
  scheduleEnhance();
}

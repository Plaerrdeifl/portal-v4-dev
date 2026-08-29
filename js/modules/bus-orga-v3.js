import { hydrateBusOrgaV2 } from "./bus-orga-v2.js?v=20260829-m328-r1-next-trip-venue1&completion=20260829-m328-final1";
import { hydrateBusOrgaRegistrationV3 } from "./bus-orga-registration-v3.js?v=20260829-m328-r1-prepared-density1";
import { hydrateBusOrgaBookings } from "./bus-orga-bookings.js?v=20260829-m328-r1-native-actions1";
import { hydrateBusOrgaTripDetail } from "./bus-orga-trip-detail.js?v=20260829-m328-completion1";
import { hydrateBusOrgaTripEdit } from "./bus-orga-trip-edit.js?v=20260829-m328-r1-native-actions1&completion=20260829-m328-final1";

let registrationDecisionPlaceholder = null;

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function ensurePolishStyle() {
  if (document.getElementById("m328BusOrgaNativeActionsStyle")) return;
  const style = document.createElement("style");
  style.id = "m328BusOrgaNativeActionsStyle";
  style.textContent = `
    #m328QuickRegistrationTrip{
      height:44px!important;
      min-height:44px!important;
      line-height:1.25!important;
      padding-top:7px!important;
      padding-bottom:7px!important;
    }
    #m328TripsTitle{
      font-size:1.15rem!important;
    }
    .m328-next-trip-title{
      display:block;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .m328-reg3-submit-action{
      width:100%;
      min-height:46px;
    }
  `;
  document.head.appendChild(style);
}

function ensureRegistrationBookingUxStyle() {
  if (document.getElementById("m328RegistrationBookingUxStyle")) return;
  const style = document.createElement("style");
  style.id = "m328RegistrationBookingUxStyle";
  style.textContent = `
    .m328-reg3-special-actions{
      display:flex!important;
      flex-wrap:nowrap!important;
      align-items:center;
      gap:6px!important;
      overflow-x:auto;
      padding:8px 10px 9px 0;
      scroll-padding-right:10px;
      scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
    }
    .m328-reg3-special-actions::-webkit-scrollbar{
      display:none;
    }
    .m328-reg3-mode-filter{
      white-space:nowrap;
    }
    .m328-reg3-guest-grid{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
    .m328-reg3-guest-grid label:last-child{
      grid-column:1/-1!important;
    }
    .m328-reg3-booking{
      transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
    }
    .m328-reg3-booking.is-active-booking{
      border:3px solid var(--blue-700)!important;
      background:color-mix(in srgb,var(--warning) 9%,var(--surface));
      box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-700) 16%,transparent),0 10px 24px rgba(2,18,35,.08);
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-head{
      background:color-mix(in srgb,var(--warning) 15%,var(--surface));
      border-bottom-color:color-mix(in srgb,var(--warning) 38%,var(--line));
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-head strong{
      color:var(--blue-700);
    }
    .m328-reg3-booking.is-decision-booking{
      border:2px solid color-mix(in srgb,var(--accent) 55%,var(--line))!important;
      background:color-mix(in srgb,var(--accent) 4%,var(--surface));
    }
    .m328-reg3-booking:not(.is-active-booking){
      background:var(--surface);
      cursor:pointer;
    }
    .m328-reg3-booking.is-active-booking + .m328-reg3-booking{
      margin-top:8px;
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-head{
      padding-top:8px;
      padding-bottom:8px;
      background:var(--surface-soft);
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-person{
      display:none!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-overview{
      display:none!important;
    }
    .m328-reg3-booking-overview{display:grid;gap:0}
    .m328-reg3-booking-overview-person{display:grid;gap:2px;width:100%;padding:8px 10px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
    .m328-reg3-booking-overview-person:last-child{border-bottom:0}
    .m328-reg3-booking-overview-person strong{font-size:.78rem}
    .m328-reg3-booking-overview-person small{color:var(--muted);font-size:.67rem;line-height:1.35}
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-overview-person:hover,
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-overview-person:focus-visible{
      background:color-mix(in srgb,var(--accent) 7%,var(--surface));
      outline:2px solid color-mix(in srgb,var(--accent) 35%,transparent);
      outline-offset:-2px;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person{
      display:block!important;
      position:relative;
      margin:8px 10px 0;
      padding:0;
      overflow:hidden;
      border:1px solid var(--line)!important;
      border-radius:11px;
      background:var(--surface);
      cursor:pointer;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person:last-of-type{
      margin-bottom:8px;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person-name{
      display:grid;
      gap:2px;
      padding:9px 42px 3px 10px;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person:not(.is-editing) .m328-reg3-person-name small{
      display:none;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person:not(.is-editing)>label{
      display:none!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person.is-editing{
      cursor:default;
      background:color-mix(in srgb,var(--accent) 4%,var(--surface));
      border-color:color-mix(in srgb,var(--accent) 35%,var(--line))!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-person.is-editing>label{
      display:grid!important;
      margin:0 10px 8px;
    }
    .m328-reg3-active-person-summary{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:center;
      gap:8px;
      padding:0 10px 9px;
      color:var(--muted);
      font-size:.67rem;
      line-height:1.35;
    }
    .m328-reg3-active-person-summary-chevron{
      color:var(--accent);
      font-size:1rem;
      font-weight:900;
      line-height:1;
    }
    .m328-reg3-person.is-editing .m328-reg3-active-person-summary{
      display:none!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-remove{
      top:7px;
      right:7px;
    }
    .m328-reg3-booking-status{
      display:none;
      align-items:center;
      flex:0 0 auto;
      padding:3px 7px;
      border-radius:999px;
      background:var(--blue-700);
      color:#fff;
      font-size:.63rem;
      font-weight:850;
      line-height:1.15;
      white-space:nowrap;
    }
    .m328-reg3-booking:not(.is-active-booking):not(.is-decision-booking) .m328-reg3-booking-status-prepared,
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-status-active,
    .m328-reg3-booking.is-decision-booking .m328-reg3-booking-status-decision{
      display:inline-flex;
    }
    .m328-reg3-booking-status-prepared{
      border:1px solid var(--line);
      background:var(--surface);
      color:var(--ink-500);
    }
    .m328-reg3-booking-status-decision{
      background:color-mix(in srgb,var(--accent) 70%,#6b7280);
    }
    .m328-reg3-remove-booking{
      width:28px;
      min-width:28px;
      height:28px;
    }
    .m328-reg3-target-actions:empty{
      display:none!important;
    }
    .m328-reg3-target-actions[hidden]{
      display:none!important;
    }
    .m328-reg3-decision-backdrop{
      position:fixed;
      inset:0;
      z-index:1198;
      pointer-events:auto;
      background:rgba(2,18,35,.55);
      backdrop-filter:blur(2px);
    }
    .m328-reg3-target.is-decision-modal{
      position:fixed!important;
      left:50%;
      top:50%;
      z-index:1199;
      display:grid!important;
      width:min(460px,calc(100vw - 28px));
      max-height:calc(100dvh - 56px);
      margin:0!important;
      padding:18px!important;
      overflow:auto;
      transform:translate(-50%,-50%);
      border:1px solid var(--line);
      border-radius:16px;
      background:var(--surface)!important;
      box-shadow:0 24px 70px rgba(2,18,35,.28);
      gap:14px;
      align-items:stretch!important;
      pointer-events:auto;
    }
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy{
      gap:7px;
    }
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy strong{
      font-size:1rem;
    }
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy span{
      font-size:.8rem;
      line-height:1.45;
    }
    .m328-reg3-target.is-decision-modal .m328-reg3-target-actions{
      display:grid!important;
      grid-template-columns:1fr;
      gap:8px;
      width:100%;
    }
    .m328-reg3-target.is-decision-modal .m328-reg3-target-action{
      width:100%!important;
      min-height:42px;
    }
    body.m328-reg3-decision-open{
      overflow:hidden;
    }
    .m328-reg3-booking-complete{
      display:grid;
      gap:5px;
      padding:10px;
      border-top:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));
      background:color-mix(in srgb,var(--accent) 6%,var(--surface));
    }
    .m328-reg3-booking-complete-hint{
      margin:0;
      color:var(--muted);
      font-size:.67rem;
      line-height:1.35;
    }
    .m328-reg3-booking-complete .m328-reg3-booking-save{
      width:100%!important;
      min-height:40px;
      white-space:nowrap;
    }
    @media(max-width:520px){
      .m328-reg3-special-actions{
        grid-template-columns:1fr!important;
        display:flex!important;
        flex-wrap:nowrap!important;
      }
      .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-actions{
        flex-direction:row;
        align-items:center;
      }
    }
  `;
  document.head.appendChild(style);
}

function setupRegistrationBookingUx() {
  ensureRegistrationBookingUxStyle();
}

function splitRegistrationConsentAndSubmit() {
  const form = document.getElementById("m328Reg3Submit");
  if (!form || form.dataset.m328ConsentSubmitSplit === "true") return;
  const consent = form.querySelector(".m328-reg3-consent");
  const button = form.querySelector('button[type="submit"]');
  const panel = consent?.closest(".m328-reg3-panel");
  if (!consent || !button || !panel || !panel.contains(button)) return;
  form.dataset.m328ConsentSubmitSplit = "true";
  button.classList.add("m328-reg3-submit-action");
  panel.insertAdjacentElement("afterend", button);
}

function normalizeRegistrationSpecialActions() {
  const actions = [
    [document.querySelector('[data-m328-reg3-special="KNOWN"]'), "Bekannte Personen"],
    [document.querySelector('[data-m328-reg3-special="GUEST"]'), "Gast"],
    [document.querySelector('[data-m328-reg3-special="GROUP"]'), "Gruppe"]
  ];
  actions.forEach(([button, label]) => {
    if (!button) return;
    button.textContent = label;
    button.classList.remove("button", "secondary");
    button.classList.add("m328-reg3-filter", "m328-reg3-mode-filter");
  });
}

function portalRegistrationDecisionTarget(target) {
  if (target.parentElement === document.body) return;
  if (registrationDecisionPlaceholder?.parentNode) registrationDecisionPlaceholder.remove();
  registrationDecisionPlaceholder = document.createComment("m328-reg3-target-placeholder");
  target.parentNode?.insertBefore(registrationDecisionPlaceholder, target);
  document.body.appendChild(target);
}

function restoreRegistrationDecisionTarget(target) {
  if (!registrationDecisionPlaceholder?.parentNode) return;
  registrationDecisionPlaceholder.parentNode.insertBefore(target, registrationDecisionPlaceholder);
  registrationDecisionPlaceholder.remove();
  registrationDecisionPlaceholder = null;
}

function removeRegistrationDecisionBackdrop() {
  document.querySelector(".m328-reg3-decision-backdrop")?.remove();
  document.body.classList.remove("m328-reg3-decision-open");
}

function ensureRegistrationDecisionBackdrop() {
  if (!document.querySelector(".m328-reg3-decision-backdrop")) {
    const backdrop = document.createElement("div");
    backdrop.className = "m328-reg3-decision-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }
  document.body.classList.add("m328-reg3-decision-open");
}

function activeParticipantSummaryText(person) {
  const details = [];
  const sourceLabel = person.querySelector(".m328-reg3-person-name small")?.textContent?.trim();
  const stop = person.querySelector("[data-m328-reg3-stop]");
  const preference = person.querySelector("[data-m328-reg3-preference]");
  const note = person.querySelector("[data-m328-reg3-note]");
  const stopLabel = stop?.selectedOptions?.[0]?.textContent?.trim();
  const preferenceLabel = preference?.selectedOptions?.[0]?.textContent?.trim();
  const noteValue = note?.value?.trim();
  if (sourceLabel) details.push(sourceLabel);
  if (stopLabel) details.push(stopLabel);
  if (preferenceLabel) details.push(`Buswunsch: ${preferenceLabel}`);
  if (noteValue) details.push(`Hinweis: ${noteValue}`);
  return details.join(" · ") || "Antippen zum Bearbeiten";
}

function syncActiveParticipantSummary(person) {
  let summary = person.querySelector(".m328-reg3-active-person-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "m328-reg3-active-person-summary";
    const name = person.querySelector(".m328-reg3-person-name");
    name?.insertAdjacentElement("afterend", summary);
  }
  summary.replaceChildren();
  const text = document.createElement("span");
  text.textContent = activeParticipantSummaryText(person);
  const chevron = document.createElement("span");
  chevron.className = "m328-reg3-active-person-summary-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "›";
  summary.append(text, chevron);
}

function decorateActiveParticipantCards(activeBooking) {
  if (!activeBooking) return;
  activeBooking.querySelectorAll(".m328-reg3-person").forEach(person => {
    syncActiveParticipantSummary(person);
    if (person.dataset.m328CompactPersonBound === "true") return;
    person.dataset.m328CompactPersonBound = "true";
    person.tabIndex = 0;
    const openOnRender = person.dataset.m328Reg3OpenOnRender === "true";
    person.classList.toggle("is-editing", openOnRender);
    person.setAttribute("aria-expanded", String(openOnRender));
    delete person.dataset.m328Reg3OpenOnRender;

    const toggle = () => {
      const opening = !person.classList.contains("is-editing");
      activeBooking.querySelectorAll(".m328-reg3-person.is-editing").forEach(item => {
        if (item === person) return;
        item.classList.remove("is-editing");
        item.setAttribute("aria-expanded", "false");
      });
      person.classList.toggle("is-editing", opening);
      person.setAttribute("aria-expanded", String(opening));
      syncActiveParticipantSummary(person);
    };

    person.addEventListener("click", event => {
      event.stopPropagation();
      if (event.target.closest("button,input,select,textarea,a,label")) return;
      toggle();
    });
    person.addEventListener("keydown", event => {
      if (event.target !== person || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      toggle();
    });
    person.querySelectorAll("select,input").forEach(control => {
      control.addEventListener("change", () => syncActiveParticipantSummary(person));
      control.addEventListener("input", () => syncActiveParticipantSummary(person));
    });
  });
}

function syncRegistrationFlowPresentation() {
  const target = document.getElementById("m328Reg3Target");
  if (!target) {
    if (registrationDecisionPlaceholder?.parentNode) registrationDecisionPlaceholder.remove();
    registrationDecisionPlaceholder = null;
    removeRegistrationDecisionBackdrop();
    return;
  }

  const more = target.querySelector("[data-m328-reg3-target-more]");
  const complete = target.querySelector("[data-m328-reg3-target-complete]");
  const actions = target.querySelector(".m328-reg3-target-actions");
  const decision = Boolean(more);

  target.classList.toggle("is-decision-modal", decision);
  if (decision) {
    if (more && more.textContent !== "Weitere Person hinzufügen") more.textContent = "Weitere Person hinzufügen";
    if (complete) {
      complete.hidden = false;
      if (complete.textContent !== "Zur Übersicht") complete.textContent = "Zur Übersicht";
    }
    if (actions) actions.hidden = false;
    target.setAttribute("role", "dialog");
    target.setAttribute("aria-modal", "true");
    target.setAttribute("aria-label", "Buchung fortsetzen");
    ensureRegistrationDecisionBackdrop();
    portalRegistrationDecisionTarget(target);
    return;
  }

  restoreRegistrationDecisionTarget(target);
  target.removeAttribute("role");
  target.removeAttribute("aria-modal");
  target.removeAttribute("aria-label");
  removeRegistrationDecisionBackdrop();

  document.querySelectorAll(".m328-reg3-booking-complete").forEach(footer => footer.remove());
  const activeBooking = document.querySelector(".m328-reg3-booking.is-active-booking");
  if (!complete || !activeBooking) return;

  complete.hidden = true;
  if (actions) actions.hidden = true;

  const activeStatus = activeBooking.querySelector(".m328-reg3-booking-status-active");
  if (activeStatus) activeStatus.textContent = "Offen · wird bearbeitet";

  decorateActiveParticipantCards(activeBooking);

  const participantCount = activeBooking.querySelectorAll(".m328-reg3-person").length;
  const footer = document.createElement("div");
  footer.className = "m328-reg3-booking-complete";
  footer.innerHTML = `<p class="m328-reg3-booking-complete-hint">${participantCount > 1 ? "Diese Buchungsgruppe" : "Diese Buchung"} wird in die vorbereiteten Buchungen übernommen. Endgültig gespeichert wird weiterhin unten.</p>`;
  const saveButton = document.createElement("button");
  saveButton.className = "button primary m328-reg3-booking-save";
  saveButton.type = "button";
  saveButton.textContent = participantCount > 1 ? "Buchungsgruppe speichern" : "Buchung speichern";
  saveButton.addEventListener("click", () => complete.click());
  footer.appendChild(saveButton);
  activeBooking.appendChild(footer);
}

function setupRegistrationFlowPresentation() {
  const target = document.getElementById("m328Reg3Target");
  if (!target || target.dataset.m328FlowPresentationBound === "true") return;
  target.dataset.m328FlowPresentationBound = "true";
  const observer = new MutationObserver(() => queueMicrotask(syncRegistrationFlowPresentation));
  observer.observe(target, { childList: true, subtree: true });
  syncRegistrationFlowPresentation();
}

function normalizeBusOrgaHeader() {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  root.querySelector(".m328-bus-orga-kicker")?.remove();
  root.querySelector("#m328BusOrgaClose")?.remove();
  const head = root.querySelector(".m328-bus-orga-head");
  if (head) head.style.gridTemplateColumns = "auto minmax(0,1fr)";
  const title = root.querySelector(".m328-bus-orga-head h2");
  if (title) title.textContent = "Bus-Orga";
}

function normalizeNextTrip() {
  // renderNextTrip() in V2 is authoritative: it already skips cancelled trips
  // and renders the selected trip's venue. Do not overwrite it from the list below.
}

function normalizeTripManagementOverview() {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;

  const heading = root.querySelector("#m328TripsTitle");
  const headingWrap = heading?.closest(".m328-section-heading");
  headingWrap?.querySelector(".m328-section-kicker")?.remove();

  root.querySelectorAll(".m328-trip-card-meta span").forEach(item => {
    const text = String(item.textContent || "").trim();
    const participantMatch = /^(\d+)\s+TN$/.exec(text);
    if (participantMatch) {
      item.textContent = `${participantMatch[1]} Teilnehmer`;
      return;
    }
    const waitlistMatch = /^(\d+)\s+WL$/.exec(text);
    if (waitlistMatch) item.textContent = `${waitlistMatch[1]} Warteliste`;
  });
}

function clearRegistrationEntryFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) active.blur();
}

async function hydrateRegistrationWithoutAutofocus(context) {
  clearRegistrationEntryFocus();
  const result = await hydrateBusOrgaRegistrationV3(context);
  setupRegistrationBookingUx();
  splitRegistrationConsentAndSubmit();
  normalizeRegistrationSpecialActions();
  setupRegistrationFlowPresentation();
  clearRegistrationEntryFocus();
  requestAnimationFrame(clearRegistrationEntryFocus);
  setTimeout(clearRegistrationEntryFocus, 0);
  return result;
}

export async function hydrateBusOrgaV3(context = {}) {
  ensurePolishStyle();
  const view = routeParams().get("view");
  if (view === "registration") return hydrateRegistrationWithoutAutofocus(context);
  if (view === "bookings") return hydrateBusOrgaBookings(context);
  if (view === "trip-detail") return hydrateBusOrgaTripDetail(context);
  if (view === "trip-edit") return hydrateBusOrgaTripEdit(context);

  normalizeBusOrgaHeader();
  const result = await hydrateBusOrgaV2(context);
  if (context.isCurrent && !context.isCurrent()) return result;
  normalizeBusOrgaHeader();
  normalizeNextTrip();
  normalizeTripManagementOverview();
  return result;
}

export function noop() {}

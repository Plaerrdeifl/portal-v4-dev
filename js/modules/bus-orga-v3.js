import { hydrateBusOrgaV2 } from "./bus-orga-v2.js?v=20260829-m328-r1-next-trip-venue1";
import { hydrateBusOrgaRegistrationV3 } from "./bus-orga-registration-v3.js?v=20260829-m328-r1-registration-ux-correction1";
import { hydrateBusOrgaBookings } from "./bus-orga-bookings.js?v=20260829-m328-r1-native-actions1";
import { hydrateBusOrgaTripEdit } from "./bus-orga-trip-edit.js?v=20260829-m328-r1-native-actions1";

let registrationDecisionPlaceholder = null;

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function openTripEdit(tripId) {
  const params = new URLSearchParams({ view: "trip-edit", trip: String(tripId || "") });
  location.hash = `#/bus-orga?${params}`;
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
      border:2px solid var(--accent)!important;
      box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 10%,transparent);
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-head{
      background:color-mix(in srgb,var(--accent) 8%,var(--surface));
    }
    .m328-reg3-booking.is-decision-booking{
      border:2px solid color-mix(in srgb,var(--accent) 55%,var(--line))!important;
      background:color-mix(in srgb,var(--accent) 4%,var(--surface));
    }
    .m328-reg3-booking:not(.is-active-booking){
      background:var(--surface-2);
      cursor:pointer;
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-head{
      padding-top:8px;
      padding-bottom:8px;
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-person{
      display:none!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-overview{
      display:none!important;
    }
    .m328-reg3-booking-overview{display:grid;gap:0}
    .m328-reg3-booking-overview-person{display:grid;gap:2px;padding:8px 10px;border-bottom:1px solid var(--line)}
    .m328-reg3-booking-overview-person:last-child{border-bottom:0}
    .m328-reg3-booking-overview-person strong{font-size:.78rem}
    .m328-reg3-booking-overview-person small{color:var(--muted);font-size:.67rem;line-height:1.35}
    .m328-reg3-booking-status{
      display:none;
      align-items:center;
      width:max-content;
      margin-top:5px;
      padding:3px 7px;
      border-radius:999px;
      background:var(--accent);
      color:#fff;
      font-size:.63rem;
      font-weight:850;
      line-height:1.15;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-status-active,
    .m328-reg3-booking.is-decision-booking .m328-reg3-booking-status-decision{
      display:inline-flex;
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
      display:flex;
      justify-content:flex-end;
      padding:10px;
      border-top:1px solid var(--line);
      background:var(--surface);
    }
    .m328-reg3-booking-complete .m328-reg3-target-action{
      width:auto!important;
      min-height:36px;
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
      .m328-reg3-booking-complete{
        justify-content:stretch;
      }
      .m328-reg3-booking-complete .m328-reg3-target-action{
        width:100%!important;
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
  const decision = Boolean(more);

  target.classList.toggle("is-decision-modal", decision);
  if (decision) {
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

  const footer = document.createElement("div");
  footer.className = "m328-reg3-booking-complete";
  footer.appendChild(complete);
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

function bindNativeTripEdit() {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root || root.dataset.m328NativeTripEditBound === "true") return;
  root.dataset.m328NativeTripEditBound = "true";
  root.addEventListener("click", event => {
    const button = event.target.closest('[data-m328-trip-action="edit-trip"]');
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openTripEdit(button.dataset.tripId);
  }, true);
}

export async function hydrateBusOrgaV3(context = {}) {
  ensurePolishStyle();
  const view = routeParams().get("view");
  if (view === "registration") return hydrateRegistrationWithoutAutofocus(context);
  if (view === "bookings") return hydrateBusOrgaBookings(context);
  if (view === "trip-edit") return hydrateBusOrgaTripEdit(context);

  normalizeBusOrgaHeader();
  const result = await hydrateBusOrgaV2(context);
  if (context.isCurrent && !context.isCurrent()) return result;
  normalizeBusOrgaHeader();
  normalizeNextTrip();
  normalizeTripManagementOverview();
  bindNativeTripEdit();
  return result;
}

export function noop() {}

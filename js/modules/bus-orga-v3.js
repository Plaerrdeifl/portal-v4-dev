import { hydrateBusOrgaV2 } from "./bus-orga-v2.js?v=20260829-m328-r1-next-trip-venue1";
import { hydrateBusOrgaRegistrationV3 } from "./bus-orga-registration-v3.js?v=20260829-m328-r1-person-search1";
import { hydrateBusOrgaBookings } from "./bus-orga-bookings.js?v=20260829-m328-r1-native-actions1";
import { hydrateBusOrgaTripEdit } from "./bus-orga-trip-edit.js?v=20260829-m328-r1-native-actions1";

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
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:7px!important;
    }
    .m328-reg3-special-actions .button{
      width:100%;
      min-height:36px!important;
      padding:5px 8px!important;
      font-size:.72rem!important;
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
    @media(max-width:520px){
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
  const guest = document.querySelector('[data-m328-reg3-special="GUEST"]');
  const group = document.querySelector('[data-m328-reg3-special="GROUP"]');
  if (guest) guest.textContent = "Gast hinzufügen";
  if (group) group.textContent = "Gruppe auswählen";
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

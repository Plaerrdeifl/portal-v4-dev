import { hydrateBusOrgaV2 } from "./bus-orga-v2.js?v=20260829-m328-r1-native-actions1";
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
    .m328-reg3-booking:not(.is-active-booking){
      background:var(--surface-2);
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-head{
      padding-top:8px;
      padding-bottom:8px;
      border-bottom:0;
    }
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-person{
      display:none!important;
    }
    .m328-reg3-booking:not(.is-active-booking) [data-m328-reg3-add-to-booking]{
      display:none!important;
    }
    .m328-reg3-booking-status{
      display:inline-flex;
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
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-status{
      display:none;
    }
    .m328-reg3-booking-activate{
      min-height:30px!important;
      padding:4px 7px!important;
      font-size:.68rem!important;
    }
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-activate{
      display:none!important;
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

function registrationBookingId(card) {
  return card?.querySelector("[data-m328-reg3-add-to-booking]")?.dataset.m328Reg3AddToBooking
    || card?.querySelector("[data-m328-reg3-remove-booking]")?.dataset.m328Reg3RemoveBooking
    || "";
}

function setupRegistrationBookingUx() {
  const root = document.getElementById("m328BusOrgaPage");
  const stack = document.getElementById("m328Reg3Bookings");
  if (!root || !stack || stack.dataset.m328BookingUxBound === "true") return;
  stack.dataset.m328BookingUxBound = "true";
  ensureRegistrationBookingUxStyle();

  const ui = {
    activeBookingId: "",
    knownBookingIds: new Set(),
    syncing: false
  };

  const sync = ({ preferNewest = false } = {}) => {
    if (ui.syncing) return;
    ui.syncing = true;
    try {
      const cards = [...stack.querySelectorAll(".m328-reg3-booking")];
      const ids = cards.map(registrationBookingId).filter(Boolean);
      const newIds = ids.filter(id => !ui.knownBookingIds.has(id));

      if (preferNewest && newIds.length) ui.activeBookingId = newIds[newIds.length - 1];
      if (!ui.activeBookingId || !ids.includes(ui.activeBookingId)) {
        ui.activeBookingId = ids.at(-1) || "";
      }
      ui.knownBookingIds = new Set(ids);

      cards.forEach(card => {
        const id = registrationBookingId(card);
        const active = Boolean(id) && id === ui.activeBookingId;
        card.classList.toggle("is-active-booking", active);
        card.setAttribute("aria-current", active ? "true" : "false");

        const header = card.querySelector(".m328-reg3-booking-head");
        const copy = header?.firstElementChild;
        const actions = header?.querySelector(".m328-reg3-booking-actions");
        if (copy && !copy.querySelector(".m328-reg3-booking-status")) {
          const status = document.createElement("span");
          status.className = "m328-reg3-booking-status";
          status.textContent = "Wird bearbeitet";
          copy.appendChild(status);
        }
        if (actions && !actions.querySelector("[data-m328-booking-activate]")) {
          const activate = document.createElement("button");
          activate.className = "button tiny secondary m328-reg3-booking-activate";
          activate.type = "button";
          activate.dataset.m328BookingActivate = id;
          activate.textContent = "Bearbeiten";
          actions.prepend(activate);
        }
      });
    } finally {
      ui.syncing = false;
    }
  };

  stack.addEventListener("click", event => {
    const activate = event.target.closest("[data-m328-booking-activate]");
    if (activate && stack.contains(activate)) {
      event.preventDefault();
      ui.activeBookingId = activate.dataset.m328BookingActivate || "";
      sync();
      return;
    }

    const card = event.target.closest(".m328-reg3-booking");
    if (!card || !stack.contains(card)) return;
    const id = registrationBookingId(card);
    if (!id) return;

    if (event.target.closest("[data-m328-reg3-add-to-booking]")) {
      ui.activeBookingId = id;
      sync();
      return;
    }

    if (event.target.closest(".m328-reg3-booking-head") && !event.target.closest("button")) {
      ui.activeBookingId = id;
      sync();
    }
  }, true);

  const observer = new MutationObserver(() => sync({ preferNewest: true }));
  observer.observe(stack, { childList: true, subtree: true });
  sync({ preferNewest: true });
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
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  const title = root.querySelector(".m328-next-trip-title");
  if (!title) return;
  const trips = [...root.querySelectorAll("[data-m328-trip-card]")];
  const firstTripTitle = trips[0]?.querySelector(".m328-trip-summary-title")?.textContent?.trim();
  if (firstTripTitle) title.textContent = firstTripTitle;
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

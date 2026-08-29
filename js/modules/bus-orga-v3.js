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
  `;
  document.head.appendChild(style);
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

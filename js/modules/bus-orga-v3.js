import { hydrateBusOrgaV2 } from "./bus-orga-v2.js?v=20260829-m328-r1-native-actions1";
import { hydrateBusOrgaRegistrationV2 } from "./bus-orga-registration-v2.js?v=20260829-m328-r1-native-actions1";
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
  if (view === "registration") return hydrateBusOrgaRegistrationV2(context);
  if (view === "bookings") return hydrateBusOrgaBookings(context);
  if (view === "trip-edit") return hydrateBusOrgaTripEdit(context);

  normalizeBusOrgaHeader();
  const result = await hydrateBusOrgaV2(context);
  if (context.isCurrent && !context.isCurrent()) return result;
  normalizeBusOrgaHeader();
  bindNativeTripEdit();
  return result;
}

export function noop() {}

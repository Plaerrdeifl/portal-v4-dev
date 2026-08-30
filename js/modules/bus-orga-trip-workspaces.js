import { errorPanel, loading } from "./common.js";
import {
  backToTrip,
  ensureWorkspaceStyle,
  routeParams
} from "./bus-orga-workspace-base.js?v=20260830-m328-final-bus-management1";
import "./bus-orga-occupancy.js?v=20260830-m328-final-bus-management1";
import { hydrateAssignment } from "./bus-orga-assignment.js?v=20260830-m328-final-bus-management1";
import { hydrateBuses } from "./bus-orga-buses.js?v=20260830-m328-final-bus-management1";
import { hydrateOperations } from "./bus-orga-operations.js?v=20260830-m328-final-bus-management1";
import { hydrateParticipants } from "./bus-orga-participants.js?v=20260830-m328-final-bus-management1";

export async function hydrateBusOrgaTripWorkspace(context = {}) {
  ensureWorkspaceStyle();
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;

  const params = routeParams();
  const view = params.get("view") || "";
  const tripId = params.get("trip") || "";
  if (!tripId) {
    root.innerHTML = '<div class="notice error">Es wurde keine Fahrt ausgewählt.</div>';
    return;
  }

  root.innerHTML = loading("Arbeitsbereich wird geladen …");
  try {
    if (view === "participants") return await hydrateParticipants(root, tripId, context);
    if (view === "occupancy") return await hydrateBuses(root, tripId, context);
    if (view === "assignment") return await hydrateAssignment(root, tripId, context);
    if (view === "operations") return await hydrateOperations(root, tripId, context);
    throw new Error("Dieser Bus-Orga-Arbeitsbereich ist nicht verfügbar.");
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `${errorPanel(error, "Arbeitsbereich konnte nicht geladen werden")}<button class="button secondary" type="button" data-m328-workspace-load-back>← Fahrt</button>`;
    root.querySelector("[data-m328-workspace-load-back]")?.addEventListener("click", () => backToTrip(tripId));
  }
}

export function noop() {}

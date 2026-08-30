import { errorPanel, loading } from "./common.js";
import {
  backToBusOrga,
  ensureWorkspaceStyle,
  routeParams
} from "./bus-orga-workspace-base.js";
import { hydrateOccupancy } from "./bus-orga-occupancy.js";
import { hydrateOperations } from "./bus-orga-operations.js";
import { hydrateParticipants } from "./bus-orga-participants.js";

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
    if (view === "occupancy") return await hydrateOccupancy(root, tripId, context);
    if (view === "operations") return await hydrateOperations(root, tripId, context);
    throw new Error("Dieser Bus-Orga-Arbeitsbereich ist nicht verfügbar.");
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `${errorPanel(error, "Arbeitsbereich konnte nicht geladen werden")}<button class="button secondary" type="button" data-m328-workspace-load-back>← Bus-Orga</button>`;
    root.querySelector("[data-m328-workspace-load-back]")?.addEventListener("click", backToBusOrga);
  }
}

export function noop() {}

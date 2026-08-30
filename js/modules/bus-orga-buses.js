import { hydrateOccupancy } from "./bus-orga-occupancy.js?v=20260830-m328-final-bus-management1";

export async function hydrateBuses(root, tripId, context) {
  await hydrateOccupancy(root, tripId, context);
  if (context.isCurrent && !context.isCurrent()) return;
  root.querySelector("[data-m328-auto-assignment]")?.remove();
}

export function noop() {}

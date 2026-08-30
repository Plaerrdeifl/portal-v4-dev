import { setupM328RegistrationBookingUx } from "./bus-orga-registration-booking-ux.js?v=20260830-m328-registration-booking-ux1";

let flowWordingObserver = null;

function applyFlowWording() {
  const target = document.getElementById("m328Reg3Target");
  if (!target) {
    flowWordingObserver?.disconnect();
    flowWordingObserver = null;
    return;
  }

  const decisionAction = target.querySelector("[data-m328-reg3-target-more]");
  const completeAction =
    target.querySelector("[data-m328-reg3-target-complete]")
    || document.querySelector(".m328-reg3-booking-complete [data-m328-reg3-target-complete]");

  if (!completeAction || !decisionAction) return;

  const label = "Zur Übersicht";
  if (completeAction.textContent !== label) completeAction.textContent = label;
  if (completeAction.getAttribute("aria-label") !== label) completeAction.setAttribute("aria-label", label);
}

export function setupM328RegistrationFlowWording() {
  setupM328RegistrationBookingUx();
  if (!document.getElementById("m328Reg3Target")) return;

  flowWordingObserver?.disconnect();
  flowWordingObserver = new MutationObserver(() => queueMicrotask(applyFlowWording));
  flowWordingObserver.observe(document.body, { childList: true, subtree: true });
  applyFlowWording();
}

export function noop() {}

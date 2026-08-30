import { setupM328RegistrationBookingUx } from "./bus-orga-registration-booking-ux.js?v=20260830-m328-registration-booking-ux1";

let flowWordingObserver = null;

function ensureParticipantRemoveStyle() {
  if (document.getElementById("m328RegistrationParticipantRemoveStyle")) return;
  const style = document.createElement("style");
  style.id = "m328RegistrationParticipantRemoveStyle";
  style.textContent = `
    .m328-reg3-remove{
      color:var(--danger)!important;
      border-color:color-mix(in srgb,var(--danger) 32%,var(--line))!important;
      background:color-mix(in srgb,var(--danger) 8%,var(--surface))!important;
      font-weight:950!important;
    }
    .m328-reg3-remove:hover,
    .m328-reg3-remove:focus-visible{
      color:var(--danger)!important;
      border-color:color-mix(in srgb,var(--danger) 58%,var(--line))!important;
      background:color-mix(in srgb,var(--danger) 14%,var(--surface))!important;
    }
  `;
  document.head.appendChild(style);
}

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
  ensureParticipantRemoveStyle();
  if (!document.getElementById("m328Reg3Target")) return;

  flowWordingObserver?.disconnect();
  flowWordingObserver = new MutationObserver(() => queueMicrotask(applyFlowWording));
  flowWordingObserver.observe(document.body, { childList: true, subtree: true });
  applyFlowWording();
}

export function noop() {}

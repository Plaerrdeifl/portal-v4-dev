const RECORD_SELECTOR = "[data-m320-registration-record]";
const ASSIGNMENT_APPLY_ACTION = "fanbus_assignment_apply";
let pendingAssignmentRefresh = null;

function statusOf(record) {
  if (!(record instanceof HTMLElement)) return "";
  if (record.querySelector(".v4-m310-registration-cancelled")) return "CANCELLED";

  const label = record.querySelector(".v4-m310-registration-person .badge")?.textContent?.trim();
  if (label === "Warteliste") return "WAITLISTED";
  if (label === "Bestätigt") return "ACTIVE";
  return "";
}

function applyStatusTint(record) {
  const status = statusOf(record);
  if (!status) return;

  const presentation = {
    ACTIVE: {
      background: "color-mix(in srgb, var(--success) 4%, var(--surface))",
      border: "color-mix(in srgb, var(--success) 18%, var(--line))"
    },
    WAITLISTED: {
      background: "color-mix(in srgb, var(--warning) 6%, var(--surface))",
      border: "color-mix(in srgb, var(--warning) 24%, var(--line))"
    },
    CANCELLED: {
      background: "color-mix(in srgb, var(--danger) 4%, var(--surface-soft))",
      border: "color-mix(in srgb, var(--danger) 18%, var(--line))"
    }
  }[status];

  if (!presentation) return;
  record.dataset.m326RegistrationStatus = status;
  record.style.setProperty("background", presentation.background);
  record.style.setProperty("border-color", presentation.border);
  record.style.setProperty("transition", "background-color .16s ease, border-color .16s ease");
}

function scan(root = document) {
  if (root instanceof Element && root.matches(RECORD_SELECTOR)) applyStatusTint(root);
  root.querySelectorAll?.(RECORD_SELECTOR).forEach(applyStatusTint);
}

function participantTrigger(tripId) {
  if (!tripId) return null;
  return [...document.querySelectorAll(`[data-m310-participants="${CSS.escape(tripId)}"]`)]
    .find(button => button instanceof HTMLButtonElement && button.isConnected && !button.disabled)
    || null;
}

function bindStaleParticipantCleanup(dialog, freshContextId, staleContextId) {
  const handleClose = event => {
    if (event.detail?.contextId !== freshContextId) return;
    dialog.removeEventListener("v4dialogclose", handleClose);
    setTimeout(() => {
      if (dialog.open && dialog.dataset.v4DialogContext === staleContextId) {
        dialog.close();
      }
    }, 0);
  };
  dialog.addEventListener("v4dialogclose", handleClose);
}

function reopenFreshParticipantList(tripId, dialog) {
  const trigger = participantTrigger(tripId);
  if (!trigger) return false;

  const staleContextId = String(dialog.dataset.v4DialogContext || "");
  const observer = new MutationObserver(() => {
    if (!dialog.open) return;
    const contextId = String(dialog.dataset.v4DialogContext || "");
    const title = dialog.querySelector("#v4DialogTitle")?.textContent?.trim() || "";
    if (!contextId || contextId === staleContextId || title !== "Teilnehmer und Anmeldungen") return;
    observer.disconnect();
    bindStaleParticipantCleanup(dialog, contextId, staleContextId);
  });
  observer.observe(dialog, {
    attributes: true,
    attributeFilter: ["data-v4-dialog-context"],
    childList: true,
    subtree: true
  });

  trigger.click();
  setTimeout(() => observer.disconnect(), 5000);
  return true;
}

function refreshParticipantListAfterApply(pending, attempt = 0) {
  const dialog = document.getElementById("v4Dialog");
  const title = dialog?.querySelector("#v4DialogTitle")?.textContent?.trim() || "";
  const contextId = String(dialog?.dataset.v4DialogContext || "");

  if (dialog?.open
      && title === "Teilnehmer und Anmeldungen"
      && contextId
      && contextId !== pending.previewContextId) {
    reopenFreshParticipantList(pending.tripId, dialog);
    return;
  }

  if (attempt >= 20) return;
  setTimeout(() => refreshParticipantListAfterApply(pending, attempt + 1), 35);
}

function rememberAssignmentApply(event) {
  if (event.detail?.action !== ASSIGNMENT_APPLY_ACTION) return;
  const dialog = document.getElementById("v4Dialog");
  pendingAssignmentRefresh = {
    tripId: String(event.detail?.payload?.tripId || ""),
    previewContextId: String(dialog?.dataset.v4DialogContext || "")
  };
}

function scheduleAssignmentRefresh(event) {
  if (event.detail?.action !== ASSIGNMENT_APPLY_ACTION || !pendingAssignmentRefresh) return;
  const pending = pendingAssignmentRefresh;
  pendingAssignmentRefresh = null;
  setTimeout(() => refreshParticipantListAfterApply(pending), 0);
}

scan();

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scan(node);
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("pd-api-before-call", rememberAssignmentApply);
window.addEventListener("pd-api-after-call", scheduleAssignmentRefresh);

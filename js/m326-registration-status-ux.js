const RECORD_SELECTOR = "[data-m320-registration-record]";

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

scan();

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node instanceof Element) scan(node);
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

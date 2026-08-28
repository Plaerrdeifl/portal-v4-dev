export function isM327SeparatorOnly(value) {
  const text = String(value || "").trim();
  return !text || /^[\s•·|/\\–—-]+$/u.test(text);
}

export function normalizeM327PhoneHref(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D/g, "");
  return text.startsWith("+") ? `+${digits}` : digits;
}

function contactValue(li, label) {
  const existingLink = li.querySelector("a");
  if (existingLink) return existingLink.textContent?.trim() || "";

  return [...li.childNodes]
    .filter(node => node !== label)
    .map(node => node.textContent || "")
    .join("")
    .trim();
}

function polishContact(section) {
  if (!section || section.dataset.m327AcceptancePolished === "true") return;
  section.dataset.m327AcceptancePolished = "true";

  if (section.getAttribute("aria-label") === "BUS_ORGA-Kontakt") {
    section.setAttribute("aria-label", "Bus-Orga-Kontakt");
  }

  const heading = section.querySelector("strong");
  if (heading?.textContent?.trim() === "BUS_ORGA kontaktieren") {
    heading.textContent = "Bus-Orga kontaktieren";
  }

  section.querySelectorAll("p").forEach(paragraph => {
    if (paragraph.textContent?.includes("BUS_ORGA")) {
      paragraph.textContent = paragraph.textContent.replaceAll("BUS_ORGA", "Bus-Orga");
    }
  });

  section.querySelectorAll("li").forEach(li => {
    const labelElement = li.querySelector("span");
    if (!labelElement) return;

    const value = contactValue(li, labelElement);
    if (!value) return;

    const isEmail = value.includes("@");
    const configuredLabel = String(labelElement.textContent || "")
      .replace(/:\s*$/, "")
      .trim();
    const label = isEmail && configuredLabel.toUpperCase() === "BUS_ORGA"
      ? "E-Mail"
      : configuredLabel || (isEmail ? "E-Mail" : "Telefon");

    const link = document.createElement("a");
    link.href = isEmail ? `mailto:${value}` : `tel:${normalizeM327PhoneHref(value)}`;
    link.textContent = value;

    labelElement.textContent = `${label}:`;
    li.replaceChildren(labelElement, document.createTextNode(" "), link);
  });
}

function polishBookingCard(card) {
  if (!card) return;

  const header = card.querySelector(".m327-booking-head");
  if (header) {
    const content = header.firstElementChild;
    const statusBadge = header.querySelector(":scope > .badge");
    if (content instanceof HTMLElement) content.style.minWidth = "0";
    if (statusBadge instanceof HTMLElement) {
      statusBadge.style.whiteSpace = "nowrap";
      statusBadge.style.flex = "0 0 auto";
    }
  }

  card.querySelectorAll(".m327-booking-meta > div").forEach(item => {
    const term = item.querySelector("dt");
    const value = item.querySelector("dd");
    if (
      term?.textContent?.trim() === "Abfahrt"
      && value
      && isM327SeparatorOnly(value.textContent)
    ) {
      value.textContent = "Noch nicht festgelegt";
    }
  });

  card.querySelectorAll(".m327-contact-block").forEach(polishContact);
}

function polish(root = document) {
  if (root.matches?.(".m327-booking-card")) polishBookingCard(root);
  if (root.matches?.(".m327-contact-block, #m327GuestOrganizationContact")) {
    polishContact(root);
  }
  root.querySelectorAll?.(".m327-booking-card").forEach(polishBookingCard);
  root.querySelectorAll?.(".m327-contact-block, #m327GuestOrganizationContact")
    .forEach(polishContact);
}

let observer;

export function setupM327AcceptancePolish() {
  polish(document);
  if (observer) return;

  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        polish(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

if (
  typeof document !== "undefined"
  && document.documentElement.dataset.route === "fanbus-registration"
) {
  setupM327AcceptancePolish();
}

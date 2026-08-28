export function isM327SeparatorOnly(value) {
  const text = String(value || "").trim();
  return !text || /^[\s•·|/\\–—-]+$/u.test(text);
}

export function normalizeM327PhoneHref(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D/g, "");
  return text.startsWith("+") ? `+${digits}` : digits;
}

export function m327UserFacingContactText(value) {
  return String(value || "").replaceAll("BUS_ORGA", "Bus-Orga");
}

export function m327ContactLabel(configuredLabel, isEmail) {
  const label = String(configuredLabel || "")
    .replace(/:\s*$/, "")
    .trim();
  if (isEmail && label.toUpperCase() === "BUS_ORGA") return "E-Mail";
  return label || (isEmail ? "E-Mail" : "Telefon");
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
  if (heading?.textContent?.includes("BUS_ORGA")) {
    heading.textContent = m327UserFacingContactText(heading.textContent);
  }

  section.querySelectorAll("p").forEach(paragraph => {
    if (paragraph.textContent?.includes("BUS_ORGA")) {
      paragraph.textContent = m327UserFacingContactText(paragraph.textContent);
    }
  });

  section.querySelectorAll("li").forEach(li => {
    const labelElement = li.querySelector("span");
    if (!labelElement) return;

    const value = contactValue(li, labelElement);
    if (!value) return;

    const isEmail = value.includes("@");
    const label = m327ContactLabel(labelElement.textContent, isEmail);

    const link = document.createElement("a");
    link.href = isEmail ? `mailto:${value}` : `tel:${normalizeM327PhoneHref(value)}`;
    link.textContent = value;

    labelElement.textContent = `${label}:`;
    li.replaceChildren(labelElement, document.createTextNode(" "), link);
  });
}

const M327_ACCORDION_STYLE_ID = "m327-booking-accordion-style";
let accordionCounter = 0;

function ensureAccordionStyles() {
  if (document.getElementById(M327_ACCORDION_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = M327_ACCORDION_STYLE_ID;
  style.textContent = `
    #m327MyBookingsPanel .m327-booking-card[data-m327-accordion="true"]{
      gap:0;
      padding:0;
    }
    #m327MyBookingsPanel .m327-booking-toggle{
      cursor:pointer;
      margin:0;
      padding:10px 12px;
      user-select:none;
      outline:none;
    }
    #m327MyBookingsPanel .m327-booking-toggle:focus-visible{
      box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--blue-700) 38%,transparent);
    }
    #m327MyBookingsPanel .m327-booking-toggle .m327-booking-chevron{
      flex:0 0 auto;
      display:inline-grid;
      place-items:center;
      width:22px;
      height:22px;
      border-radius:999px;
      color:var(--ink-500);
      font-size:1.05rem;
      font-weight:900;
      line-height:1;
      transition:transform .16s ease;
    }
    #m327MyBookingsPanel .m327-booking-card[data-m327-expanded="true"] .m327-booking-chevron{
      transform:rotate(90deg);
    }
    #m327MyBookingsPanel .m327-booking-expanded{
      display:grid;
      gap:8px;
      padding:9px 12px 12px;
      border-top:1px solid var(--line);
    }
    #m327MyBookingsPanel .m327-booking-expanded[hidden]{
      display:none!important;
    }
    @media(max-width:700px){
      #m327MyBookingsPanel .m327-booking-toggle{
        padding:9px 10px;
      }
      #m327MyBookingsPanel .m327-booking-expanded{
        gap:7px;
        padding:8px 10px 10px;
      }
      #m327MyBookingsPanel .m327-booking-group{
        gap:7px;
      }
    }
  `;
  document.head.append(style);
}

function setBookingExpanded(card, expanded) {
  const header = card.querySelector(":scope > .m327-booking-toggle");
  const body = card.querySelector(":scope > .m327-booking-expanded");
  if (!header || !body) return;
  card.dataset.m327Expanded = expanded ? "true" : "false";
  header.setAttribute("aria-expanded", expanded ? "true" : "false");
  body.hidden = !expanded;
}

function ensureBookingAccordion(card) {
  if (!card || card.dataset.m327Accordion === "true") return;
  const header = card.querySelector(":scope > .m327-booking-head");
  if (!header) return;

  card.dataset.m327Accordion = "true";
  card.dataset.m327Expanded = "false";

  const body = document.createElement("div");
  body.className = "m327-booking-expanded";
  body.id = `m327-booking-expanded-${++accordionCounter}`;
  body.hidden = true;

  let sibling = header.nextSibling;
  while (sibling) {
    const next = sibling.nextSibling;
    body.append(sibling);
    sibling = next;
  }
  card.append(body);

  header.classList.add("m327-booking-toggle");
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.setAttribute("aria-expanded", "false");
  header.setAttribute("aria-controls", body.id);
  header.setAttribute("aria-label", "Buchungsdetails öffnen oder schließen");

  const chevron = document.createElement("span");
  chevron.className = "m327-booking-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "›";
  header.append(chevron);

  const toggle = () => setBookingExpanded(card, card.dataset.m327Expanded !== "true");
  header.addEventListener("click", event => {
    if (event.target.closest("button,a,input,select,textarea")) return;
    toggle();
  });
  header.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
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
  ensureBookingAccordion(card);
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
  ensureAccordionStyles();
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

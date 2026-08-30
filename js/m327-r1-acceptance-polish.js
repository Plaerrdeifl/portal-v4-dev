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
      transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease;
    }
    #m327MyBookingsPanel .m327-booking-card[data-m327-expanded="true"]:not([data-m327-booking-cancelled="true"]){
      background:#f7fbff;
      border-color:color-mix(in srgb,var(--blue-700) 20%,var(--line));
      box-shadow:0 0 0 1px color-mix(in srgb,var(--blue-700) 7%,transparent);
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
    #m327MyBookingsPanel .m327-booking-overview{
      display:grid;
      gap:2px;
      min-width:0;
      margin-top:4px;
      color:var(--ink-500);
      font-size:.76rem;
      font-weight:750;
      line-height:1.25;
    }
    #m327MyBookingsPanel .m327-booking-overview-line{
      display:block;
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #m327MyBookingsPanel .m327-booking-overview-line[data-tone="cancelled"]{
      color:var(--danger);
    }
    #m327MyBookingsPanel .m327-booking-card[data-m327-booking-cancelled="true"] .m327-booking-overview{
      color:var(--danger);
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

    #m310FanbusActionMenu.m327-personal-fanbus-panel{
      left:0!important;
      right:auto!important;
      width:min(250px,calc(100vw - 32px))!important;
      max-width:min(250px,calc(100vw - 32px));
      padding:5px;
      border-radius:14px;
    }
    #m310FanbusActionMenu.m327-personal-fanbus-panel > button{
      min-height:39px;
      padding:8px 10px;
      border-radius:9px;
      font-size:.84rem;
      line-height:1.2;
    }

    .v4-m325-companion-workspace{
      gap:10px;
    }
    .v4-m325-companion-workspace > .v4-m325-workspace-header{
      align-items:flex-start;
      gap:9px;
    }
    .v4-m325-companion-workspace > .v4-m325-workspace-header > .button{
      flex:0 0 auto;
      width:auto!important;
      min-height:34px;
      padding:6px 9px;
      margin:0;
      line-height:1.1;
    }
    .v4-m325-companion-workspace > .v4-m325-workspace-header h2{
      margin:0;
      font-size:1.18rem;
      line-height:1.08;
    }
    .v4-m325-companion-workspace > .v4-m325-workspace-header p{
      margin:3px 0 0;
      font-size:.79rem;
      line-height:1.28;
    }
    .v4-m325-companion-workspace .v4-m325-workspace-section{
      gap:7px;
    }
    .v4-m325-companion-workspace .v4-m325-workspace-section > h3{
      font-size:1.02rem;
      line-height:1.15;
    }
    .v4-m325-companion-workspace .v4-m325-list-card{
      gap:7px;
      padding:10px!important;
      border-radius:14px;
    }
    .v4-m325-companion-workspace .v4-m325-record-copy{
      gap:2px;
    }
    .v4-m325-companion-workspace .v4-m325-record-copy > strong,
    .v4-m325-companion-workspace .v4-m325-person-title > strong{
      font-size:.94rem;
      line-height:1.15;
    }
    .v4-m325-companion-workspace .v4-m325-record-copy > small{
      font-size:.76rem;
      line-height:1.25;
    }
    .v4-m325-companion-workspace .v4-m325-list-actions,
    .v4-m325-companion-workspace .v4-m325-member-actions{
      display:grid;
      width:100%;
      gap:6px;
    }
    .v4-m325-companion-workspace .v4-m325-list-actions{
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
    .v4-m325-companion-workspace .v4-m325-member{
      gap:7px;
      padding-top:9px;
    }
    .v4-m325-companion-workspace .v4-m325-member-actions{
      grid-template-columns:40px 40px minmax(0,1fr);
    }
    .v4-m325-companion-workspace .v4-m325-list-actions .button,
    .v4-m325-companion-workspace .v4-m325-member-actions .button{
      width:100%!important;
      min-width:0;
      min-height:35px;
      padding:6px 8px;
      font-size:.75rem;
      line-height:1.15;
    }
    .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-move-member]{
      padding-inline:0;
    }
    .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-unlink-person],
    .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-link-person]{
      grid-column:1 / span 2;
    }
    .v4-m325-companion-workspace .v4-m325-new-list{
      padding:10px 0 0;
      border-top:1px solid var(--line);
    }
    .v4-m325-companion-workspace .v4-m325-new-list form{
      gap:7px;
    }
    .v4-m325-companion-workspace .v4-m325-new-list .button{
      width:auto!important;
      min-height:36px;
      padding:7px 10px;
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
      #m310FanbusActionMenu.m327-personal-fanbus-panel{
        width:min(238px,calc(100vw - 30px))!important;
      }
    }

    @media(max-width:430px){
      .v4-m325-companion-workspace > .v4-m325-workspace-header{
        align-items:flex-start;
      }
      .v4-m325-companion-workspace .v4-m325-list-actions .button,
      .v4-m325-companion-workspace .v4-m325-member-actions .button{
        flex:none;
        width:100%!important;
        padding-inline:7px;
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

function bookingParticipantOverview(card) {
  const participants = [...card.querySelectorAll(":scope > .m327-participants > .m327-participant")]
    .map(row => {
      const header = row.querySelector(":scope > header");
      const badges = [...(header?.querySelectorAll("div .badge") || [])];
      return {
        name: String(header?.querySelector("strong")?.textContent || "").trim(),
        status: String(header?.querySelector(":scope > .badge")?.textContent || "").trim(),
        primary: badges.some(badge => badge.textContent?.trim() === "Hauptperson"),
        self: badges.some(badge => badge.textContent?.trim() === "Du")
      };
    });

  if (!participants.length) return null;

  const current = participants.filter(item => item.status !== "Storniert");
  const cancelled = participants.filter(item => item.status === "Storniert");
  const allCancelled = current.length === 0 && cancelled.length === participants.length;
  const source = current.length ? current : participants;
  const lead = source.find(item => item.self)
    || source.find(item => item.primary)
    || source[0];
  const companions = current.length
    ? current.filter(item => item !== lead)
    : [];
  const leadText = lead?.name || `${source.length} ${source.length === 1 ? "Person" : "Personen"}`;

  if (allCancelled) {
    return {
      lines: [{ text: `${leadText} · ${cancelled.length} storniert`, tone: "cancelled" }],
      allCancelled
    };
  }

  const lines = [];
  if (companions.length === 1 && companions[0].name) {
    lines.push({ text: `${leadText} + ${companions[0].name}`, tone: "normal" });
  } else {
    lines.push({ text: leadText, tone: "normal" });
    if (companions.length > 1) {
      companions.forEach(item => {
        if (item.name) lines.push({ text: `Mitfahrer: ${item.name}`, tone: "normal" });
      });
    }
  }
  if (cancelled.length) {
    lines.push({ text: `${cancelled.length} storniert`, tone: "cancelled" });
  }

  return { lines, allCancelled };
}

function ensureBookingOverview(card, header) {
  const content = header?.firstElementChild;
  if (!(content instanceof HTMLElement)) return;
  const overview = bookingParticipantOverview(card);
  if (!overview) return;

  let summary = content.querySelector(":scope > .m327-booking-overview");
  if (!summary) {
    summary = document.createElement("small");
    summary.className = "m327-booking-overview";
    content.append(summary);
  }

  const rows = overview.lines.map(line => {
    const row = document.createElement("span");
    row.className = "m327-booking-overview-line";
    row.dataset.tone = line.tone;
    row.textContent = line.text;
    return row;
  });
  summary.replaceChildren(...rows);
  card.dataset.m327BookingCancelled = overview.allCancelled ? "true" : "false";

  const statusBadge = header.querySelector(":scope > .badge");
  if (
    overview.allCancelled
    && statusBadge
    && statusBadge.textContent?.trim() !== "Abgesagt"
  ) {
    statusBadge.textContent = "Buchung storniert";
    statusBadge.className = "badge danger m327-booking-cancelled";
  }
}

function ensureBookingAccordion(card) {
  if (!card || card.dataset.m327Accordion === "true") return;
  const header = card.querySelector(":scope > .m327-booking-head");
  if (!header) return;

  ensureBookingOverview(card, header);
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

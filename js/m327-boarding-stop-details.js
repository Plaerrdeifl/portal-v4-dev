import { call, hasCapability } from "./modules/common.js";

const STYLE_ID = "m327BoardingStopDetailsStyles";
const DETAIL_SELECTOR = "[data-m310-inline-trip-detail]";
const STOP_SELECTOR = ".v4-m325-trip-stops";
const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
let scanScheduled = false;

function cleanText(value) {
  return String(value || "").trim();
}

export function m327StructuredNoteParts(value) {
  const clean = cleanText(value);
  if (!clean) return null;

  const match = /^(Infos\s*&\s*telefonische\s+Anmeldung|Fragen\s*&\s*Anmeldung)\s*:\s*([\s\S]*)$/i.exec(clean);
  if (!match) return { label: "", value: clean, contact: null };

  const noteValue = cleanText(match[2]);
  const contactMatch = /^([^:\n]{1,80})\s*:\s*(\+?\d[\d\s()/.-]{5,}\d)$/.exec(noteValue);
  return {
    label: `${cleanText(match[1])}:`,
    value: noteValue,
    contact: contactMatch
      ? { name: cleanText(contactMatch[1]), phone: cleanText(contactMatch[2]) }
      : null
  };
}

function timeLabel(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? TIME_FORMAT.format(date) : "Zeit offen";
}

function stopMainLabel(stop) {
  const label = cleanText(stop?.label) || "Zustieg";
  return `${timeLabel(stop?.departureAt)} · ${label}`;
}

function createLine(className, text) {
  const line = document.createElement("span");
  line.className = className;
  line.textContent = text;
  return line;
}

function appendStructuredNote(item, className, text) {
  const parts = m327StructuredNoteParts(text);
  if (!parts) return;

  const line = document.createElement("span");
  line.className = className;

  if (parts.label) {
    const label = document.createElement("span");
    label.className = "m327-trip-stop-note-label";
    label.textContent = parts.label;
    line.append(label);
  }

  if (parts.contact) {
    const contact = document.createElement("span");
    contact.className = "m327-trip-stop-contact-line";

    const name = document.createElement("span");
    name.className = "m327-trip-stop-contact-name";
    name.textContent = `${parts.contact.name} ·`;
    contact.append(name);

    const phone = document.createElement("span");
    phone.className = "m327-trip-stop-contact-phone";
    phone.textContent = parts.contact.phone;
    contact.append(phone);
    line.append(contact);
  } else if (parts.value) {
    const value = document.createElement("span");
    value.className = "m327-trip-stop-note-value";
    value.textContent = parts.value;
    line.append(value);
  }

  item.append(line);
}

function renderStops(container, stops) {
  if (!(container instanceof HTMLElement) || !Array.isArray(stops) || !stops.length) return;

  const heading = document.createElement("span");
  heading.className = "m327-trip-stops-heading";
  heading.textContent = "Zustiegsorte";

  const list = document.createElement("div");
  list.className = "m327-trip-stop-details";

  for (const stop of stops) {
    const item = document.createElement("div");
    item.className = "m327-trip-stop-detail";

    const main = document.createElement("strong");
    main.className = "m327-trip-stop-main";
    main.textContent = stopMainLabel(stop);
    item.append(main);

    const address = cleanText(stop?.address);
    if (address) item.append(createLine("m327-trip-stop-address", address));

    appendStructuredNote(item, "m327-trip-stop-note", cleanText(stop?.defaultNote));

    list.append(item);
  }

  container.replaceChildren(heading, list);
  container.classList.add("m327-trip-stops-enhanced");
}

async function hydrateDetail(detail) {
  if (!(detail instanceof HTMLElement) || detail.dataset.m327StopDetailsState) return;
  const tripId = cleanText(detail.dataset.m310InlineTripDetail);
  const container = detail.querySelector(STOP_SELECTOR);
  if (!tripId || !(container instanceof HTMLElement)) return;

  detail.dataset.m327StopDetailsState = "loading";
  const internal = hasCapability("fanbus.manage") || hasCapability("fanbus.registrations.manage");

  try {
    const data = internal
      ? await call("fanbus_trip_boarding_stops_list", { tripId })
      : await call("fanbus_trip_boarding_stops_public", { tripId });
    if (!detail.isConnected) return;
    const currentContainer = detail.querySelector(STOP_SELECTOR);
    renderStops(currentContainer, Array.isArray(data?.stops) ? data.stops : []);
    detail.dataset.m327StopDetailsState = "ready";
  } catch {
    // Die vorhandene kompakte Zeit-/Namensanzeige bleibt als Fallback erhalten.
    detail.dataset.m327StopDetailsState = "fallback";
  }
}

function scan() {
  for (const detail of document.querySelectorAll(DETAIL_SELECTOR)) {
    if (detail.querySelector(STOP_SELECTOR)) void hydrateDetail(detail);
  }
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scan();
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .v4-m325-trip-stops.m327-trip-stops-enhanced{display:grid;gap:6px}
    .m327-trip-stops-heading{font-size:.78rem;font-weight:800;letter-spacing:.08em;color:var(--muted,#718096);text-transform:uppercase}
    .m327-trip-stop-details{display:grid;gap:0;border-radius:12px;background:var(--surface-soft,#f5f7fa);overflow:hidden}
    .m327-trip-stop-detail{display:grid;gap:2px;padding:9px 11px;min-width:0}
    .m327-trip-stop-detail+.m327-trip-stop-detail{border-top:1px solid var(--line,#d8e2ee)}
    .m327-trip-stop-main{font-size:.96rem;line-height:1.28;overflow-wrap:anywhere}
    .m327-trip-stop-address,.m327-trip-stop-note{font-size:.78rem;line-height:1.32;overflow-wrap:break-word;word-break:normal;text-transform:none}
    .m327-trip-stop-address{color:var(--muted,#718096)}
    .m327-trip-stop-note{display:grid;gap:1px;color:var(--text,#102a43)}
    .m327-trip-stop-note-label{display:block;font-weight:750}
    .m327-trip-stop-note-value{display:block;font-weight:550;white-space:pre-line}
    .m327-trip-stop-contact-line{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:.35em;font-weight:550;min-width:0}
    .m327-trip-stop-contact-name{white-space:nowrap}
    .m327-trip-stop-contact-phone{white-space:nowrap;overflow-wrap:normal;word-break:normal;font-variant-numeric:tabular-nums}
    @media(max-width:620px){
      .v4-m325-trip-stops.m327-trip-stops-enhanced{gap:5px}
      .m327-trip-stop-details{border-radius:11px}
      .m327-trip-stop-detail{padding:8px 10px}
      .m327-trip-stop-main{font-size:.9rem}
      .m327-trip-stop-address,.m327-trip-stop-note{font-size:.73rem}
    }
  `;
  document.head.append(style);
}

export function setupM327BoardingStopDetails() {
  if (typeof document === "undefined") return;
  injectStyles();
  scan();
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

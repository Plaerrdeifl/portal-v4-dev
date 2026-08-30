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

function normalizedText(value) {
  return cleanText(value).replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
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

    const defaultNote = cleanText(stop?.defaultNote);
    const tripNote = cleanText(stop?.tripNote);
    if (defaultNote) {
      item.append(createLine("m327-trip-stop-note", `Hinweis: ${defaultNote}`));
    }
    if (tripNote && normalizedText(tripNote) !== normalizedText(defaultNote)) {
      item.append(createLine("m327-trip-stop-note m327-trip-stop-trip-note", `Fahrthinweis: ${tripNote}`));
    }

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
    .m327-trip-stop-address,.m327-trip-stop-note{font-size:.78rem;line-height:1.32;overflow-wrap:anywhere}
    .m327-trip-stop-address{color:var(--muted,#718096)}
    .m327-trip-stop-note{color:var(--text,#102a43)}
    .m327-trip-stop-trip-note{font-weight:650}
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

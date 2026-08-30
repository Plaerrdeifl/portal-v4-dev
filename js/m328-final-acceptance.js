import { api } from "./api.js";

const CHILD_VIEWS = new Set(["bookings", "participants", "occupancy", "operations", "trip-edit"]);
const BACK_SELECTOR = [
  "#m328BookingsBack",
  "#m328TripEditBack",
  "#m328TripEditLoadBack",
  "[data-m328-workspace-back]",
  "[data-m328-workspace-load-back]"
].join(",");

let participantSyncKey = "";
let participantSyncPromise = null;
let scheduled = false;

function routeState() {
  const hash = String(location.hash || "");
  const [path, query = ""] = hash.split("?", 2);
  const params = new URLSearchParams(query);
  return {
    path,
    view: params.get("view") || "",
    tripId: params.get("trip") || ""
  };
}

function tripDetailRoute(tripId) {
  const params = new URLSearchParams({ view: "trip-detail", trip: String(tripId || "") });
  return `#/bus-orga?${params}`;
}

function ensureStyle() {
  if (document.getElementById("m328FinalAcceptanceStyle")) return;
  const style = document.createElement("style");
  style.id = "m328FinalAcceptanceStyle";
  style.textContent = `
    .m328-final-filter-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .m328-final-quick-filter{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 9px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink-800);font-size:.69rem;font-weight:750;cursor:pointer}
    .m328-final-quick-filter input{width:16px!important;height:16px!important;min-height:0!important;margin:0;flex:0 0 auto}
    .m328-final-booking-filter{margin:0}.m328-final-booking-filter>summary{width:max-content;min-height:34px;padding:6px 10px;font-size:.72rem;list-style:none}.m328-final-booking-filter>summary::-webkit-details-marker{display:none}
    .m328-final-booking-filter-body{display:grid;gap:4px;min-width:170px;margin-top:6px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);font-size:.68rem;font-weight:750}
    .m328-final-booking-filter-body select{width:100%;min-height:36px}
    .m328-final-booking-tools-row{display:flex;align-items:center;justify-content:space-between;gap:8px;grid-column:1/-1}
    .m328-bookings-tools.m328-final-booking-tools{grid-template-columns:1fr!important}.m328-bookings-tools.m328-final-booking-tools #m328BookingSearch{grid-column:1/-1}
    .m328-operation-filters.m328-final-operation-filters{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
    .m328-operation-filters.m328-final-operation-filters label{display:grid!important;grid-column:auto!important;gap:3px!important;margin:0!important;padding:0!important;font-size:.68rem!important;font-weight:750!important}
    .m328-operation-filters.m328-final-operation-filters label:first-child{grid-column:1/-1!important}
    .m328-operation-filters.m328-final-operation-filters input,.m328-operation-filters.m328-final-operation-filters select{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;min-height:39px!important;margin:0!important}
    .m328-auto-assignment{white-space:normal!important;overflow:hidden!important}.m328-auto-assignment>span:first-child{min-width:0!important}.m328-auto-assignment small{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
    @media(max-width:360px){.m328-operation-filters.m328-final-operation-filters{grid-template-columns:1fr!important}.m328-operation-filters.m328-final-operation-filters label:first-child{grid-column:auto!important}.m328-final-booking-tools-row{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function normalizeBackButtons() {
  const route = routeState();
  if (route.path !== "#/bus-orga" || !route.tripId || !CHILD_VIEWS.has(route.view)) return;
  document.querySelectorAll(BACK_SELECTOR).forEach(button => {
    if (button.textContent !== "← Fahrt") button.textContent = "← Fahrt";
    button.setAttribute("aria-label", "Zur Fahrtdetailseite");
  });
}

function polishTripDetail() {
  const route = routeState();
  if (route.view !== "trip-detail") return;
  const bookings = document.querySelector('[data-trip-detail-action="bookings"]');
  if (bookings) {
    bookings.classList.remove("primary");
    bookings.classList.add("secondary");
  }
  const buses = document.querySelector('[data-trip-detail-action="occupancy"]');
  if (buses && buses.textContent !== "Busse") buses.textContent = "Busse";
}

function ensureParticipantQuickFilter() {
  const form = document.querySelector("[data-m328-participant-filter]");
  if (!form || form.querySelector("[data-m328-hide-cancelled]")) return;
  const details = form.querySelector(".m328-participant-filters");
  if (!details) return;
  const row = document.createElement("div");
  row.className = "m328-final-filter-row";
  details.before(row);
  row.append(details);
  const quick = document.createElement("label");
  quick.className = "m328-final-quick-filter";
  quick.innerHTML = '<input type="checkbox" data-m328-hide-cancelled checked><span>Stornierte ausblenden</span>';
  row.append(quick);
}

function participantCards() {
  return [...document.querySelectorAll(".m328-participants [data-m328-participant-id]")];
}

function applyParticipantFilters() {
  const form = document.querySelector("[data-m328-participant-filter]");
  if (!form) return;
  const query = String(form.elements.search?.value || "").trim().toLocaleLowerCase("de-DE");
  const status = form.elements.status?.value || "ALL";
  const preference = form.elements.preference?.value || "ALL";
  const bus = form.elements.bus?.value || "ALL";
  const hideCancelled = form.querySelector("[data-m328-hide-cancelled]")?.checked === true;
  let visible = 0;
  for (const card of participantCards()) {
    const cardStatus = card.dataset.m328FinalStatus || "";
    const cardPreference = card.dataset.m328FinalPreference || "";
    const cardBus = card.dataset.m328FinalBus || "";
    const haystack = card.dataset.m328FinalSearch || card.textContent.toLocaleLowerCase("de-DE");
    const show = (!query || haystack.includes(query))
      && (status === "ALL" || cardStatus === status)
      && (preference === "ALL" || cardPreference === preference)
      && (bus === "ALL" || (bus === "UNASSIGNED" ? !cardBus : cardBus === bus))
      && (!hideCancelled || cardStatus !== "CANCELLED");
    card.hidden = !show;
    if (show) visible += 1;
  }
  const count = document.querySelector("[data-m328-participant-count]");
  const total = participantCards().length;
  if (count) count.textContent = `${visible} von ${total}`;
  const empty = document.querySelector("[data-m328-participant-empty]");
  if (empty) empty.hidden = visible > 0;
}

async function syncParticipantRoles() {
  const route = routeState();
  if (route.view !== "participants" || !route.tripId) {
    participantSyncKey = "";
    return;
  }
  ensureParticipantQuickFilter();
  const cards = participantCards();
  if (!cards.length) {
    applyParticipantFilters();
    return;
  }
  const ids = cards.map(card => card.dataset.m328ParticipantId || "").sort().join("|");
  const key = `${route.tripId}:${ids}`;
  if (participantSyncKey === key || participantSyncPromise) {
    applyParticipantFilters();
    return;
  }
  participantSyncPromise = api.call("fanbus_registrations_list", { tripId: route.tripId })
    .then(data => {
      const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
      const byId = new Map(registrations.map(item => [String(item.id || ""), item]));
      const bookingSizes = new Map();
      for (const registration of registrations) {
        const bookingKey = String(registration.bookingId || registration.id || "");
        bookingSizes.set(bookingKey, (bookingSizes.get(bookingKey) || 0) + 1);
      }
      for (const card of cards) {
        const registration = byId.get(String(card.dataset.m328ParticipantId || ""));
        if (!registration) continue;
        const bookingKey = String(registration.bookingId || registration.id || "");
        const size = bookingSizes.get(bookingKey) || 1;
        const role = size <= 1
          ? "Einzelbuchung"
          : registration.bookingRole === "COMPANION"
            ? "Mitfahrer · Gruppenbuchung"
            : "Gruppenbuchung · Ansprechperson";
        const roleTarget = card.querySelector(".m328-card-meta span:first-child");
        if (roleTarget) roleTarget.textContent = role;
        card.dataset.m328FinalStatus = String(registration.status || "");
        card.dataset.m328FinalPreference = String(registration.busPreference || "");
        card.dataset.m328FinalBus = String(registration.busId || "");
        card.dataset.m328FinalSearch = `${registration.firstName || ""} ${registration.lastName || ""} ${registration.email || ""}`.toLocaleLowerCase("de-DE");
      }
      participantSyncKey = key;
      applyParticipantFilters();
    })
    .catch(error => {
      participantSyncKey = "";
      console.warn("M328 Teilnehmerkennzeichnung konnte nicht ergänzt werden", error);
    })
    .finally(() => {
      participantSyncPromise = null;
    });
  await participantSyncPromise;
}

function ensureBookingFilter() {
  const tools = document.querySelector(".m328-bookings-tools");
  const count = document.getElementById("m328BookingCount");
  if (!tools || !count || tools.querySelector("[data-m328-booking-status-filter]")) return;
  tools.classList.add("m328-final-booking-tools");
  const row = document.createElement("div");
  row.className = "m328-final-booking-tools-row";
  count.before(row);
  row.append(count);
  const details = document.createElement("details");
  details.className = "m328-final-booking-filter";
  details.innerHTML = `
    <summary class="button small secondary">Filter</summary>
    <label class="m328-final-booking-filter-body">Status
      <select data-m328-booking-status-filter>
        <option value="OPEN" selected>Nicht storniert</option>
        <option value="ALL">Alle</option>
        <option value="ACTIVE">Aktiv</option>
        <option value="WAITLISTED">Warteliste</option>
        <option value="CANCELLED">Storniert</option>
      </select>
    </label>`;
  row.append(details);
}

function bookingCardStatus(card) {
  const label = card.querySelector(".m328-booking-side .badge")?.textContent?.trim() || "";
  if (label === "Aktiv") return "ACTIVE";
  if (label === "Warteliste") return "WAITLISTED";
  if (label === "Storniert") return "CANCELLED";
  return "";
}

function applyBookingFilter() {
  const route = routeState();
  if (route.view !== "bookings") return;
  ensureBookingFilter();
  const selected = document.querySelector("[data-m328-booking-status-filter]")?.value || "OPEN";
  const cards = [...document.querySelectorAll("#m328BookingList .m328-booking-card")];
  let visible = 0;
  for (const card of cards) {
    const status = bookingCardStatus(card);
    const show = selected === "ALL"
      || (selected === "OPEN" ? status !== "CANCELLED" : status === selected);
    card.hidden = !show;
    if (show) visible += 1;
  }
  const count = document.getElementById("m328BookingCount");
  if (count) {
    const current = count.textContent || "";
    const total = Number(current.match(/von\s+(\d+)\s+Buchungen/i)?.[1] || cards.length);
    const next = `${visible} von ${total} Buchungen`;
    if (count.textContent !== next) count.textContent = next;
  }
}

function repairOperationsFilter() {
  const form = document.querySelector("[data-m328-operation-filters]");
  if (!form) return;
  form.classList.remove("form-grid", "v4-smart-form", "v4-m325-operation-filters");
  form.classList.add("m328-final-operation-filters");
}

function repairBusWorkspace() {
  const route = routeState();
  if (route.view !== "occupancy") return;
  const title = document.querySelector(".m328-workspace-title h2");
  if (title && title.textContent !== "Busse") title.textContent = "Busse";
  document.querySelectorAll(".v4-dialog-kicker").forEach(kicker => {
    if (kicker.textContent.trim() === "Busse & Zuordnung") kicker.textContent = "Busse";
  });
  document.querySelectorAll(".m328-occupancy-card .m328-card-head > span").forEach(value => {
    const text = value.textContent.trim();
    if (/^\/\s*\d+\s+belegt$/i.test(text)) value.textContent = `0 ${text}`;
  });
}

function applySynchronousPolish() {
  ensureStyle();
  normalizeBackButtons();
  polishTripDetail();
  ensureParticipantQuickFilter();
  applyParticipantFilters();
  ensureBookingFilter();
  applyBookingFilter();
  repairOperationsFilter();
  repairBusWorkspace();
}

function schedulePolish() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    applySynchronousPolish();
    void syncParticipantRoles();
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest?.(BACK_SELECTOR);
  if (!button) return;
  const route = routeState();
  if (route.path !== "#/bus-orga" || !route.tripId || !CHILD_VIEWS.has(route.view)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  location.hash = tripDetailRoute(route.tripId);
}, true);

document.addEventListener("input", event => {
  if (event.target.closest?.("[data-m328-participant-filter]")) queueMicrotask(applyParticipantFilters);
});

document.addEventListener("change", event => {
  if (event.target.matches?.("[data-m328-booking-status-filter]")) {
    applyBookingFilter();
    return;
  }
  if (event.target.closest?.("[data-m328-participant-filter]")) {
    const form = event.target.closest("[data-m328-participant-filter]");
    const hide = form?.querySelector("[data-m328-hide-cancelled]");
    if (event.target.name === "status" && event.target.value === "CANCELLED" && hide) hide.checked = false;
    queueMicrotask(applyParticipantFilters);
  }
});

window.addEventListener("hashchange", () => {
  participantSyncKey = "";
  schedulePolish();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") schedulePolish();
});

const observer = new MutationObserver(() => schedulePolish());
observer.observe(document.documentElement, { childList: true, subtree: true });

schedulePolish();

export function noop() {}

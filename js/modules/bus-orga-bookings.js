import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  showToast
} from "./common.js";

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function shortDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}.${match[2]}.` : String(value || "Termin offen");
}

function eventTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
}

function statusLabel(value) {
  return {
    ACTIVE: "Aktiv",
    WAITLISTED: "Warteliste",
    CANCELLED: "Storniert"
  }[value] || value || "–";
}

function sourceLabel(value) {
  return {
    PORTAL: "Portal",
    GUEST: "Homepage/Gast",
    MANUAL: "Bus-Orga"
  }[value] || value || "–";
}

function personName(person) {
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "Unbenannte Person";
}

function ensureStyle() {
  if (document.getElementById("m328BookingOverviewStyle")) return;
  const style = document.createElement("style");
  style.id = "m328BookingOverviewStyle";
  style.textContent = `
    .m328-bookings{display:grid;gap:10px;width:100%;overflow-x:clip}.m328-bookings *{box-sizing:border-box;min-width:0}
    .m328-bookings-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-bookings-title h2{margin:0;font-size:1.28rem;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m328-bookings-title span{display:block;margin-top:2px;color:var(--muted);font-size:.76rem;font-weight:700}
    .m328-bookings-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-bookings-tools input{width:100%;min-height:40px}.m328-bookings-count{align-self:center;color:var(--muted);font-size:.74rem;white-space:nowrap}
    .m328-booking-list{display:grid;gap:7px}
    .m328-booking-card{border:1px solid var(--line);border-radius:13px;background:var(--surface);overflow:hidden}
    .m328-booking-card summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 11px;cursor:pointer;list-style:none}.m328-booking-card summary::-webkit-details-marker{display:none}
    .m328-booking-main{display:grid;gap:3px}.m328-booking-number{font-size:.9rem;font-weight:900;letter-spacing:.02em}.m328-booking-meta{display:flex;flex-wrap:wrap;gap:3px 8px;color:var(--muted);font-size:.68rem}.m328-booking-primary{font-size:.79rem;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-booking-side{display:flex;align-items:center;gap:6px}.m328-booking-chevron{color:var(--muted);font-size:1.2rem;transition:transform .16s ease}.m328-booking-card[open] .m328-booking-chevron{transform:rotate(90deg)}
    .m328-booking-body{display:grid;gap:0;border-top:1px solid var(--line)}.m328-booking-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line)}.m328-booking-person:last-child{border-bottom:0}.m328-booking-person strong{display:block;font-size:.8rem}.m328-booking-person small{display:block;color:var(--muted);font-size:.67rem;margin-top:2px}.m328-booking-person-status{font-size:.68rem;font-weight:800;white-space:nowrap}
    @media(max-width:520px){.m328-bookings-tools{grid-template-columns:1fr}.m328-bookings-count{justify-self:start}.m328-booking-card summary{padding:9px 10px}.m328-booking-side .badge{font-size:.63rem;padding-inline:7px}}
  `;
  document.head.appendChild(style);
}

function groupBookings(registrations) {
  const map = new Map();
  for (const registration of registrations) {
    const key = String(registration.bookingId || registration.id || "");
    if (!key) continue;
    let booking = map.get(key);
    if (!booking) {
      booking = {
        id: key,
        number: registration.bookingNumber || key,
        source: registration.source,
        participants: []
      };
      map.set(key, booking);
    }
    booking.participants.push(registration);
  }
  return Array.from(map.values()).map(booking => {
    booking.participants.sort((a, b) => Number(a.participantSequence || 0) - Number(b.participantSequence || 0));
    booking.primary = booking.participants.find(person => person.bookingRole === "PRIMARY") || booking.participants[0] || null;
    return booking;
  }).sort((a, b) => String(a.number).localeCompare(String(b.number), "de"));
}

function bookingStatus(booking) {
  const statuses = new Set(booking.participants.map(person => person.status));
  if (statuses.has("ACTIVE")) return "ACTIVE";
  if (statuses.has("WAITLISTED")) return "WAITLISTED";
  return "CANCELLED";
}

function statusBadge(value) {
  const type = value === "ACTIVE" ? "success" : value === "WAITLISTED" ? "warning" : "neutral";
  return `<span class="badge ${type}">${escapeHtml(statusLabel(value))}</span>`;
}

function bookingMatches(booking, query) {
  if (!query) return true;
  const haystack = [
    booking.number,
    booking.source,
    ...booking.participants.flatMap(person => [person.firstName, person.lastName, person.email])
  ].filter(Boolean).join(" ").toLocaleLowerCase("de-DE");
  return haystack.includes(query.toLocaleLowerCase("de-DE"));
}

function personRow(person) {
  const bus = person.busLabel ? ` · ${person.busLabel}` : "";
  const waitlist = person.waitlistPosition ? ` · WL ${person.waitlistPosition}` : "";
  return `<div class="m328-booking-person"><div><strong>${escapeHtml(personName(person))}</strong><small>${escapeHtml(`${person.bookingRole === "PRIMARY" ? "Hauptperson" : "Mitfahrer"}${person.email ? ` · ${person.email}` : ""}${bus}${waitlist}`)}</small></div><span class="m328-booking-person-status">${escapeHtml(statusLabel(person.status))}</span></div>`;
}

function bookingCard(booking) {
  const status = bookingStatus(booking);
  const count = booking.participants.length;
  const primary = booking.primary ? personName(booking.primary) : "–";
  return `<details class="m328-booking-card"><summary><span class="m328-booking-main"><span class="m328-booking-number">${escapeHtml(booking.number)}</span><span class="m328-booking-primary">${escapeHtml(primary)}</span><span class="m328-booking-meta"><span>${count} ${count === 1 ? "Person" : "Personen"}</span><span>${escapeHtml(sourceLabel(booking.source))}</span></span></span><span class="m328-booking-side">${statusBadge(status)}<span class="m328-booking-chevron" aria-hidden="true">›</span></span></summary><div class="m328-booking-body">${booking.participants.map(personRow).join("")}</div></details>`;
}

function renderList(state) {
  const target = document.getElementById("m328BookingList");
  const count = document.getElementById("m328BookingCount");
  if (!target) return;
  const visible = state.bookings.filter(booking => bookingMatches(booking, state.query));
  if (count) count.textContent = `${visible.length} von ${state.bookings.length} Buchungen`;
  target.innerHTML = visible.length ? visible.map(bookingCard).join("") : empty("Keine passende Buchung gefunden.");
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-bookings"><header class="m328-bookings-head"><button id="m328BookingsBack" class="button small ghost" type="button">← Bus-Orga</button><div class="m328-bookings-title"><h2>Buchungen • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header><section class="m328-bookings-tools"><input id="m328BookingSearch" type="search" autocomplete="off" placeholder="Buchungsnummer oder Name suchen …" aria-label="Buchungen durchsuchen"><span id="m328BookingCount" class="m328-bookings-count"></span></section><section id="m328BookingList" class="m328-booking-list" aria-live="polite"></section></div>`;
  document.getElementById("m328BookingsBack")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });
  document.getElementById("m328BookingSearch")?.addEventListener("input", event => {
    state.query = event.currentTarget.value || "";
    renderList(state);
  });
  renderList(state);
}

export async function hydrateBusOrgaBookings(context = {}) {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  if (!hasCapability("fanbus.registrations.manage")) {
    root.innerHTML = '<div class="notice error">Für die Buchungsübersicht fehlt die erforderliche Berechtigung.</div>';
    return;
  }
  const tripId = routeParams().get("trip") || "";
  if (!tripId) {
    root.innerHTML = '<div class="notice error">Es wurde keine Fahrt ausgewählt.</div>';
    return;
  }
  root.innerHTML = loading("Buchungen werden geladen …");
  try {
    const [tripData, registrationData] = await Promise.all([
      call("fanbus_trips_list"),
      call("fanbus_registrations_list", { tripId })
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(tripData?.trips) ? tripData.trips : []).find(item => item.id === tripId);
    if (!trip) throw new Error("Die Fahrt wurde nicht gefunden.");
    const registrations = Array.isArray(registrationData?.registrations) ? registrationData.registrations : [];
    renderPage(root, {
      trip,
      bookings: groupBookings(registrations),
      query: ""
    });
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Buchungen konnten nicht geladen werden.")}</div><button id="m328BookingsLoadBack" class="button secondary" type="button">← Bus-Orga</button>`;
    document.getElementById("m328BookingsLoadBack")?.addEventListener("click", () => {
      location.hash = "#/bus-orga";
    });
    showToast(error?.message || "Buchungen konnten nicht geladen werden.", "error", 5200);
  }
}

export function noop() {}

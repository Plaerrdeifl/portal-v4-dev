import {
  call,
  confirmAction,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  runWrite,
  showToast
} from "./common.js";

const BUS_PREFERENCES = Object.freeze([
  { value: "EGAL", label: "Egal" },
  { value: "RUHIG", label: "Ruhig" },
  { value: "PARTY", label: "Party" }
]);

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function tripDetailHash(tripId) {
  return `#/bus-orga?${new URLSearchParams({ view: "trip-detail", trip: String(tripId || "") })}`;
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

function cancellable(person) {
  return ["ACTIVE", "WAITLISTED"].includes(person?.status);
}

function linkedIdentity(person) {
  return Boolean(person?.portalUserId || person?.memberId || person?.regularRiderId);
}

function activeStops(state) {
  return state.stops.filter(stop => stop?.isActive !== false);
}

function stopId(stop) {
  return String(stop?.tripBoardingStopId || stop?.id || "");
}

function stopOptions(state, selected = "") {
  return `<option value="">Bitte wählen</option>${activeStops(state).map(stop => {
    const id = stopId(stop);
    return `<option value="${escapeAttr(id)}"${id === String(selected || "") ? " selected" : ""}>${escapeHtml(stop.label || "Zustieg")}</option>`;
  }).join("")}`;
}

function preferenceOptions(selected = "EGAL") {
  return BUS_PREFERENCES.map(option => `<option value="${option.value}"${option.value === String(selected || "EGAL") ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
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
    .m328-bookings-tools input{width:100%;min-height:42px}.m328-bookings-count{align-self:center;color:var(--muted);font-size:.74rem;white-space:nowrap}
    .m328-bookings-filter{grid-column:1/-1;margin:0}.m328-bookings-filter>summary{width:max-content;min-height:34px;padding:6px 10px;font-size:.72rem;list-style:none}.m328-bookings-filter>summary::-webkit-details-marker{display:none}.m328-bookings-filter-body{display:grid;grid-template-columns:minmax(0,220px);gap:7px;margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2)}.m328-bookings-filter-body label{display:grid;gap:3px;font-size:.68rem;font-weight:750}.m328-bookings-filter-body select{width:100%;min-height:38px}
    .m328-booking-list{display:grid;gap:7px}.m328-booking-card{border:1px solid var(--line);border-radius:13px;background:var(--surface);overflow:hidden}
    .m328-booking-card summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 11px;cursor:pointer;list-style:none}.m328-booking-card summary::-webkit-details-marker{display:none}
    .m328-booking-main{display:grid;gap:3px}.m328-booking-number{font-size:.9rem;font-weight:900;letter-spacing:.02em}.m328-booking-meta{display:flex;flex-wrap:wrap;gap:3px 8px;color:var(--muted);font-size:.68rem}.m328-booking-primary{font-size:.79rem;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-booking-side{display:flex;align-items:center;gap:6px}.m328-booking-chevron{color:var(--muted);font-size:1.2rem;transition:transform .16s ease}.m328-booking-card[open] .m328-booking-chevron{transform:rotate(90deg)}
    .m328-booking-body{display:grid;gap:0;border-top:1px solid var(--line)}.m328-booking-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line)}.m328-booking-person strong{display:block;font-size:.8rem}.m328-booking-person small{display:block;color:var(--muted);font-size:.67rem;margin-top:2px}.m328-booking-person-status{font-size:.68rem;font-weight:800;white-space:nowrap}
    .m328-booking-person-actions{display:flex;align-items:center;gap:6px;justify-content:flex-end}.m328-booking-person-actions .button{min-height:30px;padding:4px 7px;font-size:.66rem}
    .m328-booking-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:9px 10px;border-top:1px solid var(--line);background:var(--surface-2)}.m328-booking-actions .button{width:100%;min-height:38px;font-size:.72rem}
    .m328-booking-edit{display:grid;gap:8px;padding:9px 10px;border-top:1px solid var(--line)}.m328-booking-edit-person{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2)}.m328-booking-edit-person h4{grid-column:1/-1;margin:0;font-size:.82rem}.m328-booking-edit-person label{display:grid;gap:3px;font-size:.68rem;font-weight:750}.m328-booking-edit-person input,.m328-booking-edit-person select{width:100%;min-height:39px}.m328-booking-edit-note{grid-column:1/-1}.m328-booking-edit-status{grid-column:1/-1;color:var(--muted);font-size:.68rem}.m328-booking-edit-footer{display:grid;grid-template-columns:1fr 1fr;gap:6px}.m328-booking-edit-footer .button{width:100%;min-height:40px}
    @media(max-width:520px){.m328-bookings-tools{grid-template-columns:1fr}.m328-bookings-count{justify-self:start}.m328-booking-card summary{padding:9px 10px}.m328-booking-side .badge{font-size:.63rem;padding-inline:7px}.m328-booking-person{grid-template-columns:1fr}.m328-booking-person-actions{justify-content:space-between}.m328-booking-edit-person{grid-template-columns:1fr}.m328-booking-edit-person h4,.m328-booking-edit-note,.m328-booking-edit-status{grid-column:auto}}
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

function bookingMatches(booking, query, statusFilter) {
  const status = bookingStatus(booking);
  const statusMatches = statusFilter === "ALL"
    || (statusFilter === "CURRENT" ? status !== "CANCELLED" : status === statusFilter);
  if (!statusMatches) return false;
  if (!query) return true;
  const haystack = [
    booking.number,
    booking.source,
    ...booking.participants.flatMap(person => [person.firstName, person.lastName, person.email])
  ].filter(Boolean).join(" ").toLocaleLowerCase("de-DE");
  return haystack.includes(query.toLocaleLowerCase("de-DE"));
}

function bookingPersonRole(person, booking) {
  if (booking.participants.length <= 1) {
    return person.bookingRole === "COMPANION" ? "Mitfahrer" : "Einzelbuchung";
  }
  if (person.bookingRole === "COMPANION") {
    return `Mitfahrer · Gruppe ${booking.primary ? personName(booking.primary) : "Hauptperson"}`;
  }
  return `Gruppenbuchung · ${booking.participants.length} Personen`;
}

function personRow(person, booking) {
  const bus = person.busLabel ? ` · ${person.busLabel}` : "";
  const waitlist = person.waitlistPosition ? ` · WL ${person.waitlistPosition}` : "";
  const stop = person.boardingStopLabel ? ` · ${person.boardingStopLabel}` : "";
  const canCancel = cancellable(person);
  return `<div class="m328-booking-person"><div><strong>${escapeHtml(personName(person))}</strong><small>${escapeHtml(`${bookingPersonRole(person, booking)}${person.email ? ` · ${person.email}` : ""}${stop}${bus}${waitlist}`)}</small></div><div class="m328-booking-person-actions"><span class="m328-booking-person-status">${escapeHtml(statusLabel(person.status))}</span>${canCancel && booking.participants.length > 1 ? `<button class="button small danger" type="button" data-m328-cancel-person="${escapeAttr(person.id)}" data-booking-id="${escapeAttr(booking.id)}">Person stornieren</button>` : ""}</div></div>`;
}

function editPerson(state, person) {
  if (!cancellable(person)) {
    return `<div class="m328-booking-edit-person"><h4>${escapeHtml(personName(person))}</h4><div class="m328-booking-edit-status">${escapeHtml(statusLabel(person.status))} · nicht mehr bearbeitbar</div></div>`;
  }
  const fixed = linkedIdentity(person);
  const hasStops = activeStops(state).length > 0;
  const busPreference = state.trip.busPreferenceSelectionEnabled === true
    ? `<label>Buswunsch<select data-edit-field="busPreference">${preferenceOptions(person.busPreference || "EGAL")}</select></label>`
    : `<input data-edit-field="busPreference" type="hidden" value="${escapeAttr(person.busPreference || "EGAL")}">`;
  return `<div class="m328-booking-edit-person" data-edit-participant="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.revision)}"><h4>${escapeHtml(personName(person))}</h4><label>Vorname<input data-edit-field="firstName" maxlength="120" value="${escapeAttr(person.firstName || "")}"${fixed ? " readonly" : " required"}></label><label>Nachname<input data-edit-field="lastName" maxlength="120" value="${escapeAttr(person.lastName || "")}"${fixed ? " readonly" : " required"}></label><label>E-Mail<input data-edit-field="email" type="email" value="${escapeAttr(person.email || "")}"${fixed ? " readonly" : ""}></label>${hasStops ? `<label>Zustieg<select data-edit-field="tripBoardingStopId" required>${stopOptions(state, person.tripBoardingStopId)}</select></label>` : `<input data-edit-field="tripBoardingStopId" type="hidden" value="">`}${busPreference}<label class="m328-booking-edit-note">Hinweis<input data-edit-field="operationalNote" maxlength="240" value="${escapeAttr(person.operationalNote || "")}" placeholder="Optional"></label></div>`;
}

function bookingCard(state, booking) {
  const status = bookingStatus(booking);
  const count = booking.participants.length;
  const primary = booking.primary ? personName(booking.primary) : "–";
  const editing = state.editingBookingId === booking.id;
  const active = booking.participants.filter(cancellable);
  const actions = active.length
    ? `<div class="m328-booking-actions"><button class="button secondary" type="button" data-m328-edit-booking="${escapeAttr(booking.id)}">Bearbeiten</button><button class="button danger" type="button" data-m328-cancel-booking="${escapeAttr(booking.id)}">${active.length === 1 ? "Buchung stornieren" : "Gesamte Buchung stornieren"}</button></div>`
    : "";
  const edit = editing
    ? `<form class="m328-booking-edit" data-m328-edit-form="${escapeAttr(booking.id)}">${booking.participants.map(person => editPerson(state, person)).join("")}<div class="m328-booking-edit-footer"><button class="button ghost" type="button" data-m328-edit-cancel="${escapeAttr(booking.id)}">Abbrechen</button><button class="button primary" type="submit">Änderungen speichern</button></div></form>`
    : "";
  return `<details class="m328-booking-card" data-booking-card="${escapeAttr(booking.id)}"${editing ? " open" : ""}><summary><span class="m328-booking-main"><span class="m328-booking-number">${escapeHtml(booking.number)}</span><span class="m328-booking-primary">${escapeHtml(primary)}</span><span class="m328-booking-meta"><span>${count} ${count === 1 ? "Person" : "Personen"}</span><span>${escapeHtml(sourceLabel(booking.source))}</span></span></span><span class="m328-booking-side">${statusBadge(status)}<span class="m328-booking-chevron" aria-hidden="true">›</span></span></summary><div class="m328-booking-body">${booking.participants.map(person => personRow(person, booking)).join("")}</div>${editing ? edit : actions}</details>`;
}

function applyRegistrationResult(state, result) {
  const registrations = Array.isArray(result?.registrations) ? result.registrations : [];
  state.bookings = groupBookings(registrations);
  state.editingBookingId = null;
  renderList(state);
}

async function cancelParticipants(state, booking, participants, label) {
  if (!participants.length) return;
  const names = participants.length === 1 ? personName(participants[0]) : `${participants.length} Personen`;
  const confirmed = await confirmAction(
    participants.length === booking.participants.filter(cancellable).length && participants.length > 1
      ? `Die gesamte Buchung ${booking.number} mit ${participants.length} Personen stornieren?`
      : `${names} aus Buchung ${booking.number} stornieren?`,
    { danger: true, title: label, submitLabel: "Stornieren" }
  );
  if (!confirmed) return;
  try {
    const result = await runWrite(
      () => call("fanbus_booking_operator_cancel", {
        bookingId: booking.id,
        participants: participants.map(person => ({ id: person.id, expectedRevision: Number(person.revision) }))
      }),
      participants.length > 1 ? "Buchung wurde storniert." : "Teilnehmer wurde storniert."
    );
    applyRegistrationResult(state, result);
  } catch (error) {
    showToast(error?.message || "Stornierung konnte nicht gespeichert werden.", "error", 5200);
  }
}

function bookingById(state, id) {
  return state.bookings.find(booking => booking.id === id) || null;
}

async function saveBookingEdit(state, form) {
  if (!form.reportValidity()) return;
  const booking = bookingById(state, form.dataset.m328EditForm);
  if (!booking) return;
  const participants = [];
  form.querySelectorAll("[data-edit-participant]").forEach(row => {
    const id = row.dataset.editParticipant;
    const field = name => row.querySelector(`[data-edit-field="${name}"]`)?.value ?? "";
    participants.push({
      id,
      expectedRevision: Number(row.dataset.revision),
      firstName: field("firstName"),
      lastName: field("lastName"),
      email: field("email") || null,
      busPreference: field("busPreference") || "EGAL",
      tripBoardingStopId: field("tripBoardingStopId") || null,
      operationalNote: field("operationalNote") || null
    });
  });
  if (!participants.length) return;
  const button = form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    const result = await runWrite(
      () => call("fanbus_booking_operator_update", { bookingId: booking.id, participants }),
      `Buchung ${booking.number} wurde aktualisiert.`
    );
    applyRegistrationResult(state, result);
  } catch (error) {
    showToast(error?.message || "Buchung konnte nicht aktualisiert werden.", "error", 5200);
    if (button) button.disabled = false;
  }
}

function bindList(state) {
  const target = document.getElementById("m328BookingList");
  if (!target) return;
  target.querySelectorAll("[data-m328-edit-booking]").forEach(button => button.addEventListener("click", () => {
    state.editingBookingId = button.dataset.m328EditBooking;
    renderList(state);
  }));
  target.querySelectorAll("[data-m328-edit-cancel]").forEach(button => button.addEventListener("click", () => {
    state.editingBookingId = null;
    renderList(state);
  }));
  target.querySelectorAll("[data-m328-cancel-booking]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.m328CancelBooking);
    if (booking) void cancelParticipants(state, booking, booking.participants.filter(cancellable), "Buchung stornieren");
  }));
  target.querySelectorAll("[data-m328-cancel-person]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.bookingId);
    const person = booking?.participants.find(item => item.id === button.dataset.m328CancelPerson);
    if (booking && person) void cancelParticipants(state, booking, [person], "Person stornieren");
  }));
  target.querySelectorAll("[data-m328-edit-form]").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault();
    void saveBookingEdit(state, form);
  }));
}

function renderList(state) {
  const target = document.getElementById("m328BookingList");
  const count = document.getElementById("m328BookingCount");
  if (!target) return;
  const visible = state.bookings.filter(booking => bookingMatches(booking, state.query, state.statusFilter));
  if (count) count.textContent = `${visible.length} von ${state.bookings.length} Buchungen`;
  target.innerHTML = visible.length ? visible.map(booking => bookingCard(state, booking)).join("") : empty("Keine passende Buchung gefunden.");
  bindList(state);
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-bookings"><header class="m328-bookings-head"><button id="m328BookingsBack" class="button small ghost" type="button">← Fahrt</button><div class="m328-bookings-title"><h2>Buchungen • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header><section class="m328-bookings-tools"><input id="m328BookingSearch" type="search" autocomplete="off" placeholder="Buchungsnummer oder Name suchen …" aria-label="Buchungen durchsuchen"><span id="m328BookingCount" class="m328-bookings-count"></span><details class="m328-bookings-filter"><summary class="button small secondary">Filter</summary><div class="m328-bookings-filter-body"><label>Status<select id="m328BookingStatusFilter"><option value="ALL">Alle</option><option value="CURRENT">Nicht storniert</option><option value="ACTIVE">Aktiv</option><option value="WAITLISTED">Warteliste</option><option value="CANCELLED">Storniert</option></select></label></div></details></section><section id="m328BookingList" class="m328-booking-list" aria-live="polite"></section></div>`;
  document.getElementById("m328BookingsBack")?.addEventListener("click", () => { location.hash = tripDetailHash(state.trip.id); });
  document.getElementById("m328BookingSearch")?.addEventListener("input", event => {
    state.query = event.currentTarget.value || "";
    state.editingBookingId = null;
    renderList(state);
  });
  document.getElementById("m328BookingStatusFilter")?.addEventListener("change", event => {
    state.statusFilter = event.currentTarget.value || "ALL";
    state.editingBookingId = null;
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
    const [tripData, registrationData, stopData] = await Promise.all([
      call("fanbus_trips_list"),
      call("fanbus_registrations_list", { tripId }),
      call("fanbus_trip_boarding_stops_list", { tripId })
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(tripData?.trips) ? tripData.trips : []).find(item => item.id === tripId);
    if (!trip) throw new Error("Die Fahrt wurde nicht gefunden.");
    const registrations = Array.isArray(registrationData?.registrations) ? registrationData.registrations : [];
    renderPage(root, {
      trip,
      stops: Array.isArray(stopData?.stops) ? stopData.stops : [],
      bookings: groupBookings(registrations),
      query: "",
      statusFilter: "ALL",
      editingBookingId: null
    });
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Buchungen konnten nicht geladen werden.")}</div><button id="m328BookingsLoadBack" class="button secondary" type="button">← Fahrt</button>`;
    document.getElementById("m328BookingsLoadBack")?.addEventListener("click", () => { location.hash = tripDetailHash(tripId); });
    showToast(error?.message || "Buchungen konnten nicht geladen werden.", "error", 5200);
  }
}

export function noop() {}

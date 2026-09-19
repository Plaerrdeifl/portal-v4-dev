import {
  call,
  closeAllDialogs,
  confirmAction,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  openDialog,
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

function preferenceLabel(value) {
  return BUS_PREFERENCES.find(option => option.value === value)?.label || value || "Egal";
}

function currentParticipants(booking) {
  return booking.participants.filter(cancellable);
}

function activeParticipants(booking) {
  return booking.participants.filter(person => person.status === "ACTIVE");
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
    .m328-booking-select{display:flex;align-items:center;gap:7px}.m328-booking-select input{width:18px;height:18px}.m328-booking-group-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:9px 10px;border-top:1px solid var(--line);background:var(--surface-2)}.m328-booking-group-facts span{display:grid;gap:2px;color:var(--muted);font-size:.65rem}.m328-booking-group-facts strong{color:var(--ink-900);font-size:.76rem}.m328-booking-override{color:#9a5b00;font-weight:850}.m328-booking-tools-actions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px}.m328-booking-tools-actions[hidden]{display:none!important}
    .m328-booking-side{display:flex;align-items:center;gap:6px}.m328-booking-chevron{color:var(--muted);font-size:1.2rem;transition:transform .16s ease}.m328-booking-card[open] .m328-booking-chevron{transform:rotate(90deg)}
    .m328-booking-body{display:grid;gap:0;border-top:1px solid var(--line)}.m328-booking-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line)}.m328-booking-person strong{display:block;font-size:.8rem}.m328-booking-person small{display:block;color:var(--muted);font-size:.67rem;margin-top:2px}.m328-booking-person-status{font-size:.68rem;font-weight:800;white-space:nowrap}
    .m328-booking-person-actions{display:flex;align-items:center;gap:6px;justify-content:flex-end}.m328-booking-person-actions .button{min-height:30px;padding:4px 7px;font-size:.66rem}
    .m328-booking-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:9px 10px;border-top:1px solid var(--line);background:var(--surface-2)}.m328-booking-actions .button{width:100%;min-height:38px;font-size:.72rem}.m328-booking-person-override{display:inline-flex;margin-top:4px;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,#f7b955 24%,var(--surface));color:#7a4700;font-size:.62rem;font-weight:850}
    .m328-append-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m328-append-fields label{display:grid;gap:4px;font-size:.72rem;font-weight:750}.m328-append-fields input,.m328-append-fields select{width:100%;min-height:42px}.m328-append-full{grid-column:1/-1}.m328-append-consent{grid-column:1/-1;display:flex!important;grid-template-columns:auto 1fr!important;align-items:flex-start;gap:8px!important}.m328-append-consent input{width:auto!important;min-height:auto!important;margin-top:3px}
    .m328-booking-edit{display:grid;gap:8px;padding:9px 10px;border-top:1px solid var(--line)}.m328-booking-edit-person{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2)}.m328-booking-edit-person h4{grid-column:1/-1;margin:0;font-size:.82rem}.m328-booking-edit-person label{display:grid;gap:3px;font-size:.68rem;font-weight:750}.m328-booking-edit-person input,.m328-booking-edit-person select{width:100%;min-height:39px}.m328-booking-edit-note{grid-column:1/-1}.m328-booking-edit-status{grid-column:1/-1;color:var(--muted);font-size:.68rem}.m328-booking-edit-footer{display:grid;grid-template-columns:1fr 1fr;gap:6px}.m328-booking-edit-footer .button{width:100%;min-height:40px}
    @media(max-width:520px){.m328-bookings-tools{grid-template-columns:1fr}.m328-bookings-count{justify-self:start}.m328-booking-card summary{padding:9px 10px}.m328-booking-side .badge{font-size:.63rem;padding-inline:7px}.m328-booking-person{grid-template-columns:1fr}.m328-booking-person-actions{justify-content:space-between}.m328-booking-actions{grid-template-columns:1fr}.m328-booking-edit-person,.m328-append-fields{grid-template-columns:1fr}.m328-booking-edit-person h4,.m328-booking-edit-note,.m328-booking-edit-status,.m328-append-full,.m328-append-consent{grid-column:auto}.m328-booking-group-facts{grid-template-columns:1fr}}
    .m328-booking-card[data-booking-status="CANCELLED"]{opacity:.68}.m328-booking-card[data-booking-status="CANCELLED"][open]{opacity:1}
    .m328-booking-group-facts{display:flex;flex-wrap:wrap;gap:6px;padding:7px 10px;background:var(--surface-2)}.m328-booking-group-fact{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-size:.65rem}.m328-booking-group-fact em{font-style:normal;color:var(--muted)}.m328-booking-group-fact strong{font-size:.68rem}.m328-booking-group-fact.warning strong{color:#8a5200}.m328-booking-group-fact.wide{max-width:100%}
    .m328-booking-person{align-items:start;padding:8px 10px}.m328-booking-person-copy{min-width:0}.m328-booking-person-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.m328-primary-choice{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:.62rem;font-weight:850;cursor:pointer}.m328-primary-choice input{width:15px;height:15px;margin:0;accent-color:var(--brand,#1976d2)}.m328-primary-badge{display:inline-flex;padding:2px 6px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:.61rem;font-weight:850}
    .m328-person-actions-menu>summary{list-style:none;min-height:30px;padding:4px 8px;font-size:.64rem}.m328-person-actions-menu>summary::-webkit-details-marker{display:none}.m328-person-actions-menu-pop{display:grid;gap:5px;margin-top:5px;min-width:150px}.m328-person-actions-menu-pop .button{width:100%}
    .m328-more-persons{border-top:1px solid var(--line)}.m328-more-persons>summary{display:block!important;padding:7px 10px!important;color:var(--muted);font-size:.66rem;font-weight:850;list-style:none}.m328-more-persons>summary::-webkit-details-marker{display:none}.m328-more-persons>div{border-top:1px dashed var(--line)}
    .m328-booking-actions{grid-template-columns:1fr 1fr;padding:8px 10px}.m328-booking-actions>.button{min-height:36px}.m328-booking-more-actions{grid-column:1/-1}.m328-booking-more-actions>summary{width:max-content;list-style:none}.m328-booking-more-actions>summary::-webkit-details-marker{display:none}.m328-booking-more-actions>div{margin-top:6px}.m328-booking-more-actions .button.danger{width:100%}
    .m328-merge-form{grid-template-columns:1fr!important}.m328-merge-form>*{grid-column:1!important;width:100%!important}
    @media(max-width:520px){.m328-booking-person{grid-template-columns:minmax(0,1fr) auto}.m328-booking-person-actions{justify-content:flex-end;align-items:flex-start}.m328-booking-actions{grid-template-columns:1fr 1fr}.m328-booking-actions .button{font-size:.68rem;padding-inline:6px}.m328-booking-group-facts{display:flex}.m328-person-actions-menu-pop{min-width:138px}.m328-booking-primary{font-size:.76rem}}
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
        personGroupId: registration.personGroupId || null,
        personGroupName: registration.personGroupName || "",
        groupBusPreference: registration.groupBusPreference || registration.busPreference || "EGAL",
        groupBusId: registration.groupBusId || null,
        revision: Number(registration.bookingRevision || 1),
        participants: []
      };
      map.set(key, booking);
    }
    booking.participants.push(registration);
  }
  return Array.from(map.values()).map(booking => {
    booking.participants.sort((a, b) => {
      const role = (a.bookingRole === "PRIMARY" ? 0 : 1) - (b.bookingRole === "PRIMARY" ? 0 : 1);
      return role || Number(a.participantSequence || 0) - Number(b.participantSequence || 0);
    });
    booking.primary = booking.participants.find(person => person.bookingRole === "PRIMARY") || booking.participants[0] || null;
    booking.current = currentParticipants(booking);
    booking.overrideCount = booking.current.filter(person => person.hasIndividualOverride).length;
    return booking;
  }).sort((a, b) => String(b.number).localeCompare(String(a.number), "de"));
}

function bookingCurrentCount(booking) {
  return booking.participants.filter(cancellable).length;
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
  const currentCount = bookingCurrentCount(booking);
  if (currentCount <= 1) return person.bookingRole === "PRIMARY" ? "Einzelbuchung" : "Mitfahrer";
  return person.bookingRole === "PRIMARY" ? "Hauptperson" : "Mitfahrer";
}

function personRow(person, booking) {
  const bus = person.busLabel ? ` · ${person.busLabel}` : "";
  const waitlist = person.waitlistPosition ? ` · WL ${person.waitlistPosition}` : "";
  const stop = person.boardingStopLabel ? ` · ${person.boardingStopLabel}` : "";
  const canManage = cancellable(person);
  const isPrimary = person.bookingRole === "PRIMARY";
  const override = person.hasIndividualOverride
    ? `<span class="m328-booking-person-override">Individuelle Abweichung</span>`
    : "";
  const status = person.status === "ACTIVE"
    ? ""
    : `<span class="m328-booking-person-status">${escapeHtml(statusLabel(person.status))}</span>`;
  const primaryControl = canManage && booking.current.length > 1
    ? `<label class="m328-primary-choice"><input type="radio" name="m328-primary-${escapeAttr(booking.id)}" data-m328-primary-person="${escapeAttr(person.id)}" data-booking-id="${escapeAttr(booking.id)}"${isPrimary ? " checked" : ""}><span>Hauptperson</span></label>`
    : isPrimary ? '<span class="m328-primary-badge">Hauptperson</span>' : "";
  const actions = canManage && booking.current.length > 1
    ? `<details class="m328-person-actions-menu"><summary class="button small secondary">Aktionen</summary><div class="m328-person-actions-menu-pop"><button class="button small secondary" type="button" data-m328-person-override="${escapeAttr(person.id)}" data-booking-id="${escapeAttr(booking.id)}">${person.hasIndividualOverride ? "Abweichung bearbeiten" : "Persönliche Abweichung"}</button><button class="button small secondary" type="button" data-m328-split-person="${escapeAttr(person.id)}" data-booking-id="${escapeAttr(booking.id)}">Aus Gruppe lösen</button><button class="button small danger" type="button" data-m328-cancel-person="${escapeAttr(person.id)}" data-booking-id="${escapeAttr(booking.id)}">Person stornieren</button></div></details>`
    : "";
  return `<div class="m328-booking-person"><div class="m328-booking-person-copy"><div class="m328-booking-person-head"><strong>${escapeHtml(personName(person))}</strong>${primaryControl}${override}</div><small>${escapeHtml(`${bookingPersonRole(person, booking)}${person.email ? ` · ${person.email}` : ""}${stop}${bus}${waitlist}`)}</small></div><div class="m328-booking-person-actions">${status}${actions}</div></div>`;
}

function bookingPersonRows(booking) {
  const current = booking.current;
  const historic = booking.participants.filter(person => !cancellable(person));
  const rows = [...current, ...historic];
  const visible = rows.slice(0, 2);
  const remaining = rows.slice(2);
  const first = visible.map(person => personRow(person, booking)).join("");
  if (!remaining.length) return first;
  const label = remaining.length === 1 ? "1 weitere Person" : `${remaining.length} weitere Personen`;
  return `${first}<details class="m328-more-persons"><summary>${escapeHtml(label)} anzeigen</summary><div>${remaining.map(person => personRow(person, booking)).join("")}</div></details>`;
}

function editPerson(state, person) {
  if (!cancellable(person)) {
    return `<div class="m328-booking-edit-person"><h4>${escapeHtml(personName(person))}</h4><div class="m328-booking-edit-status">${escapeHtml(statusLabel(person.status))} · nicht mehr bearbeitbar</div></div>`;
  }
  const fixed = linkedIdentity(person);
  const hasStops = activeStops(state).length > 0;
  return `<div class="m328-booking-edit-person" data-edit-participant="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.revision)}"><h4>${escapeHtml(personName(person))}</h4><label>Vorname<input data-edit-field="firstName" maxlength="120" value="${escapeAttr(person.firstName || "")}"${fixed ? " readonly" : " required"}></label><label>Nachname<input data-edit-field="lastName" maxlength="120" value="${escapeAttr(person.lastName || "")}"${fixed ? " readonly" : " required"}></label><label>E-Mail<input data-edit-field="email" type="email" value="${escapeAttr(person.email || "")}"${fixed ? " readonly" : ""}></label>${hasStops ? `<label>Zustieg<select data-edit-field="tripBoardingStopId" required>${stopOptions(state, person.tripBoardingStopId)}</select></label>` : `<input data-edit-field="tripBoardingStopId" type="hidden" value="">`}<input data-edit-field="busPreference" type="hidden" value="${escapeAttr(person.busPreference || "EGAL")}"><label class="m328-booking-edit-note">Hinweis<input data-edit-field="operationalNote" maxlength="240" value="${escapeAttr(person.operationalNote || "")}" placeholder="Optional"></label></div>`;
}


function appendPersonKey(person) {
  if (person?.personType === "MEMBER" && person.memberId) return `MEMBER:${person.memberId}`;
  if (person?.personType === "PORTAL_USER" && person.portalUserId) return `PORTAL_USER:${person.portalUserId}`;
  if (person?.id) return `REGULAR_RIDER:${person.id}`;
  return "";
}

function appendPersonLabel(person) {
  const name = `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "Unbenannte Person";
  const type = person?.personType === "MEMBER"
    ? "Mitglied"
    : person?.personType === "PORTAL_USER"
      ? "Portaluser"
      : "Stammfahrer";
  return `${name} · ${type}`;
}

function appendParticipantFromChoice(choice) {
  if (!choice) return null;
  if (choice.personType === "MEMBER") {
    return { source: "MEMBER", memberId: choice.memberId };
  }
  if (choice.personType === "PORTAL_USER") {
    return { source: "PORTAL_USER", portalUserId: choice.portalUserId };
  }
  return { source: "REGULAR_RIDER", regularRiderId: choice.id };
}

function appendStopByDefault(state, choice) {
  const defaultStopId = String(choice?.defaultBoardingStopId || "");
  if (!defaultStopId) return "";
  return stopId(activeStops(state).find(stop => String(stop?.boardingStopId || "") === defaultStopId) || {});
}

function setAppendMode(dialog, mode) {
  const existing = dialog.querySelector("[data-m328-append-existing]");
  const guest = dialog.querySelector("[data-m328-append-guest]");
  const existingSelect = dialog.querySelector('[name="personKey"]');
  const guestFirst = dialog.querySelector('[name="firstName"]');
  const guestLast = dialog.querySelector('[name="lastName"]');
  const isGuest = mode === "GUEST";
  if (existing) existing.hidden = isGuest;
  if (guest) guest.hidden = !isGuest;
  if (existingSelect) existingSelect.required = !isGuest;
  if (guestFirst) guestFirst.required = isGuest;
  if (guestLast) guestLast.required = isGuest;
}

async function openAppendParticipant(state, booking) {
  try {
    const [peopleData, riderData] = await Promise.all([
      call("fanbus_registration_people_list"),
      call("fanbus_regular_riders_list", {})
    ]);
    const people = Array.isArray(peopleData?.people) ? peopleData.people : [];
    const portalIds = new Set(people.map(person => person.portalUserId).filter(Boolean));
    const riders = (Array.isArray(riderData?.regularRiders) ? riderData.regularRiders : [])
      .filter(rider => rider.isActive !== false && (!rider.linkedPortalUserId || !portalIds.has(rider.linkedPortalUserId)));
    const choices = [...people, ...riders].filter(person => appendPersonKey(person));
    const choiceMap = new Map(choices.map(person => [appendPersonKey(person), person]));
    const personOptions = choices.map(person =>
      `<option value="${escapeAttr(appendPersonKey(person))}">${escapeHtml(appendPersonLabel(person))}</option>`
    ).join("");
    const hasStops = activeStops(state).length > 0;
    const busPreference = state.trip.busPreferenceSelectionEnabled === true
      ? `<label>Buswunsch<select name="busPreference">${preferenceOptions("EGAL")}</select></label>`
      : '<input name="busPreference" type="hidden" value="EGAL">';
    const stopField = hasStops
      ? `<label>Zustieg<select name="boardingStopId" required>${stopOptions(state)}</select></label>`
      : '<input name="boardingStopId" type="hidden" value="">';

    const dialog = openDialog({
      title: "Person hinzufügen",
      kicker: `${booking.number} · ${bookingCurrentCount(booking)} ${bookingCurrentCount(booking) === 1 ? "Person" : "Personen"}`,
      body: `<form class="m328-append-fields" data-m328-append-form>
        <label class="m328-append-full">Art
          <select name="mode" required>
            <option value="EXISTING">Mitglied / Portaluser / Stammfahrer</option>
            <option value="GUEST">Gast manuell eintragen</option>
          </select>
        </label>
        <label class="m328-append-full" data-m328-append-existing>Person
          <select name="personKey" required>
            <option value="">Bitte wählen</option>
            ${personOptions}
          </select>
        </label>
        <div class="m328-append-full m328-append-fields" data-m328-append-guest hidden>
          <label>Vorname<input name="firstName" maxlength="160" autocomplete="given-name"></label>
          <label>Nachname<input name="lastName" maxlength="160" autocomplete="family-name"></label>
          <label class="m328-append-full">E-Mail optional<input name="email" type="email" maxlength="320" autocomplete="email"></label>
        </div>
        ${stopField}
        ${busPreference}
        <label class="m328-append-full">Hinweis optional<input name="operationalNote" maxlength="240" placeholder="Interner Hinweis für die Bus-Orga"></label>
        <label class="m328-append-consent"><input name="consentConfirmed" type="checkbox" required><span>Die Person wurde auf Teilnahmebedingungen und Datenschutzhinweise hingewiesen.</span></label>
      </form>`,
      submitLabel: "Person hinzufügen",
      onSubmit: async values => {
        const mode = String(values.mode || "");
        let participant;
        if (mode === "GUEST") {
          participant = {
            source: "GUEST",
            firstName: String(values.firstName || "").trim(),
            lastName: String(values.lastName || "").trim(),
            email: String(values.email || "").trim() || null
          };
        } else {
          participant = appendParticipantFromChoice(choiceMap.get(String(values.personKey || "")));
          if (!participant) throw new Error("Bitte eine Person auswählen.");
        }
        participant.boardingStopId = String(values.boardingStopId || "") || null;
        participant.busPreference = String(values.busPreference || "EGAL");
        participant.operationalNote = String(values.operationalNote || "").trim() || null;

        const result = await runWrite(
          () => call("fanbus_booking_operator_append", {
            bookingId: booking.id,
            idempotencyKey: crypto.randomUUID(),
            participant,
            consentConfirmed: values.consentConfirmed === "on"
          }),
          "Person wurde zur Buchung hinzugefügt."
        );

        const addedStatus = result?.addedStatus || "";
        await hydrateBusOrgaBookings();

        if (addedStatus === "WAITLISTED") {
          showToast("Die neue Person wurde auf die Warteliste gesetzt.", "warning", 5200);
        }
      }
    });

    const modeSelect = dialog.querySelector('[name="mode"]');
    const personSelect = dialog.querySelector('[name="personKey"]');
    const stopSelect = dialog.querySelector('[name="boardingStopId"]');
    const preferenceSelect = dialog.querySelector('[name="busPreference"]');
    modeSelect?.addEventListener("change", () => setAppendMode(dialog, modeSelect.value));
    personSelect?.addEventListener("change", () => {
      const choice = choiceMap.get(personSelect.value);
      if (!choice) return;
      const defaultStop = appendStopByDefault(state, choice);
      if (stopSelect && defaultStop) stopSelect.value = defaultStop;
      if (preferenceSelect && choice.defaultBusPreference) {
        preferenceSelect.value = choice.defaultBusPreference;
      }
    });
    setAppendMode(dialog, modeSelect?.value || "EXISTING");
  } catch (error) {
    showToast(error?.message || "Person konnte nicht hinzugefügt werden.", "error", 5200);
  }
}

function bookingCard(state, booking) {
  const status = bookingStatus(booking);
  const count = booking.current.length;
  const primary = booking.primary ? personName(booking.primary) : "–";
  const editing = state.editingBookingId === booking.id;
  const active = booking.current;
  const groupBus = state.buses.find(bus => bus.id === booking.groupBusId)?.label || "Nicht zugeordnet";
  const facts = [
    booking.personGroupName ? `<span class="m328-booking-group-fact wide"><em>Gruppe</em><strong>${escapeHtml(booking.personGroupName)}</strong></span>` : "",
    `<span class="m328-booking-group-fact"><em>Buswunsch</em><strong>${escapeHtml(preferenceLabel(booking.groupBusPreference))}</strong></span>`,
    `<span class="m328-booking-group-fact"><em>Bus</em><strong>${escapeHtml(groupBus)}</strong></span>`,
    booking.overrideCount ? `<span class="m328-booking-group-fact warning"><em>Abweichungen</em><strong>${booking.overrideCount}</strong></span>` : ""
  ].filter(Boolean).join("");
  const actions = active.length
    ? `<div class="m328-booking-actions"><button class="button primary" type="button" data-m328-add-person="${escapeAttr(booking.id)}">＋ Person hinzufügen</button><button class="button secondary" type="button" data-m328-edit-booking="${escapeAttr(booking.id)}">Gruppenwerte</button><details class="m328-booking-more-actions"><summary class="button small ghost">Weitere Aktionen</summary><div><button class="button danger" type="button" data-m328-cancel-booking="${escapeAttr(booking.id)}">${active.length === 1 ? "Buchung stornieren" : "Gesamte Buchung stornieren"}</button></div></details></div>`
    : "";
  const edit = editing
    ? `<form class="m328-booking-edit" data-m328-edit-form="${escapeAttr(booking.id)}"><section class="m328-booking-edit-person"><h4>Gruppenregel</h4>${state.trip.busPreferenceSelectionEnabled === true ? `<label>Buswunsch für gesamte Buchung<select data-group-field="busPreference">${preferenceOptions(booking.groupBusPreference)}</select></label>` : `<input data-group-field="busPreference" type="hidden" value="EGAL">`}<label>Bus für gesamte Buchung<select data-group-field="busId"><option value="">Nicht zugeordnet</option>${state.buses.filter(bus => bus.isActive !== false).map(bus => `<option value="${escapeAttr(bus.id)}"${bus.id === booking.groupBusId ? " selected" : ""}>${escapeHtml(`${bus.label} · ${Number(bus.remainingCapacity ?? 0)} frei`)}</option>`).join("")}</select></label>${booking.overrideCount ? '<label class="m328-booking-edit-note"><span><input data-group-field="alignOverrides" type="checkbox"> Individuelle Abweichungen an die Gruppenregel angleichen</span></label>' : ""}</section>${booking.current.map(person => editPerson(state, person)).join("")}<div class="m328-booking-edit-footer"><button class="button ghost" type="button" data-m328-edit-cancel="${escapeAttr(booking.id)}">Abbrechen</button><button class="button primary" type="submit">Änderungen speichern</button></div></form>`
    : "";
  return `<details class="m328-booking-card" data-booking-card="${escapeAttr(booking.id)}" data-booking-status="${escapeAttr(status)}"${editing ? " open" : ""}><summary><span class="m328-booking-select"><input type="checkbox" data-m328-select-booking="${escapeAttr(booking.id)}" aria-label="${escapeAttr(`Buchung ${booking.number} auswählen`)}"${state.selectedBookingIds.has(booking.id) ? " checked" : ""}><span class="m328-booking-main"><span class="m328-booking-number">${escapeHtml(booking.number)}</span><span class="m328-booking-primary">${escapeHtml(primary)}</span><span class="m328-booking-meta"><span>${count} ${count === 1 ? "Person" : "Personen"}</span><span>${escapeHtml(sourceLabel(booking.source))}</span></span></span></span><span class="m328-booking-side">${statusBadge(status)}<span class="m328-booking-chevron" aria-hidden="true">›</span></span></summary>${facts ? `<div class="m328-booking-group-facts">${facts}</div>` : ""}<div class="m328-booking-body">${bookingPersonRows(booking)}</div>${editing ? edit : actions}</details>`;
}

function applyRegistrationResult(state, result) {
  const registrations = Array.isArray(result?.registrations) ? result.registrations : [];
  state.bookings = groupBookings(registrations);
  if (Array.isArray(result?.buses)) state.buses = result.buses;
  state.selectedBookingIds = new Set(
    [...state.selectedBookingIds].filter(id => state.bookings.some(booking => booking.id === id))
  );
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

function appendParticipantPayload(person = {}) {
  return {
    ...(person.portalUserId ? { portalUserId: person.portalUserId } : {}),
    ...(person.memberId ? { memberId: person.memberId } : {}),
    ...(person.regularRiderId ? { regularRiderId: person.regularRiderId } : {}),
    firstName: person.firstName || "",
    lastName: person.lastName || "",
    email: person.email || null,
    tripBoardingStopId: person.tripBoardingStopId || null,
    operationalNote: person.operationalNote || null
  };
}

async function appendPerson(state, booking, participant) {
  try {
    const result = await runWrite(
      () => call("fanbus_booking_operator_append", {
        bookingId: booking.id,
        participant: appendParticipantPayload(participant)
      }),
      `Person zu ${booking.number} hinzugefügt.`
    );
    closeAllDialogs();
    applyRegistrationResult(state, result);
  } catch (error) {
    showToast(error?.message || "Person konnte nicht hinzugefügt werden.", "error", 5600);
  }
}

async function openAddPerson(state, booking) {
  try {
    const [groupData, peopleData, riderData] = await Promise.all([
      call("fanbus_booking_group_candidates", { bookingId: booking.id }),
      call("fanbus_registration_people_list"),
      call("fanbus_regular_riders_list")
    ]);
    const groupMembers = (Array.isArray(groupData?.members) ? groupData.members : [])
      .filter(member => member.available && !member.conflict && !member.booked);
    const known = [
      ...(Array.isArray(peopleData?.people) ? peopleData.people : []),
      ...(Array.isArray(riderData?.regularRiders) ? riderData.regularRiders.map(rider => ({
        ...rider,
        personType: "REGULAR_RIDER",
        regularRiderId: rider.regularRiderId || rider.id
      })) : [])
    ];
    const dialog = openDialog({
      title: "Person hinzufügen",
      kicker: `${booking.number} · ${booking.current.length} aktuelle Personen`,
      body: `<div class="form-grid v4-smart-form">
        ${booking.personGroupId ? `<section class="v4-field-full"><h3>${escapeHtml(groupData.personGroupName || booking.personGroupName)}</h3><p class="subtle">Noch nicht gebuchte Gruppenmitglieder werden zuerst angeboten.</p><div class="m328-dialog-actions" data-m328-group-candidates>${groupMembers.map((member, index) => `<button class="button primary" type="button" data-m328-group-candidate="${index}">${escapeHtml(personName(member))}</button>`).join("") || '<p class="subtle">Alle verfügbaren Gruppenmitglieder sind bereits gebucht.</p>'}</div></section>` : `<p class="subtle v4-field-full">Diese operative Gruppe ist nicht mit einer gespeicherten Personengruppe verknüpft.</p>`}
        <details class="v4-field-full"><summary class="button secondary">Andere bekannte Person hinzufügen</summary><div class="form-grid v4-smart-form"><label class="v4-field-full">Person<select data-m328-known-person><option value="">Bitte wählen</option>${known.map((person, index) => `<option value="${index}">${escapeHtml(`${personName(person)} · ${person.personType || "Bekannte Person"}`)}</option>`).join("")}</select></label><button class="button secondary" type="button" data-m328-append-known>Ausgewählte Person hinzufügen</button></div></details>
        <details class="v4-field-full"><summary class="button secondary">Manuellen Gast hinzufügen</summary><form class="form-grid v4-smart-form" data-m328-append-guest><label>Vorname<input name="firstName" maxlength="160" required></label><label>Nachname<input name="lastName" maxlength="160" required></label><label class="v4-field-full">E-Mail (optional)<input name="email" type="email" maxlength="320"></label><label class="v4-field-full">Zustieg<select name="tripBoardingStopId"><option value="">Kein strukturierter Zustieg</option>${stopOptions(state)}</select></label><button class="button primary" type="submit">Gast hinzufügen</button></form></details>
      </div>`
    });
    dialog.querySelectorAll("[data-m328-group-candidate]").forEach(button => button.addEventListener("click", () => {
      const member = groupMembers[Number(button.dataset.m328GroupCandidate)];
      if (member) void appendPerson(state, booking, member);
    }));
    dialog.querySelector("[data-m328-append-known]")?.addEventListener("click", () => {
      const index = Number(dialog.querySelector("[data-m328-known-person]")?.value);
      if (!Number.isInteger(index) || !known[index]) {
        showToast("Bitte wähle eine Person aus.", "warning", 2600);
        return;
      }
      void appendPerson(state, booking, known[index]);
    });
    dialog.querySelector("[data-m328-append-guest]")?.addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      void appendPerson(state, booking, values);
    });
  } catch (error) {
    showToast(error?.message || "Personenauswahl konnte nicht geladen werden.", "error", 5200);
  }
}

async function setPrimaryPerson(state, booking, person) {
  if (!booking || !person || person.bookingRole === "PRIMARY" || !cancellable(person)) return;
  try {
    const result = await runWrite(() => call("fanbus_booking_primary_set", {
      bookingId: booking.id,
      participantId: person.id
    }), `${personName(person)} ist jetzt Hauptperson.`);
    applyRegistrationResult(state, result);
  } catch (error) {
    showToast(error?.message || "Hauptperson konnte nicht geändert werden.", "error", 5200);
    renderList(state);
  }
}

function openParticipantOverride(state, booking, person) {
  const dialog = openDialog({
    title: "Persönliche Abweichung",
    kicker: `${personName(person)} · ${booking.number}`,
    body: `<form class="form-grid v4-smart-form" data-m328-override-form>
      <label>Individueller Buswunsch<select name="busPreference">${preferenceOptions(person.busPreference || booking.groupBusPreference)}</select></label>
      <label>Individueller Bus<select name="busId"><option value="">Bewusst nicht zugeordnet</option>${state.buses.filter(bus => bus.isActive !== false).map(bus => `<option value="${escapeAttr(bus.id)}"${bus.id === person.busId ? " selected" : ""}>${escapeHtml(bus.label)}</option>`).join("")}</select></label>
      <p class="subtle v4-field-full">Diese Aktion setzt eine sichtbare, auditierte Ausnahme von der Buchungsregel.</p>
    </form>`,
    submitLabel: "Abweichung speichern",
    onSubmit: async values => {
      const result = await runWrite(() => call("fanbus_booking_participant_override_set", {
        participantId: person.id,
        busPreference: values.busPreference,
        busId: values.busId || null
      }), "Individuelle Abweichung gespeichert.");
      applyRegistrationResult(state, result);
    }
  });
  if (person.hasIndividualOverride) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "button secondary";
    action.textContent = "An Gruppenregel angleichen";
    action.addEventListener("click", async () => {
      try {
        const result = await runWrite(() => call("fanbus_booking_participant_override_clear", {
          participantId: person.id,
          kind: "ALL"
        }), "Person folgt wieder der Gruppenregel.");
        closeAllDialogs();
        applyRegistrationResult(state, result);
      } catch (error) {
        showToast(error?.message || "Abweichung konnte nicht aufgehoben werden.", "error", 5200);
      }
    });
    dialog.querySelector(".dialog-actions")?.prepend(action);
  }
}

async function splitPerson(state, booking, person) {
  const confirmed = await confirmAction(
    `${personName(person)} aus ${booking.number} lösen und eine neue Buchungsnummer erzeugen?`,
    { title: "Person aus Gruppe lösen", submitLabel: "Neue Buchung anlegen" }
  );
  if (!confirmed) return;
  try {
    const result = await runWrite(() => call("fanbus_booking_split", {
      bookingId: booking.id,
      participantIds: [person.id]
    }), "Person wurde in eine neue Buchung verschoben.");
    applyRegistrationResult(state, result);
  } catch (error) {
    showToast(error?.message || "Buchung konnte nicht aufgeteilt werden.", "error", 5200);
  }
}

function updateMergeAction(state) {
  const button = document.getElementById("m328MergeBookings");
  if (!button) return;
  button.hidden = state.selectedBookingIds.size < 2;
  button.textContent = state.selectedBookingIds.size < 2
    ? "Buchungen zusammenführen"
    : `${state.selectedBookingIds.size} Buchungen zusammenführen`;
}

function openMergeDialog(state) {
  const selected = state.bookings.filter(booking => state.selectedBookingIds.has(booking.id));
  if (selected.length < 2) return;
  const target = selected[0];
  const preferences = new Set(selected.map(booking => booking.groupBusPreference));
  const buses = new Set(selected.map(booking => booking.groupBusId || ""));
  openDialog({
    title: "Buchungen zusammenführen",
    kicker: `${selected.length} Buchungen · Ziel ${target.number}`,
    body: `<form class="form-grid v4-smart-form m328-merge-form" data-m328-merge-form>
      <div class="notice ${preferences.size > 1 || buses.size > 1 ? "warning" : "info"} v4-field-full">${preferences.size > 1 || buses.size > 1 ? "Die Buchungen besitzen unterschiedliche Gruppenwerte. Bitte entscheide bewusst." : "Die Buchungen besitzen übereinstimmende Gruppenwerte."}</div>
      <label>Buswunsch der neuen Gruppe<select name="busPreference">${preferenceOptions(target.groupBusPreference)}</select></label>
      <label>Bus der neuen Gruppe<select name="busId"><option value="">Zunächst nicht zugeordnet</option>${state.buses.filter(bus => bus.isActive !== false).map(bus => `<option value="${escapeAttr(bus.id)}"${bus.id === target.groupBusId ? " selected" : ""}>${escapeHtml(bus.label)}</option>`).join("")}</select></label>
      <label class="v4-field-full">Bestehende individuelle Abweichungen<select name="overrideMode"><option value="KEEP">Beibehalten</option><option value="ALIGN">An neue Gruppenregel angleichen</option></select></label>
      <p class="subtle v4-field-full">Alte Buchungsnummern bleiben historisch als „zusammengeführt in ${escapeHtml(target.number)}“ erhalten.</p>
    </form>`,
    submitLabel: "Zusammenführen",
    onSubmit: async values => {
      const result = await runWrite(() => call("fanbus_bookings_merge", {
        targetBookingId: target.id,
        sourceBookingIds: selected.slice(1).map(booking => booking.id),
        busPreference: values.busPreference,
        busId: values.busId || null,
        overrideMode: values.overrideMode
      }), `${selected.length} Buchungen wurden zusammengeführt.`);
      state.selectedBookingIds.clear();
      applyRegistrationResult(state, result);
    }
  });
}

async function saveBookingEdit(state, form) {
  if (!form.reportValidity()) return;
  const booking = bookingById(state, form.dataset.m328EditForm);
  if (!booking) return;
  const groupField = name => form.querySelector(`[data-group-field="${name}"]`);
  const groupRules = {
    bookingId: booking.id,
    busPreference: groupField("busPreference")?.value || booking.groupBusPreference || "EGAL",
    busId: groupField("busId")?.value || null,
    alignOverrides: groupField("alignOverrides")?.checked === true
  };
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
    await call("fanbus_booking_operator_update", { bookingId: booking.id, participants });
    const result = await runWrite(
      () => call("fanbus_booking_group_rules_set", groupRules),
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
  target.querySelectorAll("[data-m328-append-booking]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.m328AppendBooking);
    if (booking) void openAppendParticipant(state, booking);
  }));
  target.querySelectorAll("[data-m328-edit-booking]").forEach(button => button.addEventListener("click", () => {
    state.editingBookingId = button.dataset.m328EditBooking;
    renderList(state);
  }));
  target.querySelectorAll("[data-m328-select-booking]").forEach(input => {
    input.addEventListener("click", event => event.stopPropagation());
    input.addEventListener("change", () => {
      if (input.checked) state.selectedBookingIds.add(input.dataset.m328SelectBooking);
      else state.selectedBookingIds.delete(input.dataset.m328SelectBooking);
      updateMergeAction(state);
    });
  });
  target.querySelectorAll("[data-m328-add-person]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.m328AddPerson);
    if (booking) void openAddPerson(state, booking);
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
  target.querySelectorAll("[data-m328-primary-person]").forEach(input => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const booking = bookingById(state, input.dataset.bookingId);
      const person = booking?.participants.find(item => item.id === input.dataset.m328PrimaryPerson);
      if (booking && person) void setPrimaryPerson(state, booking, person);
    });
  });
  target.querySelectorAll("[data-m328-person-override]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.bookingId);
    const person = booking?.participants.find(item => item.id === button.dataset.m328PersonOverride);
    if (booking && person) openParticipantOverride(state, booking, person);
  }));
  target.querySelectorAll("[data-m328-split-person]").forEach(button => button.addEventListener("click", () => {
    const booking = bookingById(state, button.dataset.bookingId);
    const person = booking?.participants.find(item => item.id === button.dataset.m328SplitPerson);
    if (booking && person) void splitPerson(state, booking, person);
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
  updateMergeAction(state);
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-bookings"><header class="m328-bookings-head"><button id="m328BookingsBack" class="button small ghost" type="button">← Fahrt</button><div class="m328-bookings-title"><h2>Buchungen • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header><section class="m328-bookings-tools"><input id="m328BookingSearch" type="search" autocomplete="off" placeholder="Buchungsnummer oder Name suchen …" aria-label="Buchungen durchsuchen"><span id="m328BookingCount" class="m328-bookings-count"></span><div class="m328-booking-tools-actions"><button id="m328MergeBookings" class="button primary" type="button" hidden>Buchungen zusammenführen</button></div><details class="m328-bookings-filter"><summary class="button small secondary">Filter</summary><div class="m328-bookings-filter-body"><label>Status<select id="m328BookingStatusFilter"><option value="ALL">Alle</option><option value="CURRENT">Nicht storniert</option><option value="ACTIVE">Aktiv</option><option value="WAITLISTED">Warteliste</option><option value="CANCELLED">Storniert</option></select></label></div></details></section><section id="m328BookingList" class="m328-booking-list" aria-live="polite"></section></div>`;
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
  document.getElementById("m328MergeBookings")?.addEventListener("click", () => openMergeDialog(state));
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
      buses: Array.isArray(registrationData?.buses) ? registrationData.buses : [],
      bookings: groupBookings(registrations),
      query: "",
      statusFilter: "ALL",
      editingBookingId: null,
      selectedBookingIds: new Set()
    });
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Buchungen konnten nicht geladen werden.")}</div><button id="m328BookingsLoadBack" class="button secondary" type="button">← Fahrt</button>`;
    document.getElementById("m328BookingsLoadBack")?.addEventListener("click", () => { location.hash = tripDetailHash(tripId); });
    showToast(error?.message || "Buchungen konnten nicht geladen werden.", "error", 5200);
  }
}

export function noop() {}

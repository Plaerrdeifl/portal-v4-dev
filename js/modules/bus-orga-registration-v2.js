import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  showToast
} from "./common.js";

const BUS_PREFERENCES = Object.freeze([
  { value: "EGAL", label: "Egal" },
  { value: "RUHIG", label: "Ruhig" },
  { value: "PARTY", label: "Party" }
]);

let manualAttempt = null;

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

function sourceLabel(value) {
  return {
    MEMBER: "Mitglied",
    PORTAL_USER: "Portaluser",
    REGULAR_RIDER: "Stammfahrer",
    GUEST: "Gast"
  }[value] || value || "Person";
}

function personName(person) {
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "Unbenannte Person";
}

function manualPersonKey(person) {
  const id = person?.personType === "MEMBER" ? person.memberId : person?.portalUserId;
  return id ? `${person.personType}:${id}` : "";
}

function deduplicatePeople(people) {
  const linkedPortalUsers = new Set(
    people
      .filter(person => person?.personType === "MEMBER" && person.portalUserId)
      .map(person => person.portalUserId)
  );
  const seen = new Set();
  return people.filter(person => {
    if (person?.personType === "PORTAL_USER" && linkedPortalUsers.has(person.portalUserId)) return false;
    const key = manualPersonKey(person);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function activeStops(state) {
  return state.stops.filter(stop => stop?.isActive !== false);
}

function stopOptionId(stop) {
  return String(stop?.tripBoardingStopId || stop?.id || "");
}

function stopLabel(stop) {
  return String(stop?.label || "Zustieg").trim() || "Zustieg";
}

function defaultTripStop(state) {
  return activeStops(state).find(stop => stop.boardingStopId === state.trip.defaultBoardingStopId) || null;
}

function defaultStopId(state) {
  return stopOptionId(defaultTripStop(state));
}

function preferredTripStopId(state, preferredBoardingStopId) {
  if (preferredBoardingStopId) {
    const stop = activeStops(state).find(item => item.boardingStopId === preferredBoardingStopId);
    const resolved = stopOptionId(stop);
    if (resolved) return resolved;
  }
  return defaultStopId(state);
}

function participantIdentity(person) {
  if (person.identityKey) return person.identityKey;
  if (person.portalUserId) return `PORTAL:${person.portalUserId}`;
  if (person.memberId) return `MEMBER:${person.memberId}`;
  if (person.regularRiderId) return `REGULAR_RIDER:${person.regularRiderId}`;
  if (person.email) return `GUEST_EMAIL:${String(person.email).toLocaleLowerCase("de-DE")}`;
  return `GUEST_NAME:${String(person.firstName || "").toLocaleLowerCase("de-DE")}:${String(person.lastName || "").toLocaleLowerCase("de-DE")}`;
}

function allParticipants(state) {
  return state.bookings.flatMap(booking => booking.participants);
}

function totalParticipantCount(state) {
  return allParticipants(state).length;
}

function assertParticipantAvailable(state, participant) {
  if (totalParticipantCount(state) >= 20) {
    throw new Error("Pro Erfassung sind höchstens 20 Personen möglich.");
  }
  const key = participantIdentity(participant);
  if (allParticipants(state).some(item => participantIdentity(item) === key)) {
    throw new Error("Diese Person ist bereits in der Erfassung enthalten.");
  }
  return key;
}

function createBooking(state, participants, kind = "INDIVIDUAL") {
  if (!participants.length) return null;
  const booking = {
    clientId: crypto.randomUUID(),
    kind,
    participants: []
  };
  for (const participant of participants) {
    const identityKey = assertParticipantAvailable(state, participant);
    booking.participants.push({ ...participant, identityKey });
  }
  state.bookings.push(booking);
  renderBookingStack(state);
  return booking;
}

function addToTargetOrNew(state, participant, kind = "INDIVIDUAL") {
  const identityKey = assertParticipantAvailable(state, participant);
  const target = state.targetBookingId
    ? state.bookings.find(booking => booking.clientId === state.targetBookingId)
    : null;
  if (target) {
    target.participants.push({ ...participant, identityKey });
    target.kind = target.participants.length > 1 ? "GROUP" : target.kind;
  } else {
    state.bookings.push({
      clientId: crypto.randomUUID(),
      kind,
      participants: [{ ...participant, identityKey }]
    });
  }
  renderBookingStack(state);
}

function addManyToTargetOrNew(state, participants) {
  if (!participants.length) throw new Error("Die Gruppe enthält keine verfügbaren Personen.");
  if (totalParticipantCount(state) + participants.length > 20) {
    throw new Error("Die Auswahl überschreitet das Limit von 20 Personen.");
  }
  const existing = new Set(allParticipants(state).map(participantIdentity));
  const duplicate = participants.find(person => existing.has(participantIdentity(person)));
  if (duplicate) throw new Error(`${personName(duplicate)} ist bereits ausgewählt.`);

  const target = state.targetBookingId
    ? state.bookings.find(booking => booking.clientId === state.targetBookingId)
    : null;
  if (target) {
    target.participants.push(...participants.map(person => ({
      ...person,
      identityKey: participantIdentity(person)
    })));
    target.kind = "GROUP";
  } else {
    state.bookings.push({
      clientId: crypto.randomUUID(),
      kind: "GROUP",
      participants: participants.map(person => ({
        ...person,
        identityKey: participantIdentity(person)
      }))
    });
  }
  renderBookingStack(state);
}

function preferenceOptions(selected = "EGAL") {
  return BUS_PREFERENCES.map(option => `<option value="${option.value}"${option.value === selected ? " selected" : ""}>${option.label}</option>`).join("");
}

function stopOptions(state, selected = "") {
  return `<option value="">Bitte wählen</option>${activeStops(state).map(stop => {
    const id = stopOptionId(stop);
    return `<option value="${escapeAttr(id)}"${id === selected ? " selected" : ""}>${escapeHtml(stopLabel(stop))}</option>`;
  }).join("")}`;
}

function ensureStyle() {
  if (document.getElementById("m328BookingStackRegistrationStyle")) return;
  const style = document.createElement("style");
  style.id = "m328BookingStackRegistrationStyle";
  style.textContent = `
    .m328-reg2{display:grid;gap:10px;width:100%;overflow-x:clip}
    .m328-reg2 *{box-sizing:border-box;min-width:0}
    .m328-reg2-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-reg2-title{display:grid;gap:2px}
    .m328-reg2-title h2{margin:0;font-size:1.28rem;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-reg2-title span{color:var(--muted);font-size:.76rem;font-weight:700}
    .m328-reg2-panel{padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-reg2-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}
    .m328-reg2-panel-head h3{margin:1px 0 0;font-size:1rem}
    .m328-reg2-kicker{display:block;color:var(--muted);font-size:.65rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
    .m328-reg2-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px}
    .m328-reg2-type{width:100%;min-height:42px;padding:7px 6px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:inherit;font-size:.73rem;font-weight:800}
    .m328-reg2-type.is-active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent)}
    .m328-reg2-target{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 9px;padding:8px 9px;border-radius:10px;background:var(--surface-2);font-size:.73rem}
    .m328-reg2-target[hidden]{display:none!important}
    .m328-reg2-picker{display:grid;gap:8px}
    .m328-reg2-search{width:100%}
    .m328-reg2-results{display:grid;gap:5px;max-height:270px;overflow:auto}
    .m328-reg2-choice{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:inherit;text-align:left}
    .m328-reg2-choice strong{font-size:.82rem}.m328-reg2-choice small{color:var(--muted);font-size:.68rem;white-space:nowrap}
    .m328-reg2-guest,.m328-reg2-group{display:grid;gap:8px}.m328-reg2-guest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m328-reg2-guest-grid label:last-child{grid-column:1/-1}
    .m328-reg2-stack{display:grid;gap:7px}
    .m328-reg2-booking{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
    .m328-reg2-booking-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line)}
    .m328-reg2-booking-head strong{display:block;font-size:.86rem}.m328-reg2-booking-head small{display:block;color:var(--muted);font-size:.68rem;margin-top:2px}
    .m328-reg2-booking-actions{display:flex;gap:4px;align-items:center}
    .m328-reg2-person{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:9px 10px;border-bottom:1px solid var(--line)}
    .m328-reg2-person:last-child{border-bottom:0}.m328-reg2-person-name{grid-column:1/-1;padding-right:30px}.m328-reg2-person-name strong{display:block;font-size:.82rem}.m328-reg2-person-name small{color:var(--muted);font-size:.67rem}
    .m328-reg2-person label{display:grid;gap:3px;font-size:.69rem;font-weight:750}.m328-reg2-note{grid-column:1/-1}.m328-reg2-person select,.m328-reg2-person input{width:100%;min-height:38px}
    .m328-reg2-remove{position:absolute;right:7px;top:7px;width:28px;min-width:28px;height:28px}
    .m328-reg2-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:var(--surface-2);font-size:.72rem;font-weight:850}
    .m328-reg2-submit{display:grid;gap:9px}.m328-reg2-consent{display:flex;align-items:flex-start;gap:8px;font-size:.74rem;line-height:1.35}.m328-reg2-submit .button{width:100%;min-height:46px}
    .m328-reg2-empty{margin:0;color:var(--muted);font-size:.78rem}
    .m328-reg2-group-review{padding:9px;border-radius:10px;background:var(--surface-2);font-size:.73rem;line-height:1.35}.m328-reg2-group-review p{margin:5px 0}
    @media(max-width:520px){.m328-reg2-types{grid-template-columns:repeat(2,minmax(0,1fr))}.m328-reg2-guest-grid,.m328-reg2-person{grid-template-columns:1fr}.m328-reg2-guest-grid label:last-child,.m328-reg2-note{grid-column:auto}.m328-reg2-booking-head{align-items:start}.m328-reg2-booking-actions{flex-direction:column;align-items:stretch}.m328-reg2-booking-actions .button{padding:5px 7px;font-size:.68rem}}
  `;
  document.head.appendChild(style);
}

function personChoice(source, item) {
  if (source === "MEMBER" || source === "PORTAL_USER") {
    return {
      key: manualPersonKey(item),
      source,
      identityKey: item.portalUserId ? `PORTAL:${item.portalUserId}` : `MEMBER:${item.memberId}`,
      firstName: item.firstName,
      lastName: item.lastName,
      defaultBoardingStopId: item.defaultBoardingStopId || null,
      busPreference: item.defaultBusPreference || "EGAL",
      ...(source === "MEMBER" ? { memberId: item.memberId } : { portalUserId: item.portalUserId })
    };
  }
  return {
    key: `REGULAR_RIDER:${item.id}`,
    source: "REGULAR_RIDER",
    identityKey: item.effectiveIdentityKey || `REGULAR_RIDER:${item.id}`,
    firstName: item.effectiveFirstName || item.firstName,
    lastName: item.effectiveLastName || item.lastName,
    regularRiderId: item.id,
    defaultBoardingStopId: item.defaultBoardingStopId || null,
    busPreference: item.defaultBusPreference || "EGAL"
  };
}

function choicesForSource(state, source) {
  if (source === "MEMBER" || source === "PORTAL_USER") {
    return state.people
      .filter(person => person.personType === source)
      .map(person => personChoice(source, person));
  }
  if (source === "REGULAR_RIDER") {
    return state.riders.filter(rider => rider.isActive).map(rider => personChoice(source, rider));
  }
  return [];
}

function choiceToParticipant(state, choice) {
  return {
    ...choice,
    boardingStopId: preferredTripStopId(state, choice.defaultBoardingStopId),
    busPreference: choice.busPreference || "EGAL",
    operationalNote: ""
  };
}

function targetLabel(state) {
  if (!state.targetBookingId) return "";
  const index = state.bookings.findIndex(booking => booking.clientId === state.targetBookingId);
  return index >= 0 ? `Buchung ${index + 1}` : "";
}

function renderTarget(state) {
  const target = document.getElementById("m328Reg2Target");
  if (!target) return;
  const label = targetLabel(state);
  target.hidden = !label;
  target.innerHTML = label
    ? `<span>Nächste Auswahl wird zu <strong>${escapeHtml(label)}</strong> hinzugefügt.</span><button class="button tiny ghost" type="button" data-m328-reg2-target-clear>Abbrechen</button>`
    : "";
  target.querySelector("[data-m328-reg2-target-clear]")?.addEventListener("click", () => {
    state.targetBookingId = null;
    renderTarget(state);
  });
}

function renderSearchPicker(state) {
  const target = document.getElementById("m328Reg2Picker");
  if (!target) return;
  const choices = choicesForSource(state, state.source)
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "de"));
  target.innerHTML = `<label>Person suchen<input class="m328-reg2-search" type="search" autocomplete="off" placeholder="Name eingeben …" data-m328-reg2-search></label><div class="m328-reg2-results" data-m328-reg2-results></div>`;
  const search = target.querySelector("[data-m328-reg2-search]");
  const results = target.querySelector("[data-m328-reg2-results]");
  const paint = () => {
    const query = String(search?.value || "").trim().toLocaleLowerCase("de-DE");
    const visible = choices.filter(choice => !query || `${choice.firstName} ${choice.lastName}`.toLocaleLowerCase("de-DE").includes(query)).slice(0, 50);
    results.innerHTML = visible.length ? visible.map(choice => `<button class="m328-reg2-choice" type="button" data-m328-reg2-choice="${escapeAttr(choice.key)}"><strong>${escapeHtml(`${choice.firstName} ${choice.lastName}`)}</strong><small>${state.targetBookingId ? "zu Buchung" : "Einzelbuchung"}</small></button>`).join("") : empty("Keine passende Person gefunden.");
    results.querySelectorAll("[data-m328-reg2-choice]").forEach(button => button.addEventListener("click", () => {
      const choice = choices.find(item => item.key === button.dataset.m328Reg2Choice);
      if (!choice) return;
      try {
        addToTargetOrNew(state, choiceToParticipant(state, choice));
        showToast(`${choice.firstName} ${choice.lastName} hinzugefügt.`, "success", 2200);
      } catch (error) {
        showToast(error?.message || "Person konnte nicht hinzugefügt werden.", "warning", 4200);
      }
    }));
  };
  search?.addEventListener("input", paint);
  paint();
}

function renderGuestPicker(state) {
  const target = document.getElementById("m328Reg2Picker");
  if (!target) return;
  target.innerHTML = `<form class="m328-reg2-guest" data-m328-reg2-guest-form><div class="m328-reg2-guest-grid"><label>Vorname<input name="firstName" maxlength="160" required></label><label>Nachname<input name="lastName" maxlength="160" required></label><label>E-Mail (optional)<input name="email" type="email" maxlength="320"></label></div><button class="button secondary" type="submit">${state.targetBookingId ? "Gast zu Buchung hinzufügen" : "Gast als Einzelbuchung"}</button></form>`;
  const form = target.querySelector("[data-m328-reg2-guest-form]");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    try {
      addToTargetOrNew(state, {
        source: "GUEST",
        firstName: String(values.firstName || "").trim(),
        lastName: String(values.lastName || "").trim(),
        email: String(values.email || "").trim() || null,
        boardingStopId: defaultStopId(state),
        busPreference: "EGAL",
        operationalNote: ""
      });
      form.reset();
      showToast("Gast hinzugefügt.", "success", 2200);
    } catch (error) {
      showToast(error?.message || "Gast konnte nicht hinzugefügt werden.", "warning", 4200);
    }
  });
}

function groupMemberParticipant(state, member) {
  return {
    source: member.anchorType,
    identityKey: member.identityKey,
    firstName: member.firstName,
    lastName: member.lastName,
    ...(member.anchorType === "PORTAL_USER" ? { portalUserId: member.anchorId } : {}),
    ...(member.anchorType === "MEMBER" ? { memberId: member.anchorId } : {}),
    ...(member.anchorType === "REGULAR_RIDER" ? { regularRiderId: member.anchorId } : {}),
    boardingStopId: member.tripBoardingStopId || preferredTripStopId(state, member.defaultBoardingStopId),
    busPreference: member.defaultBusPreference || "EGAL",
    operationalNote: ""
  };
}

function renderGroupPicker(state) {
  const target = document.getElementById("m328Reg2Picker");
  if (!target) return;
  const groups = state.groups.filter(group => group.isActive);
  target.innerHTML = `<form class="m328-reg2-group" data-m328-reg2-group-form><label>Gruppe<select name="groupId" required><option value="">Bitte wählen</option>${groups.map(group => `<option value="${escapeAttr(group.id)}">${escapeHtml(`${group.name} · ${group.memberCount} Personen`)}</option>`).join("")}</select></label><button class="button secondary" type="submit">${state.targetBookingId ? "Gruppe zu Buchung hinzufügen" : "Gruppe als eine Buchung"}</button><div data-m328-reg2-group-review aria-live="polite"></div></form>`;
  const form = target.querySelector("[data-m328-reg2-group-form]");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type=submit]");
    const review = form.querySelector("[data-m328-reg2-group-review]");
    button.disabled = true;
    try {
      const resolved = await call("fanbus_person_group_resolve", {
        id: form.elements.groupId.value,
        tripId: state.trip.id
      });
      const members = Array.isArray(resolved?.members) ? resolved.members : [];
      const selectedKeys = new Set(allParticipants(state).map(participantIdentity));
      const unavailable = members.filter(member => !member.available);
      const collisions = members.filter(member => member.conflict || selectedKeys.has(member.identityKey));
      const eligible = members.filter(member => member.available && !member.conflict && !selectedKeys.has(member.identityKey));
      const participants = eligible.map(member => groupMemberParticipant(state, member));

      if (!unavailable.length && !collisions.length) {
        addManyToTargetOrNew(state, participants);
        form.reset();
        review.innerHTML = "";
        showToast(`${participants.length} Personen als Buchung übernommen.`, "success", 2800);
        return;
      }

      review.innerHTML = `<div class="m328-reg2-group-review"><strong>Gruppe prüfen</strong><p>${eligible.length} von ${members.length} Personen können übernommen werden.</p>${unavailable.length ? `<p><strong>Nicht verfügbar:</strong> ${unavailable.map(personName).map(escapeHtml).join(", ")}</p>` : ""}${collisions.length ? `<p><strong>Bereits erfasst/Konflikt:</strong> ${collisions.map(personName).map(escapeHtml).join(", ")}</p>` : ""}${eligible.length ? `<button class="button small secondary" type="button" data-m328-reg2-accept-group>Verfügbare übernehmen</button>` : ""}</div>`;
      review.querySelector("[data-m328-reg2-accept-group]")?.addEventListener("click", () => {
        try {
          addManyToTargetOrNew(state, participants);
          form.reset();
          review.innerHTML = "";
          showToast(`${participants.length} Personen übernommen.`, "success", 2800);
        } catch (error) {
          showToast(error?.message || "Gruppe konnte nicht übernommen werden.", "warning", 4200);
        }
      });
    } catch (error) {
      showToast(error?.message || "Gruppe konnte nicht geladen werden.", "error", 5200);
    } finally {
      button.disabled = false;
    }
  });
}

function renderPicker(state) {
  document.querySelectorAll("[data-m328-reg2-source]").forEach(button => {
    const active = button.dataset.m328Reg2Source === state.source;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderTarget(state);
  if (state.source === "GUEST") renderGuestPicker(state);
  else if (state.source === "GROUP") renderGroupPicker(state);
  else renderSearchPicker(state);
}

function participantFields(state, bookingIndex, personIndex, person) {
  return `<div class="m328-reg2-person" data-booking-index="${bookingIndex}" data-person-index="${personIndex}"><div class="m328-reg2-person-name"><strong>${escapeHtml(personName(person))}</strong><small>${escapeHtml(sourceLabel(person.source))}</small></div><button class="icon-button m328-reg2-remove" type="button" data-m328-reg2-remove="${bookingIndex}:${personIndex}" aria-label="${escapeAttr(`${personName(person)} entfernen`)}">×</button>${activeStops(state).length ? `<label>Zustieg<select required data-m328-reg2-stop="${bookingIndex}:${personIndex}">${stopOptions(state, person.boardingStopId)}</select></label>` : ""}${state.trip.busPreferenceSelectionEnabled ? `<label>Buswunsch<select data-m328-reg2-preference="${bookingIndex}:${personIndex}">${preferenceOptions(person.busPreference || "EGAL")}</select></label>` : ""}<label class="m328-reg2-note">Hinweis (optional)<input maxlength="240" data-m328-reg2-note="${bookingIndex}:${personIndex}" value="${escapeAttr(person.operationalNote || "")}"></label></div>`;
}

function bookingCard(state, booking, bookingIndex) {
  const count = booking.participants.length;
  const kind = count > 1 ? "Gemeinsame Buchung" : "Einzelbuchung";
  const names = booking.participants.slice(0, 3).map(personName).join(", ");
  return `<article class="m328-reg2-booking"><header class="m328-reg2-booking-head"><div><strong>Buchung ${bookingIndex + 1} · ${escapeHtml(kind)}</strong><small>${count} ${count === 1 ? "Person" : "Personen"}${names ? ` · ${escapeHtml(names)}${count > 3 ? " …" : ""}` : ""}</small></div><div class="m328-reg2-booking-actions"><button class="button tiny secondary" type="button" data-m328-reg2-add-to-booking="${escapeAttr(booking.clientId)}">＋ Person</button><button class="button tiny ghost" type="button" data-m328-reg2-remove-booking="${escapeAttr(booking.clientId)}">Entfernen</button></div></header>${booking.participants.map((person, personIndex) => participantFields(state, bookingIndex, personIndex, person)).join("")}</article>`;
}

function parsePair(value) {
  const [bookingIndex, personIndex] = String(value || "").split(":").map(Number);
  return { bookingIndex, personIndex };
}

function renderBookingStack(state) {
  const target = document.getElementById("m328Reg2Bookings");
  const bookingCount = document.getElementById("m328Reg2BookingCount");
  const participantCount = document.getElementById("m328Reg2ParticipantCount");
  if (!target) return;
  if (bookingCount) bookingCount.textContent = String(state.bookings.length);
  if (participantCount) participantCount.textContent = String(totalParticipantCount(state));
  target.innerHTML = state.bookings.length
    ? state.bookings.map((booking, index) => bookingCard(state, booking, index)).join("")
    : '<p class="m328-reg2-empty">Noch keine Buchung vorbereitet. Einzelperson oder Gruppe oben auswählen.</p>';

  target.querySelectorAll("[data-m328-reg2-add-to-booking]").forEach(button => button.addEventListener("click", () => {
    state.targetBookingId = button.dataset.m328Reg2AddToBooking;
    renderTarget(state);
  }));
  target.querySelectorAll("[data-m328-reg2-remove-booking]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.m328Reg2RemoveBooking;
    state.bookings = state.bookings.filter(booking => booking.clientId !== id);
    if (state.targetBookingId === id) state.targetBookingId = null;
    renderBookingStack(state);
    renderTarget(state);
  }));
  target.querySelectorAll("[data-m328-reg2-remove]").forEach(button => button.addEventListener("click", () => {
    const { bookingIndex, personIndex } = parsePair(button.dataset.m328Reg2Remove);
    const booking = state.bookings[bookingIndex];
    if (!booking) return;
    booking.participants.splice(personIndex, 1);
    if (!booking.participants.length) {
      if (state.targetBookingId === booking.clientId) state.targetBookingId = null;
      state.bookings.splice(bookingIndex, 1);
    }
    renderBookingStack(state);
    renderTarget(state);
  }));
  target.querySelectorAll("[data-m328-reg2-stop]").forEach(select => select.addEventListener("change", () => {
    const { bookingIndex, personIndex } = parsePair(select.dataset.m328Reg2Stop);
    if (state.bookings[bookingIndex]?.participants[personIndex]) state.bookings[bookingIndex].participants[personIndex].boardingStopId = select.value;
  }));
  target.querySelectorAll("[data-m328-reg2-preference]").forEach(select => select.addEventListener("change", () => {
    const { bookingIndex, personIndex } = parsePair(select.dataset.m328Reg2Preference);
    if (state.bookings[bookingIndex]?.participants[personIndex]) state.bookings[bookingIndex].participants[personIndex].busPreference = select.value;
  }));
  target.querySelectorAll("[data-m328-reg2-note]").forEach(input => input.addEventListener("input", () => {
    const { bookingIndex, personIndex } = parsePair(input.dataset.m328Reg2Note);
    if (state.bookings[bookingIndex]?.participants[personIndex]) state.bookings[bookingIndex].participants[personIndex].operationalNote = input.value;
  }));
}

function participantPayload(state, person) {
  return {
    source: person.source,
    ...(person.portalUserId ? { portalUserId: person.portalUserId } : {}),
    ...(person.memberId ? { memberId: person.memberId } : {}),
    ...(person.regularRiderId ? { regularRiderId: person.regularRiderId } : {}),
    ...(person.source === "GUEST" ? {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email || null
    } : {}),
    ...(person.boardingStopId ? { boardingStopId: person.boardingStopId } : {}),
    busPreference: state.trip.busPreferenceSelectionEnabled ? person.busPreference || "EGAL" : "EGAL",
    operationalNote: person.operationalNote || null
  };
}

async function submitRegistration(state, form) {
  if (!state.bookings.length) {
    showToast("Füge mindestens eine Buchung hinzu.", "warning", 4200);
    return;
  }
  if (!form.reportValidity()) return;
  const payload = {
    tripId: state.trip.id,
    bookings: state.bookings.map(booking => ({
      participants: booking.participants.map(person => participantPayload(state, person))
    })),
    termsConfirmed: form.elements.consentConfirmed.checked
  };
  const fingerprint = JSON.stringify(payload);
  if (manualAttempt?.fingerprint !== fingerprint) {
    manualAttempt = { fingerprint, key: crypto.randomUUID() };
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const result = await call("fanbus_registration_create_manual_batches", {
      ...payload,
      idempotencyKey: manualAttempt.key
    });
    if (!["CREATED", "WAITLISTED"].includes(result?.outcome)) {
      throw new Error("Die Buchungen konnten nicht gespeichert werden.");
    }
    const numbers = Array.isArray(result?.bookings)
      ? result.bookings.map(item => item.bookingNumber).filter(Boolean)
      : [];
    showToast(
      `${result.bookingCount || state.bookings.length} Buchung(en) mit ${result.participantCount || totalParticipantCount(state)} Person(en) gespeichert${numbers.length ? ` · ${numbers.join(", ")}` : ""}.`,
      result.outcome === "WAITLISTED" ? "warning" : "success",
      5200
    );
    location.hash = "#/bus-orga";
  } catch (error) {
    showToast(error?.message || "Buchungen konnten nicht gespeichert werden.", "error", 5600);
    button.disabled = false;
  }
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-reg2"><header class="m328-reg2-head"><button class="button small ghost" type="button" id="m328Reg2Back">← Bus-Orga</button><div class="m328-reg2-title"><h2>Anmeldung • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header><section class="m328-reg2-panel"><div class="m328-reg2-panel-head"><div><span class="m328-reg2-kicker">Buchungen zusammenstellen</span><h3>Person oder Gruppe hinzufügen</h3></div></div><div class="m328-reg2-types" role="group" aria-label="Art der Auswahl"><button class="m328-reg2-type" type="button" data-m328-reg2-source="GUEST">Gast</button><button class="m328-reg2-type" type="button" data-m328-reg2-source="MEMBER">Mitglied</button><button class="m328-reg2-type" type="button" data-m328-reg2-source="PORTAL_USER">Portaluser</button><button class="m328-reg2-type" type="button" data-m328-reg2-source="REGULAR_RIDER">Stammfahrer</button><button class="m328-reg2-type" type="button" data-m328-reg2-source="GROUP">Gruppe</button></div><div id="m328Reg2Target" class="m328-reg2-target" hidden></div><div id="m328Reg2Picker" class="m328-reg2-picker"></div></section><form id="m328Reg2Submit" class="m328-reg2-submit"><section class="m328-reg2-panel"><div class="m328-reg2-panel-head"><div><span class="m328-reg2-kicker">Sammelerfassung</span><h3>Vorbereitete Buchungen</h3></div><div><span id="m328Reg2BookingCount" class="m328-reg2-count">0</span> <span class="subtle">Buchungen</span> · <span id="m328Reg2ParticipantCount" class="m328-reg2-count">0</span> <span class="subtle">Personen</span></div></div><div id="m328Reg2Bookings" class="m328-reg2-stack"></div></section><section class="m328-reg2-panel"><label class="m328-reg2-consent"><input name="consentConfirmed" type="checkbox" required><span>Für alle erfassten Personen wurden Teilnahmebedingungen und Datenschutzhinweise bestätigt.</span></label><button class="button primary" type="submit">Alle Buchungen speichern</button></section></form></div>`;

  document.getElementById("m328Reg2Back")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });
  document.querySelectorAll("[data-m328-reg2-source]").forEach(button => button.addEventListener("click", () => {
    state.source = button.dataset.m328Reg2Source;
    renderPicker(state);
  }));
  const form = document.getElementById("m328Reg2Submit");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    void submitRegistration(state, form);
  });
  renderPicker(state);
  renderBookingStack(state);
}

export async function hydrateBusOrgaRegistrationV2(context = {}) {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  if (!hasCapability("fanbus.registrations.manage")) {
    root.innerHTML = '<div class="notice error">Für Anmeldungen fehlt die erforderliche Berechtigung.</div>';
    return;
  }
  const tripId = routeParams().get("trip") || "";
  if (!tripId) {
    root.innerHTML = '<div class="notice error">Es wurde keine Fahrt ausgewählt.</div><button class="button secondary" type="button" onclick="location.hash=\'#/bus-orga\'">← Bus-Orga</button>';
    return;
  }
  root.innerHTML = loading("Anmeldung wird geladen …");
  try {
    const [tripData, peopleData, riderData, groupData, stopData] = await Promise.all([
      call("fanbus_trips_list"),
      call("fanbus_registration_people_list"),
      call("fanbus_regular_riders_list"),
      call("fanbus_person_groups_list"),
      call("fanbus_trip_boarding_stops_list", { tripId })
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(tripData?.trips) ? tripData.trips : []).find(item => item.id === tripId);
    if (!trip || trip.canManageRegistrations === false || trip.status !== "PUBLISHED") {
      throw new Error("Diese Fahrt ist nicht für eine neue Bus-Orga-Anmeldung verfügbar.");
    }
    const state = {
      trip,
      people: deduplicatePeople(Array.isArray(peopleData?.people) ? peopleData.people : []),
      riders: Array.isArray(riderData?.regularRiders) ? riderData.regularRiders : [],
      groups: Array.isArray(groupData?.groups) ? groupData.groups : [],
      stops: Array.isArray(stopData?.stops) ? stopData.stops : [],
      bookings: [],
      source: "MEMBER",
      targetBookingId: null
    };
    manualAttempt = null;
    renderPage(root, state);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Anmeldung konnte nicht geladen werden.")}</div><button id="m328Reg2LoadBack" class="button secondary" type="button">← Bus-Orga</button>`;
    document.getElementById("m328Reg2LoadBack")?.addEventListener("click", () => {
      location.hash = "#/bus-orga";
    });
  }
}

export function noop() {}

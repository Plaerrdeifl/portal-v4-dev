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

const SEARCH_FILTERS = Object.freeze([
  { value: "ALL", label: "Alle" },
  { value: "MEMBER", label: "Mitglieder" },
  { value: "PORTAL_USER", label: "Portaluser" },
  { value: "REGULAR_RIDER", label: "Stammfahrer" }
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

function addToTargetOrNew(state, participant) {
  const identityKey = assertParticipantAvailable(state, participant);
  const target = state.targetBookingId
    ? state.bookings.find(booking => booking.clientId === state.targetBookingId)
    : null;
  if (target) {
    target.participants.push({ ...participant, identityKey });
    target.kind = target.participants.length > 1 ? "GROUP" : target.kind;
    state.targetBookingId = null;
  } else {
    state.bookings.push({
      clientId: crypto.randomUUID(),
      kind: "INDIVIDUAL",
      participants: [{ ...participant, identityKey }]
    });
  }
  renderBookingStack(state);
  renderTarget(state);
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
    state.targetBookingId = null;
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
  renderTarget(state);
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
  if (document.getElementById("m328PersonSearchRegistrationStyle")) return;
  const style = document.createElement("style");
  style.id = "m328PersonSearchRegistrationStyle";
  style.textContent = `
    .m328-reg3{display:grid;gap:10px;width:100%;overflow-x:clip}
    .m328-reg3 *{box-sizing:border-box;min-width:0}
    .m328-reg3-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-reg3-title{display:grid;gap:2px}
    .m328-reg3-title h2{margin:0;font-size:1.28rem;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-reg3-title span{color:var(--muted);font-size:.76rem;font-weight:700}
    .m328-reg3-panel{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-reg3-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}
    .m328-reg3-panel-head h3{margin:0;font-size:1rem}
    .m328-reg3-search-label{display:grid;gap:5px;font-size:.74rem;font-weight:800}
    .m328-reg3-search{width:100%;min-height:46px;font-size:1rem}
    .m328-reg3-filters{display:flex;gap:6px;overflow-x:auto;padding:8px 0 9px;scrollbar-width:none}
    .m328-reg3-filters::-webkit-scrollbar{display:none}
    .m328-reg3-filter{flex:0 0 auto;min-height:34px;padding:5px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:inherit;font-size:.72rem;font-weight:800}
    .m328-reg3-filter.is-active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent)}
    .m328-reg3-results{display:grid;gap:6px;max-height:280px;overflow:auto}
    .m328-reg3-choice{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:inherit;text-align:left}
    .m328-reg3-choice strong{display:block;font-size:.84rem}.m328-reg3-choice small{display:block;margin-top:2px;color:var(--muted);font-size:.68rem}
    .m328-reg3-choice-action{color:var(--accent);font-size:.7rem;font-weight:850;white-space:nowrap}
    .m328-reg3-target{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;padding:8px 9px;border-radius:10px;background:var(--surface-2);font-size:.73rem}
    .m328-reg3-target[hidden]{display:none!important}
    .m328-reg3-special-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
    .m328-reg3-special-actions .button{width:100%;min-height:40px}
    .m328-reg3-special-panel{display:grid;gap:8px;margin-top:8px}
    .m328-reg3-special-panel[hidden]{display:none!important}
    .m328-reg3-guest,.m328-reg3-group{display:grid;gap:8px;padding:10px;border-radius:11px;background:var(--surface-2)}
    .m328-reg3-guest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m328-reg3-guest-grid label:last-child{grid-column:1/-1}
    .m328-reg3-stack{display:grid;gap:7px}
    .m328-reg3-booking{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}
    .m328-reg3-booking-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line)}
    .m328-reg3-booking-head strong{display:block;font-size:.86rem}.m328-reg3-booking-head small{display:block;color:var(--muted);font-size:.68rem;margin-top:2px}
    .m328-reg3-booking-actions{display:flex;gap:4px;align-items:center}
    .m328-reg3-person{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:9px 10px;border-bottom:1px solid var(--line)}
    .m328-reg3-person:last-child{border-bottom:0}.m328-reg3-person-name{grid-column:1/-1;padding-right:30px}.m328-reg3-person-name strong{display:block;font-size:.82rem}.m328-reg3-person-name small{color:var(--muted);font-size:.67rem}
    .m328-reg3-person label{display:grid;gap:3px;font-size:.69rem;font-weight:750}.m328-reg3-note{grid-column:1/-1}.m328-reg3-person select,.m328-reg3-person input{width:100%;min-height:38px}
    .m328-reg3-remove{position:absolute;right:7px;top:7px;width:28px;min-width:28px;height:28px}
    .m328-reg3-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:var(--surface-2);font-size:.72rem;font-weight:850}
    .m328-reg3-submit{display:grid;gap:9px}.m328-reg3-consent{display:flex;align-items:flex-start;gap:8px;font-size:.74rem;line-height:1.35}.m328-reg3-submit>.m328-reg3-panel>.button{width:100%;min-height:46px}
    .m328-reg3-empty{margin:0;color:var(--muted);font-size:.78rem}
    .m328-reg3-group-review{padding:9px;border-radius:10px;background:var(--surface);font-size:.73rem;line-height:1.35}.m328-reg3-group-review p{margin:5px 0}
    @media(max-width:520px){.m328-reg3-special-actions,.m328-reg3-guest-grid,.m328-reg3-person{grid-template-columns:1fr}.m328-reg3-guest-grid label:last-child,.m328-reg3-note{grid-column:auto}.m328-reg3-booking-head{align-items:start}.m328-reg3-booking-actions{flex-direction:column;align-items:stretch}.m328-reg3-booking-actions .button{padding:5px 7px;font-size:.68rem}}
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

function allSearchChoices(state) {
  const raw = [
    ...state.people.map(person => personChoice(person.personType, person)),
    ...state.riders.filter(rider => rider.isActive).map(rider => personChoice("REGULAR_RIDER", rider))
  ];
  const seen = new Set();
  return raw.filter(choice => {
    const key = choice.identityKey || choice.key;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "de"));
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
  const target = document.getElementById("m328Reg3Target");
  if (!target) return;
  const label = targetLabel(state);
  target.hidden = !label;
  target.innerHTML = label
    ? `<span>Die nächste Auswahl wird zu <strong>${escapeHtml(label)}</strong> hinzugefügt.</span><button class="button tiny ghost" type="button" data-m328-reg3-target-clear>Abbrechen</button>`
    : "";
  target.querySelector("[data-m328-reg3-target-clear]")?.addEventListener("click", () => {
    state.targetBookingId = null;
    renderTarget(state);
  });
}

function filteredChoices(state) {
  const query = String(state.searchQuery || "").trim().toLocaleLowerCase("de-DE");
  return allSearchChoices(state)
    .filter(choice => state.searchFilter === "ALL" || choice.source === state.searchFilter)
    .filter(choice => !query || `${choice.firstName} ${choice.lastName}`.toLocaleLowerCase("de-DE").includes(query))
    .slice(0, 50);
}

function paintSearchResults(state) {
  const target = document.getElementById("m328Reg3Results");
  if (!target) return;
  const visible = filteredChoices(state);
  target.innerHTML = visible.length
    ? visible.map(choice => `<button class="m328-reg3-choice" type="button" data-m328-reg3-choice="${escapeAttr(choice.key)}"><span><strong>${escapeHtml(`${choice.firstName} ${choice.lastName}`)}</strong><small>${escapeHtml(sourceLabel(choice.source))}</small></span><span class="m328-reg3-choice-action">Hinzufügen</span></button>`).join("")
    : empty("Keine passende Person gefunden.");
  const choices = allSearchChoices(state);
  target.querySelectorAll("[data-m328-reg3-choice]").forEach(button => button.addEventListener("click", () => {
    const choice = choices.find(item => item.key === button.dataset.m328Reg3Choice);
    if (!choice) return;
    try {
      addToTargetOrNew(state, choiceToParticipant(state, choice));
      showToast(`${choice.firstName} ${choice.lastName} hinzugefügt.`, "success", 2200);
    } catch (error) {
      showToast(error?.message || "Person konnte nicht hinzugefügt werden.", "warning", 4200);
    }
  }));
}

function renderSearchFilters(state) {
  const target = document.getElementById("m328Reg3Filters");
  if (!target) return;
  target.innerHTML = SEARCH_FILTERS.map(filter => `<button class="m328-reg3-filter${filter.value === state.searchFilter ? " is-active" : ""}" type="button" data-m328-reg3-filter="${filter.value}" aria-pressed="${filter.value === state.searchFilter}">${escapeHtml(filter.label)}</button>`).join("");
  target.querySelectorAll("[data-m328-reg3-filter]").forEach(button => button.addEventListener("click", () => {
    state.searchFilter = button.dataset.m328Reg3Filter;
    renderSearchFilters(state);
    paintSearchResults(state);
  }));
}

function renderSearch(state) {
  const input = document.getElementById("m328Reg3Search");
  if (input) {
    input.value = state.searchQuery;
    input.addEventListener("input", () => {
      state.searchQuery = input.value;
      paintSearchResults(state);
    });
  }
  renderSearchFilters(state);
  paintSearchResults(state);
}

function closeSpecialPanel(state) {
  state.specialMode = "";
  const panel = document.getElementById("m328Reg3SpecialPanel");
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }
  document.querySelectorAll("[data-m328-reg3-special]").forEach(button => button.classList.remove("is-active"));
}

function renderGuestPanel(state) {
  const target = document.getElementById("m328Reg3SpecialPanel");
  if (!target) return;
  target.hidden = false;
  target.innerHTML = `<form class="m328-reg3-guest" data-m328-reg3-guest-form><strong>Gast hinzufügen</strong><div class="m328-reg3-guest-grid"><label>Vorname<input name="firstName" maxlength="160" required></label><label>Nachname<input name="lastName" maxlength="160" required></label><label>E-Mail (optional)<input name="email" type="email" maxlength="320"></label></div><button class="button secondary" type="submit">${state.targetBookingId ? "Gast zu Buchung hinzufügen" : "Gast als Einzelbuchung"}</button></form>`;
  const form = target.querySelector("[data-m328-reg3-guest-form]");
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
      closeSpecialPanel(state);
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

function renderGroupPanel(state) {
  const target = document.getElementById("m328Reg3SpecialPanel");
  if (!target) return;
  const groups = state.groups.filter(group => group.isActive);
  target.hidden = false;
  target.innerHTML = `<form class="m328-reg3-group" data-m328-reg3-group-form><strong>Gruppe auswählen</strong><label>Gruppe<select name="groupId" required><option value="">Bitte wählen</option>${groups.map(group => `<option value="${escapeAttr(group.id)}">${escapeHtml(`${group.name} · ${group.memberCount} Personen`)}</option>`).join("")}</select></label><button class="button secondary" type="submit">${state.targetBookingId ? "Gruppe zu Buchung hinzufügen" : "Gruppe als eine Buchung"}</button><div data-m328-reg3-group-review aria-live="polite"></div></form>`;
  const form = target.querySelector("[data-m328-reg3-group-form]");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type=submit]");
    const review = form.querySelector("[data-m328-reg3-group-review]");
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
        closeSpecialPanel(state);
        showToast(`${participants.length} Personen als Buchung übernommen.`, "success", 2800);
        return;
      }

      review.innerHTML = `<div class="m328-reg3-group-review"><strong>Gruppe prüfen</strong><p>${eligible.length} von ${members.length} Personen können übernommen werden.</p>${unavailable.length ? `<p><strong>Nicht verfügbar:</strong> ${unavailable.map(personName).map(escapeHtml).join(", ")}</p>` : ""}${collisions.length ? `<p><strong>Bereits erfasst/Konflikt:</strong> ${collisions.map(personName).map(escapeHtml).join(", ")}</p>` : ""}${eligible.length ? `<button class="button small secondary" type="button" data-m328-reg3-accept-group>Verfügbare übernehmen</button>` : ""}</div>`;
      review.querySelector("[data-m328-reg3-accept-group]")?.addEventListener("click", () => {
        try {
          addManyToTargetOrNew(state, participants);
          closeSpecialPanel(state);
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

function bindSpecialActions(state) {
  document.querySelectorAll("[data-m328-reg3-special]").forEach(button => button.addEventListener("click", () => {
    const mode = button.dataset.m328Reg3Special;
    if (state.specialMode === mode) {
      closeSpecialPanel(state);
      return;
    }
    state.specialMode = mode;
    document.querySelectorAll("[data-m328-reg3-special]").forEach(item => item.classList.toggle("is-active", item === button));
    if (mode === "GUEST") renderGuestPanel(state);
    else renderGroupPanel(state);
  }));
}

function participantFields(state, bookingIndex, personIndex, person) {
  return `<div class="m328-reg3-person" data-booking-index="${bookingIndex}" data-person-index="${personIndex}"><div class="m328-reg3-person-name"><strong>${escapeHtml(personName(person))}</strong><small>${escapeHtml(sourceLabel(person.source))}</small></div><button class="icon-button m328-reg3-remove" type="button" data-m328-reg3-remove="${bookingIndex}:${personIndex}" aria-label="${escapeAttr(`${personName(person)} entfernen`)}">×</button>${activeStops(state).length ? `<label>Zustieg<select required data-m328-reg3-stop="${bookingIndex}:${personIndex}">${stopOptions(state, person.boardingStopId)}</select></label>` : ""}${state.trip.busPreferenceSelectionEnabled ? `<label>Buswunsch<select data-m328-reg3-preference="${bookingIndex}:${personIndex}">${preferenceOptions(person.busPreference || "EGAL")}</select></label>` : ""}<label class="m328-reg3-note">Hinweis (optional)<input maxlength="240" data-m328-reg3-note="${bookingIndex}:${personIndex}" value="${escapeAttr(person.operationalNote || "")}"></label></div>`;
}

function bookingCard(state, booking, bookingIndex) {
  const count = booking.participants.length;
  const kind = count > 1 ? "Gemeinsame Buchung" : "Einzelbuchung";
  const names = booking.participants.slice(0, 3).map(personName).join(", ");
  return `<article class="m328-reg3-booking"><header class="m328-reg3-booking-head"><div><strong>Buchung ${bookingIndex + 1} · ${escapeHtml(kind)}</strong><small>${count} ${count === 1 ? "Person" : "Personen"}${names ? ` · ${escapeHtml(names)}${count > 3 ? " …" : ""}` : ""}</small></div><div class="m328-reg3-booking-actions"><button class="button tiny secondary" type="button" data-m328-reg3-add-to-booking="${escapeAttr(booking.clientId)}">＋ Person</button><button class="button tiny ghost" type="button" data-m328-reg3-remove-booking="${escapeAttr(booking.clientId)}">Entfernen</button></div></header>${booking.participants.map((person, personIndex) => participantFields(state, bookingIndex, personIndex, person)).join("")}</article>`;
}

function parsePair(value) {
  const [bookingIndex, personIndex] = String(value || "").split(":").map(Number);
  return { bookingIndex, personIndex };
}

function renderBookingStack(state) {
  const target = document.getElementById("m328Reg3Bookings");
  const bookingCount = document.getElementById("m328Reg3BookingCount");
  const participantCount = document.getElementById("m328Reg3ParticipantCount");
  if (!target) return;
  if (bookingCount) bookingCount.textContent = String(state.bookings.length);
  if (participantCount) participantCount.textContent = String(totalParticipantCount(state));
  target.innerHTML = state.bookings.length
    ? state.bookings.map((booking, index) => bookingCard(state, booking, index)).join("")
    : '<p class="m328-reg3-empty">Noch keine Buchung vorbereitet. Person suchen oder Gast/Gruppe hinzufügen.</p>';

  target.querySelectorAll("[data-m328-reg3-add-to-booking]").forEach(button => button.addEventListener("click", () => {
    state.targetBookingId = button.dataset.m328Reg3AddToBooking;
    closeSpecialPanel(state);
    renderTarget(state);
    showToast("Nächste Person wird zu dieser Buchung hinzugefügt.", "success", 2200);
  }));
  target.querySelectorAll("[data-m328-reg3-remove-booking]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.m328Reg3RemoveBooking;
    state.bookings = state.bookings.filter(booking => booking.clientId !== id);
    if (state.targetBookingId === id) state.targetBookingId = null;
    renderBookingStack(state);
    renderTarget(state);
  }));
  target.querySelectorAll("[data-m328-reg3-remove]").forEach(button => button.addEventListener("click", () => {
    const { bookingIndex, personIndex } = parsePair(button.dataset.m328Reg3Remove);
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
  target.querySelectorAll("[data-m328-reg3-stop]").forEach(select => select.addEventListener("change", () => {
    const { bookingIndex, personIndex } = parsePair(select.dataset.m328Reg3Stop);
    if (state.bookings[bookingIndex]?.participants[personIndex]) state.bookings[bookingIndex].participants[personIndex].boardingStopId = select.value;
  }));
  target.querySelectorAll("[data-m328-reg3-preference]").forEach(select => select.addEventListener("change", () => {
    const { bookingIndex, personIndex } = parsePair(select.dataset.m328Reg3Preference);
    if (state.bookings[bookingIndex]?.participants[personIndex]) state.bookings[bookingIndex].participants[personIndex].busPreference = select.value;
  }));
  target.querySelectorAll("[data-m328-reg3-note]").forEach(input => input.addEventListener("input", () => {
    const { bookingIndex, personIndex } = parsePair(input.dataset.m328Reg3Note);
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

function clearUnexpectedFormFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input,select,textarea,button")) active.blur();
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-reg3"><header class="m328-reg3-head"><button class="button small ghost" type="button" id="m328Reg3Back">← Bus-Orga</button><div class="m328-reg3-title"><h2>Anmeldung • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header><section class="m328-reg3-panel"><div class="m328-reg3-panel-head"><h3>Person hinzufügen</h3></div><div id="m328Reg3Target" class="m328-reg3-target" hidden></div><label class="m328-reg3-search-label">Person suchen<input id="m328Reg3Search" class="m328-reg3-search" type="search" autocomplete="off" placeholder="Name eingeben …"></label><div id="m328Reg3Filters" class="m328-reg3-filters" role="group" aria-label="Personenfilter"></div><div id="m328Reg3Results" class="m328-reg3-results"></div><div class="m328-reg3-special-actions"><button class="button secondary" type="button" data-m328-reg3-special="GUEST">＋ Gast hinzufügen</button><button class="button secondary" type="button" data-m328-reg3-special="GROUP">＋ Gruppe auswählen</button></div><div id="m328Reg3SpecialPanel" class="m328-reg3-special-panel" hidden></div></section><form id="m328Reg3Submit" class="m328-reg3-submit"><section class="m328-reg3-panel"><div class="m328-reg3-panel-head"><div><h3>Vorbereitete Buchungen</h3></div><div><span id="m328Reg3BookingCount" class="m328-reg3-count">0</span> <span class="subtle">Buchungen</span> · <span id="m328Reg3ParticipantCount" class="m328-reg3-count">0</span> <span class="subtle">Personen</span></div></div><div id="m328Reg3Bookings" class="m328-reg3-stack"></div></section><section class="m328-reg3-panel"><label class="m328-reg3-consent"><input name="consentConfirmed" type="checkbox" required><span>Für alle erfassten Personen wurden Teilnahmebedingungen und Datenschutzhinweise bestätigt.</span></label><button class="button primary" type="submit">Alle Buchungen speichern</button></section></form></div>`;

  document.getElementById("m328Reg3Back")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });
  const form = document.getElementById("m328Reg3Submit");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    void submitRegistration(state, form);
  });
  renderTarget(state);
  renderSearch(state);
  bindSpecialActions(state);
  renderBookingStack(state);
  clearUnexpectedFormFocus();
  requestAnimationFrame(clearUnexpectedFormFocus);
  setTimeout(clearUnexpectedFormFocus, 0);
}

export async function hydrateBusOrgaRegistrationV3(context = {}) {
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
      searchQuery: "",
      searchFilter: "ALL",
      specialMode: "",
      targetBookingId: null
    };
    manualAttempt = null;
    renderPage(root, state);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Anmeldung konnte nicht geladen werden.")}</div><button id="m328Reg3LoadBack" class="button secondary" type="button">← Bus-Orga</button>`;
    document.getElementById("m328Reg3LoadBack")?.addEventListener("click", () => {
      location.hash = "#/bus-orga";
    });
  }
}

export function noop() {}

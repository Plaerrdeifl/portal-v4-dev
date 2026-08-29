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

function defaultTripStop(state) {
  return activeStops(state).find(stop => stop.boardingStopId === state.trip.defaultBoardingStopId) || null;
}

function stopLabel(stop) {
  return String(stop?.label || "Zustieg").trim() || "Zustieg";
}

function defaultStopId(state) {
  const stop = defaultTripStop(state);
  return stopOptionId(stop);
}

function riderTripStopId(state, rider) {
  const stop = activeStops(state).find(item => item.boardingStopId === rider?.defaultBoardingStopId);
  return stopOptionId(stop) || defaultStopId(state);
}

function participantIdentity(person) {
  if (person.identityKey) return person.identityKey;
  if (person.portalUserId) return `PORTAL:${person.portalUserId}`;
  if (person.memberId) return `MEMBER:${person.memberId}`;
  if (person.regularRiderId) return `REGULAR_RIDER:${person.regularRiderId}`;
  if (person.email) return `GUEST_EMAIL:${String(person.email).toLocaleLowerCase("de-DE")}`;
  return `GUEST_NAME:${String(person.firstName || "").toLocaleLowerCase("de-DE")}:${String(person.lastName || "").toLocaleLowerCase("de-DE")}`;
}

function addParticipant(state, participant) {
  if (state.participants.length >= 20) throw new Error("Pro Anmeldung sind höchstens 20 Personen möglich.");
  const identityKey = participantIdentity(participant);
  if (state.participants.some(item => participantIdentity(item) === identityKey)) {
    throw new Error("Diese Person ist bereits in der Anmeldung enthalten.");
  }
  state.participants.push({ ...participant, identityKey });
  renderParticipants(state);
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
  if (document.getElementById("m328NativeRegistrationStyle")) return;
  const style = document.createElement("style");
  style.id = "m328NativeRegistrationStyle";
  style.textContent = `
    .m328-reg-surface{gap:10px;width:100%;max-width:100%;overflow-x:clip}
    .m328-reg-surface *{box-sizing:border-box;min-width:0}
    .m328-reg-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-reg-head h2{margin:2px 0 0;font-size:1.32rem;line-height:1.1}
    .m328-reg-kicker{display:block;color:var(--muted);font-size:.66rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase}
    .m328-reg-trip{display:grid;gap:4px;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-reg-trip strong{font-size:.95rem;line-height:1.2}
    .m328-reg-trip span{color:var(--muted);font-size:.76rem}
    .m328-reg-panel{padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-reg-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
    .m328-reg-panel h3{margin:0;font-size:1rem}
    .m328-reg-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px}
    .m328-reg-type{width:100%;min-height:42px;padding:7px 6px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:inherit;font-size:.74rem;font-weight:800}
    .m328-reg-type.is-active{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent)}
    .m328-reg-picker{display:grid;gap:8px}
    .m328-reg-search{width:100%}
    .m328-reg-results{display:grid;gap:5px;max-height:280px;overflow:auto}
    .m328-reg-choice{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:inherit;text-align:left}
    .m328-reg-choice strong{font-size:.82rem}
    .m328-reg-choice small{color:var(--muted);font-size:.68rem;white-space:nowrap}
    .m328-reg-guest,.m328-reg-group{display:grid;gap:8px}
    .m328-reg-guest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .m328-reg-guest-grid label:last-child{grid-column:1/-1}
    .m328-reg-selected{display:grid;gap:7px}
    .m328-reg-person{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
    .m328-reg-person-head{grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding-right:34px}
    .m328-reg-person-head strong{display:block;font-size:.86rem}
    .m328-reg-person-head small{display:block;color:var(--muted);font-size:.68rem;margin-top:1px}
    .m328-reg-remove{position:absolute;right:7px;top:7px;width:30px;min-width:30px;height:30px}
    .m328-reg-person label{display:grid;gap:3px;font-size:.7rem;font-weight:750}
    .m328-reg-person .m328-reg-note{grid-column:1/-1}
    .m328-reg-person select,.m328-reg-person input{width:100%;min-height:39px}
    .m328-reg-count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:var(--surface-2);font-size:.74rem;font-weight:800}
    .m328-reg-submit{display:grid;gap:9px;padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-reg-consent{display:flex;align-items:flex-start;gap:8px;font-size:.75rem;line-height:1.35}
    .m328-reg-submit .button{width:100%;min-height:46px}
    .m328-reg-group-review{padding:9px;border-radius:11px;background:var(--surface-2);font-size:.74rem;line-height:1.35}
    .m328-reg-group-review p{margin:5px 0}
    @media(max-width:520px){
      .m328-reg-types{grid-template-columns:repeat(2,minmax(0,1fr))}
      .m328-reg-guest-grid,.m328-reg-person{grid-template-columns:1fr}
      .m328-reg-guest-grid label:last-child,.m328-reg-person .m328-reg-note{grid-column:auto}
    }
  `;
  document.head.appendChild(style);
}

function renderTrip(state) {
  const target = document.getElementById("m328RegTrip");
  if (!target) return;
  const venue = String(state.trip.venue || "").trim();
  target.innerHTML = `<span class="m328-reg-kicker">Ausgewählte Fahrt</span><strong>${escapeHtml(state.trip.displayTitle || venue || "Fanbusfahrt")}</strong><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}${venue ? ` · ${escapeHtml(venue)}` : ""}</span>`;
}

function personChoice(source, item) {
  if (source === "MEMBER" || source === "PORTAL_USER") {
    return {
      key: manualPersonKey(item),
      source,
      identityKey: item.portalUserId ? `PORTAL:${item.portalUserId}` : `MEMBER:${item.memberId}`,
      firstName: item.firstName,
      lastName: item.lastName,
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
    defaultBoardingStopId: item.defaultBoardingStopId,
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

function addChoice(state, choice) {
  addParticipant(state, {
    ...choice,
    boardingStopId: choice.source === "REGULAR_RIDER"
      ? riderTripStopId(state, choice)
      : defaultStopId(state),
    busPreference: choice.busPreference || "EGAL",
    operationalNote: ""
  });
}

function renderSearchPicker(state) {
  const target = document.getElementById("m328RegPicker");
  if (!target) return;
  const choices = choicesForSource(state, state.source)
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "de"));
  target.innerHTML = `<label>Person suchen<input class="m328-reg-search" type="search" autocomplete="off" placeholder="Name eingeben …" data-m328-reg-search></label><div class="m328-reg-results" data-m328-reg-results></div>`;
  const search = target.querySelector("[data-m328-reg-search]");
  const results = target.querySelector("[data-m328-reg-results]");
  const paint = () => {
    const query = String(search?.value || "").trim().toLocaleLowerCase("de-DE");
    const visible = choices.filter(choice => !query || `${choice.firstName} ${choice.lastName}`.toLocaleLowerCase("de-DE").includes(query)).slice(0, 50);
    results.innerHTML = visible.length ? visible.map(choice => `<button class="m328-reg-choice" type="button" data-m328-reg-choice="${escapeAttr(choice.key)}"><strong>${escapeHtml(`${choice.firstName} ${choice.lastName}`)}</strong><small>${escapeHtml(sourceLabel(choice.source))}</small></button>`).join("") : empty("Keine passende Person gefunden.");
    results.querySelectorAll("[data-m328-reg-choice]").forEach(button => button.addEventListener("click", () => {
      const choice = choices.find(item => item.key === button.dataset.m328RegChoice);
      if (!choice) return;
      try {
        addChoice(state, choice);
        showToast(`${choice.firstName} ${choice.lastName} hinzugefügt.`, "success", 2200);
      } catch (error) {
        showToast(error?.message || "Person konnte nicht hinzugefügt werden.", "warning", 4200);
      }
    }));
  };
  search?.addEventListener("input", paint);
  paint();
  search?.focus();
}

function renderGuestPicker(state) {
  const target = document.getElementById("m328RegPicker");
  if (!target) return;
  target.innerHTML = `<form class="m328-reg-guest" data-m328-guest-form><div class="m328-reg-guest-grid"><label>Vorname<input name="firstName" maxlength="160" required></label><label>Nachname<input name="lastName" maxlength="160" required></label><label>E-Mail (optional)<input name="email" type="email" maxlength="320"></label></div><button class="button secondary" type="submit">Gast hinzufügen</button></form>`;
  const form = target.querySelector("[data-m328-guest-form]");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    try {
      addParticipant(state, {
        source: "GUEST",
        firstName: String(values.firstName || "").trim(),
        lastName: String(values.lastName || "").trim(),
        email: String(values.email || "").trim() || null,
        boardingStopId: defaultStopId(state),
        busPreference: "EGAL",
        operationalNote: ""
      });
      form.reset();
      form.elements.firstName.focus();
      showToast("Gast hinzugefügt.", "success", 2200);
    } catch (error) {
      showToast(error?.message || "Gast konnte nicht hinzugefügt werden.", "warning", 4200);
    }
  });
  form?.elements?.firstName?.focus();
}

function groupMemberParticipant(member) {
  return {
    source: member.anchorType,
    identityKey: member.identityKey,
    firstName: member.firstName,
    lastName: member.lastName,
    ...(member.anchorType === "PORTAL_USER" ? { portalUserId: member.anchorId } : {}),
    ...(member.anchorType === "MEMBER" ? { memberId: member.anchorId } : {}),
    ...(member.anchorType === "REGULAR_RIDER" ? { regularRiderId: member.anchorId } : {}),
    boardingStopId: member.tripBoardingStopId || "",
    busPreference: member.defaultBusPreference || "EGAL",
    operationalNote: ""
  };
}

function transferGroupMembers(state, members) {
  if (state.participants.length + members.length > 20) throw new Error("Die ausgewählten Personen überschreiten das Limit von 20 Personen.");
  const additions = members.map(groupMemberParticipant);
  const duplicate = additions.find(candidate => state.participants.some(item => participantIdentity(item) === participantIdentity(candidate)));
  if (duplicate) throw new Error(`${personName(duplicate)} ist bereits ausgewählt.`);
  state.participants.push(...additions);
  renderParticipants(state);
  showToast(`${additions.length} ${additions.length === 1 ? "Person wurde" : "Personen wurden"} aus der Gruppe übernommen.`, "success", 3200);
}

function renderGroupPicker(state) {
  const target = document.getElementById("m328RegPicker");
  if (!target) return;
  const groups = state.groups.filter(group => group.isActive);
  target.innerHTML = `<form class="m328-reg-group" data-m328-group-form><label>Gruppe<select name="groupId" required><option value="">Bitte wählen</option>${groups.map(group => `<option value="${escapeAttr(group.id)}">${escapeHtml(`${group.name} · ${group.memberCount} Personen`)}</option>`).join("")}</select></label><button class="button secondary" type="submit">Gruppe übernehmen</button><div data-m328-group-review aria-live="polite"></div></form>`;
  const form = target.querySelector("[data-m328-group-form]");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type=submit]");
    const review = form.querySelector("[data-m328-group-review]");
    button.disabled = true;
    try {
      const resolved = await call("fanbus_person_group_resolve", { id: form.elements.groupId.value, tripId: state.trip.id });
      const members = Array.isArray(resolved?.members) ? resolved.members : [];
      const unavailable = members.filter(member => !member.available);
      const collisions = members.filter(member => member.conflict || state.participants.some(person => participantIdentity(person) === member.identityKey));
      const eligible = members.filter(member => member.available && !member.conflict && !state.participants.some(person => participantIdentity(person) === member.identityKey));
      if (!unavailable.length && !collisions.length) {
        transferGroupMembers(state, members);
        form.reset();
        review.innerHTML = "";
        return;
      }
      const unavailableNames = unavailable.map(personName);
      const collisionNames = collisions.map(personName);
      review.innerHTML = `<div class="m328-reg-group-review"><strong>Gruppe prüfen</strong><p>${eligible.length} von ${members.length} Personen können konfliktfrei übernommen werden.</p>${unavailableNames.length ? `<p><strong>Nicht verfügbar:</strong> ${unavailableNames.map(escapeHtml).join(", ")}</p>` : ""}${collisionNames.length ? `<p><strong>Konflikt:</strong> ${collisionNames.map(escapeHtml).join(", ")}</p>` : ""}${!collisionNames.length && eligible.length ? `<button class="button small secondary" type="button" data-m328-accept-group>Nur verfügbare übernehmen</button>` : ""}</div>`;
      review.querySelector("[data-m328-accept-group]")?.addEventListener("click", () => {
        try {
          transferGroupMembers(state, eligible);
          form.reset();
          review.innerHTML = "";
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
  document.querySelectorAll("[data-m328-reg-source]").forEach(button => {
    const active = button.dataset.m328RegSource === state.source;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (state.source === "GUEST") renderGuestPicker(state);
  else if (state.source === "GROUP") renderGroupPicker(state);
  else renderSearchPicker(state);
}

function participantCard(state, person, index) {
  const stops = activeStops(state);
  return `<article class="m328-reg-person" data-m328-reg-person="${index}"><div class="m328-reg-person-head"><div><strong>${escapeHtml(personName(person))}</strong><small>${escapeHtml(sourceLabel(person.source))}</small></div></div><button class="icon-button m328-reg-remove" type="button" data-m328-reg-remove="${index}" aria-label="${escapeAttr(`${personName(person)} entfernen`)}">×</button>${stops.length ? `<label>Zustieg<select required data-m328-reg-stop="${index}">${stopOptions(state, person.boardingStopId)}</select></label>` : ""}${state.trip.busPreferenceSelectionEnabled ? `<label>Buswunsch<select data-m328-reg-preference="${index}">${preferenceOptions(person.busPreference || "EGAL")}</select></label>` : ""}<label class="m328-reg-note">Operativer Hinweis (optional)<input maxlength="240" data-m328-reg-note="${index}" value="${escapeAttr(person.operationalNote || "")}"></label></article>`;
}

function renderParticipants(state) {
  const target = document.getElementById("m328RegParticipants");
  const count = document.getElementById("m328RegCount");
  if (!target) return;
  if (count) count.textContent = String(state.participants.length);
  target.innerHTML = state.participants.length ? state.participants.map((person, index) => participantCard(state, person, index)).join("") : empty("Noch keine Person ausgewählt.");
  target.querySelectorAll("[data-m328-reg-remove]").forEach(button => button.addEventListener("click", () => {
    state.participants.splice(Number(button.dataset.m328RegRemove), 1);
    renderParticipants(state);
  }));
  target.querySelectorAll("[data-m328-reg-stop]").forEach(select => select.addEventListener("change", () => {
    state.participants[Number(select.dataset.m328RegStop)].boardingStopId = select.value;
  }));
  target.querySelectorAll("[data-m328-reg-preference]").forEach(select => select.addEventListener("change", () => {
    state.participants[Number(select.dataset.m328RegPreference)].busPreference = select.value;
  }));
  target.querySelectorAll("[data-m328-reg-note]").forEach(input => input.addEventListener("input", () => {
    state.participants[Number(input.dataset.m328RegNote)].operationalNote = input.value;
  }));
}

function submitError(error) {
  if (error?.code === "P3201" || error?.message === "FANBUS_BATCH_DUPLICATE") {
    return new Error("Mindestens eine Person ist für diese Fahrt bereits angemeldet. Es wurde nichts gespeichert.");
  }
  return error;
}

function outcomeError(outcome) {
  return {
    ALREADY_ACTIVE: "Mindestens eine Person ist bereits angemeldet.",
    FULL: "Die Fanbusfahrt ist bereits ausgebucht.",
    CLOSED: "Die Anmeldung ist geschlossen.",
    UNAVAILABLE: "Die Fanbusfahrt ist derzeit nicht für Anmeldungen verfügbar."
  }[outcome] || "Die Anmeldung konnte nicht gespeichert werden.";
}

async function submitRegistration(state, form) {
  if (!state.participants.length) {
    showToast("Füge mindestens eine Person hinzu.", "warning", 4200);
    return;
  }
  if (!form.reportValidity()) return;
  const payload = {
    tripId: state.trip.id,
    participants: state.participants.map(person => ({
      source: person.source,
      ...(person.portalUserId ? { portalUserId: person.portalUserId } : {}),
      ...(person.memberId ? { memberId: person.memberId } : {}),
      ...(person.regularRiderId ? { regularRiderId: person.regularRiderId } : {}),
      ...(person.source === "GUEST" ? { firstName: person.firstName, lastName: person.lastName, email: person.email || null } : {}),
      ...(person.boardingStopId ? { boardingStopId: person.boardingStopId } : {}),
      busPreference: state.trip.busPreferenceSelectionEnabled ? person.busPreference || "EGAL" : "EGAL",
      operationalNote: person.operationalNote || null
    })),
    termsConfirmed: form.elements.consentConfirmed.checked
  };
  const fingerprint = JSON.stringify(payload);
  if (manualAttempt?.fingerprint !== fingerprint) manualAttempt = { fingerprint, key: crypto.randomUUID() };
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    let result;
    try {
      result = await call("fanbus_registration_create_manual_bulk", { ...payload, idempotencyKey: manualAttempt.key });
    } catch (error) {
      throw submitError(error);
    }
    if (!["CREATED", "WAITLISTED"].includes(result?.outcome)) throw new Error(outcomeError(result?.outcome));
    showToast(result.outcome === "WAITLISTED" ? `${result.participantCount} Personen wurden auf die Warteliste gesetzt.` : `${result.participantCount} Personen wurden angemeldet.`, result.outcome === "WAITLISTED" ? "warning" : "success", 4200);
    location.hash = "#/bus-orga";
  } catch (error) {
    showToast(error?.message || "Anmeldung konnte nicht gespeichert werden.", "error", 5600);
    button.disabled = false;
  }
}

function renderPage(root, state) {
  ensureStyle();
  root.innerHTML = `<div class="v4-module-surface m328-reg-surface"><header class="m328-reg-head"><button class="button small ghost" type="button" id="m328RegBack">← Bus-Orga</button><div><span class="m328-reg-kicker">P300 · Fanbus</span><h2>Anmeldung</h2></div></header><section id="m328RegTrip" class="m328-reg-trip"></section><section class="m328-reg-panel"><div class="m328-reg-panel-head"><div><span class="m328-reg-kicker">Person hinzufügen</span><h3>Art auswählen</h3></div></div><div class="m328-reg-types" role="group" aria-label="Art der Person"><button class="m328-reg-type" type="button" data-m328-reg-source="GUEST">Gast</button><button class="m328-reg-type" type="button" data-m328-reg-source="MEMBER">Mitglied</button><button class="m328-reg-type" type="button" data-m328-reg-source="PORTAL_USER">Portaluser</button><button class="m328-reg-type" type="button" data-m328-reg-source="REGULAR_RIDER">Stammfahrer</button><button class="m328-reg-type" type="button" data-m328-reg-source="GROUP">Gruppe</button></div><div id="m328RegPicker" class="m328-reg-picker"></div></section><form id="m328RegSubmitForm" class="m328-reg-submit"><section><div class="m328-reg-panel-head"><div><span class="m328-reg-kicker">Anmeldung</span><h3>Ausgewählte Personen</h3></div><span id="m328RegCount" class="m328-reg-count">0</span></div><div id="m328RegParticipants" class="m328-reg-selected"></div></section><label class="m328-reg-consent"><input name="consentConfirmed" type="checkbox" required><span>Alle ausgewählten Personen haben die Teilnahmebedingungen akzeptiert und wurden auf die Datenschutzhinweise hingewiesen.</span></label><button class="button primary" type="submit">Anmeldung speichern</button></form></div>`;
  renderTrip(state);
  document.getElementById("m328RegBack")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
  document.querySelectorAll("[data-m328-reg-source]").forEach(button => button.addEventListener("click", () => {
    state.source = button.dataset.m328RegSource;
    renderPicker(state);
  }));
  const form = document.getElementById("m328RegSubmitForm");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    void submitRegistration(state, form);
  });
  renderPicker(state);
  renderParticipants(state);
}

export async function hydrateBusOrgaRegistration(context = {}) {
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
    const trips = Array.isArray(tripData?.trips) ? tripData.trips : [];
    const trip = trips.find(item => item.id === tripId);
    if (!trip || trip.canManageRegistrations === false || trip.status !== "PUBLISHED") {
      throw new Error("Diese Fahrt ist nicht für eine neue Bus-Orga-Anmeldung verfügbar.");
    }
    const state = {
      trip,
      people: deduplicatePeople(Array.isArray(peopleData?.people) ? peopleData.people : []),
      riders: Array.isArray(riderData?.regularRiders) ? riderData.regularRiders : [],
      groups: Array.isArray(groupData?.groups) ? groupData.groups : [],
      stops: Array.isArray(stopData?.stops) ? stopData.stops : [],
      participants: [],
      source: "GUEST"
    };
    manualAttempt = null;
    renderPage(root, state);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Anmeldung konnte nicht geladen werden.")}</div><button id="m328RegLoadBack" class="button secondary" type="button">← Bus-Orga</button>`;
    document.getElementById("m328RegLoadBack")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
  }
}

export function noop() {}

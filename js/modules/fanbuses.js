import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  openDialog,
  optionList,
  runWrite,
  showToast
} from "./common.js";

const BERLIN_TIME_ZONE = "Europe/Berlin";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  timeZone: BERLIN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const BERLIN_PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const MONEY_FORMAT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

let snapshot = { trips: [] };

function trips() {
  return Array.isArray(snapshot?.trips) ? snapshot.trips : [];
}

function formatCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "–");

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0
  );

  return Number.isNaN(date.getTime()) ? String(value || "–") : DATE_FORMAT.format(date);
}

function eventTimeLabel(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit noch offen";
}

function formatBerlinDateTime(value) {
  if (!value) return "Noch nicht festgelegt";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Noch nicht festgelegt"
    : `${DATE_TIME_FORMAT.format(date)} Uhr`;
}

function berlinParts(date) {
  return Object.fromEntries(
    BERLIN_PARTS_FORMAT
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
}

function toBerlinInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = berlinParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function berlinOffsetMilliseconds(instant) {
  const date = new Date(instant);
  const parts = berlinParts(date);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function berlinLocalToIso(value, label) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) throw new Error(`${label} ist ungültig.`);

  const wallClockUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0
  );

  let instant = wallClockUtc - berlinOffsetMilliseconds(wallClockUtc);
  instant = wallClockUtc - berlinOffsetMilliseconds(instant);

  const iso = new Date(instant).toISOString();
  if (toBerlinInputValue(iso) !== raw) {
    throw new Error(`${label} liegt in einer ungültigen Zeitumstellungsphase.`);
  }

  return iso;
}

function formatMoney(cents) {
  return cents !== null && cents !== undefined && cents !== "" && Number.isInteger(Number(cents))
    ? MONEY_FORMAT.format(Number(cents) / 100)
    : "Noch nicht festgelegt";
}

function centsToEuroInput(cents) {
  if (cents === null || cents === undefined || cents === "") return "";
  const value = Number(cents);
  if (!Number.isInteger(value)) return "";
  return `${Math.floor(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

function euroInputToCents(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error("Der Fahrtpreis muss als Eurobetrag angegeben werden.");

  const cents = Number(match[1]) * 100
    + Number(String(match[2] || "").padEnd(2, "0") || 0);

  if (!Number.isSafeInteger(cents) || cents > 2147483647) {
    throw new Error("Der Fahrtpreis ist zu groß.");
  }

  return cents;
}

function capacityValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const capacity = Number(raw);

  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 2147483647) {
    throw new Error("Die Kapazität muss eine positive ganze Zahl sein.");
  }

  return capacity;
}

function registrationStatusLabel(value) {
  return {
    NOT_STARTED: "Anmeldung startet …",
    OPEN: "Offen",
    FULL: "Ausgebucht",
    CLOSED: "Geschlossen",
    UNAVAILABLE: "Nicht verfügbar"
  }[value] || "Nicht verfügbar";
}

function registrationStatusBadge(value) {
  const type = value === "OPEN"
    ? "success"
    : value === "NOT_STARTED"
      ? "warning"
      : value === "FULL"
        ? "danger"
        : "neutral";

  return `<span class="badge ${type}">${escapeHtml(registrationStatusLabel(value))}</span>`;
}

function tripStatusLabel(value) {
  return {
    DRAFT: "Entwurf",
    PUBLISHED: "Veröffentlicht",
    CLOSED: "Geschlossen"
  }[value] || value || "–";
}

function tripBadges(trip) {
  return `<div class="badge-stack">
    ${registrationStatusBadge(trip.registrationStatus)}
    <span class="badge neutral">${escapeHtml(tripStatusLabel(trip.status))}</span>
  </div>`;
}

function capacityLabel(trip) {
  const active = Number(trip.activeRegistrationCount || 0);
  return trip.capacity !== null
    && trip.capacity !== undefined
    && trip.capacity !== ""
    && Number.isInteger(Number(trip.capacity))
    ? `${active} / ${Number(trip.capacity)} Anmeldungen`
    : `${active} Anmeldungen · Kapazität noch offen`;
}

function tripMeta(trip) {
  return `<div class="meta-grid">
    <div class="meta-item"><small>Abfahrt</small><strong>${escapeHtml(formatBerlinDateTime(trip.departureAt))}</strong></div>
    <div class="meta-item"><small>Fahrtpreis</small><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div>
    <div class="meta-item"><small>Kapazität</small><strong>${escapeHtml(capacityLabel(trip))}</strong></div>
    <div class="meta-item"><small>Anmeldezeitraum</small><strong>${escapeHtml(trip.registrationOpensAt ? `${formatBerlinDateTime(trip.registrationOpensAt)} bis ${formatBerlinDateTime(trip.registrationClosesAt)}` : "Noch nicht festgelegt")}</strong></div>
  </div>`;
}

function tripActions(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const canManageRegistrations = hasCapability("fanbus.registrations.manage")
    && trip.canManageRegistrations !== false;
  const actions = [];

  if (trip.status === "PUBLISHED") {
    const registrationLabel = trip.registrationStatus === "OPEN"
      ? "Jetzt anmelden"
      : "Anmeldung ansehen";
    actions.push(`<a class="button small primary" href="./fanbus-anmeldung.html?trip=${escapeAttr(trip.id)}">${registrationLabel}</a>`);
  }

  if (canManage && trip.status !== "CLOSED") {
    actions.push(`<button class="button small secondary" type="button" data-m310-edit="${escapeAttr(trip.id)}">Bearbeiten</button>`);
  }

  if (canManage && trip.status === "DRAFT") {
    actions.push(`<button class="button small primary" type="button" data-m310-publish="${escapeAttr(trip.id)}">Veröffentlichen</button>`);
    actions.push(`<button class="button small danger" type="button" data-m310-delete="${escapeAttr(trip.id)}">Entwurf löschen</button>`);
  }

  if (canManage && trip.status !== "CLOSED") {
    actions.push(`<button class="button small ghost" type="button" data-m310-close="${escapeAttr(trip.id)}">Fahrt schließen</button>`);
  }

  if (canManageRegistrations) {
    actions.push(`<button class="button small secondary" type="button" data-m310-registrations="${escapeAttr(trip.id)}">Teilnehmer</button>`);
  }

  return actions.length ? `<div class="v4-card-actions">${actions.join("")}</div>` : "";
}

function tripCard(trip) {
  return `<article class="card entity-card" data-m310-trip-id="${escapeAttr(trip.id)}">
    <div class="entity-head">
      <div>
        <span class="subtle">${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeLabel(trip.eventTime))}</span>
        <h3>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</h3>
      </div>
      ${tripBadges(trip)}
    </div>
    ${trip.venue ? `<p class="subtle">${escapeHtml(trip.venue)}</p>` : ""}
    ${trip.departureInfo ? `<p class="v4-preserve-lines"><strong>Abfahrtsinfo:</strong> ${escapeHtml(trip.departureInfo)}</p>` : ""}
    ${tripMeta(trip)}
    ${tripActions(trip)}
  </article>`;
}

function setStatus(label, type = "") {
  const status = document.getElementById("m310FanbusStatus");
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill${type ? ` ${type}` : ""}`;
}

function render() {
  const panel = document.getElementById("m310FanbusList");
  const summary = document.getElementById("m310FanbusSummary");
  const addButton = document.getElementById("m310AddTripButton");
  if (!panel) return;

  const items = trips();
  const canManage = hasCapability("fanbus.manage");

  if (addButton) {
    addButton.hidden = !canManage;
    addButton.onclick = canManage ? openTripCreate : null;
  }

  if (summary) {
    summary.textContent = items.length === 1
      ? "1 Fanbusfahrt"
      : `${items.length} Fanbusfahrten`;
  }

  panel.innerHTML = items.length
    ? `<div class="v4-card-grid">${items.map(tripCard).join("")}</div>`
    : empty("Aktuell sind keine kommenden Fanbusfahrten verfügbar.");

  bindTripActions(panel, items);
  setStatus("Aktuell", "success");
}

function bindTripActions(panel, items) {
  panel.querySelectorAll("[data-m310-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Edit);
      if (trip) openTripEditor(trip);
    });
  });

  panel.querySelectorAll("[data-m310-publish]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Publish);
      if (trip) publishTrip(trip, button);
    });
  });

  panel.querySelectorAll("[data-m310-close]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Close);
      if (trip) closeTrip(trip, button);
    });
  });

  panel.querySelectorAll("[data-m310-delete]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Delete);
      if (trip) deleteTrip(trip, button);
    });
  });

  panel.querySelectorAll("[data-m310-registrations]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Registrations);
      if (trip) openRegistrations(trip, button);
    });
  });
}

function availableEventLabel(event) {
  const visibility = event.visibility === "PUBLIC" ? "Öffentlich" : "Intern";
  return `${formatCalendarDate(event.eventDate)} · ${event.displayTitle || "Termin"} · ${visibility}`;
}

async function openTripCreate() {
  try {
    const available = await call("fanbus_available_events");
    const events = Array.isArray(available?.events) ? available.events : [];

    if (!events.length) {
      showToast("Es ist aktuell kein kommender Termin ohne Fanbusfahrt verfügbar.", "info", 4200);
      return;
    }

    openDialog({
      title: "Fanbusfahrt anlegen",
      kicker: "Vorhandenen Termin auswählen",
      body: `<form class="form-grid v4-smart-form">
        <label class="full">Termin
          <select name="eventId" required>${optionList(
            events.map(event => ({ value: event.id, label: availableEventLabel(event) })),
            "",
            "Termin auswählen"
          )}</select>
        </label>
      </form>`,
      submitLabel: "Entwurf anlegen",
      onSubmit: async values => {
        snapshot = await runWrite(
          () => call("fanbus_trip_create", { eventId: values.eventId }),
          "Fanbusfahrt wurde als Entwurf angelegt."
        );
        render();
      }
    });
  } catch (error) {
    showToast(error?.message || "Verfügbare Termine konnten nicht geladen werden.", "error", 5200);
  }
}

function tripForm(trip) {
  const required = trip.status === "PUBLISHED" ? "required" : "";

  return `<form class="form-grid v4-smart-form">
    <label>Abfahrt in Berlin
      <input name="departureAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.departureAt))}" ${required}>
    </label>
    <label>Kapazität
      <input name="capacity" type="number" min="1" step="1" value="${escapeAttr(trip.capacity ?? "")}" ${required}>
    </label>
    <label class="full">Abfahrtsinformation
      <textarea name="departureInfo" rows="3" ${required}>${escapeHtml(trip.departureInfo || "")}</textarea>
    </label>
    <label>Anmeldung startet in Berlin
      <input name="registrationOpensAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.registrationOpensAt))}" ${required}>
    </label>
    <label>Anmeldung endet in Berlin
      <input name="registrationClosesAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.registrationClosesAt))}" ${required}>
    </label>
    <label>Fahrtpreis in Euro
      <input name="price" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${escapeAttr(centsToEuroInput(trip.priceCents))}" placeholder="25,00" ${required}>
    </label>
    <label class="full">Datenschutz-Referenz
      <textarea name="privacyReference" rows="2" ${required}>${escapeHtml(trip.privacyReference || "")}</textarea>
    </label>
    <label class="full">Teilnahmebedingungen-Referenz
      <textarea name="termsReference" rows="2" ${required}>${escapeHtml(trip.termsReference || "")}</textarea>
    </label>
  </form>`;
}

function tripUpdatePayload(trip, values) {
  return {
    id: trip.id,
    expectedRevision: Number(trip.revision),
    departureAt: berlinLocalToIso(values.departureAt, "Die Abfahrt"),
    departureInfo: String(values.departureInfo || "").trim() || null,
    registrationOpensAt: berlinLocalToIso(values.registrationOpensAt, "Der Anmeldestart"),
    registrationClosesAt: berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende"),
    priceCents: euroInputToCents(values.price),
    capacity: capacityValue(values.capacity),
    privacyReference: String(values.privacyReference || "").trim() || null,
    termsReference: String(values.termsReference || "").trim() || null
  };
}

function openTripEditor(trip) {
  openDialog({
    title: "Fanbusfahrt bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: tripForm(trip),
    submitLabel: "Änderungen speichern",
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("fanbus_trip_update", tripUpdatePayload(trip, values)),
        "Fanbusfahrt wurde aktualisiert."
      );
      render();
    }
  });
}

async function publishTrip(trip, button) {
  const confirmed = await confirmAction(
    `Fanbusfahrt „${trip.displayTitle || "Fanbusfahrt"}“ veröffentlichen?`,
    { title: "Fanbusfahrt veröffentlichen", submitLabel: "Veröffentlichen" }
  );
  if (!confirmed) return;
  await runTripWrite(button, "fanbus_trip_publish", trip, "Fanbusfahrt wurde veröffentlicht.");
}

async function closeTrip(trip, button) {
  const confirmed = await confirmAction(
    `Fanbusfahrt „${trip.displayTitle || "Fanbusfahrt"}“ endgültig schließen?`,
    { danger: true, title: "Fanbusfahrt schließen", submitLabel: "Fahrt schließen" }
  );
  if (!confirmed) return;
  await runTripWrite(button, "fanbus_trip_close", trip, "Fanbusfahrt wurde geschlossen.");
}

async function deleteTrip(trip, button) {
  const confirmed = await confirmAction(
    `Entwurf „${trip.displayTitle || "Fanbusfahrt"}“ endgültig löschen?`,
    { danger: true, title: "Fanbus-Entwurf löschen", submitLabel: "Entwurf löschen" }
  );
  if (!confirmed) return;
  await runTripWrite(button, "fanbus_trip_delete", trip, "Fanbus-Entwurf wurde gelöscht.");
}

async function runTripWrite(button, action, trip, successMessage) {
  button.disabled = true;
  try {
    snapshot = await runWrite(
      () => call(action, {
        id: trip.id,
        expectedRevision: Number(trip.revision)
      }),
      successMessage
    );
    render();
  } catch (error) {
    const message = error?.code === "40001"
      ? "Die Daten wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren."
      : error?.message || "Die Fanbus-Aktion konnte nicht ausgeführt werden.";
    showToast(message, "error", 5200);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

function registrationStatusText(value) {
  return value === "ACTIVE" ? "Aktiv" : "Storniert";
}

function sourceText(value) {
  return value === "PORTAL" ? "Portal" : "Gast";
}

function busPreferenceText(value) {
  return {
    RUHIG: "Ruhig",
    PARTY: "Party",
    EGAL: "Egal"
  }[value] || value || "–";
}

function registrationCard(registration) {
  return `<article class="card entity-card">
    <div class="entity-head">
      <div>
        <span class="subtle">${escapeHtml(sourceText(registration.source))}</span>
        <h3>${escapeHtml(`${registration.firstName} ${registration.lastName}`)}</h3>
      </div>
      <span class="badge ${registration.status === "ACTIVE" ? "success" : "neutral"}">${escapeHtml(registrationStatusText(registration.status))}</span>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><small>E-Mail</small><strong>${escapeHtml(registration.email)}</strong></div>
      <div class="meta-item"><small>Buspräferenz</small><strong>${escapeHtml(busPreferenceText(registration.busPreference))}</strong></div>
      <div class="meta-item"><small>Angemeldet</small><strong>${escapeHtml(formatBerlinDateTime(registration.registeredAt))}</strong></div>
      <div class="meta-item"><small>Storniert</small><strong>${escapeHtml(registration.cancelledAt ? formatBerlinDateTime(registration.cancelledAt) : "–")}</strong></div>
    </div>
    ${registration.status === "ACTIVE" ? `<div class="v4-card-actions"><button class="button small danger" type="button" data-m310-cancel-registration="${escapeAttr(registration.id)}">Anmeldung stornieren</button></div>` : ""}
  </article>`;
}

function registrationsMarkup(data) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  return registrations.length
    ? `<div class="module-panel">${registrations.map(registrationCard).join("")}</div>`
    : empty("Für diese Fanbusfahrt liegen noch keine Anmeldungen vor.");
}

function renderRegistrationsDialog(dialog, trip, data) {
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  body.innerHTML = registrationsMarkup(data);

  body.querySelectorAll("[data-m310-cancel-registration]").forEach(button => {
    button.addEventListener("click", async () => {
      const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
      const registration = registrations.find(item => item.id === button.dataset.m310CancelRegistration);
      if (!registration) return;

      const confirmed = await confirmAction(
        "Diese aktive Fanbus-Anmeldung wirklich stornieren?",
        { danger: true, title: "Anmeldung stornieren", submitLabel: "Stornieren" }
      );
      if (!confirmed) {
        showRegistrationsDialog(trip, data);
        return;
      }

      button.disabled = true;
      try {
        const nextData = await runWrite(
          () => call("fanbus_registration_cancel", {
            id: registration.id,
            expectedRevision: Number(registration.revision)
          }),
          "Fanbus-Anmeldung wurde storniert."
        );
        snapshot = await call("fanbus_trips_list");
        render();
        showRegistrationsDialog(trip, nextData);
      } catch (error) {
        const message = error?.code === "40001"
          ? "Die Anmeldung wurde zwischenzeitlich geändert. Bitte Teilnehmerliste neu öffnen."
          : error?.message || "Die Anmeldung konnte nicht storniert werden.";
        showToast(message, "error", 5200);
      } finally {
        if (button.isConnected) button.disabled = false;
      }
    });
  });
}

function showRegistrationsDialog(trip, data) {
  const dialog = openDialog({
    title: "Teilnehmer und Anmeldungen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: registrationsMarkup(data)
  });
  renderRegistrationsDialog(dialog, trip, data);
}

async function openRegistrations(trip, button) {
  if (!hasCapability("fanbus.registrations.manage")) return;
  button.disabled = true;

  try {
    const data = await call("fanbus_registrations_list", { tripId: trip.id });
    showRegistrationsDialog(trip, data);
  } catch (error) {
    showToast(error?.message || "Teilnehmer konnten nicht geladen werden.", "error", 5200);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

export async function hydrateFanbuses(context = {}) {
  const panel = document.getElementById("m310FanbusList");
  const summary = document.getElementById("m310FanbusSummary");
  if (!panel) return;

  panel.innerHTML = loading("Fanbusfahrten werden geladen …");
  if (summary) summary.textContent = "Fanbusfahrten werden geladen …";
  setStatus("Lädt");

  try {
    const nextSnapshot = await call("fanbus_trips_list");
    if (context.isCurrent && !context.isCurrent()) return;
    snapshot = nextSnapshot || { trips: [] };
    render();
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    panel.innerHTML = errorPanel(error, "Fanbusfahrten konnten nicht geladen werden");
    if (summary) summary.textContent = "Laden fehlgeschlagen";
    setStatus("Fehler", "error");
  }
}

export function noop() {}

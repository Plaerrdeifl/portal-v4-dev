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
import { downloadFanbusRegistrationsXlsx } from "./fanbus-xlsx.js";

const BERLIN_TIME_ZONE = "Europe/Berlin";
const PRIVACY_REFERENCE = "https://plaerrdeifl.de/datenschutzerklaerung/";
const TERMS_REFERENCE = "https://plaerrdeifl.de/fanbus-teilnahmebedingungen/";

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

const BUS_PREFERENCES = [
  { value: "RUHIG", label: "Ruhig" },
  { value: "PARTY", label: "Party" },
  { value: "EGAL", label: "Egal" }
];

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
    WAITLIST: "Warteliste",
    FULL: "Ausgebucht",
    CLOSED: "Geschlossen",
    UNAVAILABLE: "Nicht verfügbar"
  }[value] || "Nicht verfügbar";
}

function registrationStatusBadge(value) {
  const type = value === "OPEN"
    ? "success"
    : value === "NOT_STARTED" || value === "WAITLIST"
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

function mobileTripStatus(trip) {
  if (trip.status === "DRAFT") return { label: "Entwurf", type: "neutral" };
  if (trip.status === "CLOSED") return { label: "Geschlossen", type: "neutral" };

  const value = trip.registrationStatus;
  return {
    OPEN: { label: "Offen", type: "success" },
    NOT_STARTED: { label: "Startet später", type: "warning" },
    WAITLIST: { label: "Warteliste", type: "warning" },
    FULL: { label: "Ausgebucht", type: "danger" },
    CLOSED: { label: "Geschlossen", type: "neutral" },
    UNAVAILABLE: { label: "Nicht verfügbar", type: "neutral" }
  }[value] || { label: "Nicht verfügbar", type: "neutral" };
}

function mobileTripStatusBadge(trip) {
  const status = mobileTripStatus(trip);
  return `<span class="badge ${status.type}">${escapeHtml(status.label)}</span>`;
}

function capacityLabel(trip) {
  const active = Number(trip.activeRegistrationCount || 0);
  return trip.capacity !== null
    && trip.capacity !== undefined
    && trip.capacity !== ""
    && Number.isInteger(Number(trip.capacity))
    ? `${active} / ${Number(trip.capacity)} Anmeldungen`
    : `${active} Anmeldungen · Kapazität offen`;
}

function tripActions(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const canManageRegistrations = hasCapability("fanbus.registrations.manage")
    && trip.canManageRegistrations !== false;
  const actions = [];

  if (trip.status === "PUBLISHED") {
    const registrationLabel = ["OPEN", "WAITLIST"].includes(trip.registrationStatus)
      ? "Jetzt anmelden"
      : "Anmeldung ansehen";
    actions.push(`<a class="button small primary" href="./fanbus-anmeldung?trip=${escapeAttr(trip.id)}">${registrationLabel}</a>`);
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

  if (canManage && trip.status === "CLOSED") {
    actions.push(`<button class="button small secondary" type="button" data-m310-reopen="${escapeAttr(trip.id)}">Wieder als Entwurf öffnen</button>`);
  }

  if (canManageRegistrations) {
    actions.push(`<button class="button small secondary" type="button" data-m310-registrations="${escapeAttr(trip.id)}">Teilnehmer</button>`);
  }
  if (canManage) {
    actions.push(`<button class="button small secondary" type="button" data-m320-buses="${escapeAttr(trip.id)}">Busse</button>`);
  }

  return actions.length ? `<div class="v4-detail-actions dialog-actions">${actions.join("")}</div>` : "";
}

function tripDetailMarkup(trip) {
  return `<div>
    <div class="v4-detail-grid">
      <div class="full"><span>Fahrt / Spiel</span><strong>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong></div>
      <div><span>Termin</span><strong>${escapeHtml(formatCalendarDate(trip.eventDate))}</strong></div>
      <div><span>Spielzeit</span><strong>${escapeHtml(eventTimeLabel(trip.eventTime))}</strong></div>
      ${trip.opponentName ? `<div><span>Gegner</span><strong>${escapeHtml(trip.opponentName)}</strong></div>` : ""}
      ${trip.venue ? `<div><span>Ziel / Ort</span><strong>${escapeHtml(trip.venue)}</strong></div>` : ""}
      <div><span>Abfahrt</span><strong>${escapeHtml(formatBerlinDateTime(trip.departureAt))}</strong></div>
      <div><span>Fahrtpreis</span><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div>
      <div><span>Anmeldungen / Kapazität</span><strong>${escapeHtml(capacityLabel(trip))}</strong></div>
      <div><span>Status</span>${tripBadges(trip)}</div>
      <div><span>Anmeldung öffnet</span><strong>${escapeHtml(formatBerlinDateTime(trip.registrationOpensAt))}</strong></div>
      <div><span>Anmeldung schließt</span><strong>${escapeHtml(formatBerlinDateTime(trip.registrationClosesAt))}</strong></div>
      ${trip.departureInfo ? `<div class="full"><span>Treffpunkt / Abfahrtsort</span><strong class="v4-preserve-lines">${escapeHtml(trip.departureInfo)}</strong></div>` : ""}
    </div>
    ${tripActions(trip)}
  </div>`;
}

function openTripDetail(trip) {
  const dialog = openDialog({
    title: trip.displayTitle || "Fanbusfahrt",
    kicker: `${formatCalendarDate(trip.eventDate)} · ${eventTimeLabel(trip.eventTime)}`,
    body: tripDetailMarkup(trip)
  });
  bindTripActions(dialog, [trip]);
}

function tripTable(items) {
  return `<div class="v4-table-wrap v4-desktop-table">
    <table class="v4-table v4-compact-table">
      <thead><tr><th>Datum</th><th>Fahrt / Spiel</th><th>Ziel / Gegner</th><th>Status</th><th>Anmeldungen</th><th></th></tr></thead>
      <tbody>${items.map(trip => `<tr class="v4-interactive-row" tabindex="0" role="button" data-m310-open-trip="${escapeAttr(trip.id)}" aria-label="Details zu ${escapeAttr(trip.displayTitle || "Fanbusfahrt")}">
        <td>${escapeHtml(formatCalendarDate(trip.eventDate))}<small>${escapeHtml(eventTimeLabel(trip.eventTime))}</small></td>
        <td><strong>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong></td>
        <td>${escapeHtml(trip.opponentName || trip.venue || "–")}</td>
        <td>${tripBadges(trip)}</td>
        <td>${escapeHtml(capacityLabel(trip))}</td>
        <td><span class="v4-row-chevron" aria-hidden="true">›</span></td>
      </tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function tripMobileList(items) {
  return `<div class="v4-mobile-records v4-compact-record-list" aria-label="Fanbusfahrten">
    ${items.map(trip => `<button class="v4-compact-record v4-m310-mobile-trip" type="button" data-m310-open-trip="${escapeAttr(trip.id)}">
      <span class="v4-m310-mobile-trip-meta">
        <small>${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeLabel(trip.eventTime))}</small>
        ${mobileTripStatusBadge(trip)}
      </span>
      <strong class="v4-m310-mobile-trip-title">${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong>
      <span class="v4-m310-mobile-trip-footer">
        <span>${escapeHtml(trip.venue || trip.opponentName || "Ziel noch offen")}</span>
        <small>${escapeHtml(capacityLabel(trip))}</small>
      </span>
      <span class="v4-row-chevron" aria-hidden="true">›</span>
    </button>`).join("")}
  </div>`;
}

function setStatus(label, type = "") {
  const status = document.getElementById("m310FanbusStatus");
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill${type ? ` ${type}` : ""}`;
  status.hidden = type === "success";
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
    ? `${tripTable(items)}${tripMobileList(items)}`
    : empty("Aktuell sind keine kommenden Fanbusfahrten verfügbar.");

  panel.querySelectorAll("[data-m310-open-trip]").forEach(record => {
    const open = () => {
      const trip = items.find(item => item.id === record.dataset.m310OpenTrip);
      if (trip) openTripDetail(trip);
    };
    record.addEventListener("click", open);
    if (record.matches("tr")) {
      record.addEventListener("keydown", keyEvent => {
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        open();
      });
    }
  });
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

  panel.querySelectorAll("[data-m310-reopen]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Reopen);
      if (trip) reopenTrip(trip, button);
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
  panel.querySelectorAll("[data-m320-buses]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m320Buses);
      if (trip) openBuses(trip, button);
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
        <label class="v4-field-full">Termin
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

function defaultRegistrationClosesInput(departureAt) {
  const departure = toBerlinInputValue(departureAt);
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}$/.exec(departure);
  if (!match) return "";

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) - 3));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T20:00`;
}

function tripForm(trip) {
  const required = trip.status === "PUBLISHED" ? "required" : "";
  const registrationClosesAt = toBerlinInputValue(trip.registrationClosesAt)
    || defaultRegistrationClosesInput(trip.departureAt);

  return `<form id="m310TripEditorForm" class="form-grid v4-smart-form">
    <label class="v4-field-seven">Abfahrt
      <input name="departureAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.departureAt))}" ${required}>
    </label>
    <label class="v4-field-five">Kapazität
      <input name="capacity" type="number" min="1" step="1" value="${escapeAttr(trip.capacity ?? "")}" ${required}>
    </label>
    <label class="v4-field-full">Treffpunkt / Abfahrtsort
      <textarea name="departureInfo" rows="3" ${required}>${escapeHtml(trip.departureInfo || "")}</textarea>
    </label>
    <label class="v4-field-seven">Anmeldung endet
      <input name="registrationClosesAt" type="datetime-local" step="60" value="${escapeAttr(registrationClosesAt)}" ${required}>
    </label>
    <label class="v4-field-five">Fahrtpreis
      <input name="price" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${escapeAttr(centsToEuroInput(trip.priceCents))}" placeholder="25,00" ${required}>
    </label>
  </form>`;
}

function tripUpdatePayload(trip, values) {
  return {
    id: trip.id,
    expectedRevision: Number(trip.revision),
    departureAt: berlinLocalToIso(values.departureAt, "Die Abfahrt"),
    departureInfo: String(values.departureInfo || "").trim() || null,
    registrationClosesAt: berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende"),
    priceCents: euroInputToCents(values.price),
    capacity: capacityValue(values.capacity),
    privacyReference: PRIVACY_REFERENCE,
    termsReference: TERMS_REFERENCE
  };
}

function openTripEditor(trip) {
  const dialog = openDialog({
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

  const form = dialog.querySelector("#m310TripEditorForm");
  const departure = form?.elements.namedItem("departureAt");
  const registrationCloses = form?.elements.namedItem("registrationClosesAt");
  let registrationClosesAutoManaged = !trip.registrationClosesAt;

  const disableRegistrationClosesAutoManagement = () => {
    registrationClosesAutoManaged = false;
  };

  registrationCloses?.addEventListener("input", disableRegistrationClosesAutoManagement);
  registrationCloses?.addEventListener("change", disableRegistrationClosesAutoManagement);
  departure?.addEventListener("change", () => {
    if (!registrationCloses || !registrationClosesAutoManaged || !departure.value) return;
    try {
      registrationCloses.value = defaultRegistrationClosesInput(
        berlinLocalToIso(departure.value, "Die Abfahrt")
      );
    } catch {
      // Die native Datumseingabe zeigt die Validierung beim Speichern an.
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

async function reopenTrip(trip, button) {
  const confirmed = await confirmAction(
    "Die Fanbusfahrt wird wieder als Entwurf geöffnet. Sie ist danach nicht öffentlich verfügbar und kann wieder bearbeitet werden. Löschen ist weiterhin nur möglich, wenn keine Anmeldungen zur Fahrt vorhanden sind.",
    { title: "Fanbusfahrt wieder öffnen", submitLabel: "Als Entwurf öffnen" }
  );
  if (!confirmed) return;
  await runTripWrite(
    button,
    "fanbus_trip_reopen",
    trip,
    "Fanbusfahrt wurde wieder als Entwurf geöffnet."
  );
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
  return { ACTIVE: "Bestätigt", WAITLISTED: "Warteliste", CANCELLED: "Storniert" }[value] || value;
}

function sourceText(value) {
  return {
    PORTAL: "Portal",
    GUEST: "Gast",
    MANUAL: "Manuell"
  }[value] || value || "–";
}

function busPreferenceText(value) {
  return {
    RUHIG: "Ruhig",
    PARTY: "Party",
    EGAL: "Egal"
  }[value] || value || "–";
}

function registrationCard(registration, buses = []) {
  const isActive = registration.status === "ACTIVE";
  const bookingRole = registration.bookingRole === "COMPANION" ? "Begleiter" : "Hauptperson";
  const occupancy = bus => Number(bus.occupancy ?? bus.occupied ?? 0);
  const assignedBus = buses.find(bus => bus.id === registration.busId);
  const preferenceMismatch = assignedBus
    && ["RUHIG", "PARTY"].includes(registration.busPreference)
    && assignedBus.category !== registration.busPreference;
  const email = registration.email
    ? `<span class="v4-m310-registration-email">${escapeHtml(registration.email)}</span>`
    : "";
  const cancelledAt = registration.status === "CANCELLED" && registration.cancelledAt
    ? `<small class="v4-m310-registration-cancelled">Storniert ${escapeHtml(formatBerlinDateTime(registration.cancelledAt))}</small>`
    : "";

  return `<article class="v4-m310-registration-record" data-m320-registration-record="${escapeAttr(registration.id)}">
    <div class="v4-m310-registration-person">
      <strong>${escapeHtml(`${registration.firstName} ${registration.lastName}`)}</strong>
      <span class="badge ${registration.status === "ACTIVE" ? "success" : "neutral"}">${escapeHtml(registrationStatusText(registration.status))}</span>
    </div>
    <span class="v4-m310-registration-summary">${escapeHtml(bookingRole)} · ${escapeHtml(sourceText(registration.source))} · Buspräferenz: ${escapeHtml(busPreferenceText(registration.busPreference))}${registration.bookingParticipantCount > 1 ? ` · Gemeinsam angemeldet (${registration.bookingParticipantCount} Personen)` : ""}</span>
    ${preferenceMismatch ? `<small class="notice warning">Buswunsch weicht von der Buskategorie ${escapeHtml(assignedBus.category)} ab.</small>` : ""}
    ${email}
    <div class="v4-m310-registration-footer">
      <small>Angemeldet ${escapeHtml(formatBerlinDateTime(registration.registeredAt))}</small>
      ${isActive ? `<select aria-label="Buszuordnung" data-m320-assignment="${escapeAttr(registration.id)}"><option value="">Nicht zugeordnet</option>${buses.filter(bus => bus.isActive).map(bus => `<option value="${escapeAttr(bus.id)}"${bus.id === registration.busId ? " selected" : ""}>${escapeHtml(`${bus.label} · ${occupancy(bus)}/${bus.capacity}`)}</option>`).join("")}</select>` : ""}
      ${registration.status === "WAITLISTED" ? `<small>Wartelistenposition ${escapeHtml(registration.waitlistPosition || "–")}</small>${Number(registration.waitlistPosition) === 1 ? `<button class="button small primary" type="button" data-m320-promote="${escapeAttr(registration.id)}" data-revision="${escapeAttr(registration.revision)}">Promotion bestätigen</button>` : ""}` : ""}
      ${registration.status !== "CANCELLED" ? `<button class="button small secondary" type="button" data-m320-edit-registration="${escapeAttr(registration.id)}">Bearbeiten</button><button class="button small danger" type="button" data-m310-cancel-registration="${escapeAttr(registration.id)}">Stornieren</button>` : cancelledAt}
    </div>
  </article>`;
}

function registrationsMarkup(data) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  const buses = Array.isArray(data?.buses) ? data.buses : [];
  const addAction = hasCapability("fanbus.registrations.manage")
    ? `<div class="v4-heading-row v4-subheading-row v4-m310-registration-toolbar">
      <p class="subtle">Mitfahrer verwalten</p>
      <div class="v4-m310-registration-toolbar-actions">
        <button class="button small primary" type="button" data-m310-export-registrations>Excel exportieren</button>
        <button class="button small secondary" type="button" data-m310-add-registration>Mitfahrer hinzufügen</button>
        ${hasCapability("fanbus.manage") ? `<button class="button small secondary" type="button" data-m320-manage-buses>Busse (${buses.length})</button>` : ""}
      </div>
    </div>`
    : "";
  const busOptions = buses.map(bus =>
    `<option value="${escapeAttr(bus.id)}">${escapeHtml(bus.label)}</option>`
  ).join("");
  const filters = `<form class="form-grid v4-smart-form" data-m320-registration-filters>
    <label class="v4-field-full">Suche
      <input name="search" type="search" placeholder="Vorname, Nachname oder E-Mail">
    </label>
    <label>Status<select name="status"><option value="ALL">Alle</option><option value="ACTIVE">Bestätigt</option><option value="WAITLISTED">Warteliste</option><option value="CANCELLED">Storniert</option></select></label>
    <label>Buspräferenz<select name="preference"><option value="ALL">Alle</option><option value="RUHIG">Ruhig</option><option value="PARTY">Party</option><option value="EGAL">Egal</option></select></label>
    <label>Bus<select name="bus"><option value="ALL">Alle</option><option value="UNASSIGNED">Nicht zugeordnet</option>${busOptions}</select></label>
    <label>Zuordnung<select name="assignment"><option value="ALL">Alle</option><option value="ASSIGNED">Zugeordnet</option><option value="UNASSIGNED">Nicht zugeordnet</option></select></label>
  </form>`;
  const warning = Number(data?.summary?.activeBusCapacity || 0)
      < Number(data?.summary?.activeCount || 0)
    ? `<div class="notice warning" role="status">Warnung: Die Kapazität der aktiven Busse (${escapeHtml(data.summary.activeBusCapacity)}) liegt unter der Zahl bestätigter Teilnehmer (${escapeHtml(data.summary.activeCount)}).</div>`
    : "";
  const list = registrations.length
    ? `<div class="v4-m310-registration-list" data-m320-registration-list>${registrations.map(registration => registrationCard(registration, buses)).join("")}<p class="subtle" data-m320-filter-empty hidden>Keine Teilnehmer entsprechen den Filtern.</p></div>`
    : `<div data-m320-registration-list>${empty("Für diese Fanbusfahrt liegen noch keine Anmeldungen vor.")}</div>`;

  return `${addAction}${warning}${filters}${list}`;
}

function filterRegistrations(body, data) {
  const form = body.querySelector("[data-m320-registration-filters]");
  const target = body.querySelector("[data-m320-registration-list]");
  if (!form || !target) return;
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  const search = String(form.elements.namedItem("search")?.value || "").trim().toLocaleLowerCase("de-DE");
  const status = form.elements.namedItem("status")?.value || "ALL";
  const preference = form.elements.namedItem("preference")?.value || "ALL";
  const bus = form.elements.namedItem("bus")?.value || "ALL";
  const assignment = form.elements.namedItem("assignment")?.value || "ALL";
  let visibleCount = 0;
  registrations.forEach(registration => {
    const haystack = `${registration.firstName || ""} ${registration.lastName || ""} ${registration.email || ""}`.toLocaleLowerCase("de-DE");
    const visible = (!search || haystack.includes(search))
      && (status === "ALL" || registration.status === status)
      && (preference === "ALL" || registration.busPreference === preference)
      && (bus !== "UNASSIGNED" || !registration.busId)
      && (bus === "ALL" || bus === "UNASSIGNED" || registration.busId === bus)
      && (assignment !== "ASSIGNED" || Boolean(registration.busId))
      && (assignment !== "UNASSIGNED" || !registration.busId);
    const card = target.querySelector(`[data-m320-registration-record="${CSS.escape(registration.id)}"]`);
    if (card) card.hidden = !visible;
    if (visible) visibleCount += 1;
  });
  const noMatches = target.querySelector("[data-m320-filter-empty]");
  if (noMatches) noMatches.hidden = visibleCount > 0;
}

function openRegistrationEdit(trip, registration) {
  const linkedIdentity = Boolean(registration.memberId || registration.portalUserId);
  const readonly = linkedIdentity ? " disabled" : "";
  openDialog({
    title: "Teilnehmer bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: `<form class="form-grid v4-smart-form">
      <label>Vorname<input name="firstName" maxlength="120" value="${escapeAttr(registration.firstName)}" required${readonly}></label>
      <label>Nachname<input name="lastName" maxlength="120" value="${escapeAttr(registration.lastName)}" required${readonly}></label>
      <label class="v4-field-full">E-Mail<input name="email" type="email" maxlength="320" value="${escapeAttr(registration.email || "")}"${readonly}></label>
      <label class="v4-field-full">Buspräferenz<select name="busPreference" required>${optionList(BUS_PREFERENCES, registration.busPreference)}</select></label>
      ${linkedIdentity ? `<p class="subtle v4-field-full">Identitätsdaten verknüpfter Portalnutzer oder Mitglieder bleiben unverändert.</p>` : ""}
    </form>`,
    submitLabel: "Änderungen speichern",
    onSubmit: async values => {
      const next = await call("fanbus_registration_update", {
        id: registration.id,
        expectedRevision: Number(registration.revision),
        firstName: linkedIdentity ? registration.firstName : values.firstName,
        lastName: linkedIdentity ? registration.lastName : values.lastName,
        email: linkedIdentity ? registration.email : values.email,
        busPreference: values.busPreference
      });
      showToast("Teilnehmer wurde aktualisiert.", "success", 3800);
      setTimeout(() => showRegistrationsDialog(trip, next), 0);
    }
  });
}

function bindRegistrationActions(body, data, trip, dialog) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  body.querySelectorAll("[data-m320-assignment]").forEach(select => {
    select.onchange = async () => {
      try {
        const next = await call("fanbus_bus_assignment_set", {
          participantId: select.dataset.m320Assignment,
          busId: select.value || null
        });
        renderRegistrationsDialog(dialog, trip, next);
      } catch (error) {
        showToast(error?.message || "Buszuordnung konnte nicht gespeichert werden.", "error", 5200);
      }
    };
  });
  body.querySelectorAll("[data-m320-edit-registration]").forEach(button => {
    button.onclick = () => {
      const registration = registrations.find(item => item.id === button.dataset.m320EditRegistration);
      if (registration) openRegistrationEdit(trip, registration);
    };
  });
}

function renderRegistrationsDialog(dialog, trip, data) {
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  body.innerHTML = registrationsMarkup(data);

  body.querySelector("[data-m310-add-registration]")
    ?.addEventListener("click", () => openManualRegistration(trip));
  body.querySelector("[data-m320-manage-buses]")
    ?.addEventListener("click", () => openBusManager(trip, data));
  const filters = body.querySelector("[data-m320-registration-filters]");
  filters?.addEventListener("input", () => filterRegistrations(body, data));
  filters?.addEventListener("change", () => filterRegistrations(body, data));
  bindRegistrationActions(body, data, trip, dialog);
  body.querySelectorAll("[data-m320-promote]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        const next = await call("fanbus_waitlist_promote", {
          id: button.dataset.m320Promote,
          expectedRevision: Number(button.dataset.revision)
        });
        snapshot = await call("fanbus_trips_list");
        render();
        renderRegistrationsDialog(dialog, trip, next);
      } catch (error) {
        showToast(error?.message || "Promotion ist derzeit nicht möglich.", "error", 5200);
      }
    });
  });

  body.querySelector("[data-m310-export-registrations]")
    ?.addEventListener("click", () => {
      if (!hasCapability("fanbus.registrations.manage")) return;
      try {
        const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
        downloadFanbusRegistrationsXlsx(trip, registrations);
        showToast("Excel-Datei wurde erstellt.", "success", 3800);
      } catch (error) {
        showToast(error?.message || "Die Excel-Datei konnte nicht erstellt werden.", "error", 5200);
      }
    });

  body.querySelectorAll("[data-m310-cancel-registration]").forEach(button => {
    button.addEventListener("click", async () => {
      const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
      const registration = registrations.find(item => item.id === button.dataset.m310CancelRegistration);
      if (!registration) return;

      const confirmed = await confirmAction(
        "Diesen bestätigten oder wartenden Teilnehmer wirklich stornieren?",
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

function busForm(bus = null) {
  return `<form class="form-grid v4-smart-form">
    <label class="v4-field-full">Busname
      <input name="label" maxlength="160" value="${escapeAttr(bus?.label || "")}" required>
    </label>
    <label>Kategorie
      <select name="category" required>
        <option value="NORMAL"${bus?.category === "NORMAL" || !bus ? " selected" : ""}>Normal</option>
        <option value="RUHIG"${bus?.category === "RUHIG" ? " selected" : ""}>Ruhig</option>
        <option value="PARTY"${bus?.category === "PARTY" ? " selected" : ""}>Party</option>
      </select>
    </label>
    <label>Kapazität
      <input name="capacity" type="number" min="1" step="1" value="${escapeAttr(bus?.capacity || "")}" required>
    </label>
    <label class="v4-field-full v4-compact-check">
      <input name="isActive" type="checkbox"${bus?.isActive === false ? "" : " checked"}>
      <span>Bus ist aktiv</span>
    </label>
  </form>`;
}

function openBusEditor(trip, data, bus) {
  openDialog({
    title: "Bus bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: busForm(bus),
    submitLabel: "Bus speichern",
    onSubmit: async values => {
      await call("fanbus_bus_upsert", {
        id: bus.id,
        tripId: trip.id,
        expectedRevision: Number(bus.revision),
        label: values.label,
        category: values.category,
        capacity: Number(values.capacity),
        isActive: values.isActive === "on"
      });
      const next = await call("fanbus_buses_list", { tripId: trip.id });
      showToast("Bus wurde aktualisiert.", "success", 3800);
      setTimeout(() => openBusManager(trip, next), 0);
    }
  });
}

function openBusManager(trip, data) {
  const buses = Array.isArray(data?.buses) ? data.buses : [];
  const rows = buses.map(bus => {
    const occupancy = Number(bus.occupancy ?? bus.occupied ?? 0);
    return `<article class="v4-m310-registration-record">
      <strong>${escapeHtml(bus.label)}</strong>
      <span>${escapeHtml(bus.category)} · ${escapeHtml(occupancy)}/${escapeHtml(bus.capacity)} belegt · ${bus.isActive ? "aktiv" : "inaktiv"}</span>
      <span>${escapeHtml(Math.max(Number(bus.capacity) - occupancy, 0))} frei</span>
      <button class="button small secondary" type="button" data-m320-edit-bus="${escapeAttr(bus.id)}">Bearbeiten</button>
    </article>`;
  }).join("");
  const warning = Number(data?.summary?.activeBusCapacity || 0)
      < Number(data?.summary?.activeCount || 0)
    ? `<div class="notice warning">Die Kapazität aktiver Busse reicht für die bestätigten Teilnehmer aktuell nicht aus.</div>`
    : "";
  const dialog = openDialog({
    title: "Busse verwalten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: `${warning}<div class="v4-m310-registration-list">${rows || "<p>Keine Busse angelegt.</p>"}</div><h3>Bus anlegen</h3>${busForm()}`,
    submitLabel: "Bus anlegen",
    onSubmit: async values => {
      await call("fanbus_bus_upsert", {
        tripId: trip.id,
        label: values.label,
        category: values.category,
        capacity: Number(values.capacity),
        isActive: values.isActive === "on"
      });
      const next = await call("fanbus_buses_list", { tripId: trip.id });
      showToast("Bus wurde angelegt.", "success", 3800);
      setTimeout(() => openBusManager(trip, next), 0);
    }
  });
  dialog.querySelectorAll("[data-m320-edit-bus]").forEach(button => {
    button.addEventListener("click", () => {
      const bus = buses.find(item => item.id === button.dataset.m320EditBus);
      if (bus) openBusEditor(trip, data, bus);
    });
  });
}

function manualPersonLabel(person) {
  const type = person.personType === "MEMBER" ? "Mitglied" : "Portalnutzer";
  const email = person.email ? ` · ${person.email}` : "";
  return `${person.lastName || ""}, ${person.firstName || ""} · ${type}${email}`;
}

function manualRegistrationForm(people) {
  const personOptions = people.map(person => {
    const id = person.personType === "MEMBER" ? person.memberId : person.portalUserId;
    const value = `${person.personType}:${id}`;
    return `<option value="${escapeAttr(value)}">${escapeHtml(manualPersonLabel(person))}</option>`;
  }).join("");

  return `<form id="m310ManualRegistrationForm" class="form-grid v4-smart-form">
    <label class="v4-field-half">Art der Erfassung
      <select name="mode" required>
        <option value="PERSON">Mitglied / Portalnutzer</option>
        <option value="GUEST">Gast</option>
      </select>
    </label>
    <label class="v4-field-half">Buspräferenz
      <select name="busPreference" required>${optionList(BUS_PREFERENCES, "EGAL")}</select>
    </label>
    <label class="v4-field-full" data-m310-manual-person>Person
      <select name="personKey" required>
        <option value="">Person auswählen</option>
        ${personOptions}
      </select>
    </label>
    <label class="v4-field-half" data-m310-manual-guest hidden>Vorname
      <input name="firstName" autocomplete="given-name" disabled>
    </label>
    <label class="v4-field-half" data-m310-manual-guest hidden>Nachname
      <input name="lastName" autocomplete="family-name" disabled>
    </label>
    <label class="v4-field-full" data-m310-manual-guest hidden>E-Mail (optional)
      <input name="email" type="email" autocomplete="email" disabled>
    </label>
    <label class="v4-field-full v4-compact-check">
      <input name="consentConfirmed" type="checkbox" required>
      <span>Die Person hat die Teilnahmebedingungen akzeptiert und wurde auf die Datenschutzhinweise hingewiesen.</span>
    </label>
  </form>`;
}

function syncManualRegistrationMode(dialog) {
  const form = dialog.querySelector("#m310ManualRegistrationForm");
  const isGuest = form?.elements.namedItem("mode")?.value === "GUEST";
  const personField = dialog.querySelector("[data-m310-manual-person]");
  const personSelect = form?.elements.namedItem("personKey");

  if (personField) personField.hidden = isGuest;
  if (personSelect) {
    personSelect.disabled = isGuest;
    personSelect.required = !isGuest;
  }

  dialog.querySelectorAll("[data-m310-manual-guest]").forEach(field => {
    field.hidden = !isGuest;
    const input = field.querySelector("input");
    if (!input) return;
    input.disabled = !isGuest;
    input.required = isGuest && input.name !== "email";
  });
}

function manualRegistrationError(outcome) {
  return {
    ALREADY_ACTIVE: "Für diese Person besteht bereits eine aktive Anmeldung.",
    WAITLISTED: "Die Person wurde auf die Warteliste gesetzt.",
    FULL: "Die Fanbusfahrt ist bereits ausgebucht.",
    NOT_STARTED: "Der Anmeldezeitraum hat noch nicht begonnen.",
    CLOSED: "Der Anmeldezeitraum ist beendet.",
    UNAVAILABLE: "Die Fanbusfahrt ist derzeit nicht für Anmeldungen verfügbar."
  }[outcome] || "Die manuelle Anmeldung konnte nicht angelegt werden.";
}

function manualAttemptFor(currentAttempt, fingerprint) {
  return currentAttempt?.fingerprint === fingerprint
    ? currentAttempt
    : { fingerprint, key: crypto.randomUUID() };
}

async function openManualRegistration(trip) {
  if (!hasCapability("fanbus.registrations.manage")) return;

  try {
    const lookup = await call("fanbus_registration_people_list");
    const people = Array.isArray(lookup?.people) ? lookup.people : [];
    let manualAttempt = null;
    const dialog = openDialog({
      title: "Mitfahrer hinzufügen",
      kicker: trip.displayTitle || "Fanbusfahrt",
      body: manualRegistrationForm(people),
      submitLabel: "Mitfahrer anmelden",
      onSubmit: async values => {
        const payload = {
          tripId: trip.id,
          mode: values.mode,
          busPreference: values.busPreference,
          privacyConfirmed: values.consentConfirmed === "on",
          termsConfirmed: values.consentConfirmed === "on"
        };

        if (values.mode === "PERSON") {
          const person = people.find(item => {
            const id = item.personType === "MEMBER" ? item.memberId : item.portalUserId;
            return `${item.personType}:${id}` === values.personKey;
          });
          if (!person) throw new Error("Bitte wähle eine vorhandene Person aus.");
          payload.personType = person.personType;
          if (person.personType === "MEMBER") payload.memberId = person.memberId;
          else payload.portalUserId = person.portalUserId;
        } else {
          payload.firstName = values.firstName;
          payload.lastName = values.lastName;
          payload.email = values.email || null;
        }

        const fingerprint = JSON.stringify(payload);
        manualAttempt = manualAttemptFor(manualAttempt, fingerprint);
        const result = await call("fanbus_registration_create_manual", {
          ...payload,
          idempotencyKey: manualAttempt.key
        });
        if (!["CREATED", "WAITLISTED"].includes(result?.outcome)) {
          throw new Error(manualRegistrationError(result?.outcome));
        }

        const [nextData, nextSnapshot] = await Promise.all([
          call("fanbus_registrations_list", { tripId: trip.id }),
          call("fanbus_trips_list")
        ]);
        snapshot = nextSnapshot || { trips: [] };
        render();
        showToast(
          result.outcome === "WAITLISTED"
            ? "Mitfahrer wurde auf die Warteliste gesetzt."
            : "Mitfahrer wurde angemeldet.",
          result.outcome === "WAITLISTED" ? "warning" : "success",
          3800
        );
        setTimeout(() => showRegistrationsDialog(trip, nextData), 0);
      }
    });

    dialog.querySelector('[name="mode"]')
      ?.addEventListener("change", () => syncManualRegistrationMode(dialog));
    syncManualRegistrationMode(dialog);
  } catch (error) {
    showToast(error?.message || "Die Personenauswahl konnte nicht geladen werden.", "error", 5200);
  }
}

function showRegistrationsDialog(trip, data) {
  const dialog = openDialog({
    title: "Teilnehmer und Anmeldungen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: registrationsMarkup(data)
  });
  renderRegistrationsDialog(dialog, trip, data);
}

async function openBuses(trip, button) {
  if (!hasCapability("fanbus.manage")) return;
  button.disabled = true;
  try {
    const data = await call("fanbus_buses_list", { tripId: trip.id });
    openBusManager(trip, data);
  } catch (error) {
    showToast(error?.message || "Busse konnten nicht geladen werden.", "error", 5200);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
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

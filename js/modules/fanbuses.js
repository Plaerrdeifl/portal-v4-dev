import {
  afterDialogContextClose,
  call,
  closeAllDialogs,
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
let operationsUiState = { status: "ALL", bus: "ALL", stop: "ALL", search: "", scrollY: 0 };

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

function eventTimeCompact(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]}` : "Uhrzeit offen";
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

function toBerlinTimeInputValue(value) {
  const localValue = toBerlinInputValue(value);
  return localValue ? localValue.slice(11, 16) : "";
}

function formatBerlinTime(value) {
  const localValue = toBerlinTimeInputValue(value);
  return localValue ? `${localValue} Uhr` : "Zeit noch offen";
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

function tripTimeToBerlinIso(trip, value, label) {
  const eventDate = String(trip?.eventDate || "").trim();
  const time = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error("Das Fahrtdatum ist ungültig.");
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return berlinLocalToIso(`${eventDate}T${time}`, label);
}

function defaultTripStopTime(trip) {
  const departureTime = toBerlinTimeInputValue(trip?.departureAt);
  if (departureTime) return departureTime;
  const eventTime = /^(\d{2}):(\d{2})/.exec(String(trip?.eventTime || ""));
  return eventTime ? `${eventTime[1]}:${eventTime[2]}` : "";
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

function registrationStatusLabel(value) {
  return {
    NOT_STARTED: "Anmeldung startet …",
    OPEN: "Offen",
    WAITLIST: "Warteliste",
    FULL: "Ausgebucht",
    CLOSED: "Geschlossen",
    CANCELLED: "Abgesagt",
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
    CLOSED: "Geschlossen",
    CANCELLED: "Abgesagt"
  }[value] || value || "–";
}

function tripBadges(trip) {
  if (trip.status === "CANCELLED") {
    return `<span class="badge danger">${escapeHtml(tripStatusLabel(trip.status))}</span>`;
  }
  if (trip.status === "DRAFT" || trip.status === "CLOSED") {
    return `<span class="badge neutral">${escapeHtml(tripStatusLabel(trip.status))}</span>`;
  }
  return registrationStatusBadge(trip.registrationStatus);
}

function tripLifecycleBadge(trip) {
  const type = trip.status === "CANCELLED"
    ? "danger"
    : trip.status === "PUBLISHED"
    ? "success"
    : trip.status === "DRAFT"
      ? "warning"
      : "neutral";
  return `<span class="badge ${type}">${escapeHtml(tripStatusLabel(trip.status))}</span>`;
}

function mobileTripStatus(trip) {
  if (trip.status === "DRAFT") return { label: "Entwurf", type: "neutral" };
  if (trip.status === "CLOSED") return { label: "Geschlossen", type: "neutral" };
  if (trip.status === "CANCELLED") return { label: "Abgesagt", type: "danger" };

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

function tripManagementActions(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const actions = [];

  if (trip.status === "CANCELLED") return "";

  if (canManage && ["DRAFT", "PUBLISHED"].includes(trip.status)) {
    actions.push(`<button class="button small secondary" type="button" data-m310-edit-mode="${escapeAttr(trip.id)}">Bearbeiten</button>`);
  }

  if (canManage && trip.status === "DRAFT") {
    actions.push(`<button class="button small primary" type="button" data-m310-publish="${escapeAttr(trip.id)}">Veröffentlichen</button>`);
    actions.push(`<button class="button small danger" type="button" data-m310-delete="${escapeAttr(trip.id)}">Entwurf löschen</button>`);
  }

  if (canManage && ["DRAFT", "PUBLISHED"].includes(trip.status)) {
    actions.push(`<button class="button small ghost" type="button" data-m310-close="${escapeAttr(trip.id)}">Fahrt schließen</button>`);
  }

  if (canManage && trip.status === "CLOSED") {
    actions.push(`<button class="button small secondary" type="button" data-m310-reopen="${escapeAttr(trip.id)}">Wieder als Entwurf öffnen</button>`);
  }

  if (canManage && trip.canCancel === true) {
    actions.push(`<button class="button small danger" type="button" data-m330-cancel-trip="${escapeAttr(trip.id)}">Fahrt absagen</button>`);
  }

  if (canManage && trip.status !== "CANCELLED") {
    actions.push(`<button class="button small secondary" type="button" data-m325-stops="${escapeAttr(trip.id)}">Zustiegsstammdaten</button>`);
  }

  return actions.join("");
}

function registrationWindowText(trip) {
  if (trip.registrationStatus === "CANCELLED") return "Fahrt abgesagt";
  if (trip.registrationStatus === "OPEN" || trip.registrationStatus === "WAITLIST") {
    return `Anmeldeschluss: ${formatBerlinDateTime(trip.registrationClosesAt)}`;
  }
  if (trip.registrationStatus === "NOT_STARTED") {
    return `Anmeldung ab ${formatBerlinDateTime(trip.registrationOpensAt)}`;
  }
  if (trip.registrationStatus === "CLOSED") return "Anmeldung geschlossen";
  if (trip.registrationStatus === "FULL") return "Anmeldung ausgebucht";
  return "Anmeldung derzeit nicht verfügbar";
}

function fanbusOperationsAccess(trip = {}) {
  const canManageRegistrations =
    hasCapability("fanbus.registrations.manage")
    && trip.canManageRegistrations !== false;

  const canManageOperations =
    hasCapability("fanbus.operations.manage")
    && trip.canManageOperations !== false;

  const canManagePaymentMarker =
    hasCapability("fanbus.payment_marker.manage")
    && trip.canManagePaymentMarker !== false;

  return {
    canManageRegistrations,
    canManageOperations,
    canManagePaymentMarker,
    canRead:
      canManageRegistrations
      || canManageOperations
      || canManagePaymentMarker
  };
}

function tripNavigation(trip) {
  const canManage =
    hasCapability("fanbus.manage")
    && trip.canManage !== false;

  const operationsAccess =
    fanbusOperationsAccess(trip);

  const canOpenOccupancy =
    canManage
    || operationsAccess.canManageRegistrations;

  return `<nav class="v4-m310-trip-nav" aria-label="Bereiche der Fanbusfahrt">
    ${canOpenOccupancy ? `<button class="button small secondary" type="button" data-m310-occupancy="${escapeAttr(trip.id)}">Belegung</button>` : ""}
    ${operationsAccess.canRead ? `<button class="button small secondary" type="button" data-m325-operations="${escapeAttr(trip.id)}">Fahrtbetrieb</button>` : ""}
    ${canManage && trip.status !== "CANCELLED" ? `<button class="icon-button v4-m310-trip-settings" type="button" data-m310-trip-settings aria-label="Verwaltung öffnen" aria-controls="m310TripManagement" aria-expanded="false">⚙️</button>` : ""}
  </nav>
  ${canManage && trip.status !== "CANCELLED" ? `<div id="m310TripManagement" class="v4-m310-trip-management" data-m310-trip-management hidden>${tripManagementActions(trip) || '<p class="subtle">Keine Verwaltungsaktion verfügbar.</p>'}</div>` : ""}`;
}

function normalizedTripDetailStops(stops) {
  const seen = new Set();
  return (Array.isArray(stops) ? stops : [])
    .filter(stop => stop && stop.isActive !== false)
    .filter(stop => {
      const key = String(
        stop.tripBoardingStopId
        || stop.id
        || `${String(stop.label || "").trim().toLocaleLowerCase("de-DE")}|${stop.departureAt || ""}`
      );
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function tripDetailStopsMarkup(stops) {
  const items = normalizedTripDetailStops(stops);
  if (!items.length) return "";

  return `<div class="full v4-m325-trip-stops">
    <span>Zustiegsorte</span>
    <strong class="v4-preserve-lines">${items.map(stop =>
      `${escapeHtml(stop.label || "Zustieg")}${stop.departureAt ? ` · ${escapeHtml(formatBerlinTime(stop.departureAt))}` : ""}`
    ).join("<br>")}</strong>
  </div>`;
}

async function loadTripDetailStops(trip) {
  const internal = hasCapability("fanbus.manage") || hasCapability("fanbus.registrations.manage");
  const data = internal
    ? await call("fanbus_trip_boarding_stops_list", { tripId: trip.id })
    : await call("fanbus_trip_boarding_stops_public", { tripId: trip.id });
  return Array.isArray(data?.stops) ? data.stops : [];
}

function tripDetailMarkup(trip, tripStops = []) {
  return `<div class="v4-m325-trip-detail">
    <div class="v4-m310-trip-heading v4-m325-trip-lifecycle">
      <span class="subtle">Status</span>
      ${tripLifecycleBadge(trip)}
    </div>
    ${trip.status === "CANCELLED" ? `<div class="notice error v4-m330-cancellation" role="status"><strong>Fahrt abgesagt</strong><p>${escapeHtml(trip.cancellationReason || "Diese Fanbusfahrt findet nicht statt.")}</p>${trip.cancelledAt ? `<small>Abgesagt am ${escapeHtml(formatBerlinDateTime(trip.cancelledAt))}</small>` : ""}</div>` : ""}
    <div class="v4-detail-grid v4-m325-trip-facts">
      <div class="v4-m325-trip-date"><span>Termin / Spielzeit</span><strong>${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeCompact(trip.eventTime))}</strong></div>
      ${trip.venue ? `<div><span>Ziel / Ort</span><strong>${escapeHtml(trip.venue)}</strong></div>` : `<div><span>Ziel / Ort</span><strong>Noch nicht festgelegt</strong></div>`}
      ${trip.opponentName ? `<div class="full"><span>Gegner</span><strong>${escapeHtml(trip.opponentName)}</strong></div>` : ""}
      <div class="full v4-m325-trip-travel"><div><span>Abfahrt</span><strong>${escapeHtml(formatBerlinDateTime(trip.departureAt))}</strong></div><div><span>Fahrtpreis</span><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div></div>
      <div class="full v4-m325-trip-registration-window"><strong>${escapeHtml(registrationWindowText(trip))}</strong></div>
      ${tripDetailStopsMarkup(tripStops)}
    </div>
    ${trip.status === "PUBLISHED" ? `<a class="button small primary v4-m310-register-link" href="./fanbus-anmeldung?trip=${escapeAttr(trip.id)}">${["OPEN", "WAITLIST"].includes(trip.registrationStatus) ? "Jetzt anmelden" : "Anmeldung ansehen"}</a>` : ""}
    ${tripNavigation(trip)}
  </div>`;
}

function openTripDetail(trip) {
  const dialog = openDialog({
    title: trip.displayTitle || "Fanbusfahrt",
    kicker: `${formatCalendarDate(trip.eventDate)} · ${eventTimeCompact(trip.eventTime)}`,
    body: tripDetailMarkup(trip)
  });
  dialog.dataset.m310TripMode = "detail";
  bindTripDetail(dialog, trip);
  void hydrateTripDetailStops(dialog, trip);
}

async function hydrateTripDetailStops(dialog, trip) {
  const contextId = dialog?.dataset?.v4DialogContext || "";
  try {
    const stops = await loadTripDetailStops(trip);
    if (!dialog?.open
        || dialog.dataset.v4DialogContext !== contextId
        || dialog.dataset.m310TripMode !== "detail") return;
    restoreTripOverview(dialog, trip, stops);
  } catch {
    // Zusatzanzeige: Fahrtdetail bleibt auch bei fehlenden Zustiegsdaten nutzbar.
  }
}

function bindTripDetail(dialog, trip) {
  const settings = dialog.querySelector("[data-m310-trip-settings]");
  const management = dialog.querySelector("[data-m310-trip-management]");
  settings?.addEventListener("click", () => {
    const open = management?.hidden !== false;
    if (management) management.hidden = !open;
    settings.setAttribute("aria-expanded", String(open));
    settings.setAttribute("aria-label", open ? "Verwaltung schließen" : "Verwaltung öffnen");
  });

  dialog.querySelector("[data-m310-edit-mode]")?.addEventListener("click", () => {
    dialog.dataset.m310TripMode = "edit";
    const body = dialog.querySelector("#v4DialogBody");
    if (!body) return;
    body.innerHTML = `<div class="v4-m325-trip-detail v4-m310-trip-edit-mode">
      <div class="v4-m310-trip-heading"><strong>${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeCompact(trip.eventTime))}</strong></div>
      <p class="subtle">Spieltermin, Gegner und Spielort werden im Terminmodul verwaltet.</p>
      ${tripForm(trip)}
      <div class="dialog-actions v4-detail-actions"><button class="button ghost" type="button" data-m310-cancel-edit>Abbrechen</button><button class="button primary" type="submit" form="m310TripEditorForm">Änderungen speichern</button></div>
    </div>`;
    bindInlineTripEditor(dialog, trip);
  });

  bindTripActions(dialog, [trip]);
}

function restoreTripOverview(dialog, trip, tripStops = null) {
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  dialog.dataset.m310TripMode = "detail";
  body.innerHTML = tripDetailMarkup(trip, Array.isArray(tripStops) ? tripStops : []);
  bindTripDetail(dialog, trip);
  if (tripStops === null) void hydrateTripDetailStops(dialog, trip);
}

function bindInlineTripEditor(dialog, trip) {
  const form = dialog.querySelector("#m310TripEditorForm");
  bindTripEditorDateDefaults(form, trip);
  dialog.querySelector("[data-m310-cancel-edit]")
    ?.addEventListener("click", () => restoreTripOverview(dialog, trip));
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = dialog.querySelector('[type="submit"][form="m310TripEditorForm"]');
    if (button) button.disabled = true;
    try {
      snapshot = await runWrite(
        () => call("fanbus_trip_update", tripUpdatePayload(trip, Object.fromEntries(new FormData(form)))),
        "Fanbusfahrt wurde aktualisiert."
      );
      render();
      const updated = trips().find(item => item.id === trip.id);
      if (updated) restoreTripOverview(dialog, updated);
      else dialog.close();
    } catch (error) {
      showToast(error?.message || "Fanbusfahrt konnte nicht aktualisiert werden.", "error", 5200);
      if (button?.isConnected) button.disabled = false;
    }
  });
}

function tripTable(items) {
  return `<div class="v4-table-wrap v4-desktop-table">
    <table class="v4-table v4-compact-table">
      <thead><tr><th>Datum</th><th>Fahrt / Spiel</th><th>Ziel / Gegner</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(trip => `<tr class="v4-interactive-row" tabindex="0" role="button" data-m310-open-trip="${escapeAttr(trip.id)}" aria-label="Details zu ${escapeAttr(trip.displayTitle || "Fanbusfahrt")}">
        <td>${escapeHtml(formatCalendarDate(trip.eventDate))}<small>${escapeHtml(eventTimeLabel(trip.eventTime))}</small></td>
        <td><strong>${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong></td>
        <td>${escapeHtml(trip.opponentName || trip.venue || "–")}</td>
        <td>${tripBadges(trip)}</td>
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

function setupFanbusActionMenu(canManage) {
  const root = document.getElementById("m310FanbusManagement");
  const toggle = document.getElementById("m310FanbusActionToggle");
  const menu = document.getElementById("m310FanbusActionMenu");
  const addButton = document.getElementById("m310AddTripButton");
  const companionButton = document.getElementById("m325CompanionListsButton");
  if (!root || !toggle || !menu) return;

  const close = ({ restoreFocus = false } = {}) => {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Fanbus-Aktionen öffnen");
    if (restoreFocus) toggle.focus({ preventScroll: true });
  };
  const open = () => {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fanbus-Aktionen schließen");
    menu.querySelector('[role="menuitem"]:not([hidden])')?.focus({ preventScroll: true });
  };

  if (addButton) {
    addButton.hidden = !canManage;
    addButton.onclick = canManage ? () => { close(); void openTripCreate(); } : null;
  }
  if (companionButton) {
    companionButton.onclick = () => {
      close();
      window.location.hash = "#/fanbuses?view=companions";
    };
  }
  toggle.onclick = () => menu.hidden ? open() : close({ restoreFocus: true });

  if (root.dataset.actionMenuBound !== "true") {
    root.dataset.actionMenuBound = "true";
    document.addEventListener("click", event => {
      if (!root.contains(event.target)) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) {
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: true });
      }
    }, true);
  }
}

function render() {
  const panel = document.getElementById("m310FanbusList");
  const summary = document.getElementById("m310FanbusSummary");
  if (!panel) return;

  const routeQuery = new URLSearchParams(String(window.location.hash || "").split("?")[1] || "");
  if (routeQuery.get("view") === "companions") {
    setWorkspaceShell(true);
    void renderCompanionWorkspace(panel, summary, routeQuery.get("fromTrip"));
    return;
  }
  if (routeQuery.get("view") === "operations" && routeQuery.get("trip")) {
    setWorkspaceShell(true);
    void renderOperationsWorkspace(
      panel,
      summary,
      routeQuery.get("trip"),
      routeQuery.get("fromTrip")
    );
    return;
  }

  setWorkspaceShell(false);

  const items = trips();
  const canManage = hasCapability("fanbus.manage");
  setupFanbusActionMenu(canManage);

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
  const detailTrip = items.find(item => item.id === routeQuery.get("detail"));
  if (detailTrip) {
    window.history.replaceState(null, "", "#/fanbuses");
    openTripDetail(detailTrip);
  }
  setStatus("Aktuell", "success");
}

function setWorkspaceShell(active) {
  document.getElementById("m310FanbusPage")?.classList.toggle("v4-m325-workspace-active", active);
}

function returnToFanbuses(tripId = "") {
  window.location.hash = tripId
    ? `#/fanbuses?detail=${encodeURIComponent(tripId)}`
    : "#/fanbuses";
}

function workspaceLoading(title, message, returnTripId = "") {
  return `<section class="v4-m325-workspace v4-m325-workspace-loading">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m325-back>Zurück</button>
      <div><h2>${escapeHtml(title)}</h2><p class="subtle">${escapeHtml(message)}</p></div>
    </header>
  </section>`;
}

function companionPersonBadge(member) {
  if (!member?.linkedPortalUserId) return "";
  const inactive = member.portalUserStatus !== "ACTIVE";
  return `<span class="v4-person-badge${inactive ? " is-inactive" : ""}">${inactive ? "Portaluser · inaktiv" : "Portaluser"}</span>${member.isMember ? '<span class="v4-person-badge">Mitglied</span>' : ""}`;
}

function companionListCard(list, stopLabels) {
  const members = Array.isArray(list?.members) ? list.members : [];
  return `<article class="v4-compact-record v4-m325-list-card">
    <div class="v4-compact-record-copy v4-m325-record-copy"><strong>${escapeHtml(list.name)}</strong><small>${members.length} ${members.length === 1 ? "Person" : "Personen"}</small></div>
    <div class="v4-row-actions v4-m325-list-actions">
      <button class="button small secondary" data-m325-rename-list="${escapeAttr(list.id)}">Umbenennen</button>
      <button class="button small secondary" data-m325-add-member="${escapeAttr(list.id)}">Gast hinzufügen</button>
      <button class="button small secondary" data-m325-search-person="${escapeAttr(list.id)}">Portaluser suchen</button>
      <button class="button small danger" data-m325-delete-list="${escapeAttr(list.id)}" data-revision="${escapeAttr(list.revision)}">Löschen</button>
    </div>
    ${members.map((member, index) => `<div class="v4-m325-member">
      <div class="v4-compact-record-copy v4-m325-record-copy"><div class="v4-m325-person-title"><strong>${escapeHtml(`${member.firstName} ${member.lastName}`)}</strong>${companionPersonBadge(member)}</div><small>Buswunsch: ${escapeHtml(busPreferenceText(member.defaultBusPreference))}${member.defaultBoardingStopId ? ` · Standard-Zustieg: ${escapeHtml(stopLabels.get(member.defaultBoardingStopId) || "Nicht mehr aktiv")}` : " · Kein Standard-Zustieg"}${member.operationalNote ? " · Operativer Hinweis" : ""}</small></div>
      <div class="v4-row-actions v4-m325-member-actions">
        <button class="button small secondary" data-m325-move-member="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>↑</button>
        <button class="button small secondary" data-m325-move-member="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}" data-direction="1"${index === members.length - 1 ? " disabled" : ""}>↓</button>
        <button class="button small secondary" data-m325-edit-member="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}">Bearbeiten</button>
        ${member.linkedPortalUserId
          ? `<button class="button small secondary" data-m325-unlink-person="${escapeAttr(member.id)}" data-revision="${escapeAttr(member.revision)}">Verknüpfung lösen</button>`
          : `<button class="button small secondary" data-m325-link-person="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}">Portaluser verknüpfen</button>`}
        <button class="button small danger" data-m325-delete-member="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}" data-revision="${escapeAttr(member.revision)}">Entfernen</button>
      </div>
    </div>`).join("")}
  </article>`;
}

async function renderCompanionWorkspace(panel, summary, returnTripId = "") {
  if (summary) summary.textContent = "";
  panel.innerHTML = workspaceLoading("Meine Mitfahrer", "Mitfahrerlisten werden geladen …", returnTripId);
  panel.querySelector("[data-m325-back]")?.addEventListener("click", () => returnToFanbuses(returnTripId));
  try {
    const [data, stopData] = await Promise.all([
      call("fanbus_companion_lists_list"),
      call("fanbus_boarding_stops_list")
    ]);
    const lists = Array.isArray(data?.lists) ? data.lists : [];
    const stopLabels = new Map(
      (stopData?.stops || []).map(stop => [stop.id, stop.label])
    );
    panel.innerHTML = `<section class="v4-m325-workspace v4-m325-companion-workspace">
      <header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m325-back>Zurück</button><div><h2>Meine Mitfahrer</h2><p>Gespeicherte Personen sind nur Vorlagen. Änderungen betreffen keine vergangenen Buchungen.</p></div></header>
      <section class="v4-m325-workspace-section" aria-labelledby="m325CompanionListsTitle"><h3 id="m325CompanionListsTitle">Vorhandene Listen</h3>
      ${lists.length ? `<div class="v4-mobile-records v4-m325-companion-lists">${lists.map(list => companionListCard(list, stopLabels)).join("")}</div>` : empty("Noch keine Mitfahrerlisten vorhanden.")}</section>
      <section class="v4-m325-workspace-section v4-m325-new-list"><h3>Neue Liste</h3><form class="form-grid v4-smart-form" data-m325-list-form><label class="v4-field-full">Listenname<input name="name" maxlength="120" required placeholder="z. B. Auswärtsfahrt"></label><div class="v4-detail-actions v4-field-full"><button class="button small primary" type="submit">Liste anlegen</button></div></form></section>
    </section>`;
    panel.querySelector("[data-m325-back]")?.addEventListener("click", () => returnToFanbuses(returnTripId));
    panel.querySelector("[data-m325-list-form]")?.addEventListener("submit", async event => {
      event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
      await runWrite(() => call("fanbus_companion_list_upsert", { name: new FormData(form).get("name") }), "Liste angelegt.");
      await renderCompanionWorkspace(panel, summary, returnTripId);
    });
    panel.querySelectorAll("[data-m325-delete-list]").forEach(button => button.addEventListener("click", async () => {
      if (!await confirmAction("Liste löschen?", "Die Vorlage wird gelöscht. Bereits gebuchte Teilnehmer bleiben unverändert.")) return;
      await runWrite(() => call("fanbus_companion_list_delete", { id: button.dataset.m325DeleteList, expectedRevision: Number(button.dataset.revision) }), "Liste gelöscht.");
      await renderCompanionWorkspace(panel, summary, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-rename-list]").forEach(button => button.addEventListener("click", () => {
      const list = lists.find(item => item.id === button.dataset.m325RenameList);
      if (list) openCompanionListRename(list, panel, summary, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-add-member]").forEach(button => button.addEventListener("click", () => { void openCompanionMemberDialog(button.dataset.m325AddMember, panel, summary, null, returnTripId); }));
    panel.querySelectorAll("[data-m325-search-person]").forEach(button => button.addEventListener("click", () => {
      openCompanionPersonSearchDialog(button.dataset.m325SearchPerson, panel, summary, null, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-edit-member]").forEach(button => button.addEventListener("click", () => {
      const list = lists.find(item => item.id === button.dataset.listId);
      void openCompanionMemberDialog(button.dataset.listId, panel, summary, list?.members.find(item => item.id === button.dataset.m325EditMember), returnTripId);
    }));
    panel.querySelectorAll("[data-m325-move-member]").forEach(button => button.addEventListener("click", async () => {
      const list = lists.find(item => item.id === button.dataset.listId);
      const index = list?.members.findIndex(item => item.id === button.dataset.m325MoveMember) ?? -1;
      const targetIndex = index + Number(button.dataset.direction);
      if (!list || index < 0 || targetIndex < 0 || targetIndex >= list.members.length) return;
      const ordered = list.members.map(item => item.id);
      [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
      await runWrite(() => call("fanbus_companion_members_reorder", { listId: list.id, memberIds: ordered }), "Reihenfolge aktualisiert.");
      await renderCompanionWorkspace(panel, summary, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-link-person]").forEach(button => button.addEventListener("click", () => {
      const list = lists.find(item => item.id === button.dataset.listId);
      const member = list?.members.find(item => item.id === button.dataset.m325LinkPerson);
      if (member) openCompanionPersonSearchDialog(list.id, panel, summary, member, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-unlink-person]").forEach(button => button.addEventListener("click", async () => {
      if (!await confirmAction("Verknüpfung lösen?", "Die Person bleibt als Gast mit dem zuletzt gespeicherten Namen in der Liste erhalten.")) return;
      await runWrite(() => call("fanbus_companion_person_unlink", {
        id: button.dataset.m325UnlinkPerson,
        expectedRevision: Number(button.dataset.revision)
      }), "Verknüpfung gelöst.");
      await renderCompanionWorkspace(panel, summary, returnTripId);
    }));
    panel.querySelectorAll("[data-m325-delete-member]").forEach(button => button.addEventListener("click", async () => {
      if (!await confirmAction("Mitfahrer entfernen?", "Die Vorlage wird entfernt. Bereits gebuchte Teilnehmer bleiben unverändert.")) return;
      await runWrite(() => call("fanbus_companion_member_delete", { id: button.dataset.m325DeleteMember, expectedRevision: Number(button.dataset.revision) }), "Mitfahrer entfernt.");
      await renderCompanionWorkspace(panel, summary, returnTripId);
    }));
  } catch (error) { panel.innerHTML = errorPanel(error, "Mitfahrerlisten konnten nicht geladen werden"); }
}

function openCompanionListRename(list, panel, summary, returnTripId = "") {
  const dialog = openDialog({ title: "Liste umbenennen", body: `<form class="form-grid v4-smart-form" data-m325-rename-form><label class="v4-field-full">Name<input name="name" maxlength="120" value="${escapeAttr(list.name)}" required></label><div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary" type="submit">Speichern</button></div></form>` });
  dialog.querySelector("[data-m325-rename-form]")?.addEventListener("submit", async event => {
    event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity()) return;
    await runWrite(()=>call("fanbus_companion_list_upsert",{id:list.id,expectedRevision:list.revision,name:new FormData(form).get("name")}),"Liste umbenannt.");
    dialog.close(); await renderCompanionWorkspace(panel,summary,returnTripId);
  });
}

async function openCompanionMemberDialog(listId, panel, summary, member = null, returnTripId = "") {
  let masterStops=[];
  try { masterStops=(await call("fanbus_boarding_stops_list"))?.stops?.filter(stop=>stop.isActive)||[]; }
  catch (error) { showToast(error?.message||"Zustiegsorte konnten nicht geladen werden.","error",5200); return; }
  const linked = Boolean(member?.linkedPortalUserId);
  const dialog = openDialog({ title: member ? "Mitfahrer bearbeiten" : "Gast hinzufügen", body: `<form class="form-grid v4-smart-form" data-m325-member-form><label class="v4-field-half">Vorname<input name="firstName" maxlength="120" required value="${escapeAttr(member?.firstName || "")}"${linked ? " readonly" : ""}></label><label class="v4-field-half">Nachname<input name="lastName" maxlength="120" required value="${escapeAttr(member?.lastName || "")}"${linked ? " readonly" : ""}></label>${linked ? '<p class="subtle v4-field-full">Der aktuelle Portalusername ist verbindlich und kann hier nicht geändert werden.</p>' : ""}<label class="v4-field-half">Buswunsch<select name="defaultBusPreference"><option value="EGAL"${member?.defaultBusPreference === "EGAL" ? " selected" : ""}>Egal</option><option value="RUHIG"${member?.defaultBusPreference === "RUHIG" ? " selected" : ""}>Ruhig</option><option value="PARTY"${member?.defaultBusPreference === "PARTY" ? " selected" : ""}>Party</option></select></label><label class="v4-field-half">Standard-Zustiegsort<select name="defaultBoardingStopId"><option value="">Kein Standard</option>${masterStops.map(stop=>`<option value="${escapeAttr(stop.id)}"${stop.id===member?.defaultBoardingStopId?" selected":""}>${escapeHtml(stop.label)}</option>`).join("")}</select></label><label class="v4-field-full">Operativer Hinweis (optional)<textarea name="operationalNote" maxlength="240">${escapeHtml(member?.operationalNote || "")}</textarea></label><div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary" type="submit">Speichern</button></div></form>` });
  dialog.querySelector("[data-m325-member-form]")?.addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    await runWrite(() => call("fanbus_companion_member_upsert", {
      listId,
      ...(member ? { id: member.id, expectedRevision: member.revision } : {}),
      ...values,
      ...(linked ? { firstName: member.firstName, lastName: member.lastName } : {})
    }), "Mitfahrer gespeichert.");
    dialog.close(); await renderCompanionWorkspace(panel, summary, returnTripId);
  });
}

function openCompanionPersonSearchDialog(listId, panel, summary, companion = null, returnTripId = "") {
  const dialog = openDialog({
    title: companion ? "Portaluser verknüpfen" : "Portaluser suchen",
    body: `<form class="form-grid v4-smart-form" data-m325-person-search-form>
      <label class="v4-field-full">Portaluser suchen
        <input name="query" type="search" minlength="3" autocomplete="off" placeholder="Mindestens 3 Zeichen">
      </label>
      <p class="subtle v4-field-full" data-m325-person-search-status>Gib mindestens 3 Zeichen des Namens ein.</p>
      <div class="v4-field-full v4-m325-person-search-results" data-m325-person-search-results></div>
    </form>`
  });
  const form = dialog.querySelector("[data-m325-person-search-form]");
  const input = form?.elements.namedItem("query");
  const status = dialog.querySelector("[data-m325-person-search-status]");
  const results = dialog.querySelector("[data-m325-person-search-results]");
  let timer = 0;
  let requestSequence = 0;

  const renderResults = people => {
    results.innerHTML = people.map(person => `<button class="button secondary v4-m325-person-search-result" type="button" data-portal-user-id="${escapeAttr(person.portalUserId)}"><span><strong>${escapeHtml(person.displayName)}</strong></span><span class="v4-person-badges"><span class="v4-person-badge">Portaluser</span>${person.isMember ? '<span class="v4-person-badge">Mitglied</span>' : ""}</span></button>`).join("");
    results.querySelectorAll("[data-portal-user-id]").forEach(button => button.addEventListener("click", async () => {
      const selected = people.find(person => person.portalUserId === button.dataset.portalUserId);
      if (!selected) return;
      if (companion) {
        await runWrite(() => call("fanbus_companion_person_link", {
          id: companion.id,
          expectedRevision: Number(companion.revision),
          linkedPortalUserId: selected.portalUserId
        }), "Portaluser verknüpft.");
      } else {
        await runWrite(() => call("fanbus_companion_member_upsert", {
          listId,
          linkedPortalUserId: selected.portalUserId,
          defaultBusPreference: "EGAL",
          defaultBoardingStopId: null,
          operationalNote: null
        }), "Portaluser hinzugefügt.");
      }
      dialog.close();
      await renderCompanionWorkspace(panel, summary, returnTripId);
    }));
  };

  input?.addEventListener("input", () => {
    window.clearTimeout(timer);
    const query = String(input.value || "").trim();
    requestSequence += 1;
    const sequence = requestSequence;
    results.replaceChildren();
    if (query.length < 3) {
      status.textContent = "Gib mindestens 3 Zeichen des Namens ein.";
      return;
    }
    status.textContent = "Suche läuft …";
    timer = window.setTimeout(async () => {
      try {
        const data = await call("fanbus_companion_person_search", { query });
        if (sequence !== requestSequence) return;
        const people = Array.isArray(data?.people) ? data.people.slice(0, 8) : [];
        status.textContent = people.length ? `${people.length} Treffer` : "Keine aktiven Portaluser gefunden.";
        renderResults(people);
      } catch (error) {
        if (sequence !== requestSequence) return;
        status.textContent = error?.message || "Portalusersuche fehlgeschlagen.";
      }
    }, 300);
  });
  input?.focus();
}

function operationEventLabel(trip) {
  const title = String(trip?.displayTitle || "").trim();
  if (!title) return "Fanbusfahrt";

  return title
    .replace(/^Mighty Dogs Schweinfurt\\s+[–-]\\s+/u, "")
    .replace(/\\s+[–-]\\s+Mighty Dogs Schweinfurt$/u, "")
    || title;
}

async function renderOperationsWorkspace(panel, summary, tripId, returnTripId = "") {
  const trip = trips().find(item => item.id === tripId);
  const access = fanbusOperationsAccess(trip || {});

  if (!access.canRead) {
    returnToFanbuses();
    return;
  }

  if (summary) summary.textContent = "";

  panel.innerHTML = workspaceLoading(
    "Fahrtbetrieb",
    "Betriebsdaten werden geladen …",
    returnTripId
  );

  panel.querySelector("[data-m325-back]")
    ?.addEventListener(
      "click",
      () => returnToFanbuses(returnTripId)
    );

  try {
    const data = await call(
      "fanbus_operations_snapshot",
      { tripId }
    );

    const totals = data.summary || {};

    const participants =
      Array.isArray(data.participants)
        ? data.participants
        : [];

    const paidCount =
      participants.filter(
        person => person.isPaid === true
      ).length;

    const readOnly =
      trip?.status === "CANCELLED";
    panel.innerHTML = `<section class="v4-m325-workspace v4-m325-operations-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m325-back>← Zurück</button><div><h2>Fahrtbetrieb</h2><p>${escapeHtml(formatCalendarDate(trip?.eventDate))} · ${escapeHtml(operationEventLabel(trip))} · Check-in</p></div></header>${readOnly ? '<p class="notice error">Die Fahrt ist abgesagt. Betriebsdaten bleiben historisch lesbar und können nicht mehr geändert werden.</p>' : ""}<div class="v4-m325-counters"><span><strong>${Number(totals.expected || 0)}</strong>Angemeldet</span><span><strong>${Number(totals.present || 0)}</strong>Anwesend</span><span><strong>${paidCount}</strong>Bezahlt</span><span><strong>${Number(totals.noShow || 0)}</strong>Fehlt</span></div>${Number(totals.unassignedBusCount || 0) || Number(totals.missingBoardingStopCount || 0) ? `<p class="notice warning v4-m325-operation-warning">${Number(totals.unassignedBusCount || 0)} ohne Bus · ${Number(totals.missingBoardingStopCount || 0)} ohne Zustiegsort</p>` : ""}<form class="form-grid v4-smart-form v4-m325-operation-filters" data-m325-operation-filters><label class="v4-field-full">Suche<input name="search" type="search" placeholder="Teilnehmer suchen" value="${escapeAttr(operationsUiState.search)}"></label><label class="v4-field-four">Status<select name="status"><option value="ALL">Alle</option><option value="PRESENT">Anwesend</option><option value="NO_SHOW">Fehlt</option></select></label><label class="v4-field-four">Bus<select name="bus"><option value="ALL">Alle</option>${(data.buses || []).map(bus => `<option value="${escapeAttr(bus.busId)}">${escapeHtml(bus.label)}</option>`).join("")}</select></label><label class="v4-field-four">Zustiegsort<select name="stop"><option value="ALL">Alle</option>${(data.stops || []).map(stop => `<option value="${escapeAttr(stop.tripBoardingStopId)}">${escapeHtml(stop.label)}</option>`).join("")}</select></label></form><div class="v4-mobile-records v4-m325-operation-list" data-m325-operation-list>${operationCards(participants, {
      readOnly,
      canManageOperations: access.canManageOperations,
      canManagePaymentMarker: access.canManagePaymentMarker
    })}<p class="subtle" data-m325-operation-empty hidden>Keine Teilnehmer entsprechen den Filtern.</p></div></section>`;
    panel.querySelector("[data-m325-back]")?.addEventListener("click", () => returnToFanbuses(returnTripId));
    const filters = panel.querySelector("[data-m325-operation-filters]");
    if (!["ALL", "PRESENT", "NO_SHOW"].includes(operationsUiState.status)) {
      operationsUiState.status = "ALL";
    }
    filters.elements.status.value = operationsUiState.status;
    filters.elements.bus.value = operationsUiState.bus;
    filters.elements.stop.value = operationsUiState.stop;
    filters.addEventListener("input", () => filterOperations(panel));
    filters.addEventListener("change", () => filterOperations(panel));
    filterOperations(panel);
    if (
      !readOnly
      && (
        access.canManageOperations
        || access.canManagePaymentMarker
      )
    ) {
      bindOperationActions(
        panel,
        summary,
        tripId,
        returnTripId
      );
    }
    requestAnimationFrame(() => document.getElementById("view")
      ?.scrollTo({ top: operationsUiState.scrollY, behavior: "auto" }));
  } catch (error) { panel.innerHTML = errorPanel(error, "Fahrtbetrieb konnte nicht geladen werden"); }
}

function operationCards(participants, access = {}) {
  const readOnly = Boolean(access.readOnly);

  const canManageOperations =
    !readOnly
    && Boolean(access.canManageOperations);

  const canManagePaymentMarker =
    !readOnly
    && Boolean(access.canManagePaymentMarker);

  return participants.map(person => {
    const isPresent =
      person.checkinStatus === "PRESENT";

    const isMissing =
      person.checkinStatus === "NO_SHOW";

    const statusBadge = isPresent
      ? '<span class="badge success">Anwesend</span>'
      : isMissing
        ? '<span class="badge danger">Fehlt</span>'
        : "";

    const actions = [];

    if (canManageOperations) {
      actions.push(
        `<button
          class="button small ${isPresent ? "primary" : "secondary"} v4-m325-checkin-toggle"
          type="button"
          aria-pressed="${isPresent ? "true" : "false"}"
          data-m325-checkin="PRESENT"
          data-current-status="${escapeAttr(person.checkinStatus || "OPEN")}"
          data-id="${escapeAttr(person.id)}"
          data-revision="${escapeAttr(person.checkinRevision)}"
        >${isPresent ? "✓ Anwesend" : "Anwesend"}</button>`
      );
    }

    if (canManagePaymentMarker) {
      actions.push(
        `<button
          class="button small ${person.isPaid ? "primary" : "secondary"} v4-m325-paid-toggle"
          type="button"
          aria-pressed="${person.isPaid ? "true" : "false"}"
          data-m325-paid="${person.isPaid ? "false" : "true"}"
          data-id="${escapeAttr(person.id)}"
          data-revision="${escapeAttr(person.checkinRevision)}"
        >${person.isPaid ? "✓ Bezahlt" : "Bezahlt"}</button>`
      );
    }

    if (canManageOperations) {
      actions.push(
        `<button
          class="button small ${isMissing ? "danger" : "secondary"} v4-m325-checkin-toggle"
          type="button"
          aria-pressed="${isMissing ? "true" : "false"}"
          data-m325-checkin="NO_SHOW"
          data-current-status="${escapeAttr(person.checkinStatus || "OPEN")}"
          data-id="${escapeAttr(person.id)}"
          data-revision="${escapeAttr(person.checkinRevision)}"
        >${isMissing ? "✓ Fehlt" : "Fehlt"}</button>`
      );
    }

    const paymentStatus =
      `<small>${person.isPaid
        ? "Bezahlt"
        : "Nicht als bezahlt markiert"
      }</small>`;

    const controls = actions.length
      ? `<div class="v4-row-actions v4-m325-checkin-actions">${actions.join("")}</div>${canManagePaymentMarker ? "" : paymentStatus}`
      : paymentStatus;

    return `<article
      class="v4-compact-record v4-m325-operation-card"
      data-m325-participant="${escapeAttr(
        `${person.firstName} ${person.lastName}`
          .toLocaleLowerCase("de-DE")
      )}"
      data-status="${escapeAttr(person.checkinStatus)}"
      data-bus="${escapeAttr(person.busId || "")}"
      data-stop="${escapeAttr(person.tripBoardingStopId || "")}"
    >
      <div class="v4-compact-record-copy v4-m325-record-copy">
        <strong>${escapeHtml(
          `${person.firstName} ${person.lastName}`
        )}</strong>
        <small>
          ${escapeHtml(person.busLabel || "Kein Bus")}
          ·
          ${escapeHtml(
            person.boardingStopLabel || "Kein Zustiegsort"
          )}
          ${person.departureAt
            ? ` · ${escapeHtml(
                formatBerlinTime(person.departureAt)
              )}`
            : ""
          }
        </small>
      </div>
      ${statusBadge}
      ${controls}
    </article>`;
  }).join("") || empty("Keine aktiven Teilnehmer.");
}

function filterOperations(panel) {
  const form = panel.querySelector("[data-m325-operation-filters]");
  if (!form) return;
  operationsUiState = { ...operationsUiState, search: form.elements.search.value.trim(), status: form.elements.status.value, bus: form.elements.bus.value, stop: form.elements.stop.value };
  const term = operationsUiState.search.toLocaleLowerCase("de-DE");
  let visible = 0;
  panel.querySelectorAll("[data-m325-participant]").forEach(card => {
    const show = (!term || card.dataset.m325Participant.includes(term)) && (operationsUiState.status === "ALL" || card.dataset.status === operationsUiState.status) && (operationsUiState.bus === "ALL" || card.dataset.bus === operationsUiState.bus) && (operationsUiState.stop === "ALL" || card.dataset.stop === operationsUiState.stop);
    card.hidden = !show; if (show) visible += 1;
  });
  const emptyState = panel.querySelector("[data-m325-operation-empty]"); if (emptyState) emptyState.hidden = visible > 0;
}

function bindOperationActions(panel, summary, tripId, returnTripId = "") {
  panel.querySelectorAll("[data-m325-checkin]").forEach(button => button.addEventListener("click", async () => {
    try {
      operationsUiState.scrollY = document.getElementById("view")?.scrollTop || 0;
      const requestedStatus = button.dataset.m325Checkin;
      const nextStatus = button.dataset.currentStatus === requestedStatus
        ? "OPEN"
        : requestedStatus;

      await runWrite(() => call("fanbus_checkin_set", {
        participantId: button.dataset.id,
        expectedRevision: Number(button.dataset.revision),
        status: nextStatus
      }), "Check-in aktualisiert.");
      await renderOperationsWorkspace(panel, summary, tripId, returnTripId);
    } catch (error) {
      showToast(error?.message || "Check-in konnte nicht geändert werden.", "error", 5200);
    }
  }));

  panel.querySelectorAll("[data-m325-paid]").forEach(button => button.addEventListener("click", async () => {
    try {
      operationsUiState.scrollY = document.getElementById("view")?.scrollTop || 0;
      const isPaid = button.dataset.m325Paid === "true";
      await runWrite(() => call("fanbus_paid_set", {
        participantId: button.dataset.id,
        expectedRevision: Number(button.dataset.revision),
        isPaid
      }), isPaid ? "Teilnehmer als bezahlt markiert." : "Bezahlt-Markierung entfernt.");
      await renderOperationsWorkspace(panel, summary, tripId, returnTripId);
    } catch (error) {
      showToast(error?.message || "Bezahlt-Markierung konnte nicht geändert werden.", "error", 5200);
    }
  }));
}

function openWorkspaceRoute(source, route) {
  const fromTrip = new URLSearchParams(String(route).split("?")[1] || "").get("fromTrip");
  if (fromTrip) {
    window.history.replaceState(null, "", `#/fanbuses?detail=${encodeURIComponent(fromTrip)}`);
  }
  closeAllDialogs();
  window.location.hash = route;
}

function bindTripActions(panel, items) {
  panel.querySelectorAll("[data-m310-occupancy]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Occupancy);
      if (trip) void openOccupancy(trip);
    });
  });
  panel.querySelectorAll("[data-m325-companions]").forEach(button => {
    button.addEventListener("click", () => {
      const tripId = button.dataset.m325Companions;
      openWorkspaceRoute(
        button,
        `#/fanbuses?view=companions&fromTrip=${encodeURIComponent(tripId)}`
      );
    });
  });
  panel.querySelectorAll("[data-m325-operations]").forEach(button => {
    button.addEventListener("click", () => {
      operationsUiState = { status: "ALL", bus: "ALL", stop: "ALL", search: "", scrollY: 0 };
      const tripId = button.dataset.m325Operations;
      openWorkspaceRoute(
        button,
        `#/fanbuses?view=operations&trip=${encodeURIComponent(tripId)}&fromTrip=${encodeURIComponent(tripId)}`
      );
    });
  });
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

  panel.querySelectorAll("[data-m330-cancel-trip]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m330CancelTrip);
      if (trip) openTripCancellation(trip, button);
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
  panel.querySelectorAll("[data-m325-stops]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m325Stops);
      if (trip) openBoardingStops(trip);
    });
  });
}

async function openBoardingStops(trip) {
  try {
    const [master, tripStops, busMappings] = await Promise.all([
      call("fanbus_boarding_stops_list"),
      call("fanbus_trip_boarding_stops_list", { tripId: trip.id }),
      call("fanbus_bus_boarding_stops_list", { tripId: trip.id })
    ]);
    const stops = master?.stops || [];
    const assigned = tripStops?.stops || [];
    const buses = busMappings?.buses || [];
    const options = stops.filter(stop => stop.isActive).map(stop => `<option value="${escapeAttr(stop.id)}">${escapeHtml(stop.label)}</option>`).join("");
    const masterRecords = stops.length
      ? `<div class="v4-mobile-records v4-m325-stop-records">${stops.map((stop, index) => `<article class="v4-compact-record v4-m325-stop-card">
        <div class="v4-compact-record-copy v4-m325-record-copy"><strong>${escapeHtml(stop.label)}</strong>
        <small>${stop.isActive ? "Aktiv" : "Inaktiv"}${stop.address ? ` · ${escapeHtml(stop.address)}` : ""}</small></div>
        <div class="v4-row-actions v4-m325-stop-actions">
          <button class="button small secondary" type="button" data-m325-master-move="${escapeAttr(stop.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>↑</button>
          <button class="button small secondary" type="button" data-m325-master-move="${escapeAttr(stop.id)}" data-direction="1"${index === stops.length - 1 ? " disabled" : ""}>↓</button>
          <button class="button small secondary" type="button" data-m325-master-edit="${escapeAttr(stop.id)}">Bearbeiten</button>
        </div>
      </article>`).join("")}</div>`
      : "";
    const tripRecords = assigned.length
      ? `<div class="v4-mobile-records v4-m325-stop-records">${assigned.map((stop, index) => `<article class="v4-compact-record v4-m325-stop-card">
        <div class="v4-compact-record-copy v4-m325-record-copy"><strong>${escapeHtml(stop.label)}</strong>
        <small>${escapeHtml(formatBerlinTime(stop.departureAt))} · ${stop.isActive ? "Aktiv" : "Inaktiv"}${stop.tripNote ? ` · ${escapeHtml(stop.tripNote)}` : ""}</small></div>
        <div class="v4-row-actions v4-m325-stop-actions">
          <button class="button small secondary" type="button" data-m325-trip-move="${escapeAttr(stop.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>↑</button>
          <button class="button small secondary" type="button" data-m325-trip-move="${escapeAttr(stop.id)}" data-direction="1"${index === assigned.length - 1 ? " disabled" : ""}>↓</button>
          <button class="button small secondary" type="button" data-m325-trip-edit="${escapeAttr(stop.id)}">Bearbeiten</button>
        </div>
      </article>`).join("")}</div>`
      : empty("Für diese Fahrt sind noch keine strukturierten Zustiegsorte hinterlegt.");
    const busStopForms = buses.length
      ? buses.map(bus => `<form class="form-grid v4-smart-form v4-compact-record v4-m325-bus-stop-card" data-m325-bus-stops="${escapeAttr(bus.busId)}" data-revision="${escapeAttr(bus.revision)}">
        <strong class="v4-field-full">${escapeHtml(bus.label)}</strong>
        <div class="v4-field-full">${assigned.filter(stop => stop.isActive).map(stop => `<label class="check-row"><input type="checkbox" name="stopId" value="${escapeAttr(stop.id)}"${bus.tripBoardingStopIds.includes(stop.id) ? " checked" : ""}><span>${escapeHtml(stop.label)}</span></label>`).join("")}</div>
        <div class="dialog-actions v4-detail-actions v4-field-full"><button class="button small primary" type="submit">Bus-Zustiege speichern</button></div>
      </form>`).join("")
      : empty("Für diese Fahrt sind noch keine Busse angelegt.");
    const dialog = openDialog({
      title: "Zustiegsorte",
      kicker: trip.displayTitle || "Fanbusfahrt",
      body: `<div class="v4-m325-workspace v4-m325-stops-workspace">
        <section class="v4-m325-dialog-section"><div class="v4-m325-dialog-section-heading"><h3>Stammpunkte</h3><button class="button small secondary" type="button" data-m325-create-master>Stammpunkt anlegen</button></div>
        ${masterRecords || empty("Noch keine Stammpunkte vorhanden.")}</section>
        <section class="v4-m325-dialog-section"><h3>Fahrt-Zustiege</h3>
        <form class="form-grid v4-smart-form" data-m325-trip-stop>
          <label class="v4-field-half">Zustiegsort<select name="boardingStopId" required><option value="">Bitte wählen</option>${options}</select></label>
          <label class="v4-field-half">Abfahrtszeit<input name="departureTime" type="time" value="${escapeAttr(defaultTripStopTime(trip))}" required></label>
          <label class="v4-field-full">Fahrthinweis<input name="tripNote"></label>
          <div class="dialog-actions v4-detail-actions v4-field-full"><button class="button small primary" type="submit">Zustieg hinzufügen</button></div>
        </form>
        ${tripRecords}</section>
        <section class="v4-m325-dialog-section"><h3>Busse und Zustiege</h3>${busStopForms}</section>
      </div>`
    });
    dialog.querySelector("[data-m325-create-master]")?.addEventListener("click", () => openMasterStopCreate(trip, stops.length, dialog));
    dialog.querySelector("[data-m325-trip-stop]")?.addEventListener("submit", async event => {
      event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
      const departureAt = tripTimeToBerlinIso(trip, new FormData(form).get("departureTime"), "Abfahrtszeit");
      await runWrite(() => call("fanbus_trip_boarding_stop_upsert", { tripId: trip.id, boardingStopId: new FormData(form).get("boardingStopId"), departureAt, tripNote:new FormData(form).get("tripNote")||null, position: assigned.length + 1, isActive: true }), "Fahrtzustiegsort angelegt."); dialog.close(); void openBoardingStops(trip);
    });
    dialog.querySelectorAll("[data-m325-master-edit]").forEach(button=>button.addEventListener("click",()=>openMasterStopEditor(trip,stops.find(stop=>stop.id===button.dataset.m325MasterEdit),dialog)));
    dialog.querySelectorAll("[data-m325-trip-edit]").forEach(button=>button.addEventListener("click",()=>openTripStopEditor(trip,assigned.find(stop=>stop.id===button.dataset.m325TripEdit),dialog)));
    bindStopReorder(dialog,"[data-m325-master-move]",stops,"fanbus_boarding_stops_reorder",{},trip);
    bindStopReorder(dialog,"[data-m325-trip-move]",assigned,"fanbus_trip_boarding_stops_reorder",{tripId:trip.id},trip);
    dialog.querySelectorAll("[data-m325-bus-stops]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();const ids=new FormData(form).getAll("stopId");await runWrite(()=>call("fanbus_bus_boarding_stops_set",{tripId:trip.id,busId:form.dataset.m325BusStops,expectedRevision:Number(form.dataset.revision),tripBoardingStopIds:ids}),"Bus-Zustiege gespeichert.");dialog.close();void openBoardingStops(trip);}));
  } catch (error) { showToast(error?.message || "Zustiegsorte konnten nicht geladen werden.", "error", 5200); }
}

function bindStopReorder(dialog,selector,items,action,extra,trip){dialog.querySelectorAll(selector).forEach(button=>button.addEventListener("click",async()=>{const id=button.dataset.m325MasterMove||button.dataset.m325TripMove;const index=items.findIndex(item=>item.id===id);const target=index+Number(button.dataset.direction);if(index<0||target<0||target>=items.length)return;const ids=items.map(item=>item.id);[ids[index],ids[target]]=[ids[target],ids[index]];await runWrite(()=>call(action,{...extra,ids}),"Reihenfolge aktualisiert.");dialog.close();void openBoardingStops(trip);}));}

function openMasterStopCreate(trip, position, parent) {
  const dialog = openDialog({
    title: "Stammpunkt anlegen",
    body: `<form class="form-grid v4-smart-form" data-m325-master-stop>
      <label class="v4-field-half">Name<input name="label" maxlength="160" required></label>
      <label class="v4-field-half">Adresse (optional)<input name="address"></label>
      <label class="v4-field-full">Standardhinweis<input name="defaultNote"></label>
      <div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary" type="submit">Speichern</button></div>
    </form>`
  });
  dialog.querySelector("[data-m325-master-stop]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    await runWrite(
      () => call("fanbus_boarding_stop_upsert", {
        ...Object.fromEntries(new FormData(form)),
        position: position + 1,
        isActive: true
      }),
      "Stammpunkt angelegt."
    );
    dialog.close();
    parent?.close();
    void openBoardingStops(trip);
  });
}

function openMasterStopEditor(trip,stop,parent){if(!stop)return;const dialog=openDialog({title:"Stammpunkt bearbeiten",body:`<form class="form-grid v4-smart-form" data-m325-edit-master><label class="v4-field-half">Name<input name="label" maxlength="160" value="${escapeAttr(stop.label)}" required></label><label class="v4-field-half">Adresse<input name="address" value="${escapeAttr(stop.address||"")}"></label><label class="v4-field-full">Standardhinweis<input name="defaultNote" value="${escapeAttr(stop.defaultNote||"")}"></label><label class="check-row v4-compact-check v4-field-full"><input name="isActive" type="checkbox"${stop.isActive?" checked":""}><span>Aktiv</span></label><div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary">Speichern</button></div></form>`});dialog.querySelector("form").addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));await runWrite(()=>call("fanbus_boarding_stop_upsert",{id:stop.id,expectedRevision:stop.revision,label:values.label,address:values.address||null,defaultNote:values.defaultNote||null,position:stop.position,isActive:values.isActive==="on"}),"Stammpunkt aktualisiert.");dialog.close();parent.close();void openBoardingStops(trip);});}

function openTripStopEditor(trip,stop,parent){if(!stop)return;const dialog=openDialog({title:"Fahrt-Zustieg bearbeiten",body:`<form class="form-grid v4-smart-form" data-m325-edit-trip-stop><label class="v4-field-full">Abfahrtszeit<input name="departureTime" type="time" value="${escapeAttr(toBerlinTimeInputValue(stop.departureAt))}" required></label><label class="v4-field-full">Fahrthinweis<input name="tripNote" value="${escapeAttr(stop.tripNote||"")}"></label><label class="check-row v4-compact-check v4-field-full"><input name="isActive" type="checkbox"${stop.isActive?" checked":""}><span>Aktiv</span></label><div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary">Speichern</button></div></form>`});dialog.querySelector("form").addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));await runWrite(()=>call("fanbus_trip_boarding_stop_upsert",{id:stop.id,tripId:trip.id,boardingStopId:stop.boardingStopId,expectedRevision:stop.revision,departureAt:tripTimeToBerlinIso(trip,values.departureTime,"Abfahrtszeit"),position:stop.position,tripNote:values.tripNote||null,isActive:values.isActive==="on"}),"Fahrt-Zustieg aktualisiert.");dialog.close();parent.close();void openBoardingStops(trip);});}

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
    <label class="v4-field-full">Abfahrt
      <input name="departureAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.departureAt))}" ${required}>
    </label>
    <label class="v4-field-seven">Anmeldung beginnt
      <input name="registrationOpensAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.registrationOpensAt))}" ${required}${trip.status === "PUBLISHED" ? " readonly" : ""}>
      ${trip.status === "PUBLISHED" ? "<small>Bei veröffentlichten Fahrten serverseitig festgelegt.</small>" : ""}
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
    departureInfo: trip.departureInfo || null,
    registrationOpensAt: berlinLocalToIso(values.registrationOpensAt, "Der Anmeldestart"),
    registrationClosesAt: berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende"),
    priceCents: euroInputToCents(values.price),
    capacity: trip.capacity,
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

  bindTripEditorDateDefaults(dialog.querySelector("#m310TripEditorForm"), trip);
}

function bindTripEditorDateDefaults(form, trip) {
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

function openTripCancellation(trip) {
  const activeCount = Number(trip.activeRegistrationCount || 0);
  const waitlistedCount = Number(trip.waitlistedRegistrationCount || 0);
  const bookingCount = Number(trip.affectedBookingCount || 0);

  openDialog({
    title: "Fanbusfahrt absagen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    danger: true,
    submitLabel: "Fahrt absagen",
    body: `<div class="notice error v4-m330-cancellation-warning">
        <strong>Die Absage ist endgültig</strong>
        <p>Die Fahrt bleibt historisch sichtbar, kann aber nicht reaktiviert werden.</p>
      </div>
      <div class="v4-m325-counters v4-m330-impact-preview" aria-label="Auswirkungen der Fahrtabsage">
        <span><strong>${escapeHtml(String(bookingCount))}</strong>Buchungen</span>
        <span><strong>${escapeHtml(String(activeCount))}</strong>Bestätigt</span>
        <span><strong>${escapeHtml(String(waitlistedCount))}</strong>Warteliste</span>
      </div>
      <p class="notice">${escapeHtml(trip.cancellationNotificationNotice || "Buchungskontakte erhalten eine Pflicht-E-Mail; Portalnutzer optional Push.")}</p>
      <form class="form-grid v4-smart-form" data-m330-cancellation-form>
        <label class="v4-field-full">Öffentlicher Stornierungsgrund
          <textarea name="cancellationReason" maxlength="240" required rows="4"></textarea>
          <small>Dieser Text wird öffentlich bei der abgesagten Fahrt angezeigt.</small>
        </label>
      </form>`,
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("fanbus_trip_cancel", {
          id: trip.id,
          expectedRevision: Number(trip.revision),
          cancellationReason: String(values.cancellationReason || "").trim()
        }),
        "Fanbusfahrt wurde abgesagt."
      );
      render();
    }
  });
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
    const dialog = document.getElementById("v4Dialog");
    const updated = trips().find(item => item.id === trip.id);
    if (dialog?.open && updated) restoreTripOverview(dialog, updated);
    if (dialog?.open && !updated) closeAllDialogs();
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

function registrationIdentityBadges(registration) {
  return `${registration?.portalUserId ? '<span class="v4-person-badge">Portaluser</span>' : ""}${registration?.memberId ? '<span class="v4-person-badge">Mitglied</span>' : ""}`;
}

function registrationCard(registration, buses = [], readOnly = false) {
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

  return `<article class="v4-m310-registration-record v4-interactive-card" tabindex="0" role="button"
    aria-label="Aktionen für ${escapeAttr(`${registration.firstName} ${registration.lastName}`)}"
    data-m320-registration-record="${escapeAttr(registration.id)}"
    data-m320-open-registration="${escapeAttr(registration.id)}">
    <div class="v4-m310-registration-person">
      <span class="v4-m325-person-title"><strong>${escapeHtml(`${registration.firstName} ${registration.lastName}`)}</strong>${registrationIdentityBadges(registration)}</span>
      <span class="badge ${registration.status === "ACTIVE" ? "success" : "neutral"}">${escapeHtml(registrationStatusText(registration.status))}</span>
    </div>
    <span class="v4-m310-registration-summary">${escapeHtml(bookingRole)} · ${escapeHtml(sourceText(registration.source))} · Buspräferenz: ${escapeHtml(busPreferenceText(registration.busPreference))}${registration.bookingParticipantCount > 1 ? ` · Gemeinsam angemeldet (${registration.bookingParticipantCount} Personen)` : ""}</span>
    ${preferenceMismatch ? `<small class="notice warning">Buswunsch weicht von der Buskategorie ${escapeHtml(assignedBus.category)} ab.</small>` : ""}
    ${email}
    <div class="v4-m310-registration-footer">
      <small>Angemeldet ${escapeHtml(formatBerlinDateTime(registration.registeredAt))}</small>
      ${isActive ? readOnly ? `<small>Bus: ${escapeHtml(assignedBus?.label || "Nicht zugeordnet")}</small>` : `<select aria-label="Buszuordnung" data-m320-assignment="${escapeAttr(registration.id)}"><option value="">Nicht zugeordnet</option>${buses.filter(bus => bus.isActive).map(bus => `<option value="${escapeAttr(bus.id)}"${bus.id === registration.busId ? " selected" : ""}>${escapeHtml(`${bus.label} · ${occupancy(bus)}/${bus.capacity}`)}</option>`).join("")}</select>` : ""}
      ${registration.status === "WAITLISTED" ? `<small>Wartelistenposition ${escapeHtml(registration.waitlistPosition || "–")}</small>${!readOnly && Number(registration.waitlistPosition) === 1 ? `<button class="button small primary" type="button" data-m320-promote="${escapeAttr(registration.id)}" data-revision="${escapeAttr(registration.revision)}">Promotion bestätigen</button>` : ""}` : ""}
      ${cancelledAt}
      <span class="v4-row-chevron" aria-hidden="true">›</span>
    </div>
  </article>`;
}

async function cancelRegistrationFromActions(trip, registration, registrationsDialog, actionsDialog) {
  const confirmed = await confirmAction(
    "Diesen bestätigten oder wartenden Teilnehmer wirklich stornieren?",
    { danger: true, title: "Anmeldung stornieren", submitLabel: "Stornieren" }
  );
  if (!confirmed) return;

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
    actionsDialog?.close();
    if (registrationsDialog?.open) {
      renderRegistrationsDialog(registrationsDialog, trip, nextData);
    }
  } catch (error) {
    const message = error?.code === "40001"
      ? "Die Anmeldung wurde zwischenzeitlich geändert. Bitte Teilnehmerliste neu öffnen."
      : error?.message || "Die Anmeldung konnte nicht storniert werden.";
    showToast(message, "error", 5200);
  }
}

async function refreshRegistrationsAfterIdentity(trip, registrationsDialog) {
  const next = await call("fanbus_registrations_list", { tripId: trip.id });
  if (registrationsDialog?.open) {
    renderRegistrationsDialog(registrationsDialog, trip, next);
  }
}

async function applyRegistrationIdentity(
  trip,
  registration,
  registrationsDialog,
  portalUserId,
  mode = "LINK",
  childDialog = null
) {
  const action = mode === "RELINK"
    ? "fanbus_registration_identity_relink"
    : "fanbus_registration_identity_link";
  await runWrite(() => call(action, {
    registrationId: registration.id,
    expectedRevision: Number(registration.revision),
    portalUserId
  }), mode === "RELINK" ? "Portaluser-Zuordnung korrigiert." : "Portaluser verknüpft.");
  childDialog?.close();
  await refreshRegistrationsAfterIdentity(trip, registrationsDialog);
}

function openRegistrationIdentitySearch(
  trip,
  registration,
  registrationsDialog,
  mode = "LINK"
) {
  if (!hasCapability("fanbus.participant_identity.manage")) return;
  const dialog = openDialog({
    title: mode === "RELINK" ? "Portaluser-Zuordnung korrigieren" : "Mit Portaluser verknüpfen",
    kicker: `${registration.firstName} ${registration.lastName}`,
    body: `<form class="form-grid v4-smart-form" data-m325-registration-person-search>
      <label class="v4-field-full">Portaluser suchen
        <input name="query" type="search" minlength="3" autocomplete="off" placeholder="Mindestens 3 Zeichen">
      </label>
      <p class="subtle v4-field-full" data-m325-registration-person-status>Gib mindestens 3 Zeichen des Namens ein.</p>
      <div class="v4-field-full v4-m325-person-search-results" data-m325-registration-person-results></div>
    </form>`,
    preserveParentOnSubmit: true
  });
  const form = dialog.querySelector("[data-m325-registration-person-search]");
  const input = form?.elements.namedItem("query");
  const status = dialog.querySelector("[data-m325-registration-person-status]");
  const results = dialog.querySelector("[data-m325-registration-person-results]");
  let timer = 0;
  let requestSequence = 0;

  input?.addEventListener("input", () => {
    window.clearTimeout(timer);
    const query = String(input.value || "").trim();
    requestSequence += 1;
    const sequence = requestSequence;
    results.replaceChildren();
    if (query.length < 3) {
      status.textContent = "Gib mindestens 3 Zeichen des Namens ein.";
      return;
    }
    status.textContent = "Suche läuft …";
    timer = window.setTimeout(async () => {
      try {
        const data = await call("fanbus_registration_identity_search", { query });
        if (sequence !== requestSequence) return;
        const people = Array.isArray(data?.people) ? data.people.slice(0, 8) : [];
        status.textContent = people.length ? `${people.length} Treffer` : "Keine aktiven Portaluser gefunden.";
        results.innerHTML = people.map(person => `<button class="button secondary v4-m325-person-search-result" type="button" data-portal-user-id="${escapeAttr(person.portalUserId)}"><span><strong>${escapeHtml(person.displayName)}</strong></span><span class="v4-person-badges"><span class="v4-person-badge">Portaluser</span>${person.isMember ? '<span class="v4-person-badge">Mitglied</span>' : ""}</span></button>`).join("");
        results.querySelectorAll("[data-portal-user-id]").forEach(button => {
          button.addEventListener("click", () => {
            void applyRegistrationIdentity(
              trip,
              registration,
              registrationsDialog,
              button.dataset.portalUserId,
              mode,
              dialog
            );
          });
        });
      } catch (error) {
        if (sequence !== requestSequence) return;
        status.textContent = error?.message || "Portalusersuche fehlgeschlagen.";
      }
    }, 300);
  });
  input?.focus();
}

async function loadRegistrationIdentitySuggestion(
  trip,
  registration,
  registrationsDialog,
  actionsDialog
) {
  const target = actionsDialog.querySelector("[data-m325-identity-suggestion]");
  if (!target) return;
  try {
    const data = await call("fanbus_registration_identity_suggestion", {
      registrationId: registration.id
    });
    if (!actionsDialog.open) return;
    if (data?.status === "SINGLE" && data.suggestion) {
      const person = data.suggestion;
      target.innerHTML = `<p class="subtle">Möglicher Portaluser</p><button class="button secondary v4-m325-person-search-result" type="button" data-m325-apply-identity-suggestion><span><strong>${escapeHtml(person.displayName)}</strong></span><span class="v4-person-badges"><span class="v4-person-badge">Portaluser</span>${person.isMember ? '<span class="v4-person-badge">Mitglied</span>' : ""}</span></button><p class="subtle">Der Vorschlag wird erst durch deine Auswahl verknüpft.</p>`;
      target.querySelector("[data-m325-apply-identity-suggestion]")
        ?.addEventListener("click", () => {
          void applyRegistrationIdentity(
            trip,
            registration,
            registrationsDialog,
            person.portalUserId,
            "LINK",
            actionsDialog
          );
        });
    } else if (data?.status === "MULTIPLE") {
      target.innerHTML = '<p class="notice warning">Mehrere mögliche Portaluser. Keine Person wurde vorausgewählt.</p>';
    } else {
      target.innerHTML = '<p class="subtle">Kein eindeutiger Portaluser-Vorschlag.</p>';
    }
  } catch (error) {
    if (actionsDialog.open) {
      target.innerHTML = `<p class="subtle">${escapeHtml(error?.message || "Vorschlag nicht verfügbar.")}</p>`;
    }
  }
}

function openRegistrationActions(trip, registration, registrationsDialog) {
  const cancelled = registration.status === "CANCELLED";
  const tripCancelled = trip.status === "CANCELLED";
  const portalPrimaryIdentity = registration.source === "PORTAL"
    && registration.bookingRole === "PRIMARY";
  const canManageIdentity = hasCapability("fanbus.participant_identity.manage")
    && ["PUBLISHED", "CLOSED"].includes(trip.status)
    && !cancelled
    && !portalPrimaryIdentity;
  const hasPortalIdentity = Boolean(registration.portalUserId);
  const identityActions = !canManageIdentity ? "" : hasPortalIdentity
    ? `<section class="v4-m325-registration-identity"><div class="v4-m325-person-title"><strong>Identität</strong>${registrationIdentityBadges(registration)}</div><div class="v4-card-action-menu"><button class="button secondary" type="button" data-m325-registration-identity-relink>Portaluser-Zuordnung ändern</button><button class="button secondary" type="button" data-m325-registration-identity-unlink>Verknüpfung lösen</button></div></section>`
    : `<section class="v4-m325-registration-identity"><strong>Portalidentität</strong><div data-m325-identity-suggestion><p class="subtle">Vorschlag wird ermittelt …</p></div><button class="button secondary" type="button" data-m325-registration-identity-search>Portaluser manuell suchen</button></section>`;
  const dialog = openDialog({
    title: `${registration.firstName} ${registration.lastName}`,
    kicker: "Teilnehmerverwaltung",
    body: tripCancelled
      ? `<p class="notice error">Die Fahrt ist abgesagt. Teilnehmerdaten bleiben historisch lesbar und können nicht mehr geändert werden.</p>`
      : cancelled
      ? `<p class="subtle">Diese Anmeldung ist bereits storniert.</p>`
      : `<div class="v4-card-action-menu">
          <button class="button secondary" type="button" data-m320-action-edit>Bearbeiten</button>
          <button class="button danger" type="button" data-m320-action-cancel>Stornieren</button>
        </div>${identityActions}`
  });

  dialog.querySelector("[data-m320-action-edit]")?.addEventListener("click", () => {
    dialog.close();
    void openRegistrationEdit(trip, registration, registrationsDialog);
  });

  dialog.querySelector("[data-m320-action-cancel]")?.addEventListener("click", () => {
    void cancelRegistrationFromActions(trip, registration, registrationsDialog, dialog);
  });

  dialog.querySelector("[data-m325-registration-identity-search]")
    ?.addEventListener("click", () => {
      openRegistrationIdentitySearch(trip, registration, registrationsDialog, "LINK");
    });

  dialog.querySelector("[data-m325-registration-identity-relink]")
    ?.addEventListener("click", () => {
      openRegistrationIdentitySearch(trip, registration, registrationsDialog, "RELINK");
    });

  dialog.querySelector("[data-m325-registration-identity-unlink]")
    ?.addEventListener("click", async () => {
      if (!await confirmAction(
        "Portaluser-Verknüpfung dieser aktuellen Teilnahme lösen?",
        "Der zuletzt gespeicherte Name bleibt als Snapshot erhalten."
      )) return;
      await runWrite(() => call("fanbus_registration_identity_unlink", {
        registrationId: registration.id,
        expectedRevision: Number(registration.revision)
      }), "Portaluser-Verknüpfung gelöst.");
      dialog.close();
      await refreshRegistrationsAfterIdentity(trip, registrationsDialog);
    });

  if (canManageIdentity && !hasPortalIdentity) {
    void loadRegistrationIdentitySuggestion(
      trip,
      registration,
      registrationsDialog,
      dialog
    );
  }
}

function busCategoryLabel(value) {
  return { NORMAL: "Standard", RUHIG: "Ruhig", PARTY: "Partybus" }[value] || value || "Bus";
}

function occupancyAccess(trip) {
  return {
    readOnly: trip.status === "CANCELLED",
    canManageBuses: hasCapability("fanbus.manage") && trip.canManage !== false,
    canManageRegistrations: hasCapability("fanbus.registrations.manage")
      && trip.canManageRegistrations !== false
  };
}

function occupancyMarkup(data, busMappings, tripStops, access) {
  const canManageBuses = Boolean(access?.canManageBuses);
  const canManageRegistrations = Boolean(access?.canManageRegistrations);
  const readOnly = Boolean(access?.readOnly);
  const registrations = canManageRegistrations && Array.isArray(data?.registrations)
    ? data.registrations
    : [];
  const buses = Array.isArray(data?.buses) ? data.buses : [];
  const mappings = new Map((busMappings?.buses || []).map(bus => [bus.busId, bus]));
  const stopLabels = new Map((tripStops?.stops || []).map(stop => [stop.id, stop.label]));
  const active = registrations.filter(item => item.status === "ACTIVE");
  const waitlist = registrations.filter(item => item.status === "WAITLISTED");
  const unassigned = active.filter(item => !item.busId);
  const participantRow = person => `<div class="v4-m310-occupancy-participant"><span>${escapeHtml(`${person.firstName} ${person.lastName}`)}</span>${readOnly ? `<small>${person.status === "ACTIVE" ? escapeHtml(buses.find(bus => bus.id === person.busId)?.label || "Ohne Bus") : `Position ${escapeHtml(person.waitlistPosition || "–")}`}</small>` : person.status === "ACTIVE" ? `<select aria-label="Buszuordnung für ${escapeAttr(`${person.firstName} ${person.lastName}`)}" data-m310-occupancy-assignment="${escapeAttr(person.id)}"><option value="">Ohne Bus</option>${buses.filter(bus => bus.isActive).map(bus => `<option value="${escapeAttr(bus.id)}"${person.busId === bus.id ? " selected" : ""}>${escapeHtml(bus.label)}</option>`).join("")}</select>` : Number(person.waitlistPosition) === 1 ? `<button class="button small primary" type="button" data-m310-occupancy-promote="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.revision)}">Promotion bestätigen</button>` : `<small>Position ${escapeHtml(person.waitlistPosition || "–")}</small>`}</div>`;

  const busCards = buses.map(bus => {
    const participants = active.filter(item => item.busId === bus.id);
    const mapping = mappings.get(bus.id);
    const stops = (mapping?.tripBoardingStopIds || []).map(id => stopLabels.get(id)).filter(Boolean);
    const stopSummary = canManageBuses
      ? stops.length ? stops.join(" · ") : "Keine zugeordnet"
      : "Mit Verwaltungsberechtigung sichtbar";

    return `<article class="v4-m310-occupancy-bus-card v4-interactive-card"
      ${canManageBuses && !readOnly ? `tabindex="0" role="button" data-m310-open-bus-actions="${escapeAttr(bus.id)}" aria-label="Aktionen für ${escapeAttr(bus.label)}"` : ""}>
      <div class="v4-m310-occupancy-bus-heading">
        <div><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(busCategoryLabel(bus.category))}${bus.isActive ? "" : " · inaktiv"}</small></div>
        <span class="v4-m310-bus-card-meta">
          <span>${canManageRegistrations ? `${escapeHtml(participants.length)} / ` : ""}${escapeHtml(bus.capacity)} Plätze</span>
          ${canManageBuses && !readOnly ? `<span class="v4-row-chevron" aria-hidden="true">›</span>` : ""}
        </span>
      </div>
      <p><span>Zustiege</span><strong>${escapeHtml(stopSummary)}</strong></p>
      ${canManageRegistrations ? `<details><summary>Teilnehmer (${participants.length})</summary>${participants.length ? `<div class="v4-m310-occupancy-participants">${participants.map(participantRow).join("")}</div>` : `<p class="subtle">Noch keine Teilnehmer zugeordnet.</p>`}</details>` : ""}
    </article>`;
  }).join("");

  const group = (title, people, note) => `<details class="v4-m310-occupancy-group"${people.length ? " open" : ""}><summary>${escapeHtml(title)} (${people.length})</summary>${people.length ? `<div class="v4-m310-occupancy-participants">${people.map(participantRow).join("")}</div>` : `<p class="subtle">${escapeHtml(note)}</p>`}</details>`;

  return `<div class="v4-m310-occupancy">
    ${readOnly ? '<p class="notice error">Die Fahrt ist abgesagt. Belegung und Busdaten bleiben historisch lesbar.</p>' : ""}
    ${canManageRegistrations ? `<div class="v4-m325-counters v4-m310-occupancy-counters"><span><strong>${Number(data?.summary?.activeCount || 0)}</strong>Teilnehmer</span><span><strong>${Number(data?.summary?.activeBusCapacity || 0)}</strong>Gesamtplätze</span><span><strong>${Number(data?.summary?.waitlistedCount || 0)}</strong>Warteliste</span><span><strong>${Number(data?.summary?.unassignedActiveCount || 0)}</strong>Ohne Bus</span></div>` : ""}
    <div class="v4-m310-occupancy-actions">${canManageRegistrations ? '<button class="button small secondary" type="button" data-m310-manage-participants>Teilnehmer anzeigen</button>' : ""}${canManageBuses && !readOnly ? `<button class="button small primary" type="button" data-m310-create-bus>Bus anlegen</button>` : ""}</div>
    <section class="v4-m310-occupancy-buses" aria-label="Busse">${busCards || empty("Für diese Fahrt sind noch keine Busse angelegt.")}</section>
    ${canManageRegistrations ? `<section class="v4-m310-occupancy-groups">${group("Ohne Bus", unassigned, "Alle bestätigten Teilnehmer sind einem Bus zugeordnet.")}${group("Warteliste", waitlist, "Die Warteliste ist leer.")}</section>` : ""}
  </div>`;
}

function openBusActions(trip, data, bus, busMappings, tripStops, parentDialog) {
  const mapping = (busMappings?.buses || []).find(item => item.busId === bus.id);
  const dialog = openDialog({
    title: bus.label,
    kicker: "Busverwaltung",
    body: `<div class="v4-card-action-menu">
      <button class="button secondary" type="button" data-m310-bus-action-edit>Bus bearbeiten</button>
      <button class="button secondary" type="button" data-m310-bus-action-stops${mapping ? "" : " disabled"}>Zustiege verwalten</button>
    </div>`
  });

  dialog.querySelector("[data-m310-bus-action-edit]")?.addEventListener("click", () => {
    dialog.close();
    openBusEditor(trip, data, bus, parentDialog);
  });

  dialog.querySelector("[data-m310-bus-action-stops]")?.addEventListener("click", () => {
    if (!mapping) return;
    dialog.close();
    openBusStops(trip, bus, mapping, tripStops?.stops || [], parentDialog);
  });
}

async function occupancyData(trip) {
  const access = occupancyAccess(trip);
  const [data, busMappings, tripStops] = await Promise.all([
    access.canManageRegistrations
      ? call("fanbus_registrations_list", { tripId: trip.id })
      : access.canManageBuses
        ? call("fanbus_buses_list", { tripId: trip.id })
        : Promise.resolve({ buses: [] }),
    access.canManageBuses
      ? call("fanbus_bus_boarding_stops_list", { tripId: trip.id })
      : Promise.resolve({ buses: [] }),
    access.canManageBuses
      ? call("fanbus_trip_boarding_stops_list", { tripId: trip.id })
      : Promise.resolve({ stops: [] })
  ]);
  return { data, busMappings, tripStops, access };
}

async function loadOccupancyInto(dialog, trip) {
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  const contextId = dialog.dataset.v4DialogContext;
  body.innerHTML = loading("Belegung wird geladen …");
  try {
    const { data, busMappings, tripStops, access } = await occupancyData(trip);
    if (!dialog.open || dialog.dataset.v4DialogContext !== contextId) return;
    body.innerHTML = occupancyMarkup(data, busMappings, tripStops, access);
    bindOccupancyActions(dialog, trip, data, busMappings, tripStops, access);
  } catch (error) {
    if (!dialog.open || dialog.dataset.v4DialogContext !== contextId) return;
    body.innerHTML = errorPanel(error, "Belegung konnte nicht geladen werden");
  }
}

async function openOccupancy(trip) {
  const access = occupancyAccess(trip);
  if (!access.canManageBuses && !access.canManageRegistrations) return;
  const dialog = openDialog({
    title: "Belegung",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: loading("Belegung wird geladen …")
  });
  afterDialogContextClose(dialog, () => refreshTripParent(dialog, trip.id));
  await loadOccupancyInto(dialog, trip);
}

async function refreshTripParent(dialog, tripId) {
  if (!dialog?.open) return;
  const contextId = dialog.dataset.v4DialogContext;
  try {
    const nextSnapshot = await call("fanbus_trips_list");
    if (!dialog.open || dialog.dataset.v4DialogContext !== contextId) return;
    snapshot = nextSnapshot || { trips: [] };
    render();
    const updated = trips().find(item => item.id === tripId);
    if (updated) restoreTripOverview(dialog, updated);
    else dialog.close();
  } catch (error) {
    showToast(error?.message || "Fanbusfahrt konnte nicht aktualisiert werden.", "error", 5200);
  }
}

function bindOccupancyActions(dialog, trip, data, busMappings, tripStops, access) {
  const buses = Array.isArray(data?.buses) ? data.buses : [];

  if (access?.canManageRegistrations) {
    dialog.querySelector("[data-m310-manage-participants]")
      ?.addEventListener("click", () => showRegistrationsDialog(trip, data, dialog));

    if (access?.readOnly) return;

    dialog.querySelectorAll("[data-m310-occupancy-assignment]").forEach(select => {
      select.addEventListener("change", async () => {
        select.disabled = true;
        try {
          await runWrite(() => call("fanbus_bus_assignment_set", {
            participantId: select.dataset.m310OccupancyAssignment,
            busId: select.value || null
          }), "Buszuordnung gespeichert.");
          await loadOccupancyInto(dialog, trip);
        } catch (error) {
          showToast(error?.message || "Buszuordnung konnte nicht gespeichert werden.", "error", 5200);
          if (select.isConnected) select.disabled = false;
        }
      });
    });

    dialog.querySelectorAll("[data-m310-occupancy-promote]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await runWrite(() => call("fanbus_waitlist_promote", {
            id: button.dataset.m310OccupancyPromote,
            expectedRevision: Number(button.dataset.revision)
          }), "Teilnehmer wurde von der Warteliste übernommen.");
          snapshot = await call("fanbus_trips_list");
          render();
          await loadOccupancyInto(dialog, trip);
        } catch (error) {
          showToast(error?.message || "Promotion ist derzeit nicht möglich.", "error", 5200);
          if (button.isConnected) button.disabled = false;
        }
      });
    });
  }

  if (access?.canManageBuses) {
    dialog.querySelector("[data-m310-create-bus]")
      ?.addEventListener("click", () => openBusCreator(trip, dialog));

    dialog.querySelectorAll("[data-m310-open-bus-actions]").forEach(card => {
      const open = event => {
        if (event?.target?.closest?.("button, a, input, select, textarea, label, summary, details")) {
          return;
        }
        const bus = buses.find(item => item.id === card.dataset.m310OpenBusActions);
        if (bus) openBusActions(trip, data, bus, busMappings, tripStops, dialog);
      };

      card.addEventListener("click", open);
      card.addEventListener("keydown", event => {
        if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        open(event);
      });
    });
  }
}

function reloadOccupancyAfterChild(parentDialog, trip, parentContextId) {
  setTimeout(() => {
    if (parentDialog?.open
        && parentDialog.dataset.v4DialogContext === parentContextId) {
      void loadOccupancyInto(parentDialog, trip);
    }
  }, 0);
}

function openBusCreator(trip, parentDialog) {
  const parentContextId = parentDialog?.dataset.v4DialogContext || "";
  openDialog({
    title: "Bus anlegen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: busForm(),
    submitLabel: "Bus anlegen",
    preserveParentOnSubmit: true,
    onSubmit: async values => {
      await runWrite(() => call("fanbus_bus_upsert", {
        tripId: trip.id,
        label: values.label,
        category: values.category,
        capacity: Number(values.capacity),
        isActive: values.isActive === "on"
      }), "Bus wurde angelegt.");
      snapshot = await call("fanbus_trips_list");
      render();
      reloadOccupancyAfterChild(parentDialog, trip, parentContextId);
    }
  });
}

function openBusStops(trip, bus, mapping, tripStops, parentDialog) {
  const activeStops = tripStops.filter(stop => stop.isActive);
  const parentContextId = parentDialog?.dataset.v4DialogContext || "";
  openDialog({
    title: `${bus.label} · Zustiege`,
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: `<form class="form-grid v4-smart-form" data-m310-bus-stops>
      <p class="subtle v4-field-full">Die Auswahl gilt ausschließlich für diesen Bus.</p>
      <div class="v4-field-full">${activeStops.map(stop => `<label class="check-row"><input type="checkbox" name="stopId" value="${escapeAttr(stop.id)}"${mapping.tripBoardingStopIds.includes(stop.id) ? " checked" : ""}><span>${escapeHtml(stop.label)} · ${escapeHtml(formatBerlinTime(stop.departureAt))}</span></label>`).join("") || empty("Für diese Fahrt sind noch keine Zustiege hinterlegt.")}</div>
    </form>`,
    submitLabel: "Bus-Zustiege speichern",
    preserveParentOnSubmit: true,
    onSubmit: async values => {
      const form = document.querySelector("[data-m310-bus-stops]");
      const ids = form ? new FormData(form).getAll("stopId") : [];
      await runWrite(() => call("fanbus_bus_boarding_stops_set", {
        tripId: trip.id,
        busId: bus.id,
        expectedRevision: Number(mapping.revision),
        tripBoardingStopIds: ids
      }), "Bus-Zustiege gespeichert.");
      reloadOccupancyAfterChild(parentDialog, trip, parentContextId);
    }
  });
}

function registrationsMarkup(data, trip) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  const buses = Array.isArray(data?.buses) ? data.buses : [];
  const readOnly = trip?.status === "CANCELLED";
  const addAction = hasCapability("fanbus.registrations.manage")
    ? `<div class="v4-heading-row v4-subheading-row v4-m310-registration-toolbar">
      <p class="subtle">Mitfahrer verwalten</p>
      <div class="v4-m310-registration-toolbar-actions">
        <button class="button small primary" type="button" data-m310-export-registrations>Excel exportieren</button>
        ${readOnly ? "" : '<button class="button small secondary" type="button" data-m310-add-registration>Mitfahrer hinzufügen</button>'}
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
    <label class="v4-m320-filter-half">Status<select name="status"><option value="ALL">Alle</option><option value="ACTIVE">Bestätigt</option><option value="WAITLISTED">Warteliste</option><option value="CANCELLED">Storniert</option></select></label>
    <label class="v4-m320-filter-half">Buspräferenz<select name="preference"><option value="ALL">Alle</option><option value="RUHIG">Ruhig</option><option value="PARTY">Party</option><option value="EGAL">Egal</option></select></label>
    <label class="v4-m320-filter-half">Bus<select name="bus"><option value="ALL">Alle</option><option value="UNASSIGNED">Nicht zugeordnet</option>${busOptions}</select></label>
    <label class="v4-m320-filter-half">Zuordnung<select name="assignment"><option value="ALL">Alle</option><option value="ASSIGNED">Zugeordnet</option><option value="UNASSIGNED">Nicht zugeordnet</option></select></label>
  </form>`;
  const activeBusCapacity = Number(data?.summary?.activeBusCapacity || 0);
  const activeCount = Number(data?.summary?.activeCount || 0);
  const warning = activeBusCapacity < activeCount
    ? `<div class="notice warning" role="status">Warnung: Die Kapazität der aktiven Busse (${escapeHtml(activeBusCapacity)}) liegt unter der Zahl bestätigter Teilnehmer (${escapeHtml(activeCount)}).</div>`
    : "";
  const list = registrations.length
    ? `<div class="v4-m310-registration-list" data-m320-registration-list>${registrations.map(registration => registrationCard(registration, buses, readOnly)).join("")}<p class="subtle" data-m320-filter-empty hidden>Keine Teilnehmer entsprechen den Filtern.</p></div>`
    : `<div data-m320-registration-list>${empty("Für diese Fanbusfahrt liegen noch keine Anmeldungen vor.")}</div>`;

  return `${readOnly ? '<p class="notice error">Die Fahrt ist abgesagt. Teilnehmer bleiben sichtbar und können nicht mehr geändert werden.</p>' : ""}${addAction}${warning}${filters}${list}`;
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

async function openRegistrationEdit(trip, registration, registrationsDialog) {
  const parentContextId = registrationsDialog?.dataset.v4DialogContext;
  const linkedIdentity = Boolean(registration.memberId || registration.portalUserId);
  const readonly = linkedIdentity ? " disabled" : "";
  let operational;
  let stopData;
  try {
    [operational, stopData] = await Promise.all([
      call("fanbus_registration_operational_detail", { participantId: registration.id }),
      call("fanbus_trip_boarding_stops_list", { tripId: trip.id })
    ]);
  } catch (error) {
    showToast(error?.message || "Betriebsdaten konnten nicht geladen werden.", "error", 5200);
    return;
  }
  if (!registrationsDialog?.open
      || registrationsDialog.dataset.v4DialogContext !== parentContextId) return;
  const tripStops = Array.isArray(stopData?.stops) ? stopData.stops : [];
  openDialog({
    title: "Teilnehmer bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: `<form class="form-grid v4-smart-form" data-m320-registration-edit>
      <label class="v4-field-half">Vorname<input name="firstName" maxlength="120" value="${escapeAttr(registration.firstName)}" required${readonly}></label>
      <label class="v4-field-half">Nachname<input name="lastName" maxlength="120" value="${escapeAttr(registration.lastName)}" required${readonly}></label>
      <label class="v4-field-full">E-Mail<input name="email" type="email" maxlength="320" value="${escapeAttr(registration.email || "")}"${readonly}></label>
      <label class="v4-field-full">Buspräferenz<select name="busPreference" required>${optionList(BUS_PREFERENCES, registration.busPreference)}</select></label>
      <label class="v4-field-full">Zustiegsort<select name="tripBoardingStopId"${tripStops.some(stop => stop.isActive) ? " required" : ""}><option value="">Kein strukturierter Zustieg</option>${tripStops.filter(stop => stop.isActive).map(stop => `<option value="${escapeAttr(stop.tripBoardingStopId || stop.id)}"${(stop.tripBoardingStopId || stop.id) === operational.tripBoardingStopId ? " selected" : ""}>${escapeHtml(`${stop.label} · ${formatBerlinDateTime(stop.departureAt)}`)}</option>`).join("")}</select></label>
      <label class="v4-field-full">Operativer Hinweis<textarea name="operationalNote" maxlength="240">${escapeHtml(operational.operationalNote || "")}</textarea></label>
      ${linkedIdentity ? `<p class="subtle v4-field-full">Identitätsdaten verknüpfter Portalnutzer oder Mitglieder bleiben unverändert.</p>` : ""}
    </form>`,
    submitLabel: "Änderungen speichern",
    preserveParentOnSubmit: true,
    onSubmit: async values => {
      const next = await call("fanbus_registration_update_m325", {
        id: registration.id,
        expectedRevision: Number(registration.revision),
        firstName: linkedIdentity ? registration.firstName : values.firstName,
        lastName: linkedIdentity ? registration.lastName : values.lastName,
        email: linkedIdentity ? registration.email : values.email,
        busPreference: values.busPreference,
        tripBoardingStopId: values.tripBoardingStopId || null,
        operationalNote: values.operationalNote || null
      });
      snapshot = await call("fanbus_trips_list");
      render();
      showToast("Teilnehmer wurde aktualisiert.", "success", 3800);
      setTimeout(() => {
        if (registrationsDialog?.open
            && registrationsDialog.dataset.v4DialogContext === parentContextId) {
          renderRegistrationsDialog(registrationsDialog, trip, next);
        }
      }, 0);
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

  body.querySelectorAll("[data-m320-open-registration]").forEach(card => {
    const open = event => {
      if (event?.target?.closest?.("button, a, input, select, textarea, label, summary, details")) {
        return;
      }
      const registration = registrations.find(
        item => item.id === card.dataset.m320OpenRegistration
      );
      if (registration) openRegistrationActions(trip, registration, dialog);
    };

    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      open(event);
    });
  });
}

function renderRegistrationsDialog(dialog, trip, data) {
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  body.innerHTML = registrationsMarkup(data, trip);

  body.querySelector("[data-m310-add-registration]")
    ?.addEventListener("click", () => openManualRegistration(trip, dialog));

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
}

function busForm(bus = null) {
  return `<form class="form-grid v4-smart-form v4-m325-bus-form" data-m325-bus-form>
    <label class="v4-field-full">Busname
      <input name="label" maxlength="160" value="${escapeAttr(bus?.label || "")}" required>
    </label>
    <label class="v4-field-half">Kategorie
      <select name="category" required>
        <option value="NORMAL"${bus?.category === "NORMAL" || !bus ? " selected" : ""}>Normal</option>
        <option value="RUHIG"${bus?.category === "RUHIG" ? " selected" : ""}>Ruhig</option>
        <option value="PARTY"${bus?.category === "PARTY" ? " selected" : ""}>Party</option>
      </select>
    </label>
    <label class="v4-field-half">Kapazität
      <input name="capacity" type="number" min="1" step="1" value="${escapeAttr(bus?.capacity || "")}" required>
    </label>
    <label class="check-row v4-field-full v4-compact-check">
      <input name="isActive" type="checkbox"${bus?.isActive === false ? "" : " checked"}>
      <span>Bus ist aktiv</span>
    </label>
  </form>`;
}

function openBusEditor(trip, data, bus, occupancyParent = null) {
  const parentContextId = occupancyParent?.dataset.v4DialogContext || "";
  openDialog({
    title: "Bus bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: busForm(bus),
    submitLabel: "Bus speichern",
    preserveParentOnSubmit: Boolean(occupancyParent),
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
      const [next, nextSnapshot] = await Promise.all([
        call("fanbus_buses_list", { tripId: trip.id }),
        call("fanbus_trips_list")
      ]);
      snapshot = nextSnapshot || { trips: [] };
      render();
      showToast("Bus wurde aktualisiert.", "success", 3800);
      if (occupancyParent) {
        reloadOccupancyAfterChild(occupancyParent, trip, parentContextId);
      }
      else setTimeout(() => openBusManager(trip, next), 0);
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
      const [next, nextSnapshot] = await Promise.all([
        call("fanbus_buses_list", { tripId: trip.id }),
        call("fanbus_trips_list")
      ]);
      snapshot = nextSnapshot || { trips: [] };
      render();
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

function manualRegistrationForm(people, tripStops = []) {
  const activeTripStops = tripStops.filter(stop => stop.isActive);
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
    ${activeTripStops.length ? `<label class="v4-field-full">Zustiegsort
      <select name="boardingStopId" required><option value="">Bitte wählen</option>${activeTripStops.map(stop => `<option value="${escapeAttr(stop.tripBoardingStopId || stop.id)}">${escapeHtml(`${stop.label} · ${formatBerlinDateTime(stop.departureAt)}`)}</option>`).join("")}</select>
    </label>` : ""}
    <label class="v4-field-full">Operativer Hinweis (optional)
      <textarea name="operationalNote" maxlength="240"></textarea>
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

async function openManualRegistration(trip, registrationsDialog) {
  if (!hasCapability("fanbus.registrations.manage")) return;
  const parentContextId = registrationsDialog?.dataset.v4DialogContext;

  try {
    const [lookup, stopData] = await Promise.all([
      call("fanbus_registration_people_list"),
      call("fanbus_trip_boarding_stops_list", { tripId: trip.id })
    ]);
    const people = Array.isArray(lookup?.people) ? lookup.people : [];
    const tripStops = Array.isArray(stopData?.stops) ? stopData.stops : [];
    if (!registrationsDialog?.open
        || registrationsDialog.dataset.v4DialogContext !== parentContextId) return;
    let manualAttempt = null;
    const dialog = openDialog({
      title: "Mitfahrer hinzufügen",
      kicker: trip.displayTitle || "Fanbusfahrt",
      body: manualRegistrationForm(people, tripStops),
      submitLabel: "Mitfahrer anmelden",
      preserveParentOnSubmit: true,
      onSubmit: async values => {
        const payload = {
          tripId: trip.id,
          mode: values.mode,
          busPreference: values.busPreference,
          ...(values.boardingStopId ? { boardingStopId: values.boardingStopId } : {}),
          operationalNote: values.operationalNote || "",
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
        setTimeout(() => {
          if (registrationsDialog?.open
              && registrationsDialog.dataset.v4DialogContext === parentContextId) {
            renderRegistrationsDialog(registrationsDialog, trip, nextData);
          }
        }, 0);
      }
    });

    dialog.querySelector('[name="mode"]')
      ?.addEventListener("change", () => syncManualRegistrationMode(dialog));
    syncManualRegistrationMode(dialog);
  } catch (error) {
    showToast(error?.message || "Die Personenauswahl konnte nicht geladen werden.", "error", 5200);
  }
}

function showRegistrationsDialog(trip, data, occupancyParent = null) {
  const occupancyContextId = occupancyParent?.dataset.v4DialogContext || "";
  const dialog = openDialog({
    title: "Teilnehmer und Anmeldungen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: registrationsMarkup(data, trip)
  });
  if (occupancyParent) {
    afterDialogContextClose(dialog, () => {
      if (occupancyParent.open
          && occupancyParent.dataset.v4DialogContext === occupancyContextId) {
        void loadOccupancyInto(occupancyParent, trip);
      }
    });
  }
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

import {
  call,
  confirmAction,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  openDialog,
  runWrite,
  showToast
} from "./common.js";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin"
});

const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin"
});

const BUS_ORGA_CAPABILITIES = Object.freeze([
  "fanbus.manage",
  "fanbus.registrations.manage",
  "fanbus.operations.manage",
  "fanbus.payment_marker.manage"
]);

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function hasBusOrgaAccess() {
  return BUS_ORGA_CAPABILITIES.some(code => hasCapability(code));
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "Termin offen");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? String(value) : DATE_FORMAT.format(date);
}

function formatTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
}

function formatDateTime(value) {
  if (!value) return "Noch nicht festgelegt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Noch nicht festgelegt" : `${DATE_TIME_FORMAT.format(date)} Uhr`;
}

function formatBoardingTime(value) {
  if (!value) return "Zeit offen";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Zeit offen" : TIME_FORMAT.format(date);
}

function formatMoney(value) {
  const cents = Number(value);
  return Number.isInteger(cents)
    ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100)
    : "Noch nicht festgelegt";
}

function lifecycleLabel(value) {
  return {
    DRAFT: "Entwurf",
    PUBLISHED: "Veröffentlicht",
    CLOSED: "Geschlossen",
    CANCELLED: "Abgesagt"
  }[value] || value || "–";
}

function lifecycleBadge(value) {
  const type = value === "PUBLISHED"
    ? "success"
    : value === "DRAFT"
      ? "warning"
      : value === "CANCELLED"
        ? "danger"
        : "neutral";
  return `<span class="badge ${type}">${escapeHtml(lifecycleLabel(value))}</span>`;
}

function navigate(view, tripId) {
  const params = new URLSearchParams({ view, trip: String(tripId || "") });
  location.hash = `#/bus-orga?${params}`;
}

function bookingSummary(registrations) {
  const grouped = new Map();
  for (const registration of registrations) {
    const key = String(registration.bookingId || registration.id || "");
    if (!key) continue;
    const group = grouped.get(key) || [];
    group.push(registration);
    grouped.set(key, group);
  }
  let current = 0;
  let cancelled = 0;
  for (const group of grouped.values()) {
    if (group.some(item => item.status !== "CANCELLED")) current += 1;
    else cancelled += 1;
  }
  return { current, cancelled, total: grouped.size };
}

function participantSummary(registrations) {
  const active = registrations.filter(item => item.status === "ACTIVE").length;
  const waitlisted = registrations.filter(item => item.status === "WAITLISTED").length;
  const cancelled = registrations.filter(item => item.status === "CANCELLED").length;
  const unassigned = registrations.filter(item => item.status === "ACTIVE" && !item.busId).length;
  return { active, waitlisted, cancelled, unassigned };
}

function activeBuses(buses) {
  return buses.filter(bus => bus.isActive !== false);
}

function busSummary(buses) {
  const active = activeBuses(buses);
  const capacity = active.reduce((sum, bus) => sum + Number(bus.capacity || 0), 0);
  const occupied = active.reduce((sum, bus) => sum + Number(bus.occupancy ?? bus.occupied ?? 0), 0);
  return { count: active.length, capacity, occupied, free: Math.max(capacity - occupied, 0) };
}

function stopNameMap(stops) {
  return new Map(stops.map(stop => [String(stop.id || stop.tripBoardingStopId || ""), stop]));
}

function busRows(state) {
  const stopsById = stopNameMap(state.stops);
  const rows = activeBuses(state.buses).map(bus => {
    const mapping = state.mappings.find(item => item.busId === bus.id);
    const stopLabels = (mapping?.tripBoardingStopIds || [])
      .map(id => stopsById.get(String(id)))
      .filter(Boolean)
      .map(stop => `${formatBoardingTime(stop.departureAt)} ${stop.label || "Zustieg"}`);
    const occupancy = Number(bus.occupancy ?? bus.occupied ?? 0);
    return `<div class="m328-trip-bus-row"><div><strong>${escapeHtml(bus.label || "Bus")}</strong><small>${escapeHtml(stopLabels.length ? stopLabels.join(" · ") : "Keine Zustiege zugeordnet")}</small></div><span>${escapeHtml(`${occupancy} / ${Number(bus.capacity || 0)}`)}</span></div>`;
  }).join("");
  return rows || '<p class="subtle m328-trip-no-buses">Für diese Fahrt sind noch keine aktiven Busse angelegt.</p>';
}

function overviewMarkup(state) {
  const bookings = bookingSummary(state.registrations);
  const participants = participantSummary(state.registrations);
  const buses = busSummary(state.buses);
  const trip = state.trip;
  const venue = String(trip.venue || "").trim() || "Fahrt";
  return `
    <section class="m328-trip-overview-group">
      <h4>Fahrt</h4>
      <dl class="m328-trip-detail-facts">
        <div><dt>Termin</dt><dd>${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(formatTime(trip.eventTime))}</dd></div>
        <div><dt>Abfahrt</dt><dd>${escapeHtml(formatDateTime(trip.departureAt))}</dd></div>
        <div><dt>Ziel / Ort</dt><dd>${escapeHtml(venue)}</dd></div>
        <div><dt>Fahrtpreis</dt><dd>${escapeHtml(formatMoney(trip.priceCents))}</dd></div>
        <div class="m328-trip-detail-fact-wide"><dt>Anmeldeschluss</dt><dd>${escapeHtml(formatDateTime(trip.registrationClosesAt))}</dd></div>
      </dl>
    </section>
    <section class="m328-trip-overview-group">
      <h4>Buchungen & Teilnehmer</h4>
      <div class="m328-trip-metrics">
        <span><strong>${bookings.current}</strong><small>Buchungen</small></span>
        <span><strong>${participants.active}</strong><small>Teilnehmer</small></span>
        <span><strong>${participants.waitlisted}</strong><small>Warteliste</small></span>
        <span><strong>${participants.unassigned}</strong><small>Nicht zugeordnet</small></span>
        <span><strong>${participants.cancelled}</strong><small>Storniert</small></span>
        <span><strong>${bookings.cancelled}</strong><small>Storn. Buchungen</small></span>
      </div>
    </section>
    <section class="m328-trip-overview-group">
      <div class="m328-trip-overview-subhead"><h4>Busse & Zustiege</h4><span>${buses.count} Busse · ${buses.occupied}/${buses.capacity} belegt · ${buses.free} frei</span></div>
      <div class="m328-trip-bus-list">${busRows(state)}</div>
    </section>`;
}

function workingMenuActions(state) {
  const { trip } = state;
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const canRegistrations = hasCapability("fanbus.registrations.manage") && trip.canManageRegistrations !== false;
  const canOperations = (
    hasCapability("fanbus.operations.manage") && trip.canManageOperations !== false
  ) || (
    hasCapability("fanbus.payment_marker.manage") && trip.canManagePaymentMarker !== false
  ) || canRegistrations;
  const actions = [];
  if (canRegistrations) {
    actions.push(["bookings", "Buchungen"]);
    actions.push(["participants", "Teilnehmer"]);
  }
  if (canManage) actions.push(["occupancy", "Busse"]);
  if (canManage && canRegistrations) actions.push(["assignment", "Buszuordnung"]);
  if (canOperations) actions.push(["operations", "Fahrtbetrieb"]);
  if (canManage && ["DRAFT", "PUBLISHED"].includes(trip.status)) actions.push(["edit", "Fahrtdaten bearbeiten"]);
  return actions;
}

function lifecycleMenuActions(trip) {
  if (!hasCapability("fanbus.manage") || trip.canManage === false || trip.status === "CANCELLED") return [];
  const actions = [];
  if (trip.status === "DRAFT") {
    actions.push(["publish", "Veröffentlichen", "primary"]);
    actions.push(["delete", "Entwurf löschen", "danger"]);
  }
  if (["DRAFT", "PUBLISHED"].includes(trip.status)) actions.push(["close", "Fahrt schließen", "ghost"]);
  if (trip.status === "CLOSED") actions.push(["reopen", "Wieder als Entwurf öffnen", "secondary"]);
  if (trip.canCancel === true) actions.push(["cancel", "Fahrt absagen", "danger"]);
  return actions;
}

function menuButton(action, label, className = "secondary") {
  return `<button class="button ${escapeAttr(className)}" type="button" data-m328-trip-menu-action="${escapeAttr(action)}">${escapeHtml(label)}</button>`;
}

function openTripMenu(state) {
  const work = workingMenuActions(state);
  const lifecycle = lifecycleMenuActions(state.trip);
  const body = `<div class="m328-trip-menu-actions">${work.map(([action, label]) => menuButton(action, label)).join("")}${lifecycle.length ? `<div class="m328-trip-menu-divider"></div>${lifecycle.map(([action, label, type]) => menuButton(action, label, type)).join("")}` : ""}</div>`;
  const dialog = openDialog({ title: "Fahrt verwalten", kicker: String(state.trip.venue || "Fanbusfahrt"), body });
  dialog.querySelectorAll("[data-m328-trip-menu-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.m328TripMenuAction;
      dialog.close?.();
      void handleAction(action, state.trip);
    });
  });
}

function renderPage(root, state) {
  ensureStyle();
  const trip = state.trip;
  const venue = String(trip.venue || "").trim() || "Fahrt";
  root.innerHTML = `<div class="m328-trip-detail">
    <header class="m328-trip-detail-head">
      <button class="button small ghost" type="button" data-trip-detail-back>← Bus-Orga</button>
      <div class="m328-trip-detail-heading"><span>${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(formatTime(trip.eventTime))}</span><h2>${escapeHtml(venue)}</h2></div>
      <div class="m328-trip-detail-status">${lifecycleBadge(trip.status)}</div>
    </header>
    ${trip.status === "CANCELLED" ? `<div class="notice error"><strong>Fahrt abgesagt</strong><p>${escapeHtml(trip.cancellationReason || "Diese Fanbusfahrt findet nicht statt.")}</p></div>` : ""}
    <section class="m328-trip-detail-panel">
      <div class="m328-trip-detail-panel-head"><h3>Fahrtdaten</h3><button class="icon-button m328-trip-settings" type="button" data-m328-trip-settings aria-label="Fahrt verwalten" title="Fahrt verwalten">⚙</button></div>
      ${overviewMarkup(state)}
    </section>
  </div>`;

  root.querySelector("[data-trip-detail-back]")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });
  root.querySelector("[data-m328-trip-settings]")?.addEventListener("click", () => openTripMenu(state));
}

function ensureStyle() {
  if (document.getElementById("m328NativeTripDetailStyle")) return;
  const style = document.createElement("style");
  style.id = "m328NativeTripDetailStyle";
  style.textContent = `
    .m328-trip-detail{display:grid;gap:10px;width:100%;overflow-x:clip}.m328-trip-detail *{box-sizing:border-box;min-width:0}
    .m328-trip-detail-head{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;min-height:58px;padding:2px 104px 10px 0;border-bottom:1px solid var(--line)}
    .m328-trip-detail-heading{display:grid;gap:2px;overflow:hidden}.m328-trip-detail-heading>span{color:var(--muted);font-size:.74rem;font-weight:700}.m328-trip-detail-heading h2{margin:0;font-size:1.25rem;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-trip-detail-status{position:absolute;right:0;top:4px;max-width:100px}.m328-trip-detail-status .badge{max-width:100%;white-space:nowrap;font-size:.66rem;padding-inline:8px}
    .m328-trip-detail-panel{display:grid;gap:11px;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-trip-detail-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.m328-trip-detail-panel-head h3{margin:0;font-size:.96rem}.m328-trip-settings{width:38px;min-width:38px;height:38px;font-size:1rem}
    .m328-trip-overview-group{display:grid;gap:7px;padding-top:2px}.m328-trip-overview-group+.m328-trip-overview-group{padding-top:10px;border-top:1px solid var(--line)}.m328-trip-overview-group h4{margin:0;color:var(--ink-700);font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
    .m328-trip-detail-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0}.m328-trip-detail-facts div{display:grid;align-content:start;gap:2px;padding:7px 8px;border-radius:10px;background:var(--surface-2)}.m328-trip-detail-facts .m328-trip-detail-fact-wide{grid-column:1/-1}.m328-trip-detail-facts dt{color:var(--muted);font-size:.65rem;font-weight:800;text-transform:uppercase}.m328-trip-detail-facts dd{margin:0;font-size:.77rem;font-weight:750;line-height:1.28;overflow-wrap:anywhere}
    .m328-trip-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.m328-trip-metrics span{display:grid;gap:1px;padding:8px 6px;border-radius:10px;background:var(--surface-2);text-align:center}.m328-trip-metrics strong{font-size:.9rem}.m328-trip-metrics small{color:var(--muted);font-size:.59rem;line-height:1.15}
    .m328-trip-overview-subhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}.m328-trip-overview-subhead>span{color:var(--muted);font-size:.65rem;font-weight:700}
    .m328-trip-bus-list{display:grid;gap:0}.m328-trip-bus-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}.m328-trip-bus-row:last-child{border-bottom:0}.m328-trip-bus-row>div{display:grid;gap:2px}.m328-trip-bus-row strong{font-size:.78rem}.m328-trip-bus-row small{color:var(--muted);font-size:.65rem;line-height:1.3}.m328-trip-bus-row>span{font-size:.7rem;font-weight:850;white-space:nowrap}.m328-trip-no-buses{margin:0}
    .m328-trip-menu-actions{display:grid;grid-template-columns:1fr;gap:7px}.m328-trip-menu-actions .button{width:100%;min-height:42px}.m328-trip-menu-divider{height:1px;margin:3px 0;background:var(--line)}
    @media(max-width:420px){.m328-trip-detail-head{gap:7px;padding-right:92px}.m328-trip-detail-head>.button{padding-inline:8px;font-size:.74rem}.m328-trip-detail-status{max-width:88px}.m328-trip-detail-status .badge{font-size:.61rem;padding-inline:6px}.m328-trip-detail-heading>span{font-size:.67rem}.m328-trip-detail-heading h2{font-size:1.14rem}.m328-trip-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:350px){.m328-trip-detail-head{padding-right:0;grid-template-columns:auto minmax(0,1fr)}.m328-trip-detail-status{position:static;grid-column:2;justify-self:start}.m328-trip-detail-facts{grid-template-columns:1fr}.m328-trip-detail-facts .m328-trip-detail-fact-wide{grid-column:auto}.m328-trip-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

async function executeTripAction(action, trip, confirmation) {
  const confirmed = await confirmAction(confirmation.message, confirmation.options);
  if (!confirmed) return;
  try {
    await runWrite(
      () => call(action, { id: trip.id, expectedRevision: Number(trip.revision) }),
      confirmation.success
    );
    if (action === "fanbus_trip_delete") {
      location.hash = "#/bus-orga";
      return;
    }
    await hydrateBusOrgaTripDetail();
  } catch (error) {
    showToast(
      error?.code === "40001"
        ? "Die Daten wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren."
        : error?.message || "Die Fanbus-Aktion konnte nicht ausgeführt werden.",
      "error",
      5200
    );
  }
}

function openCancellation(trip) {
  openDialog({
    title: "Fanbusfahrt absagen",
    kicker: trip.displayTitle || "Fanbusfahrt",
    danger: true,
    submitLabel: "Fahrt absagen",
    body: `<div class="notice error"><strong>Die Absage ist endgültig</strong><p>Die Fahrt bleibt historisch sichtbar, kann aber nicht reaktiviert werden.</p></div><form class="form-grid v4-smart-form"><label class="v4-field-full">Öffentlicher Stornierungsgrund<textarea name="cancellationReason" maxlength="240" required rows="4"></textarea></label></form>`,
    onSubmit: async values => {
      await runWrite(() => call("fanbus_trip_cancel", {
        id: trip.id,
        expectedRevision: Number(trip.revision),
        cancellationReason: String(values.cancellationReason || "").trim()
      }), "Fanbusfahrt wurde abgesagt.");
      await hydrateBusOrgaTripDetail();
    }
  });
}

async function handleAction(action, trip) {
  if (["bookings", "participants", "occupancy", "assignment", "operations"].includes(action)) return navigate(action, trip.id);
  if (action === "edit") return navigate("trip-edit", trip.id);
  if (action === "cancel") return openCancellation(trip);

  const confirmations = {
    publish: {
      call: "fanbus_trip_publish",
      message: `Fanbusfahrt „${trip.displayTitle || "Fanbusfahrt"}“ veröffentlichen?`,
      options: { title: "Fanbusfahrt veröffentlichen", submitLabel: "Veröffentlichen" },
      success: "Fanbusfahrt wurde veröffentlicht."
    },
    close: {
      call: "fanbus_trip_close",
      message: `Fanbusfahrt „${trip.displayTitle || "Fanbusfahrt"}“ endgültig schließen?`,
      options: { danger: true, title: "Fanbusfahrt schließen", submitLabel: "Fahrt schließen" },
      success: "Fanbusfahrt wurde geschlossen."
    },
    reopen: {
      call: "fanbus_trip_reopen",
      message: "Die Fanbusfahrt wird wieder als Entwurf geöffnet. Sie ist danach nicht öffentlich verfügbar und kann wieder bearbeitet werden.",
      options: { title: "Fanbusfahrt wieder öffnen", submitLabel: "Als Entwurf öffnen" },
      success: "Fanbusfahrt wurde wieder als Entwurf geöffnet."
    },
    delete: {
      call: "fanbus_trip_delete",
      message: `Entwurf „${trip.displayTitle || "Fanbusfahrt"}“ endgültig löschen?`,
      options: { danger: true, title: "Fanbus-Entwurf löschen", submitLabel: "Entwurf löschen" },
      success: "Fanbus-Entwurf wurde gelöscht."
    }
  };
  const confirmation = confirmations[action];
  if (confirmation) await executeTripAction(confirmation.call, trip, confirmation);
}

export async function hydrateBusOrgaTripDetail(context = {}) {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  if (!hasBusOrgaAccess()) {
    root.innerHTML = '<div class="notice error">Für die Fahrtdetails fehlt die erforderliche Berechtigung.</div>';
    return;
  }

  const tripId = routeParams().get("trip") || "";
  if (!tripId) {
    root.innerHTML = '<div class="notice error">Es wurde keine Fahrt ausgewählt.</div>';
    return;
  }

  root.innerHTML = loading("Fahrt wird geladen …");
  try {
    const canRegistrations = hasCapability("fanbus.registrations.manage");
    const canManage = hasCapability("fanbus.manage");
    const [tripData, registrationData, busData, mappingData, stopData] = await Promise.all([
      call("fanbus_trips_list"),
      canRegistrations ? call("fanbus_registrations_list", { tripId }) : Promise.resolve({ registrations: [] }),
      canManage ? call("fanbus_buses_list", { tripId }) : Promise.resolve({ buses: [] }),
      canManage ? call("fanbus_bus_boarding_stops_list", { tripId }) : Promise.resolve({ buses: [] }),
      canManage ? call("fanbus_trip_boarding_stops_list", { tripId }) : Promise.resolve({ stops: [] })
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(tripData?.trips) ? tripData.trips : []).find(item => item.id === tripId);
    if (!trip) throw new Error("Diese Fahrt ist nicht verfügbar oder darf nicht geöffnet werden.");
    renderPage(root, {
      trip,
      registrations: Array.isArray(registrationData?.registrations) ? registrationData.registrations : [],
      buses: Array.isArray(busData?.buses) ? busData.buses : [],
      mappings: Array.isArray(mappingData?.buses) ? mappingData.buses : [],
      stops: Array.isArray(stopData?.stops) ? stopData.stops : []
    });
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Fahrt konnte nicht geladen werden.")}</div><button class="button secondary" type="button" data-trip-detail-load-back>← Bus-Orga</button>`;
    root.querySelector("[data-trip-detail-load-back]")?.addEventListener("click", () => {
      location.hash = "#/bus-orga";
    });
  }
}

export function noop() {}

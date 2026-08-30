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

function actionButton(action, label, className = "secondary", extraClass = "") {
  return `<button class="button small ${className}${extraClass ? ` ${extraClass}` : ""}" type="button" data-trip-detail-action="${escapeAttr(action)}">${escapeHtml(label)}</button>`;
}

function managementActions(trip) {
  if (!hasCapability("fanbus.manage") || trip.canManage === false || trip.status === "CANCELLED") return "";
  const actions = [];
  if (trip.status === "DRAFT") {
    actions.push(actionButton("publish", "Veröffentlichen", "primary"));
    actions.push(actionButton("delete", "Entwurf löschen", "danger"));
  }
  if (["DRAFT", "PUBLISHED"].includes(trip.status)) {
    actions.push(actionButton("close", "Fahrt schließen", "ghost"));
  }
  if (trip.status === "CLOSED") {
    actions.push(actionButton("reopen", "Wieder als Entwurf öffnen"));
  }
  if (trip.canCancel === true) {
    actions.push(actionButton("cancel", "Fahrt absagen", "danger"));
  }
  return actions.join("");
}

function renderPage(root, trip) {
  ensureStyle();
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const canRegistrations = hasCapability("fanbus.registrations.manage")
    && trip.canManageRegistrations !== false;
  const canOperations = (
    hasCapability("fanbus.operations.manage")
    && trip.canManageOperations !== false
  ) || (
    hasCapability("fanbus.payment_marker.manage")
    && trip.canManagePaymentMarker !== false
  ) || canRegistrations;
  const venue = String(trip.venue || "").trim() || "Fahrt";
  const workingActions = [];

  if (canRegistrations) {
    workingActions.push(actionButton("bookings", "Buchungen", "primary"));
    workingActions.push(actionButton("participants", "Teilnehmer"));
  }
  if (canManage) {
    workingActions.push(actionButton("occupancy", "Busse & Zuordnung"));
  }
  if (canOperations) {
    workingActions.push(actionButton("operations", "Fahrtbetrieb"));
  }
  if (canManage && ["DRAFT", "PUBLISHED"].includes(trip.status)) {
    workingActions.push(actionButton("edit", "Bearbeiten", "secondary", "m328-trip-detail-action-edit"));
  }

  const lifecycleActions = managementActions(trip);
  root.innerHTML = `<div class="m328-trip-detail">
    <header class="m328-trip-detail-head">
      <button class="button small ghost" type="button" data-trip-detail-back>← Bus-Orga</button>
      <div><span>${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(formatTime(trip.eventTime))}</span><h2>${escapeHtml(venue)}</h2></div>
      ${lifecycleBadge(trip.status)}
    </header>
    ${trip.status === "CANCELLED" ? `<div class="notice error"><strong>Fahrt abgesagt</strong><p>${escapeHtml(trip.cancellationReason || "Diese Fanbusfahrt findet nicht statt.")}</p></div>` : ""}
    <section class="m328-trip-detail-panel">
      <h3>Fahrtdaten</h3>
      <dl class="m328-trip-detail-facts">
        <div><dt>Termin</dt><dd>${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(formatTime(trip.eventTime))}</dd></div>
        <div><dt>Abfahrt</dt><dd>${escapeHtml(formatDateTime(trip.departureAt))}</dd></div>
        <div><dt>Ziel / Ort</dt><dd>${escapeHtml(venue)}</dd></div>
        <div><dt>Fahrtpreis</dt><dd>${escapeHtml(formatMoney(trip.priceCents))}</dd></div>
        <div class="m328-trip-detail-fact-wide"><dt>Anmeldeschluss</dt><dd>${escapeHtml(formatDateTime(trip.registrationClosesAt))}</dd></div>
        <div class="m328-trip-detail-fact-wide"><dt>Belegung</dt><dd>${Number(trip.activeRegistrationCount || 0)} Teilnehmer · ${Number(trip.waitlistedRegistrationCount || 0)} Warteliste · ${Number(trip.remainingCapacity || 0)} frei</dd></div>
      </dl>
    </section>
    <section class="m328-trip-detail-panel">
      <h3>Fahrt verwalten</h3>
      <div class="m328-trip-detail-actions m328-trip-detail-work-actions">${workingActions.length ? workingActions.join("") : '<p class="subtle">Für diese Fahrt sind keine Arbeitsbereiche freigeschaltet.</p>'}</div>
    </section>
    ${lifecycleActions ? `<section class="m328-trip-detail-panel"><h3>Status und Fahrt</h3><div class="m328-trip-detail-actions">${lifecycleActions}</div></section>` : ""}
  </div>`;

  root.querySelector("[data-trip-detail-back]")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });
  root.querySelectorAll("[data-trip-detail-action]").forEach(button => {
    button.addEventListener("click", () => void handleAction(button.dataset.tripDetailAction, trip));
  });
}

function ensureStyle() {
  if (document.getElementById("m328NativeTripDetailStyle")) return;
  const style = document.createElement("style");
  style.id = "m328NativeTripDetailStyle";
  style.textContent = `
    .m328-trip-detail{display:grid;gap:10px;width:100%;overflow-x:clip}.m328-trip-detail *{box-sizing:border-box;min-width:0}
    .m328-trip-detail-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-trip-detail-head div{display:grid;gap:2px}.m328-trip-detail-head span{color:var(--muted);font-size:.74rem;font-weight:700}.m328-trip-detail-head h2{margin:0;font-size:1.25rem;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-trip-detail-panel{display:grid;gap:8px;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.m328-trip-detail-panel h3{margin:0;font-size:.96rem}
    .m328-trip-detail-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0}.m328-trip-detail-facts div{display:grid;align-content:start;gap:2px;padding:7px 8px;border-radius:10px;background:var(--surface-2)}.m328-trip-detail-facts .m328-trip-detail-fact-wide{grid-column:1/-1}.m328-trip-detail-facts dt{color:var(--muted);font-size:.65rem;font-weight:800;text-transform:uppercase}.m328-trip-detail-facts dd{margin:0;font-size:.77rem;font-weight:750;line-height:1.28;overflow-wrap:anywhere}
    .m328-trip-detail-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.m328-trip-detail-actions .button{width:100%;min-height:40px;padding:7px 9px;font-size:.75rem;line-height:1.15}.m328-trip-detail-actions>p{grid-column:1/-1;margin:0}
    @media(max-width:620px){.m328-trip-detail-head{grid-template-columns:auto minmax(0,1fr)}.m328-trip-detail-head>.badge{grid-column:2;justify-self:start}.m328-trip-detail-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.m328-trip-detail-work-actions .m328-trip-detail-action-edit:last-child:nth-child(odd){grid-column:1/-1}}
    @media(max-width:350px){.m328-trip-detail-facts{grid-template-columns:1fr}.m328-trip-detail-facts .m328-trip-detail-fact-wide{grid-column:auto}.m328-trip-detail-actions{grid-template-columns:1fr}.m328-trip-detail-work-actions .m328-trip-detail-action-edit:last-child:nth-child(odd){grid-column:auto}}
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
  if (["bookings", "participants", "occupancy", "operations"].includes(action)) {
    return navigate(action, trip.id);
  }
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
    const data = await call("fanbus_trips_list");
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(data?.trips) ? data.trips : []).find(item => item.id === tripId);
    if (!trip) throw new Error("Diese Fahrt ist nicht verfügbar oder darf nicht geöffnet werden.");
    renderPage(root, trip);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Fahrt konnte nicht geladen werden.")}</div><button class="button secondary" type="button" data-trip-detail-load-back>← Bus-Orga</button>`;
    root.querySelector("[data-trip-detail-load-back]")?.addEventListener("click", () => {
      location.hash = "#/bus-orga";
    });
  }
}

export function noop() {}

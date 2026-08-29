import {
  call,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading
} from "./common.js";
import { queueM328FanbusAction } from "../m328-bus-orga-shell.js?v=20260829-m328-r1";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const BUS_ORGA_CAPABILITIES = Object.freeze([
  "fanbus.manage",
  "fanbus.registrations.manage",
  "fanbus.operations.manage",
  "fanbus.payment_marker.manage"
]);

function hasBusOrgaAccess() {
  return BUS_ORGA_CAPABILITIES.some(code => hasCapability(code));
}

function formatDate(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw || "Termin offen";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? raw : DATE_FORMAT.format(date);
}

function eventTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
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

function relevantTrips(items) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return items
    .filter(trip => String(trip?.eventDate || "") >= localToday || ["DRAFT", "PUBLISHED"].includes(trip?.status))
    .sort((left, right) => `${left.eventDate || ""} ${left.eventTime || ""}`.localeCompare(`${right.eventDate || ""} ${right.eventTime || ""}`));
}

function registrationTrips(items) {
  return relevantTrips(items).filter(trip => trip.status === "PUBLISHED");
}

function nextTrip(items) {
  return relevantTrips(items).find(trip => trip.status !== "CANCELLED") || null;
}

function openFanbusContext(action = "", tripId = "") {
  if (action) queueM328FanbusAction(action, tripId);
  location.hash = "#/fanbuses?orga=1&from=bus-orga";
}

function openWorkspace(view, extra = {}) {
  const params = new URLSearchParams({ view, from: "bus-orga", ...extra });
  location.hash = `#/fanbuses?${params}`;
}

function tripOption(trip) {
  return `<option value="${escapeAttr(trip.id)}">${escapeHtml(`${formatDate(trip.eventDate)} · ${trip.displayTitle || "Fanbusfahrt"}`)}</option>`;
}

function workspaceCard({ id, title, description }) {
  return `<button class="m328-workspace-card" type="button" data-m328-workspace="${escapeAttr(id)}">
    <span class="m328-workspace-card-copy">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(description)}</small>
    </span>
    <span class="m328-workspace-chevron" aria-hidden="true">›</span>
  </button>`;
}

function renderWorkspaces(items) {
  const target = document.getElementById("m328WorkspaceGrid");
  if (!target) return;
  const cards = [];
  const nearest = nextTrip(items);
  const canManage = hasCapability("fanbus.manage");
  const canRegistrations = hasCapability("fanbus.registrations.manage");
  const canOperations = hasCapability("fanbus.operations.manage");
  const canPaid = hasCapability("fanbus.payment_marker.manage");

  if (canManage) {
    cards.push(workspaceCard({
      id: "trips",
      title: "Fahrten",
      description: "Fahrten anlegen, bearbeiten und veröffentlichen"
    }));
    cards.push(workspaceCard({
      id: "buses",
      title: "Busse",
      description: nearest ? `Zuordnung für ${nearest.displayTitle || "die nächste Fahrt"}` : "Busverwaltung öffnen"
    }));
  }

  if (canRegistrations) {
    cards.push(workspaceCard({
      id: "participants",
      title: "Teilnehmer",
      description: nearest ? `Teilnehmerliste für ${nearest.displayTitle || "die nächste Fahrt"}` : "Teilnehmerverwaltung öffnen"
    }));
  }

  if (canOperations || canPaid || canRegistrations) {
    cards.push(workspaceCard({
      id: "operations",
      title: "Fahrtbetrieb",
      description: nearest ? `Check-in für ${nearest.displayTitle || "die nächste Fahrt"}` : "Operative Fahrtansicht öffnen"
    }));
  }

  if (canRegistrations) {
    cards.push(workspaceCard({
      id: "regular-riders",
      title: "Stammfahrer",
      description: "Wiederkehrende Mitfahrer verwalten"
    }));
    cards.push(workspaceCard({
      id: "person-groups",
      title: "Gruppen",
      description: "Personengruppen verwalten"
    }));
  }

  if (canManage) {
    cards.push(workspaceCard({
      id: "settings",
      title: "Einstellungen",
      description: "Zustiegsorte und Fanbus-Grundeinstellungen"
    }));
  }

  target.innerHTML = cards.length ? cards.join("") : empty("Keine Verwaltungsbereiche freigeschaltet.");

  target.querySelectorAll("[data-m328-workspace]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.m328Workspace;
      if (action === "trips") {
        document.getElementById("m328TripsTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (action === "settings") {
        openWorkspace("settings");
        return;
      }
      if (action === "regular-riders") {
        openWorkspace("regular-riders");
        return;
      }
      if (action === "person-groups") {
        openWorkspace("person-groups");
        return;
      }
      if (!nearest) return;
      if (action === "participants") {
        openFanbusContext("participants", nearest.id);
        return;
      }
      if (action === "buses") {
        openFanbusContext("occupancy", nearest.id);
        return;
      }
      if (action === "operations") {
        openWorkspace("operations", { trip: nearest.id, fromTrip: nearest.id });
      }
    });
  });
}

function renderNextTrip(items) {
  const target = document.getElementById("m328BusOrgaNextTrip");
  if (!target) return;
  const trip = nextTrip(items);
  if (!trip) {
    target.innerHTML = empty("Aktuell ist keine anstehende Fanbusfahrt vorhanden.");
    return;
  }

  const active = Number(trip.activeRegistrationCount || 0);
  const waiting = Number(trip.waitlistedRegistrationCount || 0);
  const remaining = Number(trip.remainingCapacity || 0);
  target.innerHTML = `<div class="m328-next-trip-card">
    <div class="m328-next-trip-top">
      <span class="m328-section-kicker">Nächste Fahrt</span>
      ${lifecycleBadge(trip.status)}
    </div>
    <strong class="m328-next-trip-title">${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong>
    <div class="m328-next-trip-meta">
      <span class="m328-next-trip-date">${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(eventTime(trip.eventTime))}</span>
      <span>${active} Teilnehmer</span>
      <span>${waiting} Warteliste</span>
      <span>${remaining} frei</span>
    </div>
  </div>`;
}

function renderQuickRegistration(items) {
  const section = document.getElementById("m328BusOrgaQuick");
  const select = document.getElementById("m328QuickRegistrationTrip");
  const button = document.getElementById("m328QuickRegistration");
  if (!section || !select || !button) return;

  const allowed = hasCapability("fanbus.registrations.manage");
  section.hidden = !allowed;
  if (!allowed) return;

  const available = registrationTrips(items);
  select.innerHTML = available.length
    ? available.map(tripOption).join("")
    : '<option value="">Keine veröffentlichte Fahrt verfügbar</option>';
  button.disabled = !available.length;
  button.onclick = () => {
    const tripId = select.value;
    if (!tripId) return;
    openFanbusContext("add-registration", tripId);
  };
}

function tripActionButton(action, tripId, label, className = "secondary", ariaLabel = label) {
  return `<button class="button small ${className}" type="button" data-m328-trip-action="${escapeAttr(action)}" data-trip-id="${escapeAttr(tripId)}" aria-label="${escapeAttr(ariaLabel)}">${escapeHtml(label)}</button>`;
}

function renderTripCard(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const canRegistrations = hasCapability("fanbus.registrations.manage") && trip.canManageRegistrations !== false;
  const canOperations = (
    hasCapability("fanbus.operations.manage")
    || hasCapability("fanbus.payment_marker.manage")
    || canRegistrations
  );
  const actions = [];

  if (canRegistrations) {
    actions.push(tripActionButton("participants", trip.id, "Teilnehmer", "secondary", "Teilnehmer und Warteliste öffnen"));
    if (trip.status === "PUBLISHED") {
      actions.push(tripActionButton("add-registration", trip.id, "＋ Anmeldung", "primary", "Neue Anmeldung erfassen"));
    }
  }
  if (canManage) {
    actions.push(tripActionButton("occupancy", trip.id, "Busse", "secondary", "Busse und Zuordnung öffnen"));
    if (["DRAFT", "PUBLISHED"].includes(trip.status)) {
      actions.push(tripActionButton("edit-trip", trip.id, "Bearbeiten"));
    }
  }
  if (canOperations) {
    actions.push(tripActionButton("operations", trip.id, "Fahrtbetrieb"));
  }

  const active = Number(trip.activeRegistrationCount || 0);
  const waiting = Number(trip.waitlistedRegistrationCount || 0);
  const remaining = Number(trip.remainingCapacity || 0);
  const bodyId = `m328TripActions-${escapeAttr(trip.id)}`;

  return `<article class="m328-trip-card" data-m328-trip-card="${escapeAttr(trip.id)}">
    <button class="m328-trip-summary" type="button" data-m328-trip-toggle="${escapeAttr(trip.id)}" aria-expanded="false" aria-controls="${bodyId}">
      <span class="m328-trip-summary-main">
        <span class="m328-section-kicker">${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(eventTime(trip.eventTime))}</span>
        <strong class="m328-trip-summary-title">${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong>
        <span class="m328-trip-card-meta">
          <span>${active} TN</span>
          <span>${waiting} WL</span>
          <span>${remaining} frei</span>
        </span>
      </span>
      <span class="m328-trip-summary-side">
        ${lifecycleBadge(trip.status)}
        <span class="m328-trip-chevron" aria-hidden="true">›</span>
      </span>
    </button>
    <div id="${bodyId}" class="m328-trip-expanded" data-m328-trip-expanded="${escapeAttr(trip.id)}" hidden>
      ${actions.length ? `<div class="m328-trip-actions">${actions.join("")}</div>` : '<p class="subtle">Für diese Fahrt sind keine Aktionen verfügbar.</p>'}
    </div>
  </article>`;
}

function setTripExpanded(target, tripId) {
  target.querySelectorAll("[data-m328-trip-toggle]").forEach(toggle => {
    const expanded = toggle.dataset.m328TripToggle === tripId
      && toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(expanded));
    const body = target.querySelector(`[data-m328-trip-expanded="${CSS.escape(toggle.dataset.m328TripToggle)}"]`);
    if (body) body.hidden = !expanded;
  });
}

function renderTrips(items) {
  const target = document.getElementById("m328TripsList");
  const create = document.getElementById("m328CreateTrip");
  if (!target) return;
  const visible = relevantTrips(items);
  target.innerHTML = visible.length
    ? visible.map(renderTripCard).join("")
    : empty("Keine verwaltbaren Fanbusfahrten vorhanden.");

  if (create) {
    create.hidden = !hasCapability("fanbus.manage");
    create.onclick = () => openFanbusContext("new-trip");
  }

  target.querySelectorAll("[data-m328-trip-toggle]").forEach(button => {
    button.addEventListener("click", () => setTripExpanded(target, button.dataset.m328TripToggle));
  });

  target.querySelectorAll("[data-m328-trip-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.m328TripAction;
      const tripId = button.dataset.tripId;
      if (action === "operations") {
        openWorkspace("operations", { trip: tripId, fromTrip: tripId });
        return;
      }
      openFanbusContext(action, tripId);
    });
  });
}

function bindExitActions() {
  document.getElementById("m328BusOrgaBack")?.addEventListener("click", () => {
    location.hash = "#/fanbuses";
  });
  document.getElementById("m328BusOrgaClose")?.addEventListener("click", () => {
    location.hash = "#/dashboard";
  });
}

export async function hydrateBusOrga(context = {}) {
  bindExitActions();
  const target = document.getElementById("m328TripsList");
  if (!hasBusOrgaAccess()) {
    if (target) target.innerHTML = '<div class="notice error">Für die Bus-Orga-Verwaltung fehlt die erforderliche Berechtigung.</div>';
    return;
  }

  if (target) target.innerHTML = loading("Fanbus-Verwaltung wird geladen …");
  try {
    const data = await call("fanbus_trips_list");
    if (context.isCurrent && !context.isCurrent()) return;
    const items = Array.isArray(data?.trips) ? data.trips : [];
    renderNextTrip(items);
    renderQuickRegistration(items);
    renderWorkspaces(items);
    renderTrips(items);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    if (target) target.innerHTML = errorPanel(error, "Bus-Orga-Verwaltung konnte nicht geladen werden");
  }
}

export function noop() {}

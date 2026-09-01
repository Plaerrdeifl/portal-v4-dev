import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability
} from "./modules/common.js";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const QUICK_ACTIONS = Object.freeze({
  registration: { title: "Anmeldung hinzufügen", description: "Neue Einzel- oder Gruppenanmeldung erfassen", view: "registration" },
  bookings: { title: "Buchungen anzeigen", description: "Buchungen einer Fahrt öffnen", view: "bookings" },
  participants: { title: "Teilnehmer anzeigen", description: "Teilnehmer einer Fahrt öffnen", view: "participants" },
  occupancy: { title: "Busse anzeigen", description: "Busse, Kapazitäten und Zustiege verwalten", view: "occupancy" },
  assignment: { title: "Buszuordnung", description: "Aktuelle Zuordnung prüfen und verteilen", view: "assignment" },
  operations: { title: "Fahrtbetrieb", description: "Check-in und Zahlungsstatus öffnen", view: "operations" },
  "trip-edit": { title: "Fahrtdaten bearbeiten", description: "Abfahrt, Preis und Zustiege ändern", view: "trip-edit" }
});

let waitObserver = null;
let mountToken = 0;
let mounting = false;

function routeState() {
  const hash = String(location.hash || "");
  const [path, query = ""] = hash.split("?", 2);
  const params = new URLSearchParams(query);
  return {
    path,
    view: params.get("view") || "",
    quick: params.get("quick") || ""
  };
}

function isBusOrgaHome() {
  const route = routeState();
  return route.path === "#/bus-orga" && !route.view;
}

function formatShortDate(value) {
  const raw = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw || "Termin offen";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? raw : DATE_FORMAT.format(date).slice(0, 6);
}

function eventTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
}

function relevantTrips(items) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return items
    .filter(trip => String(trip?.eventDate || "") >= localToday || ["DRAFT", "PUBLISHED"].includes(trip?.status))
    .sort((left, right) => `${left.eventDate || ""} ${left.eventTime || ""}`.localeCompare(`${right.eventDate || ""} ${right.eventTime || ""}`));
}

function allowedActions() {
  const canManage = hasCapability("fanbus.manage");
  const canRegistrations = hasCapability("fanbus.registrations.manage");
  const canOperations = hasCapability("fanbus.operations.manage") || hasCapability("fanbus.payment_marker.manage") || canRegistrations;
  const actions = [];
  if (canRegistrations) actions.push("registration", "bookings", "participants");
  if (canManage) actions.push("occupancy");
  if (canManage && canRegistrations) actions.push("assignment");
  if (canOperations) actions.push("operations");
  if (canManage) actions.push("trip-edit");
  return actions;
}

function tripsForAction(items, action) {
  if (action === "registration") return relevantTrips(items).filter(trip => trip.status === "PUBLISHED");
  const trips = relevantTrips(items).filter(trip => trip.status !== "CANCELLED");
  if (action === "trip-edit") return trips.filter(trip => ["DRAFT", "PUBLISHED"].includes(trip.status));
  return trips;
}

function ensureStyle() {
  if (document.getElementById("m328QuickChangeStyle")) return;
  const style = document.createElement("style");
  style.id = "m328QuickChangeStyle";
  style.textContent = `
    .m328-quick-change[hidden]{display:none!important}
    .m328-quick-change .m328-workspace-grid{border-top:1px solid var(--line)}
    .m328-quick-picker{display:grid;gap:10px;padding:10px 11px}
    .m328-quick-picker-title{font-size:.82rem;line-height:1.2}
    .m328-quick-game-row{
      display:grid;
      grid-template-columns:46px minmax(0,1fr);
      align-items:center;
      gap:10px;
      min-width:0;
    }
    .m328-quick-game-row>span{
      font-size:.74rem;
      font-weight:850;
      color:var(--ink);
    }
    .m328-quick-game-row select{
      display:block;
      width:100%;
      min-width:0;
      min-height:42px;
      margin:0;
      box-sizing:border-box;
      font-size:.76rem;
    }
  `;
  document.head.appendChild(style);
}

function replaceLegacyQuickSection() {
  let section = document.getElementById("m328BusOrgaQuick");
  if (!section) return null;
  if (section.tagName !== "DETAILS") {
    const replacement = document.createElement("details");
    replacement.id = "m328BusOrgaQuick";
    replacement.className = "module-panel m328-general-details m328-quick-change";
    section.replaceWith(replacement);
    section = replacement;
  } else {
    section.classList.add("m328-quick-change");
  }
  section.hidden = false;
  section.innerHTML = `<summary class="m328-general-summary"><span class="m328-general-summary-copy"><span class="m328-section-kicker">Schnelländerung</span><strong>Schnellzugriff auf Fahrten</strong></span><span class="m328-general-chevron" aria-hidden="true">›</span></summary><div id="m328QuickChangeBody" class="m328-workspace-grid" aria-live="polite"></div>`;
  return section;
}

function actionCard(action) {
  const config = QUICK_ACTIONS[action];
  return `<button class="m328-workspace-card" type="button" data-m328-quick-action="${escapeAttr(action)}"><span class="m328-workspace-card-copy"><strong>${escapeHtml(config.title)}</strong><small>${escapeHtml(config.description)}</small></span><span class="m328-workspace-chevron" aria-hidden="true">›</span></button>`;
}

function openTarget(action, tripId) {
  const config = QUICK_ACTIONS[action];
  if (!config) return;
  const params = new URLSearchParams({
    view: config.view,
    trip: String(tripId || ""),
    from: "quick",
    quick: action
  });
  location.hash = `#/bus-orga?${params}`;
}

function clearQuickRouteWithoutNavigation() {
  const route = routeState();
  if (route.path !== "#/bus-orga" || route.view || !route.quick) return;
  history.replaceState(history.state, "", "#/bus-orga");
}

function renderActionList(section, items, actions) {
  const body = section.querySelector("#m328QuickChangeBody");
  if (!body) return;
  body.innerHTML = actions.map(actionCard).join("") || empty("Keine Schnelländerungen freigeschaltet.");
  body.querySelectorAll("[data-m328-quick-action]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.m328QuickAction;
      if (!action) return;
      section.open = true;
      renderTripPicker(section, items, action);
    });
  });
}

function tripOption(trip) {
  const venue = String(trip.venue || "").trim() || trip.displayTitle || "Fanbusfahrt";
  return `<option value="${escapeAttr(trip.id)}">${escapeHtml(`${formatShortDate(trip.eventDate)} · ${venue} · ${eventTime(trip.eventTime)}`)}</option>`;
}

function renderTripPicker(section, items, action) {
  const body = section.querySelector("#m328QuickChangeBody");
  const config = QUICK_ACTIONS[action];
  if (!body || !config) return;
  const trips = tripsForAction(items, action);
  const disabled = trips.length ? "" : " disabled";
  const placeholder = trips.length ? "Spiel auswählen …" : "Kein passendes Spiel verfügbar";
  body.innerHTML = `
    <div class="m328-quick-picker">
      <strong class="m328-quick-picker-title">${escapeHtml(config.title)}</strong>
      <label class="m328-quick-game-row">
        <span>Spiel</span>
        <select data-m328-quick-game aria-label="Spiel auswählen"${disabled}>
          <option value="">${escapeHtml(placeholder)}</option>
          ${trips.map(tripOption).join("")}
        </select>
      </label>
    </div>
  `;
  const select = body.querySelector("[data-m328-quick-game]");
  select?.addEventListener("change", () => {
    if (select.value) openTarget(action, select.value);
  });
}

function busOrgaHomeReady() {
  const quick = document.getElementById("m328BusOrgaQuick");
  const trips = document.getElementById("m328TripsList");
  if (!quick || !trips) return false;
  const text = String(trips.textContent || "");
  return !/Fahrten werden geladen|Fanbus-Verwaltung wird geladen/.test(text);
}

async function mountQuickChange() {
  if (!isBusOrgaHome() || !busOrgaHomeReady() || mounting) return false;
  const token = mountToken;
  mounting = true;
  const routeAtStart = String(location.hash || "");
  try {
    const data = await call("fanbus_trips_list");
    if (token !== mountToken || String(location.hash || "") !== routeAtStart || !isBusOrgaHome()) return true;
    ensureStyle();
    const section = replaceLegacyQuickSection();
    if (!section) return false;
    const actions = allowedActions();
    section.hidden = actions.length === 0;
    if (!actions.length) return true;
    const items = Array.isArray(data?.trips) ? data.trips : [];
    const requested = routeState().quick;
    section.ontoggle = () => {
      if (section.open) return;
      clearQuickRouteWithoutNavigation();
      renderActionList(section, items, actions);
    };
    if (requested && actions.includes(requested)) {
      section.open = true;
      renderTripPicker(section, items, requested);
    } else {
      renderActionList(section, items, actions);
    }
    return true;
  } catch (error) {
    console.warn("M328 Schnelländerung konnte nicht geladen werden", error);
    return true;
  } finally {
    mounting = false;
  }
}

function scheduleMount() {
  mountToken += 1;
  waitObserver?.disconnect();
  waitObserver = null;
  if (!isBusOrgaHome()) return;
  const attempt = () => {
    void mountQuickChange().then(done => {
      if (done) {
        waitObserver?.disconnect();
        waitObserver = null;
      }
    });
  };
  attempt();
  if (busOrgaHomeReady()) return;
  waitObserver = new MutationObserver(attempt);
  waitObserver.observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
}

window.addEventListener("hashchange", scheduleMount);
scheduleMount();

export function noop() {}

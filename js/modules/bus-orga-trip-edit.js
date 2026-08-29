import {
  call,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  runWrite,
  showToast
} from "./common.js";

const PRIVACY_REFERENCE = "https://plaerrdeifl.de/datenschutzerklaerung/";
const TERMS_REFERENCE = "https://plaerrdeifl.de/fanbus-teilnahmebedingungen/";
const BERLIN_PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

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

function berlinParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Object.fromEntries(
    BERLIN_PARTS_FORMAT.formatToParts(date)
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
  const local = toBerlinInputValue(value);
  return local ? local.slice(11, 16) : "";
}

function berlinOffsetMilliseconds(instant) {
  const date = new Date(instant);
  const parts = berlinParts(date);
  const representedAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function berlinLocalToIso(value, label) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) throw new Error(`${label} ist ungültig.`);
  const wallClockUtc = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), 0
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
  const date = String(trip?.eventDate || "").trim();
  const time = String(value || "").trim();
  if (!time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return berlinLocalToIso(`${date}T${time}`, label);
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
  const cents = Number(match[1]) * 100 + Number(String(match[2] || "").padEnd(2, "0") || 0);
  if (!Number.isSafeInteger(cents) || cents > 2147483647) {
    throw new Error("Der Fahrtpreis ist zu groß.");
  }
  return cents;
}

function activeMasterStops(state) {
  const used = new Set(state.tripStops.map(stop => stop.boardingStopId).filter(Boolean));
  return state.masterStops.filter(stop => stop?.isActive !== false || used.has(stop?.id));
}

function masterOptions(state, selected = "") {
  return `<option value="">Bitte wählen</option>${activeMasterStops(state).map(stop =>
    `<option value="${escapeAttr(stop.id)}"${String(stop.id) === String(selected) ? " selected" : ""}>${escapeHtml(stop.label || "Zustiegsort")}</option>`
  ).join("")}`;
}

function stopRow(state, stop = null, isNew = false) {
  const id = stop?.tripBoardingStopId || stop?.id || "";
  const master = stop?.boardingStopId || "";
  const time = toBerlinTimeInputValue(stop?.departureAt) || toBerlinTimeInputValue(state.trip.departureAt) || "";
  return `<div class="m328-trip-edit-stop" data-trip-stop-row data-new="${isNew ? "true" : "false"}" data-trip-stop-id="${escapeAttr(id)}" data-revision="${escapeAttr(stop?.revision || "")}" data-position="${escapeAttr(stop?.position || "")}" data-original-master="${escapeAttr(master)}" data-original-time="${escapeAttr(time)}" data-trip-note="${escapeAttr(stop?.tripNote || "")}">
    <label>Zustiegsort<select data-stop-master>${masterOptions(state, master)}</select></label>
    <label>Uhrzeit<input data-stop-time type="time" step="60" value="${escapeAttr(time)}"></label>
    <button class="button small ghost" type="button" data-stop-remove>${isNew ? "Entfernen" : "Entfernen"}</button>
  </div>`;
}

function ensureStyle() {
  if (document.getElementById("m328NativeTripEditStyle")) return;
  const style = document.createElement("style");
  style.id = "m328NativeTripEditStyle";
  style.textContent = `
    .m328-trip-edit{display:grid;gap:10px;width:100%;overflow-x:clip}.m328-trip-edit *{box-sizing:border-box;min-width:0}
    .m328-trip-edit-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-trip-edit-title{display:grid;gap:2px}.m328-trip-edit-title h2{margin:0;font-size:1.28rem;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m328-trip-edit-title span{color:var(--muted);font-size:.76rem;font-weight:700}
    .m328-trip-edit-panel{display:grid;gap:10px;padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-trip-edit-panel h3{margin:0;font-size:1rem}.m328-trip-edit-hint{margin:0;color:var(--muted);font-size:.72rem;line-height:1.35}
    .m328-trip-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.m328-trip-edit-grid label,.m328-trip-edit-default{display:grid;gap:4px;font-size:.72rem;font-weight:750}.m328-trip-edit-grid input,.m328-trip-edit-grid select,.m328-trip-edit-default select{width:100%;min-height:42px}
    .m328-trip-edit-toggle{display:flex!important;align-items:flex-start;gap:8px;grid-column:1/-1}.m328-trip-edit-toggle input{width:auto;min-height:auto;margin-top:2px}.m328-trip-edit-toggle span{display:grid;gap:2px}.m328-trip-edit-toggle small{color:var(--muted);font-weight:500}
    .m328-trip-edit-stops{display:grid;gap:7px}.m328-trip-edit-stop{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(110px,.7fr) auto;gap:7px;align-items:end;padding:8px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2)}.m328-trip-edit-stop label{display:grid;gap:3px;font-size:.69rem;font-weight:750}.m328-trip-edit-stop select,.m328-trip-edit-stop input{width:100%;min-height:40px}.m328-trip-edit-stop.is-removed{opacity:.55}.m328-trip-edit-stop.is-removed select,.m328-trip-edit-stop.is-removed input{pointer-events:none}
    .m328-trip-edit-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.m328-trip-edit-actions{display:grid;grid-template-columns:1fr;gap:8px}.m328-trip-edit-actions .button{width:100%;min-height:46px}
    @media(max-width:620px){.m328-trip-edit-grid{grid-template-columns:1fr}.m328-trip-edit-stop{grid-template-columns:1fr 1fr}.m328-trip-edit-stop .button{grid-column:1/-1}.m328-trip-edit-toggle{grid-column:auto}}
  `;
  document.head.appendChild(style);
}

function syncDefaultStop(state) {
  const select = document.getElementById("m328TripEditDefaultStop");
  if (!select) return;
  const current = select.value || state.trip.defaultBoardingStopId || "";
  const rows = [...document.querySelectorAll("[data-trip-stop-row]")]
    .filter(row => row.dataset.removed !== "true");
  const options = [];
  const seen = new Set();
  for (const row of rows) {
    const master = row.querySelector("[data-stop-master]");
    const value = master?.value || "";
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: master.selectedOptions?.[0]?.textContent?.trim() || "Zustiegsort" });
  }
  select.innerHTML = `<option value="">Kein Standard</option>${options.map(item => `<option value="${escapeAttr(item.value)}">${escapeHtml(item.label)}</option>`).join("")}`;
  select.value = seen.has(current) ? current : "";
}

function bindStopRows(state) {
  document.querySelectorAll("[data-trip-stop-row]").forEach(row => {
    if (row.dataset.bound === "true") return;
    row.dataset.bound = "true";
    row.querySelector("[data-stop-master]")?.addEventListener("change", () => syncDefaultStop(state));
    row.querySelector("[data-stop-remove]")?.addEventListener("click", event => {
      if (row.dataset.new === "true") {
        row.remove();
      } else {
        const removed = row.dataset.removed === "true";
        row.dataset.removed = removed ? "false" : "true";
        row.classList.toggle("is-removed", !removed);
        event.currentTarget.textContent = removed ? "Entfernen" : "Rückgängig";
      }
      syncDefaultStop(state);
    });
  });
}

function collectStopPlan(state) {
  const rows = [...document.querySelectorAll("[data-trip-stop-row]")];
  const activeRows = rows.filter(row => row.dataset.removed !== "true");
  const selected = activeRows.map(row => row.querySelector("[data-stop-master]")?.value || "");
  if (selected.some(value => !value)) throw new Error("Bitte für jeden Zustieg einen Zustiegsort auswählen.");
  if (new Set(selected).size !== selected.length) throw new Error("Ein Zustiegsort kann pro Fahrt nur einmal verwendet werden.");
  let nextPosition = rows.reduce((max, row) => Math.max(max, Number(row.dataset.position || 0)), 0) + 1;
  const removals = [];
  const upserts = [];
  rows.forEach(row => {
    const id = row.dataset.tripStopId || null;
    const revision = id ? Number(row.dataset.revision || 0) : null;
    const removed = row.dataset.removed === "true";
    const master = row.querySelector("[data-stop-master]")?.value || row.dataset.originalMaster || "";
    const time = row.querySelector("[data-stop-time]")?.value || row.dataset.originalTime || "";
    const position = id ? Number(row.dataset.position || 1) : nextPosition++;
    const base = {
      ...(id ? { id, expectedRevision: revision } : {}),
      tripId: state.trip.id,
      boardingStopId: master,
      departureAt: tripTimeToBerlinIso(state.trip, time, "Die Zustiegszeit"),
      position,
      tripNote: row.dataset.tripNote || null
    };
    if (removed) {
      if (id) removals.push({ ...base, boardingStopId: row.dataset.originalMaster, departureAt: tripTimeToBerlinIso(state.trip, row.dataset.originalTime, "Die Zustiegszeit"), isActive: false });
      return;
    }
    if (!time) throw new Error("Bitte für jeden Zustieg eine Uhrzeit angeben.");
    const changed = !id || master !== row.dataset.originalMaster || time !== row.dataset.originalTime;
    if (changed) upserts.push({ ...base, isActive: true });
  });
  return { removals, upserts };
}

function tripPayload(state, values) {
  const published = state.trip.status === "PUBLISHED";
  return {
    id: state.trip.id,
    expectedRevision: Number(state.trip.revision),
    departureAt: values.departureTime ? tripTimeToBerlinIso(state.trip, values.departureTime, "Die Abfahrt") : null,
    departureInfo: state.trip.departureInfo || null,
    registrationOpensAt: values.registrationOpensAt
      ? berlinLocalToIso(values.registrationOpensAt, "Der Anmeldestart")
      : state.trip.registrationOpensAt || null,
    registrationClosesAt: values.registrationClosesAt
      ? berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende")
      : null,
    priceCents: euroInputToCents(values.price),
    capacity: state.trip.capacity,
    defaultBoardingStopId: values.defaultBoardingStopId || null,
    busPreferenceEnabled: values.busPreferenceEnabled === "on",
    privacyReference: state.trip.privacyReference || PRIVACY_REFERENCE,
    termsReference: state.trip.termsReference || TERMS_REFERENCE,
    ...(published ? {} : {})
  };
}

async function saveTrip(state, form) {
  if (!form.reportValidity()) return;
  const button = form.querySelector("button[type=submit]");
  if (button) button.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const stopPlan = collectStopPlan(state);
    await runWrite(async () => {
      await call("fanbus_trip_update", tripPayload(state, values));
      for (const payload of stopPlan.removals) await call("fanbus_trip_boarding_stop_upsert", payload);
      for (const payload of stopPlan.upserts) await call("fanbus_trip_boarding_stop_upsert", payload);
    }, "Fanbusfahrt wurde aktualisiert.");
    location.hash = "#/bus-orga";
  } catch (error) {
    showToast(error?.message || "Fanbusfahrt konnte nicht aktualisiert werden.", "error", 5200);
    if (button) button.disabled = false;
  }
}

function renderPage(root, state) {
  ensureStyle();
  const venue = String(state.trip.venue || "").trim() || "Fahrt";
  const required = state.trip.status === "PUBLISHED" ? " required" : "";
  const openField = state.trip.status === "DRAFT"
    ? `<label>Anmeldung beginnt<input name="registrationOpensAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(state.trip.registrationOpensAt))}"></label>`
    : `<label>Anmeldung geöffnet seit<input type="text" value="${escapeAttr(toBerlinInputValue(state.trip.registrationOpensAt).replace("T", " · "))}" readonly></label>`;
  root.innerHTML = `<div class="m328-trip-edit">
    <header class="m328-trip-edit-head"><button id="m328TripEditBack" class="button small ghost" type="button">← Bus-Orga</button><div class="m328-trip-edit-title"><h2>Fahrt bearbeiten • ${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header>
    <form id="m328TripEditForm" class="m328-trip-edit-actions">
      <section class="m328-trip-edit-panel"><h3>Fahrt</h3><p class="m328-trip-edit-hint">Spieltermin, Gegner und Spielort werden weiterhin zentral im Terminmodul verwaltet.</p><div class="m328-trip-edit-grid">
        <label>Abfahrt<input name="departureTime" type="time" step="60" value="${escapeAttr(toBerlinTimeInputValue(state.trip.departureAt))}"${required}></label>
        <label>Fahrtpreis<input name="price" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${escapeAttr(centsToEuroInput(state.trip.priceCents))}" placeholder="25,00"${required}></label>
        <label>Anmeldeschluss<input name="registrationClosesAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(state.trip.registrationClosesAt))}"${required}></label>
        ${openField}
        <label class="m328-trip-edit-toggle"><input name="busPreferenceEnabled" type="checkbox"${state.trip.busPreferenceEnabled === true ? " checked" : ""}><span>Buswunsch erlauben<small>Wird nur wirksam, wenn der zentrale Mehrbus-Vertrag erfüllt ist.</small></span></label>
      </div></section>
      <section class="m328-trip-edit-panel"><div class="m328-trip-edit-panel-head"><div><h3>Zustiegsorte</h3><p class="m328-trip-edit-hint">Zustiege und Uhrzeiten direkt für diese Fahrt bearbeiten.</p></div><button id="m328TripEditAddStop" class="button small secondary" type="button">＋ Zustieg</button></div><div id="m328TripEditStops" class="m328-trip-edit-stops">${state.tripStops.map(stop => stopRow(state, stop)).join("")}</div><label class="m328-trip-edit-default">Standard für diese Fahrt<select id="m328TripEditDefaultStop" name="defaultBoardingStopId"><option value="">Kein Standard</option>${state.tripStops.filter(stop => stop.isActive !== false).map(stop => `<option value="${escapeAttr(stop.boardingStopId)}"${stop.boardingStopId === state.trip.defaultBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label || "Zustiegsort")}</option>`).join("")}</select></label></section>
      <button class="button primary" type="submit">Änderungen speichern</button>
    </form>
  </div>`;
  document.getElementById("m328TripEditBack")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
  document.getElementById("m328TripEditAddStop")?.addEventListener("click", () => {
    const target = document.getElementById("m328TripEditStops");
    if (!target) return;
    target.insertAdjacentHTML("beforeend", stopRow(state, null, true));
    bindStopRows(state);
    syncDefaultStop(state);
  });
  bindStopRows(state);
  syncDefaultStop(state);
  const form = document.getElementById("m328TripEditForm");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    void saveTrip(state, form);
  });
}

export async function hydrateBusOrgaTripEdit(context = {}) {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  if (!hasCapability("fanbus.manage")) {
    root.innerHTML = '<div class="notice error">Für die Fahrtbearbeitung fehlt die erforderliche Berechtigung.</div>';
    return;
  }
  const tripId = routeParams().get("trip") || "";
  if (!tripId) {
    root.innerHTML = '<div class="notice error">Es wurde keine Fahrt ausgewählt.</div>';
    return;
  }
  root.innerHTML = loading("Fahrt wird geladen …");
  try {
    const [tripData, tripStopData, masterStopData] = await Promise.all([
      call("fanbus_trips_list"),
      call("fanbus_trip_boarding_stops_list", { tripId }),
      call("fanbus_boarding_stops_list")
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    const trip = (Array.isArray(tripData?.trips) ? tripData.trips : []).find(item => item.id === tripId);
    if (!trip || trip.canManage === false || !["DRAFT", "PUBLISHED"].includes(trip.status)) {
      throw new Error("Diese Fahrt kann aktuell nicht bearbeitet werden.");
    }
    renderPage(root, {
      trip,
      tripStops: (Array.isArray(tripStopData?.stops) ? tripStopData.stops : []).filter(stop => stop?.isActive !== false),
      masterStops: Array.isArray(masterStopData?.stops) ? masterStopData.stops : []
    });
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Fahrt konnte nicht geladen werden.")}</div><button id="m328TripEditLoadBack" class="button secondary" type="button">← Bus-Orga</button>`;
    document.getElementById("m328TripEditLoadBack")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
  }
}

export function noop() {}

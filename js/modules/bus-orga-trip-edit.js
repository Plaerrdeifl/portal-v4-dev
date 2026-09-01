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
  const label = String(stop?.label || "").trim() || (master ? "Zustiegsort" : "Neuer Zustieg");
  return `<div class="m328-trip-edit-stop" data-trip-stop-row data-new="${isNew ? "true" : "false"}" data-trip-stop-id="${escapeAttr(id)}" data-revision="${escapeAttr(stop?.revision || "")}" data-position="${escapeAttr(stop?.position || "")}" data-original-master="${escapeAttr(master)}" data-original-time="${escapeAttr(time)}" data-trip-note="${escapeAttr(stop?.tripNote || "")}">
    <div class="m328-trip-edit-stop-summary">
      <button class="m328-trip-edit-stop-main" type="button" data-stop-edit-toggle aria-expanded="${isNew ? "true" : "false"}">
        <span class="m328-trip-edit-stop-time" data-stop-summary-time>${escapeHtml(time || "--:--")}</span>
        <span class="m328-trip-edit-stop-label" data-stop-summary-label>${escapeHtml(label)}</span>
        <span class="m328-trip-edit-stop-chevron" aria-hidden="true">›</span>
      </button>
      <button class="m328-trip-edit-stop-more" type="button" data-stop-menu-toggle aria-label="Aktionen für ${escapeAttr(label)}" aria-expanded="false">⋮</button>
    </div>
    <div class="m328-trip-edit-stop-menu" data-stop-menu hidden>
      <button class="button small ghost" type="button" data-stop-edit>Bearbeiten</button>
      <button class="button small ghost danger" type="button" data-stop-remove>Löschen</button>
    </div>
    <div class="m328-trip-edit-stop-editor" data-stop-editor${isNew ? "" : " hidden"}>
      <label>Uhrzeit<input data-stop-time type="time" step="60" value="${escapeAttr(time)}"></label>
      <label>Zustiegsort<select data-stop-master>${masterOptions(state, master)}</select></label>
    </div>
  </div>`;
}

function ensureStyle() {
  if (document.getElementById("m328NativeTripEditStyle")) return;
  const style = document.createElement("style");
  style.id = "m328NativeTripEditStyle";
  style.textContent = `
    .m328-trip-edit{display:grid;gap:9px;width:100%;overflow-x:clip}.m328-trip-edit *{box-sizing:border-box;min-width:0}
    .m328-trip-edit-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:9px;padding:1px 0 9px;border-bottom:1px solid var(--line)}
    .m328-trip-edit-head>.button{width:auto!important;min-height:36px!important;padding:6px 9px!important}
    .m328-trip-edit-title{display:grid;gap:1px}.m328-trip-edit-title h2{margin:0;font-size:1.22rem;line-height:1.08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m328-trip-edit-title span{color:var(--muted);font-size:.74rem;font-weight:700}
    .m328-trip-edit-panel{display:grid;gap:8px;padding:10px 11px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .m328-trip-edit-panel h3{margin:0;font-size:1rem}.m328-trip-edit-hint{margin:0;color:var(--muted);font-size:.7rem;line-height:1.3}
    .m328-trip-edit-core-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m328-trip-edit-core-grid label{display:grid;gap:3px;font-size:.7rem;font-weight:750}.m328-trip-edit-core-grid input{width:100%;min-height:40px;padding-top:6px!important;padding-bottom:6px!important}
    .m328-trip-edit-deadline{grid-column:1/-1}.m328-trip-edit-money{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;border:1px solid var(--line);border-radius:11px;background:var(--surface)}.m328-trip-edit-money input{border:0!important;background:transparent!important;box-shadow:none!important}.m328-trip-edit-money span{padding:0 11px 0 4px;font-size:.9rem;font-weight:750;color:var(--muted)}
    .m328-trip-edit-switch-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding-top:8px;border-top:1px solid var(--line);cursor:pointer}.m328-trip-edit-switch-copy{display:grid;gap:1px}.m328-trip-edit-switch-copy strong{font-size:.78rem}.m328-trip-edit-switch-copy small{color:var(--muted);font-size:.66rem;font-weight:500;line-height:1.25}
    .m328-trip-edit-switch{position:relative;width:44px;height:26px;flex:0 0 auto}.m328-trip-edit-switch input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}.m328-trip-edit-switch-slider{position:absolute;inset:0;border-radius:999px;background:var(--line);transition:background .15s ease;pointer-events:none}.m328-trip-edit-switch-slider:after{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:var(--surface);box-shadow:0 1px 3px rgba(2,18,35,.22);transition:transform .15s ease}.m328-trip-edit-switch input:checked+.m328-trip-edit-switch-slider{background:var(--blue-700)}.m328-trip-edit-switch input:checked+.m328-trip-edit-switch-slider:after{transform:translateX(18px)}.m328-trip-edit-switch input:focus-visible+.m328-trip-edit-switch-slider{outline:2px solid var(--blue-700);outline-offset:2px}
    .m328-trip-edit-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.m328-trip-edit-panel-head>.button{width:auto!important;min-height:36px!important;padding:6px 10px!important}
    .m328-trip-edit-stops{display:grid;border-top:1px solid var(--line)}.m328-trip-edit-stop{display:grid;border-bottom:1px solid var(--line);background:transparent}.m328-trip-edit-stop:last-child{border-bottom:0}
    .m328-trip-edit-stop-summary{display:grid;grid-template-columns:minmax(0,1fr) 34px;align-items:center;gap:4px}.m328-trip-edit-stop-main{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;min-height:42px;padding:5px 2px;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer}.m328-trip-edit-stop-time{font-weight:850;font-variant-numeric:tabular-nums}.m328-trip-edit-stop-label{font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m328-trip-edit-stop-chevron{font-size:1.25rem;color:var(--muted);transition:transform .15s ease}.m328-trip-edit-stop-main[aria-expanded="true"] .m328-trip-edit-stop-chevron{transform:rotate(90deg)}
    .m328-trip-edit-stop-more{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:9px;background:transparent;color:var(--text);font-size:1.25rem;font-weight:800;cursor:pointer}.m328-trip-edit-stop-more:focus-visible,.m328-trip-edit-stop-main:focus-visible{outline:2px solid var(--blue-700);outline-offset:2px}
    .m328-trip-edit-stop-menu{display:flex;justify-content:flex-end;gap:6px;padding:0 0 6px}.m328-trip-edit-stop-menu .button{width:auto!important;min-height:32px!important;padding:4px 9px!important;font-size:.7rem}.m328-trip-edit-stop-menu .danger{color:var(--danger,#b42318)}
    .m328-trip-edit-stop-editor{display:grid;grid-template-columns:minmax(126px,.78fr) minmax(0,1.22fr);gap:10px;padding:0 0 8px}.m328-trip-edit-stop-editor label{display:grid;gap:3px;min-width:0;overflow:hidden;font-size:.67rem;font-weight:750}.m328-trip-edit-stop-editor select,.m328-trip-edit-stop-editor input{display:block;width:100%!important;max-width:100%!important;min-width:0!important;min-height:38px;padding-top:5px!important;padding-bottom:5px!important;box-sizing:border-box!important}
    .m328-trip-edit-stop.is-removed{opacity:.52}.m328-trip-edit-stop.is-removed .m328-trip-edit-stop-main{cursor:default}.m328-trip-edit-stop.is-removed .m328-trip-edit-stop-label{text-decoration:line-through}.m328-trip-edit-stop.is-removed select,.m328-trip-edit-stop.is-removed input{pointer-events:none}
    .m328-trip-edit-default{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,46%);align-items:center;gap:10px;padding-top:7px;border-top:1px solid var(--line);font-size:.72rem;font-weight:800}.m328-trip-edit-default select{width:100%;min-height:38px;padding-top:5px!important;padding-bottom:5px!important}
    .m328-trip-edit-actions{display:grid;grid-template-columns:1fr;gap:8px}.m328-trip-edit-savebar{position:sticky;bottom:6px;z-index:12;padding:5px;border-radius:14px;background:color-mix(in srgb,var(--surface) 90%,transparent);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}.m328-trip-edit-savebar .button{width:100%;min-height:44px}
    @media(max-width:350px){.m328-trip-edit-stop-editor{grid-template-columns:1fr;gap:7px}}
    @media(max-width:390px){.m328-trip-edit-core-grid{gap:6px}.m328-trip-edit-stop-main{grid-template-columns:58px minmax(0,1fr) auto;gap:6px}.m328-trip-edit-default{grid-template-columns:minmax(0,1fr) minmax(120px,48%)}}
  `;
  document.head.appendChild(style);
}

function syncStopSummary(row) {
  const master = row.querySelector("[data-stop-master]");
  const time = row.querySelector("[data-stop-time]")?.value || "--:--";
  const label = master?.selectedOptions?.[0]?.textContent?.trim() || "Neuer Zustieg";
  const timeTarget = row.querySelector("[data-stop-summary-time]");
  const labelTarget = row.querySelector("[data-stop-summary-label]");
  const menuToggle = row.querySelector("[data-stop-menu-toggle]");
  if (timeTarget) timeTarget.textContent = time;
  if (labelTarget) labelTarget.textContent = label;
  if (menuToggle) menuToggle.setAttribute("aria-label", `Aktionen für ${label}`);
}

function setStopEditor(row, open) {
  if (row.dataset.removed === "true") open = false;
  const editor = row.querySelector("[data-stop-editor]");
  const toggle = row.querySelector("[data-stop-edit-toggle]");
  if (editor) editor.hidden = !open;
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setStopMenu(row, open) {
  const menu = row.querySelector("[data-stop-menu]");
  const toggle = row.querySelector("[data-stop-menu-toggle]");
  if (menu) menu.hidden = !open;
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
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
    syncStopSummary(row);

    row.querySelector("[data-stop-edit-toggle]")?.addEventListener("click", () => {
      if (row.dataset.removed === "true") return;
      const open = row.querySelector("[data-stop-editor]")?.hidden !== false;
      setStopMenu(row, false);
      setStopEditor(row, open);
    });

    row.querySelector("[data-stop-menu-toggle]")?.addEventListener("click", () => {
      const open = row.querySelector("[data-stop-menu]")?.hidden !== false;
      setStopMenu(row, open);
    });

    row.querySelector("[data-stop-edit]")?.addEventListener("click", () => {
      setStopMenu(row, false);
      setStopEditor(row, true);
      row.querySelector("[data-stop-time]")?.focus();
    });

    row.querySelector("[data-stop-master]")?.addEventListener("change", () => {
      syncStopSummary(row);
      syncDefaultStop(state);
    });
    row.querySelector("[data-stop-time]")?.addEventListener("input", () => syncStopSummary(row));

    row.querySelector("[data-stop-remove]")?.addEventListener("click", event => {
      if (row.dataset.new === "true") {
        row.remove();
      } else {
        const removed = row.dataset.removed === "true";
        row.dataset.removed = removed ? "false" : "true";
        row.classList.toggle("is-removed", !removed);
        event.currentTarget.textContent = removed ? "Löschen" : "Rückgängig";
        setStopEditor(row, false);
        setStopMenu(row, false);
      }
      syncDefaultStop(state);
    });

    if (row.dataset.new === "true") setStopEditor(row, true);
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
  return {
    id: state.trip.id,
    expectedRevision: Number(state.trip.revision),
    departureAt: values.departureTime ? tripTimeToBerlinIso(state.trip, values.departureTime, "Die Abfahrt") : null,
    departureInfo: state.trip.departureInfo || null,
    registrationClosesAt: values.registrationClosesAt
      ? berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende")
      : null,
    priceCents: euroInputToCents(values.price),
    capacity: state.trip.capacity,
    defaultBoardingStopId: values.defaultBoardingStopId || null,
    busPreferenceEnabled: values.busPreferenceEnabled === "on",
    privacyReference: state.trip.privacyReference || PRIVACY_REFERENCE,
    termsReference: state.trip.termsReference || TERMS_REFERENCE
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
  root.innerHTML = `<div class="m328-trip-edit">
    <header class="m328-trip-edit-head"><button id="m328TripEditBack" class="button small ghost" type="button">← Bus-Orga</button><div class="m328-trip-edit-title"><h2>${escapeHtml(venue)}</h2><span>${escapeHtml(shortDate(state.trip.eventDate))} · ${escapeHtml(eventTime(state.trip.eventTime))}</span></div></header>
    <form id="m328TripEditForm" class="m328-trip-edit-actions">
      <section class="m328-trip-edit-panel">
        <h3>Fahrt</h3>
        <div class="m328-trip-edit-core-grid">
          <label>Abfahrt<input name="departureTime" type="time" step="60" value="${escapeAttr(toBerlinTimeInputValue(state.trip.departureAt))}"${required}></label>
          <label>Fahrtpreis<span class="m328-trip-edit-money"><input name="price" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${escapeAttr(centsToEuroInput(state.trip.priceCents))}" placeholder="25,00"${required}><span aria-hidden="true">€</span></span></label>
          <label class="m328-trip-edit-deadline">Anmeldeschluss<input name="registrationClosesAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(state.trip.registrationClosesAt))}"${required}></label>
        </div>
        <label class="m328-trip-edit-switch-row">
          <span class="m328-trip-edit-switch-copy"><strong>Buswunsch erlauben</strong><small>Nur relevant, wenn mehrere Busse verfügbar sind.</small></span>
          <span class="m328-trip-edit-switch"><input name="busPreferenceEnabled" type="checkbox"${state.trip.busPreferenceEnabled === true ? " checked" : ""}><span class="m328-trip-edit-switch-slider" aria-hidden="true"></span></span>
        </label>
      </section>
      <section class="m328-trip-edit-panel">
        <div class="m328-trip-edit-panel-head"><h3>Zustiegsorte</h3><button id="m328TripEditAddStop" class="button small secondary" type="button">＋ Hinzufügen</button></div>
        <div id="m328TripEditStops" class="m328-trip-edit-stops">${state.tripStops.map(stop => stopRow(state, stop)).join("")}</div>
        <label class="m328-trip-edit-default"><span>Standardzustieg</span><select id="m328TripEditDefaultStop" name="defaultBoardingStopId"><option value="">Kein Standard</option>${state.tripStops.filter(stop => stop.isActive !== false).map(stop => `<option value="${escapeAttr(stop.boardingStopId)}"${stop.boardingStopId === state.trip.defaultBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label || "Zustiegsort")}</option>`).join("")}</select></label>
      </section>
      <div class="m328-trip-edit-savebar"><button class="button primary" type="submit">Speichern</button></div>
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

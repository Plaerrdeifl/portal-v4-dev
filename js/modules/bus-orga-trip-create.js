import {
  call,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  runWrite,
  showToast
} from "./common.js";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

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

function eventLabel(event) {
  const venue = String(event?.venue || "").trim() || "Spielort noch offen";
  return `${formatDate(event?.eventDate)} · ${formatTime(event?.eventTime)} · ${venue}`;
}

function ensureStyle() {
  if (document.getElementById("m328TripCreateStyle")) return;
  const style = document.createElement("style");
  style.id = "m328TripCreateStyle";
  style.textContent = `
    .m328-trip-create{display:grid;gap:12px;width:100%;overflow-x:clip}.m328-trip-create *{box-sizing:border-box;min-width:0}
    .m328-trip-create-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--line)}
    .m328-trip-create-head h2{margin:0;font-size:1.3rem;line-height:1.15}.m328-trip-create-head p{margin:3px 0 0;color:var(--muted);font-size:.78rem;line-height:1.35}
    .m328-trip-create-panel{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}
    .m328-trip-create-panel h3{margin:0;font-size:1rem}
    .m328-trip-create-events{display:grid;gap:8px}
    .m328-trip-create-event{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer}
    .m328-trip-create-event strong{display:block;font-size:.9rem;line-height:1.25}.m328-trip-create-event small{display:block;margin-top:2px;color:var(--muted);font-size:.72rem}
    .m328-trip-create-event input{position:absolute;opacity:0;pointer-events:none}.m328-trip-create-event-mark{display:grid;place-items:center;width:25px;height:25px;border:2px solid var(--line-strong,var(--line));border-radius:999px;background:var(--surface)}
    .m328-trip-create-event:has(input:checked){border-color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,var(--surface))}.m328-trip-create-event:has(input:checked) .m328-trip-create-event-mark{border:7px solid var(--primary)}
    .m328-trip-create-actions{display:flex;justify-content:flex-end}.m328-trip-create-actions .button{min-height:42px}
    @media(max-width:520px){.m328-trip-create-head{gap:8px}.m328-trip-create-head>.button{padding-inline:9px;font-size:.76rem}.m328-trip-create-head h2{font-size:1.12rem}.m328-trip-create-panel{padding:10px}.m328-trip-create-actions .button{width:100%}}
  `;
  document.head.appendChild(style);
}

function render(root, events) {
  ensureStyle();
  root.innerHTML = `<div class="m328-trip-create">
    <header class="m328-trip-create-head">
      <button class="button small ghost" type="button" data-m328-trip-create-back>← Bus-Orga</button>
      <div><h2>Fahrt anlegen</h2><p>Vorhandenen Termin auswählen. Die Fanbusfahrt wird anschließend mit den hinterlegten Server-Standards als Entwurf angelegt.</p></div>
    </header>
    <form class="m328-trip-create-panel" data-m328-trip-create-form>
      <h3>Termin auswählen</h3>
      <div class="m328-trip-create-events">
        ${events.map((event, index) => `<label class="m328-trip-create-event">
          <input type="radio" name="eventId" value="${escapeAttr(event.id)}"${index === 0 ? " checked" : ""}>
          <span><strong>${escapeHtml(String(event.venue || "Spielort noch offen"))}</strong><small>${escapeHtml(`${formatDate(event.eventDate)} · ${formatTime(event.eventTime)}`)}</small></span>
          <span class="m328-trip-create-event-mark" aria-hidden="true"></span>
        </label>`).join("")}
      </div>
      <div class="m328-trip-create-actions"><button class="button primary" type="submit">Entwurf anlegen</button></div>
    </form>
  </div>`;

  root.querySelector("[data-m328-trip-create-back]")?.addEventListener("click", () => {
    location.hash = "#/bus-orga";
  });

  root.querySelector("[data-m328-trip-create-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const eventId = String(new FormData(form).get("eventId") || "");
    if (!events.some(item => item.id === eventId)) {
      showToast("Bitte wähle einen Termin aus.", "error", 4200);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await runWrite(
        () => call("fanbus_trip_create", { eventId }),
        "Fanbusfahrt wurde als Entwurf angelegt."
      );
      location.hash = "#/bus-orga";
    } catch (error) {
      showToast(error?.message || "Fanbusfahrt konnte nicht angelegt werden.", "error", 5200);
      if (submit) submit.disabled = false;
    }
  });
}

export async function hydrateBusOrgaTripCreate(context = {}) {
  const root = document.getElementById("m328BusOrgaPage");
  if (!root) return;
  if (!hasCapability("fanbus.manage")) {
    root.innerHTML = '<div class="notice error">Für das Anlegen einer Fanbusfahrt fehlt die erforderliche Berechtigung.</div>';
    return;
  }
  root.innerHTML = loading("Verfügbare Termine werden geladen …");
  try {
    const data = await call("fanbus_available_events");
    if (context.isCurrent && !context.isCurrent()) return;
    const events = (Array.isArray(data?.events) ? data.events : [])
      .slice()
      .sort((left, right) => `${left.eventDate || ""} ${left.eventTime || ""}`.localeCompare(`${right.eventDate || ""} ${right.eventTime || ""}`));
    if (!events.length) {
      root.innerHTML = `<div class="m328-trip-create"><header class="m328-trip-create-head"><button class="button small ghost" type="button" data-m328-trip-create-back>← Bus-Orga</button><div><h2>Fahrt anlegen</h2></div></header><div class="notice">Es ist aktuell kein kommender Termin ohne Fanbusfahrt verfügbar.</div></div>`;
      root.querySelector("[data-m328-trip-create-back]")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
      return;
    }
    render(root, events);
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    root.innerHTML = `<div class="notice error">${escapeHtml(error?.message || "Verfügbare Termine konnten nicht geladen werden.")}</div><button class="button secondary" type="button" data-m328-trip-create-back>← Bus-Orga</button>`;
    root.querySelector("[data-m328-trip-create-back]")?.addEventListener("click", () => { location.hash = "#/bus-orga"; });
  }
}

export function noop() {}

import { call, escapeAttr, escapeHtml } from "./common.js";

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

const BUS_PREFERENCES = Object.freeze([
  { value: "EGAL", label: "Egal" },
  { value: "RUHIG", label: "Ruhig" },
  { value: "PARTY", label: "Party" }
]);

export const ASSIGNMENT_WARNING_LABELS = Object.freeze({
  BOOKING_ALREADY_SPLIT_FIXED: "Buchung ist durch bestehende Zuordnungen bereits aufgeteilt.",
  BOOKING_SPLIT_REQUIRED: "Buchung kann nicht vollständig in einem Bus bleiben.",
  PREFERENCE_MISMATCH: "Buswunsch kann nicht vollständig erfüllt werden.",
  STOP_NO_COMPATIBLE_BUS: "Kein Bus bedient den erforderlichen Zustieg.",
  NO_CAPACITY: "Keine passende freie Buskapazität vorhanden.",
  FIXED_CAPACITY_OVERFLOW: "Bestehende Zuordnungen überschreiten bereits die Buskapazität.",
  EXISTING_ASSIGNMENT_INVALID_BUS: "Eine bestehende Zuordnung verweist auf einen ungültigen Bus.",
  EXISTING_ASSIGNMENT_STOP_INVALID: "Eine bestehende Zuordnung passt nicht zur Zustiegsstelle."
});

export function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

export function navigate(view, tripId) {
  const params = new URLSearchParams({ view, trip: String(tripId || "") });
  location.hash = `#/bus-orga?${params}`;
}

export function backToBusOrga() {
  location.hash = "#/bus-orga";
}

export function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "Termin offen");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? String(value) : DATE_FORMAT.format(date);
}

export function formatTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
}

export function formatDateTime(value) {
  if (!value) return "Noch nicht festgelegt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Noch nicht festgelegt" : `${DATE_TIME_FORMAT.format(date)} Uhr`;
}

export function formatBoardingTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin"
  }).format(date);
}

export function tripVenue(trip) {
  return String(trip?.venue || trip?.opponentName || trip?.displayTitle || "Fanbusfahrt").trim() || "Fanbusfahrt";
}

export function statusLabel(value) {
  return {
    ACTIVE: "Bestätigt",
    WAITLISTED: "Warteliste",
    CANCELLED: "Storniert"
  }[value] || value || "–";
}

export function statusBadge(value) {
  const type = value === "ACTIVE" ? "success" : value === "WAITLISTED" ? "warning" : "neutral";
  return `<span class="badge ${type}">${escapeHtml(statusLabel(value))}</span>`;
}

export function sourceLabel(value) {
  return {
    PORTAL: "Portal",
    GUEST: "Gast",
    MANUAL: "Bus-Orga"
  }[value] || value || "–";
}

export function busPreferenceLabel(value) {
  return {
    EGAL: "Egal",
    RUHIG: "Ruhig",
    PARTY: "Party"
  }[value] || value || "–";
}

export function busCategoryLabel(value) {
  return {
    NORMAL: "Standard",
    RUHIG: "Ruhig",
    PARTY: "Partybus"
  }[value] || value || "Bus";
}

export function preferenceOptions(selected = "EGAL") {
  return BUS_PREFERENCES.map(option => (
    `<option value="${option.value}"${option.value === String(selected || "EGAL") ? " selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");
}

function workspaceHeader(title, trip, subtitle = "") {
  const venue = tripVenue(trip);
  return `<header class="m328-workspace-head">
    <button class="button small ghost" type="button" data-m328-workspace-back>← Bus-Orga</button>
    <div class="m328-workspace-title">
      <span>${escapeHtml(formatDate(trip.eventDate))} · ${escapeHtml(formatTime(trip.eventTime))}</span>
      <h2>${escapeHtml(title)}</h2>
      <small>${escapeHtml(subtitle || venue)}</small>
    </div>
  </header>`;
}

export function workspacePage(title, trip, content, { className = "", subtitle = "" } = {}) {
  return `<div class="m328-trip-workspace ${escapeAttr(className)}">
    ${workspaceHeader(title, trip, subtitle)}
    ${content}
  </div>`;
}

export function bindWorkspaceBack(root) {
  root.querySelector("[data-m328-workspace-back]")?.addEventListener("click", backToBusOrga);
}

export async function loadTrip(tripId) {
  const data = await call("fanbus_trips_list");
  const trip = (Array.isArray(data?.trips) ? data.trips : []).find(item => item.id === tripId);
  if (!trip) throw new Error("Diese Fahrt ist nicht verfügbar oder darf nicht geöffnet werden.");
  return trip;
}

export function ensureWorkspaceStyle() {
  if (document.getElementById("m328TripWorkspacesStyle")) return;
  const style = document.createElement("style");
  style.id = "m328TripWorkspacesStyle";
  style.textContent = `
    .m328-trip-workspace{display:grid;gap:10px;width:100%;max-width:100%;overflow-x:clip}.m328-trip-workspace *{box-sizing:border-box;min-width:0}
    .m328-workspace-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:2px 0 10px;border-bottom:1px solid var(--line)}
    .m328-workspace-title{display:grid;gap:1px}.m328-workspace-title>span{color:var(--muted);font-size:.72rem;font-weight:750}.m328-workspace-title h2{margin:0;font-size:1.24rem;line-height:1.12;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m328-workspace-title small{color:var(--muted);font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m328-workspace-panel{display:grid;gap:9px;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.m328-workspace-panel>h3{margin:0;font-size:.95rem}
    .m328-workspace-toolbar{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap}.m328-workspace-toolbar .button{min-height:38px}
    .m328-workspace-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center}.m328-workspace-search input{width:100%;min-height:40px}
    .m328-workspace-count{color:var(--muted);font-size:.7rem;font-weight:750;white-space:nowrap}
    .m328-participant-list,.m328-occupancy-list,.m328-operation-list{display:grid;gap:7px}
    .m328-participant-card,.m328-occupancy-card,.m328-operation-card{position:relative;display:grid;gap:5px;width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit;text-align:left}
    .m328-participant-card[role="button"],.m328-occupancy-card[role="button"]{cursor:pointer}.m328-participant-card[role="button"]:active,.m328-occupancy-card[role="button"]:active{background:var(--surface-2)}
    .m328-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:8px}.m328-card-head strong{font-size:.82rem;line-height:1.2}.m328-card-meta{display:flex;flex-wrap:wrap;gap:3px 7px;color:var(--muted);font-size:.66rem;line-height:1.3}.m328-card-meta strong{color:var(--ink-700);font-size:inherit}
    .m328-card-chevron{position:absolute;right:9px;bottom:8px;color:var(--muted);font-size:1.12rem;font-weight:900}
    .m328-participant-card[role="button"] .m328-card-meta,.m328-occupancy-card[role="button"] .m328-card-meta{padding-right:18px}
    .m328-participant-filters{margin:0}.m328-participant-filters>summary{width:max-content;min-height:34px;padding:6px 10px;font-size:.72rem;list-style:none}.m328-participant-filters>summary::-webkit-details-marker{display:none}.m328-participant-filter-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:7px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface-2)}.m328-participant-filter-body label{font-size:.68rem}.m328-participant-filter-body select{width:100%;min-height:38px}
    .m328-dialog-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m328-dialog-facts>div{display:grid;gap:2px;padding:8px;border-radius:10px;background:var(--surface-2)}.m328-dialog-facts span{color:var(--muted);font-size:.66rem;font-weight:750;text-transform:uppercase}.m328-dialog-facts strong{font-size:.78rem;line-height:1.3}.m328-dialog-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.m328-dialog-actions .button{width:100%;min-height:40px}
    .m328-identity-actions{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--line)}.m328-identity-actions h3{margin:0;font-size:.9rem}.m328-identity-search-results{display:grid;gap:6px;max-height:220px;overflow-y:auto}.m328-identity-search-results .button{justify-content:flex-start;width:100%}
    .m328-occupancy-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.m328-occupancy-summary span,.m328-operation-counters span{display:grid;gap:1px;padding:8px;border-radius:10px;background:var(--surface-2);color:var(--muted);font-size:.62rem;text-align:center}.m328-occupancy-summary strong,.m328-operation-counters strong{color:var(--ink-900);font-size:.92rem}
    .m328-auto-assignment{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;padding:10px 11px;border:1px solid color-mix(in srgb,var(--blue-700) 45%,var(--line));border-radius:12px;background:color-mix(in srgb,var(--blue-050) 80%,var(--surface));color:var(--ink-900);text-align:left;cursor:pointer}.m328-auto-assignment strong{display:block;font-size:.8rem}.m328-auto-assignment small{display:block;margin-top:2px;color:var(--muted);font-size:.66rem;line-height:1.3}.m328-auto-assignment span:last-child{color:var(--blue-700);font-size:1.2rem;font-weight:900}
    .m328-occupancy-card .m328-card-head>span{font-size:.7rem;font-weight:800;white-space:nowrap}.m328-occupancy-stops{margin:0;color:var(--muted);font-size:.67rem;line-height:1.35}.m328-occupancy-stops strong{color:var(--ink-700)}
    .m328-assignment-preview{display:grid;gap:14px}.m328-assignment-summary{display:grid;gap:4px;padding:9px;border-radius:11px;background:var(--surface-2)}.m328-assignment-summary strong{font-size:.9rem}.m328-assignment-summary small{color:var(--muted)}.m328-assignment-buses,.m328-assignment-proposals{display:grid;gap:6px}.m328-assignment-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}.m328-assignment-row:last-child{border-bottom:0}.m328-assignment-row small{display:block;color:var(--muted);font-size:.66rem}.m328-assignment-proposal{display:grid;gap:7px;padding:9px;border:1px solid var(--line);border-radius:11px}.m328-assignment-proposal select{width:100%}.m328-assignment-warning{margin:0!important;font-size:.72rem}
    .m328-operation-counters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.m328-operation-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.m328-operation-filters label:first-child{grid-column:1/-1}.m328-operation-filters label{font-size:.68rem}.m328-operation-filters input,.m328-operation-filters select{width:100%;min-height:39px}.m328-operation-card{grid-template-columns:minmax(0,1fr) auto;align-items:center}.m328-operation-copy strong{display:block;font-size:.8rem}.m328-operation-copy small{display:block;margin-top:2px;color:var(--muted);font-size:.66rem;line-height:1.35}.m328-operation-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.m328-operation-actions .button{width:100%;min-height:34px;padding:5px 7px;font-size:.66rem}
    @media(max-width:520px){.m328-workspace-toolbar{align-items:stretch}.m328-workspace-toolbar>.button{flex:1}.m328-workspace-search{grid-template-columns:1fr}.m328-workspace-count{justify-self:start}.m328-participant-filter-body{grid-template-columns:1fr 1fr}.m328-dialog-facts{grid-template-columns:1fr 1fr}.m328-operation-filters{grid-template-columns:1fr 1fr}.m328-operation-filters label:first-child{grid-column:1/-1}.m328-operation-filters label:last-child{grid-column:1/-1}}
    @media(max-width:360px){.m328-participant-filter-body,.m328-dialog-facts,.m328-dialog-actions,.m328-operation-filters{grid-template-columns:1fr}.m328-operation-filters label:first-child,.m328-operation-filters label:last-child{grid-column:auto}.m328-occupancy-summary,.m328-operation-counters{grid-template-columns:repeat(2,minmax(0,1fr))}.m328-operation-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

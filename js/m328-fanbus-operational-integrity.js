import { api } from "./api.js";
import {
  closeAllDialogs,
  escapeAttr,
  escapeHtml,
  fmtDateTime,
  openDialog,
  runWrite,
  showToast
} from "./modules/common.js";
import {
  buildOperationalBookingContexts,
  fanbusBookingKey,
  fanbusPersonName,
  isCurrentFanbusRegistration,
  operationalBookingCountLabel,
  operationalBookingRoleLabel,
  operationalGroupLabel
} from "./modules/fanbus-operational-integrity.js";

let syncKey = "";
let syncPromise = null;
let lastData = null;
let scheduled = false;

function routeState() {
  const [path, query = ""] = String(location.hash || "").split("?", 2);
  const params = new URLSearchParams(query);
  return { path, view: params.get("view") || "", tripId: params.get("trip") || "" };
}

function ensureStyle() {
  if (document.getElementById("m328FanbusOperationalIntegrityStyle")) return;
  const style = document.createElement("style");
  style.id = "m328FanbusOperationalIntegrityStyle";
  style.textContent = `
    .m328-duplicate-review-panel{display:grid;gap:8px}.m328-duplicate-review-panel .button-row{justify-content:flex-start;flex-wrap:wrap}
    .m328-duplicate-marker{margin-top:5px}.m328-duplicate-marker .badge{white-space:normal;text-align:left}
    .m328-duplicate-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .m328-duplicate-review-card{display:grid;gap:5px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)}
    .m328-duplicate-review-card h3{margin:0;font-size:.9rem}.m328-duplicate-review-card dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 8px;margin:0;font-size:.72rem}.m328-duplicate-review-card dt{color:var(--muted)}.m328-duplicate-review-card dd{margin:0;font-weight:750;overflow-wrap:anywhere}
    .m328-duplicate-review-actions{display:grid;gap:8px;margin-top:10px}.m328-duplicate-review-actions .button-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.m328-duplicate-review-actions .button{width:100%}
    @media(max-width:520px){.m328-duplicate-review-grid{grid-template-columns:1fr}.m328-duplicate-review-actions .button-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function sourceLabel(value) {
  return { PORTAL: "Portal", GUEST: "Homepage/Gast", MANUAL: "Bus-Orga" }[String(value || "").toUpperCase()] || String(value || "–");
}

function statusLabel(value) {
  return { ACTIVE: "Aktiv", WAITLISTED: "Warteliste", CANCELLED: "Storniert" }[String(value || "").toUpperCase()] || String(value || "–");
}

function pairIds(candidate) {
  return [String(candidate?.registrationAId || ""), String(candidate?.registrationBId || "")].filter(Boolean);
}

function registrationsById(registrations) {
  return new Map(registrations.map(item => [String(item?.id || ""), item]));
}

function applyParticipantGroups(registrations) {
  const contexts = buildOperationalBookingContexts(registrations);
  const byId = registrationsById(registrations);
  document.querySelectorAll(".m328-participants [data-m328-participant-id]").forEach(card => {
    const registration = byId.get(String(card.dataset.m328ParticipantId || ""));
    if (!registration || !isCurrentFanbusRegistration(registration)) return;
    const context = contexts.get(fanbusBookingKey(registration));
    const role = operationalBookingRoleLabel(registration, context);
    const roleTarget = card.querySelector(".m328-card-meta span:first-child");
    if (roleTarget && roleTarget.textContent !== role) roleTarget.textContent = role;

    const label = operationalGroupLabel(context);
    let marker = card.querySelector(".m328-participant-group");
    if (!label) {
      marker?.remove();
      return;
    }
    if (!marker) {
      marker = document.createElement("div");
      marker.className = "m328-participant-group";
      card.querySelector(".m328-card-head")?.insertAdjacentElement("afterend", marker);
    }
    if (marker.textContent?.trim() !== label) marker.innerHTML = `<span class="badge neutral">${escapeHtml(label)}</span>`;
  });
}

function replaceRolePrefix(text, role) {
  const raw = String(text || "");
  const prefix = /^(?:Gruppenbuchung · \d+ Personen|Mitfahrer · Gruppe [^·]+|Einzelbuchung)(?: · )?/u;
  if (prefix.test(raw)) return raw.replace(prefix, `${role} · `).replace(/ · $/, "");
  const separator = raw.indexOf(" · ");
  return separator < 0 ? role : `${role} · ${raw.slice(separator + 3)}`;
}

function applyBookingGroups(registrations) {
  const contexts = buildOperationalBookingContexts(registrations);
  const grouped = new Map();
  registrations.forEach(registration => {
    const key = fanbusBookingKey(registration);
    const list = grouped.get(key) || [];
    list.push(registration);
    grouped.set(key, list);
  });

  for (const [bookingId, all] of grouped) {
    const card = document.querySelector(`.m328-booking-card[data-booking-card="${CSS.escape(bookingId)}"]`);
    if (!card) continue;
    const context = contexts.get(bookingId);
    const count = operationalBookingCountLabel(context);
    const countTarget = card.querySelector(".m328-booking-meta span:first-child");
    if (countTarget && countTarget.textContent !== count) countTarget.textContent = count;

    const sorted = [...all].sort((a, b) => Number(a?.participantSequence || 0) - Number(b?.participantSequence || 0));
    [...card.querySelectorAll(".m328-booking-person")].forEach((row, index) => {
      const registration = sorted[index];
      if (!registration || !isCurrentFanbusRegistration(registration)) return;
      const target = row.querySelector("small");
      if (!target) return;
      const next = replaceRolePrefix(target.textContent, operationalBookingRoleLabel(registration, context));
      if (target.textContent !== next) target.textContent = next;
    });
  }
}

function duplicateCard(registration) {
  return `<article class="m328-duplicate-review-card"><h3>${escapeHtml(fanbusPersonName(registration))}</h3><dl>
    <dt>Buchung</dt><dd>${escapeHtml(registration?.bookingNumber || "–")}</dd>
    <dt>Rolle</dt><dd>${escapeHtml(registration?.bookingRole === "COMPANION" ? "Mitfahrer" : "Hauptperson")}</dd>
    <dt>Quelle</dt><dd>${escapeHtml(sourceLabel(registration?.source))}</dd>
    <dt>Status</dt><dd>${escapeHtml(statusLabel(registration?.status))}</dd>
    <dt>Bus</dt><dd>${escapeHtml(registration?.busLabel || "Nicht zugeordnet")}</dd>
    <dt>Angemeldet</dt><dd>${escapeHtml(fmtDateTime(registration?.registeredAt))}</dd>
  </dl></article>`;
}

function openParticipant(registrationId) {
  closeAllDialogs();
  requestAnimationFrame(() => document.querySelector(`.m328-participants [data-m328-participant-id="${CSS.escape(String(registrationId || ""))}"]`)?.click());
}

function openDuplicateReview(candidate, registrations) {
  const byId = registrationsById(registrations);
  const [firstId, secondId] = pairIds(candidate);
  const first = byId.get(firstId);
  const second = byId.get(secondId);
  if (!first || !second) {
    showToast("Die beiden Anmeldungen konnten nicht vollständig geladen werden.", "error", 5200);
    return;
  }

  const dialog = openDialog({
    title: "Mögliche Doppelanmeldung",
    kicker: "Bus-Orga · Prüfung",
    body: `<p class="subtle">Der Name stimmt überein, die technische Identität ist aber nicht eindeutig. Bitte prüfe beide Anmeldungen manuell.</p>
      <div class="m328-duplicate-review-grid">${duplicateCard(first)}${duplicateCard(second)}</div>
      <div class="m328-duplicate-review-actions"><div class="button-row">
        <button class="button secondary" type="button" data-m328-open-duplicate="${escapeAttr(first.id)}">${escapeHtml(first.bookingNumber || "Anmeldung 1")} öffnen</button>
        <button class="button secondary" type="button" data-m328-open-duplicate="${escapeAttr(second.id)}">${escapeHtml(second.bookingNumber || "Anmeldung 2")} öffnen</button>
      </div><p class="subtle">Sind es zwei verschiedene Personen, kann die Warnung dauerhaft als geprüft markiert werden. Ist es dieselbe Person, öffne die falsche Anmeldung und storniere sie; die verbleibende Gastteilnahme kann anschließend bei Bedarf mit dem Portaluser verknüpft werden.</p>
      <button class="button primary" type="button" data-m328-not-duplicate>Kein Duplikat – als geprüft markieren</button></div>`
  });

  dialog.querySelectorAll("[data-m328-open-duplicate]").forEach(button => button.addEventListener("click", () => openParticipant(button.dataset.m328OpenDuplicate)));
  dialog.querySelector("[data-m328-not-duplicate]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await runWrite(() => api.call("fanbus_duplicate_review_resolve", {
        registrationAId: first.id,
        registrationBId: second.id,
        decision: "NOT_DUPLICATE"
      }), "Prüfung gespeichert. Die Warnung wird nicht erneut angezeigt.");
      closeAllDialogs();
      syncKey = "";
      lastData = null;
      scheduleSync();
    } catch (error) {
      button.disabled = false;
      showToast(error?.message || "Die Prüfung konnte nicht gespeichert werden.", "error", 5200);
    }
  });
}

function duplicateReviewSignature(candidates) {
  return candidates
    .map(candidate => pairIds(candidate).sort().join(":"))
    .filter(Boolean)
    .sort()
    .join("|");
}

function syncDuplicateMarkers(candidates) {
  const expectedIds = new Set(candidates.flatMap(candidate => pairIds(candidate)));
  document.querySelectorAll("[data-m328-duplicate-marker]").forEach(marker => {
    const card = marker.closest("[data-m328-participant-id]");
    if (!card || !expectedIds.has(String(card.dataset.m328ParticipantId || ""))) marker.remove();
  });
  expectedIds.forEach(id => {
    const card = document.querySelector(`.m328-participants [data-m328-participant-id="${CSS.escape(id)}"]`);
    if (!card || card.querySelector("[data-m328-duplicate-marker]")) return;
    const marker = document.createElement("div");
    marker.className = "m328-duplicate-marker";
    marker.dataset.m328DuplicateMarker = "";
    marker.innerHTML = '<span class="badge warning">⚠ Mögliche Doppelanmeldung</span>';
    card.querySelector(".m328-card-head")?.insertAdjacentElement("afterend", marker);
  });
}

function renderDuplicateReview(data, registrations) {
  const candidates = Array.isArray(data?.duplicateCandidates) ? data.duplicateCandidates : [];
  const signature = duplicateReviewSignature(candidates);
  const existingPanel = document.querySelector("[data-m328-duplicate-review-panel]");

  if (!candidates.length) {
    existingPanel?.remove();
    document.querySelectorAll("[data-m328-duplicate-marker]").forEach(node => node.remove());
    return;
  }

  syncDuplicateMarkers(candidates);
  if (existingPanel?.dataset.m328DuplicateReviewSignature === signature) return;
  existingPanel?.remove();

  const target = document.querySelector(".m328-participants .m328-workspace-panel");
  if (!target) return;
  const panel = document.createElement("div");
  panel.className = "notice warning m328-duplicate-review-panel";
  panel.dataset.m328DuplicateReviewPanel = "";
  panel.dataset.m328DuplicateReviewSignature = signature;
  panel.innerHTML = `<strong>⚠ ${candidates.length} ${candidates.length === 1 ? "mögliche Doppelanmeldung" : "mögliche Doppelanmeldungen"} prüfen</strong><div class="button-row"></div>`;
  const actions = panel.querySelector(".button-row");
  const byId = registrationsById(registrations);

  candidates.forEach((candidate, index) => {
    const first = byId.get(pairIds(candidate)[0]);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button small secondary";
    button.textContent = first ? `${fanbusPersonName(first)} prüfen` : `Prüffall ${index + 1}`;
    button.addEventListener("click", () => openDuplicateReview(candidate, registrations));
    actions?.append(button);
  });
  target.before(panel);
}

function applyData(route, data) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  if (route.view === "participants") {
    applyParticipantGroups(registrations);
    renderDuplicateReview(data, registrations);
  } else {
    applyBookingGroups(registrations);
  }
}

async function syncCurrentView() {
  const route = routeState();
  if (route.path !== "#/bus-orga" || !route.tripId || !["participants", "bookings"].includes(route.view)) {
    syncKey = "";
    lastData = null;
    return;
  }

  ensureStyle();
  const signature = route.view === "participants"
    ? [...document.querySelectorAll(".m328-participants [data-m328-participant-id]")].map(card => card.dataset.m328ParticipantId || "").sort().join("|")
    : [...document.querySelectorAll(".m328-booking-card[data-booking-card]")].map(card => card.dataset.bookingCard || "").sort().join("|");
  if (!signature) return;
  const key = `${route.view}:${route.tripId}:${signature}`;
  if (syncKey === key && lastData) {
    applyData(route, lastData);
    return;
  }
  if (syncPromise) return;

  syncPromise = api.call("fanbus_registrations_list", { tripId: route.tripId })
    .then(data => {
      const current = routeState();
      if (current.tripId !== route.tripId || current.view !== route.view) return;
      applyData(route, data);
      syncKey = key;
      lastData = data;
    })
    .catch(error => {
      syncKey = "";
      console.warn("Fanbus-Integritätsanzeige konnte nicht aktualisiert werden", error);
    })
    .finally(() => { syncPromise = null; });
  await syncPromise;
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    void syncCurrentView();
  });
}

window.addEventListener("hashchange", () => {
  syncKey = "";
  lastData = null;
  scheduleSync();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncKey = "";
    lastData = null;
    scheduleSync();
  }
});

new MutationObserver(() => scheduleSync()).observe(document.documentElement, { childList: true, subtree: true });
scheduleSync();

export function noop() {}

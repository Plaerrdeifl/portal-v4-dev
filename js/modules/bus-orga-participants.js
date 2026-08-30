import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  showToast
} from "./common.js";
import { downloadFanbusRegistrationsXlsx } from "./fanbus-xlsx.js";
import { openParticipantDetail } from "./bus-orga-participant-dialogs.js";
import {
  bindWorkspaceBack,
  busPreferenceLabel,
  loadTrip,
  navigate,
  sourceLabel,
  statusBadge,
  workspacePage
} from "./bus-orga-workspace-base.js";

function registrationCard(registration, buses, readOnly) {
  const bus = buses.find(item => item.id === registration.busId);
  const canAct = !readOnly && registration.status !== "CANCELLED";
  const bookingRole = registration.bookingRole === "COMPANION" ? "Mitfahrer" : "Hauptperson";
  const meta = [
    bookingRole,
    sourceLabel(registration.source),
    `Buswunsch: ${busPreferenceLabel(registration.busPreference)}`,
    registration.status === "ACTIVE" ? `Bus: ${bus?.label || "Nicht zugeordnet"}` : "",
    registration.status === "WAITLISTED" ? `Warteliste ${registration.waitlistPosition || "–"}` : ""
  ].filter(Boolean);
  return `<article class="m328-participant-card" data-m328-participant-id="${escapeAttr(registration.id)}"${canAct ? ` role="button" tabindex="0" aria-label="${escapeAttr(`${registration.firstName} ${registration.lastName} verwalten`)}"` : ""}>
    <div class="m328-card-head"><strong>${escapeHtml(`${registration.firstName} ${registration.lastName}`)}</strong>${statusBadge(registration.status)}</div>
    <div class="m328-card-meta">${meta.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div>
    ${canAct ? '<span class="m328-card-chevron" aria-hidden="true">›</span>' : ""}
  </article>`;
}

function filterParticipantCards(state) {
  const form = state.root.querySelector("[data-m328-participant-filter]");
  if (!form) return;
  const query = String(form.elements.search?.value || "").trim().toLocaleLowerCase("de-DE");
  const status = form.elements.status?.value || "ALL";
  const preference = form.elements.preference?.value || "ALL";
  const bus = form.elements.bus?.value || "ALL";
  let visible = 0;
  for (const registration of state.registrations) {
    const card = state.root.querySelector(`[data-m328-participant-id="${CSS.escape(registration.id)}"]`);
    if (!card) continue;
    const haystack = `${registration.firstName || ""} ${registration.lastName || ""} ${registration.email || ""}`.toLocaleLowerCase("de-DE");
    const show = (!query || haystack.includes(query))
      && (status === "ALL" || registration.status === status)
      && (preference === "ALL" || registration.busPreference === preference)
      && (bus === "ALL" || (bus === "UNASSIGNED" ? !registration.busId : registration.busId === bus));
    card.hidden = !show;
    if (show) visible += 1;
  }
  const count = state.root.querySelector("[data-m328-participant-count]");
  if (count) count.textContent = `${visible} von ${state.registrations.length}`;
  const noMatches = state.root.querySelector("[data-m328-participant-empty]");
  if (noMatches) noMatches.hidden = visible > 0;
}

function renderParticipants(state) {
  const readOnly = state.trip.status === "CANCELLED";
  const busOptions = state.buses.map(bus => `<option value="${escapeAttr(bus.id)}">${escapeHtml(bus.label)}</option>`).join("");
  const content = `
    ${readOnly ? '<div class="notice error">Die Fahrt ist abgesagt. Teilnehmer bleiben lesbar, können aber nicht mehr geändert werden.</div>' : ""}
    <section class="m328-workspace-panel">
      <div class="m328-workspace-toolbar">
        <strong>Teilnehmer</strong>
        <div class="button-row m328-participant-toolbar-actions">
          <button class="button small secondary" type="button" data-m328-participant-export>Excel</button>
          ${readOnly ? "" : '<button class="button small primary" type="button" data-m328-participant-add>＋ Teilnehmer</button>'}
        </div>
      </div>
      <form data-m328-participant-filter>
        <div class="m328-workspace-search"><input name="search" type="search" autocomplete="off" placeholder="Teilnehmer suchen"><span class="m328-workspace-count" data-m328-participant-count>${state.registrations.length} von ${state.registrations.length}</span></div>
        <details class="m328-participant-filters">
          <summary class="button small secondary">Filter</summary>
          <div class="m328-participant-filter-body">
            <label>Status<select name="status"><option value="ALL">Alle</option><option value="ACTIVE">Bestätigt</option><option value="WAITLISTED">Warteliste</option><option value="CANCELLED">Storniert</option></select></label>
            <label>Buswunsch<select name="preference"><option value="ALL">Alle</option><option value="RUHIG">Ruhig</option><option value="PARTY">Party</option><option value="EGAL">Egal</option></select></label>
            <label>Bus<select name="bus"><option value="ALL">Alle</option><option value="UNASSIGNED">Nicht zugeordnet</option>${busOptions}</select></label>
          </div>
        </details>
      </form>
    </section>
    <section class="v4-m310-registration-list m328-participant-list" aria-label="Teilnehmerliste">
      ${state.registrations.map(registration => registrationCard(registration, state.buses, readOnly)).join("") || empty("Für diese Fahrt liegen noch keine Anmeldungen vor.")}
      <p class="subtle" data-m328-participant-empty hidden>Keine Teilnehmer entsprechen den Filtern.</p>
    </section>`;
  state.root.innerHTML = workspacePage("Teilnehmer", state.trip, content, { className: "m328-participants" });
  bindWorkspaceBack(state.root, state.trip.id);
  state.root.querySelector("[data-m328-participant-add]")?.addEventListener("click", () => navigate("registration", state.trip.id));
  state.root.querySelector("[data-m328-participant-export]")?.addEventListener("click", () => {
    try {
      downloadFanbusRegistrationsXlsx(state.trip, state.registrations);
      showToast("Excel-Datei wurde erstellt.", "success", 3200);
    } catch (error) {
      showToast(error?.message || "Die Excel-Datei konnte nicht erstellt werden.", "error", 5200);
    }
  });
  const filter = state.root.querySelector("[data-m328-participant-filter]");
  filter?.addEventListener("input", () => filterParticipantCards(state));
  filter?.addEventListener("change", () => filterParticipantCards(state));
  state.root.querySelectorAll(".m328-participant-card[role=button]").forEach(card => {
    const open = () => {
      const registration = state.registrations.find(item => item.id === card.dataset.m328ParticipantId);
      if (registration) openParticipantDetail(state, registration);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  });
}

async function refreshParticipants(state, { rerender = true } = {}) {
  const data = await call("fanbus_registrations_list", { tripId: state.trip.id });
  state.registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  state.buses = Array.isArray(data?.buses) ? data.buses : [];
  state.summary = data?.summary || {};
  if (rerender) renderParticipants(state);
  return data;
}

export async function hydrateParticipants(root, tripId, context) {
  if (!hasCapability("fanbus.registrations.manage")) throw new Error("Für die Teilnehmerverwaltung fehlt die erforderliche Berechtigung.");
  const [trip, data] = await Promise.all([
    loadTrip(tripId),
    call("fanbus_registrations_list", { tripId })
  ]);
  if (context.isCurrent && !context.isCurrent()) return;
  if (trip.canManageRegistrations === false) throw new Error("Für diese Fahrt ist die Teilnehmerverwaltung nicht freigeschaltet.");
  const state = {
    root,
    trip,
    registrations: Array.isArray(data?.registrations) ? data.registrations : [],
    buses: Array.isArray(data?.buses) ? data.buses : [],
    summary: data?.summary || {}
  };
  state.refresh = options => refreshParticipants(state, options);
  renderParticipants(state);
}

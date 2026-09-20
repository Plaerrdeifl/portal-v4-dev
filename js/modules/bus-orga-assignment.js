import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  openDialog,
  showToast
} from "./common.js";
import {
  ASSIGNMENT_WARNING_LABELS,
  bindWorkspaceBack,
  busCategoryLabel,
  loadTrip,
  tripVenue,
  workspacePage
} from "./bus-orga-workspace-base.js";

function ensureAssignmentStyle() {
  if (document.getElementById("m328AssignmentWorkspaceStyle")) return;
  const style = document.createElement("style");
  style.id = "m328AssignmentWorkspaceStyle";
  style.textContent = `
    .m328-assignment-current-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .m328-assignment-current-summary span{display:grid;gap:1px;padding:8px;border-radius:10px;background:var(--surface-2);color:var(--muted);font-size:.62rem;text-align:center}
    .m328-assignment-current-summary strong{color:var(--ink-900);font-size:.92rem}
    .m328-assignment-current-summary .m328-assignment-unassigned{background:color-mix(in srgb,#f7b955 22%,var(--surface-2))}
    .m328-assignment-current-list{display:grid;gap:0}
    .m328-assignment-current-list .m328-assignment-row>strong{white-space:nowrap}
    @media(max-width:360px){.m328-assignment-current-summary{grid-template-columns:1fr 1fr}.m328-assignment-current-summary span:last-child{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}

function activeParticipants(state) {
  return state.registrations.filter(registration => registration.status === "ACTIVE");
}

function assignmentSummary(state) {
  const active = activeParticipants(state);
  const assigned = active.filter(registration => Boolean(registration.busId)).length;
  const unassigned = active.length - assigned;
  return `<div class="m328-assignment-current-summary">
    <span><strong>${active.length}</strong>Teilnehmer</span>
    <span><strong>${assigned}</strong>Zugeordnet</span>
    <span class="${unassigned ? "m328-assignment-unassigned" : ""}"><strong>${unassigned}</strong>Nicht zugeordnet</span>
  </div>`;
}

function busRows(state) {
  const active = activeParticipants(state);
  const buses = state.buses.filter(bus => state.readOnly || bus.isActive !== false);
  if (!buses.length) return empty("Für diese Fahrt sind noch keine Busse angelegt.");
  return `<div class="m328-assignment-current-list">${buses.map(bus => {
    const assigned = active.filter(registration => registration.busId === bus.id).length;
    const capacity = Number(bus.capacity || 0);
    const free = Math.max(capacity - assigned, 0);
    return `<div class="m328-assignment-row"><div><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(busCategoryLabel(bus.category))} · ${assigned} zugeordnet</small></div><strong>${assigned}/${capacity} · ${free} frei</strong></div>`;
  }).join("")}</div>`;
}

function participantName(registrations, id) {
  const person = registrations.find(item => item.id === id);
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "Teilnehmer";
}

function previewBusName(buses, id) {
  return buses.find(bus => bus.busId === id)?.label || "Nicht zugeordnet";
}

function assignmentError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("FANBUS_ASSIGNMENT_PREVIEW_STALE")) return new Error("Daten haben sich geändert. Bitte Zuordnung neu berechnen.");
  if (message.includes("FANBUS_BUS_CAPACITY_EXHAUSTED")) return new Error("Die gewählte Busverteilung überschreitet eine Buskapazität.");
  if (message.includes("FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP")) return new Error("Mindestens ein gewählter Bus bedient den erforderlichen Zustieg nicht.");
  return error instanceof Error ? error : new Error(message || "Zuordnung konnte nicht angewendet werden.");
}

async function openAssignmentPreview(state) {
  try {
    const [preview, registrationData] = await Promise.all([
      call("fanbus_assignment_preview", { tripId: state.trip.id }),
      call("fanbus_registrations_list", { tripId: state.trip.id })
    ]);
    const registrations = Array.isArray(registrationData?.registrations) ? registrationData.registrations : [];
    const buses = Array.isArray(preview?.buses) ? preview.buses : [];
    const proposals = Array.isArray(preview?.participantProposals) ? preview.participantProposals : [];
    const editable = proposals.filter(item => item.assignmentState === "PROPOSED_AUTO");
    const editableGroups = Array.from(editable.reduce((groups, proposal) => {
      const key = proposal.travelGroupId || proposal.bookingId || proposal.participantId;
      const group = groups.get(key) || {
        unitKey: key,
        bookingId: proposal.bookingId || key,
        travelGroupId: proposal.travelGroupId || null,
        travelGroupName: proposal.travelGroupName || "",
        proposals: []
      };
      group.proposals.push(proposal);
      groups.set(key, group);
      return groups;
    }, new Map()).values());
    const existing = proposals.filter(item => item.assignmentState !== "PROPOSED_AUTO");
    const conflicts = Array.isArray(preview?.conflicts) ? preview.conflicts : [];
    const summary = preview?.summary || {};
    const previewBusRows = buses.map(bus => `<div class="m328-assignment-row"><div><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(bus.category)} · ${Number(bus.existingOccupancy || 0)} bereits zugeordnet${Number(bus.proposedNew || 0) ? ` · ${Number(bus.proposedNew)} neu` : ""}</small></div><strong>${Number(bus.afterApply || 0)}/${Number(bus.capacity || 0)} · ${Number(bus.freeAfter || 0)} frei</strong></div>`).join("");
    const proposalsMarkup = editableGroups.map(group => {
      const proposal = group.proposals[0];
      const names = group.proposals.map(item => participantName(registrations, item.participantId)).join(", ");
      const proposedBusIds = new Set(group.proposals.map(item => item.proposedBusId || ""));
      const selectedBusId = proposedBusIds.size === 1 ? proposal.proposedBusId : null;
      const warnings = [...new Set(group.proposals.flatMap(item => item.warnings || []))];
      const unitLabel = group.travelGroupId
        ? `Reisegruppe ${group.travelGroupName || ""} · ${group.proposals.length} Personen`
        : group.proposals.length > 1
          ? `Buchung · ${group.proposals.length} Personen`
          : names;
      return `<article class="m328-assignment-proposal"><div class="m328-card-head"><strong>${escapeHtml(unitLabel.trim())}</strong><span class="badge neutral">${group.travelGroupId ? "Zusammenbleiben" : "Vorschlag"}</span></div><small>${escapeHtml(names)}</small><label>Gemeinsamer Bus<select name="assignment_${escapeAttr(group.unitKey)}"><option value="">Gruppe nicht zuordnen</option>${buses.map(bus => `<option value="${escapeAttr(bus.busId)}"${bus.busId === selectedBusId ? " selected" : ""}>${escapeHtml(`${bus.label} · ${Number(bus.freeAfter || 0)} frei`)}</option>`).join("")}</select></label>${warnings.map(code => `<p class="notice warning m328-assignment-warning">${escapeHtml(ASSIGNMENT_WARNING_LABELS[code] || code)}</p>`).join("")}</article>`;
    }).join("");
    const existingMarkup = existing.map(proposal => `<div class="m328-assignment-row"><div><strong>${escapeHtml(participantName(registrations, proposal.participantId))}</strong><small>Bestehend · ${escapeHtml(proposal.assignmentState === "FIXED_MANUAL" ? "MANUAL" : "AUTO")}</small></div><strong>${escapeHtml(previewBusName(buses, proposal.currentBusId))}</strong></div>`).join("");
    const conflictMarkup = conflicts.map(conflict => `<div class="notice ${conflict.severity === "BLOCKING" ? "error" : "warning"}"><strong>${conflict.severity === "BLOCKING" ? "Blockierender Konflikt" : "Hinweis"}</strong><p>${escapeHtml(ASSIGNMENT_WARNING_LABELS[conflict.code] || conflict.code)}</p></div>`).join("");
    openDialog({
      title: "Automatische Buszuordnung",
      kicker: tripVenue(state.trip),
      body: `<form class="m328-assignment-preview" data-m328-assignment-form><section class="m328-assignment-summary"><strong>${editable.length ? `${editable.length} ${editable.length === 1 ? "neue Zuordnung" : "neue Zuordnungen"} vorgeschlagen` : "Keine neue Zuordnung nötig"}</strong><small>${Number(summary.existingAssigned ?? existing.length)} bestehende Zuordnungen bleiben unverändert.</small></section>${conflictMarkup}<section><h3>Busse</h3><div class="m328-assignment-buses">${previewBusRows || '<p class="subtle">Keine aktiven Busse.</p>'}</div></section>${editable.length ? `<section><h3>Neu zuordnen</h3><div class="m328-assignment-proposals">${proposalsMarkup}</div></section>` : ""}${existing.length ? `<section><h3>Bereits zugeordnet</h3><div class="m328-assignment-buses">${existingMarkup}</div></section>` : ""}<p class="subtle">Bestehende MANUAL- und AUTO-Zuordnungen werden nicht automatisch verändert.</p></form>`,
      submitLabel: preview.canApply ? "Zuordnung anwenden" : "Keine Zuordnung anwendbar",
      onSubmit: preview.canApply ? async values => {
        try {
          const finalAssignments = editableGroups.flatMap(group => group.proposals.map(proposal => ({
            participantId: proposal.participantId,
            busId: values[`assignment_${group.unitKey}`] || null
          })));
          const result = await call("fanbus_assignment_apply", {
            tripId: state.trip.id,
            algorithmVersion: preview.algorithmVersion,
            inputFingerprint: preview.inputFingerprint,
            finalAssignments
          });
          showToast(`${Number(result?.applied || 0)} Buszuordnung(en) wurden gespeichert.`, "success", 4200);
          await refreshAssignment(state);
        } catch (error) {
          throw assignmentError(error);
        }
      } : null
    });
  } catch (error) {
    showToast(error?.message || "Zuordnung konnte nicht berechnet werden.", "error", 5200);
  }
}

function renderAssignment(state) {
  ensureAssignmentStyle();
  const content = `
    ${state.readOnly ? '<div class="notice error">Die Fahrt ist abgesagt. Die bestehende Buszuordnung bleibt historisch lesbar.</div>' : ""}
    <section class="m328-workspace-panel">
      <div class="m328-workspace-toolbar"><strong>Aktuelle Zuordnung</strong></div>
      ${assignmentSummary(state)}
      ${!state.readOnly ? '<button class="m328-auto-assignment" type="button" data-m328-auto-assignment><span><strong>Automatische Buszuordnung</strong><small>Nicht zugeordnete Teilnehmer anhand Kapazität, Zustieg und Buswunsch verteilen.</small></span><span aria-hidden="true">›</span></button>' : ""}
    </section>
    <section class="m328-workspace-panel">
      <div class="m328-workspace-toolbar"><strong>Busbelegung</strong></div>
      ${busRows(state)}
    </section>`;
  state.root.innerHTML = workspacePage("Zuordnung", state.trip, content, { className: "m328-assignment" });
  bindWorkspaceBack(state.root, state.trip.id);
  state.root.querySelector("[data-m328-auto-assignment]")?.addEventListener("click", () => void openAssignmentPreview(state));
}

async function refreshAssignment(state) {
  const [busData, registrationData] = await Promise.all([
    call("fanbus_buses_list", { tripId: state.trip.id }),
    call("fanbus_registrations_list", { tripId: state.trip.id })
  ]);
  state.buses = Array.isArray(busData?.buses) ? busData.buses : [];
  state.registrations = Array.isArray(registrationData?.registrations) ? registrationData.registrations : [];
  renderAssignment(state);
}

export async function hydrateAssignment(root, tripId, context) {
  if (!hasCapability("fanbus.manage") || !hasCapability("fanbus.registrations.manage")) {
    throw new Error("Für die Buszuordnung fehlt die erforderliche Berechtigung.");
  }
  const [trip, busData, registrationData] = await Promise.all([
    loadTrip(tripId),
    call("fanbus_buses_list", { tripId }),
    call("fanbus_registrations_list", { tripId })
  ]);
  if (context.isCurrent && !context.isCurrent()) return;
  if (trip.canManage === false || trip.canManageRegistrations === false) {
    throw new Error("Für diese Fahrt ist die Buszuordnung nicht freigeschaltet.");
  }
  const state = {
    root,
    trip,
    readOnly: trip.status === "CANCELLED",
    buses: Array.isArray(busData?.buses) ? busData.buses : [],
    registrations: Array.isArray(registrationData?.registrations) ? registrationData.registrations : []
  };
  renderAssignment(state);
}

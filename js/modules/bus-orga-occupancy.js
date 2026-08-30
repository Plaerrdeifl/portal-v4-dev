import {
  call,
  confirmAction,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  openDialog,
  runWrite,
  showToast
} from "./common.js";
import {
  ASSIGNMENT_WARNING_LABELS,
  bindWorkspaceBack,
  busCategoryLabel,
  formatBoardingTime,
  loadTrip,
  tripVenue,
  workspacePage
} from "./bus-orga-workspace-base.js";

function occupancySummary(state) {
  const buses = state.buses.filter(bus => state.readOnly || bus.isActive !== false);
  const capacity = buses.filter(bus => bus.isActive !== false).reduce((sum, bus) => sum + Number(bus.capacity || 0), 0);
  const occupied = buses.filter(bus => bus.isActive !== false).reduce((sum, bus) => sum + Number(bus.occupancy ?? bus.occupied ?? 0), 0);
  return `<div class="m328-occupancy-summary"><span><strong>${buses.length}</strong>Busse</span><span><strong>${capacity}</strong>Plätze</span><span><strong>${occupied}</strong>Belegt</span><span><strong>${Math.max(capacity - occupied, 0)}</strong>Frei</span></div>`;
}

function occupancyCard(state, bus) {
  const occupancy = Number(bus.occupancy ?? bus.occupied ?? 0);
  const mapping = state.mappings.find(item => item.busId === bus.id);
  const stopLabels = new Map(state.stops.map(stop => [stop.id, stop.label]));
  const stops = (mapping?.tripBoardingStopIds || []).map(id => stopLabels.get(id)).filter(Boolean);
  const canAct = state.canManage && !state.readOnly;
  return `<article class="m328-occupancy-card" data-m328-bus-id="${escapeAttr(bus.id)}"${canAct ? ` role="button" tabindex="0" aria-label="${escapeAttr(`${bus.label} verwalten`)}"` : ""}>
    <div class="m328-card-head"><div><strong>${escapeHtml(bus.label)}</strong><div class="m328-card-meta"><span>${escapeHtml(busCategoryLabel(bus.category))}${bus.isActive === false ? " · inaktiv" : ""}</span></div></div><span>${escapeHtml(String(occupancy))} / ${escapeHtml(String(bus.capacity ?? 0))} belegt</span></div>
    <p class="m328-occupancy-stops"><strong>Zustiege:</strong> ${escapeHtml(stops.length ? stops.join(" · ") : "Keine zugeordnet")}</p>
    ${canAct ? '<span class="m328-card-chevron" aria-hidden="true">›</span>' : ""}
  </article>`;
}

function renderOccupancy(state) {
  const visibleBuses = state.buses.filter(bus => state.readOnly || bus.isActive !== false);
  const content = `
    ${state.readOnly ? '<div class="notice error">Die Fahrt ist abgesagt. Busdaten und Zuordnungen bleiben historisch lesbar.</div>' : ""}
    <section class="m328-workspace-panel">
      <div class="m328-workspace-toolbar"><strong>Busübersicht</strong>${state.canManage && !state.readOnly ? '<button class="button small primary" type="button" data-m328-bus-create>＋ Bus</button>' : ""}</div>
      ${occupancySummary(state)}
      ${hasCapability("fanbus.registrations.manage") && !state.readOnly ? '<button class="m328-auto-assignment" type="button" data-m328-auto-assignment><span><strong>Automatische Buszuordnung</strong><small>Neue Teilnehmer anhand Kapazität, Zustieg und Buswunsch verteilen.</small></span><span aria-hidden="true">›</span></button>' : ""}
    </section>
    <section class="m328-occupancy-list" aria-label="Busse">${visibleBuses.map(bus => occupancyCard(state, bus)).join("") || empty("Für diese Fahrt sind noch keine Busse angelegt.")}</section>`;
  state.root.innerHTML = workspacePage("Busse", state.trip, content, { className: "m328-occupancy" });
  bindWorkspaceBack(state.root, state.trip.id);
  state.root.querySelector("[data-m328-bus-create]")?.addEventListener("click", () => openBusForm(state));
  state.root.querySelector("[data-m328-auto-assignment]")?.addEventListener("click", () => void openAssignmentPreview(state));
  state.root.querySelectorAll(".m328-occupancy-card[role=button]").forEach(card => {
    const open = () => {
      const bus = state.buses.find(item => item.id === card.dataset.m328BusId);
      if (bus) openBusActions(state, bus);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  });
}

async function refreshOccupancy(state) {
  const [busData, mappingData, stopData] = await Promise.all([
    call("fanbus_buses_list", { tripId: state.trip.id }),
    call("fanbus_bus_boarding_stops_list", { tripId: state.trip.id }),
    call("fanbus_trip_boarding_stops_list", { tripId: state.trip.id })
  ]);
  state.buses = Array.isArray(busData?.buses) ? busData.buses : [];
  state.mappings = Array.isArray(mappingData?.buses) ? mappingData.buses : [];
  state.stops = Array.isArray(stopData?.stops) ? stopData.stops : [];
  renderOccupancy(state);
}

function busFormMarkup(bus = null) {
  return `<form class="form-grid v4-smart-form" data-m328-bus-form>
    <label class="v4-field-full">Busname<input name="label" maxlength="160" value="${escapeAttr(bus?.label || "")}" required></label>
    <label class="v4-field-half">Kategorie<select name="category" required><option value="NORMAL"${!bus || bus.category === "NORMAL" ? " selected" : ""}>Normal</option><option value="RUHIG"${bus?.category === "RUHIG" ? " selected" : ""}>Ruhig</option><option value="PARTY"${bus?.category === "PARTY" ? " selected" : ""}>Party</option></select></label>
    <label class="v4-field-half">Kapazität<input name="capacity" type="number" min="1" step="1" value="${escapeAttr(bus?.capacity || "")}" required></label>
    <label class="check-row v4-field-full"><input name="isActive" type="checkbox"${bus?.isActive === false ? "" : " checked"}><span>Bus ist aktiv</span></label>
  </form>`;
}

function openBusForm(state, bus = null) {
  openDialog({
    title: bus ? "Bus bearbeiten" : "Bus anlegen",
    kicker: tripVenue(state.trip),
    body: busFormMarkup(bus),
    submitLabel: bus ? "Bus speichern" : "Bus anlegen",
    onSubmit: async values => {
      await runWrite(() => call("fanbus_bus_upsert", {
        ...(bus ? { id: bus.id, expectedRevision: Number(bus.revision) } : {}),
        tripId: state.trip.id,
        label: values.label,
        category: values.category,
        capacity: Number(values.capacity),
        isActive: values.isActive === "on"
      }), bus ? "Bus wurde aktualisiert." : "Bus wurde angelegt.");
      await refreshOccupancy(state);
    }
  });
}

function openBusStops(state, bus) {
  const mapping = state.mappings.find(item => item.busId === bus.id);
  if (!mapping) {
    showToast("Für diesen Bus ist noch keine Zustiegszuordnung verfügbar.", "warning", 4200);
    return;
  }
  const activeStops = state.stops.filter(stop => stop.isActive !== false);
  openDialog({
    title: `${bus.label} · Zustiege`,
    kicker: tripVenue(state.trip),
    body: `<form class="form-grid v4-smart-form" data-m328-bus-stops>${activeStops.map(stop => `<label class="check-row v4-field-full"><input type="checkbox" name="stopId" value="${escapeAttr(stop.id)}"${mapping.tripBoardingStopIds.includes(stop.id) ? " checked" : ""}><span>${escapeHtml(`${formatBoardingTime(stop.departureAt) || "Zeit offen"} · ${stop.label}`)}</span></label>`).join("") || empty("Für diese Fahrt sind noch keine Zustiege hinterlegt.")}</form>`,
    submitLabel: "Zustiege speichern",
    onSubmit: async () => {
      const form = document.querySelector("#v4DialogBody [data-m328-bus-stops]");
      const stopIds = form ? new FormData(form).getAll("stopId") : [];
      await runWrite(() => call("fanbus_bus_boarding_stops_set", {
        tripId: state.trip.id,
        busId: bus.id,
        expectedRevision: Number(mapping.revision),
        tripBoardingStopIds: stopIds
      }), "Bus-Zustiege gespeichert.");
      await refreshOccupancy(state);
    }
  });
}

function openBusActions(state, bus) {
  const mapping = state.mappings.find(item => item.busId === bus.id);
  const dialog = openDialog({
    title: bus.label,
    kicker: "Busse",
    body: `<div class="m328-dialog-actions"><button class="button secondary" type="button" data-m328-bus-edit>Bus bearbeiten</button><button class="button secondary" type="button" data-m328-bus-stops${mapping ? "" : " disabled"}>Zustiege verwalten</button><button class="button danger" type="button" data-m328-bus-delete>Bus löschen</button></div>`
  });
  dialog.querySelector("[data-m328-bus-edit]")?.addEventListener("click", () => openBusForm(state, bus));
  dialog.querySelector("[data-m328-bus-stops]")?.addEventListener("click", () => openBusStops(state, bus));
  dialog.querySelector("[data-m328-bus-delete]")?.addEventListener("click", async () => {
    const occupancy = Number(bus.occupancy ?? bus.occupied ?? 0);
    if (occupancy > 0) {
      openDialog({
        title: "Bus kann nicht gelöscht werden",
        kicker: bus.label,
        body: '<div class="notice warning"><strong>Noch Teilnehmer zugeordnet</strong><p>Ordne die Teilnehmer zuerst einem anderen Bus zu.</p></div>'
      });
      return;
    }
    const confirmed = await confirmAction(
      `Bus „${bus.label}“ aus der aktiven Busverwaltung entfernen?`,
      { danger: true, title: "Bus löschen", submitLabel: "Bus löschen" }
    );
    if (!confirmed) return;
    try {
      await runWrite(() => call("fanbus_bus_upsert", {
        id: bus.id,
        tripId: state.trip.id,
        expectedRevision: Number(bus.revision),
        label: bus.label,
        category: bus.category,
        capacity: Number(bus.capacity),
        isActive: false
      }), "Bus wurde gelöscht.");
      dialog.close();
      await refreshOccupancy(state);
    } catch (error) {
      const blocked = String(error?.message || error?.code || "").includes("FANBUS_OCCUPIED_BUS_CANNOT_DEACTIVATE");
      showToast(blocked ? "Dem Bus sind noch Teilnehmer zugeordnet." : error?.message || "Bus konnte nicht gelöscht werden.", blocked ? "warning" : "error", 5200);
    }
  });
}

function assignmentParticipantName(registrations, id) {
  const person = registrations.find(item => item.id === id);
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "Teilnehmer";
}

function assignmentBusName(buses, id) {
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
    const existing = proposals.filter(item => item.assignmentState !== "PROPOSED_AUTO");
    const conflicts = Array.isArray(preview?.conflicts) ? preview.conflicts : [];
    const summary = preview?.summary || {};
    const busRows = buses.map(bus => `<div class="m328-assignment-row"><div><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(bus.category)} · ${Number(bus.existingOccupancy || 0)} bereits zugeordnet${Number(bus.proposedNew || 0) ? ` · ${Number(bus.proposedNew)} neu` : ""}</small></div><strong>${Number(bus.afterApply || 0)}/${Number(bus.capacity || 0)} · ${Number(bus.freeAfter || 0)} frei</strong></div>`).join("");
    const proposalsMarkup = editable.map(proposal => `<article class="m328-assignment-proposal"><div class="m328-card-head"><strong>${escapeHtml(assignmentParticipantName(registrations, proposal.participantId))}</strong><span class="badge neutral">Vorschlag</span></div><small>Buswunsch ${escapeHtml(proposal.busPreference || "EGAL")}</small><label>Bus<select name="assignment_${escapeAttr(proposal.participantId)}"><option value="">Nicht zuordnen</option>${buses.map(bus => `<option value="${escapeAttr(bus.busId)}"${bus.busId === proposal.proposedBusId ? " selected" : ""}>${escapeHtml(`${bus.label} · ${Number(bus.freeAfter || 0)} frei`)}</option>`).join("")}</select></label>${(proposal.warnings || []).map(code => `<p class="notice warning m328-assignment-warning">${escapeHtml(ASSIGNMENT_WARNING_LABELS[code] || code)}</p>`).join("")}</article>`).join("");
    const existingMarkup = existing.map(proposal => `<div class="m328-assignment-row"><div><strong>${escapeHtml(assignmentParticipantName(registrations, proposal.participantId))}</strong><small>Bestehend · ${escapeHtml(proposal.assignmentState === "FIXED_MANUAL" ? "MANUAL" : "AUTO")}</small></div><strong>${escapeHtml(assignmentBusName(buses, proposal.currentBusId))}</strong></div>`).join("");
    const conflictMarkup = conflicts.map(conflict => `<div class="notice ${conflict.severity === "BLOCKING" ? "error" : "warning"}"><strong>${conflict.severity === "BLOCKING" ? "Blockierender Konflikt" : "Hinweis"}</strong><p>${escapeHtml(ASSIGNMENT_WARNING_LABELS[conflict.code] || conflict.code)}</p></div>`).join("");
    openDialog({
      title: "Automatische Buszuordnung",
      kicker: tripVenue(state.trip),
      body: `<form class="m328-assignment-preview" data-m328-assignment-form><section class="m328-assignment-summary"><strong>${editable.length ? `${editable.length} ${editable.length === 1 ? "neue Zuordnung" : "neue Zuordnungen"} vorgeschlagen` : "Keine neue Zuordnung nötig"}</strong><small>${Number(summary.existingAssigned ?? existing.length)} bestehende Zuordnungen bleiben unverändert.</small></section>${conflictMarkup}<section><h3>Busse</h3><div class="m328-assignment-buses">${busRows || '<p class="subtle">Keine aktiven Busse.</p>'}</div></section>${editable.length ? `<section><h3>Neu zuordnen</h3><div class="m328-assignment-proposals">${proposalsMarkup}</div></section>` : ""}${existing.length ? `<section><h3>Bereits zugeordnet</h3><div class="m328-assignment-buses">${existingMarkup}</div></section>` : ""}<p class="subtle">Bestehende MANUAL- und AUTO-Zuordnungen werden nicht automatisch verändert.</p></form>`,
      submitLabel: preview.canApply ? "Zuordnung anwenden" : "Keine Zuordnung anwendbar",
      onSubmit: preview.canApply ? async values => {
        try {
          const finalAssignments = editable.map(proposal => ({
            participantId: proposal.participantId,
            busId: values[`assignment_${proposal.participantId}`] || null
          }));
          const result = await call("fanbus_assignment_apply", {
            tripId: state.trip.id,
            algorithmVersion: preview.algorithmVersion,
            inputFingerprint: preview.inputFingerprint,
            finalAssignments
          });
          showToast(`${Number(result?.applied || 0)} Buszuordnung(en) wurden gespeichert.`, "success", 4200);
          await refreshOccupancy(state);
        } catch (error) {
          throw assignmentError(error);
        }
      } : null
    });
  } catch (error) {
    showToast(error?.message || "Zuordnung konnte nicht berechnet werden.", "error", 5200);
  }
}

export async function hydrateOccupancy(root, tripId, context) {
  if (!hasCapability("fanbus.manage")) throw new Error("Für die Busverwaltung fehlt die erforderliche Berechtigung.");
  const [trip, busData, mappingData, stopData] = await Promise.all([
    loadTrip(tripId),
    call("fanbus_buses_list", { tripId }),
    call("fanbus_bus_boarding_stops_list", { tripId }),
    call("fanbus_trip_boarding_stops_list", { tripId })
  ]);
  if (context.isCurrent && !context.isCurrent()) return;
  if (trip.canManage === false) throw new Error("Für diese Fahrt ist die Busverwaltung nicht freigeschaltet.");
  const state = {
    root,
    trip,
    canManage: true,
    readOnly: trip.status === "CANCELLED",
    buses: Array.isArray(busData?.buses) ? busData.buses : [],
    mappings: Array.isArray(mappingData?.buses) ? mappingData.buses : [],
    stops: Array.isArray(stopData?.stops) ? stopData.stops : []
  };
  renderOccupancy(state);
}

import {
  call,
  empty,
  escapeAttr,
  escapeHtml,
  hasCapability,
  runWrite,
  showToast
} from "./common.js";
import {
  bindWorkspaceBack,
  formatBoardingTime,
  loadTrip,
  tripVenue,
  workspacePage
} from "./bus-orga-workspace-base.js";

function operationCard(person, state) {
  const isPresent = person.checkinStatus === "PRESENT";
  const isMissing = person.checkinStatus === "NO_SHOW";
  const actions = [];
  if (!state.readOnly && state.canManageOperations) {
    actions.push(`<button class="button small ${isPresent ? "primary" : "secondary"}" type="button" data-m328-checkin="PRESENT" data-id="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.checkinRevision)}" data-current="${escapeAttr(person.checkinStatus || "OPEN")}">${isPresent ? "✓ Anwesend" : "Anwesend"}</button>`);
  }
  if (!state.readOnly && state.canManagePaymentMarker) {
    actions.push(`<button class="button small ${person.isPaid ? "primary" : "secondary"}" type="button" data-m328-paid="${person.isPaid ? "false" : "true"}" data-id="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.checkinRevision)}">${person.isPaid ? "✓ Bezahlt" : "Bezahlt"}</button>`);
  }
  if (!state.readOnly && state.canManageOperations) {
    actions.push(`<button class="button small ${isMissing ? "danger" : "secondary"}" type="button" data-m328-checkin="NO_SHOW" data-id="${escapeAttr(person.id)}" data-revision="${escapeAttr(person.checkinRevision)}" data-current="${escapeAttr(person.checkinStatus || "OPEN")}">${isMissing ? "✓ Fehlt" : "Fehlt"}</button>`);
  }
  const stop = person.departureAt
    ? `${formatBoardingTime(person.departureAt)} · ${person.boardingStopLabel || "Kein Zustiegsort"}`
    : person.boardingStopLabel || "Kein Zustiegsort";
  return `<article class="v4-compact-record v4-m325-operation-card m328-operation-card" data-m328-operation-person="${escapeAttr(`${person.firstName} ${person.lastName}`.toLocaleLowerCase("de-DE"))}" data-status="${escapeAttr(person.checkinStatus || "OPEN")}" data-bus="${escapeAttr(person.busId || "")}" data-stop="${escapeAttr(person.tripBoardingStopId || "")}"><div class="m328-operation-copy"><strong>${escapeHtml(`${person.firstName} ${person.lastName}`)}</strong><small>${escapeHtml(person.busLabel || "Kein Bus")} · ${escapeHtml(stop)}</small></div>${isPresent ? '<span class="badge success">Anwesend</span>' : isMissing ? '<span class="badge danger">Fehlt</span>' : person.isPaid ? '<span class="badge neutral">Bezahlt</span>' : ""}${actions.length ? `<div class="v4-row-actions v4-m325-checkin-actions m328-operation-actions">${actions.join("")}</div>` : `<small>${person.isPaid ? "Bezahlt" : "Nicht als bezahlt markiert"}</small>`}</article>`;
}

function filterOperations(state) {
  const form = state.root.querySelector("[data-m328-operation-filters]");
  if (!form) return;
  state.filters = {
    search: form.elements.search.value.trim(),
    status: form.elements.status.value,
    bus: form.elements.bus.value,
    stop: form.elements.stop.value
  };
  const query = state.filters.search.toLocaleLowerCase("de-DE");
  let visible = 0;
  state.root.querySelectorAll("[data-m328-operation-person]").forEach(card => {
    const show = (!query || card.dataset.m328OperationPerson.includes(query))
      && (state.filters.status === "ALL" || card.dataset.status === state.filters.status)
      && (state.filters.bus === "ALL" || card.dataset.bus === state.filters.bus)
      && (state.filters.stop === "ALL" || card.dataset.stop === state.filters.stop);
    card.hidden = !show;
    if (show) visible += 1;
  });
  const count = state.root.querySelector("[data-m328-operation-count]");
  if (count) count.textContent = `${visible} von ${state.participants.length}`;
  const emptyNode = state.root.querySelector("[data-m328-operation-empty]");
  if (emptyNode) emptyNode.hidden = visible > 0;
}

function renderOperations(state) {
  const summary = state.data?.summary || {};
  const paidCount = state.participants.filter(person => person.isPaid === true).length;
  const filters = state.filters || { search: "", status: "ALL", bus: "ALL", stop: "ALL" };
  const warning = Number(summary.unassignedBusCount || 0) || Number(summary.missingBoardingStopCount || 0)
    ? `<div class="notice warning">${Number(summary.unassignedBusCount || 0)} ohne Bus · ${Number(summary.missingBoardingStopCount || 0)} ohne Zustiegsort</div>`
    : "";
  const content = `
    ${state.readOnly ? '<div class="notice error">Die Fahrt ist abgesagt. Betriebsdaten bleiben historisch lesbar und können nicht mehr geändert werden.</div>' : ""}
    <div class="v4-m325-counters m328-operation-counters"><span><strong>${Number(summary.expected || 0)}</strong>Angemeldet</span><span><strong>${Number(summary.present || 0)}</strong>Anwesend</span><span><strong>${paidCount}</strong>Bezahlt</span><span><strong>${Number(summary.noShow || 0)}</strong>Fehlt</span></div>
    ${warning}
    <section class="m328-workspace-panel">
      <form class="m328-operation-filter-form" data-m328-operation-filters>
        <div class="m328-workspace-search"><input name="search" type="search" autocomplete="off" placeholder="Teilnehmer suchen" value="${escapeAttr(filters.search)}"><span class="m328-workspace-count" data-m328-operation-count>${state.participants.length} von ${state.participants.length}</span></div>
        <details class="m328-participant-filters m328-operation-filter-details">
          <summary class="button small secondary">Filter</summary>
          <div class="m328-participant-filter-body m328-operation-filter-body">
            <label>Status<select name="status"><option value="ALL">Alle</option><option value="OPEN"${filters.status === "OPEN" ? " selected" : ""}>Offen</option><option value="PRESENT"${filters.status === "PRESENT" ? " selected" : ""}>Anwesend</option><option value="NO_SHOW"${filters.status === "NO_SHOW" ? " selected" : ""}>Fehlt</option></select></label>
            <label>Bus<select name="bus"><option value="ALL">Alle</option>${(state.data.buses || []).map(bus => `<option value="${escapeAttr(bus.busId)}"${filters.bus === bus.busId ? " selected" : ""}>${escapeHtml(bus.label)}</option>`).join("")}</select></label>
            <label>Zustiegsort<select name="stop"><option value="ALL">Alle</option>${(state.data.stops || []).map(stop => `<option value="${escapeAttr(stop.tripBoardingStopId)}"${filters.stop === stop.tripBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label)}</option>`).join("")}</select></label>
          </div>
        </details>
      </form>
    </section>
    <section class="m328-operation-list">${state.participants.map(person => operationCard(person, state)).join("") || empty("Keine aktiven Teilnehmer.")}<p class="subtle" data-m328-operation-empty hidden>Keine Teilnehmer entsprechen den Filtern.</p></section>`;
  state.root.innerHTML = workspacePage("Fahrtbetrieb", state.trip, content, { className: "m328-operations", subtitle: `${tripVenue(state.trip)} · Check-in` });
  bindWorkspaceBack(state.root, state.trip.id);
  const form = state.root.querySelector("[data-m328-operation-filters]");
  form?.addEventListener("input", () => filterOperations(state));
  form?.addEventListener("change", () => filterOperations(state));
  filterOperations(state);
  state.root.querySelectorAll("[data-m328-checkin]").forEach(button => {
    button.addEventListener("click", async () => {
      const nextStatus = button.dataset.current === button.dataset.m328Checkin ? "OPEN" : button.dataset.m328Checkin;
      await updateOperation(state, () => call("fanbus_checkin_set", {
        participantId: button.dataset.id,
        expectedRevision: Number(button.dataset.revision),
        status: nextStatus
      }), "Check-in aktualisiert.");
    });
  });
  state.root.querySelectorAll("[data-m328-paid]").forEach(button => {
    button.addEventListener("click", async () => {
      const isPaid = button.dataset.m328Paid === "true";
      await updateOperation(state, () => call("fanbus_paid_set", {
        participantId: button.dataset.id,
        expectedRevision: Number(button.dataset.revision),
        isPaid
      }), isPaid ? "Teilnehmer als bezahlt markiert." : "Bezahlt-Markierung entfernt.");
    });
  });
}

async function updateOperation(state, action, successMessage) {
  const scrollTop = document.getElementById("view")?.scrollTop || 0;
  try {
    await runWrite(action, successMessage);
    state.data = await call("fanbus_operations_snapshot", { tripId: state.trip.id });
    state.participants = Array.isArray(state.data?.participants) ? state.data.participants : [];
    renderOperations(state);
    requestAnimationFrame(() => document.getElementById("view")?.scrollTo({ top: scrollTop, behavior: "auto" }));
  } catch (error) {
    showToast(error?.message || "Fahrtbetrieb konnte nicht aktualisiert werden.", "error", 5200);
  }
}

export async function hydrateOperations(root, tripId, context) {
  const trip = await loadTrip(tripId);
  const canManageOperations = hasCapability("fanbus.operations.manage") && trip.canManageOperations !== false;
  const canManagePaymentMarker = hasCapability("fanbus.payment_marker.manage") && trip.canManagePaymentMarker !== false;
  const canRead = canManageOperations
    || canManagePaymentMarker
    || (hasCapability("fanbus.registrations.manage") && trip.canManageRegistrations !== false);
  if (!canRead) throw new Error("Für den Fahrtbetrieb fehlt die erforderliche Berechtigung.");
  const data = await call("fanbus_operations_snapshot", { tripId });
  if (context.isCurrent && !context.isCurrent()) return;
  const state = {
    root,
    trip,
    data,
    participants: Array.isArray(data?.participants) ? data.participants : [],
    canManageOperations,
    canManagePaymentMarker,
    readOnly: trip.status === "CANCELLED",
    filters: { search: "", status: "ALL", bus: "ALL", stop: "ALL" }
  };
  renderOperations(state);
}

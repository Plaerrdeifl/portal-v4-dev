import {
  call,
  closeAllDialogs,
  escapeAttr,
  escapeHtml,
  hasCapability,
  openDialog,
  showToast
} from "./common.js";

const WARNING_LABELS = {
  BOOKING_ALREADY_SPLIT_FIXED: "Buchung ist durch bestehende Zuordnungen bereits aufgeteilt.",
  BOOKING_SPLIT_REQUIRED: "Buchung kann nicht vollständig in einem Bus bleiben.",
  PREFERENCE_MISMATCH: "Buswunsch kann nicht vollständig erfüllt werden.",
  STOP_NO_COMPATIBLE_BUS: "Kein Bus bedient den erforderlichen Zustieg.",
  NO_CAPACITY: "Keine passende freie Buskapazität vorhanden.",
  FIXED_CAPACITY_OVERFLOW: "Bestehende Zuordnungen überschreiten bereits die Buskapazität.",
  EXISTING_ASSIGNMENT_INVALID_BUS: "Eine bestehende Zuordnung verweist auf einen ungültigen Bus.",
  EXISTING_ASSIGNMENT_STOP_INVALID: "Eine bestehende Zuordnung passt nicht zur Zustiegsstelle."
};

const EXPLANATION_LABELS = {
  BOOKING_KEPT_TOGETHER: "Buchung wird zusammengehalten.",
  EXISTING_BOOKING_BUS_PREFERRED: "Bestehender Bus der Buchung wurde bevorzugt.",
  BOOKING_SPLIT_ONLY_AFTER_NO_WHOLE_BUS: "Aufteilung erst, weil kein gemeinsamer Bus verfügbar ist.",
  PREFERENCE_MATCHED: "Buswunsch wird erfüllt.",
  EGAL_FLEXIBLE: "EGAL wird flexibel verteilt.",
  VALID_FALLBACK_BUS: "Gültiger Ausweichbus nach Präferenzregeln.",
  NO_VALID_BUS_AVAILABLE: "Aktuell kein gültiger Bus verfügbar.",
  EXISTING_ASSIGNMENT_PROTECTED: "Bestehende Zuordnung bleibt geschützt."
};

let activeTripId = "";
let activeTripLabel = "Fanbusfahrt";
let participantTrigger = null;

function injectStyles() {
  if (document.getElementById("m320R3AutoAssignmentStyles")) return;
  const style = document.createElement("style");
  style.id = "m320R3AutoAssignmentStyles";
  style.textContent = `
    .m320-r3-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin:0 0 14px;padding:13px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface-soft,#f5f7fa)}
    .m320-r3-entry-copy{display:grid;gap:3px;min-width:0}.m320-r3-entry-copy p{margin:0;color:var(--muted,#718096)}
    .m320-r3-preview{display:grid;gap:14px}.m320-r3-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .m320-r3-metric{display:grid;gap:2px;padding:10px;border:1px solid var(--line,#d8e2ee);border-radius:12px;background:var(--surface,#fff)}
    .m320-r3-metric small{color:var(--muted,#718096)}.m320-r3-metric strong{font-size:1.12rem}
    .m320-r3-bus-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.m320-r3-bus{display:grid;gap:4px;padding:10px;border:1px solid var(--line,#d8e2ee);border-radius:12px}
    .m320-r3-bus-head,.m320-r3-person-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.m320-r3-bus small,.m320-r3-person small{color:var(--muted,#718096)}
    .m320-r3-list{display:grid;gap:8px}.m320-r3-person{display:grid;gap:8px;padding:11px;border:1px solid var(--line,#d8e2ee);border-radius:12px;background:var(--surface,#fff)}
    .m320-r3-person select{width:100%;min-width:0}.m320-r3-tags{display:flex;flex-wrap:wrap;gap:5px}.m320-r3-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--surface-soft,#f5f7fa);font-size:.77rem;font-weight:700}
    .m320-r3-tag.warning{background:rgba(173,115,0,.12);color:#7b5400}.m320-r3-tag.auto{background:rgba(24,118,211,.1);color:var(--primary,#1876d3)}
    .m320-r3-tag.manual{background:rgba(111,66,193,.1);color:#6941b7}.m320-r3-conflicts{display:grid;gap:6px}.m320-r3-conflicts .notice{margin:0}
    @media(max-width:620px){.m320-r3-entry{grid-template-columns:1fr}.m320-r3-entry .button{width:100%}.m320-r3-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.m320-r3-bus-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function participantName(registrations, participantId) {
  const row = registrations.find(item => item.id === participantId);
  const name = `${row?.firstName || ""} ${row?.lastName || ""}`.trim();
  return name || "Teilnehmer";
}

function busName(buses, busId) {
  if (!busId) return "Nicht zugeordnet";
  return buses.find(bus => bus.busId === busId)?.label || "Unbekannter Bus";
}

function outcomeLabel(value) {
  return { MATCHED: "Wunsch erfüllt", MISMATCHED: "Abweichung", FLEXIBLE: "Flexibel" }[value] || "–";
}

function stateLabel(proposal) {
  if (proposal.assignmentState === "FIXED_MANUAL") return "MANUAL · fixiert";
  if (proposal.assignmentState === "EXISTING_AUTO") return "AUTO · bestehend";
  return "AUTO · Vorschlag";
}

function codesMarkup(codes, labels, type = "") {
  return (Array.isArray(codes) ? codes : []).map(code =>
    `<span class="m320-r3-tag ${escapeAttr(type)}" title="${escapeAttr(code)}">${escapeHtml(labels[code] || code)}</span>`
  ).join("");
}

function busOptions(buses, selected) {
  return [`<option value="">Nicht zuordnen</option>`, ...buses.map(bus =>
    `<option value="${escapeAttr(bus.busId)}"${bus.busId === selected ? " selected" : ""}>${escapeHtml(`${bus.label} · ${bus.category} · ${bus.freeAfter} frei nach Vorschlag`)}</option>`
  )].join("");
}

function previewMarkup(preview, registrations) {
  const buses = Array.isArray(preview?.buses) ? preview.buses : [];
  const proposals = Array.isArray(preview?.participantProposals) ? preview.participantProposals : [];
  const conflicts = Array.isArray(preview?.conflicts) ? preview.conflicts : [];
  const summary = preview?.summary || {};

  const busCards = buses.map(bus => `<article class="m320-r3-bus">
    <div class="m320-r3-bus-head"><strong>${escapeHtml(bus.label)}</strong><span class="badge neutral">${escapeHtml(bus.category)}</span></div>
    <small>${escapeHtml(bus.existingOccupancy)} bestehend · ${escapeHtml(bus.proposedNew)} neu vorgeschlagen</small>
    <strong>${escapeHtml(bus.afterApply)}/${escapeHtml(bus.capacity)} belegt · ${escapeHtml(bus.freeAfter)} frei</strong>
    <small>${escapeHtml(bus.matchedSpecific)} Wunsch erfüllt · ${escapeHtml(bus.mismatchedSpecific)} Abweichung</small>
  </article>`).join("");

  const personCards = proposals.map(proposal => {
    const editable = proposal.assignmentState === "PROPOSED_AUTO";
    const sourceType = proposal.assignmentState === "FIXED_MANUAL" ? "manual" : "auto";
    return `<article class="m320-r3-person" data-m320-r3-participant="${escapeAttr(proposal.participantId)}">
      <div class="m320-r3-person-head">
        <div><strong>${escapeHtml(participantName(registrations, proposal.participantId))}</strong><br><small>Wunsch ${escapeHtml(proposal.busPreference)} · ${escapeHtml(outcomeLabel(proposal.preferenceOutcome))}</small></div>
        <span class="m320-r3-tag ${sourceType}">${escapeHtml(stateLabel(proposal))}</span>
      </div>
      ${editable ? `<label>Vorgeschlagener Bus
        <select name="assignment_${escapeAttr(proposal.participantId)}" data-m320-r3-assignment="${escapeAttr(proposal.participantId)}">
          ${busOptions(buses, proposal.proposedBusId)}
        </select>
        <small>Eine Änderung gegenüber dem Auto-Vorschlag wird beim Apply serverseitig als MANUAL gespeichert. Kapazität und Zustieg werden beim Apply erneut serverseitig geprüft.</small>
      </label>` : `<div><small>Bestehende Zuordnung</small><br><strong>${escapeHtml(busName(buses, proposal.currentBusId))}</strong></div>`}
      <div class="m320-r3-tags">${codesMarkup(proposal.warnings, WARNING_LABELS, "warning")}${codesMarkup(proposal.explanations, EXPLANATION_LABELS)}</div>
    </article>`;
  }).join("");

  const conflictMarkup = conflicts.map(conflict => `<div class="notice ${conflict.severity === "BLOCKING" ? "error" : "warning"}">
    <strong>${escapeHtml(conflict.severity === "BLOCKING" ? "Blockierender Konflikt" : "Hinweis")}</strong>
    <p>${escapeHtml(WARNING_LABELS[conflict.code] || conflict.code)}</p>
  </div>`).join("");

  return `<form class="m320-r3-preview" data-m320-r3-preview-form>
    <div class="m320-r3-summary">
      <div class="m320-r3-metric"><small>Offen</small><strong>${escapeHtml(summary.participantsToAssign ?? 0)}</strong></div>
      <div class="m320-r3-metric"><small>Auto-Vorschläge</small><strong>${escapeHtml(summary.assignedAutomatically ?? 0)}</strong></div>
      <div class="m320-r3-metric"><small>Bestehend</small><strong>${escapeHtml(summary.existingAssigned ?? 0)}</strong></div>
      <div class="m320-r3-metric"><small>MANUAL fixiert</small><strong>${escapeHtml(summary.fixedManual ?? 0)}</strong></div>
      <div class="m320-r3-metric"><small>Abweichungen</small><strong>${escapeHtml(summary.preferenceMismatched ?? 0)}</strong></div>
      <div class="m320-r3-metric"><small>Unzugeordnet</small><strong>${escapeHtml(summary.unassigned ?? 0)}</strong></div>
    </div>
    ${conflictMarkup ? `<section class="m320-r3-conflicts">${conflictMarkup}</section>` : ""}
    <section><h3>Busse</h3><div class="m320-r3-bus-grid">${busCards || "<p>Keine aktiven Busse vorhanden.</p>"}</div></section>
    <section><h3>Zuordnungen</h3><div class="m320-r3-list">${personCards || "<p>Keine ACTIVE-Teilnehmer vorhanden.</p>"}</div></section>
    <p class="subtle">Algorithmus ${escapeHtml(preview.algorithmVersion || "–")} · bestehende MANUAL- und AUTO-Zuordnungen werden nicht automatisch verändert.</p>
  </form>`;
}

function normalizeApplyError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("FANBUS_ASSIGNMENT_PREVIEW_STALE")) return new Error("Daten haben sich geändert. Bitte Zuordnung neu berechnen.");
  if (message.includes("FANBUS_BUS_CAPACITY_EXHAUSTED")) return new Error("Die gewählte Busverteilung überschreitet eine Buskapazität.");
  if (message.includes("FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP")) return new Error("Mindestens ein gewählter Bus bedient den erforderlichen Zustieg nicht.");
  if (message.includes("PLATFORM_READ_ONLY") || message.includes("P0902")) return new Error("Das Portal ist aktuell schreibgeschützt. Die Vorschau ist möglich, Anwenden jedoch nicht.");
  return error instanceof Error ? error : new Error(message || "Zuordnung konnte nicht angewendet werden.");
}

function reopenParticipantDialog() {
  const trigger = participantTrigger;
  setTimeout(() => {
    closeAllDialogs();
    setTimeout(() => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.click();
    }, 0);
  }, 0);
}

async function openAssignmentPreview() {
  const [preview, registrationData] = await Promise.all([
    call("fanbus_assignment_preview", { tripId: activeTripId }),
    call("fanbus_registrations_list", { tripId: activeTripId })
  ]);
  const registrations = Array.isArray(registrationData?.registrations) ? registrationData.registrations : [];
  const proposals = Array.isArray(preview?.participantProposals) ? preview.participantProposals : [];
  const editable = proposals.filter(item => item.assignmentState === "PROPOSED_AUTO");

  openDialog({
    title: "Automatische Buszuordnung",
    kicker: activeTripLabel,
    body: previewMarkup(preview, registrations),
    submitLabel: preview.canApply ? "Zuordnung anwenden" : "Keine Zuordnung anwendbar",
    onSubmit: preview.canApply ? async values => {
      const finalAssignments = editable.map(proposal => ({
        participantId: proposal.participantId,
        busId: values[`assignment_${proposal.participantId}`] || null
      }));
      try {
        const result = await call("fanbus_assignment_apply", {
          tripId: activeTripId,
          algorithmVersion: preview.algorithmVersion,
          inputFingerprint: preview.inputFingerprint,
          finalAssignments
        });
        showToast(`${Number(result?.applied || 0)} Buszuordnung(en) wurden gespeichert.`, "success", 4200);
        reopenParticipantDialog();
      } catch (error) {
        throw normalizeApplyError(error);
      }
    } : null,
    preserveParentOnSubmit: true
  });
}

function mountEntry() {
  if (!activeTripId || !hasCapability("fanbus.registrations.manage")) return;
  const dialog = document.getElementById("v4Dialog");
  const body = dialog?.querySelector("#v4DialogBody");
  const title = dialog?.querySelector("#v4DialogTitle")?.textContent || "";
  if (!dialog?.open || !body || title !== "Teilnehmer und Anmeldungen") return;
  if (body.querySelector("[data-m320-r3-auto-assignment-entry]")) return;
  injectStyles();

  const section = document.createElement("section");
  section.className = "m320-r3-entry";
  section.dataset.m320R3AutoAssignmentEntry = "";
  section.innerHTML = `<div class="m320-r3-entry-copy">
    <strong>Automatische Buszuordnung</strong>
    <p>Berechnet nur für noch nicht zugeordnete ACTIVE-Teilnehmer einen transparenten Vorschlag. Bestehende Zuordnungen bleiben stabil.</p>
  </div>
  <button class="button primary" type="button" data-m320-r3-preview>Zuordnung berechnen</button>`;

  section.querySelector("[data-m320-r3-preview]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Wird berechnet …";
    try {
      await openAssignmentPreview();
    } catch (error) {
      showToast(error?.message || "Zuordnung konnte nicht berechnet werden.", "error", 5200);
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  });

  body.prepend(section);
}

function scheduleMount() {
  requestAnimationFrame(() => {
    mountEntry();
    setTimeout(mountEntry, 80);
  });
}

document.addEventListener("click", event => {
  const trigger = event.target.closest?.("[data-m310-participants]");
  if (!trigger) return;
  activeTripId = String(trigger.dataset.m310Participants || "").trim();
  activeTripLabel = trigger.closest("[data-m310-open-trip],.v4-m310-mobile-trip-card")?.querySelector("strong")?.textContent?.trim() || "Fanbusfahrt";
  participantTrigger = trigger;
  scheduleMount();
}, true);

new MutationObserver(scheduleMount).observe(document.body, { childList: true, subtree: true });

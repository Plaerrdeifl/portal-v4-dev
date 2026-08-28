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
    .m320-r3-entry{width:100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;margin:0 0 14px;padding:15px 16px;border:1px solid var(--primary,#1876d3);border-radius:14px;background:var(--primary,#1876d3);color:#fff;text-align:left;font:inherit;cursor:pointer;overflow:hidden;box-sizing:border-box;box-shadow:none}
    .m320-r3-entry:hover{background:var(--primary,#1876d3)}.m320-r3-entry:disabled{cursor:wait;opacity:.72}.m320-r3-entry:focus{outline:none;box-shadow:none}.m320-r3-entry-copy{display:grid;gap:3px;min-width:0;max-width:100%;overflow:hidden}.m320-r3-entry-copy strong{font-size:1rem;color:#fff;min-width:0;overflow-wrap:anywhere}.m320-r3-entry-copy p{margin:0;color:rgba(255,255,255,.86);min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.35}.m320-r3-entry-chevron{flex:0 0 auto;font-size:1.55rem;font-weight:800;line-height:1;color:#fff}
    .m320-r3-preview{display:grid;gap:20px}.m320-r3-overview{display:grid;gap:5px;padding:14px 0;border-bottom:1px solid var(--line,#d8e2ee)}
    .m320-r3-overview strong{font-size:1.14rem}.m320-r3-overview small,.m320-r3-section-head small,.m320-r3-bus-row small,.m320-r3-work-card small,.m320-r3-existing-row small{color:var(--muted,#718096)}
    .m320-r3-overview-meta{display:flex;flex-wrap:wrap;gap:6px 12px}.m320-r3-overview-warning{color:#7b5400!important;font-weight:700}
    .m320-r3-section{display:grid;gap:10px}.m320-r3-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.m320-r3-section-head h3{margin:0}
    .m320-r3-bus-list,.m320-r3-work-list,.m320-r3-existing-list{display:grid;gap:8px}.m320-r3-bus-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line,#d8e2ee)}
    .m320-r3-bus-row:last-child{border-bottom:0}.m320-r3-bus-copy{display:grid;gap:2px;min-width:0}.m320-r3-bus-stat{text-align:right;white-space:nowrap}
    .m320-r3-work-card{display:grid;gap:10px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff)}
    .m320-r3-work-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.m320-r3-work-card select{width:100%;min-width:0}.m320-r3-tags{display:flex;flex-wrap:wrap;gap:5px}.m320-r3-tag{display:inline-flex;padding:3px 7px;border-radius:999px;background:var(--surface-soft,#f5f7fa);font-size:.77rem;font-weight:700}
    .m320-r3-tag.warning{background:rgba(173,115,0,.12);color:#7b5400}.m320-r3-tag.auto{background:rgba(24,118,211,.1);color:var(--primary,#1876d3)}.m320-r3-tag.manual{background:rgba(111,66,193,.1);color:#6941b7}
    .m320-r3-existing-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border:0;border-bottom:1px solid var(--line,#d8e2ee);border-radius:0;background:transparent;color:inherit;text-align:left;font:inherit}
    .m320-r3-existing-row:last-child{border-bottom:0}.m320-r3-existing-copy{display:grid;gap:2px;min-width:0}.m320-r3-existing-meta{display:flex;align-items:center;gap:8px;flex:0 0 auto}.m320-r3-existing-row .v4-row-chevron{font-size:1.5rem}
    .m320-r3-conflicts{display:grid;gap:6px}.m320-r3-conflicts .notice{margin:0}.m320-r3-detail{display:grid;gap:14px}.m320-r3-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.m320-r3-detail-grid>div{display:grid;gap:3px}.m320-r3-detail-grid span{color:var(--muted,#718096);font-size:.82rem}.m320-r3-detail-tags{display:grid;gap:8px}
    @media(max-width:620px){.m320-r3-detail-grid{grid-template-columns:1fr}.m320-r3-bus-row{align-items:flex-start}.m320-r3-bus-stat{font-size:.92rem}}
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
  if (proposal.assignmentState === "FIXED_MANUAL") return "MANUAL";
  if (proposal.assignmentState === "EXISTING_AUTO") return "AUTO";
  return "Vorschlag";
}

function codesMarkup(codes, labels, type = "") {
  return (Array.isArray(codes) ? codes : []).map(code =>
    `<span class="m320-r3-tag ${escapeAttr(type)}" title="${escapeAttr(code)}">${escapeHtml(labels[code] || code)}</span>`
  ).join("");
}

function busOptions(buses, selected) {
  return [`<option value="">Nicht zuordnen</option>`, ...buses.map(bus =>
    `<option value="${escapeAttr(bus.busId)}"${bus.busId === selected ? " selected" : ""}>${escapeHtml(`${bus.label} · ${bus.category} · ${bus.freeAfter} frei`)}</option>`
  )].join("");
}

function proposalDetailMarkup(proposal, buses) {
  const warnings = codesMarkup(proposal.warnings, WARNING_LABELS, "warning");
  const explanations = codesMarkup(proposal.explanations, EXPLANATION_LABELS);
  return `<div class="m320-r3-detail">
    <div class="m320-r3-detail-grid">
      <div><span>Status</span><strong>${escapeHtml(stateLabel(proposal))}</strong></div>
      <div><span>Bus</span><strong>${escapeHtml(busName(buses, proposal.currentBusId || proposal.proposedBusId))}</strong></div>
      <div><span>Buswunsch</span><strong>${escapeHtml(proposal.busPreference || "EGAL")}</strong></div>
      <div><span>Ergebnis</span><strong>${escapeHtml(outcomeLabel(proposal.preferenceOutcome))}</strong></div>
    </div>
    ${warnings || explanations ? `<div class="m320-r3-detail-tags"><div class="m320-r3-tags">${warnings}</div><div class="m320-r3-tags">${explanations}</div></div>` : ""}
    ${proposal.assignmentState !== "PROPOSED_AUTO" ? '<p class="subtle">Diese bestehende Zuordnung bleibt durch den automatischen Lauf unverändert.</p>' : ""}
  </div>`;
}

function previewMarkup(preview, registrations) {
  const buses = Array.isArray(preview?.buses) ? preview.buses : [];
  const proposals = Array.isArray(preview?.participantProposals) ? preview.participantProposals : [];
  const conflicts = Array.isArray(preview?.conflicts) ? preview.conflicts : [];
  const summary = preview?.summary || {};
  const editable = proposals.filter(item => item.assignmentState === "PROPOSED_AUTO");
  const existing = proposals.filter(item => item.assignmentState !== "PROPOSED_AUTO");
  const mismatches = Number(summary.preferenceMismatched || 0);
  const unassigned = Number(summary.unassigned || 0);

  const busRows = buses.map(bus => `<div class="m320-r3-bus-row">
    <div class="m320-r3-bus-copy"><strong>${escapeHtml(bus.label)}</strong><small>${escapeHtml(bus.category)} · ${escapeHtml(bus.existingOccupancy)} bereits zugeordnet${Number(bus.proposedNew) ? ` · ${escapeHtml(bus.proposedNew)} neu` : ""}</small></div>
    <strong class="m320-r3-bus-stat">${escapeHtml(bus.afterApply)}/${escapeHtml(bus.capacity)} · ${escapeHtml(bus.freeAfter)} frei</strong>
  </div>`).join("");

  const workCards = editable.map(proposal => {
    const warnings = codesMarkup(proposal.warnings, WARNING_LABELS, "warning");
    return `<article class="m320-r3-work-card" data-m320-r3-participant="${escapeAttr(proposal.participantId)}">
      <div class="m320-r3-work-head">
        <div><strong>${escapeHtml(participantName(registrations, proposal.participantId))}</strong><br><small>Wunsch ${escapeHtml(proposal.busPreference)} · ${escapeHtml(outcomeLabel(proposal.preferenceOutcome))}</small></div>
        <span class="m320-r3-tag auto">Vorschlag</span>
      </div>
      <label>Bus
        <select name="assignment_${escapeAttr(proposal.participantId)}" data-m320-r3-assignment="${escapeAttr(proposal.participantId)}">
          ${busOptions(buses, proposal.proposedBusId)}
        </select>
      </label>
      ${warnings ? `<div class="m320-r3-tags">${warnings}</div>` : ""}
      <small>Änderst du den vorgeschlagenen Bus, wird diese Zuordnung als MANUAL gespeichert.</small>
    </article>`;
  }).join("");

  const existingRows = existing.map(proposal => {
    const warning = (Array.isArray(proposal.warnings) ? proposal.warnings : []).includes("PREFERENCE_MISMATCH");
    return `<button class="m320-r3-existing-row" type="button" data-m320-r3-existing-detail="${escapeAttr(proposal.participantId)}">
      <span class="m320-r3-existing-copy"><strong>${escapeHtml(participantName(registrations, proposal.participantId))}</strong><small>${escapeHtml(busName(buses, proposal.currentBusId))}${warning ? " · Buswunsch weicht ab" : ""}</small></span>
      <span class="m320-r3-existing-meta"><span class="m320-r3-tag ${proposal.assignmentState === "FIXED_MANUAL" ? "manual" : "auto"}">${escapeHtml(stateLabel(proposal))}</span><span class="v4-row-chevron" aria-hidden="true">›</span></span>
    </button>`;
  }).join("");

  const conflictMarkup = conflicts.map(conflict => `<div class="notice ${conflict.severity === "BLOCKING" ? "error" : "warning"}">
    <strong>${escapeHtml(conflict.severity === "BLOCKING" ? "Blockierender Konflikt" : "Hinweis")}</strong>
    <p>${escapeHtml(WARNING_LABELS[conflict.code] || conflict.code)}</p>
  </div>`).join("");

  const newCount = Number(summary.assignedAutomatically ?? editable.length ?? 0);
  const existingCount = Number(summary.existingAssigned ?? existing.length ?? 0);

  return `<form class="m320-r3-preview" data-m320-r3-preview-form>
    <section class="m320-r3-overview">
      <strong>${escapeHtml(newCount)} ${newCount === 1 ? "neue Zuordnung" : "neue Zuordnungen"} vorgeschlagen</strong>
      <div class="m320-r3-overview-meta">
        <small>${escapeHtml(existingCount)} bestehende ${existingCount === 1 ? "Zuordnung bleibt" : "Zuordnungen bleiben"} unverändert</small>
        ${mismatches ? `<small class="m320-r3-overview-warning">${escapeHtml(mismatches)} ${mismatches === 1 ? "Buswunsch weicht ab" : "Buswünsche weichen ab"}</small>` : ""}
        ${unassigned ? `<small class="m320-r3-overview-warning">${escapeHtml(unassigned)} ${unassigned === 1 ? "Person bleibt unzugeordnet" : "Personen bleiben unzugeordnet"}</small>` : ""}
      </div>
    </section>
    ${conflictMarkup ? `<section class="m320-r3-conflicts">${conflictMarkup}</section>` : ""}
    <section class="m320-r3-section"><div class="m320-r3-section-head"><h3>Busse</h3><small>Belegung nach Anwendung</small></div><div class="m320-r3-bus-list">${busRows || "<p>Keine aktiven Busse vorhanden.</p>"}</div></section>
    ${editable.length ? `<section class="m320-r3-section"><div class="m320-r3-section-head"><h3>Neu zuordnen</h3><small>${editable.length} ${editable.length === 1 ? "Person" : "Personen"}</small></div><div class="m320-r3-work-list">${workCards}</div></section>` : ""}
    ${existing.length ? `<section class="m320-r3-section"><div class="m320-r3-section-head"><h3>Bereits zugeordnet</h3><small>Antippen für Details</small></div><div class="m320-r3-existing-list">${existingRows}</div></section>` : ""}
    <p class="subtle">Bestehende MANUAL- und AUTO-Zuordnungen werden nicht automatisch verändert.</p>
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

  const dialog = openDialog({
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

  dialog.querySelectorAll("[data-m320-r3-existing-detail]").forEach(button => {
    button.addEventListener("click", () => {
      const proposal = proposals.find(item => item.participantId === button.dataset.m320R3ExistingDetail);
      if (!proposal) return;
      openDialog({
        title: participantName(registrations, proposal.participantId),
        kicker: "Buszuordnung",
        body: proposalDetailMarkup(proposal, Array.isArray(preview?.buses) ? preview.buses : [])
      });
    });
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

  const section = document.createElement("button");
  section.type = "button";
  section.tabIndex = -1;
  section.className = "m320-r3-entry";
  section.dataset.m320R3AutoAssignmentEntry = "";
  section.dataset.m320R3Preview = "";
  section.innerHTML = `<span class="m320-r3-entry-copy">
    <strong>Automatische Buszuordnung</strong>
    <p>Neue Teilnehmer automatisch auf die verfügbaren Busse verteilen.</p>
  </span>
  <span class="m320-r3-entry-chevron" aria-hidden="true">›</span>`;

  section.addEventListener("focus", () => section.blur());
  section.addEventListener("click", async () => {
    section.disabled = true;
    section.setAttribute("aria-busy", "true");
    const copy = section.querySelector("p");
    const original = copy?.textContent || "";
    if (copy) copy.textContent = "Zuordnung wird berechnet …";
    try {
      await openAssignmentPreview();
    } catch (error) {
      showToast(error?.message || "Zuordnung konnte nicht berechnet werden.", "error", 5200);
    } finally {
      if (section.isConnected) {
        section.disabled = false;
        section.removeAttribute("aria-busy");
        if (copy) copy.textContent = original;
      }
    }
  });

  body.prepend(section);
  requestAnimationFrame(() => {
    if (document.activeElement === section) section.blur();
  });
  setTimeout(() => {
    if (document.activeElement === section) section.blur();
  }, 90);
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
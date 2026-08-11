import { auth } from "../auth.js";
import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  fmtDate,
  fmtDateTime,
  openDialog,
  runWrite,
  showToast
} from "./common.js";
import { downloadMembershipApplicationPdf } from "./membership-application-pdf.js";

const APPLICATION_STATUS = Object.freeze({
  PENDING: { label: "Offen", type: "warning" },
  APPROVED: { label: "Angenommen", type: "success" },
  REJECTED: { label: "Abgelehnt", type: "danger" },
  WITHDRAWN: { label: "Zurückgezogen", type: "neutral" }
});

const DECISION_METHOD = Object.freeze({
  VOTE_MAJORITY: "Abstimmungsmehrheit",
  SEVEN_DAY_MANUAL: "Manuelle Entscheidung nach 7 Tagen"
});

const CONVERSION_MODE = Object.freeze({
  NEW_MEMBER: "Neues Mitglied angelegt",
  REACTIVATE_EXISTING: "Bestehendes Mitglied reaktiviert",
  RESOLVE_EXISTING_ACTIVE: "Bestehendem aktiven Mitglied zugeordnet"
});

const ERROR_MESSAGES = Object.freeze({
  M150_BOARD_INCOMPLETE: "Der aktuelle Vorstand ist nicht vollständig besetzt. Der Antrag kann derzeit nicht bearbeitet werden.",
  M150_BOARD_SNAPSHOT_INCOMPLETE: "Der bei Antragseingang gespeicherte Vorstand ist unvollständig. Bitte Projektverantwortliche informieren.",
  M150_BOARD_ROSTER_CHANGED: "Die Vorstandsbesetzung hat sich seit Antragseingang geändert. Dieser Antrag benötigt eine fachliche Klärung.",
  M150_DECISIVE_NO_REASON_REQUIRED: "Für die entscheidende dritte Nein-Stimme ist ein interner Ablehnungsgrund erforderlich.",
  M150_SEVEN_DAY_PERIOD_NOT_REACHED: "Die manuelle Entscheidung ist erst nach Ablauf der serverseitig geprüften 7-Tage-Frist möglich.",
  M150_MAJORITY_MUST_NOT_BE_OVERWRITTEN: "Eine bereits feststehende Mehrheit darf nicht durch eine manuelle Entscheidung überschrieben werden.",
  M150_REVISION_CONFLICT: "Der Antrag wurde zwischenzeitlich geändert. Die aktuellen Daten werden neu geladen.",
  M150_APPLICATION_ALREADY_CONVERTED: "Der Antrag wurde bereits übernommen.",
  M150_CONVERSION_REQUIRES_APPROVED: "Nur angenommene Anträge können als Mitglied übernommen werden.",
  M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER: "Das ausgewählte Mitglied ist nicht mehr inaktiv.",
  M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER: "Das ausgewählte Mitglied ist nicht aktiv.",
  M150_TARGET_MEMBER_NOT_FOUND: "Das ausgewählte Mitglied wurde nicht mehr gefunden.",
  M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW: "Dieses ehemalige Mitglied ist noch einem Vorstandsamt zugeordnet. Die Amtszuordnung muss zuerst bewusst im Bereich ‚Vorstand‘ geklärt werden. M150 reaktiviert keine Ämter automatisch.",
  M150_VOTE_ALREADY_EXISTS: "Für diesen Antrag wurde die eigene Stimme bereits abgegeben.",
  M150_APPLICATION_ALREADY_DECIDED: "Der Antrag wurde bereits entschieden.",
  M150_APPLICATION_ALREADY_WITHDRAWN: "Der Antrag wurde bereits als zurückgezogen markiert.",
  M150_WITHDRAW_REQUIRES_PENDING: "Nur offene Anträge können als zurückgezogen markiert werden."
});

const REFRESH_AFTER_ERROR = new Set([
  "M150_DECISIVE_NO_REASON_REQUIRED",
  "M150_SEVEN_DAY_PERIOD_NOT_REACHED",
  "M150_MAJORITY_MUST_NOT_BE_OVERWRITTEN",
  "M150_REVISION_CONFLICT",
  "M150_APPLICATION_ALREADY_CONVERTED",
  "M150_CONVERSION_REQUIRES_APPROVED",
  "M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER",
  "M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER",
  "M150_TARGET_MEMBER_NOT_FOUND",
  "M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW",
  "M150_VOTE_ALREADY_EXISTS",
  "M150_APPLICATION_ALREADY_DECIDED",
  "M150_APPLICATION_ALREADY_WITHDRAWN",
  "M150_WITHDRAW_REQUIRES_PENDING"
]);

let applications = [];
let statusFilter = "PENDING";
let nameSearch = "";
let memberSnapshot = [];
let refreshFanclubMembers = null;
let panelNode = null;
let activeDetailId = "";
let loadSequence = 0;

function applicationName(application) {
  return String(
    application?.name
      || `${application?.firstName || ""} ${application?.lastName || ""}`
  ).trim() || "Unbekannte Person";
}

function memberName(member) {
  return `${member?.firstName || ""} ${member?.lastName || ""}`.trim()
    || "Unbekanntes Mitglied";
}

function statusMeta(status) {
  return APPLICATION_STATUS[String(status || "").toUpperCase()]
    || { label: String(status || "–"), type: "neutral" };
}

function applicationStatusBadge(status) {
  const meta = statusMeta(status);
  return `<span class="badge ${meta.type}">${escapeHtml(meta.label)}</span>`;
}

function voteBadge(vote) {
  if (vote === "YES") return '<span class="badge success">Ja</span>';
  if (vote === "NO") return '<span class="badge danger">Nein</span>';
  return '<span class="badge neutral">Noch keine Stimme</span>';
}

function booleanLabel(value) {
  return value === true ? "Bestätigt" : value === false ? "Nicht bestätigt" : "–";
}

function voteSummary(application) {
  const hasCounts = [
    application?.yesVotes,
    application?.noVotes,
    application?.missingVotes
  ].some(value => value !== undefined && value !== null);

  if (!hasCounts) return "";
  return `<span class="v4-m150-vote-summary">Ja ${Number(application.yesVotes || 0)} · Nein ${Number(application.noVotes || 0)} · Offen ${Number(application.missingVotes || 0)}</span>`;
}

function filteredApplications() {
  const query = nameSearch.trim().toLocaleLowerCase("de-DE");
  return applications.filter(application => {
    const matchesStatus = statusFilter === "ALL" || application.status === statusFilter;
    const matchesName = !query
      || applicationName(application).toLocaleLowerCase("de-DE").includes(query);
    return matchesStatus && matchesName;
  });
}

function renderApplicationList() {
  if (!panelNode) return;
  const visible = filteredApplications();

  panelNode.innerHTML = `
    <div class="v4-heading-row v4-section-heading">
      <div>
        <h3>Mitgliedsanträge</h3>
        <p>Interne Bearbeitung durch den aktuellen Vorstand</p>
      </div>
    </div>
    <div class="v4-list-filterbar">
      <label class="v4-compact-search">
        <span class="sr-only">Mitgliedsanträge durchsuchen</span>
        <input id="membershipApplicationSearch" type="search" placeholder="Namen durchsuchen …" autocomplete="off" value="${escapeAttr(nameSearch)}">
      </label>
      <label class="v4-filter-field">Status
        <select id="membershipApplicationStatusFilter">
          <option value="PENDING" ${statusFilter === "PENDING" ? "selected" : ""}>Offen</option>
          <option value="APPROVED" ${statusFilter === "APPROVED" ? "selected" : ""}>Angenommen</option>
          <option value="REJECTED" ${statusFilter === "REJECTED" ? "selected" : ""}>Abgelehnt</option>
          <option value="WITHDRAWN" ${statusFilter === "WITHDRAWN" ? "selected" : ""}>Zurückgezogen</option>
          <option value="ALL" ${statusFilter === "ALL" ? "selected" : ""}>Alle</option>
        </select>
      </label>
    </div>
    ${visible.length ? `
      <div class="v4-table-wrap v4-desktop-table">
        <table class="v4-table v4-m150-table">
          <thead><tr><th>Name</th><th>Eingang</th><th>Abstimmung</th><th>Status</th><th></th></tr></thead>
          <tbody>${visible.map(application => `<tr>
            <td><strong>${escapeHtml(applicationName(application))}</strong></td>
            <td>${escapeHtml(fmtDateTime(application.submittedAt))}</td>
            <td>${voteSummary(application) || "–"}</td>
            <td>${applicationStatusBadge(application.status)}</td>
            <td><button class="button small secondary v4-row-action" type="button" data-membership-application-id="${escapeAttr(application.id)}">Details <span aria-hidden="true">›</span></button></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="v4-mobile-records v4-compact-record-list" aria-label="Mitgliedsanträge">
        ${visible.map(application => `<button class="v4-compact-record" type="button" data-membership-application-id="${escapeAttr(application.id)}">
          <span class="v4-compact-record-copy">
            <small>Eingang ${escapeHtml(fmtDate(application.submittedAt))}</small>
            <strong>${escapeHtml(applicationName(application))}</strong>
            ${voteSummary(application)}
          </span>
          <span class="v4-compact-record-end">${applicationStatusBadge(application.status)}</span>
          <span class="v4-row-chevron" aria-hidden="true">›</span>
        </button>`).join("")}
      </div>
    ` : empty(applications.length ? "Keine Anträge entsprechen dem gewählten Filter." : "Noch keine Mitgliedsanträge vorhanden.")}`;

  document.getElementById("membershipApplicationSearch")
    ?.addEventListener("input", event => {
      nameSearch = event.currentTarget.value;
      renderApplicationList();
      document.getElementById("membershipApplicationSearch")?.focus({ preventScroll: true });
    });

  document.getElementById("membershipApplicationStatusFilter")
    ?.addEventListener("change", event => {
      statusFilter = event.currentTarget.value;
      renderApplicationList();
    });

  panelNode.querySelectorAll("[data-membership-application-id]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await openApplicationDetail(button.dataset.membershipApplicationId);
      } catch (error) {
        showToast(error?.message || "Der Antrag konnte nicht geladen werden.", "error", 6500);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadApplicationList() {
  applications = await call("membership_applications_list");
  return applications;
}

async function loadApplicationDetail(id) {
  return call("membership_application_detail", { id });
}

function duplicateGroups(detail) {
  const matches = detail?.matches || {};
  return [
    ["Mitglieder mit gleicher E-Mail", matches.membersByEmail || []],
    ["Mitglieder mit Identitätshinweis", matches.membersByIdentity || []],
    ["Mitglieder mit Telefonnummer-Hinweis", matches.membersByPhone || []],
    ["Portaluser mit gleicher E-Mail", matches.portalUsersByEmail || []],
    ["Weitere offene Anträge", matches.pendingApplications || []]
  ];
}

function hasDuplicateHints(detail) {
  return duplicateGroups(detail).some(([, items]) => items.length > 0);
}

function duplicateItemLabel(item) {
  const code = item.memberCode || item.userCode || "";
  const signals = Array.isArray(item.signals)
    ? item.signals.map(signal => ({
      EMAIL: "gleiche E-Mail",
      IDENTITY: "Identitätshinweis",
      PHONE: "Telefonnummer-Hinweis"
    })[signal] || signal).join(", ")
    : "";
  return [item.name || "Unbekannter Datensatz", code, signals].filter(Boolean).join(" · ");
}

function duplicateHintsMarkup(detail) {
  const groups = duplicateGroups(detail).filter(([, items]) => items.length > 0);
  if (!groups.length) return "";

  return `<section class="v4-m150-section v4-m150-hints">
    <div class="v4-dialog-section-title"><h3>Hinweise – keine automatische Zuordnung</h3></div>
    <p class="subtle">Diese Hinweise erfordern eine bewusste Prüfung und wählen keinen Datensatz aus.</p>
    <div class="v4-m150-hint-groups">${groups.map(([label, items]) => `<div>
      <strong>${escapeHtml(label)}</strong>
      <ul>${items.map(item => `<li>${escapeHtml(duplicateItemLabel(item))}</li>`).join("")}</ul>
    </div>`).join("")}</div>
  </section>`;
}

function applicationCoreMarkup(detail) {
  const address = [
    [detail.street, detail.houseNumber].filter(Boolean).join(" "),
    [detail.postalCode, detail.city].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ") || "–";

  return `<div class="v4-detail-grid v4-m150-person-grid">
    <div><span>Vorname</span><strong>${escapeHtml(detail.firstName || "–")}</strong></div>
    <div><span>Nachname</span><strong>${escapeHtml(detail.lastName || "–")}</strong></div>
    <div><span>Geburtsdatum</span><strong>${escapeHtml(fmtDate(detail.birthDate))}</strong></div>
    <div><span>E-Mail</span><strong>${escapeHtml(detail.email || "–")}</strong></div>
    <div><span>Handynummer</span><strong>${escapeHtml(detail.phone || "–")}</strong></div>
    <div class="full"><span>Adresse</span><strong>${escapeHtml(address)}</strong></div>
  </div>`;
}

function voteRosterMarkup(detail) {
  const currentUserId = String(auth.current().user?.id || "");
  const votes = Array.isArray(detail.votes) ? detail.votes : [];
  const missingVotes = Math.max(0, Number(detail.missingVotes || 0));
  const rows = votes.map(vote => {
    const own = currentUserId && String(vote.voterUserId) === currentUserId;
    return `<div class="v4-m150-vote-row ${own ? "is-own" : ""}">
      <span><strong>${escapeHtml(vote.voterName || "Vorstandsmitglied")}</strong>${own ? "<small>Eigene Stimme</small>" : ""}</span>
      <span>${voteBadge(vote.vote)}<small>${escapeHtml(fmtDateTime(vote.votedAt))}</small></span>
    </div>`;
  });

  for (let index = 0; index < missingVotes; index += 1) {
    rows.push(`<div class="v4-m150-vote-row is-missing"><span><strong>Vorstandsposition</strong><small>Serverseitiger Abstimmungsstand</small></span><span>${voteBadge(null)}</span></div>`);
  }

  return `<section class="v4-m150-section">
    <div class="v4-dialog-section-title"><h3>Abstimmung</h3><span>Ja ${Number(detail.yesVotes || 0)} · Nein ${Number(detail.noVotes || 0)}</span></div>
    <div class="v4-m150-own-vote">Eigene Stimme: <strong>${detail.ownVote ? (detail.ownVote === "YES" ? "Ja" : "Nein") : "noch nicht abgegeben"}</strong></div>
    <div class="v4-m150-votes">${rows.join("") || empty("Noch kein Abstimmungsstand vorhanden.")}</div>
  </section>`;
}

function decisionMarkup(detail) {
  if (!detail.decidedAt) return "";
  return `<section class="v4-m150-section">
    <div class="v4-dialog-section-title"><h3>Entscheidung</h3></div>
    <div class="v4-detail-grid">
      <div><span>Entschieden am</span><strong>${escapeHtml(fmtDateTime(detail.decidedAt))}</strong></div>
      <div><span>Entscheidungsart</span><strong>${escapeHtml(DECISION_METHOD[detail.decisionMethod] || detail.decisionMethod || "–")}</strong></div>
      <div class="full v4-m150-internal-reason"><span>${detail.status === "REJECTED" ? "Interner Ablehnungsgrund – wird nicht an den Antragsteller gesendet" : "Interner Entscheidungsgrund – nicht für den Antragsteller"}</span><strong class="v4-preserve-lines">${escapeHtml(detail.decisionReasonInternal || "–")}</strong></div>
      ${detail.status === "REJECTED" && detail.applicantNotice ? `<div class="full v4-m150-applicant-notice"><span>Separate Mitteilung an den Antragsteller</span><strong class="v4-preserve-lines">${escapeHtml(detail.applicantNotice)}</strong></div>` : ""}
    </div>
  </section>`;
}

function conversionMarkup(detail) {
  if (!detail.convertedAt) return "";
  const target = memberSnapshot.find(member => String(member.id) === String(detail.convertedMemberId));
  return `<section class="v4-m150-section v4-m150-conversion-complete">
    <div class="v4-dialog-section-title"><h3>Mitglied übernommen</h3></div>
    <div class="v4-detail-grid">
      <div><span>Conversion-Modus</span><strong>${escapeHtml(CONVERSION_MODE[detail.conversionMode] || detail.conversionMode || "–")}</strong></div>
      <div><span>Zeitpunkt</span><strong>${escapeHtml(fmtDateTime(detail.convertedAt))}</strong></div>
      <div class="full"><span>Zielmitglied</span><strong>${escapeHtml(target ? memberName(target) : detail.convertedMemberId || "–")}</strong></div>
    </div>
  </section>`;
}

function detailActionsMarkup(detail) {
  if (detail.status === "PENDING") {
    return `<section class="v4-m150-section v4-m150-actions">
      ${!detail.ownVote ? `<div>
        <h3>Eigene Stimme abgeben</h3>
        <p class="subtle">Eine abgegebene Stimme kann nicht geändert oder gelöscht werden.</p>
        <div class="dialog-actions v4-m150-inline-actions">
          <button class="button secondary" type="button" data-m150-vote="NO">Nein</button>
          <button class="button primary" type="button" data-m150-vote="YES">Ja</button>
        </div>
      </div>` : ""}
      ${detail.sevenDayDecisionAvailable === true ? `<div class="v4-m150-manual-decision">
        <h3>Manuelle Entscheidung nach 7 Tagen</h3>
        <p class="subtle">Die Verfügbarkeit wurde serverseitig geprüft.</p>
        <div class="dialog-actions v4-m150-inline-actions">
          <button class="button danger" type="button" data-m150-manual-decision="REJECTED">Ablehnen</button>
          <button class="button primary" type="button" data-m150-manual-decision="APPROVED">Aufnehmen</button>
        </div>
      </div>` : ""}
      <div class="v4-m150-withdrawal">
        <h3>Antrag zurückgezogen</h3>
        <p class="subtle">Nur verwenden, wenn der Antragsteller seinen Antrag außerhalb des Portals zurückgezogen hat. Der Rückzug beendet die Bearbeitung und kann in M150 R1 nicht rückgängig gemacht werden.</p>
        <div class="dialog-actions v4-m150-inline-actions">
          <button class="button danger" type="button" data-m150-withdraw>Als zurückgezogen markieren</button>
        </div>
      </div>
    </section>`;
  }

  if (detail.status === "APPROVED" && detail.convertedAt == null) {
    return `<section class="v4-m150-section v4-m150-actions">
      <div class="notice warning"><strong>Antrag angenommen – Mitglied noch nicht übernommen</strong><p>Die Übernahme erfordert eine ausdrückliche zweite Aktion.</p></div>
      <div class="dialog-actions v4-m150-inline-actions">
        <button class="button primary" type="button" data-m150-convert>Mitglied übernehmen</button>
      </div>
    </section>`;
  }

  return "";
}

function applicationDetailMarkup(detail) {
  return `<div class="v4-m150-detail">
    <section class="v4-m150-section">
      <div class="v4-dialog-section-title"><h3>Person</h3>${applicationStatusBadge(detail.status)}</div>
      ${applicationCoreMarkup(detail)}
    </section>
    <section class="v4-m150-section">
      <div class="v4-dialog-section-title"><h3>Antrag</h3></div>
      <div class="v4-detail-grid">
        <div><span>Eingangszeitpunkt</span><strong>${escapeHtml(fmtDateTime(detail.submittedAt))}</strong></div>
        <div><span>Status</span><strong>${applicationStatusBadge(detail.status)}</strong></div>
        <div><span>Erklärungsversion</span><strong>${escapeHtml(detail.declarationVersion || "–")}</strong></div>
        <div><span>Satzungsversion</span><strong>${escapeHtml(detail.statutesVersion || "–")}</strong></div>
        <div class="full"><span>Satzungsreferenz</span><strong>${escapeHtml(detail.statutesReference || "–")}</strong></div>
        <div><span>Erklärung bestätigt</span><strong>${escapeHtml(booleanLabel(detail.declarationConfirmed))}</strong></div>
        <div><span>Satzung bestätigt</span><strong>${escapeHtml(booleanLabel(detail.statutesConfirmed))}</strong></div>
        ${detail.applicantMessage ? `<div class="full"><span>Nachricht des Antragstellers</span><strong class="v4-preserve-lines">${escapeHtml(detail.applicantMessage)}</strong></div>` : ""}
      </div>
    </section>
    <section class="v4-m150-section">
      <div class="dialog-actions v4-m150-inline-actions">
        <button class="button secondary" type="button" data-m150-download-pdf>Antrag als PDF</button>
      </div>
    </section>
    ${voteRosterMarkup(detail)}
    ${decisionMarkup(detail)}
    ${duplicateHintsMarkup(detail)}
    ${conversionMarkup(detail)}
    ${detailActionsMarkup(detail)}
  </div>`;
}

function bindDetailActions(dialog, detail) {
  dialog.querySelector("[data-m150-download-pdf]")
    ?.addEventListener("click", async event => {
      const button = event.currentTarget;
      const defaultLabel = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "PDF wird erstellt …";
      try {
        const freshDetail = await loadApplicationDetail(detail.id);
        if (freshDetail?.id !== detail.id) {
          throw new Error("Unerwartete Antrags-ID.");
        }
        await downloadMembershipApplicationPdf(freshDetail);
      } catch {
        showToast("Der PDF-Download konnte nicht erstellt werden. Bitte erneut versuchen.", "error", 6500);
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = defaultLabel;
      }
    });
  dialog.querySelectorAll("[data-m150-vote]").forEach(button => {
    button.addEventListener("click", () => handleVote(detail, button.dataset.m150Vote));
  });
  dialog.querySelectorAll("[data-m150-manual-decision]").forEach(button => {
    button.addEventListener("click", () => openManualDecision(detail, button.dataset.m150ManualDecision));
  });
  dialog.querySelector("[data-m150-convert]")
    ?.addEventListener("click", () => openConversionDialog(detail));
  dialog.querySelector("[data-m150-withdraw]")
    ?.addEventListener("click", () => handleWithdraw(detail));
}

function showApplicationDetail(detail) {
  activeDetailId = detail.id;
  const dialog = openDialog({
    title: applicationName(detail),
    kicker: "Mitgliedsantrag",
    body: applicationDetailMarkup(detail)
  });
  bindDetailActions(dialog, detail);
}

async function openApplicationDetail(id) {
  const detail = await loadApplicationDetail(id);
  showApplicationDetail(detail);
}

function errorKey(error) {
  const source = `${error?.code || ""} ${error?.message || ""}`;
  return Object.keys(ERROR_MESSAGES).find(key => source.includes(key)) || "";
}

async function refreshListAndDetail(id, reopenDetail) {
  const [nextApplications, detail] = await Promise.all([
    loadApplicationList(),
    loadApplicationDetail(id)
  ]);
  applications = nextApplications;
  renderApplicationList();
  if (reopenDetail && activeDetailId === id) showApplicationDetail(detail);
  return detail;
}

async function handleKnownError(error, id, reopenDetail) {
  const key = errorKey(error);
  if (!key) return false;
  showToast(ERROR_MESSAGES[key], "error", 7600);
  if (REFRESH_AFTER_ERROR.has(key)) {
    try {
      await refreshListAndDetail(id, reopenDetail);
    } catch (refreshError) {
      showToast(refreshError?.message || "Die aktuellen Daten konnten nicht neu geladen werden.", "error", 6500);
    }
  }
  return true;
}

async function executeWrite({ id, operation, successMessage, reopenDetail = true }) {
  try {
    await runWrite(operation, successMessage);
    await refreshListAndDetail(id, reopenDetail);
  } catch (error) {
    if (!await handleKnownError(error, id, reopenDetail)) throw error;
  }
}

async function refreshApplicationsAsAvailable(id) {
  const [listResult, detailResult] = await Promise.allSettled([
    loadApplicationList(),
    loadApplicationDetail(id)
  ]);

  if (listResult.status === "fulfilled") {
    applications = listResult.value;
    renderApplicationList();
  }

  return detailResult.status === "fulfilled" ? detailResult.value : null;
}

async function executeConversionWrite({ id, operation, successMessage }) {
  try {
    await runWrite(operation, successMessage);
  } catch (error) {
    if (!await handleKnownError(error, id, false)) throw error;
    return;
  }

  try {
    if (typeof refreshFanclubMembers !== "function") {
      throw new Error("Mitglieder-Refresh ist nicht verfügbar.");
    }
    const freshMembers = await refreshFanclubMembers();
    memberSnapshot = Array.isArray(freshMembers) ? freshMembers : [];
  } catch (refreshError) {
    memberSnapshot = [];
    await refreshApplicationsAsAvailable(id);
    showToast(
      "Das Mitglied wurde übernommen, aber die aktuelle Mitgliederliste konnte nicht neu geladen werden. Bitte den Fanclub-Bereich neu öffnen.",
      "warning",
      8200
    );
    return;
  }

  try {
    await refreshListAndDetail(id, false);
  } catch (refreshError) {
    showToast(
      "Das Mitglied wurde übernommen, aber die aktuellen Antragsdaten konnten nicht neu geladen werden. Bitte den Fanclub-Bereich neu öffnen.",
      "warning",
      8200
    );
  }
}

async function handleWithdraw(detail) {
  const confirmed = await confirmAction(
    "Der Rückzug beendet die Bearbeitung und kann in M150 R1 nicht rückgängig gemacht werden.",
    {
      danger: true,
      title: "Antrag als zurückgezogen markieren?",
      submitLabel: "Als zurückgezogen markieren"
    }
  );
  if (!confirmed) return;

  await executeWrite({
    id: detail.id,
    successMessage: "Der Antrag wurde als zurückgezogen markiert.",
    operation: () => call("membership_application_withdraw", {
      id: detail.id,
      expectedRevision: detail.revision
    })
  });
}

async function handleVote(detail, vote) {
  if (vote === "YES") {
    const confirmed = await confirmAction("Für die Aufnahme stimmen?", {
      submitLabel: "Ja"
    });
    if (!confirmed) return;
    await executeWrite({
      id: detail.id,
      successMessage: "Die Ja-Stimme wurde abgegeben.",
      operation: () => call("membership_application_vote", {
        id: detail.id,
        vote: "YES",
        expectedRevision: detail.revision
      })
    });
    return;
  }

  if (Number(detail.noVotes || 0) === 2) {
    openDialog({
      title: "Entscheidende Nein-Stimme",
      kicker: "Abstimmung",
      submitLabel: "Nein-Stimme abgeben",
      danger: true,
      body: `<form class="form-grid v4-smart-form v4-m150-form">
        <label class="v4-field-full">Interner Ablehnungsgrund
          <textarea name="reasonInternal" rows="5" maxlength="4000" required></textarea>
          <small>Intern – wird nicht an den Antragsteller gesendet.</small>
        </label>
        <label class="v4-field-full">Mitteilung an Antragsteller (optional)
          <textarea name="applicantNotice" rows="4" maxlength="2000"></textarea>
          <small>Optional – diese Mitteilung kann in der Ablehnungs-E-Mail verwendet werden.</small>
        </label>
      </form>`,
      onSubmit: async values => executeWrite({
        id: detail.id,
        reopenDetail: false,
        successMessage: "Die entscheidende Nein-Stimme wurde abgegeben.",
        operation: () => call("membership_application_vote", {
          id: detail.id,
          vote: "NO",
          expectedRevision: detail.revision,
          reasonInternal: values.reasonInternal,
          ...(values.applicantNotice ? { applicantNotice: values.applicantNotice } : {})
        })
      })
    });
    return;
  }

  const confirmed = await confirmAction("Gegen die Aufnahme stimmen?", {
    danger: true,
    submitLabel: "Nein"
  });
  if (!confirmed) return;
  await executeWrite({
    id: detail.id,
    successMessage: "Die Nein-Stimme wurde abgegeben.",
    operation: () => call("membership_application_vote", {
      id: detail.id,
      vote: "NO",
      expectedRevision: detail.revision
    })
  });
}

function openManualDecision(detail, decision) {
  const rejected = decision === "REJECTED";
  openDialog({
    title: rejected ? "Antrag manuell ablehnen" : "Antrag manuell aufnehmen",
    kicker: "Manuelle Entscheidung nach 7 Tagen",
    submitLabel: rejected ? "Ablehnen" : "Aufnehmen",
    danger: rejected,
    body: `<form class="form-grid v4-smart-form v4-m150-form">
      <label class="v4-field-full">${rejected ? "Interner Ablehnungsgrund" : "Interner Entscheidungsgrund"}
        <textarea name="reasonInternal" rows="5" maxlength="4000" required></textarea>
        <small>${rejected ? "Intern – wird nicht an den Antragsteller gesendet." : "Dieser Text bleibt intern."}</small>
      </label>
      ${rejected ? `<label class="v4-field-full">Mitteilung an Antragsteller (optional)
        <textarea name="applicantNotice" rows="4" maxlength="2000"></textarea>
        <small>Optional – diese Mitteilung kann in der Ablehnungs-E-Mail verwendet werden.</small>
      </label>` : ""}
    </form>`,
    onSubmit: async values => {
      const payload = {
        id: detail.id,
        decision,
        expectedRevision: detail.revision,
        reasonInternal: values.reasonInternal
      };
      if (rejected && values.applicantNotice) payload.applicantNotice = values.applicantNotice;
      await executeWrite({
        id: detail.id,
        reopenDetail: false,
        successMessage: rejected ? "Der Antrag wurde abgelehnt." : "Der Antrag wurde angenommen.",
        operation: () => call("membership_application_manual_decide", payload)
      });
    }
  });
}

function comparisonMemberMarkup(member) {
  return `<div class="v4-detail-grid">
    <div><span>Name</span><strong>${escapeHtml(memberName(member))}</strong></div>
    <div><span>Status</span><strong>${escapeHtml(member.status === "ACTIVE" ? "Aktiv" : "Inaktiv")}</strong></div>
    <div><span>Mitglied seit</span><strong>${escapeHtml(fmtDate(member.joinedOn))}</strong></div>
  </div>`;
}

function targetMemberOptions(status) {
  return memberSnapshot
    .filter(member => member.status === status)
    .map(member => `<option value="${escapeAttr(member.id)}">${escapeHtml(memberName(member))}</option>`)
    .join("");
}

function conversionModeBody(mode, detail) {
  if (mode === "NEW_MEMBER") {
    return `<div class="v4-m150-conversion-mode">
      <h3>Antragsdaten für das neue Mitglied</h3>
      ${applicationCoreMarkup(detail)}
      ${hasDuplicateHints(detail) ? '<div class="notice warning"><strong>Es bestehen Hinweise auf vorhandene Datensätze. Bitte vor der Neuanlage prüfen.</strong></div>' : ""}
      <label class="v4-m150-explicit-confirm"><input type="checkbox" name="explicitConfirmation" required> <span>Neues Mitglied wirklich anlegen</span></label>
    </div>`;
  }

  const status = mode === "REACTIVATE_EXISTING" ? "INACTIVE" : "ACTIVE";
  const title = mode === "REACTIVATE_EXISTING"
    ? "Ehemaliges Mitglied auswählen"
    : "Aktives Mitglied auswählen";
  const note = mode === "REACTIVATE_EXISTING"
    ? "Die vorhandenen Stammdaten werden durch die Wiederaufnahme nicht automatisch überschrieben."
    : "Der bestehende Mitgliedsdatensatz wird nicht verändert.";
  const confirmation = mode === "REACTIVATE_EXISTING"
    ? "Ausgewähltes ehemaliges Mitglied ausdrücklich reaktivieren"
    : "Antrag ausdrücklich dem ausgewählten aktiven Mitglied zuordnen";

  return `<div class="v4-m150-conversion-mode">
    <label>${escapeHtml(title)}
      <select name="targetMemberId" data-m150-target-member required>
        <option value="">Bitte bewusst auswählen</option>
        ${targetMemberOptions(status)}
      </select>
    </label>
    <div class="v4-m150-comparison">
      <div><h3>Antrag</h3>${applicationCoreMarkup(detail)}</div>
      <div data-m150-member-comparison><h3>Bestandsmitglied</h3><p class="subtle">Noch kein Mitglied ausgewählt.</p></div>
    </div>
    <div class="notice warning"><p>${escapeHtml(note)}</p></div>
    <label class="v4-m150-explicit-confirm"><input type="checkbox" name="explicitConfirmation" required> <span>${escapeHtml(confirmation)}</span></label>
  </div>`;
}

function bindConversionForm(dialog, detail) {
  const form = dialog.querySelector("form");
  const modeSlot = dialog.querySelector("[data-m150-conversion-mode-slot]");

  const bindTarget = () => {
    modeSlot?.querySelector("[data-m150-target-member]")
      ?.addEventListener("change", event => {
        const member = memberSnapshot.find(item => String(item.id) === event.currentTarget.value);
        const comparison = modeSlot.querySelector("[data-m150-member-comparison]");
        if (!comparison) return;
        comparison.innerHTML = member
          ? `<h3>Bestandsmitglied</h3>${comparisonMemberMarkup(member)}`
          : '<h3>Bestandsmitglied</h3><p class="subtle">Noch kein Mitglied ausgewählt.</p>';
      });
  };

  form?.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener("change", event => {
      modeSlot.innerHTML = conversionModeBody(event.currentTarget.value, detail);
      bindTarget();
    });
  });
}

function openConversionDialog(detail) {
  const dialog = openDialog({
    title: "Mitglied übernehmen",
    kicker: "Kontrollierte Übernahme",
    submitLabel: "Auswahl bestätigen",
    body: `<form class="form-grid v4-smart-form v4-m150-form">
      <fieldset class="v4-field-full v4-m150-mode-options">
        <legend>Übernahmemodus bewusst wählen</legend>
        <label><input type="radio" name="mode" value="NEW_MEMBER" required> <span>Neues Mitglied anlegen</span></label>
        <label><input type="radio" name="mode" value="REACTIVATE_EXISTING" required> <span>Ehemaliges Mitglied reaktivieren</span></label>
        <label><input type="radio" name="mode" value="RESOLVE_EXISTING_ACTIVE" required> <span>Bereits aktives Mitglied zuordnen</span></label>
      </fieldset>
      <div class="v4-field-full" data-m150-conversion-mode-slot>
        <p class="subtle">Es ist noch keine Option ausgewählt.</p>
      </div>
    </form>`,
    onSubmit: async values => {
      const payload = {
        id: detail.id,
        expectedRevision: detail.revision,
        mode: values.mode
      };
      if (values.mode !== "NEW_MEMBER") payload.targetMemberId = values.targetMemberId;
      await executeConversionWrite({
        id: detail.id,
        successMessage: "Der Mitgliedsantrag wurde kontrolliert übernommen.",
        operation: () => call("membership_application_convert", payload)
      });
    }
  });
  bindConversionForm(dialog, detail);
}

export async function renderMembershipApplications(panel, context = {}) {
  panelNode = panel;
  memberSnapshot = Array.isArray(context.members) ? context.members : [];
  refreshFanclubMembers = typeof context.refreshMembers === "function"
    ? context.refreshMembers
    : null;
  const sequence = ++loadSequence;
  panelNode.innerHTML = '<article class="card loading-card"><h3>Mitgliedsanträge werden geladen …</h3></article>';

  try {
    const nextApplications = await loadApplicationList();
    if (sequence !== loadSequence || panelNode !== panel) return;
    applications = nextApplications;
    renderApplicationList();
  } catch (error) {
    if (sequence !== loadSequence || panelNode !== panel) return;
    panelNode.innerHTML = `${errorPanel(error, "Mitgliedsanträge konnten nicht geladen werden")}
      <div class="v4-m150-retry"><button class="button secondary" type="button" data-m150-retry>Erneut laden</button></div>`;
    panelNode.querySelector("[data-m150-retry]")
      ?.addEventListener("click", () => renderMembershipApplications(panel, context));
  }
}

export function resetMembershipApplications() {
  loadSequence += 1;
  applications = [];
  statusFilter = "PENDING";
  nameSearch = "";
  memberSnapshot = [];
  refreshFanclubMembers = null;
  panelNode = null;
  activeDetailId = "";
}

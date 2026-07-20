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
  optionList,
  runWrite,
  statusBadge
} from "./common.js";

let snapshot = null;
let activeTab = "members";
let activeContributionSeasonId = "";

const MONEY = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

const PAYMENT_METHODS = [
  { value: "CASH", label: "Bar" },
  { value: "BANK", label: "Bank" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "OTHER", label: "Sonstiges" }
];

const PAYMENT_STATUS = {
  PENDING: { label: "Offen", type: "warning" },
  CONFIRMED: { label: "Bestätigt", type: "success" },
  REJECTED: { label: "Abgelehnt", type: "danger" }
};

function memberName(member) {
  return `${member.firstName || ""} ${member.lastName || ""}`.trim();
}

function money(value) {
  return MONEY.format(Number(value || 0));
}

function paymentStatusBadge(status) {
  const entry = PAYMENT_STATUS[status]
    || { label: status || "–", type: "neutral" };

  return `<span class="badge ${entry.type}">${escapeHtml(entry.label)}</span>`;
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function contributionSeasons() {
  return snapshot?.contributionSeasons || [];
}

function contributionClasses() {
  return snapshot?.contributionClasses || [];
}

function selectedSeason() {
  return contributionSeasons().find(
    season => season.id === activeContributionSeasonId
  ) || null;
}

function ensureContributionSeason() {
  const seasons = contributionSeasons();

  if (
    activeContributionSeasonId
    && seasons.some(season => season.id === activeContributionSeasonId)
  ) {
    return;
  }

  activeContributionSeasonId = (
    seasons.find(season => season.active)
    || seasons[0]
    || {}
  ).id || "";
}

function tabs() {
  const slot = document.getElementById("fanclubTabs");
  if (!slot) return;

  const items = [
    ["members", "Mitglieder"],
    ["offices", "Ämter"],
    ...(snapshot?.canReadFinance ? [["contributions", "Beiträge"]] : [])
  ];

  if (!items.some(([key]) => key === activeTab)) {
    activeTab = "members";
  }

  slot.innerHTML = `
    <div class="v4-tabs" role="tablist">
      ${items.map(([key, text]) => `<button
        class="v4-tab ${activeTab === key ? "active" : ""}"
        data-tab="${key}"
        type="button"
      >${text}</button>`).join("")}
    </div>`;

  slot.querySelectorAll("[data-tab]").forEach(button => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      tabs();
      render();
    });
  });
}

function memberForm(member = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(member.id || "")}">
    <label>Vorname<input name="firstName" required maxlength="160" value="${escapeAttr(member.firstName || "")}"></label>
    <label>Nachname<input name="lastName" required maxlength="160" value="${escapeAttr(member.lastName || "")}"></label>
    <label>E-Mail<input name="email" type="email" maxlength="320" value="${escapeAttr(member.email || "")}"></label>
    <label>Telefon<input name="phone" maxlength="80" value="${escapeAttr(member.phone || "")}"></label>
    <label>Straße<input name="street" maxlength="160" value="${escapeAttr(member.street || "")}"></label>
    <label>Hausnummer<input name="houseNumber" maxlength="40" value="${escapeAttr(member.houseNumber || "")}"></label>
    <label>PLZ<input name="postalCode" maxlength="20" value="${escapeAttr(member.postalCode || "")}"></label>
    <label>Ort<input name="city" maxlength="160" value="${escapeAttr(member.city || "")}"></label>
    <label>Eintritt<input name="joinedOn" type="date" value="${escapeAttr(member.joinedOn || "")}"></label>
    <label>Austritt<input name="leftOn" type="date" value="${escapeAttr(member.leftOn || "")}"></label>
    <label>Status<select name="status">${optionList([
      { value: "ACTIVE", label: "Aktiv" },
      { value: "INACTIVE", label: "Inaktiv" }
    ], member.status || "ACTIVE")}</select></label>
    <label class="full">Notizen<textarea name="notes" rows="4" maxlength="4000">${escapeHtml(member.notes || "")}</textarea></label>
  </form>`;
}

function openMember(member = null) {
  openDialog({
    title: member ? `${member.memberCode} bearbeiten` : "Mitglied anlegen",
    kicker: "Fanclub",
    body: memberForm(member || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_member", values),
        member ? "Mitglied wurde aktualisiert." : "Mitglied wurde angelegt."
      );
      renderAll();
    }
  });
}

function renderMembers(panel) {
  const members = snapshot?.members || [];

  panel.innerHTML = `
    <div class="v4-toolbar">
      <div><h3>Mitglieder</h3><p>${members.length} Einträge</p></div>
      ${snapshot?.canManageMembers ? '<button id="addMemberButton" class="button primary" type="button">Mitglied anlegen</button>' : ""}
    </div>
    ${members.length ? `<div class="v4-table-wrap"><table class="v4-table"><thead><tr><th>PD-ID</th><th>Name</th><th>Kontakt</th><th>Ort</th><th>Status</th><th></th></tr></thead><tbody>${members.map(member => `<tr>
      <td><strong>${escapeHtml(member.memberCode)}</strong></td>
      <td>${escapeHtml(memberName(member))}<small>${member.joinedOn ? `Seit ${escapeHtml(fmtDate(member.joinedOn))}` : ""}</small></td>
      <td>${escapeHtml(member.email || "–")}<small>${escapeHtml(member.phone || "")}</small></td>
      <td>${escapeHtml([member.postalCode, member.city].filter(Boolean).join(" ") || "–")}</td>
      <td>${statusBadge(member.status)}</td>
      <td>${snapshot.canManageMembers ? `<button class="button small secondary" type="button" data-edit-member="${escapeAttr(member.id)}">Bearbeiten</button>` : ""}</td>
    </tr>`).join("")}</tbody></table></div>` : empty("Noch keine Mitglieder angelegt.")}`;

  document.getElementById("addMemberButton")
    ?.addEventListener("click", () => openMember());

  panel.querySelectorAll("[data-edit-member]").forEach(button => {
    button.addEventListener("click", () => {
      const member = members.find(
        item => item.id === button.dataset.editMember
      );
      if (member) openMember(member);
    });
  });
}

function renderOffices(panel) {
  const members = (snapshot?.members || []).filter(
    member => member.status === "ACTIVE"
  );
  const offices = snapshot?.offices || [];

  panel.innerHTML = `
    <div class="v4-toolbar"><div><h3>Fünf feste Amtsplätze</h3><p>Jedes aktive Mitglied kann höchstens ein Amt besitzen.</p></div></div>
    <form id="officeForm" class="v4-office-grid">
      ${offices.map(office => `<label class="card"><span>${escapeHtml(office.label)}</span><select name="${escapeAttr(office.code)}" ${snapshot.canManageOffices ? "" : "disabled"}>${optionList(members.map(member => ({ value: member.id, label: `${member.memberCode} · ${memberName(member)}` })), office.memberId || "", "Unbesetzt")}</select></label>`).join("")}
      ${snapshot.canManageOffices ? '<div class="full dialog-actions"><button class="button primary" type="submit">Alle Amtsplätze speichern</button></div>' : ""}
    </form>`;

  document.getElementById("officeForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!await confirmAction("Alle fünf Amtsplätze mit dieser Besetzung speichern?")) {
      return;
    }

    const form = event.currentTarget;
    const slots = offices.map(office => ({
      code: office.code,
      memberId: form.elements.namedItem(office.code)?.value || ""
    }));

    try {
      snapshot = await runWrite(
        () => call("save_offices", { slots }),
        "Amtsplätze wurden gespeichert."
      );
      renderAll();
    } catch (error) {
      const panelNode = document.getElementById("fanclubPanel");
      panelNode.insertAdjacentHTML(
        "afterbegin",
        errorPanel(error, "Amtsplätze konnten nicht gespeichert werden")
      );
    }
  });
}

function seasonForm(season = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(season.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(season.revision || "")}">
    <label>Kurzcode
      <input name="code" required maxlength="32" value="${escapeAttr(season.code || "")}" placeholder="2026">
    </label>
    <label>Bezeichnung
      <input name="name" required maxlength="120" value="${escapeAttr(season.name || "")}" placeholder="Beitragsjahr 2026">
    </label>
    <label>Beginn
      <input name="startsOn" required type="date" value="${escapeAttr(season.startsOn || "")}">
    </label>
    <label>Ende
      <input name="endsOn" required type="date" value="${escapeAttr(season.endsOn || "")}">
    </label>
    <label>Status
      <select name="active">${optionList([
        { value: "true", label: "Aktiv" },
        { value: "false", label: "Inaktiv" }
      ], String(season.active ?? true))}</select>
    </label>
  </form>`;
}

function openSeason(season = null) {
  openDialog({
    title: season ? "Beitragsjahr bearbeiten" : "Beitragsjahr anlegen",
    kicker: "Beiträge",
    body: seasonForm(season || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_contribution_season", values),
        season
          ? "Beitragsjahr wurde aktualisiert."
          : "Beitragsjahr wurde angelegt."
      );
      ensureContributionSeason();
      renderAll();
    }
  });
}

function classForm(contributionClass = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(contributionClass.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(contributionClass.revision || "")}">
    <label>Kurzcode
      <input name="code" required maxlength="32" value="${escapeAttr(contributionClass.code || "")}" placeholder="STANDARD">
    </label>
    <label>Bezeichnung
      <input name="name" required maxlength="120" value="${escapeAttr(contributionClass.name || "")}" placeholder="Standardbeitrag">
    </label>
    <label>Betrag
      <input name="amount" required type="number" min="0" max="999999.99" step="0.01" value="${escapeAttr(contributionClass.amount ?? "")}">
    </label>
    <label>Status
      <select name="active">${optionList([
        { value: "true", label: "Aktiv" },
        { value: "false", label: "Inaktiv" }
      ], String(contributionClass.active ?? true))}</select>
    </label>
  </form>`;
}

function openContributionClass(contributionClass = null) {
  openDialog({
    title: contributionClass
      ? "Beitragsklasse bearbeiten"
      : "Beitragsklasse anlegen",
    kicker: "Beiträge",
    body: classForm(contributionClass || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_contribution_class", values),
        contributionClass
          ? "Beitragsklasse wurde aktualisiert."
          : "Beitragsklasse wurde angelegt."
      );
      renderAll();
    }
  });
}

function contributionFor(memberId) {
  return (snapshot?.memberContributions || []).find(
    contribution => (
      contribution.seasonId === activeContributionSeasonId
      && contribution.memberId === memberId
    )
  ) || null;
}

function assignmentForm(member, contribution = {}) {
  const classes = contributionClasses().filter(
    item => item.active || item.id === contribution.contributionClassId
  );

  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(contribution.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(contribution.revision || "")}">
    <input type="hidden" name="seasonId" value="${escapeAttr(activeContributionSeasonId)}">
    <input type="hidden" name="memberId" value="${escapeAttr(member.id)}">
    <label class="full">Mitglied
      <input value="${escapeAttr(`${member.memberCode} · ${memberName(member)}`)}" disabled>
    </label>
    <label class="full">Beitragsklasse
      <select name="contributionClassId" required>
        ${optionList(
          classes.map(item => ({
            value: item.id,
            label: `${item.name} · ${money(item.amount)}`
          })),
          contribution.contributionClassId || "",
          "Beitragsklasse auswählen"
        )}
      </select>
    </label>
    <label class="full">Notiz
      <textarea name="notes" rows="3" maxlength="1000">${escapeHtml(contribution.notes || "")}</textarea>
    </label>
  </form>`;
}

function openAssignment(member) {
  const contribution = contributionFor(member.id);

  openDialog({
    title: contribution
      ? "Mitgliedsbeitrag bearbeiten"
      : "Mitgliedsbeitrag zuordnen",
    kicker: selectedSeason()?.name || "Beiträge",
    body: assignmentForm(member, contribution || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_member_contribution", values),
        contribution
          ? "Beitragszuordnung wurde aktualisiert."
          : "Beitragszuordnung wurde angelegt."
      );
      renderAll();
    }
  });
}

function paymentForm(contribution) {
  const accounts = (snapshot?.financeAccounts || []).filter(
    account => account.active
  );
  const defaultAccount = accounts.find(account => account.code === "KASSE")
    || accounts[0]
    || {};

  return `<form class="form-grid">
    <input type="hidden" name="memberContributionId" value="${escapeAttr(contribution.id)}">
    <label class="full">Mitglied
      <input value="${escapeAttr(`${contribution.memberCode} · ${contribution.memberName}`)}" disabled>
    </label>
    <label>Betrag
      <input
        name="amount"
        required
        type="number"
        min="0.01"
        max="${escapeAttr(contribution.reportableAmount)}"
        step="0.01"
        value="${escapeAttr(contribution.reportableAmount)}"
      >
    </label>
    <label>Zahlungsdatum
      <input name="paidOn" required type="date" value="${localDate()}">
    </label>
    <label>Konto
      <select name="accountId" required>
        ${optionList(
          accounts.map(account => ({
            value: account.id,
            label: account.name
          })),
          defaultAccount.id || "",
          "Konto auswählen"
        )}
      </select>
    </label>
    <label>Zahlungsart
      <select name="paymentMethod">
        ${optionList(PAYMENT_METHODS, "CASH")}
      </select>
    </label>
  </form>`;
}

function openPaymentReport(contribution) {
  openDialog({
    title: "Beitragszahlung melden",
    kicker: selectedSeason()?.name || "Beiträge",
    body: paymentForm(contribution),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("report_contribution_payment", values),
        "Beitragszahlung wurde zur Prüfung gemeldet."
      );
      renderAll();
    }
  });
}

async function confirmPayment(report) {
  const confirmed = await confirmAction(
    `${money(report.amount)} für ${report.memberCode} als bezahlt bestätigen?`
  );
  if (!confirmed) return;

  snapshot = await runWrite(
    () => call("review_contribution_payment", {
      id: report.id,
      revision: report.revision,
      decision: "CONFIRMED",
      reason: ""
    }),
    "Beitragszahlung wurde bestätigt und gebucht."
  );
  renderAll();
}

function rejectPaymentForm(report) {
  return `<form>
    <input type="hidden" name="id" value="${escapeAttr(report.id)}">
    <input type="hidden" name="revision" value="${escapeAttr(report.revision)}">
    <label>Ablehnungsgrund
      <textarea name="reason" required maxlength="1000" rows="4"></textarea>
    </label>
  </form>`;
}

function openRejectPayment(report) {
  openDialog({
    title: "Beitragszahlung ablehnen",
    kicker: `${report.memberCode} · ${money(report.amount)}`,
    body: rejectPaymentForm(report),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("review_contribution_payment", {
          id: values.id,
          revision: values.revision,
          decision: "REJECTED",
          reason: values.reason
        }),
        "Beitragszahlung wurde abgelehnt."
      );
      renderAll();
    }
  });
}

function contributionSummary(contributions) {
  return contributions.reduce(
    (sum, contribution) => {
      sum.due += Number(contribution.amountDue || 0);
      sum.paid += Number(contribution.paidAmount || 0);
      sum.pending += Number(contribution.pendingAmount || 0);
      sum.open += Number(contribution.openAmount || 0);
      return sum;
    },
    { due: 0, paid: 0, pending: 0, open: 0 }
  );
}

function renderContributionClasses() {
  if (!snapshot?.canManageFinance) return "";

  const classes = contributionClasses();

  return `<section class="card v4-contribution-config">
    <div class="v4-toolbar">
      <div>
        <h3>Beitragsklassen</h3>
        <p>Beträge werden bei der Zuordnung als Sollbetrag festgeschrieben.</p>
      </div>
      <button id="addContributionClassButton" class="button secondary" type="button">
        Beitragsklasse anlegen
      </button>
    </div>
    ${classes.length ? `<div class="v4-table-wrap"><table class="v4-table">
      <thead><tr><th>Code</th><th>Bezeichnung</th><th>Betrag</th><th>Status</th><th></th></tr></thead>
      <tbody>${classes.map(item => `<tr>
        <td><strong>${escapeHtml(item.code)}</strong></td>
        <td>${escapeHtml(item.name)}</td>
        <td class="v4-money">${escapeHtml(money(item.amount))}</td>
        <td>${statusBadge(item.active ? "ACTIVE" : "INACTIVE")}</td>
        <td><button class="button small secondary" type="button" data-edit-contribution-class="${escapeAttr(item.id)}">Bearbeiten</button></td>
      </tr>`).join("")}</tbody>
    </table></div>` : empty("Noch keine Beitragsklassen angelegt.")}
  </section>`;
}

function renderPaymentReports(reports) {
  if (!reports.length) {
    return empty("Für dieses Beitragsjahr liegen noch keine Zahlungsmeldungen vor.");
  }

  return `<div class="v4-table-wrap"><table class="v4-table">
    <thead><tr>
      <th>Mitglied</th>
      <th>Betrag</th>
      <th>Zahlung</th>
      <th>Gemeldet</th>
      <th>Status</th>
      <th></th>
    </tr></thead>
    <tbody>${reports.map(report => `<tr>
      <td><strong>${escapeHtml(report.memberCode)}</strong><small>${escapeHtml(report.memberName)}</small></td>
      <td class="v4-money">${escapeHtml(money(report.amount))}</td>
      <td>${escapeHtml(fmtDate(report.paidOn))}<small>${escapeHtml(report.accountName)} · ${escapeHtml(report.paymentMethodLabel)}</small></td>
      <td>${escapeHtml(report.reportedByName)}<small>${escapeHtml(fmtDateTime(report.reportedAt))}</small></td>
      <td>${paymentStatusBadge(report.status)}</td>
      <td><div class="v4-inline-actions">
        ${report.status === "PENDING" && snapshot.canManageFinance ? `
          <button class="button small primary" type="button" data-confirm-contribution-payment="${escapeAttr(report.id)}">Bestätigen</button>
          <button class="button small danger" type="button" data-reject-contribution-payment="${escapeAttr(report.id)}">Ablehnen</button>
        ` : ""}
        ${report.status === "REJECTED" && report.rejectionReason
          ? `<small>${escapeHtml(report.rejectionReason)}</small>`
          : ""}
      </div></td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderContributions(panel) {
  ensureContributionSeason();

  const seasons = contributionSeasons();
  const season = selectedSeason();
  const contributions = (snapshot?.memberContributions || []).filter(
    item => item.seasonId === activeContributionSeasonId
  );
  const reports = (snapshot?.contributionPaymentReports || []).filter(
    item => item.seasonId === activeContributionSeasonId
  );
  const summary = contributionSummary(contributions);
  const members = (snapshot?.members || []).filter(
    member => member.status === "ACTIVE" || contributionFor(member.id)
  );

  panel.innerHTML = `
    <div class="v4-toolbar">
      <div>
        <h3>Mitgliedsbeiträge</h3>
        <p>Zahlungen werden gemeldet und erst durch Kassier oder Admin verbindlich gebucht.</p>
      </div>
      <div class="v4-inline-actions">
        ${seasons.length ? `<select id="contributionSeasonSelect" aria-label="Beitragsjahr">
          ${optionList(
            seasons.map(item => ({
              value: item.id,
              label: `${item.name}${item.active ? "" : " · inaktiv"}`
            })),
            activeContributionSeasonId
          )}
        </select>` : ""}
        ${snapshot?.canManageFinance ? `
          <button id="addContributionSeasonButton" class="button secondary" type="button">Beitragsjahr anlegen</button>
          ${season ? '<button id="editContributionSeasonButton" class="button secondary" type="button">Jahr bearbeiten</button>' : ""}
        ` : ""}
      </div>
    </div>

    ${!season ? empty("Noch kein Beitragsjahr angelegt.") : `
      <div class="v4-finance-summary">
        <article class="card"><span>Soll</span><strong>${escapeHtml(money(summary.due))}</strong></article>
        <article class="card"><span>Bestätigt</span><strong>${escapeHtml(money(summary.paid))}</strong></article>
        <article class="card"><span>Offen</span><strong>${escapeHtml(money(summary.open))}</strong></article>
        <article class="card"><span>In Prüfung</span><strong>${escapeHtml(money(summary.pending))}</strong></article>
      </div>

      <section class="card">
        <div class="v4-toolbar">
          <div><h3>Beiträge je Mitglied</h3><p>${escapeHtml(season.name)}</p></div>
        </div>
        ${members.length ? `<div class="v4-table-wrap"><table class="v4-table">
          <thead><tr>
            <th>Mitglied</th>
            <th>Beitragsklasse</th>
            <th>Soll</th>
            <th>Bestätigt</th>
            <th>In Prüfung</th>
            <th>Offen</th>
            <th></th>
          </tr></thead>
          <tbody>${members.map(member => {
            const contribution = contributionFor(member.id);
            return `<tr>
              <td><strong>${escapeHtml(member.memberCode)}</strong><small>${escapeHtml(memberName(member))}</small></td>
              <td>${escapeHtml(contribution?.contributionClassName || "Nicht zugeordnet")}</td>
              <td class="v4-money">${escapeHtml(money(contribution?.amountDue))}</td>
              <td class="v4-money">${escapeHtml(money(contribution?.paidAmount))}</td>
              <td class="v4-money">${escapeHtml(money(contribution?.pendingAmount))}</td>
              <td class="v4-money"><strong>${escapeHtml(money(contribution?.openAmount))}</strong></td>
              <td><div class="v4-inline-actions">
                ${snapshot.canManageFinance ? `<button class="button small secondary" type="button" data-assign-contribution="${escapeAttr(member.id)}">${contribution ? "Zuordnung ändern" : "Beitrag zuordnen"}</button>` : ""}
                ${contribution && snapshot.canReportPayments && Number(contribution.reportableAmount) > 0
                  ? `<button class="button small primary" type="button" data-report-contribution-payment="${escapeAttr(contribution.id)}">Zahlung melden</button>`
                  : ""}
              </div></td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>` : empty("Noch keine Mitglieder angelegt.")}
      </section>

      <section class="card">
        <div class="v4-toolbar">
          <div><h3>Zahlungsmeldungen</h3><p>Offene Meldungen werden vor der Buchung geprüft.</p></div>
        </div>
        ${renderPaymentReports(reports)}
      </section>
    `}

    ${renderContributionClasses()}
  `;

  document.getElementById("contributionSeasonSelect")
    ?.addEventListener("change", event => {
      activeContributionSeasonId = event.currentTarget.value;
      render();
    });

  document.getElementById("addContributionSeasonButton")
    ?.addEventListener("click", () => openSeason());

  document.getElementById("editContributionSeasonButton")
    ?.addEventListener("click", () => {
      if (season) openSeason(season);
    });

  document.getElementById("addContributionClassButton")
    ?.addEventListener("click", () => openContributionClass());

  panel.querySelectorAll("[data-edit-contribution-class]").forEach(button => {
    button.addEventListener("click", () => {
      const item = contributionClasses().find(
        candidate => candidate.id === button.dataset.editContributionClass
      );
      if (item) openContributionClass(item);
    });
  });

  panel.querySelectorAll("[data-assign-contribution]").forEach(button => {
    button.addEventListener("click", () => {
      const member = members.find(
        item => item.id === button.dataset.assignContribution
      );
      if (member) openAssignment(member);
    });
  });

  panel.querySelectorAll("[data-report-contribution-payment]").forEach(button => {
    button.addEventListener("click", () => {
      const contribution = (snapshot?.memberContributions || []).find(
        item => item.id === button.dataset.reportContributionPayment
      );
      if (contribution) openPaymentReport(contribution);
    });
  });

  panel.querySelectorAll("[data-confirm-contribution-payment]").forEach(button => {
    button.addEventListener("click", async () => {
      const report = reports.find(
        item => item.id === button.dataset.confirmContributionPayment
      );
      if (!report) return;

      button.disabled = true;
      try {
        await confirmPayment(report);
      } catch (error) {
        button.disabled = false;
        panel.insertAdjacentHTML(
          "afterbegin",
          errorPanel(error, "Zahlung konnte nicht bestätigt werden")
        );
      }
    });
  });

  panel.querySelectorAll("[data-reject-contribution-payment]").forEach(button => {
    button.addEventListener("click", () => {
      const report = reports.find(
        item => item.id === button.dataset.rejectContributionPayment
      );
      if (report) openRejectPayment(report);
    });
  });
}

function render() {
  const panel = document.getElementById("fanclubPanel");
  if (!panel || !snapshot) return;

  if (activeTab === "offices") {
    renderOffices(panel);
  } else if (activeTab === "contributions") {
    renderContributions(panel);
  } else {
    renderMembers(panel);
  }
}

function renderAll() {
  ensureContributionSeason();
  tabs();
  render();

  const status = document.getElementById("fanclubStatus");
  if (status) {
    status.textContent = "Aktuell";
    status.className = "status-pill success";
  }
}

export async function hydrateFanclub(context = {}) {
  const panel = document.getElementById("fanclubPanel");
  if (!panel) return;

  panel.innerHTML = '<article class="card loading-card"><h3>Fanclubdaten werden geladen …</h3></article>';

  try {
    snapshot = await call("fanclub_snapshot");
    if (context.isCurrent && !context.isCurrent()) return;
    renderAll();
  } catch (error) {
    panel.innerHTML = errorPanel(error);
    const status = document.getElementById("fanclubStatus");
    if (status) {
      status.textContent = "Fehler";
      status.className = "status-pill error";
    }
  }
}

export function noop() {}

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
  optionList,
  runWrite,
  showToast,
  statusBadge
} from "./common.js";

let snapshot = null;
let activeTab = "members";
let activeContributionSeasonId = "";
let activeFinanceAccountId = "ALL";
let memberSearchQuery = "";
let showInactiveMembers = false;
let boardEditMode = false;
let financeEntrySearchQuery = "";
let visibleCashbookEntries = 12;
const CASHBOOK_PAGE_SIZE = 12;

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
  REJECTED: { label: "Abgelehnt", type: "danger" },
  REVERSED: { label: "Storniert", type: "neutral" }
};

const ACCOUNT_TYPES = [
  { value: "CASH", label: "Bar" },
  { value: "BANK", label: "Bankkonto" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "OTHER", label: "Sonstiges" }
];

const ENTRY_TYPES = [
  { value: "INCOME", label: "Einnahme" },
  { value: "EXPENSE", label: "Ausgabe" }
];

function memberName(member) {
  return `${member.firstName || ""} ${member.lastName || ""}`.trim();
}

function officeDisplayLabel(office, index) {
  const original = String(office?.label || "").trim();
  const replacements = new Map([
    ["vorstand 1", "1. Vorstand"],
    ["vorstand 2", "2. Vorstand"],
    ["vorstand 3", "3. Vorstand"]
  ]);
  const normalized = original.toLocaleLowerCase("de-DE");
  if (replacements.has(normalized)) return replacements.get(normalized);
  if (/^vorstand\s*[123]$/i.test(original)) {
    return original.replace(/^vorstand\s*([123])$/i, "$1. Vorstand");
  }
  if (/vorstand/i.test(original) && index < 3) return `${index + 1}. Vorstand`;
  return original || `Vorstandsamt ${index + 1}`;
}

function officeMember(office, members) {
  return members.find(member => member.id === office.memberId) || null;
}

function phoneHref(value) {
  return String(value || "").trim().replace(/[^+\d]/g, "");
}

function boardContact(member) {
  const phone = String(member?.phone || "").trim();
  if (!phone) return "";
  const href = phoneHref(phone);
  return `<a class="v4-board-phone" href="tel:${escapeAttr(href)}">${escapeHtml(phone)}</a>`;
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

function numericPosition(value, fallback = 9999) {
  const position = Number(value);
  return Number.isInteger(position) && position > 0 ? position : fallback;
}

function orderedByPosition(items) {
  return [...items].sort((left, right) => {
    const positionCompare = numericPosition(left.position) - numericPosition(right.position);
    if (positionCompare) return positionCompare;
    return String(left.name || "").localeCompare(String(right.name || ""), "de-DE");
  });
}

function nextPosition(items) {
  const highest = items.reduce(
    (maximum, item) => Math.max(maximum, numericPosition(item.position, 0)),
    0
  );
  return Math.min(9999, Math.max(10, highest + 10));
}

function contributionClasses() {
  return orderedByPosition(snapshot?.contributionClasses || []);
}

function financeAccounts() {
  return orderedByPosition(snapshot?.financeAccounts || []);
}

function financeEntries() {
  return snapshot?.financeEntries || [];
}

function accountTypeLabel(value) {
  return ACCOUNT_TYPES.find(item => item.value === value)?.label || value || "–";
}

function entryTypeLabel(value) {
  return ENTRY_TYPES.find(item => item.value === value)?.label || value || "–";
}

function sourceTypeLabel(value) {
  const labels = {
    CONTRIBUTION_PAYMENT: "Mitgliedsbeitrag",
    FREE_INCOME: "Freie Einnahme",
    FREE_EXPENSE: "Freie Ausgabe",
    OPENING_BALANCE: "Startsaldo",
    TRANSFER_OUT: "Umbuchung Ausgang",
    TRANSFER_IN: "Umbuchung Eingang",
    REVERSAL: "Storno",
    REVERSAL_TRANSFER_OUT: "Storno Umbuchung",
    REVERSAL_TRANSFER_IN: "Storno Umbuchung"
  };
  return labels[value] || value || "–";
}

function signedMoney(entry) {
  const amount = Number(entry.amount || 0);
  return money(entry.entryType === "EXPENSE" ? -amount : amount);
}

function selectedFinanceEntries() {
  const entries = financeEntries();
  if (activeFinanceAccountId === "ALL") return entries;
  return entries.filter(entry => entry.accountId === activeFinanceAccountId);
}

function accountStatementEntries(accountId) {
  const ordered = financeEntries()
    .filter(entry => entry.accountId === accountId)
    .slice()
    .sort((left, right) => {
      const dateCompare = String(left.bookedOn || "").localeCompare(
        String(right.bookedOn || "")
      );
      if (dateCompare) return dateCompare;
      return Number(left.entryNo || 0) - Number(right.entryNo || 0);
    });

  let runningBalance = 0;

  return ordered.map(entry => {
    runningBalance += Number(entry.signedAmount || 0);
    return { ...entry, runningBalance };
  }).reverse();
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
    ["offices", "Vorstand"],
    ...(snapshot?.canReadFinance
      ? [
          ["contributions", "Beiträge"],
          ["cashbook", "Kasse"]
        ]
      : [])
  ];

  if (!items.some(([key]) => key === activeTab)) activeTab = "members";

  slot.innerHTML = `<div class="v4-tabs" role="tablist">
    ${items.map(([key, text]) => `<button
      class="v4-tab ${activeTab === key ? "active" : ""}"
      data-tab="${key}"
      type="button"
      role="tab"
      aria-selected="${activeTab === key ? "true" : "false"}"
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

function memberStatusBadge(status) {
  const active = String(status || "").toUpperCase() === "ACTIVE";
  return `<span class="badge ${active ? "success" : "neutral"}">${active ? "Aktiv" : "Inaktiv"}</span>`;
}

function memberForm(member = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(member.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(member.revision || "")}">
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

function memberDetailMarkup(member) {
  const address = [
    [member.street, member.houseNumber].filter(Boolean).join(" "),
    [member.postalCode, member.city].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ") || "–";

  return `<div class="v4-detail-grid v4-member-detail-grid">
    <div><span>Vorname</span><strong>${escapeHtml(member.firstName || "–")}</strong></div>
    <div><span>Nachname</span><strong>${escapeHtml(member.lastName || "–")}</strong></div>
    <div><span>E-Mail</span><strong>${escapeHtml(member.email || "–")}</strong></div>
    <div><span>Telefon</span><strong>${escapeHtml(member.phone || "–")}</strong></div>
    <div class="full"><span>Adresse</span><strong>${escapeHtml(address)}</strong></div>
    <div><span>Mitglied seit</span><strong>${escapeHtml(fmtDate(member.joinedOn))}</strong></div>
    <div><span>Austritt</span><strong>${escapeHtml(fmtDate(member.leftOn))}</strong></div>
    <div><span>Status</span><strong>${memberStatusBadge(member.status)}</strong></div>
    <div class="full"><span>Notizen</span><strong class="v4-preserve-lines">${escapeHtml(member.notes || "–")}</strong></div>
  </div>
  <div class="dialog-actions v4-detail-actions">
    <button class="button primary" type="button" data-edit-member-detail>Bearbeiten</button>
  </div>`;
}

function openMemberEditor(member = null) {
  const existing = Boolean(member?.id);
  openDialog({
    title: existing ? `${memberName(member)} bearbeiten` : "Mitglied anlegen",
    kicker: "Fanclub",
    body: memberForm(member || {}),
    submitLabel: "Speichern",
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_member", values),
        existing ? "Mitglied wurde aktualisiert." : "Mitglied wurde angelegt."
      );
      renderAll();
    }
  });
}

async function openMemberDetail(member) {
  const detail = await call("member_detail", { id: member.id });
  const dialog = openDialog({
    title: memberName(detail),
    kicker: "Mitgliedsdaten",
    body: memberDetailMarkup(detail)
  });

  dialog.querySelector("[data-edit-member-detail]")
    ?.addEventListener("click", () => openMemberEditor(detail));
}

function renderMembers(panel) {
  const members = snapshot?.members || [];
  const canViewDetails = Boolean(snapshot?.canViewMemberDetails);
  const canShowInactive = canViewDetails;
  const statusFilteredMembers = members.filter(member => (
    member.status === "ACTIVE"
    || (canShowInactive && showInactiveMembers)
  ));

  panel.innerHTML = `
    <div class="v4-heading-row v4-section-heading">
      <h3>Unsere Mitglieder</h3>
      ${snapshot?.canManageMembers ? '<button id="addMemberButton" class="button secondary v4-heading-action" type="button">+ Mitglied</button>' : ""}
    </div>
    <div class="v4-member-filterbar">
      <label class="v4-compact-search">
        <span class="sr-only">Mitglieder durchsuchen</span>
        <input id="memberSearchInput" type="search" placeholder="Mitglieder durchsuchen …" autocomplete="off" value="${escapeAttr(memberSearchQuery)}">
      </label>
      ${canShowInactive ? `<label class="v4-compact-check"><input id="showInactiveMembers" type="checkbox" ${showInactiveMembers ? "checked" : ""}> <span>Inaktive anzeigen</span></label>` : ""}
    </div>
    ${statusFilteredMembers.length ? `
      <div class="v4-table-wrap v4-desktop-table"><table class="v4-table v4-member-table"><thead><tr><th>Name</th><th>Mitglied seit</th><th>Status</th><th></th></tr></thead><tbody>${statusFilteredMembers.map(member => `<tr data-member-search="${escapeAttr(memberName(member).toLocaleLowerCase("de-DE"))}">
        <td><strong>${escapeHtml(memberName(member))}</strong></td>
        <td>${escapeHtml(fmtDate(member.joinedOn))}</td>
        <td>${memberStatusBadge(member.status)}</td>
        <td>${canViewDetails ? `<button class="button small secondary v4-row-action" type="button" data-view-member="${escapeAttr(member.id)}">Details <span aria-hidden="true">›</span></button>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>
      <div class="v4-mobile-records v4-member-mobile-list" aria-label="Mitgliederliste">${statusFilteredMembers.map(member => {
        const content = `<span class="v4-member-compact-copy"><strong>${escapeHtml(memberName(member))}</strong><small>Mitglied seit ${escapeHtml(fmtDate(member.joinedOn))}</small></span><span class="v4-member-compact-status">${memberStatusBadge(member.status)}</span>${canViewDetails ? '<span class="v4-row-chevron" aria-hidden="true">›</span>' : ""}`;
        return canViewDetails
          ? `<button class="v4-member-compact-row" type="button" data-view-member="${escapeAttr(member.id)}" data-member-search="${escapeAttr(memberName(member).toLocaleLowerCase("de-DE"))}">${content}</button>`
          : `<article class="v4-member-compact-row is-static" data-member-search="${escapeAttr(memberName(member).toLocaleLowerCase("de-DE"))}">${content}</article>`;
      }).join("")}</div>
      <div id="memberSearchEmpty" class="v4-inline-empty" hidden>Keine passenden Mitglieder gefunden.</div>
    ` : empty(showInactiveMembers ? "Noch keine Mitglieder angelegt." : "Keine aktiven Mitglieder vorhanden.")}`;

  const applyMemberSearch = () => {
    const query = memberSearchQuery.trim().toLocaleLowerCase("de-DE");
    let matches = 0;
    panel.querySelectorAll("[data-member-search]").forEach(row => {
      const visible = !query || row.dataset.memberSearch.includes(query);
      row.hidden = !visible;
      if (visible && row.classList.contains("v4-member-compact-row")) matches += 1;
    });
    const emptyNode = document.getElementById("memberSearchEmpty");
    if (emptyNode) emptyNode.hidden = matches > 0;
  };

  document.getElementById("addMemberButton")
    ?.addEventListener("click", () => openMemberEditor());

  document.getElementById("memberSearchInput")
    ?.addEventListener("input", event => {
      memberSearchQuery = event.currentTarget.value;
      applyMemberSearch();
    });

  document.getElementById("showInactiveMembers")
    ?.addEventListener("change", event => {
      showInactiveMembers = event.currentTarget.checked;
      renderMembers(panel);
    });

  panel.querySelectorAll("[data-view-member]").forEach(button => {
    button.addEventListener("click", async () => {
      const member = members.find(item => item.id === button.dataset.viewMember);
      if (!member) return;
      button.disabled = true;
      try {
        await openMemberDetail(member);
      } catch (error) {
        showToast(error?.message || "Mitgliedsdaten konnten nicht geladen werden.", "error", 6500);
      } finally {
        button.disabled = false;
      }
    });
  });

  applyMemberSearch();
}

function renderOffices(panel) {
  const members = (snapshot?.members || []).filter(member => member.status === "ACTIVE");
  const offices = snapshot?.offices || [];
  const canManageBoard = Boolean(snapshot?.canManageOffices && auth.isAdmin());
  const editing = canManageBoard && boardEditMode;

  panel.innerHTML = `
    <div class="v4-heading-row v4-section-heading">
      <h3>Unser Vorstand</h3>
      ${canManageBoard && !editing ? '<button id="manageBoardButton" class="button secondary v4-heading-action" type="button">Verwalten <span aria-hidden="true">›</span></button>' : ""}
    </div>
    <form id="officeForm" class="v4-office-grid v4-board-grid">
      ${offices.map((office, index) => {
        const assignedName = office.memberName || "Unbesetzt";
        return `<article class="card v4-office-card" data-office-code="${escapeAttr(office.code)}">
          <span class="v4-office-title">${escapeHtml(officeDisplayLabel(office, index))}</span>
          ${editing
            ? `<label><span class="sr-only">Besetzung auswählen</span><select name="${escapeAttr(office.code)}" data-office-select>${optionList(members.map(member => ({ value: member.id, label: memberName(member) })), office.memberId || "", "Unbesetzt")}</select></label>`
            : `<strong class="v4-board-name">${escapeHtml(assignedName)}</strong>`}
          <div class="v4-board-contact" data-board-phone>${boardContact({ phone: office.memberPhone || "" })}</div>
        </article>`;
      }).join("")}
      ${editing ? '<div class="full v4-board-save"><button id="cancelBoardButton" class="button secondary" type="button">Abbrechen</button><button class="button primary" type="submit">Vorstand speichern</button></div>' : ""}
    </form>`;

  document.getElementById("manageBoardButton")
    ?.addEventListener("click", () => {
      boardEditMode = true;
      renderOffices(panel);
    });

  document.getElementById("cancelBoardButton")
    ?.addEventListener("click", () => {
      boardEditMode = false;
      renderOffices(panel);
    });

  panel.querySelectorAll("[data-office-select]").forEach(select => {
    select.addEventListener("change", async () => {
      const contact = select.closest(".v4-office-card")?.querySelector("[data-board-phone]");
      if (!contact) return;
      contact.innerHTML = "";
      if (!select.value) return;
      try {
        const detail = await call("member_detail", { id: select.value });
        if (select.value === detail.id) contact.innerHTML = boardContact(detail);
      } catch (error) {
        console.error("Telefonnummer konnte nicht geladen werden", error);
      }
    });
  });

  if (!editing) return;
  document.getElementById("officeForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!await confirmAction("Vorstandsbesetzung mit diesen Angaben speichern?")) return;
    const form = event.currentTarget;
    const slots = offices.map(office => ({
      code: office.code,
      memberId: form.elements.namedItem(office.code)?.value || ""
    }));
    try {
      snapshot = await runWrite(
        () => call("save_offices", { slots }),
        "Vorstandsbesetzung wurde gespeichert."
      );
      boardEditMode = false;
      renderAll();
    } catch (error) {
      const panelNode = document.getElementById("fanclubPanel");
      panelNode.insertAdjacentHTML("afterbegin", errorPanel(error, "Vorstand konnte nicht gespeichert werden"));
    }
  });
}

function seasonForm(season = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(season.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(season.revision || "")}">
    <label class="full">Bezeichnung
      <input name="name" required maxlength="120" value="${escapeAttr(season.name || "")}" placeholder="Saison 2026/2027">
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
    <label class="full">Bezeichnung
      <input name="name" required maxlength="120" value="${escapeAttr(contributionClass.name || "")}" placeholder="Standardbeitrag">
    </label>
    <label>Betrag
      <input name="amount" required type="number" min="0" max="999999.99" step="0.01" value="${escapeAttr(contributionClass.amount ?? "")}">
    </label>
    <label>Position
      <input name="position" required type="number" min="1" max="9999" step="1" inputmode="numeric" value="${escapeAttr(contributionClass.position ?? nextPosition(contributionClasses()))}">
    </label>
    <label>Status
      <select name="active">${optionList([
        { value: "true", label: "Aktiv" },
        { value: "false", label: "Inaktiv" }
      ], String(contributionClass.active ?? true))}</select>
    </label>
    ${contributionClass.id && contributionClass.canDelete
      ? '<div class="full dialog-actions"><button class="button danger" type="button" data-delete-contribution-class>Beitragsklasse löschen</button></div>'
      : ""}
  </form>`;
}

async function deleteContributionClass(contributionClass) {
  const confirmed = await confirmAction(
    `Unbenutzte Beitragsklasse „${contributionClass.name}“ endgültig löschen?`
  );
  if (!confirmed) return false;

  snapshot = await runWrite(
    () => call("delete_contribution_class", {
      id: contributionClass.id,
      revision: contributionClass.revision
    }),
    "Beitragsklasse wurde gelöscht."
  );
  renderAll();
  return true;
}

function openContributionClass(contributionClass = null) {
  const dialog = openDialog({
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

  dialog.querySelector("[data-delete-contribution-class]")
    ?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (await deleteContributionClass(contributionClass)) dialog.close();
      } catch (error) {
        button.disabled = false;
        showToast(
          error?.message || "Beitragsklasse konnte nicht gelöscht werden.",
          "error",
          6500
        );
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
      <input value="${escapeAttr(`${memberName(member)}`)}" disabled>
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
      <input value="${escapeAttr(`${contribution.memberName}`)}" disabled>
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
    `${money(report.amount)} für ${report.memberName} als bezahlt bestätigen?`
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
    kicker: `${report.memberName} · ${money(report.amount)}`,
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
    <div class="v4-heading-row">
      <h3>Beitragsklassen</h3>
      <button id="addContributionClassButton" class="button secondary v4-heading-action" type="button">+ Beitragsklasse</button>
    </div>
    <p class="v4-section-note">Beträge werden bei der Zuordnung als Sollbetrag festgeschrieben.</p>
    ${classes.length ? `<div class="v4-settings-list" aria-label="Beitragsklassen">${classes.map(item => `<button class="v4-settings-row" type="button" data-edit-contribution-class="${escapeAttr(item.id)}">
      <span class="v4-settings-row-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(money(item.amount))} · Position ${escapeHtml(item.position)}</small></span>
      <span class="v4-settings-row-end"><span class="v4-inline-state ${item.active ? "is-active" : "is-inactive"}"><i aria-hidden="true"></i>${item.active ? "Aktiv" : "Inaktiv"}</span><span class="v4-row-chevron" aria-hidden="true">›</span></span>
    </button>`).join("")}</div>` : empty("Noch keine Beitragsklassen angelegt.")}
  </section>`;
}

function contributionStatus(contribution) {
  if (!contribution) {
    return { key: "unassigned", label: "Nicht zugeordnet" };
  }
  if (Number(contribution.pendingAmount || 0) > 0) {
    return { key: "pending", label: "In Prüfung" };
  }
  if (Number(contribution.openAmount || 0) > 0) {
    return { key: "open", label: "Offen" };
  }
  return { key: "paid", label: "Bezahlt" };
}

function contributionStatusIndicator(contribution) {
  const status = contributionStatus(contribution);
  return `<span class="v4-contribution-status is-${status.key}">
    <i aria-hidden="true"></i><span>${escapeHtml(status.label)}</span>
  </span>`;
}

function contributionDetailMarkup(member, contribution) {
  return `<div class="v4-detail-grid">
    <div class="full"><span>Beitragsjahr</span><strong>${escapeHtml(selectedSeason()?.name || "–")}</strong></div>
    <div class="full"><span>Beitragsklasse</span><strong>${escapeHtml(contribution?.contributionClassName || "Nicht zugeordnet")}</strong></div>
    <div><span>Soll</span><strong>${escapeHtml(money(contribution?.amountDue))}</strong></div>
    <div><span>Bestätigt</span><strong>${escapeHtml(money(contribution?.paidAmount))}</strong></div>
    <div><span>In Prüfung</span><strong>${escapeHtml(money(contribution?.pendingAmount))}</strong></div>
    <div><span>Offen</span><strong>${escapeHtml(money(contribution?.openAmount))}</strong></div>
    <div class="full"><span>Status</span><strong>${contributionStatusIndicator(contribution)}</strong></div>
    ${contribution?.notes ? `<div class="full"><span>Notiz</span><strong class="v4-preserve-lines">${escapeHtml(contribution.notes)}</strong></div>` : ""}
  </div>
  <div class="dialog-actions v4-detail-actions">
    ${snapshot.canManageFinance ? `<button class="button secondary" type="button" data-dialog-assign-contribution="${escapeAttr(member.id)}">${contribution ? "Zuordnung ändern" : "Beitrag zuordnen"}</button>` : ""}
    ${contribution && snapshot.canReportPayments && Number(contribution.reportableAmount) > 0
      ? `<button class="button primary" type="button" data-dialog-report-contribution="${escapeAttr(contribution.id)}">Zahlung melden</button>`
      : ""}
  </div>`;
}

function openContributionDetails(member) {
  const contribution = contributionFor(member.id);
  const dialog = openDialog({
    title: memberName(member),
    kicker: "Mitgliedsbeitrag",
    body: contributionDetailMarkup(member, contribution)
  });

  dialog.querySelector("[data-dialog-assign-contribution]")
    ?.addEventListener("click", () => openAssignment(member));

  dialog.querySelector("[data-dialog-report-contribution]")
    ?.addEventListener("click", () => {
      if (contribution) openPaymentReport(contribution);
    });
}

function paymentReportDetailMarkup(report) {
  return `<div class="v4-detail-grid">
    <div class="full"><span>Mitglied</span><strong>${escapeHtml(report.memberName)}</strong></div>
    <div><span>Betrag</span><strong>${escapeHtml(money(report.amount))}</strong></div>
    <div><span>Status</span><strong>${paymentStatusBadge(report.status)}</strong></div>
    <div><span>Zahlungsdatum</span><strong>${escapeHtml(fmtDate(report.paidOn))}</strong></div>
    <div><span>Konto</span><strong>${escapeHtml(report.accountName)}</strong></div>
    <div><span>Zahlungsart</span><strong>${escapeHtml(report.paymentMethodLabel)}</strong></div>
    <div><span>Gemeldet von</span><strong>${escapeHtml(report.reportedByName || "–")}</strong></div>
    <div><span>Gemeldet am</span><strong>${escapeHtml(fmtDateTime(report.reportedAt))}</strong></div>
    ${report.rejectionReason ? `<div class="full"><span>Ablehnungsgrund</span><strong>${escapeHtml(report.rejectionReason)}</strong></div>` : ""}
    ${report.reversalReason ? `<div class="full"><span>Stornogrund</span><strong>${escapeHtml(report.reversalReason)}</strong></div>` : ""}
  </div>
  ${report.status === "PENDING" && snapshot.canManageFinance ? `<div class="dialog-actions v4-detail-actions">
    <button class="button primary" type="button" data-dialog-confirm-payment="${escapeAttr(report.id)}">Bestätigen</button>
    <button class="button danger" type="button" data-dialog-reject-payment="${escapeAttr(report.id)}">Ablehnen</button>
  </div>` : ""}`;
}

function openPaymentReportDetails(report) {
  const dialog = openDialog({
    title: "Zahlungsmeldung",
    kicker: selectedSeason()?.name || "Beiträge",
    body: paymentReportDetailMarkup(report)
  });

  dialog.querySelector("[data-dialog-confirm-payment]")
    ?.addEventListener("click", async () => {
      await confirmPayment(report);
      dialog.close();
    });

  dialog.querySelector("[data-dialog-reject-payment]")
    ?.addEventListener("click", () => openRejectPayment(report));
}

function renderPaymentReports(reports) {
  if (!reports.length) {
    return empty("Für dieses Beitragsjahr liegen noch keine Zahlungsmeldungen vor.");
  }

  return `<div class="v4-table-wrap v4-desktop-table"><table class="v4-table">
    <thead><tr>
      <th>Mitglied</th>
      <th>Betrag</th>
      <th>Zahlung</th>
      <th>Status</th>
      <th></th>
    </tr></thead>
    <tbody>${reports.map(report => `<tr>
      <td><strong>${escapeHtml(report.memberName)}</strong></td>
      <td class="v4-money">${escapeHtml(money(report.amount))}</td>
      <td>${escapeHtml(fmtDate(report.paidOn))}<small>${escapeHtml(report.accountName)} · ${escapeHtml(report.paymentMethodLabel)}</small></td>
      <td>${paymentStatusBadge(report.status)}</td>
      <td><button class="button small secondary v4-row-action" type="button" data-open-payment-report="${escapeAttr(report.id)}">Details <span aria-hidden="true">›</span></button></td>
    </tr>`).join("")}</tbody>
  </table></div>
  <div class="v4-mobile-records v4-payment-mobile-list">${reports.map(report => `<button class="v4-compact-row" type="button" data-open-payment-report="${escapeAttr(report.id)}">
    <span><strong>${escapeHtml(report.memberName)}</strong><small>${escapeHtml(fmtDate(report.paidOn))}</small></span>
    <span class="v4-compact-row-end"><strong>${escapeHtml(money(report.amount))}</strong>${paymentStatusBadge(report.status)}</span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`).join("")}</div>`;
}

function openContributionManagement(season) {
  const dialog = openDialog({
    title: "Beitragsjahr verwalten",
    kicker: "Beiträge",
    body: `<div class="v4-management-grid">
      <button class="button secondary" type="button" data-contribution-management="create">Beitragsjahr anlegen</button>
      <button class="button secondary" type="button" data-contribution-management="edit" ${season ? "" : "disabled"}>Aktuelles Jahr bearbeiten</button>
    </div>`
  });

  dialog.querySelector('[data-contribution-management="create"]')
    ?.addEventListener("click", () => openSeason());
  dialog.querySelector('[data-contribution-management="edit"]')
    ?.addEventListener("click", () => {
      if (season) openSeason(season);
    });
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
    <div class="v4-heading-row">
      <h3>Mitgliedsbeiträge</h3>
      ${snapshot?.canManageFinance ? '<button id="contributionManagementButton" class="button secondary v4-heading-action" type="button">Verwalten <span aria-hidden="true">›</span></button>' : ""}
    </div>
    ${seasons.length ? `<div class="v4-contribution-season-control"><select id="contributionSeasonSelect" aria-label="Beitragsjahr">
      ${optionList(
        seasons.map(item => ({
          value: item.id,
          label: `${item.name}${item.active ? "" : " · inaktiv"}`
        })),
        activeContributionSeasonId
      )}
    </select></div>` : ""}

    ${!season ? empty("Noch kein Beitragsjahr angelegt.") : `
      <div class="v4-finance-summary">
        <article class="card"><span>Soll</span><strong>${escapeHtml(money(summary.due))}</strong></article>
        <article class="card"><span>Bestätigt</span><strong>${escapeHtml(money(summary.paid))}</strong></article>
        <article class="card"><span>Offen</span><strong>${escapeHtml(money(summary.open))}</strong></article>
        <article class="card"><span>In Prüfung</span><strong>${escapeHtml(money(summary.pending))}</strong></article>
      </div>

      <section class="card v4-contribution-members-section">
        <div class="v4-heading-row v4-subheading-row">
          <div><h3>Beiträge je Mitglied</h3><p>${escapeHtml(season.name)}</p></div>
        </div>
        ${members.length ? `
          <div class="v4-table-wrap v4-desktop-table"><table class="v4-table">
            <thead><tr>
              <th>Mitglied</th><th>Beitragsklasse</th><th>Soll</th><th>Bestätigt</th><th>In Prüfung</th><th>Offen</th><th></th>
            </tr></thead>
            <tbody>${members.map(member => {
              const contribution = contributionFor(member.id);
              return `<tr>
                <td><strong>${escapeHtml(memberName(member))}</strong></td>
                <td>${escapeHtml(contribution?.contributionClassName || "Nicht zugeordnet")}</td>
                <td class="v4-money">${escapeHtml(money(contribution?.amountDue))}</td>
                <td class="v4-money">${escapeHtml(money(contribution?.paidAmount))}</td>
                <td class="v4-money">${escapeHtml(money(contribution?.pendingAmount))}</td>
                <td class="v4-money"><strong>${escapeHtml(money(contribution?.openAmount))}</strong></td>
                <td><button class="button small secondary v4-row-action" type="button" data-open-contribution-member="${escapeAttr(member.id)}">Details <span aria-hidden="true">›</span></button></td>
              </tr>`;
            }).join("")}</tbody>
          </table></div>
          <div class="v4-contribution-mobile-list">${members.map(member => {
            const contribution = contributionFor(member.id);
            return `<button class="v4-contribution-mobile-card" type="button" data-open-contribution-member="${escapeAttr(member.id)}">
              <strong>${escapeHtml(memberName(member))}</strong>
              <span class="v4-contribution-row-end">${contributionStatusIndicator(contribution)}<span class="v4-row-chevron" aria-hidden="true">›</span></span>
            </button>`;
          }).join("")}</div>
        ` : empty("Noch keine Mitglieder angelegt.")}
      </section>

      <section class="card v4-payment-report-section">
        <div class="v4-heading-row v4-subheading-row"><h3>Zahlungsmeldungen</h3></div>
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

  document.getElementById("contributionManagementButton")
    ?.addEventListener("click", () => openContributionManagement(season));

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

  panel.querySelectorAll("[data-open-contribution-member]").forEach(button => {
    button.addEventListener("click", () => {
      const member = members.find(item => item.id === button.dataset.openContributionMember);
      if (member) openContributionDetails(member);
    });
  });

  panel.querySelectorAll("[data-open-payment-report]").forEach(button => {
    button.addEventListener("click", () => {
      const report = reports.find(item => item.id === button.dataset.openPaymentReport);
      if (report) openPaymentReportDetails(report);
    });
  });
}

function ensureFinanceAccountFilter() {
  if (
    activeFinanceAccountId !== "ALL"
    && !financeAccounts().some(account => account.id === activeFinanceAccountId)
  ) {
    activeFinanceAccountId = "ALL";
  }
}

function accountForm(account = {}) {
  const isDefaultCash = account.code === "KASSE";
  const isNewAccount = !account.id;

  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(account.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(account.revision || "")}">
    <label>Bezeichnung
      <input name="name" required maxlength="120" value="${escapeAttr(account.name || "")}">
    </label>
    <label>Kontotyp
      <select name="accountType" ${isDefaultCash ? "disabled" : ""}>
        ${optionList(ACCOUNT_TYPES, account.accountType || "BANK")}
      </select>
      ${isDefaultCash ? '<input type="hidden" name="accountType" value="CASH">' : ""}
    </label>
    <label>Position
      <input name="position" required type="number" min="1" max="9999" step="1" inputmode="numeric" value="${escapeAttr(account.position ?? nextPosition(financeAccounts()))}">
    </label>
    <label>Status
      ${isDefaultCash
        ? '<input value="Aktiv" disabled><input type="hidden" name="active" value="true">'
        : `<select name="active">${optionList([
            { value: "true", label: "Aktiv" },
            { value: "false", label: "Inaktiv" }
          ], String(account.active ?? true))}</select>`}
    </label>
    ${isNewAccount ? `<label>Startsaldo
      <input
        name="openingBalance"
        type="number"
        min="-999999.99"
        max="999999.99"
        step="0.01"
        inputmode="decimal"
      >
    </label>
    <label>Stand zum
      <input name="openingBalanceDate" type="date" value="${localDate()}">
    </label>` : ""}
  </form>`;
}

function openFinanceAccount(account = null) {
  openDialog({
    title: account ? "Konto bearbeiten" : "Konto anlegen",
    kicker: "Kasse",
    body: accountForm(account || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_finance_account", values),
        account ? "Konto wurde aktualisiert." : "Konto wurde angelegt."
      );
      ensureFinanceAccountFilter();
      renderAll();
    }
  });
}

async function deleteFinanceAccount(account) {
  const confirmed = await confirmAction(
    `Unbenutztes Konto „${account.name}“ endgültig löschen?`
  );
  if (!confirmed) return;

  snapshot = await runWrite(
    () => call("delete_finance_account", {
      id: account.id,
      revision: account.revision
    }),
    "Konto wurde gelöscht."
  );
  ensureFinanceAccountFilter();
  renderAll();
}

function financeEntryForm(entryType) {
  const accounts = financeAccounts().filter(account => account.active);
  const preferred = accounts.find(account => account.code === "KASSE")
    || accounts[0]
    || {};

  return `<form class="form-grid">
    <input type="hidden" name="entryType" value="${escapeAttr(entryType)}">
    <label>Konto
      <select name="accountId" required>
        ${optionList(
          accounts.map(account => ({
            value: account.id,
            label: `${account.name} · ${accountTypeLabel(account.accountType)}`
          })),
          preferred.id || "",
          "Konto auswählen"
        )}
      </select>
    </label>
    <label>Betrag
      <input name="amount" required type="number" min="0.01" max="999999.99" step="0.01">
    </label>
    <label>Buchungsdatum
      <input name="bookedOn" required type="date" value="${localDate()}">
    </label>
    <label>Zahlungsart
      <select name="paymentMethod">
        ${optionList(PAYMENT_METHODS, preferred.accountType === "CASH" ? "CASH" : "BANK")}
      </select>
    </label>
    <label class="full">Beschreibung
      <input name="description" required maxlength="500" placeholder="${entryType === "INCOME" ? "Grund der Einnahme" : "Grund der Ausgabe"}">
    </label>
  </form>`;
}

function openFinanceEntry(entryType) {
  openDialog({
    title: entryType === "INCOME" ? "Einnahme buchen" : "Ausgabe buchen",
    kicker: "Kasse",
    body: financeEntryForm(entryType),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("create_finance_entry", values),
        entryType === "INCOME"
          ? "Einnahme wurde gebucht."
          : "Ausgabe wurde gebucht."
      );
      renderAll();
    }
  });
}

function transferForm() {
  const accounts = financeAccounts().filter(account => account.active);

  return `<form class="form-grid">
    <label>Von Konto
      <select name="fromAccountId" required>
        ${optionList(
          accounts.map(account => ({
            value: account.id,
            label: account.name
          })),
          "",
          "Quellkonto auswählen"
        )}
      </select>
    </label>
    <label>Nach Konto
      <select name="toAccountId" required>
        ${optionList(
          accounts.map(account => ({
            value: account.id,
            label: account.name
          })),
          "",
          "Zielkonto auswählen"
        )}
      </select>
    </label>
    <label>Betrag
      <input name="amount" required type="number" min="0.01" max="999999.99" step="0.01">
    </label>
    <label>Buchungsdatum
      <input name="bookedOn" required type="date" value="${localDate()}">
    </label>
    <label class="full">Beschreibung
      <input name="description" required maxlength="500" placeholder="Grund der Umbuchung">
    </label>
  </form>`;
}

function openFinanceTransfer() {
  openDialog({
    title: "Umbuchung",
    kicker: "Kasse",
    body: transferForm(),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("transfer_finance", values),
        "Umbuchung wurde gebucht."
      );
      renderAll();
    }
  });
}

function reversalForm(entry) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(entry.id)}">
    <label class="full">Originalbuchung
      <input value="${escapeAttr(`#${entry.entryNo} · ${entry.accountName} · ${signedMoney(entry)} · ${entry.description}`)}" disabled>
    </label>
    <label>Stornodatum
      <input name="bookedOn" required type="date" value="${localDate()}">
    </label>
    <label class="full">Stornogrund
      <textarea name="reason" required maxlength="1000" rows="4"></textarea>
    </label>
  </form>`;
}

function openFinanceReversal(entry) {
  openDialog({
    title: entry.sourceType.startsWith("TRANSFER")
      ? "Umbuchung stornieren"
      : "Buchung stornieren",
    kicker: "Kasse",
    body: reversalForm(entry),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("reverse_finance_entry", values),
        entry.sourceType.startsWith("TRANSFER")
          ? "Umbuchung wurde vollständig storniert."
          : "Buchung wurde storniert."
      );
      renderAll();
    }
  });
}

function renderFinanceAccounts() {
  const accounts = financeAccounts();

  if (!accounts.length) {
    return empty("Noch keine Finanzkonten angelegt.");
  }

  return `<div class="v4-account-grid v4-account-grid-compact">
    ${accounts.map(account => `<button class="card v4-account-card v4-account-card-button ${account.active ? "" : "is-inactive"}" type="button" data-open-finance-account="${escapeAttr(account.id)}">
      <span class="v4-account-card-head"><span class="v4-account-name">${escapeHtml(account.name)}</span><span class="v4-row-chevron" aria-hidden="true">›</span></span>
      <small class="v4-account-meta">${escapeHtml(accountTypeLabel(account.accountType))}${account.active ? "" : " · inaktiv"} · Position ${escapeHtml(account.position)}</small>
      <strong class="v4-account-balance">${escapeHtml(money(account.balance))}</strong>
    </button>`).join("")}
  </div>`;
}

function compactFinanceEntries(entries, { showAccount = true, showBalance = false } = {}) {
  if (!entries.length) return empty("Noch keine Buchungen vorhanden.");

  return `<div class="v4-compact-entry-list">
    ${entries.map(entry => `<button class="v4-compact-entry ${entry.isReversed ? "is-reversed" : ""}" type="button" data-open-finance-entry="${escapeAttr(entry.id)}">
      <span class="v4-compact-entry-main">
        <strong>${escapeHtml(entry.description)}</strong>
        <small>${escapeHtml(fmtDate(entry.bookedOn))}${showAccount ? ` · ${escapeHtml(entry.accountName)}` : ""}</small>
      </span>
      <span class="v4-compact-entry-amount ${entry.entryType === "INCOME" ? "is-positive" : "is-negative"}">
        <strong>${escapeHtml(signedMoney(entry))}</strong>
        ${showBalance && entry.runningBalance !== undefined ? `<small>Saldo ${escapeHtml(money(entry.runningBalance))}</small>` : ""}
      </span>
      <span class="v4-row-chevron" aria-hidden="true">›</span>
    </button>`).join("")}
  </div>`;
}

function financeEntryDetailMarkup(entry) {
  return `<div class="v4-detail-grid">
    <div><span>Buchungsnummer</span><strong>#${escapeHtml(entry.entryNo)}</strong></div>
    <div><span>Datum</span><strong>${escapeHtml(fmtDate(entry.bookedOn))}</strong></div>
    <div class="full"><span>Beschreibung</span><strong>${escapeHtml(entry.description)}</strong></div>
    <div><span>Konto</span><strong>${escapeHtml(entry.accountName)}</strong></div>
    <div><span>Betrag</span><strong class="${entry.entryType === "INCOME" ? "is-positive" : "is-negative"}">${escapeHtml(signedMoney(entry))}</strong></div>
    <div><span>Buchungsart</span><strong>${escapeHtml(entryTypeLabel(entry.entryType))}</strong></div>
    <div><span>Herkunft</span><strong>${escapeHtml(sourceTypeLabel(entry.sourceType))}</strong></div>
    <div><span>Zahlungsart</span><strong>${escapeHtml(entry.paymentMethodLabel || "–")}</strong></div>
    <div><span>Gegenkonto</span><strong>${escapeHtml(entry.counterAccountName || "–")}</strong></div>
    ${entry.runningBalance !== undefined ? `<div><span>Saldo danach</span><strong>${escapeHtml(money(entry.runningBalance))}</strong></div>` : ""}
    <div><span>Erfasst von</span><strong>${escapeHtml(entry.createdByName || "–")}</strong></div>
    <div><span>Erfasst am</span><strong>${escapeHtml(fmtDateTime(entry.createdAt))}</strong></div>
    ${entry.isReversed ? `<div class="full"><span>Storniert</span><strong>${escapeHtml(entry.reversalReason || "Ja")}</strong></div>` : ""}
    ${entry.reversesEntryId ? '<div class="full"><span>Hinweis</span><strong>Diese Buchung ist eine Stornobuchung.</strong></div>' : ""}
  </div>
  ${entry.canReverse ? `<div class="dialog-actions v4-detail-actions"><button class="button danger" type="button" data-dialog-reverse-entry="${escapeAttr(entry.id)}">Stornieren</button></div>` : ""}`;
}

function openFinanceEntryDetails(entry) {
  const dialog = openDialog({
    title: `Buchung #${entry.entryNo}`,
    kicker: "Kasse",
    body: financeEntryDetailMarkup(entry)
  });

  dialog.querySelector("[data-dialog-reverse-entry]")
    ?.addEventListener("click", () => openFinanceReversal(entry));
}

function bindCompactFinanceEntries(scope, entries) {
  scope.querySelectorAll("[data-open-finance-entry]").forEach(button => {
    button.addEventListener("click", () => {
      const entry = entries.find(item => item.id === button.dataset.openFinanceEntry);
      if (entry) openFinanceEntryDetails(entry);
    });
  });
}

function financeAccountDetailMarkup(account, entries) {
  return `<div class="v4-account-detail-head">
    <div><span>${escapeHtml(accountTypeLabel(account.accountType))}</span><strong>${escapeHtml(account.name)}</strong></div>
    <strong class="v4-account-detail-balance">${escapeHtml(money(account.balance))}</strong>
  </div>
  <div class="v4-detail-grid v4-account-detail-grid">
    <div><span>Kontotyp</span><strong>${escapeHtml(accountTypeLabel(account.accountType))}</strong></div>
    <div><span>Status</span><strong>${account.active ? "Aktiv" : "Inaktiv"}</strong></div>
    <div><span>Buchungen</span><strong>${entries.length}</strong></div>
  </div>
  ${snapshot.canManageFinance ? `<div class="dialog-actions v4-detail-actions">
    <button class="button secondary" type="button" data-dialog-edit-account="${escapeAttr(account.id)}">Bearbeiten</button>
    ${account.canDelete ? `<button class="button danger" type="button" data-dialog-delete-account="${escapeAttr(account.id)}">Löschen</button>` : ""}
  </div>` : ""}
  <section class="v4-dialog-ledger">
    <div class="v4-dialog-section-title"><h3>Kontoauszug</h3><span>${entries.length} Buchungen</span></div>
    ${compactFinanceEntries(entries, { showAccount: false, showBalance: true })}
  </section>`;
}

function openFinanceAccountDetails(account) {
  const entries = accountStatementEntries(account.id);
  const dialog = openDialog({
    title: account.name,
    kicker: "Konto",
    body: financeAccountDetailMarkup(account, entries)
  });

  dialog.querySelector("[data-dialog-edit-account]")
    ?.addEventListener("click", () => openFinanceAccount(account));

  dialog.querySelector("[data-dialog-delete-account]")
    ?.addEventListener("click", async buttonEvent => {
      const button = buttonEvent.currentTarget;
      button.disabled = true;
      try {
        await deleteFinanceAccount(account);
        dialog.close();
      } catch (error) {
        button.disabled = false;
        showToast(error?.message || "Konto konnte nicht gelöscht werden.", "error", 6500);
      }
    });

  bindCompactFinanceEntries(dialog, entries);
}

function openFinanceManagement() {
  const canTransfer = financeAccounts().filter(account => account.active).length >= 2;
  const dialog = openDialog({
    title: "Verwaltung",
    kicker: "Kasse",
    body: `<div class="v4-management-grid">
      <button class="button secondary" type="button" data-finance-management="income">Einnahme</button>
      <button class="button secondary" type="button" data-finance-management="expense">Ausgabe</button>
      <button class="button secondary" type="button" data-finance-management="transfer" ${canTransfer ? "" : "disabled"}>Umbuchung</button>
      <button class="button secondary" type="button" data-finance-management="account">Konto anlegen</button>
    </div>`
  });

  dialog.querySelector('[data-finance-management="income"]')
    ?.addEventListener("click", () => openFinanceEntry("INCOME"));
  dialog.querySelector('[data-finance-management="expense"]')
    ?.addEventListener("click", () => openFinanceEntry("EXPENSE"));
  dialog.querySelector('[data-finance-management="transfer"]')
    ?.addEventListener("click", () => openFinanceTransfer());
  dialog.querySelector('[data-finance-management="account"]')
    ?.addEventListener("click", () => openFinanceAccount());
}

function renderCashbookEntries(entries) {
  if (!entries.length) {
    return empty("Noch keine Buchungen vorhanden.");
  }

  return `<div class="v4-ledger-search">
    <label class="sr-only" for="financeEntrySearch">Buchungen durchsuchen</label>
    <input id="financeEntrySearch" type="search" placeholder="Buchungen durchsuchen …" autocomplete="off" value="${escapeAttr(financeEntrySearchQuery)}">
  </div>
  <div id="financeLedgerList" class="v4-cashbook-ledger" aria-label="Alle Buchungen">
    ${entries.map((entry, index) => {
      const search = [
        entry.entryNo,
        entry.bookedOn,
        entry.accountName,
        entry.description,
        entry.paymentMethodLabel,
        entry.createdByName,
        sourceTypeLabel(entry.sourceType),
        entry.amount,
        signedMoney(entry)
      ].join(" ").toLocaleLowerCase("de-DE");
      return `<button class="v4-compact-entry ${entry.isReversed ? "is-reversed" : ""}" type="button" data-open-finance-entry="${escapeAttr(entry.id)}" data-finance-search="${escapeAttr(search)}" data-finance-index="${index}" ${index >= visibleCashbookEntries ? "hidden" : ""}>
        <span class="v4-compact-entry-main">
          <strong>${escapeHtml(entry.description)}</strong>
          <small>${escapeHtml(fmtDate(entry.bookedOn))} · ${escapeHtml(entry.accountName)}</small>
        </span>
        <span class="v4-compact-entry-amount ${entry.entryType === "INCOME" ? "is-positive" : "is-negative"}"><strong>${escapeHtml(signedMoney(entry))}</strong></span>
        <span class="v4-row-chevron" aria-hidden="true">›</span>
      </button>`;
    }).join("")}
  </div>
  <div id="financeSearchEmpty" class="v4-inline-empty" hidden>Keine passenden Buchungen gefunden.</div>
  <div class="v4-load-more-row"><button id="showMoreFinanceEntries" class="button secondary v4-heading-action" type="button">Weitere Buchungen anzeigen</button></div>`;
}

function applyCashbookEntryVisibility(panel, entries) {
  const query = financeEntrySearchQuery.trim().toLocaleLowerCase("de-DE");
  const rows = [...panel.querySelectorAll("[data-finance-search]")];
  let matching = 0;
  let shown = 0;

  rows.forEach(row => {
    const matches = !query || row.dataset.financeSearch.includes(query);
    if (matches) matching += 1;
    const visible = matches && (Boolean(query) || shown < visibleCashbookEntries);
    row.hidden = !visible;
    if (visible) shown += 1;
  });

  const emptyNode = document.getElementById("financeSearchEmpty");
  if (emptyNode) emptyNode.hidden = matching > 0;

  const moreButton = document.getElementById("showMoreFinanceEntries");
  if (moreButton) {
    moreButton.hidden = Boolean(query) || visibleCashbookEntries >= matching;
  }

  const countNode = document.getElementById("financeEntryCount");
  if (countNode) {
    countNode.textContent = query
      ? `${matching} Treffer`
      : `${entries.length} Einträge über alle Konten`;
  }
}

function renderCashbook(panel) {
  const accounts = financeAccounts();
  const entries = financeEntries();

  panel.innerHTML = `
    <div class="v4-heading-row">
      <h3>Unsere Fanclub-Kassen</h3>
      ${snapshot.canManageFinance ? '<button id="financeManagementButton" class="button secondary v4-heading-action" type="button">Verwaltung <span aria-hidden="true">›</span></button>' : ""}
    </div>

    ${renderFinanceAccounts()}

    <section class="card v4-cashbook-section v4-cashbook-compact-section">
      <div class="v4-heading-row v4-subheading-row"><div><h3>Buchungen</h3><p id="financeEntryCount">${entries.length} Einträge über alle Konten</p></div></div>
      ${renderCashbookEntries(entries)}
    </section>
  `;

  document.getElementById("financeManagementButton")
    ?.addEventListener("click", () => openFinanceManagement());

  panel.querySelectorAll("[data-open-finance-account]").forEach(button => {
    button.addEventListener("click", () => {
      const account = accounts.find(item => item.id === button.dataset.openFinanceAccount);
      if (account) openFinanceAccountDetails(account);
    });
  });

  const searchInput = document.getElementById("financeEntrySearch");
  searchInput?.addEventListener("input", () => {
    financeEntrySearchQuery = searchInput.value;
    applyCashbookEntryVisibility(panel, entries);
  });

  document.getElementById("showMoreFinanceEntries")
    ?.addEventListener("click", () => {
      visibleCashbookEntries += CASHBOOK_PAGE_SIZE;
      applyCashbookEntryVisibility(panel, entries);
    });

  bindCompactFinanceEntries(panel, entries);
  applyCashbookEntryVisibility(panel, entries);
}

function render() {
  const panel = document.getElementById("fanclubPanel");
  if (!panel || !snapshot) return;

  if (activeTab === "offices") {
    renderOffices(panel);
  } else if (activeTab === "contributions") {
    renderContributions(panel);
  } else if (activeTab === "cashbook") {
    renderCashbook(panel);
  } else {
    renderMembers(panel);
  }
}

function renderAll() {
  ensureContributionSeason();
  ensureFinanceAccountFilter();
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

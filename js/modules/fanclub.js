import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  fmtDate,
  openDialog,
  optionList,
  runWrite,
  statusBadge
} from "./common.js";

let snapshot = null;
let activeTab = "members";

function memberName(member) {
  return `${member.firstName || ""} ${member.lastName || ""}`.trim();
}

function tabs() {
  const slot = document.getElementById("fanclubTabs");
  if (!slot) return;
  slot.innerHTML = `
    <div class="v4-tabs" role="tablist">
      <button class="v4-tab ${activeTab === "members" ? "active" : ""}" data-tab="members" type="button">Mitglieder</button>
      <button class="v4-tab ${activeTab === "offices" ? "active" : ""}" data-tab="offices" type="button">Ämter</button>
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
  document.getElementById("addMemberButton")?.addEventListener("click", () => openMember());
  panel.querySelectorAll("[data-edit-member]").forEach(button => {
    button.addEventListener("click", () => openMember(members.find(item => item.id === button.dataset.editMember)));
  });
}

function renderOffices(panel) {
  const members = (snapshot?.members || []).filter(member => member.status === "ACTIVE");
  const offices = snapshot?.offices || [];
  panel.innerHTML = `
    <div class="v4-toolbar"><div><h3>Fünf feste Amtsplätze</h3><p>Jedes aktive Mitglied kann höchstens ein Amt besitzen.</p></div></div>
    <form id="officeForm" class="v4-office-grid">
      ${offices.map(office => `<label class="card"><span>${escapeHtml(office.label)}</span><select name="${escapeAttr(office.code)}" ${snapshot.canManageOffices ? "" : "disabled"}>${optionList(members.map(member => ({ value: member.id, label: `${member.memberCode} · ${memberName(member)}` })), office.memberId || "", "Unbesetzt")}</select></label>`).join("")}
      ${snapshot.canManageOffices ? '<div class="full dialog-actions"><button class="button primary" type="submit">Alle Amtsplätze speichern</button></div>' : ""}
    </form>`;
  document.getElementById("officeForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!await confirmAction("Alle fünf Amtsplätze mit dieser Besetzung speichern?")) return;
    const form = event.currentTarget;
    const slots = offices.map(office => ({
      code: office.code,
      memberId: form.elements.namedItem(office.code)?.value || ""
    }));
    try {
      snapshot = await runWrite(() => call("save_offices", { slots }), "Amtsplätze wurden gespeichert.");
      renderAll();
    } catch (error) {
      const panelNode = document.getElementById("fanclubPanel");
      panelNode.insertAdjacentHTML("afterbegin", errorPanel(error, "Amtsplätze konnten nicht gespeichert werden"));
    }
  });
}

function render() {
  const panel = document.getElementById("fanclubPanel");
  if (!panel || !snapshot) return;
  if (activeTab === "offices") renderOffices(panel);
  else renderMembers(panel);
}

function renderAll() {
  tabs();
  render();
  const status = document.getElementById("fanclubStatus");
  if (status) { status.textContent = "Aktuell"; status.className = "status-pill success"; }
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
    if (status) { status.textContent = "Fehler"; status.className = "status-pill error"; }
  }
}

export function noop() {}

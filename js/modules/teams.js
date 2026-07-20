import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  openDialog,
  optionList,
  runWrite,
  statusBadge
} from "./common.js";

let snapshot = null;

function teamForm(team = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(team.id || "")}">
    <label>Technischer Code<input name="code" required pattern="[A-Z][A-Z0-9_]{1,63}" maxlength="64" value="${escapeAttr(team.code || "")}" placeholder="BUS_ORGA"></label>
    <label>Name<input name="name" required maxlength="160" value="${escapeAttr(team.name || "")}"></label>
    <label class="full">Beschreibung<textarea name="description" maxlength="2000" rows="4">${escapeHtml(team.description || "")}</textarea></label>
    <label class="checkbox-row full"><input name="active" type="checkbox" ${team.active !== false ? "checked" : ""}> Team ist aktiv</label>
  </form>`;
}

function normalizeCheckbox(values, name) {
  return { ...values, [name]: values[name] === "on" };
}

function openTeam(team = null) {
  openDialog({
    title: team ? "Team bearbeiten" : "Team anlegen",
    kicker: "Teams",
    body: teamForm(team || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_team", normalizeCheckbox(values, "active")),
        team ? "Team wurde aktualisiert." : "Team wurde angelegt."
      );
      render();
    }
  });
}

function membershipForm(team, membership = {}) {
  const users = snapshot?.users || [];
  const roles = snapshot?.canCreateTeam
    ? [
        { value: "LEAD", label: "Teamleiter" },
        { value: "CO_LEAD", label: "Co-Teamleiter" },
        { value: "MEMBER", label: "Mitglied" }
      ]
    : [
        { value: "CO_LEAD", label: "Co-Teamleiter" },
        { value: "MEMBER", label: "Mitglied" }
      ];
  return `<form class="form-grid">
    <input type="hidden" name="teamId" value="${escapeAttr(team.id)}">
    <label class="full">Portalbenutzer<select name="userId" required ${membership.userId ? "disabled" : ""}>${optionList(users.map(user => ({ value: user.id, label: `${user.userCode} · ${user.name}` })), membership.userId || "", "Benutzer auswählen")}</select>${membership.userId ? `<input type="hidden" name="userId" value="${escapeAttr(membership.userId)}">` : ""}</label>
    <label class="full">Teamrolle<select name="role">${optionList(roles, membership.role || "MEMBER")}</select></label>
  </form>`;
}

function openMembership(team, membership = null) {
  openDialog({
    title: membership ? "Teamrolle bearbeiten" : "Teammitglied hinzufügen",
    kicker: team.name,
    body: membershipForm(team, membership || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_team_member", values),
        "Teammitgliedschaft wurde gespeichert."
      );
      render();
    }
  });
}

async function removeMembership(team, membership) {
  if (!await confirmAction(`${membership.name} aus dem Team entfernen?`)) return;
  snapshot = await runWrite(
    () => call("remove_team_member", { teamId: team.id, userId: membership.userId }),
    "Teammitglied wurde entfernt."
  );
  render();
}

async function deleteTeam(team) {
  if (!await confirmAction(`Team „${team.name}“ endgültig löschen? Mitgliedschaften und Teamfunktionen werden dabei entfernt.`)) return;
  snapshot = await runWrite(
    () => call("delete_team", { id: team.id }),
    "Team wurde gelöscht."
  );
  render();
}

function roleLabel(role) {
  return { LEAD: "Teamleiter", CO_LEAD: "Co-Teamleiter", MEMBER: "Mitglied" }[role] || role;
}

function teamCard(team) {
  const activeMembers = (team.members || []).filter(member => member.active);
  return `<article class="card v4-team-card">
    <header class="v4-card-header">
      <div><span class="subtle">${escapeHtml(team.code)}</span><h3>${escapeHtml(team.name)}</h3><p>${escapeHtml(team.description || "Keine Beschreibung")}</p></div>
      ${statusBadge(team.active ? "ACTIVE" : "INACTIVE")}
    </header>
    <div class="v4-team-members">
      ${activeMembers.length ? activeMembers.map(member => `<div class="v4-list-row">
        <div><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.userCode)} · ${escapeHtml(roleLabel(member.role))}</small></div>
        ${team.canManage ? `<div class="row-actions"><button class="button small secondary" data-edit-team-member="${escapeAttr(team.id)}:${escapeAttr(member.userId)}" type="button">Rolle</button><button class="button small ghost" data-remove-team-member="${escapeAttr(team.id)}:${escapeAttr(member.userId)}" type="button">Entfernen</button></div>` : ""}
      </div>`).join("") : '<p class="subtle">Noch keine aktiven Teammitglieder.</p>'}
    </div>
    ${team.canManage ? `<footer class="v4-card-actions"><button class="button small primary" data-add-team-member="${escapeAttr(team.id)}" type="button">Mitglied hinzufügen</button>${snapshot.canCreateTeam ? `<button class="button small secondary" data-edit-team="${escapeAttr(team.id)}" type="button">Team bearbeiten</button><button class="button small danger" data-delete-team="${escapeAttr(team.id)}" type="button">Team löschen</button>` : ""}</footer>` : ""}
  </article>`;
}

function render() {
  const panel = document.getElementById("teamsPanel");
  if (!panel || !snapshot) return;
  const teams = snapshot.teams || [];
  const tabs = document.getElementById("teamsTabs");
  if (tabs) tabs.innerHTML = `<div class="v4-toolbar"><div><strong>${teams.length} sichtbare Teams</strong><p>Teamleiter und Co-Teamleiter verwalten ihre eigenen Teams.</p></div>${snapshot.canCreateTeam ? '<button id="addTeamButton" class="button primary" type="button">Team anlegen</button>' : ""}</div>`;
  panel.innerHTML = teams.length ? `<div class="v4-card-grid">${teams.map(teamCard).join("")}</div>` : empty("Dir ist noch kein Team zugeordnet.");
  document.getElementById("addTeamButton")?.addEventListener("click", () => openTeam());
  panel.querySelectorAll("[data-edit-team]").forEach(button => button.addEventListener("click", () => openTeam(teams.find(team => team.id === button.dataset.editTeam))));
  panel.querySelectorAll("[data-delete-team]").forEach(button => button.addEventListener("click", async () => {
    const team = teams.find(item => item.id === button.dataset.deleteTeam);
    try { await deleteTeam(team); }
    catch (error) { panel.insertAdjacentHTML("afterbegin", errorPanel(error, "Team konnte nicht gelöscht werden")); }
  }));
  panel.querySelectorAll("[data-add-team-member]").forEach(button => button.addEventListener("click", () => openMembership(teams.find(team => team.id === button.dataset.addTeamMember))));
  panel.querySelectorAll("[data-edit-team-member]").forEach(button => button.addEventListener("click", () => {
    const [teamId, userId] = button.dataset.editTeamMember.split(":");
    const team = teams.find(item => item.id === teamId);
    openMembership(team, team.members.find(item => item.userId === userId));
  }));
  panel.querySelectorAll("[data-remove-team-member]").forEach(button => button.addEventListener("click", async () => {
    const [teamId, userId] = button.dataset.removeTeamMember.split(":");
    const team = teams.find(item => item.id === teamId);
    try { await removeMembership(team, team.members.find(item => item.userId === userId)); }
    catch (error) { panel.insertAdjacentHTML("afterbegin", errorPanel(error, "Teammitglied konnte nicht entfernt werden")); }
  }));
  const status = document.getElementById("teamsStatus");
  if (status) { status.textContent = "Aktuell"; status.className = "status-pill success"; }
}

export async function hydrateTeams(context = {}) {
  const panel = document.getElementById("teamsPanel");
  if (!panel) return;
  panel.innerHTML = '<article class="card loading-card"><h3>Teams werden geladen …</h3></article>';
  try {
    snapshot = await call("teams_snapshot");
    if (context.isCurrent && !context.isCurrent()) return;
    render();
  } catch (error) {
    panel.innerHTML = errorPanel(error);
    const status = document.getElementById("teamsStatus");
    if (status) { status.textContent = "Fehler"; status.className = "status-pill error"; }
  }
}

export function noop() {}

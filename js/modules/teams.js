import {
  call,
  confirmAction,
  currentUser,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  openDialog,
  optionList,
  runWrite,
  showToast,
  statusBadge
} from "./common.js";
import { navigate } from "../router.js";

let snapshot = null;

function teamForm(team = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(team.id || "")}">
    <label class="full">Name<input name="name" required maxlength="160" value="${escapeAttr(team.name || "")}"></label>
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
    <label class="full">Portalbenutzer<select name="userId" required ${membership.userId ? "disabled" : ""}>${optionList(users.map(user => ({ value: user.id, label: user.name })), membership.userId || "", "Benutzer auswählen")}</select>${membership.userId ? `<input type="hidden" name="userId" value="${escapeAttr(membership.userId)}">` : ""}</label>
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
  if (!await confirmAction(`${membership.name} aus dem Team entfernen?`)) {
    return;
  }

  snapshot = await runWrite(
    () => call("remove_team_member", {
      teamId: team.id,
      userId: membership.userId
    }),
    "Teammitglied wurde entfernt."
  );
  render();
}

async function deleteTeam(team) {
  if (Number(team.taskCount || 0) > 0) {
    const details = [
      Number(team.activeTaskCount || 0) > 0
        ? `${team.activeTaskCount} nicht archivierte`
        : "",
      Number(team.archivedTaskCount || 0) > 0
        ? `${team.archivedTaskCount} archivierte`
        : ""
    ].filter(Boolean).join(" und ");

    showToast(
      `Team „${team.name}“ kann noch nicht gelöscht werden. ${details} Aufgabe(n) sind zugeordnet.`,
      "error",
      5200
    );
    return;
  }

  if (!await confirmAction(
    `Team „${team.name}“ endgültig löschen? Mitgliedschaften und Teamfunktionen werden dabei entfernt.`
  )) {
    return;
  }

  snapshot = await runWrite(
    () => call("delete_team", { id: team.id }),
    "Team wurde gelöscht."
  );
  render();
}

function openTeamArchive(team) {
  const params = new URLSearchParams({
    tab: "archive",
    teamId: team.id
  });
  navigate("tasks", params);
}

function roleLabel(role) {
  return {
    LEAD: "Teamleiter",
    CO_LEAD: "Co-Teamleiter",
    MEMBER: "Mitglied"
  }[role] || role;
}

function taskDependencyNotice(team) {
  const active = Number(team.activeTaskCount || 0);
  const archived = Number(team.archivedTaskCount || 0);

  if (!active && !archived) return "";

  return `<div class="notice warning v4-team-task-dependency">
    <strong>Team kann noch nicht gelöscht werden</strong>
    <p>
      ${active ? `${active} nicht archivierte Aufgabe(n).` : ""}
      ${archived ? `${archived} archivierte Aufgabe(n).` : ""}
    </p>
    ${archived ? `<button class="button small secondary" type="button" data-open-team-archive="${escapeAttr(team.id)}">Archivierte Aufgaben anzeigen</button>` : ""}
  </div>`;
}

function ownTeamRole(team){const userId=currentUser().id;const membership=(team.members||[]).find(member=>member.userId===userId);return membership?roleLabel(membership.role):"";}
function teamListRow(team){const role=ownTeamRole(team);return `<button class="v4-team-list-row" type="button" data-open-team="${escapeAttr(team.id)}"><span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(role||`${(team.members||[]).filter(member=>member.active).length} Mitglieder`)}</small></span><span class="v4-row-chevron" aria-hidden="true">›</span></button>`;}
function teamDetailMarkup(team){const activeMembers=(team.members||[]).filter(member=>member.active);const taskCount=Number(team.taskCount||0);return `<div class="v4-detail-grid v4-team-detail-grid"><div class="v4-detail-wide"><span>Beschreibung</span><strong class="v4-preserve-lines">${escapeHtml(team.description||"Keine Beschreibung")}</strong></div><div><span>Eigene Rolle</span><strong>${escapeHtml(ownTeamRole(team)||"–")}</strong></div><div><span>Status</span><strong>${team.active?"Aktiv":"Inaktiv"}</strong></div><div><span>Mitglieder</span><strong>${activeMembers.length}</strong></div><div><span>Aufgaben</span><strong>${taskCount}</strong></div></div><section class="v4-team-detail-members"><div class="v4-dialog-section-title"><h3>Mitglieder</h3></div>${activeMembers.length?`<div class="v4-team-member-list">${activeMembers.map(member=>`<div class="v4-team-member-row"><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(roleLabel(member.role))}</small></span>${team.canManage?`<span class="v4-row-actions"><button class="button small secondary" data-edit-team-member="${escapeAttr(team.id)}:${escapeAttr(member.userId)}" type="button">Rolle</button><button class="button small ghost" data-remove-team-member="${escapeAttr(team.id)}:${escapeAttr(member.userId)}" type="button">Entfernen</button></span>`:""}</div>`).join("")}</div>`:'<p class="subtle">Noch keine aktiven Teammitglieder.</p>'}</section>${taskDependencyNotice(team)}${team.canManage?`<div class="dialog-actions v4-detail-actions"><button class="button primary" data-add-team-member="${escapeAttr(team.id)}" type="button">Mitglied hinzufügen</button>${snapshot.canCreateTeam?`<button class="button secondary" data-edit-team="${escapeAttr(team.id)}" type="button">Team bearbeiten</button><button class="button danger" data-delete-team="${escapeAttr(team.id)}" type="button" ${taskCount>0?'title="Vor der Löschung müssen alle Teamaufgaben endgültig entfernt werden."':""}>Team löschen</button>`:""}</div>`:""}`;}
function openTeamDetails(team){const dialog=openDialog({title:team.name,kicker:"Mein Team",body:teamDetailMarkup(team)});dialog.querySelector("[data-edit-team]")?.addEventListener("click",()=>openTeam(team));dialog.querySelector("[data-delete-team]")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;await deleteTeam(team);dialog.close();});dialog.querySelector("[data-open-team-archive]")?.addEventListener("click",()=>openTeamArchive(team));dialog.querySelector("[data-add-team-member]")?.addEventListener("click",()=>openMembership(team));dialog.querySelectorAll("[data-edit-team-member]").forEach(button=>button.addEventListener("click",()=>{const[,userId]=button.dataset.editTeamMember.split(":");const membership=team.members.find(item=>item.userId===userId);if(membership)openMembership(team,membership);}));dialog.querySelectorAll("[data-remove-team-member]").forEach(button=>button.addEventListener("click",async event=>{const[,userId]=button.dataset.removeTeamMember.split(":");const membership=team.members.find(item=>item.userId===userId);if(!membership)return;event.currentTarget.disabled=true;await removeMembership(team,membership);dialog.close();}));}

function render(){const panel=document.getElementById("teamsPanel");if(!panel||!snapshot)return;const teams=snapshot.teams||[];const tabs=document.getElementById("teamsTabs");if(tabs){tabs.innerHTML=`<div class="v4-tabs" role="tablist"><button class="v4-tab active" type="button" role="tab" aria-selected="true">Meine Teams</button></div>${snapshot.canCreateTeam?`<div class="v4-heading-row v4-teams-heading"><h3>Meine Teams</h3><button id="addTeamButton" class="button secondary v4-heading-action" type="button">+ Team</button></div>`:""}`;}panel.innerHTML=teams.length?`<div class="v4-team-list">${teams.map(teamListRow).join("")}</div>`:empty("Dir ist noch kein Team zugeordnet.");document.getElementById("addTeamButton")?.addEventListener("click",()=>openTeam());panel.querySelectorAll("[data-open-team]").forEach(button=>button.addEventListener("click",()=>{const team=teams.find(item=>item.id===button.dataset.openTeam);if(team)openTeamDetails(team);}));const status=document.getElementById("teamsStatus");if(status){status.textContent="Aktuell";status.className="status-pill success";}}

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
    if (status) {
      status.textContent = "Fehler";
      status.className = "status-pill error";
    }
  }
}

export function noop() {}

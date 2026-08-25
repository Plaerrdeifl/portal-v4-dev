import {
  call,
  closeAllDialogs,
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
  return `<form class="form-grid v4-smart-form">
    <input type="hidden" name="id" value="${escapeAttr(team.id || "")}">
    <label class="v4-field-full">Name<input name="name" required maxlength="160" value="${escapeAttr(team.name || "")}"></label>
    <label class="v4-field-full">Beschreibung<textarea name="description" maxlength="2000" rows="4">${escapeHtml(team.description || "")}</textarea></label>
    <label class="checkbox-row v4-field-full"><input name="active" type="checkbox" ${team.active !== false ? "checked" : ""}> Team ist aktiv</label>
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
      const payload = normalizeCheckbox(values, "active");

      if (team) {
        payload.expectedRevision = team.revision;
      }

      snapshot = await runWrite(
        () => call("save_team", payload),
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

  return `<form class="form-grid v4-smart-form">
    <input type="hidden" name="teamId" value="${escapeAttr(team.id)}">
    <label class="v4-field-full">Portalbenutzer<select name="userId" required ${membership.userId ? "disabled" : ""}>${optionList(users.map(user => ({ value: user.id, label: user.name })), membership.userId || "", "Benutzer auswählen")}</select>${membership.userId ? `<input type="hidden" name="userId" value="${escapeAttr(membership.userId)}">` : ""}</label>
    <label class="v4-field-full">Teamrolle<select name="role">${optionList(roles, membership.role || "MEMBER")}</select></label>
  </form>`;
}

function openMembership(team, membership = null) {
  openDialog({
    title: membership ? "Teamrolle bearbeiten" : "Teammitglied hinzufügen",
    kicker: team.name,
    body: membershipForm(team, membership || {}),
    onSubmit: async values => {
      const payload = { ...values };

      if (membership) {
        payload.expectedRevision = membership.revision;
      }

      snapshot = await runWrite(
        () => call("save_team_member", payload),
        "Teammitgliedschaft wurde gespeichert."
      );
      render();
    }
  });
}

function teamFunctionForm(team, membership) {
  const availableFunctions = team.availableFunctions || [];
  const assignedCodes = new Set(
    (membership.functions || []).map(item => item.code)
  );

  const functionRows = availableFunctions.map((item, index) => `
    <label class="checkbox-row v4-field-full">
      <input
        name="function_${index}"
        type="checkbox"
        ${assignedCodes.has(item.code) ? "checked" : ""}
      >
      <span>
        <strong>${escapeHtml(item.name)}</strong>
        ${item.description
          ? `<small>${escapeHtml(item.description)}</small>`
          : ""}
      </span>
    </label>
  `).join("");

  return `<form class="form-grid v4-smart-form">
    <div class="v4-field-full">
      <p class="subtle">
        Fachfunktionen vergeben konkrete Berechtigungen innerhalb dieses Teams.
        Die organisatorische Teamrolle bleibt davon unabhängig.
      </p>
    </div>

    ${functionRows || `
      <div class="notice neutral v4-field-full">
        Für dieses Team sind keine Fachfunktionen konfiguriert.
      </div>
    `}
  </form>`;
}

function openTeamFunctions(team, membership) {
  if (!team.canManageFunctions) {
    showToast(
      "Du darfst keine Fachfunktionen vergeben.",
      "error",
      5200
    );
    return;
  }

  const availableFunctions = team.availableFunctions || [];

  openDialog({
    title: `Funktionen · ${membership.name}`,
    kicker: team.name,
    body: teamFunctionForm(team, membership),
    submitLabel: "Funktionen speichern",

    onSubmit: async values => {
      const functionCodes = availableFunctions
        .filter(
          (_, index) =>
            values[`function_${index}`] === "on"
        )
        .map(item => item.code);

      snapshot = await runWrite(
        () => call("set_team_functions", {
          teamId: team.id,
          userId: membership.userId,
          expectedRevision: membership.revision,
          functionCodes
        }),
        "Fachfunktionen wurden gespeichert."
      );

      render();
    }
  });
}

async function removeMembership(team, membership) {
  if (!await confirmAction(`${membership.name} aus dem Team entfernen?`)) {
    return false;
  }

  snapshot = await runWrite(
    () => call("remove_team_member", {
      teamId: team.id,
      userId: membership.userId,
      expectedRevision: membership.revision
    }),
    "Teammitglied wurde entfernt."
  );
  render();
  return true;
}

async function deleteTeam(team) {
  const active = Number(team.activeTaskCount || 0);
  const archived = Number(team.archivedTaskCount || 0);
  if (active + archived > 0) {
    const dialog = openDialog({
      title: "Team löschen",
      kicker: team.name,
      body: `<div class="notice warning v4-team-delete-block" role="status">
        <strong>Team kann noch nicht gelöscht werden.</strong>
        <p>Es sind noch ${escapeHtml(active)} aktive und ${escapeHtml(archived)} archivierte Aufgaben zugeordnet.</p>
        ${archived ? `<button class="button small secondary" type="button" data-open-team-archive="${escapeAttr(team.id)}">Archivierte Aufgaben anzeigen</button>` : ""}
      </div>`
    });
    dialog.querySelector("[data-open-team-archive]")?.addEventListener("click", () => {
      closeAllDialogs();
      openTeamArchive(team);
    });
    return false;
  }

  if (!await confirmAction(
    `Team „${team.name}“ endgültig löschen? Mitgliedschaften und Teamfunktionen werden dabei entfernt.`
  )) {
    return false;
  }

  snapshot = await runWrite(
    () => call("delete_team", { id: team.id }),
    "Team wurde gelöscht."
  );
  render();
  return true;
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

function ownTeamRole(team) {
  const userId = currentUser().id;
  const membership = (team.members || []).find(member => member.userId === userId);
  return membership ? roleLabel(membership.role) : "";
}

function teamListRow(team) {
  const role = ownTeamRole(team);
  const memberCount = (team.members || []).filter(member => member.active).length;
  return `<button class="v4-team-list-row" type="button" data-open-team="${escapeAttr(team.id)}">
    <span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(role || `${memberCount} Mitglieder`)}</small></span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`;
}

function memberFunctionsMarkup(member) {
  const functions = member.functions || [];
  if (!functions.length) return "Keine Fachfunktionen";
  return functions.length === 1 ? "1 Fachfunktion" : `${functions.length} Fachfunktionen`;
}

function teamMemberRow(team, member) {
  const canOpen = team.canManage || team.canManageFunctions;
  const tag = canOpen ? "button" : "div";
  const attributes = canOpen
    ? `type="button" data-open-team-member="${escapeAttr(member.userId)}" aria-label="${escapeAttr(`${member.name} verwalten`)}"`
    : "";
  return `<${tag} class="v4-team-member-row${canOpen ? " is-actionable" : ""}" ${attributes}>
    <span class="v4-team-member-copy">
      <strong>${escapeHtml(member.name)}</strong>
      <small>${escapeHtml(roleLabel(member.role))} · ${escapeHtml(memberFunctionsMarkup(member))}</small>
    </span>
    ${canOpen ? '<span class="v4-row-chevron" aria-hidden="true">›</span>' : ""}
  </${tag}>`;
}

function teamDetailMarkup(team) {
  const activeMembers = (team.members || [])
    .filter(member => member.active);

  const taskCount = Number(team.taskCount || 0);

  const summary = [
    ownTeamRole(team) ? `Eigene Rolle: ${ownTeamRole(team)}` : "",
    `${activeMembers.length} ${activeMembers.length === 1 ? "Mitglied" : "Mitglieder"}`,
    `${taskCount} ${taskCount === 1 ? "Aufgabe" : "Aufgaben"}`,
    team.active ? "" : "Inaktiv"
  ].filter(Boolean).join(" · ");

  return `
    <section class="v4-team-summary">
      <p class="v4-team-summary-meta">${escapeHtml(summary)}</p>
      ${team.description ? `<p class="v4-team-description">${escapeHtml(team.description)}</p>` : ""}
    </section>

    <section class="v4-team-detail-members">
      <div class="v4-dialog-section-title">
        <h3>Mitglieder</h3>
        ${team.canManage ? `<button class="button small secondary" data-add-team-member="${escapeAttr(team.id)}" type="button">+ Mitglied</button>` : ""}
      </div>

      ${activeMembers.length
        ? `<div class="v4-team-member-list">
            ${activeMembers.map(member => teamMemberRow(team, member)).join("")}
          </div>`
        : '<p class="subtle">Noch keine aktiven Teammitglieder.</p>'
      }
    </section>

    ${team.canManage
      ? `<div class="v4-team-detail-actions">
          ${snapshot.canCreateTeam
            ? `<button
                class="button secondary"
                data-edit-team="${escapeAttr(team.id)}"
                type="button"
              >
                Team bearbeiten
              </button>
              <details class="v4-team-more-actions">
                <summary class="button ghost">Weitere Aktionen</summary>
                <div><button class="button danger" data-delete-team="${escapeAttr(team.id)}" type="button">Team löschen</button></div>
              </details>`
            : ""
          }
        </div>`
      : ""
    }
  `;
}

function openTeamMemberActions(team, membership) {
  const dialog = openDialog({
    title: membership.name,
    kicker: "Teammitglied verwalten",
    body: `<div class="v4-card-action-menu">
      ${team.canManageFunctions ? '<button class="button secondary" data-member-action-functions type="button">Fachfunktionen bearbeiten</button>' : ""}
      ${team.canManage ? '<button class="button secondary" data-member-action-role type="button">Rolle bearbeiten</button><button class="button danger" data-member-action-remove type="button">Aus Team entfernen</button>' : ""}
    </div>`
  });

  dialog.querySelector("[data-member-action-functions]")?.addEventListener("click", () => {
    dialog.close();
    openTeamFunctions(team, membership);
  });
  dialog.querySelector("[data-member-action-role]")?.addEventListener("click", () => {
    dialog.close();
    openMembership(team, membership);
  });
  dialog.querySelector("[data-member-action-remove]")?.addEventListener("click", async () => {
    if (await removeMembership(team, membership)) closeAllDialogs();
  });
}

function openTeamDetails(team) {
  const dialog = openDialog({
    title: team.name,
    kicker: "Mein Team",
    body: teamDetailMarkup(team)
  });

  dialog.querySelector("[data-edit-team]")
    ?.addEventListener(
      "click",
      () => openTeam(team)
    );

  dialog.querySelector("[data-delete-team]")
    ?.addEventListener(
      "click",
      async event => {
        if (await deleteTeam(team)) closeAllDialogs();
      }
    );

  dialog.querySelector("[data-add-team-member]")
    ?.addEventListener(
      "click",
      () => openMembership(team)
    );

  dialog.querySelectorAll("[data-open-team-member]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const membership = team.members.find(
          item => item.userId === button.dataset.openTeamMember
        );
        if (membership) openTeamMemberActions(team, membership);
      });
    });
}

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

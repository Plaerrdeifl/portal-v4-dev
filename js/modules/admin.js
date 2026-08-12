import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  fmtDateTime,
  openDialog,
  optionList,
  runWrite,
  showToast,
  statusBadge
} from "./common.js";

let snapshot = null;
let activeTab = "requests";

function activeRoles() {
  return (snapshot?.roles || []).filter(role => role.active);
}

function memberOptions() {
  return (snapshot?.members || []).filter(member => member.status === "ACTIVE").map(member => ({
    value: member.id,
    label: `${member.memberCode} · ${member.firstName} ${member.lastName}`
  }));
}

async function loadMemberMatch(email, userId = "") {
  try {
    return await call("member_match", { email, userId });
  } catch (error) {
    return {
      status: "ERROR",
      count: 0,
      member: null,
      message: error?.message || "Automatische Erkennung nicht verfügbar."
    };
  }
}

function memberMatchNotice(match) {
  if (!match || match.status === "NONE") return "";

  if (match.status === "MATCH" && match.member) {
    const label = `${match.member.memberCode} · ${match.member.firstName} ${match.member.lastName}`;
    return `<div class="v4-member-match success"><strong>Mitglied automatisch erkannt</strong><span>${escapeHtml(label)} wurde anhand der E-Mail-Adresse vorausgewählt. Bitte prüfen und bestätigen.</span></div>`;
  }

  if (match.status === "AMBIGUOUS") {
    return `<div class="v4-member-match warning"><strong>Keine automatische Zuordnung</strong><span>${escapeHtml(String(match.count))} aktive Mitglieder verwenden diese E-Mail-Adresse. Bitte manuell auswählen.</span></div>`;
  }

  return `<div class="v4-member-match warning"><strong>Automatische Erkennung nicht verfügbar</strong><span>${escapeHtml(match.message || "Bitte Mitglied manuell auswählen.")}</span></div>`;
}

function tabs() {
  return [
    ...(snapshot?.canManageUsers ? [["requests", "Freischaltungen"], ["users", "Benutzer"]] : []),
    ...(snapshot?.canReviewProfileChanges ? [["profileChanges", "Datenänderungen"]] : []),
    ...(snapshot?.canManageRoles ? [["roles", "Rollen & Rechte"]] : []),
    ...(snapshot?.canReadAudit ? [["audit", "Audit"]] : [])
  ];
}

function renderTabs(panel) {
  const counts = {
    requests: (snapshot.requests || []).filter(request => request.status === "PENDING").length,
    users: (snapshot.users || []).length,
    profileChanges: (snapshot.profileChangeRequests || []).filter(request => request.status === "PENDING").length,
    roles: (snapshot.roles || []).length,
    audit: (snapshot.audit || []).length
  };
  panel.innerHTML = `<div class="v4-tabs v4-admin-tabs">${tabs().map(([key, label]) => `<button class="v4-tab ${activeTab === key ? "active" : ""}" data-admin-tab="${key}" type="button">${escapeHtml(label)} <span>${counts[key]}</span></button>`).join("")}</div><div id="adminTabPanel"></div>`;
  panel.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => {
    activeTab = button.dataset.adminTab;
    render();
  }));
}

async function approveRequest(request) {
  const match = await loadMemberMatch(request.email);
  const suggestedMemberId = match.status === "MATCH" ? match.member?.id || "" : "";

  openDialog({
    title: "Freischaltung bestätigen",
    kicker: `${request.firstName} ${request.lastName}`,
    body: `${memberMatchNotice(match)}<form class="form-grid">
      <label class="full">Portalrolle<select name="roleId" required>${optionList(activeRoles().map(role => ({ value: role.id, label: role.name })), "", "Rolle auswählen")}</select></label>
      <label class="full">Mitglied verknüpfen<select name="memberId">${optionList(memberOptions(), suggestedMemberId, "Keine Mitgliedsverknüpfung")}</select></label>
    </form>`,
    submitLabel: "Freischalten",
    onSubmit: async values => {
      snapshot = await runWrite(() => call("approve_request", { id: request.id, ...values }), "Portalzugang wurde freigeschaltet.");
      render();
    }
  });
}

function rejectRequest(request) {
  openDialog({
    title: "Antrag ablehnen",
    kicker: `${request.firstName} ${request.lastName}`,
    body: '<form><label>Begründung<textarea name="reason" maxlength="1000" rows="5" required></textarea></label></form>',
    submitLabel: "Ablehnen",
    danger: true,
    onSubmit: async values => {
      snapshot = await runWrite(() => call("reject_request", { id: request.id, reason: values.reason || "" }), "Antrag wurde abgelehnt.");
      render();
    }
  });
}

function renderRequests(panel) {
  const pending = (snapshot.requests || []).filter(request => request.status === "PENDING");
  const completed = (snapshot.requests || []).filter(request => request.status !== "PENDING");
  panel.innerHTML = `<div class="v4-toolbar"><div><h3>Freischaltungsanträge</h3><p>${pending.length} offene Anträge</p></div></div>
    ${pending.length ? `<div class="v4-card-grid">${pending.map(request => `<article class="card"><header class="v4-card-header"><div><h3>${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</h3><p>${escapeHtml(request.email)}</p></div>${statusBadge(request.status)}</header><p>Beantragt: ${escapeHtml(fmtDateTime(request.requestedAt))}</p><footer class="v4-card-actions"><button class="button small primary" data-approve-request="${escapeAttr(request.id)}" type="button">Freischalten</button><button class="button small danger" data-reject-request="${escapeAttr(request.id)}" type="button">Ablehnen</button></footer></article>`).join("")}</div>` : empty("Keine offenen Freischaltungsanträge.")}
    ${completed.length ? `<details class="v4-history"><summary>Bearbeitete Anträge (${completed.length})</summary><div class="v4-table-wrap"><table class="v4-table"><thead><tr><th>Name</th><th>E-Mail</th><th>Status</th><th>Grund</th></tr></thead><tbody>${completed.map(request => `<tr><td>${escapeHtml(request.firstName)} ${escapeHtml(request.lastName)}</td><td>${escapeHtml(request.email)}</td><td>${statusBadge(request.status)}</td><td>${escapeHtml(request.decisionReason || "–")}</td></tr>`).join("")}</tbody></table></div></details>` : ""}`;
  panel.querySelectorAll("[data-approve-request]").forEach(button => button.addEventListener("click", async () => approveRequest(pending.find(request => request.id === button.dataset.approveRequest))));
  panel.querySelectorAll("[data-reject-request]").forEach(button => button.addEventListener("click", () => rejectRequest(pending.find(request => request.id === button.dataset.rejectRequest))));
}

function taskAccessSummary(user) {
  if (!user.taskAccess) return "Nicht verfügbar";

  const effective = user.taskAccess.effective || {};
  const labels = ["Eigene Aufgaben"];

  if (effective.canViewTeamSection) {
    labels.push("Team");
  }

  if (effective.canViewBoardSection) {
    labels.push("Vorstand");
  }

  if (effective.canViewArchiveSection) {
    labels.push("Archiv");
  }

  if (effective.canManageTasks) {
    labels.push("Verwaltung");
  }

  return labels.join(" · ");
}

function effectiveCapability(user, code) {
  return (user.effectiveCapabilities || []).find(
    capability => capability.code === code
  ) || null;
}

function capabilitySourceLabel(source) {
  const detail = source.detail || {};

  if (source.source === "ROLE") {
    return `Rolle: ${detail.roleName || detail.roleCode || "Portalrolle"}`;
  }

  if (source.source === "OFFICE") {
    return `Amt: ${detail.officeLabel || detail.officeCode || "Amt"}`;
  }

  if (source.source === "PERSONAL") return "Persönlich";
  if (source.source === "ADMIN_OVERRIDE") return "Admin-Override";
  return source.source || "Unbekannte Quelle";
}

function personalCapabilitySummary(user) {
  const personalCount = (user.personalCapabilities || []).length;
  const effectiveCount = (user.effectiveCapabilities || []).length;
  return `${personalCount} persönlich · ${effectiveCount} effektiv`;
}

function editPersonalCapabilities(user) {
  const personal = new Set(user.personalCapabilities || []);
  const grouped = new Map();

  for (const capability of snapshot.personalCapabilityCatalog || []) {
    if (!grouped.has(capability.category)) {
      grouped.set(capability.category, []);
    }
    grouped.get(capability.category).push(capability);
  }

  openDialog({
    title: "Zusatzrechte",
    kicker: `${user.userCode} · ${user.firstName} ${user.lastName}`,
    submitLabel: "Zusatzrechte speichern",
    body: `<form>
      <div class="notice">
        <strong>Additive persönliche Rechte</strong>
        <p>Nur der persönliche Anteil ist editierbar. Rechte aus Rolle, Amt oder Admin-Override bleiben beim Entfernen eines persönlichen Hakens wirksam.</p>
      </div>
      <div class="v4-capability-groups v4-personal-capability-groups">
        ${[...grouped.entries()].map(([category, capabilities]) => `
          <fieldset>
            <legend>${escapeHtml(category)}</legend>
            ${capabilities.map(capability => {
              const effective = effectiveCapability(user, capability.code);
              const sources = effective?.sources || [];
              const inheritedSources = sources.filter(
                source => source.source !== "PERSONAL"
              );

              return `<label class="v4-capability v4-personal-capability">
                <input
                  type="checkbox"
                  name="personalCapability"
                  value="${escapeAttr(capability.code)}"
                  ${personal.has(capability.code) ? "checked" : ""}
                >
                <span>
                  <strong>${escapeHtml(capability.name)}</strong>
                  <small>${escapeHtml(capability.description || "")}</small>
                  <code>${escapeHtml(capability.code)}</code>
                  <span class="v4-capability-effective ${effective ? "is-effective" : ""}">
                    ${effective ? "Effektiv vorhanden" : "Nicht effektiv vorhanden"}
                  </span>
                  <span class="v4-capability-sources">
                    ${inheritedSources.length
                      ? inheritedSources.map(source => `<span>${escapeHtml(capabilitySourceLabel(source))}</span>`).join("")
                      : "<span>Keine geerbte Quelle</span>"}
                    ${personal.has(capability.code) ? "<span>Persönlich</span>" : ""}
                  </span>
                </span>
              </label>`;
            }).join("")}
          </fieldset>
        `).join("")}
      </div>
    </form>`,
    onSubmit: async () => {
      const capabilities = [
        ...document.querySelectorAll(
          '#v4DialogBody input[name="personalCapability"]:checked'
        )
      ].map(input => input.value);

      snapshot = await runWrite(
        () => call("set_user_capabilities", {
          userId: user.id,
          capabilities,
          expectedCapabilities: user.personalCapabilities || []
        }),
        "Persönliche Zusatzrechte wurden aktualisiert."
      );

      render();
    }
  });
}

function inheritedTaskAccessMarkup(user) {
  const baseline = user.taskAccess?.baseline || {};
  const items = [
    ["Teamaufgaben", baseline.canViewTeamSection],
    ["Vorstandsaufgaben", baseline.canViewBoardSection],
    ["Archiv", baseline.canViewArchiveSection],
    ["Direkt übertragen", baseline.canDirectTransfer]
  ].filter(([, enabled]) => enabled);

  if (!items.length) {
    return `<div class="notice">
      <strong>Automatischer Rollenstandard</strong>
      <p>Nur eigene, nicht archivierte Aufgaben.</p>
    </div>`;
  }

  return `<div class="notice">
    <strong>Automatischer Rollenstandard</strong>
    <p>${items.map(([label]) => escapeHtml(label)).join(" · ")}</p>
    <small>Diese Rechte werden aus Rolle, Amt und Teamfunktion geerbt und können hier nicht entfernt werden.</small>
  </div>`;
}

function taskAccessTeamOptions(selectedIds = []) {
  const selected = new Set(
    (selectedIds || []).map(String)
  );

  return (snapshot?.taskAccessTeams || []).map(team => `
    <label class="v4-task-access-team">
      <input
        type="checkbox"
        name="taskArchiveTeam"
        value="${escapeAttr(team.id)}"
        ${selected.has(String(team.id)) ? "checked" : ""}
      >
      <span>${escapeHtml(team.name)}</span>
    </label>
  `).join("");
}

function editTaskAccess(user) {
  const profile = user.taskAccess || {};
  const baseline = profile.baseline || {};
  const override = profile.override || {};
  const archiveOptions = [
    { value: "NONE", label: "Keine zusätzliche Archivfreigabe" },
    { value: "OWN", label: "Nur eigene archivierte Aufgaben" },
    { value: "SELECTED_TEAMS", label: "Ausgewählte Teamarchive" },
    { value: "ALL_TEAMS", label: "Alle Teamarchive" },
    { value: "FULL", label: "Vollständiges Archiv" }
  ];

  const dialog = openDialog({
    title: "Aufgabenspezifische Rechte",
    kicker: `${user.userCode} · ${user.firstName} ${user.lastName}`,
    submitLabel: "Aufgabenregeln speichern",
    body: `<form class="form-grid v4-task-access-form">
      <input
        type="hidden"
        name="revision"
        value="${escapeAttr(override.revision || 0)}"
      >
      <div class="full">
        ${inheritedTaskAccessMarkup(user)}
      </div>

      <fieldset class="full v4-task-access-fieldset">
        <legend>Zusätzliche Bereiche</legend>

        <label class="v4-capability">
          <input
            type="checkbox"
            name="viewAllTeamTasks"
            ${override.viewAllTeamTasks ? "checked" : ""}
            ${baseline.canViewTeamSection ? "disabled" : ""}
          >
          <span>
            <strong>Alle Teamaufgaben anzeigen</strong>
            <small>Gibt den allgemeinen Teamaufgaben-Bereich frei, unabhängig von eigener Teammitgliedschaft.</small>
          </span>
        </label>

        <label class="v4-capability">
          <input
            type="checkbox"
            name="viewBoardTasks"
            ${override.viewBoardTasks ? "checked" : ""}
            ${baseline.canViewBoardSection ? "disabled" : ""}
          >
          <span>
            <strong>Vorstandsaufgaben anzeigen</strong>
            <small>Gibt den Vorstandsaufgaben-Bereich frei, ohne ein Amt oder andere Vorstandsrechte zu vergeben.</small>
          </span>
        </label>
      </fieldset>

      <fieldset class="full v4-task-access-fieldset">
        <legend>Zusätzliches Archiv</legend>

        <label class="full">
          Archivumfang
          <select
            name="archiveScope"
            id="taskAccessArchiveScope"
            ${baseline.archiveFull ? "disabled" : ""}
          >
            ${optionList(
              archiveOptions,
              override.archiveScope || "NONE"
            )}
          </select>
          <small>
            Bereits geerbte Teamarchive oder vollständige Vorstandsarchive bleiben immer erhalten.
          </small>
        </label>

        <div
          id="taskAccessArchiveTeams"
          class="v4-task-access-teams"
        >
          ${taskAccessTeamOptions(override.archiveTeamIds || [])}
        </div>
      </fieldset>

      <fieldset class="full v4-task-access-fieldset">
        <legend>Zusätzliche Aktionen</legend>

        <label class="v4-capability">
          <input
            type="checkbox"
            name="canDirectTransfer"
            ${override.canDirectTransfer ? "checked" : ""}
            ${baseline.canDirectTransfer ? "disabled" : ""}
          >
          <span>
            <strong>Sichtbare Aufgaben direkt übertragen</strong>
            <small>Erlaubt nur die direkte Übertragung; keine zusätzlichen Bearbeitungs- oder Archivrechte.</small>
          </span>
        </label>
      </fieldset>

      <div class="full v4-task-access-reset">
        <button
          id="resetUserTaskAccess"
          class="button small ghost"
          type="button"
          ${override.exists ? "" : "disabled"}
        >
          Auf Rollenstandard zurücksetzen
        </button>
      </div>
    </form>`,
    onSubmit: async () => {
      const form = dialog.querySelector(
        ".v4-task-access-form"
      );

      if (!(form instanceof HTMLFormElement)) {
        throw new Error(
          "Das Aufgabenrechte-Formular konnte nicht gelesen werden."
        );
      }

      const archiveScope = form.elements
        .namedItem("archiveScope")?.value || "NONE";

      const archiveTeamIds = [
        ...form.querySelectorAll(
          'input[name="taskArchiveTeam"]:checked'
        )
      ].map(input => input.value);

      snapshot = await runWrite(
        () => call("save_user_task_access", {
          userId: user.id,
          revision: Number(
            form.elements.namedItem("revision")?.value || 0
          ),
          viewAllTeamTasks: Boolean(
            form.elements.namedItem("viewAllTeamTasks")?.checked
          ),
          viewBoardTasks: Boolean(
            form.elements.namedItem("viewBoardTasks")?.checked
          ),
          archiveScope,
          archiveTeamIds,
          canDirectTransfer: Boolean(
            form.elements.namedItem("canDirectTransfer")?.checked
          ),
          reset: false
        }),
        "Aufgabenspezifische Zusatzregeln wurden gespeichert."
      );

      render();
    }
  });

  const scope = dialog.querySelector(
    "#taskAccessArchiveScope"
  );
  const teams = dialog.querySelector(
    "#taskAccessArchiveTeams"
  );

  const syncArchiveTeams = () => {
    if (!teams) return;
    teams.hidden = scope?.value !== "SELECTED_TEAMS";
  };

  scope?.addEventListener("change", syncArchiveTeams);
  syncArchiveTeams();

  dialog.querySelector("#resetUserTaskAccess")
    ?.addEventListener("click", async event => {
      const resetButton = event.currentTarget;

      const confirmed = await confirmAction(
        "Individuelle aufgabenspezifische Regeln entfernen? Globale persönliche Capabilities bleiben erhalten."
      );

      if (!confirmed) return;
      if (resetButton) resetButton.disabled = true;

      try {
        snapshot = await runWrite(
          () => call("save_user_task_access", {
            userId: user.id,
            revision: Number(override.revision || 0),
            reset: true
          }),
          "Aufgabenspezifische Regeln wurden zurückgesetzt."
        );

        if (dialog.open) dialog.close();
        render();
      } catch (error) {
        if (resetButton) resetButton.disabled = false;
        showToast(
          error?.message
            || "Aufgabenrechte konnten nicht zurückgesetzt werden.",
          "error",
          6500
        );
      }
    });
}

async function editUser(user) {
  const match = user.memberId ? null : await loadMemberMatch(user.email, user.id);
  const selectedMemberId = user.memberId || (match?.status === "MATCH" ? match.member?.id || "" : "");

  openDialog({
    title: "Portalbenutzer bearbeiten",
    kicker: `${user.userCode} · ${user.firstName} ${user.lastName}`,
    body: `${memberMatchNotice(match)}<form class="form-grid">
      <input type="hidden" name="id" value="${escapeAttr(user.id)}">
      <label class="full">Portalrolle<select name="roleId" required>${optionList(activeRoles().map(role => ({ value: role.id, label: role.name })), user.roleId)}</select></label>
      <label>Status<select name="status">${optionList([
        { value: "ACTIVE", label: "Aktiv" },
        { value: "INACTIVE", label: "Inaktiv" },
        { value: "BLOCKED", label: "Gesperrt" }
      ], user.status)}</select></label>
      <label>Mitgliedsverknüpfung<select name="memberId">${optionList(memberOptions(), selectedMemberId, "Keine Verknüpfung")}</select></label>
    </form>`,
    onSubmit: async values => {
      snapshot = await runWrite(() => call("save_user", values), "Benutzer wurde aktualisiert.");
      render();
    }
  });
}

function renderUsers(panel) {
  const users = snapshot.users || [];

  panel.innerHTML = `<div class="v4-toolbar">
    <div>
      <h3>Portalbenutzer</h3>
      <p>${users.length} Benutzer · ${snapshot.activeAdminCount} aktive Administratoren</p>
    </div>
  </div>
  ${users.length ? `<div class="v4-table-wrap">
    <table class="v4-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Rolle</th>
          <th>Mitglied</th>
          ${snapshot.canManagePersonalCapabilities ? "<th>Zusatzrechte</th>" : ""}
          <th>Aufgaben</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `<tr>
          <td><strong>${escapeHtml(user.userCode)}</strong></td>
          <td>
            ${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}
            <small>${escapeHtml(user.email)}</small>
          </td>
          <td>${escapeHtml(user.roleName)}</td>
          <td>${escapeHtml(user.memberCode || "–")}</td>
          ${snapshot.canManagePersonalCapabilities ? `<td>
            <small>${escapeHtml(personalCapabilitySummary(user))}</small>
          </td>` : ""}
          <td>
            <small>${escapeHtml(taskAccessSummary(user))}</small>
          </td>
          <td>${statusBadge(user.status)}</td>
          <td>
            <div class="v4-row-actions">
              ${snapshot.canManagePersonalCapabilities ? `<button
                class="button small primary"
                data-edit-user-capabilities="${escapeAttr(user.id)}"
                type="button"
              >Zusatzrechte</button>` : ""}
              ${snapshot.canManageTaskAccess ? `<button
                class="button small secondary"
                data-edit-user-task-access="${escapeAttr(user.id)}"
                type="button"
              >Aufgabenregeln</button>` : ""}
              <button
                class="button small secondary"
                data-edit-user="${escapeAttr(user.id)}"
                type="button"
              >Bearbeiten</button>
            </div>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : empty("Noch keine Portalbenutzer.")}`;

  panel.querySelectorAll("[data-edit-user]").forEach(button => {
    button.addEventListener("click", async () => {
      const user = users.find(
        item => item.id === button.dataset.editUser
      );

      if (user) await editUser(user);
    });
  });

  panel.querySelectorAll("[data-edit-user-task-access]").forEach(button => {
    button.addEventListener("click", () => {
      const user = users.find(
        item => item.id === button.dataset.editUserTaskAccess
      );

      if (user) editTaskAccess(user);
    });
  });

  panel.querySelectorAll("[data-edit-user-capabilities]").forEach(button => {
    button.addEventListener("click", () => {
      const user = users.find(
        item => item.id === button.dataset.editUserCapabilities
      );

      if (user) editPersonalCapabilities(user);
    });
  });
}

function roleForm(role = {}) {
  return `<form class="form-grid">
    <input type="hidden" name="id" value="${escapeAttr(role.id || "")}">
    <label>Technischer Code<input name="code" required pattern="[A-Z][A-Z0-9_]{1,63}" maxlength="64" value="${escapeAttr(role.code || "")}"></label>
    <label>Anzeigename<input name="name" required maxlength="120" value="${escapeAttr(role.name || "")}"></label>
    <label>Sortierung<input name="sortOrder" type="number" min="0" max="100000" value="${escapeAttr(role.sortOrder ?? 100)}"></label>
    <label class="checkbox-row"><input name="active" type="checkbox" ${role.active !== false ? "checked" : ""}> Rolle aktiv</label>
    <label class="full">Beschreibung<textarea name="description" maxlength="2000" rows="4">${escapeHtml(role.description || "")}</textarea></label>
  </form>`;
}

function editRole(role = null) {
  openDialog({
    title: role ? "Rolle bearbeiten" : "Rolle anlegen",
    kicker: "Dynamische Portalrollen",
    body: roleForm(role || {}),
    onSubmit: async values => {
      snapshot = await runWrite(() => call("save_role", { ...values, active: values.active === "on", sortOrder: Number(values.sortOrder || 100) }), role ? "Rolle wurde aktualisiert." : "Rolle wurde angelegt.");
      render();
    }
  });
}

function editPermissions(role) {
  const grouped = new Map();
  for (const capability of snapshot.capabilities || []) {
    if (!grouped.has(capability.category)) grouped.set(capability.category, []);
    grouped.get(capability.category).push(capability);
  }
  openDialog({
    title: "Berechtigungen zuweisen",
    kicker: role.name,
    body: `<form><div class="v4-capability-groups">${[...grouped.entries()].map(([category, capabilities]) => `<fieldset><legend>${escapeHtml(category)}</legend>${capabilities.map(capability => `<label class="v4-capability"><input type="checkbox" name="capability" value="${escapeAttr(capability.code)}" ${(role.capabilities || []).includes(capability.code) ? "checked" : ""}><span><strong>${escapeHtml(capability.name)}</strong><small>${escapeHtml(capability.description)}</small><code>${escapeHtml(capability.code)}</code></span></label>`).join("")}</fieldset>`).join("")}</div></form>`,
    onSubmit: async () => {
      const checked = [...document.querySelectorAll('#v4DialogBody input[name="capability"]:checked')].map(input => input.value);
      snapshot = await runWrite(() => call("set_role_capabilities", { roleId: role.id, capabilities: checked }), "Rollenrechte wurden aktualisiert.");
      render();
    }
  });
}

async function deleteRole(role) {
  if (!await confirmAction(`Rolle „${role.name}“ endgültig löschen?`)) return;
  snapshot = await runWrite(() => call("delete_role", { id: role.id }), "Rolle wurde gelöscht.");
  render();
}

function renderRoles(panel) {
  const roles = snapshot.roles || [];
  panel.innerHTML = `<div class="v4-toolbar"><div><h3>Portalrollen und Berechtigungen</h3><p>Rollen sind frei verwaltbar. Der letzte vollständige administrative Zugriff bleibt geschützt.</p></div><button id="addRoleButton" class="button primary" type="button">Rolle anlegen</button></div>
    <div class="v4-card-grid">${roles.map(role => `<article class="card"><header class="v4-card-header"><div><span class="subtle">${escapeHtml(role.code)}</span><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.description || "Keine Beschreibung")}</p></div>${statusBadge(role.active ? "ACTIVE" : "INACTIVE")}</header><p><strong>${role.capabilities?.length || 0}</strong> Berechtigungen · <strong>${role.assignedUsers}</strong> Benutzer</p><footer class="v4-card-actions"><button class="button small secondary" data-role-permissions="${escapeAttr(role.id)}" type="button">Rechte</button><button class="button small primary" data-edit-role="${escapeAttr(role.id)}" type="button">Bearbeiten</button><button class="button small danger" data-delete-role="${escapeAttr(role.id)}" type="button" ${role.assignedUsers ? "disabled" : ""}>Löschen</button></footer></article>`).join("")}</div>`;
  document.getElementById("addRoleButton")?.addEventListener("click", () => editRole());
  panel.querySelectorAll("[data-edit-role]").forEach(button => button.addEventListener("click", () => editRole(roles.find(role => role.id === button.dataset.editRole))));
  panel.querySelectorAll("[data-role-permissions]").forEach(button => button.addEventListener("click", () => editPermissions(roles.find(role => role.id === button.dataset.rolePermissions))));
  panel.querySelectorAll("[data-delete-role]").forEach(button => button.addEventListener("click", async () => {
    try { await deleteRole(roles.find(role => role.id === button.dataset.deleteRole)); }
    catch (error) { panel.insertAdjacentHTML("afterbegin", errorPanel(error, "Rolle konnte nicht gelöscht werden")); }
  }));
}

function profileDataRows(request) {
  const labels = {
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    phone: "Telefon",
    street: "Straße",
    houseNumber: "Hausnummer",
    postalCode: "PLZ",
    city: "Ort"
  };
  const current = request.currentData || {};
  const requested = request.requestedData || {};

  return Object.entries(labels).map(([key, label]) => `<tr>
    <th>${escapeHtml(label)}</th>
    <td>${escapeHtml(current[key] || "–")}</td>
    <td>${escapeHtml(requested[key] || "–")}</td>
  </tr>`).join("");
}

function reviewProfileChange(request, decision) {
  const approve = decision === "APPROVED";

  openDialog({
    title: approve
      ? "Datenänderung freigeben"
      : "Datenänderung ablehnen",
    kicker: `${request.memberCode} · ${request.userName}`,
    danger: !approve,
    submitLabel: approve ? "Freigeben" : "Ablehnen",
    body: `<form>
      <div class="v4-table-wrap">
        <table class="v4-table v4-profile-change-table">
          <thead><tr><th>Feld</th><th>Aktuell</th><th>Beantragt</th></tr></thead>
          <tbody>${profileDataRows(request)}</tbody>
        </table>
      </div>
      <div class="notice">
        <strong>Begründung des Nutzers</strong>
        <p>${escapeHtml(request.reason || "–")}</p>
      </div>
      <label>${approve ? "Interne Notiz (optional)" : "Ablehnungsgrund"}
        <textarea
          name="reason"
          maxlength="1000"
          rows="4"
          ${approve ? "" : "required minlength=\"3\""}
        ></textarea>
      </label>
    </form>`,
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("review_profile_change_request", {
          id: request.id,
          revision: request.revision,
          decision,
          reason: values.reason || ""
        }),
        approve
          ? "Mitgliedsdaten wurden aktualisiert."
          : "Änderungsanfrage wurde abgelehnt."
      );
      render();
    }
  });
}

function renderProfileChanges(panel) {
  const requests = snapshot.profileChangeRequests || [];
  const pending = requests.filter(request => request.status === "PENDING");
  const completed = requests.filter(request => request.status !== "PENDING");

  panel.innerHTML = `<div class="v4-toolbar">
    <div>
      <h3>Änderungsanfragen zu Mitgliedsdaten</h3>
      <p>${pending.length} offene Anfrage(n)</p>
    </div>
  </div>
  ${pending.length ? `<div class="v4-card-grid">
    ${pending.map(request => `<article class="card">
      <header class="v4-card-header">
        <div>
          <span class="subtle">${escapeHtml(request.memberCode)}</span>
          <h3>${escapeHtml(request.userName)}</h3>
          <p>${escapeHtml(request.reason)}</p>
        </div>
        ${statusBadge(request.status)}
      </header>
      <p>Beantragt: ${escapeHtml(fmtDateTime(request.requestedAt))}</p>
      <footer class="v4-card-actions">
        <button class="button small primary" type="button" data-approve-profile-change="${escapeAttr(request.id)}">Freigeben</button>
        <button class="button small danger" type="button" data-reject-profile-change="${escapeAttr(request.id)}">Ablehnen</button>
      </footer>
    </article>`).join("")}
  </div>` : empty("Keine offenen Datenänderungsanfragen.")}
  ${completed.length ? `<details class="v4-history">
    <summary>Bearbeitete Anfragen (${completed.length})</summary>
    <div class="v4-table-wrap">
      <table class="v4-table">
        <thead><tr><th>Mitglied</th><th>Nutzer</th><th>Status</th><th>Bearbeitet</th><th>Grund</th></tr></thead>
        <tbody>${completed.map(request => `<tr>
          <td>${escapeHtml(request.memberCode)}</td>
          <td>${escapeHtml(request.userName)}</td>
          <td>${statusBadge(request.status)}</td>
          <td>${escapeHtml(fmtDateTime(request.reviewedAt))}<small>${escapeHtml(request.reviewedByName || "")}</small></td>
          <td>${escapeHtml(request.decisionReason || "–")}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </details>` : ""}`;

  panel.querySelectorAll("[data-approve-profile-change]").forEach(button => {
    button.addEventListener("click", () => {
      const request = pending.find(
        item => item.id === button.dataset.approveProfileChange
      );
      if (request) reviewProfileChange(request, "APPROVED");
    });
  });

  panel.querySelectorAll("[data-reject-profile-change]").forEach(button => {
    button.addEventListener("click", () => {
      const request = pending.find(
        item => item.id === button.dataset.rejectProfileChange
      );
      if (request) reviewProfileChange(request, "REJECTED");
    });
  });
}

function renderAudit(panel) {
  const events = snapshot.audit || [];
  panel.innerHTML = `<div class="v4-toolbar"><div><h3>Audit-Protokoll</h3><p>Die letzten ${events.length} sicherheits- und fachrelevanten Ereignisse.</p></div></div>
    ${events.length ? `<div class="v4-table-wrap"><table class="v4-table"><thead><tr><th>Zeit</th><th>Aktion</th><th>Objekt</th><th>Akteur</th></tr></thead><tbody>${events.map(event => `<tr><td>${escapeHtml(fmtDateTime(event.occurredAt))}</td><td><code>${escapeHtml(event.action)}</code></td><td>${escapeHtml(event.entityType)}<small>${escapeHtml(event.entityId || "")}</small></td><td>${escapeHtml(event.actorUserId || "System")}</td></tr>`).join("")}</tbody></table></div>` : empty("Noch keine Audit-Ereignisse.")}`;
}

function render() {
  const root = document.getElementById("adminPanel");
  if (!root || !snapshot) return;
  const availableTabs = tabs();
  if (!availableTabs.some(([key]) => key === activeTab)) activeTab = availableTabs[0]?.[0] || "audit";
  renderTabs(root);
  const panel = document.getElementById("adminTabPanel");
  if (activeTab === "users") renderUsers(panel);
  else if (activeTab === "profileChanges") renderProfileChanges(panel);
  else if (activeTab === "roles") renderRoles(panel);
  else if (activeTab === "audit") renderAudit(panel);
  else renderRequests(panel);
  const status = document.getElementById("adminStatus");
  if (status) { status.textContent = "Administrationszugriff aktiv"; status.className = "status-pill success"; }
}

export async function hydrateAdmin(context = {}) {
  const panel = document.getElementById("adminPanel");
  if (!panel) return;
  panel.innerHTML = '<article class="card loading-card"><h3>Administration wird geladen …</h3></article>';
  try {
    snapshot = await call("admin_snapshot");
    if (context.isCurrent && !context.isCurrent()) return;
    render();
  } catch (error) {
    panel.innerHTML = errorPanel(error, "Administration konnte nicht geladen werden");
    const status = document.getElementById("adminStatus");
    if (status) { status.textContent = "Kein Zugriff"; status.className = "status-pill error"; }
  }
}

const __V4_ADMIN_TASK_ACCESS_R1__ = true;

export function noop() {}

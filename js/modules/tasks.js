import {
  call,
  confirmAction,
  currentUser,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  fmtDateTime,
  openDialog,
  optionList,
  runWrite,
  statusBadge
} from "./common.js";
import { navigate, routeParams } from "../router.js";

let snapshot = null;
let activeFilter = "mine";
let activeArchiveTeamId = "";

const PRIORITIES = [
  { value: "URGENT", label: "Eilt" },
  { value: "HIGH", label: "Hoch" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Niedrig" }
];

const STATUSES = [
  { value: "OPEN", label: "Offen" },
  { value: "IN_PROGRESS", label: "In Bearbeitung" },
  { value: "DONE", label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" }
];

function label(items, value) {
  return items.find(item => item.value === value)?.label || value;
}

function canCreateTask() {
  return Boolean(
    snapshot?.canCreateBoard
    || (snapshot?.teams || []).some(team => team.canManage)
  );
}

function teamById(teamId) {
  return (snapshot?.teams || []).find(team => team.id === teamId) || null;
}

function userById(userId) {
  return (snapshot?.users || []).find(user => user.id === userId) || null;
}

function userLabel(user) {
  const office = user.isOfficeHolder
    ? ` · ${user.officeLabel || "Amtsinhaber"}`
    : "";
  return `${user.name}${office}`;
}

function assignmentCandidates(context, teamId) {
  const users = snapshot?.users || [];

  if (context === "TEAM") {
    const memberIds = new Set(teamById(teamId)?.memberIds || []);
    return users.filter(user => memberIds.has(user.id));
  }

  return users;
}

function taskForm(task = {}) {
  const teams = (snapshot?.teams || []).filter(
    team => team.canManage || task.teamId === team.id
  );
  const defaultContext = task.context
    || (
      snapshot?.canCreateBoard && !teams.some(team => team.canManage)
        ? "BOARD"
        : "TEAM"
    );
  const defaultTeamId = task.teamId || "";
  const candidates = assignmentCandidates(defaultContext, defaultTeamId);

  return `<form class="form-grid" id="taskEditForm">
    <input type="hidden" name="id" value="${escapeAttr(task.id || "")}">
    <input type="hidden" name="revision" value="${escapeAttr(task.revision || "")}">
    <label>Aufgabenart
      <select name="context" id="taskContextSelect">
        <option value="TEAM" ${defaultContext === "TEAM" ? "selected" : ""}>Teamaufgabe</option>
        ${snapshot?.canCreateBoard ? `<option value="BOARD" ${defaultContext === "BOARD" ? "selected" : ""}>Vorstandsaufgabe</option>` : ""}
      </select>
    </label>
    <label id="taskTeamLabel">Team
      <select name="teamId" id="taskTeamSelect">
        ${optionList(
          teams.map(team => ({ value: team.id, label: team.name })),
          defaultTeamId,
          "Team auswählen"
        )}
      </select>
    </label>
    <label class="full">Titel
      <input name="title" required maxlength="300" value="${escapeAttr(task.title || "")}">
    </label>
    <label>Priorität
      <select name="priority">
        ${optionList(PRIORITIES, task.priority || "NORMAL")}
      </select>
    </label>
    <label>Zuweisung
      <select name="assignedUserId" id="taskAssignedUserSelect">
        ${optionList(
          candidates.map(user => ({ value: user.id, label: userLabel(user) })),
          task.assignedUserId || "",
          "Noch nicht zugewiesen"
        )}
      </select>
    </label>
    <label class="full">Beschreibung
      <textarea name="description" rows="5" maxlength="4000">${escapeHtml(task.description || "")}</textarea>
    </label>
    <label class="full v4-assignment-reason" id="taskAssignmentReasonLabel" hidden>
      Begründung der externen Zuweisung
      <textarea
        name="assignmentReason"
        id="taskAssignmentReason"
        rows="2"
        maxlength="1000"
      >${escapeHtml(task.assignmentReason || "")}</textarea>
      <small>Erforderlich, wenn eine Vorstandsaufgabe an einen Nicht-Amtsinhaber vergeben wird.</small>
    </label>
  </form>`;
}

function syncTaskForm(task = {}) {
  const context = document.getElementById("taskContextSelect");
  const team = document.getElementById("taskTeamSelect");
  const teamLabel = document.getElementById("taskTeamLabel");
  const assigned = document.getElementById("taskAssignedUserSelect");
  const reasonLabel = document.getElementById("taskAssignmentReasonLabel");
  const reason = document.getElementById("taskAssignmentReason");

  const syncAssignment = () => {
    if (!context || !assigned) return;

    const isTeam = context.value === "TEAM";
    if (teamLabel) teamLabel.hidden = !isTeam;
    if (team) team.required = isTeam;

    const currentAssigned = assigned.value || task.assignedUserId || "";
    const candidates = assignmentCandidates(context.value, team?.value || "");
    const selected = candidates.some(user => user.id === currentAssigned)
      ? currentAssigned
      : "";

    assigned.innerHTML = optionList(
      candidates.map(user => ({ value: user.id, label: userLabel(user) })),
      selected,
      "Noch nicht zugewiesen"
    );

    const selectedUser = userById(assigned.value);
    const externalBoardAssignment = Boolean(
      context.value === "BOARD"
      && assigned.value
      && selectedUser
      && !selectedUser.isOfficeHolder
    );

    if (reasonLabel) reasonLabel.hidden = !externalBoardAssignment;
    if (reason) {
      reason.required = externalBoardAssignment;
      if (!externalBoardAssignment) reason.value = "";
    }
  };

  context?.addEventListener("change", syncAssignment);
  team?.addEventListener("change", syncAssignment);
  assigned?.addEventListener("change", syncAssignment);
  syncAssignment();
}

function openTask(task = null) {
  openDialog({
    title: task ? "Aufgabe bearbeiten" : "Aufgabe erstellen",
    kicker: "Aufgaben",
    body: taskForm(task || {}),
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_task", values),
        task ? "Aufgabe wurde aktualisiert." : "Aufgabe wurde erstellt."
      );
      renderAll();
    }
  });

  syncTaskForm(task || {});
}

function openNote(task) {
  if (task.status === "ARCHIVED") return;

  openDialog({
    title: "Meine Aufgabennotiz",
    kicker: task.title,
    body: `<form>
      <input type="hidden" name="revision" value="${escapeAttr(task.ownNoteRevision || 0)}">
      <label>Persönliche Notiz
        <textarea name="content" maxlength="4000" rows="8">${escapeHtml(task.ownNote || "")}</textarea>
      </label>
    </form>`,
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_task_note", {
          taskId: task.id,
          revision: values.revision,
          content: values.content || ""
        }),
        "Notiz wurde gespeichert."
      );
      renderAll();
    }
  });
}

async function setStatus(task, status) {
  snapshot = await runWrite(
    () => call("set_task_status", {
      id: task.id,
      revision: task.revision,
      status
    }),
    status === "OPEN"
      ? "Aufgabe wurde wieder geöffnet."
      : status === "IN_PROGRESS"
        ? "Aufgabe ist jetzt in Bearbeitung."
        : "Aufgabe wurde erledigt."
  );
  renderAll();
}

async function archiveTask(task) {
  const confirmed = await confirmAction(
    `Aufgabe „${task.title}“ archivieren? Archivierte Aufgaben bleiben erhalten und können nicht mehr verändert werden.`
  );
  if (!confirmed) return;

  snapshot = await runWrite(
    () => call("archive_task", {
      id: task.id,
      revision: task.revision
    }),
    "Aufgabe wurde archiviert."
  );
  activeFilter = "archive";
  renderAll();
}

async function restoreTask(task) {
  const confirmed = await confirmAction(
    `Aufgabe „${task.title}“ wiederherstellen? Sie wird wieder als offene Aufgabe geführt.`
  );
  if (!confirmed) return;

  snapshot = await runWrite(
    () => call("restore_task", {
      id: task.id,
      revision: task.revision
    }),
    "Aufgabe wurde wiederhergestellt."
  );
  activeFilter = task.context === "BOARD" ? "board" : "team";
  renderAll();
}

function openPermanentDelete(task) {
  openDialog({
    title: "Archivierte Aufgabe endgültig löschen",
    kicker: task.title,
    danger: true,
    submitLabel: "Endgültig löschen",
    body: `<form>
      <div class="notice error">
        <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
        <p>Die Aufgabe und alle persönlichen Notizen werden endgültig entfernt. Im Audit bleibt ein Aufgabenschnappschuss ohne Notizinhalte erhalten.</p>
      </div>
      <label>Zur Bestätigung exakt <strong>LÖSCHEN</strong> eingeben
        <input
          name="confirmation"
          required
          autocomplete="off"
          pattern="LÖSCHEN"
        >
      </label>
    </form>`,
    onSubmit: async values => {
      if (values.confirmation !== "LÖSCHEN") {
        throw new Error("Bitte LÖSCHEN exakt eingeben.");
      }

      snapshot = await runWrite(
        () => call("delete_archived_task", {
          id: task.id,
          revision: task.revision,
          confirmation: values.confirmation
        }),
        "Archivierte Aufgabe wurde endgültig gelöscht."
      );
      activeFilter = "archive";
      renderAll();
    }
  });
}

function visibleTasks() {
  const tasks = snapshot?.tasks || [];
  const userId = currentUser().id;

  if (activeFilter === "team") {
    return tasks.filter(
      task => task.context === "TEAM" && task.status !== "ARCHIVED"
    );
  }

  if (activeFilter === "board") {
    if (!snapshot?.canCreateBoard) return [];
    return tasks.filter(
      task => task.context === "BOARD" && task.status !== "ARCHIVED"
    );
  }

  if (activeFilter === "archive") {
    return tasks.filter(task => (
      task.status === "ARCHIVED"
      && (!activeArchiveTeamId || task.teamId === activeArchiveTeamId)
    ));
  }

  return tasks.filter(
    task => task.assignedUserId === userId && task.status !== "ARCHIVED"
  );
}

function statusOptions(task) {
  if (task.status === "OPEN") {
    return task.canChangeStatus
      ? [
          { value: "OPEN", label: "Offen" },
          { value: "IN_PROGRESS", label: "In Bearbeitung" }
        ]
      : [{ value: "OPEN", label: "Offen" }];
  }

  if (task.status === "IN_PROGRESS") {
    return task.canChangeStatus
      ? [
          { value: "IN_PROGRESS", label: "In Bearbeitung" },
          { value: "DONE", label: "Erledigt" }
        ]
      : [{ value: "IN_PROGRESS", label: "In Bearbeitung" }];
  }

  if (task.status === "DONE") {
    return task.canReopen
      ? [
          { value: "DONE", label: "Erledigt" },
          { value: "OPEN", label: "Offen (wieder öffnen)" }
        ]
      : [{ value: "DONE", label: "Erledigt" }];
  }

  return [{ value: task.status, label: label(STATUSES, task.status) }];
}

function statusSelect(task) {
  if (task.status === "ARCHIVED") return "";

  const options = statusOptions(task);
  const disabled = options.length < 2 ? "disabled" : "";

  return `<label class="v4-task-status-control">
    <span class="sr-only">Status für ${escapeHtml(task.title)}</span>
    <select
      class="v4-status-select"
      data-task-status="${escapeAttr(task.id)}"
      aria-label="Aufgabenstatus"
      ${disabled}
    >
      ${optionList(options, task.status)}
    </select>
  </label>`;
}

function taskCard(task) {
  const archivedInfo = task.status === "ARCHIVED"
    ? `<div class="notice">
        <strong>Archiviert</strong><br>
        ${escapeHtml(fmtDateTime(task.archivedAt))}
        ${task.archivedByName ? ` · ${escapeHtml(task.archivedByName)}` : ""}
      </div>`
    : "";

  return `<article
    class="card v4-task-card"
    data-priority="${escapeAttr(task.priority)}"
    data-status="${escapeAttr(task.status)}"
  >
    <header class="v4-card-header">
      <div>
        <span class="subtle">${escapeHtml(task.context === "BOARD" ? "Vorstand" : task.teamName || "Team")}</span>
        <h3>${escapeHtml(task.title)}</h3>
      </div>
      <div class="badge-stack">
        ${statusBadge(label(PRIORITIES, task.priority))}
        ${statusBadge(label(STATUSES, task.status))}
      </div>
    </header>
    ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
    <dl class="v4-meta-grid">
      <div><dt>Zugewiesen</dt><dd>${escapeHtml(task.assignedName || "Noch offen")}</dd></div>
      <div><dt>Erstellt von</dt><dd>${escapeHtml(task.createdByName || "–")}</dd></div>
      <div><dt>Aktualisiert</dt><dd>${escapeHtml(fmtDateTime(task.updatedAt))}</dd></div>
    </dl>
    ${task.assignmentReason ? `<div class="notice"><strong>Zuweisungsbegründung</strong><br>${escapeHtml(task.assignmentReason)}</div>` : ""}
    ${task.ownNote ? `<div class="v4-note-preview"><strong>Meine Notiz</strong><p>${escapeHtml(task.ownNote)}</p></div>` : ""}
    ${archivedInfo}
    <footer class="v4-card-actions">
      ${statusSelect(task)}
      ${task.canRestore ? `<button class="button small primary" type="button" data-restore-task="${escapeAttr(task.id)}">Wiederherstellen</button>` : ""}
      ${task.canDeletePermanently ? `<button class="button small danger" type="button" data-delete-archived-task="${escapeAttr(task.id)}">Endgültig löschen</button>` : ""}
      ${task.status !== "ARCHIVED" ? `<button class="button small secondary" type="button" data-task-note="${escapeAttr(task.id)}">Notiz</button>` : ""}
      ${task.canManage ? `<button class="button small secondary" type="button" data-edit-task="${escapeAttr(task.id)}">Bearbeiten</button>` : ""}
      ${task.canArchive ? `<button class="button small danger" type="button" data-archive-task="${escapeAttr(task.id)}">Archivieren</button>` : ""}
    </footer>
  </article>`;
}

function filterCount(key) {
  const previous = activeFilter;
  activeFilter = key;
  const count = visibleTasks().length;
  activeFilter = previous;
  return count;
}

function renderTabs() {
  const slot = document.getElementById("tasksTabs");
  if (!slot) return;

  const filters = [
    ["mine", "Meine Aufgaben"],
    ["team", "Teamaufgaben"],
    ["board", "Vorstandsaufgaben"],
    ["archive", "Archiv"]
  ];

  const archiveTeamName = activeArchiveTeamId
    ? (snapshot?.tasks || []).find(
        task => task.teamId === activeArchiveTeamId
      )?.teamName || "gewähltes Team"
    : "";

  slot.innerHTML = `<div class="v4-toolbar">
    <div class="v4-tabs">
      ${filters.map(([key, text]) => `<button
        class="v4-tab ${activeFilter === key ? "active" : ""}"
        type="button"
        data-task-filter="${key}"
      >${text}<span>${filterCount(key)}</span></button>`).join("")}
    </div>
    ${canCreateTask() ? '<button id="addTaskButton" class="button primary" type="button">Aufgabe erstellen</button>' : ""}
  </div>
  ${activeFilter === "archive" && activeArchiveTeamId ? `<div class="notice v4-task-archive-filter">
    <strong>Archiv gefiltert: ${escapeHtml(archiveTeamName)}</strong>
    <button id="clearTaskArchiveFilter" class="button small secondary" type="button">Filter aufheben</button>
  </div>` : ""}`;

  slot.querySelectorAll("[data-task-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.taskFilter;
      if (activeFilter !== "archive") activeArchiveTeamId = "";
      renderAll();
    });
  });

  document.getElementById("addTaskButton")
    ?.addEventListener("click", () => openTask());

  document.getElementById("clearTaskArchiveFilter")
    ?.addEventListener("click", () => {
      activeArchiveTeamId = "";
      navigate(
        "tasks",
        new URLSearchParams({ tab: "archive" }),
        true
      );
    });
}

function taskFromButton(button, datasetKey) {
  const id = button.dataset[datasetKey];
  return (snapshot?.tasks || []).find(task => task.id === id) || null;
}

function render() {
  const panel = document.getElementById("tasksPanel");
  if (!panel) return;

  const tasks = visibleTasks();
  panel.innerHTML = tasks.length
    ? `<div class="v4-card-grid">${tasks.map(taskCard).join("")}</div>`
    : empty("In dieser Ansicht sind keine Aufgaben vorhanden.");

  panel.querySelectorAll("[data-edit-task]").forEach(button => {
    button.addEventListener("click", () => {
      const task = taskFromButton(button, "editTask");
      if (task) openTask(task);
    });
  });

  panel.querySelectorAll("[data-task-note]").forEach(button => {
    button.addEventListener("click", () => {
      const task = taskFromButton(button, "taskNote");
      if (task) openNote(task);
    });
  });

  panel.querySelectorAll("[data-task-status]").forEach(select => {
    select.addEventListener("change", async () => {
      const task = taskFromButton(select, "taskStatus");
      if (!task) return;

      const previousStatus = task.status;
      const nextStatus = select.value;

      if (nextStatus === previousStatus) return;

      select.disabled = true;
      try {
        await setStatus(task, nextStatus);
      } catch (error) {
        select.value = previousStatus;
        select.disabled = false;
        panel.insertAdjacentHTML(
          "afterbegin",
          errorPanel(error, "Status konnte nicht geändert werden")
        );
      }
    });
  });

  panel.querySelectorAll("[data-archive-task]").forEach(button => {
    button.addEventListener("click", async () => {
      const task = taskFromButton(button, "archiveTask");
      if (!task) return;

      button.disabled = true;
      try {
        await archiveTask(task);
      } catch (error) {
        button.disabled = false;
        panel.insertAdjacentHTML(
          "afterbegin",
          errorPanel(error, "Aufgabe konnte nicht archiviert werden")
        );
      }
    });
  });

  panel.querySelectorAll("[data-restore-task]").forEach(button => {
    button.addEventListener("click", async () => {
      const task = taskFromButton(button, "restoreTask");
      if (!task) return;

      button.disabled = true;
      try {
        await restoreTask(task);
      } catch (error) {
        button.disabled = false;
        panel.insertAdjacentHTML(
          "afterbegin",
          errorPanel(error, "Aufgabe konnte nicht wiederhergestellt werden")
        );
      }
    });
  });

  panel.querySelectorAll("[data-delete-archived-task]").forEach(button => {
    button.addEventListener("click", () => {
      const task = taskFromButton(button, "deleteArchivedTask");
      if (task) openPermanentDelete(task);
    });
  });
}

function renderAll() {
  renderTabs();
  render();

  const status = document.getElementById("tasksStatus");
  if (status) {
    status.textContent = "Aktuell";
    status.className = "status-pill success";
  }
}

export async function hydrateTasks(context = {}) {
  const panel = document.getElementById("tasksPanel");
  if (!panel) return;

  const params = routeParams();
  const requestedTab = params.get("tab");
  if (["mine", "team", "board", "archive"].includes(requestedTab)) {
    activeFilter = requestedTab;
  }
  activeArchiveTeamId = params.get("teamId") || "";

  panel.innerHTML = '<article class="card loading-card"><h3>Aufgaben werden geladen …</h3></article>';

  try {
    snapshot = await call("tasks_snapshot");
    if (context.isCurrent && !context.isCurrent()) return;
    renderAll();
  } catch (error) {
    panel.innerHTML = errorPanel(error);
    const status = document.getElementById("tasksStatus");
    if (status) {
      status.textContent = "Fehler";
      status.className = "status-pill error";
    }
  }
}

export function noop() {}

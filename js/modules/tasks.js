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
  showToast,
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

async function openNote(task) {
  const dialogId = "taskHistoryDialog";
  const bodyId = "taskHistoryBody";
  const addFormId = "taskHistoryAddForm";

  openDialog({
    title: "Aufgabenverlauf",
    kicker: escapeHtml(task.title || "Aufgabe"),
    wide: true,
    body: `
      <div id="${bodyId}" class="v4-task-history">
        <div class="v4-task-history-loading">
          Verlauf wird geladen …
        </div>
      </div>
    `
  });

  const host = document.getElementById(bodyId);
  if (!host) return;

  function typeLabel(entry) {
    const labels = {
      UPDATE: "Update",
      LEGACY_NOTE: "Übernommene bisherige Aufgabennotiz",
      TASK_CREATED: "Aufgabe erstellt",
      TASK_CHANGED: "Aufgabe geändert",
      STATUS_CHANGED: "Status geändert",
      ASSIGNEE_CHANGED: "Zuständigkeit geändert",
      PRIORITY_CHANGED: "Priorität geändert",
      TASK_COMPLETED: "Aufgabe erledigt",
      TASK_REOPENED: "Aufgabe wieder geöffnet",
      TASK_ARCHIVED: "Aufgabe archiviert",
      TASK_RESTORED: "Aufgabe wiederhergestellt",
      TASK_DELETED: "Aufgabe gelöscht"
    };

    return labels[entry.entryType] || "Verlauf";
  }

  function remainingMinutes(entry) {
    if (!entry.editableUntil) return 0;

    const remaining = (
      new Date(entry.editableUntil).getTime() - Date.now()
    );

    return Math.max(0, Math.ceil(remaining / 60000));
  }

  function render(history) {
    const entries = history?.entries || [];

    host.innerHTML = `
      ${history?.canAddUpdate ? `
        <form id="${addFormId}" class="v4-task-update-form">
          <label>
            Neues Update
            <textarea
              name="content"
              rows="3"
              maxlength="4000"
              placeholder="Fortschritt, Hinweis oder Ergänzung eintragen …"
              required
            ></textarea>
          </label>
          <div class="v4-task-history-form-footer">
            <small>
              Eigene Updates können 30 Minuten lang korrigiert werden.
            </small>
            <button class="button primary" type="submit">
              Update speichern
            </button>
          </div>
        </form>
      ` : ""}

      <div class="v4-task-history-list">
        ${entries.length ? entries.map(entry => `
          <article
            class="v4-task-history-entry
              ${entry.system ? "is-system" : "is-update"}
              ${entry.hidden ? "is-hidden" : ""}"
            data-task-history-entry="${escapeAttr(entry.id)}"
          >
            <header>
              <div>
                <strong>${escapeHtml(typeLabel(entry))}</strong>
                <span>
                  ${escapeHtml(entry.authorName || "System")}
                  · ${escapeHtml(fmtDateTime(entry.createdAt))}
                </span>
              </div>
              ${entry.visibility === "PRIVATE" ? `
                <span class="badge neutral">Persönlicher Alt-Eintrag</span>
              ` : ""}
            </header>

            <p>${escapeHtml(entry.content || "")}</p>

            ${entry.editedAt ? `
              <small class="v4-task-history-edited">
                Bearbeitet ${escapeHtml(fmtDateTime(entry.editedAt))}
              </small>
            ` : ""}

            ${entry.hidden && entry.hiddenReason ? `
              <small class="v4-task-history-hidden-reason">
                Begründung: ${escapeHtml(entry.hiddenReason)}
              </small>
            ` : ""}

            ${entry.canEdit || entry.canHide ? `
              <footer>
                ${entry.canEdit ? `
                  <button
                    class="button small secondary"
                    type="button"
                    data-edit-task-update="${escapeAttr(entry.id)}"
                  >
                    Korrigieren (${remainingMinutes(entry)} Min.)
                  </button>
                ` : ""}
                ${entry.canHide ? `
                  <button
                    class="button small danger"
                    type="button"
                    data-hide-task-update="${escapeAttr(entry.id)}"
                  >
                    Ausblenden
                  </button>
                ` : ""}
              </footer>
            ` : ""}
          </article>
        `).join("") : `
          <div class="empty-state">
            <strong>Noch kein Verlauf</strong>
            <p>Das erste Update kann jetzt hinzugefügt werden.</p>
          </div>
        `}
      </div>
    `;

    document.getElementById(addFormId)
      ?.addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const content = form.elements.content.value.trim();

        if (!content) return;

        if (button) button.disabled = true;

        try {
          const updated = await call("save_task_note", {
            operation: "ADD",
            taskId: task.id,
            content
          });
          showToast("Update wurde gespeichert.", "success");
          render(updated);
        } catch (error) {
          if (button) button.disabled = false;
          host.insertAdjacentHTML(
            "afterbegin",
            errorPanel(error, "Update konnte nicht gespeichert werden")
          );
        }
      });

    host.querySelectorAll("[data-edit-task-update]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const entry = entries.find(
            item => item.id === button.dataset.editTaskUpdate
          );
          if (!entry) return;

          const entryElement = button.closest(
            "[data-task-history-entry]"
          );
          if (!entryElement) return;

          entryElement.insertAdjacentHTML(
            "beforeend",
            `
              <form class="v4-task-history-inline-form">
                <label>
                  Update korrigieren
                  <textarea
                    name="content"
                    rows="3"
                    maxlength="4000"
                    required
                  >${escapeHtml(entry.content || "")}</textarea>
                </label>
                <div class="dialog-actions">
                  <button
                    class="button ghost"
                    type="button"
                    data-cancel-task-history-edit
                  >
                    Abbrechen
                  </button>
                  <button class="button primary" type="submit">
                    Korrektur speichern
                  </button>
                </div>
              </form>
            `
          );

          button.disabled = true;

          const form = entryElement.querySelector(
            ".v4-task-history-inline-form"
          );

          form?.querySelector("[data-cancel-task-history-edit]")
            ?.addEventListener("click", () => {
              form.remove();
              button.disabled = false;
            });

          form?.addEventListener("submit", async event => {
            event.preventDefault();

            const content = form.elements.content.value.trim();
            const submit = form.querySelector(
              'button[type="submit"]'
            );

            if (!content) return;
            if (submit) submit.disabled = true;

            try {
              const updated = await call("save_task_note", {
                operation: "EDIT",
                taskId: task.id,
                entryId: entry.id,
                revision: entry.revision,
                content
              });
              showToast("Update wurde korrigiert.", "success");
              render(updated);
            } catch (error) {
              if (submit) submit.disabled = false;
              form.insertAdjacentHTML(
                "beforebegin",
                errorPanel(
                  error,
                  "Update konnte nicht korrigiert werden"
                )
              );
            }
          });
        });
      });

    host.querySelectorAll("[data-hide-task-update]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const entry = entries.find(
            item => item.id === button.dataset.hideTaskUpdate
          );
          if (!entry) return;

          const entryElement = button.closest(
            "[data-task-history-entry]"
          );
          if (!entryElement) return;

          entryElement.insertAdjacentHTML(
            "beforeend",
            `
              <form class="v4-task-history-inline-form">
                <label>
                  Begründung für das Ausblenden
                  <textarea
                    name="reason"
                    rows="2"
                    maxlength="1000"
                    required
                  ></textarea>
                </label>
                <div class="dialog-actions">
                  <button
                    class="button ghost"
                    type="button"
                    data-cancel-task-history-hide
                  >
                    Abbrechen
                  </button>
                  <button class="button danger" type="submit">
                    Eintrag ausblenden
                  </button>
                </div>
              </form>
            `
          );

          button.disabled = true;

          const form = entryElement.querySelector(
            ".v4-task-history-inline-form"
          );

          form?.querySelector("[data-cancel-task-history-hide]")
            ?.addEventListener("click", () => {
              form.remove();
              button.disabled = false;
            });

          form?.addEventListener("submit", async event => {
            event.preventDefault();

            const reason = form.elements.reason.value.trim();
            const submit = form.querySelector(
              'button[type="submit"]'
            );

            if (!reason) return;
            if (submit) submit.disabled = true;

            try {
              const updated = await call("save_task_note", {
                operation: "HIDE",
                taskId: task.id,
                entryId: entry.id,
                revision: entry.revision,
                reason
              });
              showToast("Eintrag wurde ausgeblendet.", "success");
              render(updated);
            } catch (error) {
              if (submit) submit.disabled = false;
              form.insertAdjacentHTML(
                "beforebegin",
                errorPanel(
                  error,
                  "Eintrag konnte nicht ausgeblendet werden"
                )
              );
            }
          });
        });
      });
  }

  try {
    const history = await call("save_task_note", {
      operation: "LIST",
      taskId: task.id
    });
    render(history);
  } catch (error) {
    host.innerHTML = errorPanel(
      error,
      "Aufgabenverlauf konnte nicht geladen werden"
    );
  }
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

function taskListRow(task) {
  return `<button class="v4-task-list-row" type="button" data-open-task="${escapeAttr(task.id)}" data-priority="${escapeAttr(task.priority)}" data-status="${escapeAttr(task.status)}"><span class="v4-task-list-copy"><small>${escapeHtml(task.context==="BOARD"?"Vorstand":task.teamName||"Team")}</small><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.assignedName||"Noch offen")} · ${escapeHtml(label(STATUSES,task.status))}</span></span><span class="v4-task-list-end">${statusBadge(label(PRIORITIES,task.priority))}<span class="v4-row-chevron" aria-hidden="true">›</span></span></button>`;
}
function taskDetailMarkup(task) {
  const archivedInfo=task.status==="ARCHIVED"?`<div class="notice"><strong>Archiviert</strong><br>${escapeHtml(fmtDateTime(task.archivedAt))}${task.archivedByName?` · ${escapeHtml(task.archivedByName)}`:""}</div>`:"";
  return `<div class="v4-detail-grid v4-task-detail-grid"><div><span>Bereich</span><strong>${escapeHtml(task.context==="BOARD"?"Vorstand":task.teamName||"Team")}</strong></div><div><span>Priorität</span><strong>${escapeHtml(label(PRIORITIES,task.priority))}</strong></div><div><span>Status</span><strong>${escapeHtml(label(STATUSES,task.status))}</strong></div><div><span>Zugewiesen</span><strong>${escapeHtml(task.assignedName||"Noch offen")}</strong></div><div class="v4-detail-wide"><span>Beschreibung</span><strong class="v4-preserve-lines">${escapeHtml(task.description||"–")}</strong></div><div><span>Erstellt von</span><strong>${escapeHtml(task.createdByName||"–")}</strong></div><div><span>Aktualisiert</span><strong>${escapeHtml(fmtDateTime(task.updatedAt))}</strong></div>${task.assignmentReason?`<div class="v4-detail-wide"><span>Zuweisungsbegründung</span><strong class="v4-preserve-lines">${escapeHtml(task.assignmentReason)}</strong></div>`:""}${task.ownNote?`<div class="v4-detail-wide"><span>Meine Notiz</span><strong class="v4-preserve-lines">${escapeHtml(task.ownNote)}</strong></div>`:""}</div>${archivedInfo}<div class="dialog-actions v4-detail-actions v4-task-detail-actions">${statusSelect(task)}${task.canRestore?`<button class="button primary" type="button" data-restore-task="${escapeAttr(task.id)}">Wiederherstellen</button>`:""}${task.canDeletePermanently?`<button class="button danger" type="button" data-delete-archived-task="${escapeAttr(task.id)}">Endgültig löschen</button>`:""}${task.status!=="ARCHIVED"?`<button class="button secondary" type="button" data-task-note="${escapeAttr(task.id)}">Verlauf</button>`:""}${task.canManage?`<button class="button secondary" type="button" data-edit-task="${escapeAttr(task.id)}">Bearbeiten</button>`:""}${task.canArchive?`<button class="button danger" type="button" data-archive-task="${escapeAttr(task.id)}">Archivieren</button>`:""}</div>`;
}
function openTaskDetails(task) {
  const dialog=openDialog({title:task.title,kicker:"Aufgabe",body:taskDetailMarkup(task)});
  dialog.querySelector("[data-edit-task]")?.addEventListener("click",()=>openTask(task));
  dialog.querySelector("[data-task-note]")?.addEventListener("click",()=>openNote(task));
  dialog.querySelector("[data-task-status]")?.addEventListener("change",async event=>{const select=event.currentTarget,previous=task.status;if(select.value===previous)return;select.disabled=true;try{await setStatus(task,select.value);dialog.close();}catch(error){select.value=previous;select.disabled=false;throw error;}});
  dialog.querySelector("[data-archive-task]")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;await archiveTask(task);dialog.close();});
  dialog.querySelector("[data-restore-task]")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;await restoreTask(task);dialog.close();});
  dialog.querySelector("[data-delete-archived-task]")?.addEventListener("click",()=>openPermanentDelete(task));
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
    ${canCreateTask() ? '<button id="addTaskButton" class="button secondary v4-heading-action" type="button">+ Aufgabe</button>' : ""}
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
  const panel=document.getElementById("tasksPanel"); if(!panel)return; const tasks=visibleTasks();
  panel.innerHTML=tasks.length?`<div class="v4-task-list">${tasks.map(taskListRow).join("")}</div>`:empty("In dieser Ansicht sind keine Aufgaben vorhanden.");
  panel.querySelectorAll("[data-open-task]").forEach(button=>button.addEventListener("click",()=>{const task=taskFromButton(button,"openTask");if(task)openTaskDetails(task);}));
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

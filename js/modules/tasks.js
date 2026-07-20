import {
  call,
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

let snapshot = null;
let activeFilter = "open";

const PRIORITIES = [
  { value: "URGENT", label: "Eilt" },
  { value: "HIGH", label: "Hoch" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Niedrig" }
];
const STATUSES = [
  { value: "OPEN", label: "Offen" },
  { value: "IN_PROGRESS", label: "In Arbeit" },
  { value: "WAITING", label: "Warten" },
  { value: "DONE", label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" }
];

function label(items, value) {
  return items.find(item => item.value === value)?.label || value;
}

function canCreateTask() {
  return Boolean(snapshot?.canCreateBoard || (snapshot?.teams || []).some(team => team.canManage));
}

function taskForm(task = {}) {
  const teams = snapshot?.teams || [];
  const users = snapshot?.users || [];
  const defaultContext = task.context || (snapshot?.canCreateBoard && !teams.some(team => team.canManage) ? "BOARD" : "TEAM");
  return `<form class="form-grid" id="taskEditForm">
    <input type="hidden" name="id" value="${escapeAttr(task.id || "")}">
    <label>Aufgabenart<select name="context" id="taskContextSelect">${optionList([
      { value: "TEAM", label: "Teamaufgabe" },
      ...(snapshot?.canCreateBoard ? [{ value: "BOARD", label: "Vorstandsaufgabe" }] : [])
    ], defaultContext)}</select></label>
    <label>Team<select name="teamId" id="taskTeamSelect">${optionList(teams.filter(team => team.canManage || task.teamId === team.id).map(team => ({ value: team.id, label: team.name })), task.teamId || "", "Team auswählen")}</select></label>
    <label class="full">Titel<input name="title" required maxlength="300" value="${escapeAttr(task.title || "")}"></label>
    <label>Priorität<select name="priority">${optionList(PRIORITIES, task.priority || "NORMAL")}</select></label>
    <label>Zuweisung<select name="assignedUserId">${optionList(users.map(user => ({ value: user.id, label: `${user.userCode} · ${user.name}` })), task.assignedUserId || "", "Noch nicht zugewiesen")}</select></label>
    <label class="full">Beschreibung<textarea name="description" rows="5" maxlength="4000">${escapeHtml(task.description || "")}</textarea></label>
    <label class="full">Begründung bei externer Vorstandszuweisung<textarea name="assignmentReason" rows="2" maxlength="1000">${escapeHtml(task.assignmentReason || "")}</textarea></label>
  </form>`;
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
  const context = document.getElementById("taskContextSelect");
  const team = document.getElementById("taskTeamSelect");
  const sync = () => {
    if (!team) return;
    const needsTeam = context?.value === "TEAM";
    team.required = needsTeam;
    team.closest("label").hidden = !needsTeam;
  };
  context?.addEventListener("change", sync);
  sync();
}

function openNote(task) {
  openDialog({
    title: "Meine Aufgabennotiz",
    kicker: task.title,
    body: `<form><label>Persönliche Notiz<textarea name="content" maxlength="4000" rows="8">${escapeHtml(task.ownNote || "")}</textarea></label></form>`,
    onSubmit: async values => {
      snapshot = await runWrite(
        () => call("save_task_note", { taskId: task.id, content: values.content || "" }),
        "Notiz wurde gespeichert."
      );
      renderAll();
    }
  });
}

async function setStatus(task, status) {
  snapshot = await runWrite(
    () => call("set_task_status", { id: task.id, status }),
    "Aufgabenstatus wurde aktualisiert."
  );
  renderAll();
}

function visibleTasks() {
  const tasks = snapshot?.tasks || [];
  if (activeFilter === "done") return tasks.filter(task => task.status === "DONE");
  if (activeFilter === "archived") return tasks.filter(task => task.status === "ARCHIVED");
  if (activeFilter === "mine") return tasks.filter(task => task.assignedUserId === currentUser().id);
  return tasks.filter(task => !["DONE", "ARCHIVED"].includes(task.status));
}

function taskCard(task) {
  return `<article class="card v4-task-card" data-priority="${escapeAttr(task.priority)}">
    <header class="v4-card-header"><div><span class="subtle">${escapeHtml(task.context === "BOARD" ? "Vorstand" : task.teamName || "Team")}</span><h3>${escapeHtml(task.title)}</h3></div><div class="badge-stack">${statusBadge(label(PRIORITIES, task.priority))}${statusBadge(label(STATUSES, task.status))}</div></header>
    ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
    <dl class="v4-meta-grid"><div><dt>Zugewiesen</dt><dd>${escapeHtml(task.assignedName || "Noch offen")}</dd></div><div><dt>Erstellt von</dt><dd>${escapeHtml(task.createdByName || "–")}</dd></div><div><dt>Aktualisiert</dt><dd>${escapeHtml(fmtDateTime(task.updatedAt))}</dd></div></dl>
    ${task.assignmentReason ? `<div class="notice"><strong>Zuweisungsbegründung</strong><br>${escapeHtml(task.assignmentReason)}</div>` : ""}
    ${task.ownNote ? `<div class="v4-note-preview"><strong>Meine Notiz</strong><p>${escapeHtml(task.ownNote)}</p></div>` : ""}
    <footer class="v4-card-actions">
      <select class="v4-status-select" data-task-status="${escapeAttr(task.id)}" aria-label="Aufgabenstatus">${optionList(STATUSES.filter(item => item.value !== "ARCHIVED" || task.canManage), task.status)}</select>
      <button class="button small secondary" type="button" data-task-note="${escapeAttr(task.id)}">Notiz</button>
      ${task.canManage ? `<button class="button small primary" type="button" data-edit-task="${escapeAttr(task.id)}">Bearbeiten</button>` : ""}
    </footer>
  </article>`;
}

function renderTabs() {
  const slot = document.getElementById("tasksTabs");
  if (!slot) return;
  const filters = [
    ["open", "Offen"], ["mine", "Mir zugewiesen"], ["done", "Erledigt"], ["archived", "Archiv"]
  ];
  slot.innerHTML = `<div class="v4-toolbar"><div class="v4-tabs">${filters.map(([key, text]) => `<button class="v4-tab ${activeFilter === key ? "active" : ""}" type="button" data-task-filter="${key}">${text}</button>`).join("")}</div>${canCreateTask() ? '<button id="addTaskButton" class="button primary" type="button">Aufgabe erstellen</button>' : ""}</div>`;
  slot.querySelectorAll("[data-task-filter]").forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.taskFilter;
    renderAll();
  }));
  document.getElementById("addTaskButton")?.addEventListener("click", () => openTask());
}

function render() {
  const panel = document.getElementById("tasksPanel");
  if (!panel) return;
  const tasks = visibleTasks();
  panel.innerHTML = tasks.length ? `<div class="v4-card-grid">${tasks.map(taskCard).join("")}</div>` : empty("In dieser Ansicht sind keine Aufgaben vorhanden.");
  panel.querySelectorAll("[data-edit-task]").forEach(button => button.addEventListener("click", () => openTask(snapshot.tasks.find(task => task.id === button.dataset.editTask))));
  panel.querySelectorAll("[data-task-note]").forEach(button => button.addEventListener("click", () => openNote(snapshot.tasks.find(task => task.id === button.dataset.taskNote))));
  panel.querySelectorAll("[data-task-status]").forEach(select => select.addEventListener("change", async () => {
    select.disabled = true;
    try { await setStatus(snapshot.tasks.find(task => task.id === select.dataset.taskStatus), select.value); }
    catch (error) { select.disabled = false; panel.insertAdjacentHTML("afterbegin", errorPanel(error, "Status konnte nicht geändert werden")); }
  }));
}

function renderAll() {
  renderTabs();
  render();
  const status = document.getElementById("tasksStatus");
  if (status) { status.textContent = "Aktuell"; status.className = "status-pill success"; }
}

export async function hydrateTasks(context = {}) {
  const panel = document.getElementById("tasksPanel");
  if (!panel) return;
  panel.innerHTML = '<article class="card loading-card"><h3>Aufgaben werden geladen …</h3></article>';
  try {
    snapshot = await call("tasks_snapshot");
    if (context.isCurrent && !context.isCurrent()) return;
    renderAll();
  } catch (error) {
    panel.innerHTML = errorPanel(error);
    const status = document.getElementById("tasksStatus");
    if (status) { status.textContent = "Fehler"; status.className = "status-pill error"; }
  }
}

export function noop() {}

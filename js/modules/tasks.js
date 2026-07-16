import { call, closeDialog, currentUser, escapeAttr, escapeHtml, openDialog, optionList, runWrite, statusBadge } from "./common.js";
import { phase3State } from "./state.js";

let activeTab = "mine";
const CACHE_PREFIX = "tasks:";
const TAB_DEFS = [
  { id: "mine", label: "Meine Aufgaben", hint: "Dir zugewiesen" },
  { id: "team", label: "Teamaufgaben", hint: "Deine Teams" },
  { id: "board", label: "Vorstandsaufgaben", hint: "Fanclub-Ämter" },
  { id: "archive", label: "Archiv", hint: "Abgeschlossen" }
];

const ICONS = Object.freeze({
  mine: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a5 5 0 0 1 7 0"/></svg>',
  board: '<svg viewBox="0 0 24 24"><path d="M3 10h18M5 10v9M9 10v9M15 10v9M19 10v9M3 20h18M12 3l9 5H3z"/></svg>',
  archive: '<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  context: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg>',
  empty: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/></svg>'
});

function tabs() {
  const user = currentUser();
  const hasTeam = Boolean(user.isAdmin || (user.teamRights || []).length);
  const isBoard = Boolean(user.isAdmin || user.isBoard || (user.officeCodes || []).length);
  return TAB_DEFS.filter(tab => tab.id === "mine" || tab.id === "archive" || (tab.id === "team" && hasTeam) || (tab.id === "board" && isBoard));
}
function canCreate(tab) {
  const user = currentUser();
  if (user.isAdmin) return tab === "team" || tab === "board";
  if (tab === "board") return Boolean(user.isBoard || (user.officeCodes || []).length);
  if (tab === "team") return (user.teamRights || []).some(item => ["TEAMLEITER", "CO_TEAMLEITER"].includes(String(item.role || item.teamRole || item.teamrolle || "").toUpperCase()));
  return false;
}
function panel() { return document.getElementById("tasksPanel"); }
function setStatus(text, type = "success") { const el = document.getElementById("tasksStatus"); if (el) { el.textContent = text; el.className = `status-pill ${type}`; } }
function requested() { const h = String(location.hash || ""); return new URLSearchParams(h.includes("?") ? h.slice(h.indexOf("?") + 1) : "").get("tab") || ""; }
function setTab(tab) { const next = `#/tasks?tab=${encodeURIComponent(tab)}`; if (location.hash === next) renderTab(tab); else location.hash = next; }
function renderTabs() {
  const el = document.getElementById("tasksTabs");
  if (!el) return;
  const items = tabs();
  el.innerHTML = `<div class="p2-module-tabs" style="--p2-tab-count:${items.length}" role="tablist">${items.map(item => `<button type="button" class="p2-module-tab ${item.id === activeTab ? "active" : ""}" data-task-tab="${escapeAttr(item.id)}" role="tab" aria-selected="${item.id === activeTab}"><span class="p2-tab-icon" aria-hidden="true">${ICONS[item.id]}</span><span class="p2-tab-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.hint)}</small></span></button>`).join("")}</div>`;
  el.querySelectorAll("[data-task-tab]").forEach(button => button.addEventListener("click", () => setTab(button.dataset.taskTab)));
}
function normalizeStatus(value) { return String(value || "").toUpperCase(); }
function statusLabel(value) {
  return ({OFFEN:"Offen",IN_BEARBEITUNG:"In Bearbeitung",IN_ARBEIT:"In Arbeit",WARTEN:"Warten",ERLEDIGT:"Erledigt",ARCHIVIERT:"Archiviert"})[normalizeStatus(value)] || value || "–";
}
function priorityCode(value) { const code = String(value || "NORMAL").toUpperCase(); return ["EILT", "HOCH", "NORMAL", "NIEDRIG"].includes(code) ? code : "NORMAL"; }
function priorityLabel(value) { return ({EILT:"Eilt!",HOCH:"Hoch",NORMAL:"Normal",NIEDRIG:"Niedrig"})[priorityCode(value)]; }
function storeMineBoard(bundle) {
  const meta = bundle?.meta || {};
  phase3State.set(CACHE_PREFIX + "mine", { tasks: bundle?.mine || [], meta });
  phase3State.set(CACHE_PREFIX + "board", { tasks: bundle?.board || [], meta });
  return bundle || { mine: [], board: [], meta: {} };
}
async function load(tab, force = false) {
  const key = CACHE_PREFIX + tab;
  if (!force && phase3State.has(key)) return phase3State.get(key);
  let data;
  if (tab === "mine" || tab === "board") {
    const bundle = await phase3State.once(CACHE_PREFIX + "bundle", () => call("apiListFanclubTasks", { status: "alle" }), { force });
    storeMineBoard(bundle);
    data = phase3State.get(key);
  } else if (tab === "team") {
    data = await phase3State.once(CACHE_PREFIX + "team", () => call("apiListMyTeamTasks", { status: "alle" }), { force });
  } else {
    data = await phase3State.once(CACHE_PREFIX + "archive", () => call("apiListTasks", { status: "ARCHIVIERT" }), { force });
  }
  return phase3State.set(key, data || { tasks: [], meta: {} });
}
function taskActions(task) {
  const status = normalizeStatus(task.status);
  const out = [];
  if (task.canChangeOwnStatus && status === "OFFEN") out.push(`<button class="button small primary" data-task-status="IN_BEARBEITUNG" data-id="${escapeAttr(task.id)}">Beginnen</button>`);
  if (task.canChangeOwnStatus && ["IN_BEARBEITUNG", "IN_ARBEIT"].includes(status)) out.push(`<button class="button small primary" data-task-status="ERLEDIGT" data-id="${escapeAttr(task.id)}">Erledigen</button>`);
  if (task.canFullyEdit && status !== "ARCHIVIERT") out.push(`<button class="button small secondary" data-task-edit="${escapeAttr(task.id)}">Bearbeiten</button>`);
  if (task.canFullyEdit && status === "ERLEDIGT") out.push(`<button class="button small secondary" data-task-reopen="${escapeAttr(task.id)}">Wieder öffnen</button>`);
  if (task.canFullyEdit && status !== "ARCHIVIERT") out.push(`<button class="button small danger" data-task-archive="${escapeAttr(task.id)}">Archivieren</button>`);
  if (status !== "ARCHIVIERT") out.push(`<button class="button small ghost" data-task-note="${escapeAttr(task.id)}">Eigene Notiz</button>`);
  return out.join("");
}
function taskCard(task) {
  const priority = priorityCode(task.priority || task.prioritaet);
  const status = normalizeStatus(task.status);
  return `<article class="p2-task-card priority-${priority.toLowerCase()} ${["ERLEDIGT", "ARCHIVIERT"].includes(status) ? "is-done" : ""}">
    <div class="p2-task-head"><div class="p2-task-title-wrap"><div class="p2-task-title">${escapeHtml(task.title || task.aufgabe || "Aufgabe")}</div><div class="p2-task-context">${ICONS.context}<span>${escapeHtml(task.team || task.contextId || "Ohne Team")}</span></div></div>${statusBadge(statusLabel(task.status))}</div>
    <div class="p2-task-meta"><div><small>Verantwortlich</small><span>${escapeHtml(task.verantwortlich || "Nicht zugewiesen")}</span></div><div><small>Priorität</small><span class="p2-priority">${escapeHtml(priorityLabel(priority))}</span></div></div>
    ${task.description ? `<p class="p2-task-description">${escapeHtml(task.description)}</p>` : ""}
    ${task.ownNote || task.notiz ? `<div class="p2-task-note"><strong>Eigene Notiz:</strong> ${escapeHtml(task.ownNote || task.notiz)}</div>` : ""}
    <div class="p2-task-actions">${taskActions(task)}</div>
  </article>`;
}
function emptyTasks() { return `<div class="p2-empty"><span class="p2-empty-icon" aria-hidden="true">${ICONS.empty}</span><strong>Hier ist gerade nichts offen</strong><p>Neue oder dir zugewiesene Aufgaben erscheinen automatisch in diesem Bereich.</p></div>`; }
function taskSummary(tasks) {
  const counts = tasks.reduce((acc, task) => { const status = normalizeStatus(task.status); acc.total++; if (status === "OFFEN") acc.open++; if (["IN_BEARBEITUNG", "IN_ARBEIT", "WARTEN"].includes(status)) acc.progress++; if (["ERLEDIGT", "ARCHIVIERT"].includes(status)) acc.done++; if (priorityCode(task.priority || task.prioritaet) === "EILT" && !["ERLEDIGT", "ARCHIVIERT"].includes(status)) acc.urgent++; return acc; }, { total: 0, open: 0, progress: 0, done: 0, urgent: 0 });
  return `<div class="p2-task-summary"><div class="p2-task-summary-item"><small>Gesamt</small><strong>${counts.total}</strong></div><div class="p2-task-summary-item"><small>Offen</small><strong>${counts.open}</strong></div><div class="p2-task-summary-item progress"><small>In Arbeit / Warten</small><strong>${counts.progress}</strong></div><div class="p2-task-summary-item eilt"><small>Eilt</small><strong>${counts.urgent}</strong></div></div>`;
}
function renderTaskView(data) {
  const tasks = data.tasks || [];
  const title = (TAB_DEFS.find(item => item.id === activeTab) || {}).label || "Aufgaben";
  panel().innerHTML = `<div class="p2-section-heading"><div><span>Arbeitsübersicht</span><h3>${escapeHtml(title)}</h3><p>Priorität, Status und Zuständigkeit sind auf einen Blick erkennbar.</p></div></div>${taskSummary(tasks)}
    <div class="p2-task-toolbar"><div class="p2-search">${ICONS.search}<input id="taskSearch" placeholder="Aufgabe, Team oder Person suchen …" aria-label="Aufgaben durchsuchen"></div><select id="taskFilter" aria-label="Status filtern"><option value="active" ${activeTab === "archive" ? "" : "selected"}>Offene Aufgaben</option><option value="all">Alle</option><option value="done" ${activeTab === "archive" ? "selected" : ""}>Erledigt</option><option value="urgent">Nur Eilt</option></select><div class="p2-toolbar-actions">${canCreate(activeTab) && data.meta?.teamsDetailed?.length ? '<button id="newTask" class="button primary">+ Aufgabe</button>' : ""}<button id="refreshTasks" class="button ghost">Aktualisieren</button></div></div>
    <div id="taskResultMeta" class="p2-result-meta"></div><div id="taskResults" class="p2-task-list"></div>`;
  const draw = () => {
    const query = String(document.getElementById("taskSearch")?.value || "").toLowerCase().trim();
    const filter = document.getElementById("taskFilter")?.value || "active";
    const visible = tasks.filter(task => {
      const status = normalizeStatus(task.status);
      const haystack = [task.title, task.aufgabe, task.team, task.contextId, task.verantwortlich, task.description].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filter === "active" && ["ERLEDIGT", "ARCHIVIERT"].includes(status)) return false;
      if (filter === "done" && !["ERLEDIGT", "ARCHIVIERT"].includes(status)) return false;
      if (filter === "urgent" && priorityCode(task.priority || task.prioritaet) !== "EILT") return false;
      return true;
    });
    const meta = document.getElementById("taskResultMeta");
    if (meta) meta.innerHTML = `<span><strong>${visible.length}</strong> von ${tasks.length} Aufgaben</span><span>${filter === "active" ? "Aktive Ansicht" : "Gefilterte Ansicht"}</span>`;
    const results = document.getElementById("taskResults");
    if (results) results.innerHTML = visible.map(taskCard).join("") || emptyTasks();
    bindTaskActions(data, visible);
  };
  document.getElementById("taskSearch")?.addEventListener("input", draw);
  document.getElementById("taskFilter")?.addEventListener("change", draw);
  document.getElementById("refreshTasks")?.addEventListener("click", () => { phase3State.remove(CACHE_PREFIX + activeTab); if (activeTab === "mine" || activeTab === "board") phase3State.remove(CACHE_PREFIX + "bundle"); renderTab(activeTab, true); });
  document.getElementById("newTask")?.addEventListener("click", () => openTask({}, data.meta || {}));
  draw();
}
function bindTaskActions(data, tasks) {
  const root = document.getElementById("taskResults");
  root?.querySelectorAll("[data-task-status]").forEach(button => button.addEventListener("click", () => changeStatus(tasks.find(task => String(task.id) === button.dataset.id), button.dataset.taskStatus)));
  root?.querySelectorAll("[data-task-edit]").forEach(button => button.addEventListener("click", () => openTask(tasks.find(task => String(task.id) === button.dataset.taskEdit), data.meta || {})));
  root?.querySelectorAll("[data-task-reopen]").forEach(button => button.addEventListener("click", () => write("apiReopenTask", tasks.find(task => String(task.id) === button.dataset.taskReopen))));
  root?.querySelectorAll("[data-task-archive]").forEach(button => button.addEventListener("click", () => write("apiArchiveTask", tasks.find(task => String(task.id) === button.dataset.taskArchive))));
  root?.querySelectorAll("[data-task-note]").forEach(button => button.addEventListener("click", () => openNote(tasks.find(task => String(task.id) === button.dataset.taskNote))));
}
async function renderTab(tab, force = false) {
  activeTab = tabs().some(item => item.id === tab) ? tab : "mine";
  renderTabs();
  setStatus("Daten werden geladen", "warning");
  if (panel()) panel().innerHTML = '<div class="loading-panel"><span class="spinner" aria-hidden="true"></span><strong>Aufgaben werden geladen …</strong></div>';
  try { const data = await load(activeTab, force); renderTaskView(data); setStatus("Live verbunden", "success"); }
  catch (error) { if (panel()) panel().innerHTML = `<div class="notice error"><strong>Aufgaben konnten nicht geladen werden</strong><br>${escapeHtml(error?.message || String(error || "Unbekannter Fehler"))}</div>`; setStatus("Fehler", "warning"); }
}
async function changeStatus(task, status) { if (!task) return; await runWrite("Status wird gespeichert …", () => call("apiSetTaskStatus", { id: task.id, revision: task.revision, status })); phase3State.clear(CACHE_PREFIX); await renderTab(activeTab, true); }
async function write(apiName, task) { if (!task) return; await runWrite("Aufgabe wird aktualisiert …", () => call(apiName, { id: task.id, revision: task.revision })); phase3State.clear(CACHE_PREFIX); await renderTab(activeTab, true); }
function openNote(task) { if (!task) return; openDialog({ title: "Eigene Notiz", kicker: task.title || task.aufgabe || task.id, body: `<form><div class="p2-form-intro">Diese Notiz ist dein persönlicher Arbeitsvermerk zur Aufgabe.</div><input type="hidden" name="taskId" value="${escapeAttr(task.id)}"><input type="hidden" name="revision" value="${escapeAttr(task.ownNoteRevision || 0)}"><label>Notiz<textarea name="content" maxlength="4000">${escapeHtml(task.ownNote || task.notiz || "")}</textarea></label></form>`, onSubmit: async data => { await runWrite("Notiz wird gespeichert …", () => call("apiSaveTaskNote", data)); closeDialog(); phase3State.clear(CACHE_PREFIX); await renderTab(activeTab, true); } }); }
function openTask(task = {}, meta = {}) {
  const teams = meta.teamsDetailed || [];
  const teamDefault = task.contextId || (activeTab === "board" ? "VORSTAND" : teams.find(team => team.id !== "VORSTAND")?.id) || "";
  const assignees = meta.verantwortlicheByTeam?.[teamDefault] || [];
  openDialog({ title: task.id ? "Aufgabe bearbeiten" : "Aufgabe erstellen", kicker: activeTab === "board" ? "Vorstand" : "Team", wide: true, body: `<form><input type="hidden" name="id" value="${escapeAttr(task.id || "")}"><input type="hidden" name="revision" value="${escapeAttr(task.revision || "")}"><div class="form-grid"><div class="p2-form-section">Aufgabe</div><label class="full">Titel<input name="aufgabe" required maxlength="300" value="${escapeAttr(task.title || task.aufgabe || "")}"></label><label>Kontext<select id="taskContext" name="teamId" required>${optionList(teams, teamDefault, "Team auswählen")}</select></label><label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten || ["NIEDRIG", "NORMAL", "HOCH", "EILT"], task.priority || task.prioritaet || "NORMAL")}</select></label><div class="p2-form-section">Zuständigkeit</div><label class="full">Verantwortlich<select id="taskAssignee" name="verantwortlichId">${optionList(assignees, task.assigneeUserId || task.verantwortlichId || "", "Nicht zugewiesen")}</select></label><label class="full">Begründung bei Vorstand-Zuweisung an Nicht-Amtsinhaber<textarea name="assignmentReason" maxlength="1000">${escapeHtml(task.assignmentReason || "")}</textarea></label><div class="p2-form-section">Beschreibung</div><label class="full">Details<textarea name="description" maxlength="4000">${escapeHtml(task.description || "")}</textarea></label></div></form>`, onSubmit: async data => { await runWrite("Aufgabe wird gespeichert …", () => call("apiSaveTask", data)); closeDialog(); phase3State.clear(CACHE_PREFIX); await renderTab(activeTab, true); } });
  const select = document.getElementById("taskContext"), assignee = document.getElementById("taskAssignee");
  select?.addEventListener("change", () => { if (assignee) assignee.innerHTML = optionList(meta.verantwortlicheByTeam?.[select.value] || [], "", "Nicht zugewiesen"); });
}
export async function hydrateTasks() { activeTab = tabs().some(item => item.id === requested()) ? requested() : "mine"; renderTabs(); await renderTab(activeTab); }

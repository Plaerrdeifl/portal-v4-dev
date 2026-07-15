import { call, closeDialog, currentUser, empty, errorPanel, escapeAttr, escapeHtml, loading, openDialog, optionList, runWrite, statusBadge, tabBar } from "./common.js";

let activeTab="mine";
const cache=new Map();
const TAB_DEFS=[
  {id:"mine",label:"Meine Aufgaben",icon:"👤"},
  {id:"team",label:"Teamaufgaben",icon:"🤝"},
  {id:"board",label:"Vorstandsaufgaben",icon:"🏛️"},
  {id:"archive",label:"Archiv",icon:"🗄️"}
];
function tabs(){
  const user=currentUser();
  const hasTeam=Boolean(user.isAdmin||(user.teamRights||[]).length);
  const isBoard=Boolean(user.isAdmin||user.isBoard||(user.officeCodes||[]).length);
  return TAB_DEFS.filter(tab=>tab.id==="mine"||tab.id==="archive"||(tab.id==="team"&&hasTeam)||(tab.id==="board"&&isBoard));
}
function canCreate(tab){
  const user=currentUser();
  if(user.isAdmin)return tab==="team"||tab==="board";
  if(tab==="board")return Boolean(user.isBoard||(user.officeCodes||[]).length);
  if(tab==="team")return (user.teamRights||[]).some(item=>["TEAMLEITER","CO_TEAMLEITER"].includes(String(item.role||item.teamRole||item.teamrolle||"").toUpperCase()));
  return false;
}
function panel(){return document.getElementById("tasksPanel");}
function setStatus(text,type="success"){const el=document.getElementById("tasksStatus");if(el){el.textContent=text;el.className=`status-pill ${type}`;}}
function requested(){const h=String(location.hash||"");return new URLSearchParams(h.includes("?")?h.slice(h.indexOf("?")+1):"").get("tab")||"";}
function setTab(tab){const next=`#/tasks?tab=${encodeURIComponent(tab)}`;if(location.hash===next)renderTab(tab);else location.hash=next;}
function renderTabs(){const el=document.getElementById("tasksTabs");if(!el)return;el.innerHTML=tabBar(tabs(),activeTab,"tasks");el.querySelectorAll('[data-module-tab="tasks"]').forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));}
function normalizeStatus(value){return String(value||"").toUpperCase();}
function statusLabel(v){return ({OFFEN:"Offen",IN_BEARBEITUNG:"In Bearbeitung",ERLEDIGT:"Erledigt",ARCHIVIERT:"Archiviert"})[normalizeStatus(v)]||v||"–";}
function priorityLabel(v){return ({EILT:"Eilt!",HOCH:"Hoch",NORMAL:"Normal",NIEDRIG:"Niedrig"})[String(v||"").toUpperCase()]||v||"Normal";}
async function load(tab,force=false){if(!force&&cache.has(tab))return cache.get(tab);let data;
 if(tab==="mine"||tab==="board"){data=await call("apiListFanclubTasks",{status:"alle"});data={tasks:tab==="mine"?(data.mine||[]):(data.board||[]),meta:data.meta||{}};}
 else if(tab==="team")data=await call("apiListMyTeamTasks",{status:"alle"});
 else data=await call("apiListTasks",{status:"ARCHIVIERT"});
 cache.set(tab,data||{tasks:[],meta:{}});return cache.get(tab);}
function actions(task){const s=normalizeStatus(task.status), out=[];
 if(task.canChangeOwnStatus&&s==="OFFEN")out.push(`<button class="button small primary" data-task-status="IN_BEARBEITUNG" data-id="${escapeAttr(task.id)}">Beginnen</button>`);
 if(task.canChangeOwnStatus&&s==="IN_BEARBEITUNG")out.push(`<button class="button small primary" data-task-status="ERLEDIGT" data-id="${escapeAttr(task.id)}">Erledigen</button>`);
 if(task.canFullyEdit&&s!=="ARCHIVIERT")out.push(`<button class="button small secondary" data-task-edit="${escapeAttr(task.id)}">Bearbeiten</button>`);
 if(task.canFullyEdit&&s==="ERLEDIGT")out.push(`<button class="button small secondary" data-task-reopen="${escapeAttr(task.id)}">Wieder öffnen</button>`);
 if(task.canFullyEdit&&s!=="ARCHIVIERT")out.push(`<button class="button small danger" data-task-archive="${escapeAttr(task.id)}">Archivieren</button>`);
 if(s!=="ARCHIVIERT")out.push(`<button class="button small ghost" data-task-note="${escapeAttr(task.id)}">Eigene Notiz</button>`);
 return out.join("");}
function card(task){return `<article class="card task-card"><div class="entity-head"><div><div class="task-title">${escapeHtml(task.title||task.aufgabe||"Aufgabe")}</div><span class="subtle">${escapeHtml(task.team||task.contextId||"–")}</span></div>${statusBadge(statusLabel(task.status))}</div><div class="meta-grid"><div class="meta-item"><small>Verantwortlich</small>${escapeHtml(task.verantwortlich||"Nicht zugewiesen")}</div><div class="meta-item"><small>Priorität</small>${escapeHtml(priorityLabel(task.priority||task.prioritaet))}</div></div>${task.description?`<p>${escapeHtml(task.description)}</p>`:""}${task.ownNote||task.notiz?`<div class="notice"><strong>Eigene Notiz:</strong> ${escapeHtml(task.ownNote||task.notiz)}</div>`:""}<div class="button-row">${actions(task)}</div></article>`;}
async function renderTab(tab,force=false){activeTab=tabs().some(x=>x.id===tab)?tab:"mine";renderTabs();panel().innerHTML=loading();setStatus("Daten werden geladen","warning");try{const data=await load(activeTab,force);const tasks=data.tasks||[];panel().innerHTML=`<div class="section-title"><div><h3>${escapeHtml((TAB_DEFS.find(x=>x.id===activeTab)||{}).label||"Aufgaben")}</h3><p>Schaltflächen werden nur nach den vom Backend gelieferten Fähigkeiten angezeigt.</p></div><div class="button-row">${canCreate(activeTab)&&data.meta?.teamsDetailed?.length?'<button id="newTask" class="button primary small">+ Aufgabe</button>':""}<button id="refreshTasks" class="button ghost small">Aktualisieren</button></div></div><div class="list-grid" style="margin-top:16px">${tasks.map(card).join("")||empty("Keine Aufgaben in diesem Bereich.")}</div>`;bind(data);setStatus("Live verbunden","success");}catch(e){panel().innerHTML=errorPanel(e);setStatus("Fehler","warning");}}
function bind(data){const tasks=data.tasks||[];document.getElementById("refreshTasks")?.addEventListener("click",()=>{cache.delete(activeTab);renderTab(activeTab,true);});document.getElementById("newTask")?.addEventListener("click",()=>openTask({},data.meta||{}));
 panel().querySelectorAll("[data-task-status]").forEach(b=>b.addEventListener("click",()=>changeStatus(tasks.find(t=>String(t.id)===b.dataset.id),b.dataset.taskStatus)));
 panel().querySelectorAll("[data-task-edit]").forEach(b=>b.addEventListener("click",()=>openTask(tasks.find(t=>String(t.id)===b.dataset.taskEdit),data.meta||{})));
 panel().querySelectorAll("[data-task-reopen]").forEach(b=>b.addEventListener("click",()=>write("apiReopenTask",tasks.find(t=>String(t.id)===b.dataset.taskReopen))));
 panel().querySelectorAll("[data-task-archive]").forEach(b=>b.addEventListener("click",()=>write("apiArchiveTask",tasks.find(t=>String(t.id)===b.dataset.taskArchive))));
 panel().querySelectorAll("[data-task-note]").forEach(b=>b.addEventListener("click",()=>openNote(tasks.find(t=>String(t.id)===b.dataset.taskNote))));}
async function changeStatus(task,status){if(!task)return;await runWrite("Status wird gespeichert …",()=>call("apiSetTaskStatus",{id:task.id,revision:task.revision,status}));cache.clear();await renderTab(activeTab,true);}
async function write(apiName,task){if(!task)return;await runWrite("Aufgabe wird aktualisiert …",()=>call(apiName,{id:task.id,revision:task.revision}));cache.clear();await renderTab(activeTab,true);}
function openNote(task){if(!task)return;openDialog({title:"Eigene Notiz",kicker:task.title||task.aufgabe||task.id,body:`<form><input type="hidden" name="taskId" value="${escapeAttr(task.id)}"><input type="hidden" name="revision" value="${escapeAttr(task.ownNoteRevision||0)}"><label>Notiz<textarea name="content" maxlength="4000">${escapeHtml(task.ownNote||task.notiz||"")}</textarea></label></form>`,onSubmit:async data=>{await runWrite("Notiz wird gespeichert …",()=>call("apiSaveTaskNote",data));closeDialog();cache.clear();await renderTab(activeTab,true);}});}
function openTask(task={},meta={}){const teams=meta.teamsDetailed||[];const teamDefault=task.contextId||(activeTab==="board"?"VORSTAND":teams.find(t=>t.id!=="VORSTAND")?.id)||"";const assignees=meta.verantwortlicheByTeam?.[teamDefault]||[];openDialog({title:task.id?"Aufgabe bearbeiten":"Aufgabe erstellen",kicker:activeTab==="board"?"Vorstand":"Team",body:`<form><input type="hidden" name="id" value="${escapeAttr(task.id||"")}"><input type="hidden" name="revision" value="${escapeAttr(task.revision||"")}"><div class="form-grid"><label class="full">Aufgabe<input name="aufgabe" required maxlength="300" value="${escapeAttr(task.title||task.aufgabe||"")}"></label><label>Kontext<select id="taskContext" name="teamId" required>${optionList(teams,teamDefault,"Team auswählen")}</select></label><label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten||["NIEDRIG","NORMAL","HOCH","EILT"],task.priority||task.prioritaet||"NORMAL")}</select></label><label class="full">Verantwortlich<select id="taskAssignee" name="verantwortlichId">${optionList(assignees,task.assigneeUserId||task.verantwortlichId||"","Nicht zugewiesen")}</select></label><label class="full">Begründung bei Vorstand-Zuweisung an Nicht-Amtsinhaber<textarea name="assignmentReason" maxlength="1000">${escapeHtml(task.assignmentReason||"")}</textarea></label><label class="full">Beschreibung<textarea name="description" maxlength="4000">${escapeHtml(task.description||"")}</textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Aufgabe wird gespeichert …",()=>call("apiSaveTask",data));closeDialog();cache.clear();await renderTab(activeTab,true);}});const select=document.getElementById("taskContext"),assignee=document.getElementById("taskAssignee");select?.addEventListener("change",()=>{assignee.innerHTML=optionList(meta.verantwortlicheByTeam?.[select.value]||[],"","Nicht zugewiesen");});}
export async function hydrateTasks(){activeTab=tabs().some(x=>x.id===requested())?requested():"mine";renderTabs();await renderTab(activeTab);}

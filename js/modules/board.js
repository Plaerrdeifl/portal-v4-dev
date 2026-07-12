import {
  call, canWrite, closeDialog, confirmAction, empty, errorPanel, escapeAttr, escapeHtml,
  fmtDate, loading, openDialog, optionList, runWrite, statusBadge, tabBar, today
} from "./common.js";

let activeTab = "applications";
function panel(){return document.getElementById("boardPanel");}
function setStatus(text,type="success"){const el=document.getElementById("boardStatus");if(el){el.textContent=text;el.className=`status-pill ${type}`;}}
function tabs(){return [{id:"applications",label:"Mitgliedsanträge",icon:"👤"},{id:"tasks",label:"Vorstandsaufgaben",icon:"📋"}];}
function requestedTab(){const hash=String(location.hash||"");const q=hash.includes("?")?hash.slice(hash.indexOf("?")+1):"";return new URLSearchParams(q).get("tab")||"";}
function setTab(tab){const next=`#/board?tab=${encodeURIComponent(tab)}`;if(location.hash===next)renderTab(tab);else location.hash=next;}
function renderTabs(){const wrap=document.getElementById("boardTabs");if(!wrap)return;wrap.innerHTML=tabBar(tabs(),activeTab,"board");wrap.querySelectorAll('[data-module-tab="board"]').forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.tab)));}

export async function hydrateBoard(){const req=requestedTab();activeTab=tabs().some(item=>item.id===req)?req:"applications";renderTabs();await renderTab(activeTab);}
async function renderTab(tab){activeTab=tabs().some(item=>item.id===tab)?tab:"applications";renderTabs();panel().innerHTML=loading();setStatus("Daten werden geladen","warning");try{if(activeTab==="applications")await renderApplications();else await renderTasks();setStatus("Live verbunden","success");}catch(error){panel().innerHTML=errorPanel(error);setStatus("Fehler","warning");}}

async function renderApplications(){
  const data=await call("apiListAccessRequests",{status:"alle"});
  const rows=(data.requests||[]).filter(row=>String(row.status||"").toLowerCase()==="offen");
  panel().innerHTML=`<div class="section-title"><div><h3>Offene Mitgliedsanträge</h3><p>Vorstand, Kassier und Schriftführer können Anträge prüfen und freigeben.</p></div><button id="boardApplicationsRefresh" class="button ghost small">Aktualisieren</button></div><div class="settings-grid" style="margin-top:16px">${rows.map(row=>`<article class="card"><div class="entity-head"><div><h3>${escapeHtml(row.name||row.email||row.id)}</h3><span class="subtle">${escapeHtml(row.email||"")} · ${escapeHtml(fmtDate(row.antragAm))}</span></div>${statusBadge(row.status)}</div><div class="button-row" style="margin-top:14px">${canWrite("Benutzeranträge")?`<button class="button small primary" data-approve="${escapeAttr(row.id)}">Freigeben</button><button class="button small danger" data-reject="${escapeAttr(row.id)}">Ablehnen</button>`:""}</div></article>`).join("")||empty("Keine offenen Mitgliedsanträge.")}</div>`;
  document.getElementById("boardApplicationsRefresh")?.addEventListener("click",renderApplications);
  document.querySelectorAll("[data-approve]").forEach(button=>button.addEventListener("click",()=>approve(rows.find(row=>row.id===button.dataset.approve),data.meta||{})));
  document.querySelectorAll("[data-reject]").forEach(button=>button.addEventListener("click",()=>reject(button.dataset.reject)));
}
function approve(request,meta){
  openDialog({title:"Mitgliedsantrag freigeben",kicker:request.email||request.id,body:`<form><input type="hidden" name="antragId" value="${escapeAttr(request.id)}"><div class="form-grid"><label>Rolle<select name="rolle" required>${optionList(meta.roles||[],"","Rolle auswählen")}</select></label><label>Mitglieds-ID<select name="mitgliedsId">${optionList(meta.members||[],"","Keine Verknüpfung")}</select></label><label class="full">Bemerkung<textarea name="bemerkung"></textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Antrag wird freigegeben …",()=>call("apiApproveAccessRequest",data));closeDialog();await renderApplications();}});
}
async function reject(id){if(!await confirmAction({title:"Antrag ablehnen",message:"Der Mitgliedsantrag wird abgelehnt.",confirmText:"Ablehnen"}))return;await runWrite("Antrag wird abgelehnt …",()=>call("apiRejectAccessRequest",{antragId:id,bemerkung:"Über Vorstandsbereich abgelehnt"}));await renderApplications();}

async function renderTasks(){
  const data=await call("apiListFanclubTasks",{status:"alle"});
  const tasks=(data.board||[]).filter(task=>!task.erledigt&&String(task.status||"").toLowerCase()!=="erledigt");
  panel().innerHTML=`<div class="section-title"><div><h3>Offene Vorstandsaufgaben</h3><p>Gemeinsame Aufgaben des Vorstands.</p></div><div class="button-row">${canWrite("Aufgaben")?'<button id="newBoardTask" class="button primary small">+ Aufgabe</button>':""}<button id="boardTasksRefresh" class="button ghost small">Aktualisieren</button></div></div><div class="list-grid" style="margin-top:16px">${tasks.map(task=>`<article class="card task-card"><div class="entity-head"><div><div class="task-title">${escapeHtml(task.aufgabe)}</div><span class="subtle">${escapeHtml(task.team||"Vorstand")}</span></div>${statusBadge(task.status)}</div><div class="meta-grid"><div class="meta-item"><small>Verantwortlich</small>${escapeHtml(task.verantwortlich||"–")}</div><div class="meta-item"><small>Frist</small>${escapeHtml(fmtDate(task.frist))}</div></div>${task.notiz?`<p>${escapeHtml(task.notiz)}</p>`:""}${canWrite("Aufgaben")?`<div class="button-row"><button class="button small primary" data-complete="${task.row}">Erledigen</button></div>`:""}</article>`).join("")||empty("Keine offenen Vorstandsaufgaben.")}</div>`;
  document.getElementById("boardTasksRefresh")?.addEventListener("click",renderTasks);
  document.getElementById("newBoardTask")?.addEventListener("click",()=>openTaskForm({},data.meta||{}));
  document.querySelectorAll("[data-complete]").forEach(button=>button.addEventListener("click",async()=>{await runWrite("Aufgabe wird erledigt …",()=>call("apiCompleteTask",Number(button.dataset.complete)));await renderTasks();}));
}
function openTaskForm(task={},meta={}){
  const teams=meta.teamsDetailed||(meta.teams||[]).map(name=>({id:name,name}));
  const board=teams.find(team=>String(team.name||"").toLowerCase()==="vorstand");
  openDialog({title:"Vorstandsaufgabe anlegen",kicker:"Vorstand",body:`<form><div class="form-grid"><label class="full">Aufgabe<input name="aufgabe" required></label><label>Team<select name="teamId" required>${optionList(teams.map(team=>({value:team.id,label:team.name})),board?.id||"","Team auswählen")}</select></label><label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten||["Niedrig","Normal","Hoch","Eilt!"],"Normal")}</select></label><label>Frist<input type="date" name="frist" value="${today()}"></label><label>Status<select name="status">${optionList(meta.statusListe||["Offen","In Arbeit","Erledigt"],"Offen")}</select></label><label class="full">Verantwortlich<input name="verantwortlich"></label><label class="full">Notiz<textarea name="notiz"></textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Aufgabe wird gespeichert …",()=>call("apiSaveTask",data));closeDialog();await renderTasks();}});
}

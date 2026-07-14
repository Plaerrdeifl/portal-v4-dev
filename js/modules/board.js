import {
  call, callBatch, canWrite, closeDialog, confirmAction, empty, errorPanel, escapeAttr, escapeHtml,
  fmtDate, loading, openDialog, optionList, runWrite, statusBadge, tabBar
} from "./common.js";
import { phase3State } from "./state.js";

const KEY = "board:";
let activeTab = "applications";
function panel(){return document.getElementById("boardPanel");}
function setStatus(text,type="success"){const el=document.getElementById("boardStatus");if(el){el.textContent=text;el.className=`status-pill ${type}`;}}
function tabs(){return [{id:"applications",label:"Mitgliedsanträge",icon:"👤"},{id:"tasks",label:"Vorstandsaufgaben",icon:"📋"}];}
function requestedTab(){const hash=String(location.hash||"");const q=hash.includes("?")?hash.slice(hash.indexOf("?")+1):"";return new URLSearchParams(q).get("tab")||"";}
function setTab(tab){const next=`#/board?tab=${encodeURIComponent(tab)}`;if(location.hash===next)renderTab(tab);else location.hash=next;}
function renderTabs(){const wrap=document.getElementById("boardTabs");if(!wrap)return;wrap.innerHTML=tabBar(tabs(),activeTab,"board");wrap.querySelectorAll('[data-module-tab="board"]').forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.tab)));}

async function prefetchBoard(){
  const calls=[];
  if(!phase3State.has(KEY+"applications"))calls.push({id:"applications",functionName:"apiListAccessRequests",args:[{status:"alle"}]});
  if(!phase3State.has(KEY+"tasks"))calls.push({id:"tasks",functionName:"apiListFanclubTasks",args:[{status:"alle"}]});
  if(!calls.length)return;
  const bundle=await callBatch(calls);
  Object.entries(bundle?.results||{}).forEach(([id,value])=>phase3State.set(KEY+id,value));
}

export async function hydrateBoard(){const req=requestedTab();activeTab=tabs().some(item=>item.id===req)?req:"applications";renderTabs();await prefetchBoard();await renderTab(activeTab);}
async function renderTab(tab){activeTab=tabs().some(item=>item.id===tab)?tab:"applications";renderTabs();panel().innerHTML=loading();setStatus("Daten werden geladen","warning");try{if(activeTab==="applications")await renderApplications();else await renderTasks();setStatus("Live verbunden","success");}catch(error){panel().innerHTML=errorPanel(error);setStatus("Fehler","warning");}}

async function renderApplications(force=false){
  let data=phase3State.get(KEY+"applications");
  if(!data||force)data=phase3State.set(KEY+"applications",await call("apiListAccessRequests",{status:"alle"}));
  const rows=(data.requests||[]).filter(row=>String(row.status||"").toLowerCase()==="offen");
  panel().innerHTML=`<div class="section-title"><div><h3>Offene Mitgliedsanträge</h3><p>Vorstand, Kassier und Schriftführer können Anträge prüfen und freigeben.</p></div><button id="boardApplicationsRefresh" class="button ghost small">Aktualisieren</button></div><div class="settings-grid" style="margin-top:16px">${rows.map(row=>`<article class="card"><div class="entity-head"><div><h3>${escapeHtml(row.name||row.email||row.id)}</h3><span class="subtle">${escapeHtml(row.email||"")} · ${escapeHtml(fmtDate(row.antragAm))}</span></div>${statusBadge(row.status)}</div><div class="button-row" style="margin-top:14px">${canWrite("Benutzeranträge")?`<button class="button small primary" data-approve="${escapeAttr(row.id)}">Freigeben</button><button class="button small danger" data-reject="${escapeAttr(row.id)}">Ablehnen</button>`:""}</div></article>`).join("")||empty("Keine offenen Mitgliedsanträge.")}</div>`;
  document.getElementById("boardApplicationsRefresh")?.addEventListener("click",()=>renderApplications(true));
  document.querySelectorAll("[data-approve]").forEach(button=>button.addEventListener("click",()=>approve(rows.find(row=>row.id===button.dataset.approve),data.meta||{})));
  document.querySelectorAll("[data-reject]").forEach(button=>button.addEventListener("click",()=>reject(button.dataset.reject)));
}
function approve(request,meta){
  openDialog({title:"Mitgliedsantrag freigeben",kicker:request.email||request.id,body:`<form><input type="hidden" name="antragId" value="${escapeAttr(request.id)}"><div class="form-grid"><label>Rolle<select name="rolle" required>${optionList(meta.roles||[],"","Rolle auswählen")}</select></label><label>Mitglieds-ID<select name="mitgliedsId">${optionList(meta.members||[],"","Keine Verknüpfung")}</select></label><label class="full">Bemerkung<textarea name="bemerkung"></textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Antrag wird freigegeben …",()=>call("apiApproveAccessRequest",data));closeDialog();phase3State.remove(KEY+"applications");await renderApplications(true);}});
}
async function reject(id){if(!await confirmAction({title:"Antrag ablehnen",message:"Der Mitgliedsantrag wird abgelehnt.",confirmText:"Ablehnen"}))return;await runWrite("Antrag wird abgelehnt …",()=>call("apiRejectAccessRequest",{antragId:id,bemerkung:"Über Vorstandsbereich abgelehnt"}));phase3State.remove(KEY+"applications");await renderApplications(true);}

async function renderTasks(force=false){
  let data=phase3State.get(KEY+"tasks");
  if(!data||force)data=phase3State.set(KEY+"tasks",await call("apiListFanclubTasks",{status:"alle"}));
  const tasks=(data.board||[]).filter(task=>!task.erledigt&&String(task.status||"").toLowerCase()!=="erledigt");
  panel().innerHTML=`<div class="section-title"><div><h3>Offene Vorstandsaufgaben</h3><p>Gemeinsame Aufgaben des Vorstands.</p></div><div class="button-row">${canWrite("Aufgaben")?'<button id="newBoardTask" class="button primary small">+ Aufgabe</button>':""}<button id="boardTasksRefresh" class="button ghost small">Aktualisieren</button></div></div><div class="list-grid" style="margin-top:16px">${tasks.map(task=>`<article class="card task-card"><div class="entity-head"><div><div class="task-title">${escapeHtml(task.aufgabe)}</div><span class="subtle">${escapeHtml(task.team||"Vorstand")}</span></div>${statusBadge(task.status)}</div><div class="meta-grid"><div class="meta-item"><small>Verantwortlich</small>${escapeHtml(task.verantwortlich||"–")}</div><div class="meta-item"><small>Priorität</small>${escapeHtml(task.prioritaet||"Normal")}</div></div>${task.notiz?`<p>${escapeHtml(task.notiz)}</p>`:""}${canWrite("Aufgaben")?`<div class="button-row"><button class="button small primary" data-complete="${escapeAttr(task.id)}">${String(task.status||"").toUpperCase()==="OFFEN"?"Beginnen":"Erledigen"}</button></div>`:""}</article>`).join("")||empty("Keine offenen Vorstandsaufgaben.")}</div>`;
  document.getElementById("boardTasksRefresh")?.addEventListener("click",()=>renderTasks(true));
  document.getElementById("newBoardTask")?.addEventListener("click",()=>openTaskForm({},data.meta||{}));
  document.querySelectorAll("[data-complete]").forEach(button=>button.addEventListener("click",async()=>{const task=tasks.find(item=>String(item.id)===button.dataset.complete);if(!task)return;const next=String(task.status||"").toUpperCase()==="OFFEN"?"IN_BEARBEITUNG":"ERLEDIGT";await runWrite(next==="IN_BEARBEITUNG"?"Aufgabe wird begonnen …":"Aufgabe wird erledigt …",()=>call("apiSetTaskStatus",{id:task.id,revision:task.revision,status:next}));phase3State.remove(KEY+"tasks");await renderTasks(true);}));
}
function openTaskForm(task = {}, meta = {}) {
  const teams = meta.teamsDetailed || (meta.teams || []).map(name => ({ id: name, name }));
  const board = teams.find(team => String(team.id || "").toUpperCase() === "VORSTAND" || String(team.name || "").toLowerCase() === "vorstand") || { id: "VORSTAND", name: "Vorstand" };
  const options = (meta.verantwortlicheByTeam?.[board.id] || meta.verantwortlicheByTeam?.Vorstand || []).map(item => ({
    value: item.id || item.value,
    label: item.name || item.label || item.id || item.value
  }));

  openDialog({
    title: task.id ? "Vorstandsaufgabe bearbeiten" : "Vorstandsaufgabe anlegen",
    kicker: "Vorstand",
    body: `<form>
      <input type="hidden" name="id" value="${escapeAttr(task.id || "")}">
      <input type="hidden" name="revision" value="${escapeAttr(task.revision || "")}">
      <input type="hidden" name="ownNoteRevision" value="${escapeAttr(task.ownNoteRevision || "")}">
      <input type="hidden" name="teamId" value="${escapeAttr(board.id)}">
      <div class="form-grid">
        <label class="full">Aufgabe<input name="aufgabe" value="${escapeAttr(task.aufgabe || "")}" required></label>
        <label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten || ["NIEDRIG", "NORMAL", "HOCH", "EILT"], task.prioritaet || "NORMAL")}</select></label>
        <label>Status<select name="status">${optionList(meta.statusListe || ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT", "ARCHIVIERT"], task.status || "OFFEN")}</select></label>
        <label class="full">Verantwortlich<select name="verantwortlichId">${optionList(options, task.verantwortlichId || "", "Nicht zugewiesen")}</select></label>
        <label class="full">Notiz<textarea name="notiz">${escapeHtml(task.notiz || "")}</textarea></label>
        <div class="notice full">Zuweisbar sind ausschließlich die aktuellen fünf Amtsinhaber.</div>
      </div>
    </form>`,
    onSubmit: async data => {
      await runWrite("Aufgabe wird gespeichert …", () => call("apiSaveTask", data));
      closeDialog();
      phase3State.remove(KEY + "tasks");
      await renderTasks(true);
    }
  });
}

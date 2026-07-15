import {
  call, callBatch, closeDialog, confirmAction, empty, errorPanel, escapeAttr, escapeHtml, fmtDate,
  loading, normalize, openDialog, optionList, portal, runWrite, statusBadge, tabBar
} from "./common.js";
import { phase3State } from "./state.js";

const KEY = "teams:";
let activeTab = "overview";
function target(){ return document.getElementById("teamsPanel"); }
function setStatus(text,type="success"){ const el=document.getElementById("teamsStatus"); if(el){el.textContent=text;el.className=`status-pill ${type}`;} }
function requestedTab(){ const h=String(location.hash||""); return new URLSearchParams(h.includes("?")?h.slice(h.indexOf("?")+1):"").get("tab")||""; }
function setTab(tab){ const next=`#/teams?tab=${encodeURIComponent(tab)}`; if(location.hash===next) renderTab(tab); else location.hash=next; }
function tabs(){ const p=portal(); return [
  {id:"overview",label:"Teamübersicht",icon:"📋",show:true},
  {id:"mine",label:"Meine Teams",icon:"👥",show:true},
  {id:"manage",label:"Teammitglieder verwalten",icon:"🛠️",show:Boolean(p.teamLeader)||Boolean(p.teamAdmin)},
  {id:"functions",label:"Teamfunktionen",icon:"⚙️",show:Boolean(p.teamAdmin)}
].filter(x=>x.show); }
function renderTabs(){ const items=tabs(); if(!items.some(x=>x.id===activeTab))activeTab=items[0]?.id||"overview"; const el=document.getElementById("teamsTabs"); if(el){el.innerHTML=tabBar(items,activeTab,"teams");el.querySelectorAll('[data-module-tab="teams"]').forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));} }

async function prefetchTeams(){
  const calls=[];
  const available=tabs();
  if(!phase3State.has(KEY+"overview"))calls.push({id:"overview",functionName:"apiListPortalTeams",args:[]});
  if(available.some(item=>item.id==="manage"||item.id==="functions")&&!phase3State.has(KEY+"all"))calls.push({id:"all",functionName:"apiListTeams",args:[]});
  if(!calls.length)return;
  const bundle=await callBatch(calls);
  Object.entries(bundle?.results||{}).forEach(([id,value])=>phase3State.set(KEY+id,value));
}

export async function hydrateTeams(){ const req=requestedTab(); activeTab=tabs().some(x=>x.id===req)?req:(tabs()[0]?.id||"overview");renderTabs();await prefetchTeams();await renderTab(activeTab); }
async function renderTab(tab){activeTab=tabs().some(x=>x.id===tab)?tab:(tabs()[0]?.id||"overview");renderTabs();target().innerHTML=loading();setStatus("Daten werden geladen","warning");try{if(activeTab==="overview")await renderTeamOverview();if(activeTab==="mine")await renderOverview();if(activeTab==="manage")await renderManagement(false);if(activeTab==="functions")await renderManagement(true);setStatus("Live verbunden","success");}catch(error){target().innerHTML=errorPanel(error);setStatus("Fehler","warning");}}

async function workspaceData(force=false){let data=phase3State.get(KEY+"overview");if(!data||force)data=phase3State.set(KEY+"overview",await call("apiListPortalTeams"));return data||{teams:[]};}
async function renderTeamOverview(force=false){const data=await workspaceData(force);const teams=data.teams||[];target().innerHTML=`<div class="module-toolbar"><button id="refreshTeamOverview" class="button ghost">Aktualisieren</button></div><div class="list-grid">${teams.map(team=>`<article class="card entity-card"><div class="entity-head"><div><h3>${escapeHtml(team.name||"Team")}</h3><p>${escapeHtml(team.description||"Keine Beschreibung hinterlegt.")}</p></div><span class="badge neutral">${Number(team.memberCount)||0} Person(en)</span></div><div class="member-list">${(team.members||[]).map(member=>`<div class="member-line"><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.teamleiter?"Teamleiter":(member.role||"Mitglied"))}</span></div>`).join("")||empty("Keine aktiven Teammitglieder.")}</div></article>`).join("")||empty("Keine für dich sichtbaren aktiven Teams.")}</div>`;document.getElementById("refreshTeamOverview")?.addEventListener("click",()=>renderTeamOverview(true));}

async function renderOverview(force=false){const data=await workspaceData(force);const teams=data.teams||[];target().innerHTML=`<div class="module-toolbar"><button id="refreshMyTeams" class="button ghost">Aktualisieren</button></div><div class="list-grid">${teams.map(team=>`<article class="card entity-card"><div class="entity-head"><div><h3>${escapeHtml(team.name||"Team")}</h3><p>${escapeHtml(team.description||"Keine Beschreibung hinterlegt.")}</p></div><span class="badge ${team.isLeader?"success":"neutral"}">${escapeHtml(team.isLeader?"Teamleiter":(team.myRole||"Mitglied"))}</span></div><dl class="detail-list"><div><dt>Eigene Teamrolle</dt><dd>${escapeHtml(team.myRole||"Mitglied")}</dd></div><div><dt>Teamleitung</dt><dd>${team.isLeader?"Ja":"Nein"}</dd></div><div><dt>Aufgabenleitung</dt><dd>${team.isTaskLead?"Ja":"Nein"}</dd></div></dl></article>`).join("")||empty("Du bist aktuell keinem aktiven Team zugeordnet.")}</div>`;document.getElementById("refreshMyTeams")?.addEventListener("click",()=>renderOverview(true));}

async function renderTasks(force=false){let data=phase3State.get(KEY+"tasks");if(!data||force)data=phase3State.set(KEY+"tasks",await call("apiListMyTeamTasks",{status:"alle"}));const tasks=data.tasks||[];target().innerHTML=`<div class="module-toolbar"><input id="teamTaskSearch" class="grow" placeholder="Teamaufgabe suchen …"><select id="teamTaskStatus"><option value="offen">Offen</option><option value="alle">Alle</option><option value="erledigt">Erledigt</option></select><button id="newTeamTask" class="button primary">+ Aufgabe</button><button id="refreshTeamTasks" class="button ghost">Aktualisieren</button></div><div id="teamTaskResults"></div>`;const render=()=>{const q=normalize(document.getElementById("teamTaskSearch")?.value);const s=document.getElementById("teamTaskStatus")?.value||"offen";const list=tasks.filter(t=>(!q||normalize([t.aufgabe,t.team,t.verantwortlich,t.status].join(" ")).includes(q))&&(s==="alle"||(s==="offen"?!t.erledigt:!!t.erledigt)));document.getElementById("teamTaskResults").innerHTML=`<div class="list-grid">${list.map(t=>`<article class="card task-card ${normalize(t.prioritaet)==="dringend"?"priority-urgent":normalize(t.prioritaet)==="hoch"?"priority-high":""}"><div class="entity-head"><div><div class="task-title">${escapeHtml(t.aufgabe)}</div><span class="subtle">${escapeHtml(t.team||"Team")}</span></div>${statusBadge(t.status)}</div><div class="meta-grid"><div class="meta-item"><small>Verantwortlich</small>${escapeHtml(t.verantwortlich||"–")}</div><div class="meta-item"><small>Priorität</small>${escapeHtml(t.prioritaet||"Normal")}</div></div>${t.notiz?`<p>${escapeHtml(t.notiz)}</p>`:""}<div class="button-row"><button class="button small ghost" data-edit-team-task="${escapeAttr(t.id)}">Bearbeiten</button>${!t.erledigt?`<button class="button small primary" data-complete-team-task="${escapeAttr(t.id)}">${String(t.status||"").toUpperCase()==="OFFEN"?"Beginnen":"Erledigen"}</button>`:""}</div></article>`).join("")||empty("Keine Teamaufgaben gefunden.")}</div>`;document.querySelectorAll("[data-edit-team-task]").forEach(b=>b.addEventListener("click",()=>openTaskForm(tasks.find(t=>String(t.id)===b.dataset.editTeamTask),data.meta||{})));document.querySelectorAll("[data-complete-team-task]").forEach(b=>b.addEventListener("click",()=>completeTask(tasks.find(t=>String(t.id)===b.dataset.completeTeamTask))));};render();document.getElementById("teamTaskSearch")?.addEventListener("input",render);document.getElementById("teamTaskStatus")?.addEventListener("change",render);document.getElementById("newTeamTask")?.addEventListener("click",()=>openTaskForm({},data.meta||{}));document.getElementById("refreshTeamTasks")?.addEventListener("click",()=>renderTasks(true));}
function openTaskForm(task = {}, meta = {}) {
  const teams = meta.teamsDetailed || (meta.teams || []).map(name => ({ id: name, name }));
  const selectedTeam = task.teamId || teams[0]?.id || "";
  const optionsFor = teamId => (meta.verantwortlicheByTeam?.[teamId] || []).map(item => ({
    value: item.id || item.value,
    label: item.name || item.label || item.id || item.value
  }));

  openDialog({
    title: task.id ? "Aufgabe bearbeiten" : "Teamaufgabe anlegen",
    kicker: task.team || "Team",
    body: `<form>
      <input type="hidden" name="id" value="${escapeAttr(task.id || "")}">
      <input type="hidden" name="revision" value="${escapeAttr(task.revision || "")}">
      <input type="hidden" name="ownNoteRevision" value="${escapeAttr(task.ownNoteRevision || "")}">
      <div class="form-grid">
        <label class="full">Aufgabe<input name="aufgabe" value="${escapeAttr(task.aufgabe || "")}" required></label>
        <label>Team<select id="teamTaskTeam" name="teamId" required>${optionList(teams.map(t => ({ value: t.id, label: t.name })), selectedTeam, "Team auswählen")}</select></label>
        <label>Priorität<select name="prioritaet">${optionList(meta.prioritaeten || ["NIEDRIG", "NORMAL", "HOCH", "EILT"], task.prioritaet || "NORMAL")}</select></label>
        <label>Status<select name="status">${optionList(meta.statusListe || ["OFFEN", "IN_BEARBEITUNG", "ERLEDIGT", "ARCHIVIERT"], task.status || "OFFEN")}</select></label>
        <label class="full">Verantwortlich<select id="teamTaskResponsible" name="verantwortlichId">${optionList(optionsFor(selectedTeam), task.verantwortlichId || "", "Nicht zugewiesen")}</select></label>
        <label class="full">Notiz<textarea name="notiz">${escapeHtml(task.notiz || "")}</textarea></label>
        <div class="notice full">Aufgaben dürfen nur aktiven Mitgliedern des ausgewählten Teams zugewiesen werden.</div>
      </div>
    </form>`,
    onSubmit: async data => {
      await runWrite("Aufgabe wird gespeichert …", () => call("apiSaveTask", data));
      closeDialog();
      phase3State.remove(KEY + "tasks");
      await renderTasks(true);
    }
  });

  const teamSelect = document.getElementById("teamTaskTeam");
  const responsible = document.getElementById("teamTaskResponsible");
  teamSelect?.addEventListener("change", () => {
    if (responsible) responsible.innerHTML = optionList(optionsFor(teamSelect.value), "", "Nicht zugewiesen");
  });
}
async function completeTask(task){if(!task)return;const next=String(task.status||"").toUpperCase()==="OFFEN"?"IN_BEARBEITUNG":"ERLEDIGT";await runWrite(next==="IN_BEARBEITUNG"?"Aufgabe wird begonnen …":"Aufgabe wird erledigt …",()=>call("apiSetTaskStatus",{id:task.id,revision:task.revision,status:next}));phase3State.remove(KEY+"tasks");await renderTasks(true);}

async function teamData(force=false){let data=phase3State.get(KEY+"all");if(!data||force)data=phase3State.set(KEY+"all",await call("apiListTeams"));return data||{teams:[],meta:{}};}
async function renderManagement(adminMode,force=false){const data=await teamData(force);const teams=data.teams||[];const visible=adminMode?teams:teams.filter(t=>t.canManage!==false&&t.aktiv==="JA");const active=visible.filter(t=>t.aktiv==="JA"),inactive=visible.filter(t=>t.aktiv!=="JA");target().innerHTML=`<div class="module-toolbar">${adminMode?'<button id="newTeam" class="button primary">+ Team</button>':""}<button id="refreshTeamManagement" class="button ghost">Aktualisieren</button></div><div class="grid two">${teamCards(active,adminMode,false)||empty("Keine aktiven Teams.")}</div>${adminMode&&inactive.length?`<article class="card"><h3>Deaktivierte Teams</h3><div class="grid two" style="margin-top:14px">${teamCards(inactive,true,true)}</div></article>`:""}`;bindTeamCardActions(teams,data.meta||{},adminMode);document.getElementById("newTeam")?.addEventListener("click",()=>openTeamForm({},data.meta||{},adminMode));document.getElementById("refreshTeamManagement")?.addEventListener("click",()=>renderManagement(adminMode,true));}
function teamCards(list,adminMode,inactive){return list.map(team=>`<article class="card entity-card"><div class="entity-head"><div><h3>${escapeHtml(team.name)}</h3><span class="subtle">${escapeHtml(team.id||"")} · ${Number(team.memberCount)||0} Person(en)</span></div>${statusBadge(team.aktiv)}</div><p>${escapeHtml(team.beschreibung||"Keine Beschreibung.")}</p><div class="button-row"><button class="button small primary" data-team-details="${escapeAttr(team.id)}">Personen</button><button class="button small ghost" data-team-edit="${escapeAttr(team.id)}">Bearbeiten</button><button class="button small secondary" data-team-add-member="${escapeAttr(team.id)}">Benutzer dazu</button>${adminMode?`<button class="button small ${inactive?"secondary":"danger"}" data-team-toggle="${escapeAttr(team.id)}" data-revision="${escapeAttr(team.revision || 0)}" data-active="${inactive?"true":"false"}">${inactive?"Aktivieren":"Deaktivieren"}</button>`:""}</div></article>`).join("");}
function bindTeamCardActions(teams,meta,adminMode){document.querySelectorAll("[data-team-details]").forEach(b=>b.addEventListener("click",()=>openTeamDetails(b.dataset.teamDetails,meta,adminMode)));document.querySelectorAll("[data-team-edit]").forEach(b=>b.addEventListener("click",()=>openTeamForm(teams.find(t=>t.id===b.dataset.teamEdit)||{},meta,adminMode)));document.querySelectorAll("[data-team-add-member]").forEach(b=>b.addEventListener("click",()=>openTeamMemberForm({},b.dataset.teamAddMember,teams,meta,adminMode)));document.querySelectorAll("[data-team-toggle]").forEach(b=>b.addEventListener("click",()=>toggleTeam(b.dataset.teamToggle,b.dataset.active==="true",Number(b.dataset.revision),adminMode)));}
async function openTeamDetails(teamId, meta, adminMode) {
  const data = await call("apiGetTeamDetails", teamId);
  const team = data.team || {};
  const members = data.members || [];

  openDialog({
    title: `Team: ${team.name || teamId}`,
    kicker: `${members.length} Person(en)`,
    wide: true,
    body: `<div class="module-toolbar"><button id="addMemberFromDetails" class="button primary">+ Benutzer dazu</button></div>
      ${members.length ? `<div class="card table-card"><div class="data-table-wrap"><table class="data-table">
        <thead><tr><th>Name</th><th>Rolle</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>${members.map(member => `<tr>
          <td><strong>${escapeHtml(member.name)}</strong></td>
          <td>${escapeHtml(member.teamrolle || "Mitglied")}</td>
          <td>${statusBadge(member.aktiv)}</td>
          <td><div class="button-row">
            <button class="button small ghost" data-edit-team-member="${escapeAttr(member.id)}">Bearbeiten</button>
            <button class="button small ${member.aktiv === "JA" ? "danger" : "secondary"}" data-toggle-team-member="${escapeAttr(member.id)}" data-revision="${escapeAttr(member.revision || 0)}" data-active="${member.aktiv === "JA" ? "false" : "true"}">${member.aktiv === "JA" ? "Deaktivieren" : "Aktivieren"}</button>
          </div></td>
        </tr>`).join("")}</tbody>
      </table></div></div>` : empty("Noch keine Personen zugeordnet.")}
      <div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`
  });

  document.getElementById("addMemberFromDetails")?.addEventListener("click", () =>
    openTeamMemberForm({}, teamId, phase3State.get(KEY + "all")?.teams || [], meta, adminMode)
  );
  document.querySelectorAll("[data-edit-team-member]").forEach(button => button.addEventListener("click", () =>
    openTeamMemberForm(members.find(member => member.id === button.dataset.editTeamMember) || {}, teamId, phase3State.get(KEY + "all")?.teams || [], meta, adminMode)
  ));
  document.querySelectorAll("[data-toggle-team-member]").forEach(button => button.addEventListener("click", async () => {
    const active = button.dataset.active === "true";
    await runWrite(active ? "Teammitglied wird aktiviert …" : "Teammitglied wird deaktiviert …", () => call("apiSetTeamMemberActive", button.dataset.toggleTeamMember, active, Number(button.dataset.revision)));
    phase3State.remove(KEY + "all");
    phase3State.remove(KEY + "overview");
    phase3State.remove(KEY + "tasks");
    closeDialog();
    await renderManagement(adminMode, true);
    await openTeamDetails(teamId, meta, adminMode);
  }));
}
function openTeamForm(team={},meta={},adminMode=false){openDialog({title:team.id?"Team bearbeiten":"Team anlegen",kicker:team.id||"Neues Team",body:`<form><input type="hidden" name="id" value="${escapeAttr(team.id||"")}"><input type="hidden" name="revision" value="${escapeAttr(team.revision||"")}"><div class="form-grid"><label>Teamname<input name="name" value="${escapeAttr(team.name||"")}" required></label><label>Aktiv<select name="aktiv">${optionList(["JA","NEIN"],team.aktiv||"JA")}</select></label><label>Sortierung<input name="sortierung" inputmode="numeric" value="${escapeAttr(team.sortierung||"")}"></label><label class="full">Beschreibung<textarea name="beschreibung">${escapeHtml(team.beschreibung||"")}</textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Team wird gespeichert …",()=>call("apiSaveTeam",data));closeDialog();phase3State.remove(KEY+"all");phase3State.remove(KEY+"overview");await renderManagement(adminMode,true);}});}
async function loadMemberOptions(teamId){const result=await call("apiListTeamMemberOptions",teamId);return result.members||[];}
async function openTeamMemberForm(member={},teamId,teams,meta,adminMode){const options=await loadMemberOptions(teamId);openDialog({title:member.id?"Teamzuordnung bearbeiten":"Benutzer zu Team",kicker:teamId,body:`<form><input type="hidden" name="id" value="${escapeAttr(member.id||"")}"><input type="hidden" name="revision" value="${escapeAttr(member.revision||"")}"><input type="hidden" name="aktiv" value="${escapeAttr(member.aktiv||"JA")}"><div class="form-grid"><label>Team<select name="teamId" required>${optionList((teams||[]).filter(t=>t.aktiv==="JA").map(t=>({value:t.id,label:t.name})),member.teamId||teamId,"Team auswählen")}</select></label><label>Benutzer<select name="benutzerId" required>${optionList(options.map(m=>({value:m.id,label:`${m.name}${m.mitgliedsId?" · Mitglied":" · Portaluser"}`})),member.benutzerId||member.mitgliedsId||"","Benutzer auswählen")}</select></label><label>Teamrolle<select name="teamrolle">${optionList(meta.teamRollen||["MITGLIED","CO_TEAMLEITER","TEAMLEITER"],member.teamrolle||"MITGLIED")}</select></label><label class="check-row"><input type="checkbox" name="teamleiter" ${member.teamleiter?"checked":""}> Teamleiter</label><label class="check-row full"><input type="checkbox" name="aufgabenleitung" ${member.aufgabenleitung?"checked":""}> Bei Aufgaben bevorzugen</label><label class="full">Bemerkung<textarea name="bemerkung">${escapeHtml(member.bemerkung||"")}</textarea></label></div>${member.id?`<div class="danger-zone card" style="margin-top:16px"><p>Nur diese Teamzuordnung wird entfernt.</p><button id="removeTeamMember" class="button danger" type="button">Aus Team entfernen</button></div>`:""}</form>`,onSubmit:async data=>{await runWrite("Teammitglied wird gespeichert …",()=>call("apiSaveTeamMember",data));closeDialog();phase3State.remove(KEY+"all");phase3State.remove(KEY+"overview");phase3State.remove(KEY+"tasks");await renderManagement(adminMode,true);}});document.getElementById("removeTeamMember")?.addEventListener("click",async()=>{if(!await confirmAction({title:"Aus Team entfernen",message:"Diese Teamzuordnung wirklich entfernen?",confirmText:"Entfernen"}))return;await runWrite("Teamzuordnung wird entfernt …",()=>call("apiRemoveTeamMember",member.id,member.revision));closeDialog();phase3State.remove(KEY+"all");phase3State.remove(KEY+"overview");await renderManagement(adminMode,true);});}
async function toggleTeam(id,active,revision,adminMode){await runWrite(active?"Team wird aktiviert …":"Team wird deaktiviert …",()=>call("apiSetTeamActive",id,active,revision));phase3State.remove(KEY+"all");await renderManagement(adminMode,true);}
async function deleteTeam(){ throw new Error("Teams werden in R7.1 nicht physisch gelöscht. Bitte deaktivieren."); }

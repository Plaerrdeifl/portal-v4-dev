import { auth } from "../auth.js";
import {
  call, canRead, canWrite, closeDialog, confirmAction, empty, errorPanel, escapeAttr,
  escapeHtml, fmtDate, isAdmin, loading, openDialog, optionList, runWrite, showToast, statusBadge
} from "./common.js";
import { phase3State } from "./state.js";

function target(){return document.getElementById("adminPanel");}
function setStatus(text,type="success"){const el=document.getElementById("adminStatus");if(el){el.textContent=text;el.className=`status-pill ${type}`;}}

export async function hydrateAdmin(){setStatus("Adminzugriff bestätigt","success");renderAdminHome();}
function action(id,icon,title,text){return `<button class="admin-action" type="button" data-admin-action="${escapeAttr(id)}"><strong>${icon} ${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></button>`;}
function renderAdminHome(){
  const fan=[];const portal=[];
  if(canWrite("Verwaltung")&&canWrite("Beiträge"))fan.push(action("season","📅","Neue Saison starten","Legt die Beiträge für eine neue Saison an."));
  if(canWrite("Verwaltung")&&canWrite("Kasse"))fan.push(action("yearclose","📊","Jahresabschluss","Erstellt die finanzielle Jahreszusammenfassung."));
  if(canRead("Konten"))fan.push(action("accounttypes","🏷️","Kontotypen","Kontotypen für die Finanzverwaltung anlegen und verwalten."));
  if(canWrite("Verwaltung"))fan.push(action("datacheck","✓","Datenprüfung","Prüft die fachliche Datenstruktur."));
  if(canRead("Benutzeranträge"))portal.push(action("requests","✉️","Freischaltungsanträge","Unbekannte Google-Konten prüfen und freigeben."));
  if(canRead("Rollen"))portal.push(
    action("users","👤","Benutzer","Benutzerkonten, Rolle und Google-Verknüpfung verwalten."),
    action("rights","🔐","Rollen & Rechte","Lesen, Schreiben und Administration je Rolle und Fachbereich einstellen.")
  );
  if(canWrite("Verwaltung"))portal.push(action("backup","💾","Backup","Erstellt einen Snapshot aller aktiven DB_-Tabellen."));
  if(canRead("System"))portal.push(action("system","⚙️","Systemstatus","Zeigt Tabellenstatus und technische Hinweise."),action("audit","☷","Audit-Log","Zeigt nachvollziehbare Änderungen und Ereignisse."));
  if(isAdmin())portal.push(
    action("structure","🧭","Portalstruktur","Hauptnavigation, Reihenfolge, Symbole und Rollensichtbarkeit."),
    action("widgets","📊","Dashboard verwalten","Widgets, Reihenfolge, Größe und Rollen einstellen."),
    action("appearance","🎨","Portal & Startseite","Portalname, öffentliche Texte, Logo und Grundfarbe."),
    action("clean","🧹","Grundsystem herstellen","Sicherheitsgeschützte Bereinigung auf den definierten Produktivstand.")
  );
  target().innerHTML=`<section><div class="section-title"><div><h3>Fanclubverwaltung</h3><p>Saison, Jahresabschluss und fachliche Prüfungen.</p></div></div><div class="admin-actions" style="margin-top:14px">${fan.join("")||empty("Keine Fanclub-Administrationsfunktionen freigegeben.")}</div></section><section><div class="section-title"><div><h3>Portalverwaltung</h3><p>Benutzer, Rechte, Sicherung und technischer Status.</p></div></div><div class="admin-actions" style="margin-top:14px">${portal.join("")||empty("Keine Portalverwaltungsfunktionen freigegeben.")}</div></section><article class="card"><h3>v3-Abgrenzung</h3><p>Bus-Modul und Push-Benachrichtigungen werden bewusst nicht in v3 umgesetzt. Die PWA-Struktur bleibt dafür in v4 erweiterbar.</p></article>`;
  document.querySelectorAll("[data-admin-action]").forEach(b=>b.addEventListener("click",()=>runAction(b.dataset.adminAction)));
}
async function runAction(id){try{if(id==="season")return seasonDialog();if(id==="yearclose")return yearCloseDialog();if(id==="accounttypes")return openAccountTypes();if(id==="datacheck")return runDataCheck();if(id==="requests")return openRequests();if(id==="users")return openUsers();if(id==="rights")return openRoleRights();if(id==="backup")return createBackup();if(id==="system")return openSystem();if(id==="audit")return openAudit();if(id==="structure")return openPortalStructure();if(id==="widgets")return openDashboardWidgets();if(id==="appearance")return openPortalAppearance();if(id==="clean")return openCleanSystem();}catch(error){target().innerHTML=errorPanel(error);}}
function seasonDialog(){openDialog({title:"Neue Saison starten",kicker:"Fanclubverwaltung",body:`<form><label>Saison/Jahr<input name="seasonName" value="${new Date().getFullYear()+1}" required></label><div class="notice warning" style="margin-top:14px">Für beitragspflichtige Mitglieder werden Beiträge angelegt. Bestehende Saisonwerte werden serverseitig geprüft.</div></form>`,onSubmit:async data=>{await runWrite("Neue Saison wird angelegt …",()=>call("apiStartNewSeason",data.seasonName));closeDialog();}});}
function yearCloseDialog(){openDialog({title:"Jahresabschluss",kicker:"Fanclubverwaltung",body:`<form><label>Jahr<input type="number" name="year" value="${new Date().getFullYear()}" required></label></form>`,onSubmit:async data=>{await runWrite("Jahresabschluss wird erstellt …",()=>call("apiCreateYearClose",Number(data.year)));closeDialog();}});}
async function runDataCheck(){const result=await runWrite("Datenprüfung läuft …",()=>call("apiRunDataCheck"),"Datenprüfung abgeschlossen.");openDialog({title:"Datenprüfung",kicker:`${Number(result.count||0)} Hinweis(e)`,wide:true,body:`${result.issues?.length?`<div class="settings-grid">${result.issues.map(issue=>`<div class="card"><strong>${escapeHtml(issue[0]||"Hinweis")} · ${escapeHtml(issue[1]||"")}</strong><p>${escapeHtml(issue[2]||"")}</p></div>`).join("")}</div>`:'<div class="notice success">Keine fachlichen Probleme gefunden.</div>'}<div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});}

async function openUsers(force=false){let data=phase3State.get("admin:roles");if(!data||force)data=phase3State.set("admin:roles",await call("apiListRoles"));const users=data.roles||[];const roleNames=data.meta?.rollen||[];openDialog({title:"Benutzer",kicker:`${users.length} Benutzer`,wide:true,body:`<div class="module-toolbar"><input id="adminUserSearch" class="grow" placeholder="Benutzer suchen …">${canWrite("Rollen")?'<button id="adminNewUser" class="button primary">+ Benutzer</button>':""}<button id="adminUsersRefresh" class="button ghost">Aktualisieren</button></div><div id="adminUserResults" style="margin-top:16px"></div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});const render=()=>{const q=String(document.getElementById("adminUserSearch")?.value||"").toLowerCase();const list=users.filter(u=>!q||[u.id,u.name,u.email,u.rolle,u.mitgliedsId].join(" ").toLowerCase().includes(q));document.getElementById("adminUserResults").innerHTML=list.length?`<div class="card table-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Benutzer</th><th>Rolle</th><th>Google</th><th>Status</th><th></th></tr></thead><tbody>${list.map(u=>`<tr><td><strong>${escapeHtml(u.name||u.email||u.id)}</strong><div class="subtle">${escapeHtml(u.id)}${u.mitgliedsId?` · ${escapeHtml(u.mitgliedsId)}`:""}</div></td><td>${escapeHtml(u.rolle)}</td><td>${u.googleVerknuepft?'<span class="badge success">Verbunden</span>':'<span class="badge neutral">Nicht verbunden</span>'}</td><td>${statusBadge(u.aktiv)}</td><td>${canWrite("Rollen")?`<div class="button-row"><button class="button small ghost" data-user-edit="${escapeAttr(u.id)}">Bearbeiten</button><button class="button small ${u.aktiv==="JA"?"danger":"secondary"}" data-user-toggle="${escapeAttr(u.id)}" data-active="${u.aktiv==="JA"?"false":"true"}">${u.aktiv==="JA"?"Deaktivieren":"Aktivieren"}</button>${u.googleVerknuepft?`<button class="button small ghost" data-user-unlink="${escapeAttr(u.id)}">Google lösen</button>`:""}</div>`:""}</td></tr>`).join("")}</tbody></table></div></div>`:empty("Keine Benutzer gefunden.");document.querySelectorAll("[data-user-edit]").forEach(b=>b.addEventListener("click",()=>openUserForm(users.find(u=>u.id===b.dataset.userEdit),roleNames,data.meta||{})));document.querySelectorAll("[data-user-toggle]").forEach(b=>b.addEventListener("click",()=>toggleUser(b.dataset.userToggle,b.dataset.active==="true")));document.querySelectorAll("[data-user-unlink]").forEach(b=>b.addEventListener("click",()=>unlinkUser(b.dataset.userUnlink)));};render();document.getElementById("adminUserSearch")?.addEventListener("input",render);document.getElementById("adminNewUser")?.addEventListener("click",()=>openUserForm({},roleNames,data.meta||{}));document.getElementById("adminUsersRefresh")?.addEventListener("click",()=>{closeDialog();phase3State.remove("admin:roles");openUsers(true);});}
function openUserForm(user={},roles=[],meta={}){
  const members=(meta.members||[]).map(item=>({value:item.id||item.value,label:item.name||item.label||item.id||item.value}));
  const selectedOffice=(user.officeSlots||[])[0]||"";
  const officeOptions=(meta.officeSlots||[]).map(slot=>({
    value:slot.code,
    label:`${slot.label}${slot.memberId&&slot.memberId!==user.mitgliedsId?` · belegt durch ${slot.memberName||slot.memberId}`:""}`,
    disabled:Boolean(slot.memberId&&slot.memberId!==user.mitgliedsId)
  }));
  const officeHtml=[`<option value="">Kein Amt</option>`].concat(officeOptions.map(item=>`<option value="${escapeAttr(item.value)}" ${item.value===selectedOffice?"selected":""} ${item.disabled?"disabled":""}>${escapeHtml(item.label)}</option>`)).join("");
  openDialog({
    title:user.id?"Benutzer bearbeiten":"Benutzer anlegen",
    kicker:user.id||"Neues Benutzerkonto",
    body:`<form><input type="hidden" name="id" value="${escapeAttr(user.id||"")}"><div class="form-grid"><label>Vorname<input name="vorname" value="${escapeAttr(user.vorname||"")}"></label><label>Nachname<input name="nachname" value="${escapeAttr(user.nachname||"")}"></label><label class="full">Anzeigename<input name="name" value="${escapeAttr(user.name||"")}"></label><label>Google-E-Mail<input type="email" name="email" value="${escapeAttr(user.email||"")}"></label><label>Mitglied<select name="mitgliedsId">${optionList(members,user.mitgliedsId||"","Keine Mitgliedsverknüpfung")}</select></label><label>Portalrolle<select name="rolle">${optionList(roles,user.rolle||roles[0],"Rolle auswählen")}</select></label><label>Aktiv<select name="aktiv">${optionList(["JA","NEIN"],user.aktiv||"JA")}</select></label><label>Fester Amtsplatz<select name="officeSlot">${officeHtml}</select></label><label class="full">Bemerkung<textarea name="bemerkung">${escapeHtml(user.bemerkung||"")}</textarea></label><div class="notice full"><strong>R7.1:</strong> Ein Benutzer besitzt genau eine Portalrolle. Ein fester Amtsplatz ist nur mit einer Mitgliedsverknüpfung möglich.</div></div></form>`,
    onSubmit:async data=>{
      data.officeSlots=data.officeSlot?[data.officeSlot]:[];
      delete data.officeSlot;
      await runWrite("Benutzer wird gespeichert …",()=>call("apiSaveRole",data));
      closeDialog();phase3State.remove("admin:roles");openUsers(true);
    }
  });
}
async function toggleUser(id,active){await runWrite(active?"Benutzer wird aktiviert …":"Benutzer wird deaktiviert …",()=>call("apiSetRoleActive",id,active));closeDialog();phase3State.remove("admin:roles");openUsers(true);}
async function unlinkUser(id){if(!await confirmAction({title:"Google-Verknüpfung lösen",message:"Der Benutzer muss sich danach erneut mit dem hinterlegten Google-Konto verbinden.",confirmText:"Verknüpfung lösen"}))return;await runWrite("Google-Verknüpfung wird gelöst …",()=>call("apiResetGoogleLink",id));closeDialog();phase3State.remove("admin:roles");openUsers(true);}

async function openRequests(){const data=await call("apiListAccessRequests",{status:"alle"});const rows=data.requests||[];openDialog({title:"Freischaltungsanträge",kicker:`${rows.length} Antrag/Anträge`,wide:true,body:rows.length?`<div class="settings-grid">${rows.map(r=>`<article class="card"><div class="entity-head"><div><h3>${escapeHtml(r.name||r.email||r.id)}</h3><span class="subtle">${escapeHtml(r.email||"")} · ${escapeHtml(fmtDate(r.antragAm))}</span></div>${statusBadge(r.status)}</div><div class="button-row" style="margin-top:14px">${canWrite("Benutzeranträge")&&String(r.status).toLowerCase()==="offen"?`<button class="button small primary" data-request-approve="${escapeAttr(r.id)}">Freigeben</button><button class="button small danger" data-request-reject="${escapeAttr(r.id)}">Ablehnen</button>`:""}</div></article>`).join("")}</div>`:empty("Keine Freischaltungsanträge vorhanden.")});document.querySelectorAll("[data-request-approve]").forEach(b=>b.addEventListener("click",()=>approveRequest(rows.find(r=>r.id===b.dataset.requestApprove),data.meta||{})));document.querySelectorAll("[data-request-reject]").forEach(b=>b.addEventListener("click",()=>rejectRequest(b.dataset.requestReject)));}
function approveRequest(request,meta){openDialog({title:"Benutzer freigeben",kicker:request.email||request.id,body:`<form><input type="hidden" name="antragId" value="${escapeAttr(request.id)}"><div class="form-grid"><label>Rolle<select name="rolle">${optionList(meta.roles||[],"","Rolle auswählen")}</select></label><label>Mitglieds-ID<select name="mitgliedsId">${optionList(meta.members||[],"","Keine Verknüpfung")}</select></label><label class="full">Bemerkung<textarea name="bemerkung"></textarea></label></div></form>`,onSubmit:async data=>{await runWrite("Antrag wird freigegeben …",()=>call("apiApproveAccessRequest",data));closeDialog();openRequests();}});}
async function rejectRequest(id){if(!await confirmAction({title:"Antrag ablehnen",message:"Der Freischaltungsantrag wird abgelehnt.",confirmText:"Ablehnen"}))return;await runWrite("Antrag wird abgelehnt …",()=>call("apiRejectAccessRequest",{antragId:id,bemerkung:"Über PWA abgelehnt"}));closeDialog();openRequests();}

async function openAccountTypes(){
  const data=await call("apiListAccountTypes");
  const rows=data.types||[];
  openDialog({title:"Kontotypen",kicker:`${rows.length} Typ(en)`,wide:true,body:`<div class="module-toolbar">${isAdmin()?'<button id="newAccountType" class="button primary">+ Kontotyp</button>':""}<button id="refreshAccountTypes" class="button ghost">Aktualisieren</button></div><div class="settings-grid" style="margin-top:16px">${rows.map(item=>`<article class="card"><div class="entity-head"><div><h3>${escapeHtml(item.name)}</h3><span class="subtle">${escapeHtml(item.id)}</span></div>${statusBadge(item.aktiv)}</div><p>${escapeHtml(item.bemerkung||"")}</p>${isAdmin()?`<div class="button-row"><button class="button small ghost" data-account-type-edit="${escapeAttr(item.id)}">Bearbeiten</button><button class="button small ${item.aktiv==="JA"?"danger":"secondary"}" data-account-type-toggle="${escapeAttr(item.id)}" data-active="${item.aktiv==="JA"?"false":"true"}">${item.aktiv==="JA"?"Deaktivieren":"Aktivieren"}</button></div>`:""}</article>`).join("")||empty("Keine Kontotypen vorhanden.")}</div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});
  document.getElementById("newAccountType")?.addEventListener("click",()=>openAccountTypeForm({}));
  document.getElementById("refreshAccountTypes")?.addEventListener("click",()=>{closeDialog();openAccountTypes();});
  document.querySelectorAll("[data-account-type-edit]").forEach(button=>button.addEventListener("click",()=>openAccountTypeForm(rows.find(item=>item.id===button.dataset.accountTypeEdit)||{})));
  document.querySelectorAll("[data-account-type-toggle]").forEach(button=>button.addEventListener("click",async()=>{await runWrite("Kontotyp wird aktualisiert …",()=>call("apiSetAccountTypeActive",button.dataset.accountTypeToggle,button.dataset.active==="true"));closeDialog();await openAccountTypes();}));
}
function openAccountTypeForm(item={}){
  openDialog({title:item.id?"Kontotyp bearbeiten":"Kontotyp anlegen",kicker:item.id||"Neuer Kontotyp",body:`<form><input type="hidden" name="id" value="${escapeAttr(item.id||"")}"><div class="form-grid"><label class="full">Name<input name="name" value="${escapeAttr(item.name||"")}" required></label><label>Sortierung<input type="number" name="sortierung" value="${escapeAttr(item.sortierung||0)}"></label><label>Aktiv<select name="aktiv">${optionList(["JA","NEIN"],item.aktiv||"JA")}</select></label><label class="full">Bemerkung<textarea name="bemerkung">${escapeHtml(item.bemerkung||"")}</textarea></label></div></form>`,onSubmit:async form=>{await runWrite("Kontotyp wird gespeichert …",()=>call("apiSaveAccountType",form));closeDialog();await openAccountTypes();}});
}

async function createBackup(){const result=await runWrite("Backup wird erstellt …",()=>call("apiCreateBackup"),"Backup wurde erstellt.");openDialog({title:"Backup abgeschlossen",kicker:"Portalverwaltung",body:`<div class="notice success">${escapeHtml(result.message||"Backup wurde erstellt.")}</div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});}
async function openSystem(){const data=await call("apiGetSystemStatus");openDialog({title:"Systemstatus",kicker:data.message||"DB_-Status",wide:true,body:`${data.warnings?.length?`<div class="notice warning">${data.warnings.map(escapeHtml).join("<br>")}</div>`:'<div class="notice success">Keine technischen Warnungen.</div>'}<div class="card table-card" style="margin-top:16px"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Tabelle</th><th>Status</th><th>Datenzeilen</th><th>Physische Zeilen</th></tr></thead><tbody>${(data.sheets||[]).map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${statusBadge(s.status)}</td><td>${Number(s.effectiveRows||0)}</td><td>${Number(s.physicalRows||0)}</td></tr>`).join("")}</tbody></table></div></div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});}
async function openAudit(){const data=await call("apiListAuditLog",{max:200});const rows=data.entries||data.logs||data.items||[];openDialog({title:"Audit-Log",kicker:`${rows.length} Einträge`,wide:true,body:rows.length?`<div class="card table-card"><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Zeit</th><th>Aktion</th><th>Bereich</th><th>Benutzer</th><th>Details</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.zeitpunkt||r.timestamp||"")}</td><td>${escapeHtml(r.aktion||r.action||"")}</td><td>${escapeHtml(r.bereich||r.area||"")}</td><td>${escapeHtml(r.benutzer||r.user||"")}</td><td>${escapeHtml(r.bemerkung||r.details||"")}</td></tr>`).join("")}</tbody></table></div></div>`:empty("Noch keine Audit-Einträge vorhanden.")});}
async function openCleanSystem(){const preview=await call("apiGetCleanSystemPreview");openDialog({title:"Grundsystem herstellen",kicker:preview.ready?"Bereit":"Sicherheitsabbruch",wide:true,body:`<div class="notice ${preview.ready?"warning":"error"}">${escapeHtml(preview.message||"")}</div><div class="grid three" style="margin-top:16px"><article class="card"><h3>Erhaltene Google-Benutzer</h3><strong>${Number(preview.googleLinkedCount||preview.linkedUsers?.length||0)}</strong></article><article class="card"><h3>Zielrollen</h3><strong>${Number(preview.targetRoles?.length||7)}</strong></article><article class="card"><h3>Konten / Teams</h3><strong>5 / 3</strong></article></div>${preview.ready?`<form id="cleanSystemForm" style="margin-top:16px"><label>Bestätigungstext<input name="confirmation" autocomplete="off" placeholder="GRUNDSYSTEM HERSTELLEN" required></label><label class="check-row" style="margin-top:14px"><input type="checkbox" name="secondConfirmation"> Automatisches Backup und endgültige Bereinigung bestätigen</label><div class="dialog-actions"><button class="button ghost" data-dialog-close type="button">Abbrechen</button><button class="button danger" type="submit">Grundsystem herstellen</button></div></form>`:'<div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>'}`});const form=document.getElementById("cleanSystemForm");form?.addEventListener("submit",async event=>{event.preventDefault();const confirmation=form.elements.confirmation.value;const secondConfirmation=form.elements.secondConfirmation.checked;if(confirmation!=="GRUNDSYSTEM HERSTELLEN"||!secondConfirmation){throw new Error("Bestätigung ist unvollständig.");}if(!await confirmAction({title:"Letzte Sicherheitsabfrage",message:"Alle Bewegungs- und Testdaten werden nach einem Backup gelöscht.",confirmText:"Endgültig ausführen",phrase:"JETZT BEREINIGEN"}))return;await runWrite("Grundsystem wird hergestellt …",()=>call("apiResetToCleanSystem",{confirmation,secondConfirmation}));closeDialog();location.reload();});}


function roleChecks(roles, selected, name="roles"){
  const selectedKeys=(selected||[]).map(value=>String(value||"").toLowerCase());
  return `<div class="role-check-grid">${(roles||[]).map(role=>`<label class="check-row"><input type="checkbox" name="${escapeAttr(name)}" value="${escapeAttr(role)}" ${selectedKeys.includes(String(role).toLowerCase())?"checked":""}> ${escapeHtml(role)}</label>`).join("")}</div>`;
}

async function openPortalStructure(){
  const data=await call("apiGetPortalAdminConfig");
  const items=(data.appNavigation||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  openDialog({title:"Portalstruktur",kicker:"Portalverwaltung",wide:true,body:`<div class="notice success">Sichtbarkeit und Darstellung sind konfigurierbar. Die fachliche Zugriffskontrolle bleibt zusätzlich serverseitig geschützt.</div><div class="settings-grid" style="margin-top:16px">${items.map(item=>`<article class="card settings-row portal-structure-row"><div><strong>${escapeHtml(item.icon||"•")} ${escapeHtml(item.label||item.key)}</strong><div class="subtle">${escapeHtml(item.description||"")}</div></div><div><span class="badge ${item.active?"success":"neutral"}">${item.active?"Aktiv":"Inaktiv"}</span></div><div>Position ${Number(item.order||0)}</div><div>${(item.roles||[]).length?escapeHtml(item.roles.join(", ")):"Alle berechtigten Rollen"}</div><button class="button small ghost" data-edit-nav="${escapeAttr(item.key)}">Bearbeiten</button></article>`).join("")}</div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});
  document.querySelectorAll("[data-edit-nav]").forEach(button=>button.addEventListener("click",()=>openNavigationItem(items.find(item=>item.key===button.dataset.editNav),data.roles||[])));
}
function openNavigationItem(item,roles){
  openDialog({title:"Navigationsbereich bearbeiten",kicker:item.label||item.key,body:`<form><input type="hidden" name="key" value="${escapeAttr(item.key)}"><div class="form-grid"><label>Bezeichnung<input name="label" value="${escapeAttr(item.label||"")}" required></label><label>Symbol<input name="icon" value="${escapeAttr(item.icon||"")}" maxlength="8"></label><label>Reihenfolge<input type="number" name="order" min="1" max="9999" value="${Number(item.order||10)}"></label><label>Aktiv<select name="active">${optionList([{value:"true",label:"Ja"},{value:"false",label:"Nein"}],String(item.active))}</select></label><label class="full">Beschreibung<input name="description" value="${escapeAttr(item.description||"")}"></label><div class="full"><strong>Sichtbar für Rollen</strong><p class="subtle">Leer bedeutet: alle Benutzer, die den serverseitigen Sicherheitsvertrag erfüllen.</p>${roleChecks(roles,item.roles)}</div></div></form>`,onSubmit:async form=>{form.active=String(form.active)==="true";await runWrite("Portalstruktur wird gespeichert …",()=>call("apiSavePortalNavigationItem",form));closeDialog();await openPortalStructure();}});
}

async function openDashboardWidgets(){
  const data=await call("apiGetDashboardAdminConfig");
  const widgets=(data.widgets||[]).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  openDialog({title:"Dashboard verwalten",kicker:"Widget-Konfiguration",wide:true,body:`<div class="notice success">Neue v4-Module können später eigene Widgets registrieren, ohne das Dashboard umzubauen.</div><div class="settings-grid" style="margin-top:16px">${widgets.map(widget=>`<article class="card settings-row dashboard-config-row"><div><strong>${escapeHtml(widget.icon||"•")} ${escapeHtml(widget.label||widget.key)}</strong><div class="subtle">${escapeHtml(widget.description||"")}</div></div><div><span class="badge ${widget.active?"success":"neutral"}">${widget.active?"Aktiv":"Inaktiv"}</span></div><div>Position ${Number(widget.order||0)} · ${escapeHtml(widget.size||"M")}</div><div>${escapeHtml((widget.roles||[]).join(", "))}</div><button class="button small ghost" data-edit-widget="${escapeAttr(widget.key)}">Bearbeiten</button></article>`).join("")}</div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`});
  document.querySelectorAll("[data-edit-widget]").forEach(button=>button.addEventListener("click",()=>openWidgetItem(widgets.find(widget=>widget.key===button.dataset.editWidget),data.roles||[],data.sizes||["S","M","L"])));
}
function openWidgetItem(widget,roles,sizes){
  openDialog({title:"Dashboard-Widget bearbeiten",kicker:widget.label||widget.key,body:`<form><input type="hidden" name="key" value="${escapeAttr(widget.key)}"><div class="form-grid"><label>Bezeichnung<input name="label" value="${escapeAttr(widget.label||"")}" required></label><label>Symbol<input name="icon" value="${escapeAttr(widget.icon||"")}" maxlength="8"></label><label>Reihenfolge<input type="number" name="order" min="1" max="9999" value="${Number(widget.order||10)}"></label><label>Größe<select name="size">${optionList(sizes,widget.size||"M")}</select></label><label>Aktiv<select name="active">${optionList([{value:"true",label:"Ja"},{value:"false",label:"Nein"}],String(widget.active))}</select></label><label class="full">Beschreibung<input name="description" value="${escapeAttr(widget.description||"")}"></label><div class="full"><strong>Sichtbar für Rollen</strong>${roleChecks(roles,widget.roles)}</div></div></form>`,onSubmit:async form=>{form.active=String(form.active)==="true";await runWrite("Dashboard-Widget wird gespeichert …",()=>call("apiSaveDashboardWidget",form));closeDialog();await openDashboardWidgets();}});
}



const V3_ROLE_RIGHTS_EXCLUDED_AREAS = new Set(["Bus-Orga", "Getränke"]);

function rolePermissionKey(role, area) {
  return `${role}::${area}`;
}

function normalizePermission(permission = {}) {
  const admin = Boolean(permission.admin);
  const write = admin || Boolean(permission.schreiben ?? permission.write);
  const read = write || Boolean(permission.lesen ?? permission.read);
  return { lesen: read, schreiben: write, admin };
}

function rolePermissionFromBundle(bundle, role, area) {
  const rows = bundle?.rolePermissions || bundle?.meta?.rolePermissions || [];
  const row = rows.find(item => String(item.rolle || "") === String(role || "") && String(item.bereich || "") === String(area || ""));
  return normalizePermission(row || {});
}

function roleAreaLabel(bundle, area) {
  return String(bundle?.meta?.areaLabels?.[area] || area || "Bereich");
}

function activeRoleDefinitions(bundle) {
  const definitions = bundle?.roleDefinitions || bundle?.meta?.roleDefinitions || [];
  const active = definitions.filter(item => String(item.aktiv || "JA") === "JA");
  if (active.length) return active;
  return (bundle?.meta?.rollen || []).map(name => ({ name, aktiv: "JA", assignedUsers: 0, activeUsers: 0 }));
}

async function openRoleRights(force = false) {
  let bundle = phase3State.get("admin:roles");
  if (!bundle || force) bundle = phase3State.set("admin:roles", await call("apiListRoles"));

  const definitions = activeRoleDefinitions(bundle);
  const roles = definitions.map(item => item.name).filter(Boolean);
  const allAreas = bundle?.meta?.areas || [];
  const areas = allAreas.filter(area => !V3_ROLE_RIGHTS_EXCLUDED_AREAS.has(area));
  const selectedRole = roles.includes("Admin") ? "Admin" : (roles[0] || "");
  const pending = new Map();

  if (!roles.length) {
    openDialog({
      title: "Rollen & Rechte",
      kicker: "Portalverwaltung",
      body: `<div class="notice error">Es wurden keine aktiven Rollen gefunden. Bitte zuerst das Grundsystem prüfen.</div><div class="dialog-actions"><button class="button ghost" data-dialog-close>Schließen</button></div>`
    });
    return;
  }

  openDialog({
    title: "Rollen & Rechte",
    kicker: "Fachliche Berechtigungen",
    wide: true,
    body: `
      <div class="notice warning"><strong>Zwei getrennte Ebenen:</strong><br>
        Unter <strong>Portalstruktur</strong> stellst du ein, welche Rolle einen Hauptbereich in der Navigation sieht.
        Hier legst du fest, ob die Rolle die zugehörigen Daten tatsächlich <strong>lesen</strong>, <strong>bearbeiten</strong> oder <strong>administrieren</strong> darf.
      </div>
      <div class="module-toolbar role-rights-toolbar" style="margin-top:16px">
        <label class="role-rights-role-select">Rolle
          <select id="roleRightsRole">${optionList(roles, selectedRole)}</select>
        </label>
        <button id="roleRightsOpenStructure" class="button ghost" type="button">🧭 Portalstruktur öffnen</button>
        <button id="roleRightsRefresh" class="button ghost" type="button">Aktualisieren</button>
      </div>
      <div id="roleRightsRoleSummary" class="role-rights-summary"></div>
      <div id="roleRightsMatrix" style="margin-top:16px"></div>
      <div class="dialog-actions role-rights-actions">
        <span id="roleRightsDirty" class="subtle">Keine ungespeicherten Änderungen</span>
        <button class="button ghost" type="button" id="roleRightsDiscard" disabled>Änderungen verwerfen</button>
        <button class="button primary" type="button" id="roleRightsSave" ${canWrite("Rollen") ? "" : "disabled"}>Rechte speichern</button>
        <button class="button ghost" type="button" data-dialog-close>Schließen</button>
      </div>`
  });

  const roleSelect = document.getElementById("roleRightsRole");
  const matrix = document.getElementById("roleRightsMatrix");
  const dirtyLabel = document.getElementById("roleRightsDirty");
  const saveButton = document.getElementById("roleRightsSave");
  const discardButton = document.getElementById("roleRightsDiscard");

  const roleDefinition = role => definitions.find(item => String(item.name) === String(role)) || {};
  const currentPermission = (role, area) => pending.get(rolePermissionKey(role, area)) || rolePermissionFromBundle(bundle, role, area);
  const updateDirty = () => {
    const count = pending.size;
    if (dirtyLabel) dirtyLabel.textContent = count ? `${count} geänderte Bereich(e) noch nicht gespeichert` : "Keine ungespeicherten Änderungen";
    if (discardButton) discardButton.disabled = count === 0;
    if (saveButton) saveButton.disabled = !canWrite("Rollen") || count === 0;
  };

  const syncPermissionInputs = (role, area, changedKind) => {
    const base = `rr_${String(role).replace(/[^a-zA-Z0-9_-]/g, "_")}_${String(area).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const readInput = document.getElementById(`${base}_read`);
    const writeInput = document.getElementById(`${base}_write`);
    const adminInput = document.getElementById(`${base}_admin`);
    if (!readInput || !writeInput || !adminInput) return;

    if (changedKind === "admin" && adminInput.checked) {
      writeInput.checked = true;
      readInput.checked = true;
    }
    if (changedKind === "write" && writeInput.checked) readInput.checked = true;
    if (changedKind === "write" && !writeInput.checked) adminInput.checked = false;
    if (changedKind === "read" && !readInput.checked) {
      writeInput.checked = false;
      adminInput.checked = false;
    }

    const permission = normalizePermission({
      lesen: readInput.checked,
      schreiben: writeInput.checked,
      admin: adminInput.checked
    });
    readInput.checked = permission.lesen;
    writeInput.checked = permission.schreiben;
    adminInput.checked = permission.admin;
    pending.set(rolePermissionKey(role, area), { rolle: role, bereich: area, ...permission, aktiv: "JA" });
    updateDirty();
  };

  const renderMatrix = () => {
    const role = roleSelect?.value || selectedRole;
    const definition = roleDefinition(role);
    const summary = document.getElementById("roleRightsRoleSummary");
    if (summary) summary.innerHTML = `
      <span class="badge success">Aktiv</span>
      <strong>${escapeHtml(role)}</strong>
      <span>${Number(definition.assignedUsers || 0)} Benutzer · ${Number(definition.activeUsers || 0)} aktiv</span>
      ${role === "Admin" ? '<span class="badge warning">System/Admin muss mindestens einmal erhalten bleiben</span>' : ""}`;

    matrix.innerHTML = `
      <div class="permission-grid role-rights-grid">
        <div class="permission-row permission-row-head" aria-hidden="true">
          <strong>Fachbereich</strong><strong>Lesen</strong><strong>Schreiben</strong><strong>Admin</strong>
        </div>
        ${areas.map(area => {
          const permission = currentPermission(role, area);
          const safeRole = String(role).replace(/[^a-zA-Z0-9_-]/g, "_");
          const safeArea = String(area).replace(/[^a-zA-Z0-9_-]/g, "_");
          const base = `rr_${safeRole}_${safeArea}`;
          const disabled = canWrite("Rollen") ? "" : "disabled";
          return `<div class="permission-row" data-rights-area="${escapeAttr(area)}">
            <div><strong>${escapeHtml(roleAreaLabel(bundle, area))}</strong><div class="subtle">${escapeHtml(area)}</div></div>
            <label title="Lesen"><input id="${base}_read" type="checkbox" aria-label="${escapeAttr(roleAreaLabel(bundle, area))}: Lesen" ${permission.lesen ? "checked" : ""} ${disabled}></label>
            <label title="Schreiben"><input id="${base}_write" type="checkbox" aria-label="${escapeAttr(roleAreaLabel(bundle, area))}: Schreiben" ${permission.schreiben ? "checked" : ""} ${disabled}></label>
            <label title="Admin"><input id="${base}_admin" type="checkbox" aria-label="${escapeAttr(roleAreaLabel(bundle, area))}: Admin" ${permission.admin ? "checked" : ""} ${disabled}></label>
          </div>`;
        }).join("")}
      </div>
      <div class="notice" style="margin-top:14px"><strong>v3-Abgrenzung:</strong> Bus-Orga und Getränke werden hier bewusst noch nicht angeboten. Diese Fachrechte werden erst mit den entsprechenden v4-Modulen freigeschaltet.</div>`;

    areas.forEach(area => {
      const safeRole = String(role).replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeArea = String(area).replace(/[^a-zA-Z0-9_-]/g, "_");
      const base = `rr_${safeRole}_${safeArea}`;
      document.getElementById(`${base}_read`)?.addEventListener("change", () => syncPermissionInputs(role, area, "read"));
      document.getElementById(`${base}_write`)?.addEventListener("change", () => syncPermissionInputs(role, area, "write"));
      document.getElementById(`${base}_admin`)?.addEventListener("change", () => syncPermissionInputs(role, area, "admin"));
    });
    updateDirty();
  };

  roleSelect?.addEventListener("change", renderMatrix);
  document.getElementById("roleRightsOpenStructure")?.addEventListener("click", async () => {
    closeDialog();
    await openPortalStructure();
  });
  document.getElementById("roleRightsRefresh")?.addEventListener("click", async () => {
    closeDialog();
    phase3State.remove("admin:roles");
    await openRoleRights(true);
  });
  discardButton?.addEventListener("click", () => {
    pending.clear();
    renderMatrix();
  });
  saveButton?.addEventListener("click", async () => {
    const changes = Array.from(pending.values());
    if (!changes.length) return;
    saveButton.disabled = true;
    try {
      await runWrite("Rollenrechte werden gespeichert …", () => call("apiSaveRolePermissionsBatch", changes), "Rollenrechte wurden gespeichert.");
      pending.clear();
      phase3State.remove("admin:roles");
      try { await auth.refreshInitialData(); } catch (error) {}
      closeDialog();
      if (auth.canReadArea("Rollen")) await openRoleRights(true);
      else {
        showToast("Rollenrechte gespeichert. Dein eigener Zugriff auf die Rechteverwaltung ist jetzt eingeschränkt.", "warning", 6500);
        renderAdminHome();
      }
    } catch (error) {
      saveButton.disabled = false;
      showToast(error?.message || "Rollenrechte konnten nicht gespeichert werden.", "error", 6500);
    }
  });

  renderMatrix();
}

async function openPortalAppearance(){
  const data=await call("apiGetPortalAdminConfig");const s=data.settings||{};
  openDialog({title:"Portal & Startseite",kicker:"Darstellung",wide:true,body:`<form><div class="form-grid"><label>Portalname<input name="Portal.App.Name" value="${escapeAttr(s["Portal.App.Name"]||"Plärrdeifl Portal")}"></label><label>Kurzname<input name="Portal.App.ShortName" value="${escapeAttr(s["Portal.App.ShortName"]||"Plärrdeifl")}"></label><label>Grundfarbe<input type="color" name="Portal.Brand.PrimaryColor" value="${escapeAttr(s["Portal.Brand.PrimaryColor"]||"#0b4f9c")}"></label><label>Logo-URL<input type="url" name="Portal.Brand.LogoUrl" value="${escapeAttr(s["Portal.Brand.LogoUrl"]||"")}" placeholder="https://…"></label><label class="full">Öffentliche Überschrift<input name="Portal.Public.Headline" value="${escapeAttr(s["Portal.Public.Headline"]||"")}"></label><label class="full">Öffentlicher Text<textarea name="Portal.Public.Text">${escapeHtml(s["Portal.Public.Text"]||"")}</textarea></label><label class="full">Hinweis unter Anmeldung<input name="Portal.Public.Note" value="${escapeAttr(s["Portal.Public.Note"]||"")}"></label><label class="full">Über uns<textarea name="Portal.Public.About">${escapeHtml(s["Portal.Public.About"]||"")}</textarea></label><label class="full">Kontakt<textarea name="Portal.Public.Contact">${escapeHtml(s["Portal.Public.Contact"]||"")}</textarea></label><label class="full">Öffentlich · Aktuelles<textarea name="Portal.Public.News">${escapeHtml(s["Portal.Public.News"]||"")}</textarea></label><label class="full">Öffentlich · Termine<textarea name="Portal.Public.Dates">${escapeHtml(s["Portal.Public.Dates"]||"")}</textarea></label><label class="full">Dashboard · Aktuelles<textarea name="Portal.Dashboard.News">${escapeHtml(s["Portal.Dashboard.News"]||"")}</textarea></label><label class="full">Dashboard · Termine<textarea name="Portal.Dashboard.Dates">${escapeHtml(s["Portal.Dashboard.Dates"]||"")}</textarea></label><label class="full">Dashboard · Fanfahrten<textarea name="Portal.Dashboard.Fantrips">${escapeHtml(s["Portal.Dashboard.Fantrips"]||"")}</textarea></label><label class="full">Dashboard · Dokumente<textarea name="Portal.Dashboard.Documents">${escapeHtml(s["Portal.Dashboard.Documents"]||"")}</textarea></label></div></form>`,onSubmit:async form=>{await runWrite("Portal-Einstellungen werden gespeichert …",()=>call("apiSavePortalSettings",form));closeDialog();location.reload();}});
}

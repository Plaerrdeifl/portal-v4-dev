import { call, empty, errorPanel, escapeAttr, escapeHtml, fmtMoney, fmtNumber, loading } from "./common.js";
import { navigate } from "../router.js";
import { auth } from "../auth.js";
import { storage } from "../storage.js";

const DASHBOARD_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
let refreshPromise = null;

function valueLine(label,value){return `<div class="widget-value-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;}
function dataMarkup(widget){
  const data=widget.data||{};const key=widget.key;
  if(data.text)return `<p>${escapeHtml(data.text)}</p>`;
  if(key==="my-account")return `<strong class="widget-main-value">${escapeHtml(data.title||"Portaluser")}</strong><p>${escapeHtml(data.subtitle||"")}</p>${data.email?`<small>${escapeHtml(data.email)}</small>`:""}`;
  if(key==="member-contribution")return data.empty?`<p>${escapeHtml(data.text||"Keine Beitragsdaten.")}</p>`:`<strong class="widget-main-value">${escapeHtml(data.status||"–")}</strong>${valueLine("Soll",fmtMoney(data.due))}${valueLine("Gezahlt",fmtMoney(data.paid))}${valueLine("Offen",fmtMoney(data.open))}`;
  if(key==="member-profile")return data.empty?`<p>${escapeHtml(data.text||"Kein Profil.")}</p>`:`<strong class="widget-main-value">${escapeHtml(data.title||"Mitglied")}</strong>${valueLine("Status",data.status||"–")}${valueLine("Mitglied seit",data.joined||"–")}`;
  if(["member-teams","team-list","team-status"].includes(key))return `<strong class="widget-main-value">${fmtNumber(data.count||0)}</strong><p>${(data.items||[]).map(escapeHtml).join(" · ")||"Keine Teams zugeordnet."}</p>`;
  if(key==="team-tasks")return `<strong class="widget-main-value">${fmtNumber(data.count||0)}</strong><p>${(data.items||[]).map(escapeHtml).join(" · ")||"Keine offenen Teamaufgaben."}</p>`;
  if(key==="account-balances")return `<strong class="widget-main-value">${fmtMoney(data.total||0)}</strong><div class="widget-values">${(data.items||[]).map(item=>valueLine(item.label,fmtMoney(item.value))).join("")}</div>`;
  if(["pending-members","board-tasks","admin-applications","admin-audit"].includes(key))return `<strong class="widget-main-value">${fmtNumber(data.count||0)}</strong>${data.latest?`<p>${escapeHtml(data.latest)}</p>`:""}`;
  if(key==="contribution-summary")return `<strong class="widget-main-value">${fmtNumber(data.total||0)}</strong>${valueLine("Offen",fmtNumber(data.open))}${valueLine("Bezahlt",fmtNumber(data.paid))}<small>Saison ${escapeHtml(data.year||"")}</small>`;
  if(key==="admin-system")return `<strong class="widget-main-value">${escapeHtml(data.status||"PRÜFEN")}</strong>${valueLine("Hinweise",fmtNumber(data.warnings))}${valueLine("Tabellen",fmtNumber(data.sheets))}`;
  if(key==="admin-backup")return data.empty?`<p>${escapeHtml(data.text||"Kein Backup.")}</p>`:`<strong>${escapeHtml(data.title||"Backup")}</strong><p>${escapeHtml(data.timestamp||"")}</p>${data.status?`<small>${escapeHtml(data.status)}</small>`:""}`;
  if(data.empty)return `<p>${escapeHtml(data.text||"Noch keine Daten verfügbar.")}</p>`;
  return empty("Noch keine Daten verfügbar.");
}
function targetParts(value){const [route,tab]=String(value||"").split(":");return {route,tab};}
function cacheKey(){return `pd:r71:dashboard:${auth.current().user?.userId||"anonymous"}`;}
function readCached(){
  const cached=storage.get(cacheKey(),null);
  if(!cached||!cached.savedAt||!cached.payload)return null;
  if(Date.now()-Number(cached.savedAt)>DASHBOARD_CACHE_MAX_AGE_MS)return null;
  return cached.payload;
}
function writeCached(payload){storage.set(cacheKey(),{savedAt:Date.now(),payload});}
function bindTargets(){
  document.querySelectorAll("[data-widget-target]").forEach(card=>{const open=()=>{const {route,tab}=targetParts(card.dataset.widgetTarget);if(!route)return;const params=new URLSearchParams();if(tab)params.set("tab",tab);navigate(route,params);};card.addEventListener("click",open);card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});});
}
function render(payload,target,status,label){
  const widgets=payload?.widgets||[];
  if(target)target.innerHTML=widgets.length?widgets.map(widget=>`<article class="card dashboard-widget widget-${escapeAttr(String(widget.size||"M").toLowerCase())} ${widget.clickTarget?"is-clickable":""}" ${widget.clickTarget?`data-widget-target="${escapeAttr(widget.clickTarget)}" role="button" tabindex="0"`:""}><div class="dashboard-widget-head"><span class="dashboard-widget-icon">${escapeHtml(widget.icon||"•")}</span><div><h3>${escapeHtml(widget.label||widget.key)}</h3><p>${escapeHtml(widget.description||"")}</p></div></div><div class="dashboard-widget-body">${dataMarkup(widget)}</div>${widget.clickTarget?'<span class="dashboard-widget-arrow" aria-hidden="true">›</span>':""}</article>`).join(""):empty("Für deine Rolle sind noch keine Dashboard-Widgets aktiv.");
  bindTargets();
  if(status){status.textContent=label||`${widgets.length} Widget${widgets.length===1?"":"s"}`;status.className="status-pill success";}
}
async function refreshDashboard(target,status,{silent=false}={}){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    const payload=await call("apiGetMyDashboard");
    writeCached(payload);
    const suffix=payload.cacheHit?"Backend-Cache":"Aktualisiert";
    render(payload,target,status,`${(payload.widgets||[]).length} Widgets · ${suffix}`);
    return payload;
  })().catch(error=>{
    if(!silent){
      if(target)target.innerHTML=errorPanel(error,"Dashboard konnte nicht geladen werden");
      if(status){status.textContent="Fehler";status.className="status-pill warning";}
    }else if(status){status.textContent="Sofortansicht · Aktualisierung fehlgeschlagen";status.className="status-pill warning";}
    throw error;
  }).finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

export async function hydrateDashboard(){
  const target=document.getElementById("dashboardWidgets");const status=document.getElementById("dashboardStatus");
  const cached=readCached();
  if(cached){
    render(cached,target,status,"Sofortansicht · wird aktualisiert");
    refreshDashboard(target,status,{silent:true}).catch(()=>null);
    return;
  }
  if(target)target.innerHTML=loading("Dashboard-Widgets werden geladen …");
  await refreshDashboard(target,status,{silent:false});
}

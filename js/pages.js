import { auth } from "./auth.js";
import { applyLegacyLinks, escapeHtml, showToast } from "./ui.js";
import { navigate } from "./router.js";
import { hydrateDashboard } from "./modules/dashboard.js";
import { hydrateFanclub } from "./modules/fanclub.js";
import { hydrateTeams } from "./modules/teams.js";
import { hydrateFanbus } from "./modules/fanbus.js";
import { hydrateAdmin } from "./modules/admin.js";

function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=String(value??"");}
function formatDateTime(value){const date=new Date(Number(value||0));if(!Number.isFinite(date.getTime()))return"–";return new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(date);}

async function startGoogleLogin(button) {
  if (button) { button.disabled = true; button.textContent = "Google-Anmeldung wird geöffnet …"; }
  try { await auth.login(); }
  catch (error) {
    if (button) { button.disabled = false; button.textContent = "Mit Google anmelden"; }
    showToast(error.message || "Google-Anmeldung konnte nicht gestartet werden.", "error", 7000);
  }
}

async function hydrateHome(){
  const current=auth.current();const actions=document.getElementById("homeActions");const grid=document.getElementById("homeUserGrid");const backendPill=document.getElementById("backendStatusPill");
  if(backendPill){backendPill.textContent=current.backend?"Verbunden":"Nicht verbunden";backendPill.className=`status-pill ${current.backend?"success":"warning"}`;}
  if(!current.authenticated){setText("homeStatus","Anmeldung erforderlich");const status=document.getElementById("homeStatus");if(status)status.className="status-pill warning";setText("homeHeadline","Willkommen im Plärrdeifl Portal.");setText("homeText","Die PWA ist bereit. Melde dich jetzt mit deinem freigeschalteten Google-Konto an.");if(actions)actions.innerHTML='<button id="homeLoginButton" class="button primary" type="button">Mit Google anmelden</button><a class="button ghost" data-legacy-link href="#">Bisheriges Portal öffnen</a>';document.getElementById("homeLoginButton")?.addEventListener("click",event=>startGoogleLogin(event.currentTarget));if(grid)grid.hidden=true;applyLegacyLinks();return;}
  const user=current.user||{};setText("homeStatus","Sicher angemeldet");const status=document.getElementById("homeStatus");if(status)status.className="status-pill success";setText("homeHeadline",`Servus ${user.name||user.email||"Plärrdeifl"}!`);setText("homeText","Das v3-Portal ist als installierbare PWA mit dem bestehenden Apps-Script-Backend verbunden.");
  const routeButtons=[auth.canAccessRoute("dashboard")&&["dashboard","📊 Dashboard"],auth.canAccessRoute("fanclub")&&["fanclub","🏒 Fanclub"],auth.canAccessRoute("teams")&&["teams","👥 Teams"],auth.canAccessRoute("fanbus")&&["fanbus","🚌 Fanbusse"],auth.canAccessRoute("admin")&&["admin","⚙️ Admin"]].filter(Boolean);
  if(actions)actions.innerHTML=routeButtons.map(([route,label])=>`<button class="button ${route==="dashboard"?"primary":"secondary"}" type="button" data-route="${escapeHtml(route)}">${escapeHtml(label)}</button>`).join("");if(grid)grid.hidden=false;setText("homeUserName",user.name||user.email||"–");setText("homeUserRole",`${user.role||"Portaluser"}${user.isAdmin?" · Vollzugriff":""}`);setText("homeSessionExpiry",formatDateTime(current.expires));
  const title=document.querySelector("#homeUserGrid")?.nextElementSibling?.querySelector("h3");if(title)title.textContent="v3-PWA-Systemstatus";applyLegacyLinks();
}

async function hydrateLogin(){
  const current=auth.current();const button=document.getElementById("googleLoginButton");const retry=document.getElementById("loginRetryButton");const notice=document.getElementById("loginNotice");const pill=document.getElementById("loginStatusPill");
  const bridgeText=document.getElementById("bridgeStatusText");const bridgeIcon=document.getElementById("bridgeStatusIcon");const oauthText=document.getElementById("oauthStatusText");
  if(current.backend){if(bridgeText)bridgeText.textContent=`Verbunden · ${current.backend.version||current.backend.build||"Backend bereit"}`;if(bridgeIcon)bridgeIcon.textContent="✓";if(oauthText)oauthText.textContent="OAuth-Rückkehr zur GitHub-PWA ist konfiguriert.";}else{if(bridgeText)bridgeText.textContent="Backend nicht erreichbar.";if(bridgeIcon)bridgeIcon.textContent="!";if(oauthText)oauthText.textContent="Noch nicht prüfbar.";}
  if(current.notice&&notice){notice.hidden=false;notice.className=`notice ${current.notice.type||"info"}`;notice.textContent=current.notice.message+(current.notice.email?` (${current.notice.email})`:"");}
  retry?.addEventListener("click",()=>location.reload());
  if(current.authenticated){if(pill){pill.textContent="Angemeldet";pill.className="status-pill success";}setText("loginMessage",`Du bist als ${current.user?.name||current.user?.email||"Portaluser"} angemeldet.`);if(button){button.textContent="Zur Startseite";button.addEventListener("click",()=>navigate("home"));}return;}
  button?.addEventListener("click",event=>startGoogleLogin(event.currentTarget));applyLegacyLinks();
}

export async function hydratePage(routeKey){applyLegacyLinks();if(routeKey==="home")return hydrateHome();if(routeKey==="login")return hydrateLogin();if(routeKey==="dashboard")return hydrateDashboard();if(routeKey==="fanclub")return hydrateFanclub();if(routeKey==="teams")return hydrateTeams();if(routeKey==="fanbus")return hydrateFanbus();if(routeKey==="admin")return hydrateAdmin();}

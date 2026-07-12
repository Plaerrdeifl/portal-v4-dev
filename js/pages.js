import { auth } from "./auth.js";
import { applyLegacyLinks, escapeHtml, showToast } from "./ui.js";
import { navigate } from "./router.js";
import { googleIdentity } from "./google-identity.js";
import { hydrateDashboard } from "./modules/dashboard.js";
import { hydrateFanclub, hydrateCash } from "./modules/fanclub.js";
import { hydrateTeams } from "./modules/teams.js";
import { hydrateFanbus } from "./modules/fanbus.js";
import { hydrateBoard } from "./modules/board.js";
import { hydrateAdmin } from "./modules/admin.js";

function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=String(value??"");}
function formatDateTime(value){const date=new Date(Number(value||0));if(!Number.isFinite(date.getTime()))return"–";return new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(date);}

function openLoginPage() { navigate("login"); }

async function hydrateHome(){
  const current=auth.current();
  if(current.authenticated){ navigate("dashboard"); return; }
  const cfg=current.backend?.publicConfig||{};
  setText("publicTitle",cfg.title||"Plärrdeifl Portal");
  setText("publicHeadline",cfg.headline||"Willkommen bei den Schweinfurter Plärrdeifln");
  setText("publicText",cfg.text||"Das gemeinsame Portal für Fanclub, Teams und Fanfahrten.");
  setText("publicNote",cfg.note||"Registrierte Benutzer können sich mit ihrem freigeschalteten Google-Konto anmelden.");
  setText("publicAboutText",cfg.about||"Das Portal verbindet Fanclubverwaltung, Teams und künftig die komplette Fanbusorganisation.");
  setText("publicContactText",cfg.contact||"Kontaktinformationen können in der Portalverwaltung gepflegt werden.");
  setText("publicNewsText",cfg.news||"Neuigkeiten werden hier veröffentlicht, sobald sie im Portal gepflegt sind.");
  setText("publicDatesText",cfg.dates||"Kommende Veranstaltungen und Fanfahrten werden hier angekündigt.");
  const logo=document.getElementById("publicLogo");if(logo&&cfg.logoUrl&&/^https:\/\//i.test(cfg.logoUrl))logo.src=cfg.logoUrl;
  if(cfg.primaryColor&&/^#[0-9a-f]{6}$/i.test(cfg.primaryColor))document.documentElement.style.setProperty("--blue-800",cfg.primaryColor);
  const login=document.getElementById("publicLoginButton");
  login?.addEventListener("click",()=>navigate("login"));
  document.getElementById("publicInstallButton")?.addEventListener("click",()=>document.getElementById("installButton")?.click());
  document.querySelectorAll("[data-public-section]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.publicSection;document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  const backendPill=document.getElementById("backendStatusPill");
  if(backendPill){backendPill.textContent=current.backend?"Portal bereit":"Verbindung wird geprüft";backendPill.className=`status-pill ${current.backend?"success":"warning"}`;}
}

async function hydrateLogin(){
  const current=auth.current();const retry=document.getElementById("loginRetryButton");const notice=document.getElementById("loginNotice");const pill=document.getElementById("loginStatusPill");
  const bridgeText=document.getElementById("bridgeStatusText");const bridgeIcon=document.getElementById("bridgeStatusIcon");const oauthText=document.getElementById("oauthStatusText");const slot=document.getElementById("googleSignInButton");
  if(current.backend){if(bridgeText)bridgeText.textContent=`Verbunden · ${current.backend.version||current.backend.build||"Backend bereit"}`;if(bridgeIcon)bridgeIcon.textContent="✓";if(oauthText)oauthText.textContent=current.backend.gisConfigured?"Direkter Google-Popup-Login ist bereit.":"Google Client-ID fehlt oder GitHub-Origin ist noch nicht freigegeben.";}else{if(bridgeText)bridgeText.textContent="Backend nicht erreichbar.";if(bridgeIcon)bridgeIcon.textContent="!";if(oauthText)oauthText.textContent="Noch nicht prüfbar.";}
  if(current.notice&&notice){notice.hidden=false;notice.className=`notice ${current.notice.type||"info"}`;notice.textContent=current.notice.message+(current.notice.email?` (${current.notice.email})`:"");}
  retry?.addEventListener("click",()=>location.reload());
  if(current.authenticated){if(pill){pill.textContent="Angemeldet";pill.className="status-pill success";}setText("loginMessage",`Du bist als ${current.user?.name||current.user?.email||"Portaluser"} angemeldet.`);if(slot)slot.innerHTML='<button id="loginHomeButton" class="button primary" type="button">Zur Startseite</button>';document.getElementById("loginHomeButton")?.addEventListener("click",()=>navigate("home"));return;}
  if(!current.backend?.gisConfigured||!current.backend?.googleClientId){if(pill){pill.textContent="Konfiguration fehlt";pill.className="status-pill warning";}setText("loginMessage","Direkter Google-Login ist im Backend noch nicht vollständig konfiguriert.");return;}
  try{
    setText("loginMessage","Wähle dein freigeschaltetes Google-Konto aus.");
    await googleIdentity.renderButton(slot,{
      clientId:current.backend.googleClientId,
      onCredential:async({credential,nonce})=>{
        if(pill){pill.textContent="Wird geprüft";pill.className="status-pill warning";}setText("loginMessage","Google-Konto, Sitzung und Rechte werden geprüft …");
        const result=await auth.signInWithGoogleCredential(credential,nonce);
        if(result.authenticated){navigate("dashboard");return;}
        const latest=auth.current();if(notice&&latest.notice){notice.hidden=false;notice.className=`notice ${latest.notice.type||"warning"}`;notice.textContent=latest.notice.message+(latest.notice.email?` (${latest.notice.email})`:"");}if(pill){pill.textContent="Freischaltung nötig";pill.className="status-pill warning";}
      },
      onError:error=>{if(pill){pill.textContent="Fehler";pill.className="status-pill danger";}setText("loginMessage",error?.message||"Google-Anmeldung fehlgeschlagen.");showToast(error?.message||"Google-Anmeldung fehlgeschlagen.","error",7000);}
    });
  }catch(error){if(pill){pill.textContent="Fehler";pill.className="status-pill danger";}setText("loginMessage",error.message||"Google-Anmeldung konnte nicht geladen werden.");showToast(error.message||"Google-Anmeldung konnte nicht geladen werden.","error",7000);}
  applyLegacyLinks();
}

export async function hydratePage(routeKey){applyLegacyLinks();if(routeKey==="home")return hydrateHome();if(routeKey==="login")return hydrateLogin();if(routeKey==="dashboard")return hydrateDashboard();if(routeKey==="fanclub")return hydrateFanclub();if(routeKey==="cash")return hydrateCash();if(routeKey==="teams")return hydrateTeams();if(routeKey==="board")return hydrateBoard();if(routeKey==="fanbus")return hydrateFanbus();if(routeKey==="admin")return hydrateAdmin();}

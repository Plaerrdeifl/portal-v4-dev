import { escapeHtml, portal } from "./common.js";

export async function hydrateFanbus(){
  const p=portal();
  const target=document.getElementById("fanbusPanel");
  if(!target)return;
  target.innerHTML=`
    <div class="hero"><div class="hero-content"><div><span class="status-pill success">Für v4 vorbereitet</span><h2>Fanbus-Modul folgt in v4</h2><p>v3 enthält bewusst keine neuen Bus-Fachfunktionen. Die PWA stellt bereits Oberfläche, Routing, Rechtehaken und modulare Erweiterungspunkte bereit.</p></div><div style="font-size:5rem" aria-hidden="true">🚌</div></div></div>
    <div class="grid three">
      <article class="card"><div class="card-icon">🔐</div><h3>Rechte vorbereitet</h3><p>Team- und Rollenrechte können in v4 gezielt um Bus-Orga, Buskasse und weitere Fachrechte ergänzt werden.</p></article>
      <article class="card"><div class="card-icon">🧩</div><h3>Modular erweiterbar</h3><p>Neue Busseiten werden als eigene Module ergänzt, ohne Fanclub- und Teamfunktionen umzubauen.</p></article>
      <article class="card"><div class="card-icon">🔔</div><h3>Benachrichtigungen später</h3><p>Push gehört ausschließlich zu v4. Service Worker und Installationsbasis bleiben dafür kompatibel.</p></article>
    </div>
    <article class="card"><h3>Aktueller Zugang</h3><p>Fanbus-Zugriff: <strong>${escapeHtml(p.fanbusAccess===false?"nicht freigegeben":"freigegeben")}</strong>. In v3 werden keine Buchungs-, Sitzplatz- oder Zahlungsdaten im Fanbusbereich geführt.</p></article>`;
}

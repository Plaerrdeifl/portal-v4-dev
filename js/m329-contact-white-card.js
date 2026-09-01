import { getSupabaseClient } from "./supabase-client.js";

const STYLE_ID = "m329ContactWhiteCardStyle";
const PORTAL_PANEL_ID = "m329PortalFanbusContacts";

const ICONS = Object.freeze({
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.051 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.1 3.3c.5-.2 1 0 1.2.5l1.6 3.8c.2.4.1.9-.3 1.2l-1.8 1.5c1 2.3 2.9 4.2 5.2 5.2l1.5-1.8c.3-.4.8-.5 1.2-.3l3.8 1.6c.5.2.7.7.5 1.2l-.8 3.2c-.1.5-.6.9-1.1.9C10.1 20.3 3.7 13.9 3.7 6c0-.5.4-1 .9-1.1l2.5-.6Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2Zm0 2 8 5 8-5H4Zm16 10V9l-7.5 4.7a1 1 0 0 1-1 0L4 9v8h16Z"/></svg>'
});

let scheduled = false;
let contactPromise = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function safeWhatsAppHref(value) {
  const raw = String(value || "").trim();
  return /^https:\/\/wa\.me\/[1-9][0-9]{6,14}$/u.test(raw) ? raw : "";
}

function safeTelHref(value) {
  const raw = String(value || "").trim();
  return /^tel:\+?[0-9 ()/-]{3,40}$/u.test(raw) ? raw : "";
}

function safeMailHref(value) {
  const raw = String(value || "").trim();
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw) ? raw : "";
}

function contactDescription(name, primary = false) {
  if (primary) return "Allgemeine Fragen · Buchung & Anmeldung";
  switch (String(name || "").trim().toLowerCase()) {
    case "luca":
      return "Zustieg Münnerstadt · Pendlerparkplatz";
    case "pascal":
      return "Zustieg Schweinfurt · Icedome";
    default:
      return "Fragen zur Fanbusfahrt";
  }
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PORTAL_PANEL_ID}.m329-contact-panel{
      display:grid!important;
      gap:.55rem!important;
      width:100%!important;
      max-width:none!important;
      margin:10px 0 0!important;
      padding:.82rem 1rem .9rem!important;
      border:1px solid rgba(126,145,171,.24)!important;
      border-radius:14px!important;
      background:#fff!important;
      color:var(--ink-900,#10233a)!important;
      box-shadow:0 .2rem .65rem rgba(20,40,63,.055)!important;
    }
    #${PORTAL_PANEL_ID}>header{
      display:block!important;
      margin:0!important;
      padding:.04rem 0 .25rem!important;
      text-align:center!important;
    }
    #${PORTAL_PANEL_ID}>header strong{
      display:block!important;
      width:100%!important;
      margin:0!important;
      color:var(--ink-900,#10233a)!important;
      font-size:.88rem!important;
      font-weight:850!important;
      line-height:1.2!important;
      text-align:center!important;
    }
    #${PORTAL_PANEL_ID}>header small{display:none!important}
    #${PORTAL_PANEL_ID} .m329-v2-contact-list{display:grid;width:100%}
    #${PORTAL_PANEL_ID} .m329-v2-contact-row{
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(12rem,1.15fr);
      align-items:center;
      gap:.75rem;
      min-height:3.5rem;
      padding:.55rem .2rem;
      border-top:1px solid rgba(219,227,236,.9);
    }
    #${PORTAL_PANEL_ID} .m329-v2-contact-row:first-child{border-top:0}
    #${PORTAL_PANEL_ID} .m329-v2-contact-copy{display:grid;gap:.12rem;min-width:0}
    #${PORTAL_PANEL_ID} .m329-v2-contact-copy strong{
      min-width:0;
      margin:0;
      color:var(--ink-900,#10233a);
      font-size:.79rem;
      font-weight:850;
      line-height:1.2;
    }
    #${PORTAL_PANEL_ID} .m329-v2-contact-copy small{
      color:var(--muted,#718198);
      font-size:.65rem;
      font-weight:650;
      line-height:1.28;
      white-space:normal;
    }
    #${PORTAL_PANEL_ID} .m329-v2-contact-actions,
    .m329-v2-board-actions{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:.42rem;
      width:100%;
      min-width:0;
    }
    .m329-v2-contact-button{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      gap:.38rem!important;
      width:100%!important;
      min-width:0!important;
      min-height:2.45rem!important;
      padding:.42rem .55rem!important;
      border:1px solid var(--line,#d8e2ee)!important;
      border-radius:.68rem!important;
      background:#fff!important;
      color:var(--ink-900,#10233a)!important;
      font:inherit!important;
      font-size:.72rem!important;
      font-weight:800!important;
      line-height:1.12!important;
      text-align:center!important;
      text-decoration:none!important;
      white-space:nowrap!important;
      box-sizing:border-box!important;
    }
    .m329-v2-contact-button svg{
      display:block!important;
      width:1rem!important;
      height:1rem!important;
      flex:none!important;
      fill:currentColor!important;
      pointer-events:none!important;
    }
    .m329-v2-whatsapp,
    .m329-v2-whatsapp:link,
    .m329-v2-whatsapp:visited,
    .m329-v2-whatsapp:hover,
    .m329-v2-whatsapp:active{
      border-color:#bde8cb!important;
      background:#f2fbf5!important;
      color:#14804a!important;
    }
    .m329-v2-call svg{color:#cf3c34!important}
    .m329-v2-mail:hover,.m329-v2-call:hover{
      border-color:#c8d6e6!important;
      background:#fbfcfe!important;
    }
    .m329-board-contact{
      display:block!important;
      width:100%!important;
      margin-top:8px!important;
      padding:0 .45rem!important;
    }
    .m329-board-contact-number{display:none!important}
    .m329-v2-board-actions{
      width:min(100%,19rem)!important;
      margin:0 auto!important;
      gap:.42rem!important;
    }
    .m329-v2-board-card{text-align:center!important}
    .m329-v2-board-card>*{text-align:center!important}
    @media(max-width:520px){
      #${PORTAL_PANEL_ID}.m329-contact-panel{padding:.72rem .85rem .82rem!important}
      #${PORTAL_PANEL_ID} .m329-v2-contact-row{
        grid-template-columns:minmax(0,.95fr) minmax(0,1.35fr);
        gap:.5rem;
        min-height:3.55rem;
        padding:.48rem .12rem;
      }
      #${PORTAL_PANEL_ID} .m329-v2-contact-actions,.m329-v2-board-actions{gap:.32rem}
      .m329-v2-contact-button{min-height:2.35rem!important;padding-inline:.4rem!important;font-size:.68rem!important}
      #${PORTAL_PANEL_ID} .m329-v2-contact-copy small{font-size:.61rem}
    }
    @media(max-width:350px){
      #${PORTAL_PANEL_ID} .m329-v2-contact-row{grid-template-columns:1fr;gap:.35rem}
    }
  `;
  document.head.appendChild(style);
}

async function loadContact() {
  if (!contactPromise) {
    contactPromise = getSupabaseClient().rpc("pd_public_fanbus_contact")
      .then(({ data, error }) => {
        if (error) throw error;
        return data && typeof data === "object" ? data : null;
      })
      .catch(error => {
        contactPromise = null;
        console.warn("M329 Kontaktkarte konnte nicht geladen werden.", error);
        return null;
      });
  }
  return contactPromise;
}

function contactActionMarkup(person, primary = false) {
  const name = String(person?.name || (primary ? "Plärrdeifl" : "Kontakt")).trim();
  const whatsappHref = safeWhatsAppHref(person?.whatsappHref);
  const phoneHref = safeTelHref(person?.phoneHref);
  const emailHref = safeMailHref(person?.emailHref);
  const actions = [];

  if (whatsappHref) {
    actions.push(`<a class="m329-v2-contact-button m329-v2-whatsapp" href="${escapeAttr(whatsappHref)}" rel="noopener" aria-label="${escapeAttr(`WhatsApp an ${name}`)}">${ICONS.whatsapp}<span>WhatsApp</span></a>`);
  }
  if (primary && emailHref) {
    actions.push(`<a class="m329-v2-contact-button m329-v2-mail" href="${escapeAttr(emailHref)}" aria-label="${escapeAttr(`E-Mail an ${name}`)}">${ICONS.mail}<span>E-Mail</span></a>`);
  } else if (phoneHref) {
    actions.push(`<a class="m329-v2-contact-button m329-v2-call" href="${escapeAttr(phoneHref)}" aria-label="${escapeAttr(`${name} anrufen`)}">${ICONS.phone}<span>Anrufen</span></a>`);
  }

  return actions.join("");
}

function contactRowsMarkup(data) {
  const rows = [];
  const primary = data?.primary && typeof data.primary === "object" ? data.primary : null;
  if (primary) {
    const actions = contactActionMarkup(primary, true);
    if (actions) {
      rows.push(`<div class="m329-v2-contact-row"><span class="m329-v2-contact-copy"><strong>${escapeHtml(primary.name || "Plärrdeifl")}</strong><small>${escapeHtml(contactDescription(primary.name, true))}</small></span><span class="m329-v2-contact-actions">${actions}</span></div>`);
    }
  }

  for (const person of Array.isArray(data?.contacts) ? data.contacts : []) {
    if (!person || typeof person !== "object") continue;
    const actions = contactActionMarkup(person, false);
    if (!actions) continue;
    rows.push(`<div class="m329-v2-contact-row"><span class="m329-v2-contact-copy"><strong>${escapeHtml(person.name || "Kontakt")}</strong><small>${escapeHtml(contactDescription(person.name, false))}</small></span><span class="m329-v2-contact-actions">${actions}</span></div>`);
  }

  return rows.join("");
}

function bindWhatsAppNavigation(root = document) {
  root.querySelectorAll?.("a.m329-v2-whatsapp").forEach(button => {
    if (!(button instanceof HTMLAnchorElement) || button.dataset.m329V2Bound === "true") return;
    const href = safeWhatsAppHref(button.getAttribute("href"));
    if (!href) return;
    button.dataset.m329V2Bound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(href);
    });
  });
}

async function polishPortalPanel() {
  const panel = document.getElementById(PORTAL_PANEL_ID);
  if (!(panel instanceof HTMLElement)) return;
  const data = await loadContact();
  if (!data || !panel.isConnected) return;
  const rows = contactRowsMarkup(data);
  if (!rows) return;
  const signature = JSON.stringify(data);
  if (panel.dataset.m329WhiteCardSignature === signature) return;
  panel.dataset.m329WhiteCardSignature = signature;
  panel.innerHTML = `<header><strong>Kontakt zur Bus-Orga</strong></header><div class="m329-v2-contact-list">${rows}</div>`;
  bindWhatsAppNavigation(panel);
}

function polishBoardContacts() {
  document.querySelectorAll(".m329-board-contact").forEach(wrapper => {
    if (!(wrapper instanceof HTMLElement) || wrapper.dataset.m329WhiteCardBoard === "true") return;
    const whatsappAnchor = [...wrapper.querySelectorAll("a")].find(anchor => safeWhatsAppHref(anchor.getAttribute("href")));
    const phoneAnchor = [...wrapper.querySelectorAll("a")].find(anchor => safeTelHref(anchor.getAttribute("href")));
    const whatsappHref = whatsappAnchor ? safeWhatsAppHref(whatsappAnchor.getAttribute("href")) : "";
    const phoneHref = phoneAnchor ? safeTelHref(phoneAnchor.getAttribute("href")) : "";
    if (!whatsappHref && !phoneHref) return;
    const card = wrapper.closest(".v4-office-card");
    const name = card?.querySelector(".v4-board-name")?.textContent?.trim() || "Vorstandsmitglied";
    const actions = [
      whatsappHref ? `<a class="m329-v2-contact-button m329-v2-whatsapp" href="${escapeAttr(whatsappHref)}" rel="noopener" aria-label="${escapeAttr(`WhatsApp an ${name}`)}">${ICONS.whatsapp}<span>WhatsApp</span></a>` : "",
      phoneHref ? `<a class="m329-v2-contact-button m329-v2-call" href="${escapeAttr(phoneHref)}" aria-label="${escapeAttr(`${name} anrufen`)}">${ICONS.phone}<span>Anrufen</span></a>` : ""
    ].filter(Boolean).join("");
    wrapper.dataset.m329WhiteCardBoard = "true";
    wrapper.innerHTML = `<span class="m329-v2-board-actions">${actions}</span>`;
    card?.classList.add("m329-v2-board-card");
    bindWhatsAppNavigation(wrapper);
  });
}

async function applyPolish() {
  ensureStyles();
  polishBoardContacts();
  await polishPortalPanel();
}

function schedulePolish() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void applyPolish();
  });
}

const observer = new MutationObserver(schedulePolish);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", schedulePolish);
window.addEventListener("pd-auth-change", () => {
  contactPromise = null;
  schedulePolish();
});
schedulePolish();

import { getSupabaseClient } from "./supabase-client.js";

const STYLE_ID = "m329PrimaryContactLayoutStyle";
const EMAIL_CLASS = "m329-primary-email";

const MAIL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2Zm0 2 8 5 8-5H4Zm16 10V9l-7.5 4.7a1 1 0 0 1-1 0L4 9v8h16Z"/></svg>';

let contactPromise = null;
let scheduled = false;

function safeMailHref(value) {
  const raw = String(value || "").trim();
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw) ? raw : "";
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .m329-contact-panel>header{
      text-align:center!important;
      justify-items:center!important;
    }
    .m329-contact-panel>header strong,
    .m329-contact-panel>header small{
      display:block;
      width:100%;
      text-align:center!important;
    }
    .m329-primary-contact-actions{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
      gap:10px!important;
      width:100%!important;
      margin:0 0 2px!important;
    }
    .m329-primary-contact-actions .m329-primary-whatsapp,
    .m329-primary-contact-actions .${EMAIL_CLASS}{
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      gap:8px!important;
      width:100%!important;
      min-width:0!important;
      min-height:46px!important;
      margin:0!important;
      padding:8px 10px!important;
      border-radius:12px!important;
      box-sizing:border-box!important;
      text-decoration:none!important;
      font-weight:850!important;
      line-height:1.15!important;
      white-space:nowrap!important;
    }
    .m329-primary-contact-actions .m329-primary-whatsapp,
    .m329-primary-contact-actions .m329-primary-whatsapp:hover,
    .m329-primary-contact-actions .m329-primary-whatsapp:active{
      background:#25D366!important;
      border-color:#25D366!important;
      color:#fff!important;
    }
    .m329-primary-contact-actions .${EMAIL_CLASS}{
      background:var(--surface,#fff)!important;
      border:1px solid var(--line,#d8e2ee)!important;
      color:var(--ink-700,#334155)!important;
    }
    .m329-primary-contact-actions .${EMAIL_CLASS}:hover,
    .m329-primary-contact-actions .${EMAIL_CLASS}:active{
      border-color:var(--accent,#0b6cab)!important;
      color:var(--accent,#0b6cab)!important;
    }
    .m329-primary-contact-actions .${EMAIL_CLASS} svg{
      display:block!important;
      width:21px!important;
      height:21px!important;
      flex:none!important;
      fill:currentColor!important;
      pointer-events:none!important;
    }
    @media(max-width:390px){
      .m329-primary-contact-actions{gap:7px!important}
      .m329-primary-contact-actions .m329-primary-whatsapp,
      .m329-primary-contact-actions .${EMAIL_CLASS}{
        padding-inline:7px!important;
        font-size:.86rem!important;
      }
    }
  `;
  document.head.appendChild(style);
}

async function loadPrimaryEmail() {
  if (!contactPromise) {
    contactPromise = getSupabaseClient().rpc("pd_public_fanbus_contact")
      .then(({ data, error }) => {
        if (error) throw error;
        const primaryHref = safeMailHref(data?.primary?.emailHref);
        if (primaryHref) return primaryHref;
        const fallback = Array.isArray(data?.emails)
          ? data.emails.find(item => String(item?.label || "").trim().toLowerCase() === "plärrdeifl")
            || data.emails[0]
          : null;
        return safeMailHref(fallback?.href);
      })
      .catch(error => {
        contactPromise = null;
        console.warn("M329 Hauptkontakt-E-Mail konnte nicht geladen werden.", error);
        return "";
      });
  }
  return contactPromise;
}

function decoratePrimaryActions(embedded, emailHref) {
  if (!(embedded instanceof HTMLElement)) return;
  const whatsapp = embedded.querySelector(".m329-primary-whatsapp");
  if (!(whatsapp instanceof HTMLAnchorElement)) return;

  whatsapp.classList.remove("primary");
  whatsapp.style.setProperty("background", "#25D366", "important");
  whatsapp.style.setProperty("border-color", "#25D366", "important");
  whatsapp.style.setProperty("color", "#fff", "important");
  const whatsappLabel = whatsapp.querySelector("span");
  if (whatsappLabel) whatsappLabel.textContent = "WhatsApp";
  whatsapp.setAttribute("aria-label", "Plärrdeifl per WhatsApp kontaktieren");
  whatsapp.setAttribute("title", "WhatsApp");

  let wrapper = embedded.querySelector(".m329-primary-contact-actions");
  if (!(wrapper instanceof HTMLElement)) {
    wrapper = document.createElement("div");
    wrapper.className = "m329-primary-contact-actions";
    whatsapp.insertAdjacentElement("beforebegin", wrapper);
    wrapper.appendChild(whatsapp);
  } else if (whatsapp.parentElement !== wrapper) {
    wrapper.insertAdjacentElement("afterbegin", whatsapp);
  }

  let email = wrapper.querySelector(`.${EMAIL_CLASS}`);
  if (!emailHref) {
    email?.remove();
    return;
  }

  if (!(email instanceof HTMLAnchorElement)) {
    email = document.createElement("a");
    email.className = `button secondary ${EMAIL_CLASS}`;
    email.innerHTML = `${MAIL_ICON}<span>E-Mail</span>`;
    email.setAttribute("aria-label", "E-Mail an Plärrdeifl");
    email.setAttribute("title", "E-Mail");
    wrapper.appendChild(email);
  }
  email.href = emailHref;
}

async function applyLayout() {
  ensureStyles();
  const emailHref = await loadPrimaryEmail();
  document.querySelectorAll(".m329-embedded-contact").forEach(embedded => {
    decoratePrimaryActions(embedded, emailHref);
  });
}

function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void applyLayout();
  });
}

const observer = new MutationObserver(scheduleApply);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleApply);
window.addEventListener("pd-auth-change", scheduleApply);
scheduleApply();

const STYLE_ID = "m329WhatsAppBrandStyle";
const BRAND_SELECTOR = ".m329-contact-action.m329-whatsapp,.m329-primary-whatsapp";

// WhatsApp brand mark: keep the geometry intact and render the approved
// white-on-green presentation. Brand guidance:
// https://www.meta.com/en-gb/brand/resources/whatsapp/whatsapp-brand/
const WHATSAPP_MARK = '<svg class="m329-whatsapp-brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#FFFFFF" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .m329-contact-action.m329-whatsapp,
    .m329-primary-whatsapp{
      background:#25D366!important;
      border-color:#25D366!important;
      color:#fff!important;
    }
    .m329-contact-action.m329-whatsapp{
      display:grid!important;
      place-items:center!important;
      box-sizing:border-box!important;
      padding:0!important;
      line-height:0!important;
      text-align:center!important;
    }
    .m329-contact-action.m329-whatsapp:hover,
    .m329-contact-action.m329-whatsapp:active,
    .m329-primary-whatsapp:hover,
    .m329-primary-whatsapp:active{
      background:#25D366!important;
      border-color:#25D366!important;
      color:#fff!important;
    }
    .m329-contact-action.m329-whatsapp:focus-visible,
    .m329-primary-whatsapp:focus-visible{
      outline:3px solid color-mix(in srgb,#25D366 35%,#0b6cab);
      outline-offset:2px;
    }
    ${BRAND_SELECTOR} .m329-whatsapp-brand-mark{
      display:block!important;
      width:21px!important;
      height:21px!important;
      margin:0!important;
      padding:0!important;
      position:static!important;
      transform:none!important;
      flex:none!important;
      fill:#FFFFFF!important;
      pointer-events:none;
    }
    .m329-primary-whatsapp .m329-whatsapp-brand-mark{
      width:22px!important;
      height:22px!important;
    }
    .m329-board-card-centered{
      text-align:center!important;
    }
    .m329-board-card-centered>*{
      text-align:center!important;
    }
    .m329-board-card-centered .m329-board-contact{
      width:100%;
      justify-content:center!important;
      align-items:center!important;
      margin-top:8px!important;
    }
    .m329-board-card-centered .m329-board-contact .m329-contact-actions{
      justify-content:center!important;
      margin-left:0!important;
    }
  `;
  document.head.appendChild(style);
}

function polishBoardContacts() {
  document.querySelectorAll(".m329-board-contact").forEach(wrapper => {
    wrapper.querySelector(".m329-board-contact-number")?.remove();
    wrapper.closest(".v4-office-card")?.classList.add("m329-board-card-centered");
  });
}

function applyBrandMark() {
  ensureStyles();
  polishBoardContacts();
  document.querySelectorAll(BRAND_SELECTOR).forEach(button => {
    if (!(button instanceof HTMLElement)) return;
    const existing = button.querySelector("svg");
    if (existing && !existing.classList.contains("m329-whatsapp-brand-mark")) {
      existing.outerHTML = WHATSAPP_MARK;
    } else if (!existing) {
      button.insertAdjacentHTML("afterbegin", WHATSAPP_MARK);
    }
    button.dataset.m329WhatsAppBrand = "true";
  });
}

let scheduled = false;
function scheduleApply() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    applyBrandMark();
  });
}

const observer = new MutationObserver(scheduleApply);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleApply);
window.addEventListener("pd-auth-change", scheduleApply);
scheduleApply();

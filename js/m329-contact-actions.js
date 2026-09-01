import { getSupabaseClient } from "./supabase-client.js";

const STYLE_ID = "m329ContactActionsStyle";
const PORTAL_PANEL_ID = "m329PortalFanbusContacts";
const PUBLIC_PANEL_ID = "m329PublicFanbusContacts";
const ADMIN_ENTRY_ID = "m329ContactAdminEntry";

let initialized = false;
let scheduled = false;
let publicContactPromise = null;
let publicContact = null;
let commonModulePromise = null;

const ICONS = Object.freeze({
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.2 18.3 4 22l3.9-1.1A9 9 0 1 0 3 12.9c0 2 .7 3.9 2.2 5.4Zm2.9-1.7-.5.3-1.2.3.3-1.1-.3-.5A6.4 6.4 0 1 1 8.1 16.6Z"/><path d="M8.2 9.1c.3-.7.6-.7.9-.7h.3c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.7c-.2.2-.3.4 0 .8.7 1.2 1.7 2.1 3 2.7.4.2.6.2.8-.1l.8-1c.2-.3.4-.3.7-.2l1.9.9c.3.2.5.3.5.5 0 .2-.1 1.3-.8 1.9-.6.6-1.5.9-2.4.7-1-.2-2.5-.7-4.2-2.2-2-1.7-3.2-3.8-3.5-4.5-.3-.7 0-1.7.4-2.4Z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.1 3.3c.5-.2 1 0 1.2.5l1.6 3.8c.2.4.1.9-.3 1.2l-1.8 1.5c1 2.3 2.9 4.2 5.2 5.2l1.5-1.8c.3-.4.8-.5 1.2-.3l3.8 1.6c.5.2.7.7.5 1.2l-.8 3.2c-.1.5-.6.9-1.1.9C10.1 20.3 3.7 13.9 3.7 6c0-.5.4-1 .9-1.1l2.5-.6Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2Zm0 2 8 5 8-5H4Zm16 10V9l-7.5 4.7a1 1 0 0 1-1 0L4 9v8h16Z"/></svg>'
});

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

function numericWhatsAppHref(value) {
  let raw = String(value || "").trim().replace(/^tel:/i, "").replace(/[^+0-9]/g, "");
  if (raw.startsWith("+")) raw = raw.slice(1);
  else if (raw.startsWith("00")) raw = raw.slice(2);
  else if (raw.startsWith("0")) raw = `49${raw.slice(1)}`;
  if (!/^[1-9][0-9]{6,14}$/.test(raw)) return "";
  return `https://wa.me/${raw}`;
}

function safeTelHref(value) {
  const raw = String(value || "").trim();
  return /^tel:\+?[0-9 ()/-]{3,40}$/u.test(raw) ? raw : "";
}

function safeMailHref(value) {
  const raw = String(value || "").trim();
  return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw) ? raw : "";
}

function safeWhatsAppHref(value) {
  const raw = String(value || "").trim();
  return /^https:\/\/wa\.me\/[1-9][0-9]{6,14}$/u.test(raw) ? raw : "";
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .m329-contact-panel{display:grid;gap:9px;margin-top:10px;padding:11px 12px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff)}
    .m329-contact-panel>header{display:grid;gap:2px}.m329-contact-panel>header strong{font-size:.9rem}.m329-contact-panel>header small{color:var(--muted,#64748b);font-size:.7rem}
    .m329-primary-whatsapp{display:flex!important;align-items:center;justify-content:center;gap:7px;width:100%;min-height:44px!important;background:var(--success,#14804a)!important;color:#fff!important;border-color:transparent!important;text-decoration:none!important;font-weight:850}
    .m329-contact-panel svg,.m329-contact-actions svg,.m329-board-contact svg{width:18px;height:18px;fill:currentColor;flex:none}
    .m329-contact-list{display:grid;gap:5px}.m329-contact-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;min-height:44px;padding:5px 0;border-top:1px solid color-mix(in srgb,var(--line,#d8e2ee) 70%,transparent)}
    .m329-contact-row:first-child{border-top:0}.m329-contact-copy{display:grid;gap:1px;min-width:0}.m329-contact-copy strong{font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.m329-contact-copy small{color:var(--muted,#64748b);font-size:.68rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .m329-contact-actions{display:flex;align-items:center;gap:5px}.m329-contact-action{display:inline-flex;align-items:center;justify-content:center;width:40px;min-width:40px;height:40px;min-height:40px;padding:0;border:1px solid var(--line,#d8e2ee);border-radius:11px;background:var(--surface,#fff);color:var(--ink-700,#334155);text-decoration:none!important}.m329-contact-action:hover{border-color:var(--accent,#0b6cab);color:var(--accent,#0b6cab)}
    .m329-contact-action.m329-whatsapp{color:var(--success,#14804a)}
    .m329-board-contact{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:4px}.m329-board-contact-number{color:var(--muted,#64748b);font-size:.74rem}.m329-board-contact .m329-contact-actions{margin-left:auto}
    .m329-embedded-contact{display:grid;gap:7px}.m329-embedded-contact>.m329-primary-whatsapp{margin-bottom:2px}
    .m329-admin-form{display:grid;gap:14px}.m329-admin-section{display:grid;gap:9px;padding:11px;border:1px solid var(--line,#d8e2ee);border-radius:13px}.m329-admin-section>header{display:grid;gap:2px}.m329-admin-section>header h3{margin:0;font-size:.95rem}.m329-admin-section>header small{color:var(--muted,#64748b);font-size:.72rem;line-height:1.35}
    .m329-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.m329-admin-grid label{display:grid;gap:4px}.m329-admin-grid .m329-admin-full{grid-column:1/-1}.m329-admin-whatsapp{display:flex!important;grid-column:1/-1;align-items:center;gap:8px}.m329-admin-whatsapp input{width:22px;height:22px;min-height:22px;flex:none}
    .m329-admin-contacts{display:grid;gap:9px}.m329-admin-contact-row{display:grid;gap:8px;padding:10px;border:1px solid var(--line,#d8e2ee);border-radius:12px;background:var(--surface-soft,#f8fafc)}.m329-admin-contact-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.m329-admin-contact-head strong{font-size:.82rem}.m329-admin-remove{width:auto!important;min-height:36px!important}
    .m329-admin-add{width:100%;min-height:42px}.m329-contact-admin-entry{cursor:pointer}
    @media(max-width:520px){.m329-contact-panel{padding:10px}.m329-contact-row{gap:6px}.m329-contact-action{width:42px;min-width:42px;height:42px;min-height:42px}.m329-admin-grid{grid-template-columns:1fr}.m329-admin-grid .m329-admin-full,.m329-admin-whatsapp{grid-column:auto}.m329-board-contact{align-items:flex-start}.m329-board-contact .m329-contact-actions{margin-left:0}}
  `;
  document.head.appendChild(style);
}

async function loadPublicContact(force = false) {
  if (force) publicContactPromise = null;
  if (!publicContactPromise) {
    publicContactPromise = (async () => {
      const { data, error } = await getSupabaseClient().rpc("pd_public_fanbus_contact");
      if (error) throw error;
      publicContact = data && typeof data === "object"
        ? data
        : { primary: {}, contacts: [], emails: [], phones: [], whatsapp: {} };
      return publicContact;
    })().catch(error => {
      publicContactPromise = null;
      throw error;
    });
  }
  return publicContactPromise;
}

function contactActions(contact, { email = true } = {}) {
  const actions = [];
  const name = String(contact?.name || "Kontakt").trim() || "Kontakt";
  const whatsappHref = safeWhatsAppHref(contact?.whatsappHref);
  const phoneHref = safeTelHref(contact?.phoneHref);
  const emailHref = email ? safeMailHref(contact?.emailHref) : "";
  if (whatsappHref) actions.push(`<a class="m329-contact-action m329-whatsapp" href="${escapeAttr(whatsappHref)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(`WhatsApp an ${name}`)}" title="WhatsApp">${ICONS.chat}</a>`);
  if (phoneHref) actions.push(`<a class="m329-contact-action" href="${escapeAttr(phoneHref)}" aria-label="${escapeAttr(`${name} anrufen`)}" title="Anrufen">${ICONS.phone}</a>`);
  if (emailHref) actions.push(`<a class="m329-contact-action" href="${escapeAttr(emailHref)}" aria-label="${escapeAttr(`E-Mail an ${name}`)}" title="E-Mail">${ICONS.mail}</a>`);
  return actions.join("");
}

function contactRowsMarkup(data, { email = true } = {}) {
  const rows = [];
  const primary = data?.primary && typeof data.primary === "object" ? data.primary : {};
  const primaryActions = contactActions(primary, { email });
  if (primaryActions && !safeWhatsAppHref(primary.whatsappHref)) {
    rows.push(`<div class="m329-contact-row"><span class="m329-contact-copy"><strong>${escapeHtml(primary.name || "Plärrdeifl")}</strong><small>${escapeHtml(primary.phone || primary.email || "Kontakt")}</small></span><span class="m329-contact-actions">${primaryActions}</span></div>`);
  }
  for (const contact of Array.isArray(data?.contacts) ? data.contacts : []) {
    const actions = contactActions(contact, { email });
    if (!actions) continue;
    rows.push(`<div class="m329-contact-row"><span class="m329-contact-copy"><strong>${escapeHtml(contact.name || "Kontakt")}</strong><small>${escapeHtml(contact.phone || contact.email || "")}</small></span><span class="m329-contact-actions">${actions}</span></div>`);
  }
  return rows.join("");
}

function embeddedContactMarkup(data, options = {}) {
  const primary = data?.primary && typeof data.primary === "object" ? data.primary : {};
  const primaryWhatsapp = safeWhatsAppHref(primary.whatsappHref)
    || safeWhatsAppHref(data?.whatsapp?.url);
  const rows = contactRowsMarkup(data, options);
  if (!primaryWhatsapp && !rows) return "";
  return `<div class="m329-embedded-contact">${primaryWhatsapp ? `<a class="button primary m329-primary-whatsapp" href="${escapeAttr(primaryWhatsapp)}" target="_blank" rel="noopener noreferrer">${ICONS.chat}<span>Plärrdeifl WhatsApp</span></a>` : ""}${rows ? `<div class="m329-contact-list">${rows}</div>` : ""}</div>`;
}

function panelMarkup(data, subtitle = "WhatsApp, Telefon und E-Mail") {
  const content = embeddedContactMarkup(data);
  if (!content) return "";
  return `<header><strong>Kontakt zur Bus-Orga</strong><small>${escapeHtml(subtitle)}</small></header>${content}`;
}

function upsertPanel(anchor, id, data, subtitle) {
  if (!anchor?.isConnected) return;
  const markup = panelMarkup(data, subtitle);
  let panel = document.getElementById(id);
  if (!markup) {
    panel?.remove();
    return;
  }
  const signature = JSON.stringify(data);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = id;
    panel.className = "m329-contact-panel";
    anchor.insertAdjacentElement("afterend", panel);
  }
  if (panel.dataset.m329Signature === signature) return;
  panel.dataset.m329Signature = signature;
  panel.innerHTML = markup;
}

function renderFanbusPanels(data) {
  const portalList = document.getElementById("m310FanbusList");
  if (portalList?.querySelector("[data-m310-trip-card]")) {
    upsertPanel(portalList, PORTAL_PANEL_ID, data, "Direkter Kontakt zu den Ansprechpartnern");
  } else {
    document.getElementById(PORTAL_PANEL_ID)?.remove();
  }

  const publicTrip = document.getElementById("m310PublicTrip");
  if (publicTrip && document.documentElement.dataset.route === "fanbus-registration") {
    upsertPanel(publicTrip, PUBLIC_PANEL_ID, data, "Fragen zur Fanbusfahrt? Hier erreichst du uns direkt.");
  }

  const embedded = embeddedContactMarkup(data);
  if (!embedded) return;
  document.querySelectorAll(".m327-contact-block,#m327GuestOrganizationContact").forEach(block => {
    const signature = JSON.stringify(data);
    if (block.dataset.m329Signature === signature) return;
    block.dataset.m329Signature = signature;
    block.innerHTML = `<strong>BUS_ORGA kontaktieren</strong>${embedded}`;
  });
}

function enhanceBoardContacts() {
  document.querySelectorAll("a.v4-board-phone").forEach(anchor => {
    if (!(anchor instanceof HTMLAnchorElement) || anchor.dataset.m329Handled === "true") return;
    const telHref = safeTelHref(anchor.getAttribute("href"));
    const whatsappHref = numericWhatsAppHref(telHref);
    if (!telHref || !whatsappHref) return;
    const card = anchor.closest(".v4-office-card");
    const name = card?.querySelector(".v4-board-name")?.textContent?.trim() || "Vorstandsmitglied";
    const displayPhone = anchor.textContent?.trim() || telHref.replace(/^tel:/, "");
    const wrapper = document.createElement("div");
    wrapper.className = "m329-board-contact";
    wrapper.dataset.m329BoardContact = "true";
    wrapper.innerHTML = `<span class="m329-board-contact-number">${escapeHtml(displayPhone)}</span><span class="m329-contact-actions"><a class="m329-contact-action m329-whatsapp" href="${escapeAttr(whatsappHref)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(`WhatsApp an ${name}`)}" title="WhatsApp">${ICONS.chat}</a><a class="m329-contact-action" href="${escapeAttr(telHref)}" aria-label="${escapeAttr(`${name} anrufen`)}" title="Anrufen">${ICONS.phone}</a></span>`;
    anchor.dataset.m329Handled = "true";
    anchor.replaceWith(wrapper);
  });
}

function adminContactRowMarkup(contact = {}, index = 0) {
  return `<section class="m329-admin-contact-row" data-m329-admin-contact-row><div class="m329-admin-contact-head"><strong>Kontakt ${index + 1}</strong><button class="button small ghost m329-admin-remove" type="button" data-m329-remove-contact>Entfernen</button></div><div class="m329-admin-grid"><label>Name<input data-m329-name maxlength="80" required value="${escapeAttr(contact.name || "")}"></label><label>Telefonnummer<input data-m329-phone type="tel" maxlength="40" required value="${escapeAttr(contact.phone || "")}"></label><label class="m329-admin-whatsapp"><input data-m329-whatsapp type="checkbox"${contact.whatsapp ? " checked" : ""}><span>WhatsApp über diese Nummer</span></label><label class="m329-admin-full">E-Mail (optional)<input data-m329-email type="email" maxlength="320" value="${escapeAttr(contact.email || "")}"></label></div></section>`;
}

function bindAdminRows(dialog) {
  const container = dialog.querySelector("[data-m329-admin-contacts]");
  const relabel = () => container?.querySelectorAll("[data-m329-admin-contact-row]").forEach((row, index) => {
    const title = row.querySelector(".m329-admin-contact-head strong");
    if (title) title.textContent = `Kontakt ${index + 1}`;
  });
  container?.querySelectorAll("[data-m329-remove-contact]").forEach(button => {
    if (button.dataset.m329Bound === "true") return;
    button.dataset.m329Bound = "true";
    button.addEventListener("click", () => {
      button.closest("[data-m329-admin-contact-row]")?.remove();
      relabel();
    });
  });
  dialog.querySelector("[data-m329-add-contact]")?.addEventListener("click", () => {
    if (!container || container.children.length >= 20) return;
    container.insertAdjacentHTML("beforeend", adminContactRowMarkup({}, container.children.length));
    bindAdminRows(dialog);
    container.lastElementChild?.querySelector("input")?.focus({ preventScroll: true });
  }, { once: true });
}

function readAdminModel(dialog) {
  const primary = dialog.querySelector("[data-m329-admin-primary]");
  const contacts = [...dialog.querySelectorAll("[data-m329-admin-contact-row]")].map(row => ({
    name: row.querySelector("[data-m329-name]")?.value?.trim() || "",
    phone: row.querySelector("[data-m329-phone]")?.value?.trim() || "",
    whatsapp: row.querySelector("[data-m329-whatsapp]")?.checked === true,
    email: row.querySelector("[data-m329-email]")?.value?.trim() || ""
  }));
  return {
    primary: {
      name: primary?.querySelector("[data-m329-name]")?.value?.trim() || "Plärrdeifl",
      phone: primary?.querySelector("[data-m329-phone]")?.value?.trim() || "",
      whatsapp: primary?.querySelector("[data-m329-whatsapp]")?.checked === true,
      email: primary?.querySelector("[data-m329-email]")?.value?.trim() || ""
    },
    contacts
  };
}

async function commonModule() {
  if (!commonModulePromise) commonModulePromise = import("./modules/common.js");
  return commonModulePromise;
}

async function openContactAdmin() {
  const common = await commonModule();
  const model = await common.call("fanbus_contact_admin_get");
  const primary = model?.primary || { name: "Plärrdeifl", phone: "", whatsapp: false, email: "" };
  const contacts = Array.isArray(model?.contacts) ? model.contacts : [];
  const dialog = common.openDialog({
    title: "Kontakte verwalten",
    kicker: "Bus-Orga",
    submitLabel: "Kontakte speichern",
    body: `<form class="m329-admin-form" data-m329-admin-form><section class="m329-admin-section" data-m329-admin-primary><header><h3>Plärrdeifl Hauptkontakt</h3><small>Dieser WhatsApp-Kontakt wird bei den Fanbusfahrten besonders hervorgehoben.</small></header><div class="m329-admin-grid"><label>Name<input data-m329-name maxlength="80" required value="${escapeAttr(primary.name || "Plärrdeifl")}"></label><label>Telefonnummer<input data-m329-phone type="tel" maxlength="40" value="${escapeAttr(primary.phone || "")}"></label><label class="m329-admin-whatsapp"><input data-m329-whatsapp type="checkbox"${primary.whatsapp ? " checked" : ""}><span>Als Plärrdeifl WhatsApp anzeigen</span></label><label class="m329-admin-full">E-Mail (optional)<input data-m329-email type="email" maxlength="320" value="${escapeAttr(primary.email || "")}"></label></div></section><section class="m329-admin-section"><header><h3>Bus-Orga Kontakte</h3><small>Name, Telefonnummer, WhatsApp und optional E-Mail.</small></header><div class="m329-admin-contacts" data-m329-admin-contacts>${contacts.map(adminContactRowMarkup).join("")}</div><button class="button secondary m329-admin-add" type="button" data-m329-add-contact>＋ Kontakt hinzufügen</button></section></form>`,
    onSubmit: async () => {
      const payload = readAdminModel(dialog);
      const result = await common.runWrite(
        () => common.call("fanbus_contact_admin_save", {
          expectedRevision: Number(model?.revision || 0),
          ...payload
        }),
        "Kontakte wurden gespeichert."
      );
      publicContact = null;
      publicContactPromise = null;
      if (result?.revision) model.revision = result.revision;
      await loadPublicContact(true);
      scheduleEnhance();
    }
  });
  bindAdminRows(dialog);
}

async function ensureContactAdminEntry() {
  const grid = document.getElementById("m328WorkspaceGrid");
  if (!grid || document.getElementById(ADMIN_ENTRY_ID)) return;
  try {
    const common = await commonModule();
    if (!common.hasCapability("fanbus.manage")) return;
    const button = document.createElement("button");
    button.id = ADMIN_ENTRY_ID;
    button.className = "m328-workspace-card m329-contact-admin-entry";
    button.type = "button";
    button.innerHTML = '<span class="m328-workspace-card-copy"><strong>Kontakte</strong><small>Plärrdeifl WhatsApp und Bus-Orga-Kontakte verwalten</small></span><span class="m328-workspace-chevron" aria-hidden="true">›</span>';
    button.addEventListener("click", () => void openContactAdmin().catch(error => {
      common.showToast(error?.message || "Kontakte konnten nicht geöffnet werden.", "error", 5200);
    }));
    grid.appendChild(button);
  } catch (error) {
    console.warn("M329 Kontaktverwaltung konnte nicht initialisiert werden.", error);
  }
}

async function enhance() {
  ensureStyles();
  enhanceBoardContacts();
  void ensureContactAdminEntry();
  try {
    const data = publicContact || await loadPublicContact();
    renderFanbusPanels(data);
  } catch (error) {
    console.warn("M329 Kontaktdaten konnten nicht geladen werden.", error);
  }
}

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void enhance();
  });
}

export function setupM329ContactActions() {
  if (initialized) {
    scheduleEnhance();
    return;
  }
  initialized = true;
  ensureStyles();
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleEnhance);
  window.addEventListener("pd-auth-change", scheduleEnhance);
  scheduleEnhance();
}

setupM329ContactActions();

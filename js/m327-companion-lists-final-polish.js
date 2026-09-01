const STYLE_ID = "m327-companion-lists-final-polish-style";
const OBSERVER_KEY = "m327CompanionListsFinalPolishBound";
let scanScheduled = false;

function setTextIfChanged(element, value) {
  if (!(element instanceof HTMLElement)) return;
  if (element.textContent !== value) element.textContent = value;
}

function removeLegacyChevrons(workspace) {
  workspace.querySelectorAll(
    ".m327-companion-list-chevron,.m327-companion-row-chevron"
  ).forEach(node => node.remove());
}

function polishNewList(workspace) {
  const title = workspace.querySelector("#m325CompanionListsTitle");
  const newList = workspace.querySelector(".v4-m325-new-list");
  const form = newList?.querySelector("[data-m325-list-form]");
  if (!(title instanceof HTMLElement)
      || !(newList instanceof HTMLElement)
      || !(form instanceof HTMLFormElement)) return;

  newList.classList.add("m327-final-new-list-panel");
  const ownHeading = newList.querySelector(":scope > h3");
  if (ownHeading instanceof HTMLElement) ownHeading.hidden = true;

  if (workspace.dataset.m327FinalNewList === "true") return;
  workspace.dataset.m327FinalNewList = "true";

  const headingRow = document.createElement("div");
  headingRow.className = "m327-final-section-heading";
  title.parentNode?.insertBefore(headingRow, title);
  headingRow.append(title);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "button small secondary m327-final-new-list-toggle";
  toggle.textContent = "+ Liste";
  toggle.setAttribute("aria-expanded", "false");
  headingRow.append(toggle);

  newList.hidden = true;
  toggle.addEventListener("click", () => {
    const opening = newList.hidden;
    newList.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    setTextIfChanged(toggle, opening ? "Schließen" : "+ Liste");
    if (opening) {
      requestAnimationFrame(() => form.querySelector('input[name="name"]')?.focus());
    }
  });
}

function polishLinkedPortalMemberDialog() {
  const form = document.querySelector("[data-m325-member-form]");
  if (!(form instanceof HTMLFormElement)) return;

  const textarea = form.querySelector('textarea[name="operationalNote"]');
  if (textarea instanceof HTMLTextAreaElement && textarea.rows !== 3) textarea.rows = 3;

  const first = form.querySelector('input[name="firstName"]');
  const last = form.querySelector('input[name="lastName"]');
  if (!(first instanceof HTMLInputElement)
      || !(last instanceof HTMLInputElement)
      || !first.readOnly
      || !last.readOnly
      || form.dataset.m327FinalLinked === "true") return;

  form.dataset.m327FinalLinked = "true";
  first.closest("label")?.classList.add("m327-final-linked-name-field");
  last.closest("label")?.classList.add("m327-final-linked-name-field");

  const oldInfo = [...form.querySelectorAll("p.subtle")]
    .find(node => /Portaluser/i.test(node.textContent || ""));
  if (oldInfo instanceof HTMLElement) oldInfo.hidden = true;

  const summary = document.createElement("div");
  summary.className = "m327-final-linked-person-summary v4-field-full";

  const name = document.createElement("strong");
  name.textContent = `${first.value} ${last.value}`.trim() || "Portaluser";
  const meta = document.createElement("span");
  meta.textContent = "Portaluser · Name wird aus dem Profil übernommen";
  summary.append(name, meta);

  const firstLabel = first.closest("label");
  form.insertBefore(summary, firstLabel || form.firstChild);
}

function polishWorkspace() {
  const workspace = document.querySelector(".v4-m325-companion-workspace");
  if (workspace instanceof HTMLElement) {
    const header = workspace.querySelector(":scope > .v4-m325-workspace-header");
    const back = header?.querySelector("[data-m325-back]");
    const intro = header?.querySelector("p");
    setTextIfChanged(back, "← Zurück");
    setTextIfChanged(intro, "Gespeicherte Personen dienen als Vorlage für zukünftige Buchungen.");

    removeLegacyChevrons(workspace);
    polishNewList(workspace);
  }
  polishLinkedPortalMemberDialog();
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    polishWorkspace();
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .v4-m325-companion-workspace{gap:9px!important}
    .v4-m325-companion-workspace>.v4-m325-workspace-header{display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:8px!important}
    .v4-m325-companion-workspace>.v4-m325-workspace-header>.button{flex:0 0 auto;width:auto!important;min-height:35px!important;padding:6px 9px!important;white-space:nowrap}
    .v4-m325-companion-workspace>.v4-m325-workspace-header h2{margin:0}
    .v4-m325-companion-workspace>.v4-m325-workspace-header p{margin:3px 0 0;color:var(--muted)}
    .v4-m325-companion-workspace .m327-final-section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px}
    .v4-m325-companion-workspace .m327-final-section-heading>h3{margin:0}
    .v4-m325-companion-workspace .m327-final-new-list-toggle{flex:0 0 auto;width:auto!important;min-height:35px!important;padding:6px 10px!important;white-space:nowrap}
    .v4-m325-companion-workspace .m327-final-new-list-panel{display:grid;align-content:start;gap:6px!important;height:auto!important;min-height:0!important;padding:9px!important;border-radius:13px;margin-top:2px;overflow:hidden}
    .v4-m325-companion-workspace .m327-final-new-list-panel[hidden]{display:none!important}
    .v4-m325-companion-workspace .m327-final-new-list-panel form{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end;gap:8px!important;width:100%;min-width:0}
    .v4-m325-companion-workspace .m327-final-new-list-panel form>label.v4-field-full{grid-column:1!important;min-width:0;margin:0}
    .v4-m325-companion-workspace .m327-final-new-list-panel .v4-detail-actions.v4-field-full{grid-column:2!important;width:auto;min-width:0;margin:0;align-self:end}
    .v4-m325-companion-workspace .m327-final-new-list-panel input{width:100%!important;min-width:0}
    .v4-m325-companion-workspace .m327-final-new-list-panel .button{width:auto!important;max-width:100%;white-space:nowrap}
    .v4-m325-companion-workspace .m327-companion-list-head{display:block!important;padding-right:48px!important}
    .v4-m325-companion-workspace .m327-companion-member-tappable{grid-template-columns:minmax(0,1fr) auto!important;padding-right:40px!important}
    [data-m325-member-form] .m327-final-linked-name-field{display:none!important}
    [data-m325-member-form] .m327-final-linked-person-summary{display:grid;gap:2px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-soft,#f5f7fa)}
    [data-m325-member-form] .m327-final-linked-person-summary strong{font-size:1rem;line-height:1.2}
    [data-m325-member-form] .m327-final-linked-person-summary span{font-size:.78rem;line-height:1.3;color:var(--muted)}
    [data-m325-member-form] textarea[name="operationalNote"]{min-height:82px!important;max-height:150px}
    @media(max-width:700px){
      .v4-m325-companion-workspace>.v4-m325-workspace-header>.button{font-size:.76rem;line-height:1.05}
      .v4-m325-companion-workspace>.v4-m325-workspace-header h2{font-size:1.08rem;line-height:1.08}
      .v4-m325-companion-workspace>.v4-m325-workspace-header p{font-size:.75rem;line-height:1.25}
      .v4-m325-companion-workspace .m327-final-section-heading>h3{font-size:.98rem;line-height:1.12}
      .v4-m325-companion-workspace .m327-final-new-list-panel form{grid-template-columns:minmax(0,1fr)!important}
      .v4-m325-companion-workspace .m327-final-new-list-panel form>label.v4-field-full,.v4-m325-companion-workspace .m327-final-new-list-panel .v4-detail-actions.v4-field-full{grid-column:1!important}
      .v4-m325-companion-workspace .m327-final-new-list-panel .v4-detail-actions.v4-field-full{justify-self:stretch}
      .v4-m325-companion-workspace .m327-final-new-list-panel input{min-height:38px!important;padding:7px 9px!important;border-radius:11px;font-size:.8rem}
      .v4-m325-companion-workspace .m327-final-new-list-panel .button{width:100%!important;min-height:38px!important;padding:7px 9px!important;font-size:.75rem}
    }
  `;
  document.head.append(style);
}

export function setupM327CompanionListsFinalPolish() {
  if (typeof document === "undefined") return;
  injectStyles();
  polishWorkspace();

  if (document.documentElement.dataset[OBSERVER_KEY] === "true") return;
  document.documentElement.dataset[OBSERVER_KEY] = "true";
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

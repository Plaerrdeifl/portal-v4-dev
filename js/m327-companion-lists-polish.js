const M327_COMPANION_LISTS_STYLE_ID = "m327-companion-lists-polish-style";
const M327_COMPANION_LISTS_OBSERVER_KEY = "m327CompanionListsObserverBound2";

function actionButton(scope, selector) {
  const button = scope?.querySelector(selector);
  return button instanceof HTMLButtonElement ? button : null;
}

function forwardAction(scope, selector) {
  const button = actionButton(scope, selector);
  if (!button || button.disabled) return;
  button.click();
}

function closeOtherMenus(except = null) {
  for (const menu of document.querySelectorAll("details.m327-companion-menu[open]")) {
    if (menu !== except) menu.removeAttribute("open");
  }
}

function menuItem(scope, selector, label, { danger = false } = {}) {
  const original = actionButton(scope, selector);
  if (!original) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `m327-companion-menu-action${danger ? " danger" : ""}`;
  button.textContent = label;
  button.disabled = original.disabled;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    closeOtherMenus();
    forwardAction(scope, selector);
  });
  return button;
}

function buildMenu(scope, items, ariaLabel) {
  const menu = document.createElement("details");
  menu.className = "m327-companion-menu";
  menu.addEventListener("click", event => event.stopPropagation());
  menu.addEventListener("toggle", () => {
    if (menu.open) closeOtherMenus(menu);
  });

  const summary = document.createElement("summary");
  summary.className = "m327-companion-menu-toggle";
  summary.setAttribute("aria-label", ariaLabel);
  summary.textContent = "⋮";
  menu.append(summary);

  const panel = document.createElement("div");
  panel.className = "m327-companion-menu-panel";
  for (const item of items) {
    const button = menuItem(scope, item.selector, item.label, item);
    if (button) panel.append(button);
  }
  menu.append(panel);
  return panel.childElementCount ? menu : null;
}

function polishMember(member) {
  if (!(member instanceof HTMLElement) || member.dataset.m327TapPolished === "true") return;
  const edit = actionButton(member, "[data-m325-edit-member]");
  const copy = member.querySelector(":scope > .v4-m325-record-copy");
  const actions = member.querySelector(":scope > .v4-m325-member-actions");
  if (!(copy instanceof HTMLElement) || !(actions instanceof HTMLElement)) return;

  member.dataset.m327TapPolished = "true";
  member.classList.add("m327-companion-member-tappable");
  actions.classList.add("m327-companion-original-actions");
  member.querySelectorAll(":scope > .m327-companion-row-chevron").forEach(node => node.remove());

  if (edit) {
    member.setAttribute("role", "button");
    member.tabIndex = 0;
    member.setAttribute("aria-label", `${copy.querySelector("strong")?.textContent || "Mitfahrer"} bearbeiten`);
    member.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest("details,button,a,input,select,textarea")) return;
      forwardAction(member, "[data-m325-edit-member]");
    });
    member.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== member) return;
      event.preventDefault();
      forwardAction(member, "[data-m325-edit-member]");
    });
  }

  const menu = buildMenu(member, [
    { selector: '[data-m325-move-member][data-direction="-1"]', label: "Nach oben" },
    { selector: '[data-m325-move-member][data-direction="1"]', label: "Nach unten" },
    { selector: "[data-m325-unlink-person]", label: "Verknüpfung lösen" },
    { selector: "[data-m325-link-person]", label: "Mit Portaluser verknüpfen" },
    { selector: "[data-m325-delete-member]", label: "Entfernen", danger: true }
  ], "Weitere Aktionen für Mitfahrer");
  if (menu) member.append(menu);
}

function setListCollapsed(card, collapsed) {
  card.classList.toggle("m327-companion-list-collapsed", collapsed);
  const head = card.querySelector(":scope > .m327-companion-list-head");
  if (head instanceof HTMLElement) head.setAttribute("aria-expanded", String(!collapsed));
}

function polishList(card) {
  if (!(card instanceof HTMLElement) || card.dataset.m327TapPolished === "true") return;
  const copy = card.querySelector(":scope > .v4-m325-record-copy");
  const actions = card.querySelector(":scope > .v4-m325-list-actions");
  if (!(copy instanceof HTMLElement) || !(actions instanceof HTMLElement)) return;

  card.dataset.m327TapPolished = "true";
  card.classList.add("m327-companion-list-tappable");
  actions.classList.add("m327-companion-original-actions");
  card.querySelectorAll(":scope > .m327-companion-list-chevron").forEach(node => node.remove());

  const head = document.createElement("div");
  head.className = "m327-companion-list-head";
  head.setAttribute("role", "button");
  head.tabIndex = 0;
  head.setAttribute("aria-expanded", "true");
  head.setAttribute("aria-label", `${copy.querySelector("strong")?.textContent || "Mitfahrerliste"} ein- oder ausklappen`);

  card.insertBefore(head, copy);
  head.append(copy);
  head.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("details,button,a,input,select,textarea")) return;
    setListCollapsed(card, !card.classList.contains("m327-companion-list-collapsed"));
  });
  head.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target !== head) return;
    event.preventDefault();
    setListCollapsed(card, !card.classList.contains("m327-companion-list-collapsed"));
  });

  const menu = buildMenu(card, [
    { selector: "[data-m325-rename-list]", label: "Umbenennen" },
    { selector: "[data-m325-add-guest]", label: "Gast hinzufügen" },
    { selector: "[data-m325-add-portal-person]", label: "Portaluser suchen" },
    { selector: "[data-m325-delete-list]", label: "Liste löschen", danger: true }
  ], "Aktionen für Mitfahrerliste");
  if (menu) card.insertBefore(menu, actions);

  for (const member of card.querySelectorAll(":scope > .v4-m325-member")) polishMember(member);
}

function polishNewList(workspace) {
  const listSection = workspace.querySelector('[aria-labelledby="m325CompanionListsTitle"]');
  const title = workspace.querySelector("#m325CompanionListsTitle");
  const newList = workspace.querySelector(".v4-m325-new-list");
  const form = newList?.querySelector("[data-m325-list-form]");
  if (!(listSection instanceof HTMLElement)
      || !(title instanceof HTMLElement)
      || !(newList instanceof HTMLElement)
      || !(form instanceof HTMLFormElement)) return;

  newList.classList.add("m327-new-list-panel");
  const ownHeading = newList.querySelector(":scope > h3");
  if (ownHeading instanceof HTMLElement) ownHeading.hidden = true;

  if (workspace.dataset.m327NewListPolished !== "true") {
    workspace.dataset.m327NewListPolished = "true";
    const headingRow = document.createElement("div");
    headingRow.className = "m327-companion-section-heading";
    title.parentNode?.insertBefore(headingRow, title);
    headingRow.append(title);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "button small secondary m327-new-list-toggle";
    toggle.textContent = "+ Liste";
    toggle.setAttribute("aria-expanded", "false");
    headingRow.append(toggle);

    newList.hidden = true;
    toggle.addEventListener("click", () => {
      const nextOpen = newList.hidden;
      newList.hidden = !nextOpen;
      toggle.setAttribute("aria-expanded", String(nextOpen));
      toggle.textContent = nextOpen ? "Schließen" : "+ Liste";
      if (nextOpen) requestAnimationFrame(() => form.querySelector("input[name=name]")?.focus());
    });
  }
}

function polishCompanionDialog() {
  const form = document.querySelector("[data-m325-member-form]");
  if (!(form instanceof HTMLFormElement)) return;

  const textarea = form.querySelector('textarea[name="operationalNote"]');
  if (textarea instanceof HTMLTextAreaElement) textarea.rows = 3;

  const first = form.querySelector('input[name="firstName"]');
  const last = form.querySelector('input[name="lastName"]');
  if (!(first instanceof HTMLInputElement)
      || !(last instanceof HTMLInputElement)
      || !first.readOnly
      || !last.readOnly
      || form.dataset.m327LinkedPolished === "true") return;

  form.dataset.m327LinkedPolished = "true";
  const firstLabel = first.closest("label");
  const lastLabel = last.closest("label");
  if (firstLabel instanceof HTMLElement) firstLabel.classList.add("m327-linked-name-field");
  if (lastLabel instanceof HTMLElement) lastLabel.classList.add("m327-linked-name-field");

  const info = [...form.querySelectorAll("p.subtle")].find(node => /Portaluser/i.test(node.textContent || ""));
  if (info instanceof HTMLElement) info.hidden = true;

  const summary = document.createElement("div");
  summary.className = "m327-linked-person-summary v4-field-full";
  const name = document.createElement("strong");
  name.textContent = `${first.value} ${last.value}`.trim() || "Portaluser";
  const meta = document.createElement("span");
  meta.textContent = "Portaluser · Name wird aus dem Profil übernommen";
  summary.append(name, meta);
  form.insertBefore(summary, firstLabel || form.firstChild);
}

function polishWorkspace() {
  const workspace = document.querySelector(".v4-m325-companion-workspace");
  if (workspace instanceof HTMLElement) {
    const header = workspace.querySelector(":scope > .v4-m325-workspace-header");
    const back = header?.querySelector("[data-m325-back]");
    const intro = header?.querySelector("p");
    if (back instanceof HTMLButtonElement) back.textContent = "← Zurück";
    if (intro instanceof HTMLElement) intro.textContent = "Gespeicherte Personen dienen als Vorlage für zukünftige Buchungen.";

    polishNewList(workspace);
    for (const card of workspace.querySelectorAll(".v4-m325-list-card")) polishList(card);
  }
  polishCompanionDialog();
}

function injectStyles() {
  if (document.getElementById(M327_COMPANION_LISTS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = M327_COMPANION_LISTS_STYLE_ID;
  style.textContent = `
    .v4-m325-companion-workspace .m327-companion-original-actions{display:none!important}
    .v4-m325-companion-workspace{gap:10px!important}
    .v4-m325-companion-workspace>.v4-m325-workspace-header{display:grid!important;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:10px!important}
    .v4-m325-companion-workspace>.v4-m325-workspace-header>.button{width:auto!important;min-height:38px!important;padding:7px 10px!important;white-space:nowrap}
    .v4-m325-companion-workspace>.v4-m325-workspace-header h2{margin:0}
    .v4-m325-companion-workspace>.v4-m325-workspace-header p{margin:3px 0 0;color:var(--muted)}
    .v4-m325-companion-workspace .m327-companion-section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
    .v4-m325-companion-workspace .m327-companion-section-heading>h3{margin:0}
    .v4-m325-companion-workspace .m327-new-list-toggle{flex:0 0 auto;width:auto!important;min-height:36px;padding:6px 10px;white-space:nowrap}
    .v4-m325-companion-workspace .m327-new-list-panel{gap:6px!important;padding:10px!important;border-radius:13px;margin-top:2px}
    .v4-m325-companion-workspace .m327-new-list-panel[hidden]{display:none!important}
    .v4-m325-companion-workspace .m327-new-list-panel form{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end;gap:8px!important}
    .v4-m325-companion-workspace .m327-new-list-panel form>label.v4-field-full{grid-column:1!important;min-width:0;margin:0}
    .v4-m325-companion-workspace .m327-new-list-panel .v4-detail-actions.v4-field-full{grid-column:2!important;width:auto;min-width:0;margin:0;align-self:end}
    .v4-m325-companion-workspace .m327-new-list-panel input{width:100%!important;min-width:0}
    .v4-m325-companion-workspace .m327-new-list-panel .button{width:auto!important;white-space:nowrap}
    .v4-m325-companion-workspace .m327-companion-list-tappable{position:relative;gap:0!important;padding:0!important;overflow:visible}
    .v4-m325-companion-workspace .m327-companion-list-head{display:block;min-width:0;padding:11px 50px 9px 11px;cursor:pointer;border-radius:13px}
    .v4-m325-companion-workspace .m327-companion-list-head:focus-visible,.v4-m325-companion-workspace .m327-companion-member-tappable:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:-3px}
    .v4-m325-companion-workspace .m327-companion-list-collapsed>.v4-m325-member,.v4-m325-companion-workspace .m327-companion-list-collapsed>p.subtle{display:none!important}
    .v4-m325-companion-workspace .m327-companion-list-collapsed{background:var(--surface,#fff)}
    .v4-m325-companion-workspace .m327-companion-member-tappable{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px!important;margin:0 9px;padding:9px 40px 9px 2px!important;border-top:1px solid var(--line);cursor:pointer}
    .v4-m325-companion-workspace .m327-companion-member-tappable>.v4-m325-record-copy{min-width:0}
    .v4-m325-companion-workspace .m327-companion-menu{position:relative;z-index:5}
    .v4-m325-companion-workspace .m327-companion-list-tappable>.m327-companion-menu{position:absolute;top:7px;right:8px}
    .v4-m325-companion-workspace .m327-companion-member-tappable>.m327-companion-menu{position:absolute;top:7px;right:0}
    .v4-m325-companion-workspace .m327-companion-menu>summary{list-style:none}
    .v4-m325-companion-workspace .m327-companion-menu>summary::-webkit-details-marker{display:none}
    .v4-m325-companion-workspace .m327-companion-menu-toggle{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--line);border-radius:9px;background:var(--surface,#fff);color:var(--text);font-size:1.4rem;font-weight:800;line-height:1;cursor:pointer;user-select:none}
    .v4-m325-companion-workspace .m327-companion-menu[open]>.m327-companion-menu-toggle{border-color:color-mix(in srgb,var(--primary) 35%,var(--line));background:color-mix(in srgb,var(--primary) 7%,#fff)}
    .v4-m325-companion-workspace .m327-companion-menu-panel{position:absolute;top:calc(100% + 5px);right:0;z-index:20;display:grid;min-width:min(220px,calc(100vw - 72px));padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--surface,#fff);box-shadow:0 12px 32px rgba(15,38,63,.16)}
    .v4-m325-companion-workspace .m327-companion-menu-action{display:block;width:100%;min-height:40px;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;font-size:.82rem;font-weight:700;text-align:left;cursor:pointer}
    .v4-m325-companion-workspace .m327-companion-menu-action:hover,.v4-m325-companion-workspace .m327-companion-menu-action:focus-visible{background:var(--surface-soft,#f5f7fa);outline:none}
    .v4-m325-companion-workspace .m327-companion-menu-action.danger{color:var(--danger,#a91f2d)}
    .v4-m325-companion-workspace .m327-companion-menu-action:disabled{opacity:.4;cursor:not-allowed}
    [data-m325-member-form] .m327-linked-name-field{display:none!important}
    [data-m325-member-form] .m327-linked-person-summary{display:grid;gap:2px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-soft,#f5f7fa)}
    [data-m325-member-form] .m327-linked-person-summary strong{font-size:1rem;line-height:1.2}
    [data-m325-member-form] .m327-linked-person-summary span{font-size:.78rem;line-height:1.3;color:var(--muted)}
    [data-m325-member-form] textarea[name="operationalNote"]{min-height:82px!important;max-height:150px}
    @media(max-width:700px){
      .v4-m325-companion-workspace{gap:8px!important}
      .v4-m325-companion-workspace>.v4-m325-workspace-header{gap:8px!important}
      .v4-m325-companion-workspace>.v4-m325-workspace-header>.button{min-height:34px!important;padding:6px 8px!important;font-size:.76rem;line-height:1.05}
      .v4-m325-companion-workspace>.v4-m325-workspace-header h2{font-size:1.08rem;line-height:1.08}
      .v4-m325-companion-workspace>.v4-m325-workspace-header p{font-size:.75rem;line-height:1.25}
      .v4-m325-companion-workspace .v4-m325-workspace-section{gap:5px}
      .v4-m325-companion-workspace .v4-m325-workspace-section>h3,.v4-m325-companion-workspace .m327-companion-section-heading>h3{font-size:.98rem;line-height:1.12}
      .v4-m325-companion-workspace .v4-m325-record-copy{gap:2px}
      .v4-m325-companion-workspace .v4-m325-record-copy>strong,.v4-m325-companion-workspace .v4-m325-person-title>strong{font-size:.91rem;line-height:1.13}
      .v4-m325-companion-workspace .v4-m325-record-copy>small{font-size:.72rem;line-height:1.22}
      .v4-m325-companion-workspace .m327-new-list-panel{padding:8px!important}
      .v4-m325-companion-workspace .m327-new-list-panel input{min-height:38px!important;padding:7px 9px!important;border-radius:11px;font-size:.8rem}
      .v4-m325-companion-workspace .m327-new-list-panel .button{min-height:38px!important;padding:7px 9px!important;font-size:.75rem}
    }
    @media(max-width:390px){
      .v4-m325-companion-workspace .m327-new-list-panel form{grid-template-columns:minmax(0,1fr)!important}
      .v4-m325-companion-workspace .m327-new-list-panel .v4-detail-actions.v4-field-full{grid-column:1!important;justify-self:start}
    }
  `;
  document.head.append(style);
}

export function setupM327CompanionListsPolish() {
  if (typeof document === "undefined") return;
  injectStyles();
  polishWorkspace();

  if (document.documentElement.dataset[M327_COMPANION_LISTS_OBSERVER_KEY] === "true") return;
  document.documentElement.dataset[M327_COMPANION_LISTS_OBSERVER_KEY] = "true";
  new MutationObserver(polishWorkspace).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("details.m327-companion-menu")) return;
    closeOtherMenus();
  });
}

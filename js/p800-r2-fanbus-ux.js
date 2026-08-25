const MOBILE_QUERY = "(max-width: 620px)";
const FILTER_LABELS = new Set(["Status", "Bus", "Zustiegsort", "Buswunsch", "Buspräferenz", "Zuordnung"]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buttonByText(root, text) {
  return [...root.querySelectorAll("button")].find(button => cleanText(button.textContent) === text) || null;
}

function setButtonTone(button, tone) {
  if (!button) return;
  button.classList.remove("primary", "secondary", "ghost", "danger");
  button.classList.add(tone);
}

function replaceExactText(root, from, to) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (cleanText(node.nodeValue) === from) node.nodeValue = node.nodeValue.replace(from, to);
  }
}

function normalizeFanbusCopy(root) {
  replaceExactText(root, "Mitfahrer verwalten", "Teilnehmer verwalten");
  replaceExactText(root, "Buspräferenz", "Buswunsch");
  replaceExactText(root, "Portalnutzer", "Person aus dem Portal");

  root.querySelectorAll(".badge,.v4-person-badge").forEach(badge => {
    if (cleanText(badge.textContent) === "Portaluser") badge.remove();
  });

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = cleanText(node.nodeValue);
    if (/^Hauptperson · Portal · Buspräferenz:/i.test(text)) {
      node.nodeValue = text.replace(/^Hauptperson · Portal · Buspräferenz:/i, "Buswunsch:");
    } else if (/^Hauptperson · Portal · Buswunsch:/i.test(text)) {
      node.nodeValue = text.replace(/^Hauptperson · Portal · Buswunsch:/i, "Buswunsch:");
    }
  }
}

function fixZeroOccupancy(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = cleanText(node.nodeValue);
    if (/^\/\s*\d+\s*Plätze$/i.test(text)) {
      node.nodeValue = node.nodeValue.replace(/^\s*\//, "0 /");
    }
  }
}

function enhanceActionHierarchy(root) {
  const heading = cleanText(root.querySelector("h2")?.textContent);

  if (heading === "Belegung") {
    setButtonTone(buttonByText(root, "Teilnehmer anzeigen"), "primary");
    setButtonTone(buttonByText(root, "Bus anlegen"), "secondary");
  }

  if (heading === "Teilnehmer und Anmeldungen") {
    const exportButton = buttonByText(root, "Excel exportieren");
    const addButton = buttonByText(root, "Mitfahrer hinzufügen") || buttonByText(root, "Teilnehmer hinzufügen");
    if (exportButton) setButtonTone(exportButton, "secondary");
    if (addButton) {
      addButton.textContent = "Teilnehmer hinzufügen";
      setButtonTone(addButton, "primary");
    }
  }
}

function labelCaption(label) {
  const clone = label.cloneNode(true);
  clone.querySelectorAll("input,select,textarea,button").forEach(control => control.remove());
  return cleanText(clone.textContent);
}

function enhanceFilterForm(form) {
  if (!window.matchMedia(MOBILE_QUERY).matches || form.dataset.p800FilterEnhanced === "true") return;

  const labels = [...form.querySelectorAll(":scope > label")];
  const filterLabels = labels.filter(label => FILTER_LABELS.has(labelCaption(label)));
  if (filterLabels.length < 2) return;

  const details = document.createElement("details");
  details.className = "p800-fanbus-filter-disclosure";
  details.dataset.p800FilterDetails = "";

  const summary = document.createElement("summary");
  summary.className = "button secondary p800-fanbus-filter-summary";
  summary.textContent = "Filter";

  const body = document.createElement("div");
  body.className = "p800-fanbus-filter-body";
  filterLabels.forEach(label => body.appendChild(label));
  details.append(summary, body);
  form.appendChild(details);
  form.dataset.p800FilterEnhanced = "true";

  const updateSummary = () => {
    let active = 0;
    body.querySelectorAll("select").forEach(select => {
      if (select.value && select.value !== "ALL") active += 1;
    });
    summary.textContent = active ? `Filter · ${active}` : "Filter";
  };

  details.addEventListener("change", updateSummary);
  updateSummary();
}

function enhanceFilters(root) {
  if (!window.matchMedia(MOBILE_QUERY).matches) return;

  root.querySelectorAll("form").forEach(form => {
    const hasSearch = Boolean(form.querySelector('input[type="search"]'));
    const captions = [...form.querySelectorAll(":scope > label")].map(labelCaption);
    const matchingFilters = captions.filter(caption => FILTER_LABELS.has(caption)).length;
    if (hasSearch && matchingFilters >= 2) enhanceFilterForm(form);
  });
}

function injectStyles() {
  if (document.getElementById("p800R2FanbusUxStyles")) return;
  const style = document.createElement("style");
  style.id = "p800R2FanbusUxStyles";
  style.textContent = `
    .v4-m310-inline-trip-detail-row>td{padding:0!important;border-top:0!important}
    .v4-m310-inline-trip-detail-row>td{background:var(--surface,#fff)}
    .v4-m310-inline-trip-detail-shell{margin:0;padding:14px 0 0;border:0;border-radius:0;background:transparent;box-shadow:none}
    .v4-m310-inline-trip-detail-row .v4-m310-inline-trip-detail-shell{margin:0 8px 12px;padding:14px}
    .v4-m310-inline-trip-detail .v4-m325-trip-lifecycle,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-lifecycle,
    .v4-m310-inline-trip-detail .v4-m325-trip-date,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-date,
    .v4-m310-inline-trip-detail .v4-m325-trip-venue,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-venue,
    .v4-m310-inline-trip-detail .v4-m325-trip-opponent,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-opponent{display:none}
    .v4-m310-mobile-trip-card{overflow:hidden;border:1px solid var(--line,#d8e2ee);border-radius:18px;background:var(--surface,#fff)}
    .v4-m310-mobile-trip-card>.v4-m310-mobile-trip{width:100%;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
    .v4-m310-mobile-trip-card.is-expanded>.v4-m310-mobile-trip{border-bottom:1px solid var(--line,#d8e2ee)!important}
    .v4-m310-mobile-trip-card>.v4-m310-inline-trip-detail{margin:0;padding:0 14px 14px;background:transparent}
    .v4-m310-mobile-trip-card>.v4-m310-inline-trip-detail .v4-m325-trip-detail{margin:0}
    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}
    .v4-m325-trip-registration-deadline{display:grid;gap:3px;margin:16px 0 4px;padding-top:14px;border-top:1px solid var(--line,#d8e2ee)}
    .v4-m325-trip-registration-deadline>span{font-size:.78rem;font-weight:800;letter-spacing:.08em;color:var(--muted,#718096)}
    .v4-m325-trip-registration-deadline>strong{font-size:1rem}
    .v4-m310-trip-nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;overflow:visible!important}
    .v4-m310-trip-nav .button{width:100%;min-width:0;white-space:normal!important}
    .v4-m310-more-actions{margin-top:12px;border-top:1px solid var(--line,#d8e2ee);padding-top:10px}
    .v4-m310-more-actions>summary{cursor:pointer;font-weight:700;color:var(--muted,#718096);list-style:none;padding:8px 2px}
    .v4-m310-more-actions>summary::-webkit-details-marker{display:none}
    .v4-m310-more-actions>summary::after{content:"›";float:right;transition:transform .15s ease}
    .v4-m310-more-actions[open]>summary::after{transform:rotate(90deg)}
    .v4-m310-more-actions .v4-m310-trip-management{display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 0;border:0;background:transparent}
    .v4-m310-editor-context{display:grid;gap:3px;margin-bottom:4px}
    .v4-m310-editor-context>strong{font-size:1.05rem}
    .v4-m310-editor-context>span,.v4-m310-editor-context-note{color:var(--muted,#718096)}
    .v4-m310-trip-editor-form{display:grid;gap:16px;margin-top:14px}
    .v4-m310-editor-section{display:grid;gap:12px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff)}
    .v4-m310-editor-section h3{margin:0}
    .v4-m310-editor-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .v4-m310-editor-fields>label,.v4-m310-trip-stop-editor-row>label,.v4-m310-trip-default-stop{display:grid;gap:6px;min-width:0;font-weight:700}
    .v4-m310-editor-fields input,.v4-m310-editor-fields select,.v4-m310-trip-stop-editor-row input,.v4-m310-trip-stop-editor-row select,.v4-m310-trip-default-stop select{width:100%;min-width:0}
    .v4-m310-editor-deadline,.v4-m310-editor-open,.v4-m310-registration-open-info,.v4-m310-bus-preference-toggle{grid-column:1/-1}
    .v4-m310-registration-open-info{display:grid;gap:3px;padding:10px 12px;border-radius:10px;background:var(--surface-soft,#f5f7fa)}
    .v4-m310-registration-open-info>span{font-size:.8rem;color:var(--muted,#718096)}
    .v4-m310-bus-preference-toggle{display:flex!important;align-items:flex-start;gap:10px;padding:10px 0}
    .v4-m310-bus-preference-toggle input{width:20px!important;min-width:20px!important;margin-top:2px}
    .v4-m310-bus-preference-toggle span{display:grid;gap:2px}
    .v4-m310-bus-preference-toggle small{font-weight:400;color:var(--muted,#718096)}
    .v4-m310-editor-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .v4-m310-editor-section-heading h3,.v4-m310-editor-section-heading p{margin:0}
    .v4-m310-trip-stop-editor-list{display:grid;gap:10px}
    .v4-m310-trip-stop-editor-row{display:grid;grid-template-columns:minmax(0,1fr) 112px auto;gap:8px;align-items:end;padding:10px;border:1px solid var(--line,#d8e2ee);border-radius:12px}
    .v4-m310-trip-stop-editor-row.is-removed{opacity:.65}
    .v4-m310-trip-stop-remove{min-height:44px}
    .v4-m310-trip-default-stop{margin-top:2px}
    .v4-m310-fanbus-settings{display:grid;gap:16px}
    .v4-m310-settings-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .v4-m310-settings-section-heading h3,.v4-m310-settings-section-heading p{margin:0}
    .v4-m310-master-stop-settings-list{display:grid;gap:10px}
    .v4-m310-master-stop-card{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line,#d8e2ee);border-radius:12px}
    .v4-m310-master-stop-card>div{display:grid;gap:2px;min-width:0}
    .v4-m310-master-stop-card small{color:var(--muted,#718096)}
    .v4-m310-master-stop-active{display:flex!important;align-items:center;gap:8px}
    @media (max-width:620px){
      .v4-m310-editor-fields{grid-template-columns:1fr}
      .v4-m310-editor-deadline,.v4-m310-editor-open,.v4-m310-registration-open-info,.v4-m310-bus-preference-toggle{grid-column:auto}
      .v4-m310-editor-section{padding:12px}
      .v4-m310-editor-section-heading,.v4-m310-settings-section-heading{display:grid;grid-template-columns:1fr}
      .v4-m310-editor-section-heading .button,.v4-m310-settings-section-heading .button{width:100%}
      .v4-m310-trip-stop-editor-row{grid-template-columns:minmax(0,1fr) 108px}
      .v4-m310-trip-stop-remove{grid-column:1/-1;justify-self:end}
      .v4-m310-master-stop-card{grid-template-columns:minmax(0,1fr) auto}
      .v4-m310-master-stop-card>.button{grid-column:1/-1;width:100%}
      .p800-fanbus-filter-disclosure{grid-column:1/-1;width:100%;margin:2px 0 0}
      .p800-fanbus-filter-summary{display:flex!important;align-items:center;justify-content:center;list-style:none;cursor:pointer;width:100%;min-height:46px}
      .p800-fanbus-filter-summary::-webkit-details-marker{display:none}
      .p800-fanbus-filter-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
      .p800-fanbus-filter-body>label{min-width:0}
      .p800-fanbus-filter-body>label:last-child:nth-child(odd){grid-column:1/-1}
    }
    @media (max-width:390px){
      .p800-fanbus-filter-body{grid-template-columns:1fr}
      .p800-fanbus-filter-body>label:last-child:nth-child(odd){grid-column:auto}
    }
  `;
  document.head.appendChild(style);
}

function enhance(root = document) {
  injectStyles();
  normalizeFanbusCopy(root);
  fixZeroOccupancy(root);
  enhanceActionHierarchy(root);
  enhanceFilters(root);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance(document);
  });
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.matchMedia(MOBILE_QUERY).addEventListener?.("change", scheduleEnhance);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleEnhance, { once: true });
} else {
  scheduleEnhance();
}

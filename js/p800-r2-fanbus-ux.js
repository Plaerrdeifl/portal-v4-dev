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
    .v4-m310-inline-trip-detail,.v4-m310-inline-trip-detail-row>td{background:var(--surface,#fff)}
    .v4-m310-inline-trip-detail-shell{margin:0 0 14px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff);box-shadow:0 8px 24px rgba(22,43,70,.08)}
    .v4-m310-inline-trip-detail-row .v4-m310-inline-trip-detail-shell{margin:0 8px 12px}
    .v4-m310-inline-trip-detail-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .v4-m310-inline-trip-detail-heading>div{display:grid;gap:2px;min-width:0}
    .v4-m310-inline-trip-detail-heading small{color:var(--ink-500)}
    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}
    @media (max-width:620px){
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

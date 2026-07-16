import { call, empty, errorPanel, escapeAttr, escapeHtml, fmtMoney, fmtNumber, loading } from "./common.js";
import { navigate } from "../router.js";
import { auth } from "../auth.js";
import { storage } from "../storage.js";

const DASHBOARD_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const ICONS = Object.freeze({
  system: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M6 11h3l2-4 3 8 2-4h2"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
  backup: '<svg viewBox="0 0 24 24"><path d="M5 4h14l2 4v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8l2-4Z"/><path d="M3 9h18M8 13h8M9 17h6"/></svg>',
  audit: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
  money: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M17 15h.01M8 12h8"/></svg>',
  teams: '<svg viewBox="0 0 24 24"><path d="M8 11 3 6l3-3 5 5M16 11l5-5-3-3-5 5M8 13l-5 5 3 3 5-5M16 13l5 5-3 3-5-5"/></svg>',
  tasks: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
});

function iconFor(key) {
  if (["admin-system"].includes(key)) return ICONS.system;
  if (["pending-members", "admin-applications", "member-profile", "my-account"].includes(key)) return ICONS.users;
  if (key === "admin-backup") return ICONS.backup;
  if (key === "admin-audit") return ICONS.audit;
  if (["account-balances", "contribution-summary", "member-contribution"].includes(key)) return ICONS.money;
  if (["member-teams", "team-list", "team-status"].includes(key)) return ICONS.teams;
  if (["team-tasks", "board-tasks"].includes(key)) return ICONS.tasks;
  return ICONS.profile;
}

function toneFor(key) {
  if (["pending-members", "admin-applications"].includes(key)) return "tone-yellow";
  if (["admin-backup", "account-balances", "member-contribution"].includes(key)) return "tone-blue";
  if (["admin-audit", "board-tasks"].includes(key)) return "tone-purple";
  if (["team-tasks"].includes(key)) return "tone-red";
  if (["member-teams", "team-list", "team-status"].includes(key)) return "tone-teal";
  return "tone-green";
}

function valueLine(label, value) { return `<span class="widget-value-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`; }
function badge(value, type = "") { return `<span class="dashboard-value-badge ${escapeAttr(type)}">${escapeHtml(value)}</span>`; }

function dataMarkup(widget) {
  const data = widget.data || {};
  const key = widget.key;
  if (data.text) return `<p>${escapeHtml(data.text)}</p>`;
  if (key === "my-account") return `${badge(data.title || "Portaluser", "info")}${data.subtitle ? `<small>${escapeHtml(data.subtitle)}</small>` : ""}`;
  if (key === "member-contribution") return data.empty ? `<p>${escapeHtml(data.text || "Keine Beitragsdaten.")}</p>` : `${badge(data.status || "–", data.status === "OFFEN" ? "warning" : "")}${valueLine("Offen", fmtMoney(data.open))}`;
  if (key === "member-profile") return data.empty ? `<p>${escapeHtml(data.text || "Kein Profil.")}</p>` : `${badge(data.status || "Aktiv")}${data.joined ? `<small>Mitglied seit ${escapeHtml(data.joined)}</small>` : ""}`;
  if (["member-teams", "team-list", "team-status"].includes(key)) return `${badge(`${fmtNumber(data.count || 0)} Teams`, "info")}<small>${(data.items || []).map(escapeHtml).join(" · ") || "Keine Teams zugeordnet."}</small>`;
  if (key === "team-tasks") return `${badge(`${fmtNumber(data.count || 0)} offen`, data.count ? "warning" : "")}${data.items?.length ? `<small>${data.items.map(escapeHtml).join(" · ")}</small>` : ""}`;
  if (key === "board-tasks") return `${badge(`${fmtNumber(data.count || 0)} Aufgaben`, "purple")}${data.latest ? `<small>${escapeHtml(data.latest)}</small>` : ""}`;
  if (key === "account-balances") return `${badge(fmtMoney(data.total || 0), "info")}<div class="widget-values">${(data.items || []).slice(0, 2).map(item => valueLine(item.label, fmtMoney(item.value))).join("")}</div>`;
  if (["pending-members", "admin-applications"].includes(key)) return `<span class="dashboard-count-bubble">${fmtNumber(data.count || 0)}</span>${data.latest ? `<small>${escapeHtml(data.latest)}</small>` : ""}`;
  if (key === "contribution-summary") return `${badge(`${fmtNumber(data.open || 0)} offen`, data.open ? "warning" : "")}${valueLine("Bezahlt", fmtNumber(data.paid || 0))}`;
  if (key === "admin-system") return `${badge(data.status || "R7.1-Schema und Router aktiv")}${data.warnings ? badge(`${fmtNumber(data.warnings)} Hinweise`, "warning") : ""}`;
  if (key === "admin-backup") return data.empty ? badge(data.text || "Noch kein Backup protokolliert.", "info") : `${badge(data.title || "Backup", "info")}${data.timestamp ? `<small>${escapeHtml(data.timestamp)}</small>` : ""}`;
  if (key === "admin-audit") return `${badge(`${fmtNumber(data.count || 0)} Einträge`, "purple")}${data.latest ? `<small>${escapeHtml(data.latest)}</small>` : ""}`;
  if (data.empty) return `<p>${escapeHtml(data.text || "Noch keine Daten verfügbar.")}</p>`;
  return empty("Noch keine Daten verfügbar.");
}

function targetParts(value) { const [route, tab] = String(value || "").split(":"); return { route, tab }; }
function cacheKey() { return `pd:r71:dashboard:${auth.current().user?.userId || "anonymous"}`; }
function readCached() {
  const cached = storage.get(cacheKey(), null);
  if (!cached || !cached.savedAt || !cached.payload) return null;
  if (Date.now() - Number(cached.savedAt) > DASHBOARD_CACHE_MAX_AGE_MS) return null;
  return cached.payload;
}
function writeCached(payload) { storage.set(cacheKey(), { savedAt: Date.now(), payload }); }

function bindTargets() {
  document.querySelectorAll("[data-widget-target]").forEach(card => {
    const open = () => {
      const { route, tab } = targetParts(card.dataset.widgetTarget);
      if (!route) return;
      const params = new URLSearchParams();
      if (tab) params.set("tab", tab);
      navigate(route, params);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
}

function updateHeroConnection() {
  const state = document.getElementById("dashboardConnectionState");
  const time = document.getElementById("dashboardConnectionTime");
  if (state) state.textContent = navigator.onLine ? "Sicher verbunden" : "Offline verfügbar";
  if (time) time.textContent = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function render(payload, target, status, label) {
  const widgets = payload?.widgets || [];
  if (target) {
    target.innerHTML = widgets.length ? widgets.map(widget => {
      const clickable = Boolean(widget.clickTarget);
      return `<article class="dashboard-widget widget-${escapeAttr(String(widget.size || "M").toLowerCase())} ${toneFor(widget.key)} ${clickable ? "is-clickable" : ""}" ${clickable ? `data-widget-target="${escapeAttr(widget.clickTarget)}" role="button" tabindex="0"` : ""}>
        <span class="dashboard-widget-icon" aria-hidden="true">${iconFor(widget.key)}</span>
        <div class="dashboard-widget-main"><div class="dashboard-widget-head"><h3>${escapeHtml(widget.label || widget.key)}</h3><p>${escapeHtml(widget.description || "")}</p></div><div class="dashboard-widget-body">${dataMarkup(widget)}</div></div>
        <span class="dashboard-widget-side"><span class="dashboard-widget-arrow" aria-hidden="true">›</span></span>
      </article>`;
    }).join("") : empty("Für deine Rolle sind noch keine Dashboard-Widgets aktiv.");
  }
  bindTargets();
  updateHeroConnection();
  if (status) { status.textContent = label || `${widgets.length} Widget${widgets.length === 1 ? "" : "s"}`; status.className = "status-pill success"; }
}

async function refreshDashboard(target, status, cached) {
  try {
    const payload = await call("apiGetMyDashboard");
    writeCached(payload);
    if (!target?.isConnected || !String(location.hash || "").startsWith("#/dashboard")) return;
    const suffix = payload.cacheHit ? "Backend-Cache" : "Aktualisiert";
    render(payload, target, status, `${(payload.widgets || []).length} Widgets · ${suffix}`);
  } catch (error) {
    if (!target?.isConnected || !String(location.hash || "").startsWith("#/dashboard")) return;
    if (!cached) {
      target.innerHTML = errorPanel(error, "Dashboard konnte nicht geladen werden");
      if (status) { status.textContent = "Fehler"; status.className = "status-pill warning"; }
    } else if (status) {
      status.textContent = "Sofortansicht · Aktualisierung fehlgeschlagen";
      status.className = "status-pill warning";
    }
  }
}

export async function hydrateDashboard() {
  const target = document.getElementById("dashboardWidgets");
  const status = document.getElementById("dashboardStatus");
  updateHeroConnection();
  const cached = readCached();
  if (cached) {
    render(cached, target, status, "Sofortansicht · wird aktualisiert");
    window.setTimeout(() => refreshDashboard(target, status, cached), 80);
    return;
  }
  if (target) target.innerHTML = loading("Dashboard-Widgets werden geladen …");
  await refreshDashboard(target, status, null);
}

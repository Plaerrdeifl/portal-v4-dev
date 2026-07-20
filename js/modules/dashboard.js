import { call, errorPanel, escapeHtml } from "./common.js";

function widget(icon, value, title, description) {
  return `<article class="card v4-metric-card"><span class="v4-metric-icon" aria-hidden="true">${icon}</span><div><strong>${escapeHtml(value ?? "–")}</strong><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div></article>`;
}

export async function hydrateDashboard(context = {}) {
  const panel = document.getElementById("dashboardWidgets");
  const status = document.getElementById("dashboardStatus");
  if (!panel) return;
  try {
    const data = await call("dashboard");
    if (context.isCurrent && !context.isCurrent()) return;
    panel.innerHTML = [
      widget("✅", data.openTaskCount, "Offene Aufgaben", "Aufgaben, die für dich sichtbar sind."),
      widget("🤝", data.teamCount, "Deine Teams", "Aktive Teammitgliedschaften."),
      data.memberCount === null ? "" : widget("👥", data.memberCount, "Aktive Mitglieder", "Aktueller Fanclub-Bestand."),
      data.pendingRequestCount === null ? "" : widget("🔐", data.pendingRequestCount, "Offene Anträge", "Freischaltungen warten auf Prüfung."),
      data.office ? widget("🏒", data.office.label, "Dein Amt", "Aktuell zugeordneter Amtsplatz.") : ""
    ].filter(Boolean).join("");
    if (!panel.innerHTML) panel.innerHTML = widget("✓", "Bereit", "Portal aktiv", "Dein Zugang ist vollständig eingerichtet.");
    if (status) { status.textContent = "Aktuell"; status.className = "status-pill success"; }
    const time = document.getElementById("dashboardConnectionTime");
    if (time) time.textContent = "Gerade eben";
  } catch (error) {
    panel.innerHTML = errorPanel(error);
    if (status) { status.textContent = "Fehler"; status.className = "status-pill error"; }
  }
}

export function noop() {}

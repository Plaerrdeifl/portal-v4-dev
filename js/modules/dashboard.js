import { call, canRead, empty, errorPanel, fmtMoney, fmtNumber, loading, statCard } from "./common.js";

export async function hydrateDashboard() {
  const statsTarget = document.getElementById("dashboardStats");
  const quickTarget = document.getElementById("dashboardQuickLinks");
  const status = document.getElementById("dashboardStatus");
  if (statsTarget) statsTarget.innerHTML = loading("Kennzahlen werden geladen …");
  try {
    const payload = await call("apiGetStartStats");
    const stats = payload?.stats || payload || {};
    if (statsTarget) statsTarget.innerHTML = [
      statCard("Aktive Mitglieder", fmtNumber(stats.mitgliederAktiv || stats.mitglieder), "👥"),
      statCard("Offene Beiträge", fmtNumber(stats.beitraegeOffen), "💶"),
      statCard("Offener Betrag", fmtMoney(stats.beitraegeOffenBetrag), "📌"),
      statCard("Kontosumme", fmtMoney(stats.kontoSumme), "🏦"),
      statCard("Buchungen", fmtNumber(stats.buchungen), "📒"),
      statCard("Offene Aufgaben", fmtNumber(stats.aufgabenOffen), "✅"),
      statCard("Teams", fmtNumber(stats.teams), "👥")
    ].join("");
    if (quickTarget) {
      const links = [
        canRead("Mitglieder") && ["fanclub", "Mitglieder öffnen", "👤", "members"],
        canRead("Beiträge") && ["fanclub", "Beiträge öffnen", "💶", "contributions"],
        canRead("Kasse") && ["fanclub", "Kasse öffnen", "📒", "cashbook"],
        canRead("Aufgaben") && ["fanclub", "Aufgaben öffnen", "✅", "tasks"],
        canRead("Teams") && ["teams", "Teams öffnen", "👥", "overview"]
      ].filter(Boolean);
      quickTarget.innerHTML = links.length ? links.map(([route, label, icon, tab]) => `<button class="admin-action" type="button" data-route="${route}" data-open-tab="${tab}"><strong>${icon} ${label}</strong><span>Direkt zum Fachbereich wechseln.</span></button>`).join("") : empty("Für deinen Benutzer sind keine weiteren Verwaltungsbereiche freigeschaltet.");
    }
    if (status) { status.textContent = "Live verbunden"; status.className = "status-pill success"; }
  } catch (error) {
    if (statsTarget) statsTarget.innerHTML = errorPanel(error, "Dashboard konnte nicht geladen werden");
    if (status) { status.textContent = "Fehler"; status.className = "status-pill warning"; }
  }
}

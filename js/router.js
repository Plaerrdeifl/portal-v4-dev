const ROUTES = Object.freeze({
  home: { title: "Start", subtitle: "Phase-1-Grundlage", page: "home.html", icon: "🏠" },
  login: { title: "Anmeldung", subtitle: "Google-Login wird in Phase 2 verbunden", page: "login.html", icon: "🔐" },
  dashboard: { title: "Dashboard", subtitle: "Modulplatzhalter", page: "dashboard.html", icon: "📊" },
  fanclub: { title: "Fanclub", subtitle: "Modulplatzhalter", page: "fanclub.html", icon: "🏒" },
  teams: { title: "Teams", subtitle: "Modulplatzhalter", page: "teams.html", icon: "👥" },
  fanbus: { title: "Fanbusse", subtitle: "Modulplatzhalter", page: "fanbus.html", icon: "🚌" },
  admin: { title: "Admin-Bereich", subtitle: "Modulplatzhalter", page: "admin.html", icon: "⚙️" }
});

export function routes() { return ROUTES; }
export function currentRoute() {
  const key = String(location.hash || "#/home").replace(/^#\/?/, "").split(/[?&]/)[0] || "home";
  return ROUTES[key] ? key : "home";
}
export function navigate(key) {
  const target = ROUTES[key] ? key : "home";
  if (currentRoute() === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = `#/${target}`;
}

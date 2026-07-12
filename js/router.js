const ROUTES = Object.freeze({
  home: { title: "Start", subtitle: "Öffentlicher Bereich", page: "home.html", icon: "🏠", public: true },
  login: { title: "Anmeldung", subtitle: "Sicher mit Google anmelden", page: "login.html", icon: "🔐", public: true },
  dashboard: { title: "Dashboard", subtitle: "Deine persönliche Übersicht", page: "dashboard.html", icon: "🏠" },
  fanclub: { title: "Fanclub", subtitle: "Mitgliedschaft und Mitgliederverwaltung", page: "fanclub.html", icon: "👥" },
  cash: { title: "Kasse", subtitle: "Beiträge, Buchungen und Konten", page: "cash.html", icon: "💰" },
  teams: { title: "Teams", subtitle: "Teamübersicht, Aufgaben und Verwaltung", page: "teams.html", icon: "👥" },
  board: { title: "Vorstand", subtitle: "Mitgliedsanträge und Vorstandsaufgaben", page: "board.html", icon: "👔" },
  fanbus: { title: "Fanbus", subtitle: "v4-Erweiterungspunkt für das Bus-Modul", page: "fanbus.html", icon: "🚌" },
  admin: { title: "Administration", subtitle: "Portal-, Rollen- und Systemverwaltung", page: "admin.html", icon: "⚙️" }
});

export function routes() { return ROUTES; }

export function currentRoute() {
  const key = String(location.hash || "#/home").replace(/^#\/?/, "").split(/[?&]/)[0] || "home";
  return ROUTES[key] ? key : "home";
}

export function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

export function navigate(key, params = null) {
  const target = ROUTES[key] ? key : "home";
  const query = params instanceof URLSearchParams && String(params) ? `?${params}` : "";
  const next = `#/${target}${query}`;
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = next;
}

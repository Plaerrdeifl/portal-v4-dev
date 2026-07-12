const ROUTES = Object.freeze({
  home: { title: "Start", subtitle: "Persönlicher Portalzugang", page: "home.html", icon: "🏠", public: true },
  login: { title: "Anmeldung", subtitle: "Sicher mit Google anmelden", page: "login.html", icon: "🔐", public: true },
  dashboard: { title: "Dashboard", subtitle: "Echte Kennzahlen aus Apps Script", page: "dashboard.html", icon: "📊" },
  fanclub: { title: "Fanclub", subtitle: "Migration folgt in Phase 3", page: "fanclub.html", icon: "🏒" },
  teams: { title: "Teams", subtitle: "Migration folgt in Phase 3", page: "teams.html", icon: "👥" },
  fanbus: { title: "Fanbusse", subtitle: "Migration folgt nach dem Frontend-Grundausbau", page: "fanbus.html", icon: "🚌" },
  admin: { title: "Admin-Bereich", subtitle: "Migration folgt in Phase 3", page: "admin.html", icon: "⚙️" }
});

export function routes() { return ROUTES; }

export function currentRoute() {
  const key = String(location.hash || "#/home")
    .replace(/^#\/?/, "")
    .split(/[?&]/)[0] || "home";
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

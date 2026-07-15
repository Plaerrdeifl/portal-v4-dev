const ROUTES = Object.freeze({
  home: { title: "Start", subtitle: "Öffentlicher Bereich", page: "home.html", icon: "🏠", public: true, publicOrder: 10 },
  news: { title: "Aktuelles", subtitle: "Neuigkeiten der Schweinfurter Plärrdeifl", page: "news.html", icon: "📰", public: true, publicOrder: 20 },
  dates: { title: "Termine", subtitle: "Kommende Termine und Veranstaltungen", page: "dates.html", icon: "📅", public: true, publicOrder: 30 },
  about: { title: "Über uns", subtitle: "Die Schweinfurter Plärrdeifl", page: "about.html", icon: "🏒", public: true, publicOrder: 40 },
  contact: { title: "Kontakt", subtitle: "Kontakt zu den Schweinfurter Plärrdeifln", page: "contact.html", icon: "✉️", public: true, publicOrder: 50 },
  install: { title: "Portal installieren", subtitle: "Plärrdeifl Portal als App nutzen", page: "install.html", icon: "📱", public: true, publicOrder: 60 },
  login: { title: "Anmeldung", subtitle: "Sicher mit Google anmelden", page: "login.html", icon: "🔐", public: true, publicOrder: 70 },
  profile: { title: "Profil vervollständigen", subtitle: "Vorname und Nachname sind erforderlich", page: "profile.html", icon: "👤", system: true },
  dashboard: { title: "Dashboard", subtitle: "Deine persönliche Übersicht", page: "dashboard.html", icon: "🏠", order: 10 },
  fanclub: { title: "Fanclub", subtitle: "Mitglieder, Beiträge, Zahlungen und Finanzen", page: "fanclub.html", icon: "👥", order: 20 },
  tasks: { title: "Aufgaben", subtitle: "Eigene, Team- und Vorstandsaufgaben", page: "tasks.html", icon: "✅", order: 30 },
  teams: { title: "Teams", subtitle: "Teamübersicht, Mitgliedschaften und Funktionen", page: "teams.html", icon: "🤝", order: 40 },
  fanbuses: { title: "Fanbusse", subtitle: "Informationsseite; Fachfunktionen folgen in v4", page: "fanbuses.html", icon: "🚌", order: 50 },
  admin: { title: "Administration", subtitle: "Fanclub- und Portalverwaltung", page: "admin.html", icon: "⚙️", order: 60 }
});

const LEGACY = Object.freeze({
  cash: { target: "fanclub", tab: "contributions" },
  board: { target: "tasks", tab: "board" },
  fanbus: { target: "fanbuses", tab: "" }
});

export function routes() { return ROUTES; }
export function fixedAuthenticatedOrder() { return ["dashboard", "fanclub", "tasks", "teams", "fanbuses", "admin"]; }

export function rawRoute() {
  return String(location.hash || "#/home").replace(/^#\/?/, "").split(/[?&]/)[0] || "home";
}

export function currentRoute() {
  const raw = rawRoute();
  return LEGACY[raw]?.target || (ROUTES[raw] ? raw : "home");
}

export function legacyRouteRedirect() {
  const raw = rawRoute();
  const alias = LEGACY[raw];
  if (!alias) return false;
  const params = routeParams();
  if (alias.tab && !params.has("tab")) params.set("tab", alias.tab);
  navigate(alias.target, params, true);
  return true;
}

export function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

export function navigate(key, params = null, replace = false) {
  const target = ROUTES[key] ? key : "home";
  const query = params instanceof URLSearchParams && String(params) ? `?${params}` : "";
  const next = `#/${target}${query}`;
  if (replace) history.replaceState(null, "", next);
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = next;
}

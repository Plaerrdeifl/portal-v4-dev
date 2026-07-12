const ROUTES = Object.freeze({
  home: { title: "Start", subtitle: "Öffentlicher Bereich", page: "home.html", icon: "🏠", public: true, publicOrder: 10 },
  news: { title: "Aktuelles", subtitle: "Neuigkeiten der Schweinfurter Plärrdeifl", page: "news.html", icon: "📰", public: true, publicOrder: 20 },
  dates: { title: "Termine", subtitle: "Kommende Termine und Veranstaltungen", page: "dates.html", icon: "📅", public: true, publicOrder: 30 },
  about: { title: "Über uns", subtitle: "Die Schweinfurter Plärrdeifl", page: "about.html", icon: "🏒", public: true, publicOrder: 40 },
  contact: { title: "Kontakt", subtitle: "Kontakt zu den Schweinfurter Plärrdeifln", page: "contact.html", icon: "✉️", public: true, publicOrder: 50 },
  install: { title: "Portal installieren", subtitle: "Plärrdeifl Portal als App nutzen", page: "install.html", icon: "📱", public: true, publicOrder: 60 },
  login: { title: "Anmeldung", subtitle: "Sicher mit Google anmelden", page: "login.html", icon: "🔐", public: true, publicOrder: 70 },
  dashboard: { title: "Dashboard", subtitle: "Deine persönliche Übersicht", page: "dashboard.html", icon: "🏠" },
  fanclub: { title: "Fanclub", subtitle: "Mitgliedschaft und Mitgliederverwaltung", page: "fanclub.html", icon: "👥" },
  cash: { title: "Kasse", subtitle: "Beiträge, Buchungen und Konten", page: "cash.html", icon: "💰" },
  teams: { title: "Teams", subtitle: "Teamübersicht, Aufgaben und Verwaltung", page: "teams.html", icon: "👥" },
  board: { title: "Vorstand", subtitle: "Mitgliedsanträge und Vorstandsaufgaben", page: "board.html", icon: "👔" },
  fanbus: { title: "Fanbus", subtitle: "Öffentlicher Platzhalter bis zum Bus-Modul in v4", page: "fanbus.html", icon: "🚌" },
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

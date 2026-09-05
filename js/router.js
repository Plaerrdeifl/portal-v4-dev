const ROUTES = Object.freeze({
  login: {
    title: "Anmeldung",
    subtitle: "Sicher mit Google anmelden",
    page: "",
    icon: "🔐",
    public: true,
    system: true
  },
  profile: {
    title: "Profil vervollständigen",
    subtitle: "Vorname und Nachname sind erforderlich",
    page: "profile.html",
    icon: "👤",
    system: true
  },
  dashboard: {
    title: "Dashboard",
    subtitle: "Deine persönliche Übersicht",
    page: "dashboard.html",
    icon: "🏠",
    order: 10
  },
  dates: {
    title: "Termine",
    subtitle: "Kommende Termine und Spieltage",
    page: "dates.html",
    icon: "📅",
    order: 15
  },
  fanclub: {
    title: "Fanclub",
    subtitle: "Mitglieder, Beiträge, Zahlungen und Finanzen",
    page: "fanclub.html",
    icon: "👥",
    order: 20
  },
  tasks: {
    title: "Aufgaben",
    subtitle: "Eigene, Team- und Vorstandsaufgaben",
    page: "tasks.html",
    icon: "✅",
    order: 30
  },
  teams: {
    title: "Teams",
    subtitle: "Teamübersicht, Mitgliedschaften und Funktionen",
    page: "teams.html",
    icon: "🤝",
    order: 40
  },
  liveticker: {
    title: "Liveticker",
    subtitle: "Teams, Kader und Spieltag",
    page: "liveticker-admin.html",
    icon: "🏒",
    order: 45
  },
  fanbuses: {
    title: "Fanbusse",
    subtitle: "Informationsseite; Fachfunktionen folgen in v4",
    page: "fanbuses.html",
    icon: "🚌",
    order: 50
  },
  "bus-orga": {
    title: "Bus-Orga",
    subtitle: "Fanbus-Verwaltungszentrale",
    page: "bus-orga.html",
    icon: "🚌",
    system: true
  },
  admin: {
    title: "Administration",
    subtitle: "Fanclub- und Portalverwaltung",
    page: "admin.html",
    icon: "⚙️",
    order: 60
  }
});

const LEGACY = Object.freeze({
  home: { target: "login", tab: "" },
  news: { target: "login", tab: "" },
  about: { target: "login", tab: "" },
  contact: { target: "login", tab: "" },
  install: { target: "login", tab: "" },
  cash: { target: "fanclub", tab: "contributions" },
  board: { target: "tasks", tab: "board" },
  fanbus: { target: "fanbuses", tab: "" }
});

export function routes() {
  return ROUTES;
}

export function fixedAuthenticatedOrder() {
  return [
    "dashboard",
    "dates",
    "fanclub",
    "tasks",
    "teams",
    "liveticker",
    "fanbuses",
    "admin"
  ];
}

export function rawRoute() {
  return String(location.hash || "#/login")
    .replace(/^#\/?/, "")
    .split(/[?&]/)[0]
    || "login";
}

export function currentRoute() {
  const raw = rawRoute();

  return LEGACY[raw]?.target
    || (ROUTES[raw] ? raw : "login");
}

export function legacyRouteRedirect() {
  const raw = rawRoute();
  const alias = LEGACY[raw];

  if (!alias) {
    return false;
  }

  const params = routeParams();

  if (alias.tab && !params.has("tab")) {
    params.set("tab", alias.tab);
  }

  navigate(alias.target, params, true);

  return true;
}

export function routeParams() {
  const hash = String(location.hash || "");

  const query = hash.includes("?")
    ? hash.slice(hash.indexOf("?") + 1)
    : "";

  return new URLSearchParams(query);
}

export function navigate(
  key,
  params = null,
  replace = false
) {
  const target = ROUTES[key] ? key : "login";

  const query =
    params instanceof URLSearchParams && String(params)
      ? "?" + String(params)
      : "";

  const next = "#/" + target + query;

  if (replace) {
    history.replaceState(null, "", next);
  }

  if (location.hash === next) {
    window.dispatchEvent(
      new HashChangeEvent("hashchange")
    );
  }
  else {
    location.hash = next;
  }
}

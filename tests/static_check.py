#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
checks = []


def add(name, ok, detail=""):
    checks.append({"name": name, "ok": bool(ok), "detail": str(detail)})


def text(relative):
    path = ROOT / relative
    try:
        return path.read_text(encoding="utf-8")
    except Exception as error:
        add(f"Lesen {relative}", False, error)
        return ""


required = [
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    "offline.html",
    "components/sidebar.html",
    "components/topbar.html",
    "css/m4-corr4.css",
    "css/m4-corr5.css",
    "css/m4-corr6.css",
    "js/app.js",
    "js/pages.js",
    "js/router.js",
    "js/auth.js",
    "js/config.js",
    "js/m4-corr3-ux.js",
    "js/m4-corr4-layout.js",
    "js/modules/profile.js",
    "js/modules/tasks.js",
    "js/modules/fanclub.js",
    "js/modules/teams.js",
    "js/modules/admin.js",
    "js/modules/fanbuses.js",
    "pages/home.html",
    "pages/login.html",
    "pages/profile.html",
    "pages/tasks.html",
    "pages/fanbuses.html",
]
for relative in required:
    add(f"Datei {relative}", (ROOT / relative).is_file())

idx = text("index.html")
manifest_text = text("manifest.webmanifest")
sw = text("service-worker.js")
router = text("js/router.js")
pages = text("js/pages.js")
auth = text("js/auth.js")
config = text("js/config.js")
app = text("js/app.js")
ui = text("js/ui.js")
corr3 = text("js/m4-corr3-ux.js")
corr4 = text("js/m4-corr4-layout.js")
corr5_css = text("css/m4-corr5.css")
corr6_css = text("css/m4-corr6.css")
home_page = text("pages/home.html")
tasks = text("js/modules/tasks.js")
teams = text("js/modules/teams.js")
fanclub = text("js/modules/fanclub.js")
admin = text("js/modules/admin.js")
fanbuses = text("js/modules/fanbuses.js")
login_page = text("pages/login.html")
profile_page = text("pages/profile.html")

try:
    manifest = json.loads(manifest_text)
    add("Manifest gültiges JSON", True)
except Exception as error:
    manifest = {}
    add("Manifest gültiges JSON", False, error)

add("Manifest standalone", manifest.get("display") == "standalone")
add("Manifest relativer Scope", manifest.get("scope") == "./")
add("Manifest relativer Start", str(manifest.get("start_url", "")).startswith("./#/"))
add("Manifest Icons 192 und 512", all(
    size in {icon.get("sizes") for icon in manifest.get("icons", [])}
    for size in ["192x192", "512x512"]
))

add("Sechs feste Hauptbereiche", 'return ["dashboard", "fanclub", "tasks", "teams", "fanbuses", "admin"]' in router)
for key in ["dashboard", "fanclub", "tasks", "teams", "fanbuses", "admin"]:
    add(f"Route {key}", re.search(rf"\b{key}:\s*\{{", router) is not None)
add("Kasse nur Legacy-Alias", 'cash: { target: "fanclub"' in router and not re.search(r"\bcash:\s*\{[^}]*page:", router))
add("Vorstand nur Legacy-Alias", 'board: { target: "tasks"' in router and not re.search(r"\bboard:\s*\{[^}]*page:", router))
add("Fanbus Alias zu Fanbusse", 'fanbus: { target: "fanbuses"' in router)

add("Echtes Lazy Loading", 'feature("./modules/' in pages and 'import("./modules/' not in pages)
add("Keine statischen Fachmodulimporte", not re.search(r"^import .*modules/", pages, re.M))
add("Authentifizierte Module werden vorladbar", "preloadAuthenticatedModules" in pages)

add("SW M4 Corr6 Cachekennung", "r71-m4-20260717-corr6" in sw)
add("SW cached Corr4 CSS", "./css/m4-corr4.css" in sw)
add("SW cached Corr4 JS", "./js/m4-corr4-layout.js" in sw)
add("SW cached Corr5 CSS", "./css/m4-corr5.css" in sw)
add("SW cached Corr6 CSS", "./css/m4-corr6.css" in sw)
add("SW cached öffentliche Startseite und Auth-Fragmente", "./pages/home.html" in sw and "./pages/login.html" in sw and "./pages/profile.html" in sw and "./pages/tasks.html" not in sw)
add("Keine API-/Bridge-Persistenz", '/exec(?:\\?|$)' in sw and 'url.searchParams.has("pwa")' in sw)
add("Navigation network-first", 'request.mode==="navigate"' in sw and 'fetch(request,{cache:"no-store"})' in sw)
add("Code und HTML network-first", '["script","style","document"]' in sw and 'cache:"no-store"' in sw)

add("Meta mobile-web-app-capable", '<meta name="mobile-web-app-capable" content="yes">' in idx)
add("Meta apple-mobile-web-app-capable", '<meta name="apple-mobile-web-app-capable" content="yes">' in idx)
add("GSI CSP gezielt", "https://accounts.google.com" in idx and "default-src *" not in idx)
add("Corr4 CSS eingebunden", "css/m4-corr4.css" in idx)
add("Corr5 CSS eingebunden", "css/m4-corr5.css" in idx)
add("Corr6 CSS eingebunden", "css/m4-corr6.css" in idx)
add("Corr4 JS eingebunden", "js/m4-corr4-layout.js" in idx)
add("Corr6 App-Build eingebunden", "20260717-r71-m4-corr6-public-fast-start" in idx)
add("Startseite sofort vorgerendert", "data-public-fast-start=\"true\"" in idx and "data-prerendered-public-home" in idx and "public-home-page" in idx)
add("Öffentliche Kopfzeile sofort vorgerendert", 'id=\"mobileMenuToggle\"' in idx and 'id=\"topbarSlot\"' in idx and "Öffentlicher Bereich" in idx)
add("Öffentliches Burger-Menü sofort vorgerendert", 'id=\"sidebar\"' in idx and 'id=\"mainNav\"' in idx and 'data-registration-route=\"true\"' in idx)
add("Kein direkter Loginbutton auf Startseite", "publicLoginButton" not in idx and "publicLoginButton" not in home_page)
add("Startseiten-Hinweis auf Burger-Menü", "public-menu-hint" in idx and "Menü oben links" in home_page)
add("Keine Backend-Preconnects beim öffentlichen Start", 'rel=\"preconnect\"' not in idx)

add("Corr6 Buildkennung", "2026.07.17-r7.1.m4-corr6-public-fast-start" in config)
add("Corr6 Service-Worker-Kennung", "corr6-public-fast-start" in config)
add("Profilzustand blockiert Fachzugriff", "requiresProfile()" in auth and "if (this.requiresProfile()) return false" in auth)
add("Registrierung mit getrennten Namen", "vorname:" in auth and "nachname:" in auth)
add("Profilvervollständigung bleibt erzwungen", "apiCompleteRequiredProfile" in auth)
add("Sitzung bleibt bei Transportfehler erhalten", "connectionPending: true" in auth and "Deine Anmeldung bleibt erhalten" in auth)

for label in ["Meine Aufgaben", "Teamaufgaben", "Vorstandsaufgaben", "Archiv"]:
    add(f"Aufgaben-Tab {label}", label in tasks)
add("Aufgabenstatus lokalisiert", all(value in tasks for value in [
    'OFFEN:"Offen"',
    'IN_BEARBEITUNG:"In Bearbeitung"',
    'ERLEDIGT:"Erledigt"',
    'ARCHIVIERT:"Archiviert"',
]))
add("Aufgabenprioritäten lokalisiert", all(value in tasks for value in [
    'EILT:"Eilt!"',
    'HOCH:"Hoch"',
    'NORMAL:"Normal"',
    'NIEDRIG:"Niedrig"',
]))

for label in ["Teamübersicht", "Meine Teams", "Teammitglieder verwalten", "Teamfunktionen"]:
    add(f"Teams-Tab {label}", label in teams)
for label in ["Mitglieder", "Beiträge", "Zahlungsmeldungen", "Kassenbuch", "Konten"]:
    add(f"Fanclub-Bereich {label}", label in fanclub)
for label in [
    "Fanclub-Ämter vergeben",
    "Beiträge und Beitragsklassen",
    "Saison und Jahresabschluss",
    "Fanclub-Einstellungen",
    "Benutzer",
    "Freischaltungsanträge",
    "Teams und Teamfunktionen",
    "Portalrollen und Rechte",
    "Navigation und Dashboard",
    "Backups",
    "Systemstatus",
    "System bereinigen",
]:
    add(f"Admin-Unterseite {label}", label in admin)

add("Fanbusse reine Information", "reine Informationsseite" in fanbuses and "keine v4-Fach-API" in fanbuses)
add("Login Corr3/Corr4 Struktur", "Willkommen zurück" in login_page and "auth-page" in login_page)
add("Profilseite vorhanden", "profile" in profile_page.lower())
add("Corr4 Kontomenü", "corr4AccountMenu" in corr4 and "Ansicht aktualisieren" in corr4 and "Abmelden" in corr4)
add("Corr4 horizontaler Scrollbalken", "corr4HorizontalScrollbar" in corr4 and "syncScrollBar" in corr4)
add("Corr4 Desktopgrenze", 'const DESKTOP = "(min-width: 861px)"' in corr4)
add("Corr5 durchgehender Auth-Hintergrund", "--corr5-auth-blue-1" in corr5_css and ".auth-page" in corr5_css)
add("Corr5 schmale Auth-Darstellung", "@media (max-width:520px)" in corr5_css and "grid-template-columns:minmax(0,1fr)" in corr5_css)
add("Corr5 Google-Breite begrenzt", ".google-signin-slot iframe" in corr5_css and "max-width:100%" in corr5_css)
add("Corr6 Burger auf öffentlichen Mobilseiten sichtbar", "html[data-route=\"home\"] #mobileMenuToggle" in corr6_css and "display:grid!important" in corr6_css)
add("Corr6 Startseitentext ohne Button", "public-menu-hint" in corr6_css and "Mit Google anmelden" not in home_page)
add("Öffentliche Routen bleiben ohne Auth erlaubt", "if (route.public) return true;" in app)
add("Auth wird routenabhängig initialisiert", "routeNeedsAuthentication" in app and "ensureAuthenticationForRoute" in app)
add("Öffentlicher Bootstrap ohne pauschales auth.initialize", "const authInitialization = auth.initialize()" not in app and "await handleRouteChange();" in app)
add("Öffentliche Fragmente werden getrennt vorgeladen", 'route.public && route.page !== "login.html"' in app)
add("Vorgerenderte Startseite bleibt beim Bootstrap sichtbar", "usesPrerenderedHome" in app and "data-prerendered-public-home" in idx)
add("Komponenten nutzen vorgerenderte Shell", "sidebarSlot?.hasChildNodes()" in ui and "topbarSlot?.hasChildNodes()" in ui)
add("Gespeicherte Sitzung bietet Portal öffnen", "auth.hasPersistedSession()" in ui and 'title: "Portal öffnen"' in ui)
add("Registrierung nur über Menü", "dataset.registrationRoute" in ui and 'intent: "register"' in ui)
add("Mobiles Menü trennt öffentliche Seiten und Zugang", "Öffentliche Seiten" in corr3 and "Anmeldung und Portal" in corr3 and "data-ux-register" in corr3)
add("Burger reagiert bereits vor Modul-Bootstrap", 'target.closest("#mobileMenuToggle")' in corr3)
add("Desktop-Menü reagiert bereits vor Modul-Bootstrap", 'target.closest("#mainNav [data-route]")' in corr3 and 'target.closest("[data-registration-route]")' in corr3)
add("Portal-öffnen-Label bleibt im mobilen Menü erhalten", 'clean(spans[spans.length - 1]?.textContent || button.textContent) || ROUTE_LABELS[key]' in corr3)
add("Registrierungsabsicht bleibt bis Login erhalten", 'loginIntent() === "register"' in corr3 and "Portalzugang anfordern" in corr3)
add("Öffentliche Startseite leitet nicht automatisch um", 'navigate(auth.requiresProfile() ? "profile" : "dashboard")' not in pages)

failed = [item for item in checks if not item["ok"]]
result = {
    "suite": "M4_FRONTEND_STATIC_CONTRACT",
    "total": len(checks),
    "passed": len(checks) - len(failed),
    "failed": len(failed),
    "status": "PASS" if not failed else "FAIL",
    "checks": checks,
}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(1 if failed else 0)

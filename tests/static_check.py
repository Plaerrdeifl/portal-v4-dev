#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT = Path(__file__).resolve().parents[2]
F = ROOT / "frontend"; B = ROOT / "backend"
checks=[]
def add(name, ok, detail=""):
    checks.append({"name":name,"ok":bool(ok),"detail":str(detail)})
def text(p): return p.read_text(encoding="utf-8") if p.exists() else ""
required=[
 "frontend/index.html","frontend/manifest.webmanifest","frontend/service-worker.js",
 "frontend/js/app.js","frontend/js/pages.js","frontend/js/router.js","frontend/js/auth.js",
 "frontend/js/modules/profile.js","frontend/js/modules/tasks.js","frontend/js/modules/fanclub.js",
 "frontend/js/modules/teams.js","frontend/js/modules/admin.js","frontend/js/modules/fanbuses.js",
 "frontend/pages/profile.html","frontend/pages/tasks.html","frontend/pages/fanbuses.html",
 "backend/28_R7_1_M4_PWA_NamePolicy.gs"
]
for rel in required: add("Datei "+rel,(ROOT/rel).is_file())
router=text(F/'js/router.js'); pages=text(F/'js/pages.js'); sw=text(F/'service-worker.js'); idx=text(F/'index.html')
auth=text(F/'js/auth.js'); tasks=text(F/'js/modules/tasks.js'); teams=text(F/'js/modules/teams.js')
fan=text(F/'js/modules/fanclub.js'); admin=text(F/'js/modules/admin.js'); name=text(B/'28_R7_1_M4_PWA_NamePolicy.gs')
webapp=text(B/'WebApp.gs'); login=text(B/'10_Google_Login.gs'); registry=text(B/'26_R7_1_M3_Api_Registry.gs')
add("Sechs feste Hauptbereiche", 'return ["dashboard", "fanclub", "tasks", "teams", "fanbuses", "admin"]' in router)
for key in ["dashboard","fanclub","tasks","teams","fanbuses","admin"]: add("Route "+key, re.search(rf'\b{key}:\s*\{{',router) is not None)
add("Kasse nur Legacy-Alias", 'cash: { target: "fanclub"' in router and not re.search(r'\bcash:\s*\{[^}]*page:',router))
add("Vorstand nur Legacy-Alias", 'board: { target: "tasks"' in router and not re.search(r'\bboard:\s*\{[^}]*page:',router))
add("Fanbus Alias zu Fanbusse", 'fanbus: { target: "fanbuses"' in router)
add("Echtes Lazy Loading", 'import("./modules/' not in pages and 'feature("./modules/' in pages)
add("Keine statischen Fachmodulimporte", not re.search(r'^import .*modules/',pages,re.M))
add("SW minimaler Shellcache", 'modules/' not in sw and 'pages/' not in sw)
add("SW M4 Cachekennung", 'r71-m4' in sw and 'm2' not in sw.lower() and 'm3' not in sw.lower())
add("Keine API/Bridge-Persistenz im SW", 'runtime' not in sw.lower() and 'pwa"))return' in sw.replace(' ',''))
add("Meta mobile-web-app-capable", '<meta name="mobile-web-app-capable" content="yes">' in idx)
add("Meta apple-mobile-web-app-capable", '<meta name="apple-mobile-web-app-capable" content="yes">' in idx)
add("GSI CSP gezielt", "https://accounts.google.com" in idx and "default-src *" not in idx)
add("Profilzustand erzwungen", 'PROFIL_VERVOLLSTAENDIGUNG_ERFORDERLICH' in name and 'requiresProfile()' in auth)
for code in ["NAME_BOTH_REQUIRED","NAME_FIRST_REQUIRED","NAME_LAST_REQUIRED","NAME_FALLBACK_FORBIDDEN","PROFILE_COMPLETION_REQUIRED","USER_NAME_REQUIRED_FOR_ACTIVATION"]:
    add("Fehlercode "+code, code in name or code in text(B/'02_Auth_Roles.gs'))
add("Keine E-Mail-Ableitung", 'split("@")' not in name and 'split(\'@\')' not in name)
add("Sessionname ohne Google/E-Mail-Fallback", 'name: user.name || ""' in login)
add("Google Vorbelegung getrennt", 'given_name' in name and 'family_name' in name)
add("Registrierungsnachweis kurzlebig", 'REGISTRATION_MINUTES: 20' in name and 'consumeRegistrationToken_' in name)
add("Profil-API-Gate", 'PROFILE_ALLOWED_APIS' in name and 'enforceDispatch_' in name and 'M4NamePolicy.enforceDispatch_' in registry)
add("Namensintegritätsprüfung", 'activeIncompleteIds' in name and 'protectedAdmins' in name)
add("Geschützte Admin-IDs", '"U-0001", "U-0009"' in name)
add("Normale Apps-Script-URL leitet zur PWA", 'return m4RenderPwaRedirect_();' in webapp)
add("Legacy-Renderer bleibt vorhanden", 'function v3RenderPortal_' in webapp)
for label in ["Meine Aufgaben","Teamaufgaben","Vorstandsaufgaben","Archiv"]: add("Aufgaben-Tab "+label,label in tasks)
for label in ["Teamübersicht","Meine Teams","Teammitglieder verwalten","Teamfunktionen"]: add("Teams-Tab "+label,label in teams)
for label in ["Mitglieder","Beiträge","Beitragszahlungsmeldungen","Kassenbuch","Konten"]: add("Fanclub-Bereich "+label,label in fan)
for label in ["Fanclub-Ämter vergeben","Beiträge und Beitragsklassen","Saison und Jahresabschluss","Fanclub-Einstellungen","Benutzer","Freischaltungsanträge","Teams und Teamfunktionen","Portalrollen und Rechte","Navigation und Dashboard","Backups","Systemstatus","System bereinigen"]:
    add("Admin-Unterseite "+label,label in admin)
add("Admin Namen required", 'name="vorname"' in admin and 'name="nachname"' in admin and admin.count('required maxlength="160"')>=2)
add("Fanbusse reine Information", 'keine v4-Fach-API' in text(F/'js/modules/fanbuses.js') and 'Busanmeldung' in text(F/'pages/fanbuses.html'))
add("Aufgabenstatus lokalisiert", all(x in tasks for x in ['OFFEN:"Offen"','IN_BEARBEITUNG:"In Bearbeitung"','ERLEDIGT:"Erledigt"','ARCHIVIERT:"Archiviert"']))
add("Aufgabenprioritäten lokalisiert", all(x in tasks for x in ['EILT:"Eilt!"','HOCH:"Hoch"','NORMAL:"Normal"','NIEDRIG:"Niedrig"']))
failed=[x for x in checks if not x['ok']]
result={"suite":"M4_STATIC_CONTRACT","total":len(checks),"passed":len(checks)-len(failed),"failed":len(failed),"status":"PASS" if not failed else "FAIL","checks":checks}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(1 if failed else 0)

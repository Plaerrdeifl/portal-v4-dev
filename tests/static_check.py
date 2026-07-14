from pathlib import Path
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
checks = []


def add(name, ok, detail=""):
    checks.append({"name": name, "ok": bool(ok), "detail": detail})


required = [
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    "js/app.js",
    "js/api.js",
    "js/auth.js",
    "js/google-identity.js",
    "js/pages.js",
    "js/router.js",
    "js/ui.js",
    "js/modules/dashboard.js",
    "js/modules/fanclub.js",
    "js/modules/teams.js",
    "js/modules/board.js",
    "js/modules/fanbus.js",
    "js/modules/admin.js",
    "pages/home.html",
    "pages/login.html",
    "pages/dashboard.html",
    "pages/fanclub.html",
    "pages/cash.html",
    "pages/teams.html",
    "pages/board.html",
    "pages/fanbus.html",
    "pages/admin.html",
]

for name in required:
    add("Datei " + name, (root / name).is_file())

manifest = json.loads((root / "manifest.webmanifest").read_text(encoding="utf-8"))
add("PWA standalone", manifest.get("display") == "standalone")
add("PWA Icons", len(manifest.get("icons", [])) >= 4)

config = (root / "js/config.js").read_text(encoding="utf-8")
add("Produktive Frontend-Adresse", "https://plaerrdeifl.github.io/portal/" in config)
add("Produktive Backend-Brücke", "?pwa=bridge" in config)

login = (root / "pages/login.html").read_text(encoding="utf-8")
home = (root / "pages/home.html").read_text(encoding="utf-8")
add("Google-Login-Slot", 'id="googleSignInButton"' in login)
add(
    "Öffentliche Landingpage",
    'id="publicLoginButton"' in home and 'id="publicAboutText"' in home,
)

auth = (root / "js/auth.js").read_text(encoding="utf-8")
add(
    "Direkter GIS-Login",
    "signInWithGoogleCredential" in auth and "loginWithGoogleCredential" in auth,
)

# R7-Performance: Die Sitzungswiederaufnahme erfolgt über den gemeinsamen
# Bootstrap-Aufruf. Ältere Frontend-Stände dürfen weiterhin resumeSession nutzen.
add(
    "Sitzungswiederaufnahme",
    "resumeSession" in auth or "api.bootstrap" in auth,
)

router = (root / "js/router.js").read_text(encoding="utf-8")
for route in ["dashboard", "fanclub", "cash", "teams", "board", "fanbus", "admin"]:
    add("Route " + route, re.search(rf"\b{route}\s*:", router) is not None)

sw = (root / "service-worker.js").read_text(encoding="utf-8")
for name in required:
    if name.startswith(("js/", "pages/")):
        add("Service-Worker " + name, ("./" + name) in sw)

alltext = "\n".join(
    p.read_text(encoding="utf-8", errors="ignore")
    for p in root.rglob("*.*")
    if p.suffix in {".js", ".html", ".json", ".webmanifest"}
)
add(
    "Kein Client Secret",
    not re.search(r'client[_-]?secret\s*[:=]\s*["\'][^"\']+', alltext, re.I),
)
add(
    "Keine Push-Fachfunktion",
    "PushManager" not in alltext and "pushManager.subscribe" not in alltext,
)

failed = [check for check in checks if not check["ok"]]
print(
    json.dumps(
        {
            "total": len(checks),
            "passed": len(checks) - len(failed),
            "failed": len(failed),
            "checks": checks,
        },
        ensure_ascii=False,
        indent=2,
    )
)
sys.exit(1 if failed else 0)

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        ERRORS.append(message)


def text(path: str) -> str:
    file_path = ROOT / path
    require(file_path.is_file(), f"Datei fehlt: {path}")
    return file_path.read_text(encoding="utf-8") if file_path.is_file() else ""


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            require(element_id not in self.ids, f"Doppelte HTML-ID: {element_id}")
            self.ids.add(element_id)
        attribute = "href" if tag == "link" else "src" if tag in {"script", "img"} else None
        if attribute and values.get(attribute):
            self.references.append(values[attribute] or "")


index = text("index.html")
parser = ReferenceParser()
parser.feed(index)

for reference in parser.references:
    if reference.startswith(("http://", "https://", "data:")):
        continue
    clean = reference.split("?", 1)[0].split("#", 1)[0]
    if not clean or clean == "./js/runtime-config.js":
        continue
    target = (ROOT / clean.removeprefix("./")).resolve()
    if target.suffix.lower() not in {".png", ".jpg", ".jpeg", ".ico", ".webp"}:
        require(target.is_file(), f"Referenzierte Datei fehlt: {reference}")

require("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" in index, "Supabase JS fehlt im Entry Point.")
require("./css/v4-core.css" in index, "V4-Core-CSS fehlt im Entry Point.")
require("script.google.com/macros" not in index, "Legacy Apps Script ist im Entry Point aktiv.")
require("google-identity.js" not in index, "Legacy Google GIS ist im Entry Point aktiv.")
require("upgrade-insecure-requests" not in index, "CSP würde lokale Supabase-HTTP-Verbindung hochstufen.")
require("https://*.supabase.co" in index, "Supabase-Cloud fehlt in connect-src.")
require("http://127.0.0.1:54321" in index, "Lokale Supabase-API fehlt in connect-src.")

package = json.loads(text("package.json"))
lock = json.loads(text("package-lock.json"))
require(package.get("type") == "module", "package.json muss ES-Module aktivieren.")
require(package.get("devDependencies", {}).get("supabase") == "2.109.1", "Supabase CLI ist nicht exakt gepinnt.")
require(lock.get("packages", {}).get("", {}).get("version") == package.get("version"), "package-lock Root-Version weicht ab.")

config = text("supabase/config.toml")
require('schemas = ["public", "graphql_public"]' in config, "Fachschemas dürfen noch nicht direkt exponiert werden.")
require("[auth.external.google]" in config, "Google-Provider-Konfiguration fehlt.")
require(re.search(r"\[auth\.email\][\s\S]*?enable_signup = false", config) is not None, "E-Mail-Signup muss deaktiviert sein.")
require("https://plaerrdeifl.github.io/portal/" in config, "GitHub-Pages-Redirect fehlt.")

migration = text("supabase/migrations/20260719230200_create_portal_core_api.sql")
for action in [
    "bootstrap", "submit_access_request", "claim_initial_admin", "dashboard",
    "admin_snapshot", "save_role", "set_role_capabilities", "save_user",
    "approve_request", "save_member", "save_offices", "teams_snapshot",
    "save_team_member", "tasks_snapshot", "save_task", "set_task_status"
]:
    require(f"when '{action}'" in migration, f"RPC-Aktion fehlt: {action}")

for path in ROOT.rglob("*.js"):
    if path.name == "runtime-config.example.js":
        continue
    content = path.read_text(encoding="utf-8")
    if path.relative_to(ROOT).as_posix() in {"js/google-identity.js", "js/m4-corr2-login-overlay.js", "js/m4-corr3-ux.js", "js/m4-corr4-layout.js"}:
        continue
    require("google.script.run" not in content, f"Aktiver Legacy-Aufruf in {path.relative_to(ROOT)}")

if ERRORS:
    print("STATIC CHECK FAILED")
    for error in ERRORS:
        print(f"- {error}")
    sys.exit(1)

print("STATIC CHECK OK")
print(f"Geprüfte lokale Referenzen: {len(parser.references)}")
print(f"Eindeutige HTML-IDs: {len(parser.ids)}")

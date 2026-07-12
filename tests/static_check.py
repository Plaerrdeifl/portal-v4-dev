from pathlib import Path
import json, re, sys
root=Path(__file__).resolve().parents[1]
checks=[]
def add(name, ok, detail=""): checks.append({"name":name,"ok":bool(ok),"detail":detail})
required=["index.html","manifest.webmanifest","service-worker.js","js/app.js","js/api.js","js/auth.js","js/google-identity.js","js/pages.js","js/modules/fanclub.js","js/modules/teams.js","js/modules/admin.js","pages/login.html"]
for name in required: add("Datei "+name,(root/name).is_file())
manifest=json.loads((root/"manifest.webmanifest").read_text(encoding="utf-8"))
add("PWA standalone",manifest.get("display")=="standalone")
add("PWA Icons",len(manifest.get("icons",[]))>=4)
config=(root/"js/config.js").read_text(encoding="utf-8")
add("Produktive Frontend-Adresse","https://plaerrdeifl.github.io/portal/" in config)
add("Produktive Backend-Brücke","?pwa=bridge" in config)
login=(root/"pages/login.html").read_text(encoding="utf-8")
add("Google-Login-Slot",'id="googleSignInButton"' in login)
auth=(root/"js/auth.js").read_text(encoding="utf-8")
add("Direkter GIS-Login","signInWithGoogleCredential" in auth and "loginWithGoogleCredential" in auth)
add("Sitzungswiederaufnahme","resumeSession" in auth)
alltext="\n".join(p.read_text(encoding="utf-8",errors="ignore") for p in root.rglob("*.*") if p.suffix in {".js",".html",".json",".webmanifest"})
add("Kein Client Secret",not re.search(r"client[_-]?secret\s*[:=]\s*[\"'][^\"']+",alltext,re.I))
add("Keine Push-Fachfunktion","PushManager" not in alltext and "pushManager.subscribe" not in alltext)
failed=[c for c in checks if not c["ok"]]
print(json.dumps({"total":len(checks),"passed":len(checks)-len(failed),"failed":len(failed),"checks":checks},ensure_ascii=False,indent=2))
sys.exit(1 if failed else 0)

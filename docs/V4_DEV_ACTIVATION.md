# Plärrdeifl Portal V4 – DEV-Betrieb

**Stand:** 7. August 2026

Diese Datei beschreibt die aktuelle DEV-Zielumgebung. Sie ist keine Anleitung für einen erst noch zukünftigen Erstaufbau.

## 1. DEV-Identität

Aktuelle DEV-Zielumgebung:

- Portal: `https://dev.plaerrdeifl.de/`
- Repository: `Plaerrdeifl/portal-v4-dev`
- Deployment-Branch: `main`
- Hosting: Cloudflare Pages
- Branch-Previews: `*.portal-v4-dev.pages.dev`
- P800-Release-Candidate vor Doku-Closeout: `7b7f076c54c9d923d122c5831aa8b6f06e55de8a`
- Supabase-Projekt: `plaerrdeifl-portal-dev`
- Supabase-Ref: `tpieykhhawszlzsoflnl`
- Supabase-URL: `https://tpieykhhawszlzsoflnl.supabase.co`

DEV und PROD sind strikt getrennt.

Der frühere GitHub-Pages-Workflow `.github/workflows/deploy-v4-dev-pages.yml` gehört nicht mehr zum aktuellen DEV-Betrieb und wurde im P800-Reparaturbranch entfernt.

## 2. Google-Login

Google OAuth ist der reale Loginpfad des Portals.

Die Supabase-Callback-URL für DEV lautet:

```text
https://tpieykhhawszlzsoflnl.supabase.co/auth/v1/callback
```

Für die Portal-Navigation müssen die verwendeten Ziel-URLs in der Supabase-Auth-Konfiguration zugelassen sein.

Dazu gehören je nach Testart insbesondere:

```text
https://dev.plaerrdeifl.de/
http://127.0.0.1:3000
http://localhost:3000
```

Google Client-ID und Client-Secret sind Geheimnisse und gehören weder in das Repository noch in Browser-Runtime-Dateien.

## 3. Browser-Runtime

Das Frontend benötigt ausschließlich browsergeeignete öffentliche Laufzeitwerte:

- Supabase URL
- Supabase Publishable Key
- Umgebungskennung

Der Publishable Key ist kein Service-Role-Schlüssel.

Der Service-Role-Schlüssel darf niemals im Frontend, im statischen Build oder in `runtime-config.js` verwendet werden.

## 4. Build und Deployment

Der statische Build wird über den Repository-Buildprozess erzeugt.

Für DEV wird eine DEV-spezifische Runtime-Konfiguration generiert.

Cloudflare Pages ist der aktive DEV-Deploymentpfad. Die GitHub-Integration erstellt Branch-Previews und übernimmt nach Integration nach `main` den DEV-Deploy.

Der alte GitHub-Pages-Workflow wurde entfernt; der Testvertrag stellt ausdrücklich sicher, dass er nicht wieder als DEV-Deploymentpfad eingeführt wird.

Die P800-Reparatur wurde lokal und remote verifiziert:

- vollständige Testsuite: 182/182
- Static-Check: bestanden
- Frontend-Check: bestanden
- Cloudflare-Preview: erfolgreich
- GitHub Actions: erfolgreich

## 5. Datenbankänderungen

Schema-, Funktions-, Rollen- und sonstige strukturrelevante Datenbankänderungen erfolgen ausschließlich über Dateien unter:

`supabase/migrations`

Direkte, nicht versionierte Cloud-Strukturänderungen sind kein zulässiger Normalprozess.

Vor einem DEV-Apply sollen neue Migrationen mindestens lokal über einen vollständigen:

```powershell
supabase db reset --local
```

gegen einen frischen lokalen Stand geprüft werden.

P800 hat die Repository-/DEV-Abweichung für `20260802211306_harden_pd_api_revoke_anon_execute` geschlossen und die neue Migration `20260807120000_harden_public_default_privileges` kontrolliert auf Supabase DEV angewendet.

## 6. Sicherheitsgrenze

Browserzugriff:

`authenticated -> public.pd_api(text,jsonb)`

Nicht zulässig:

`anon -> public.pd_api(text,jsonb)`

Interne Push-Servicefunktionen besitzen nur die konkret benötigten expliziten `service_role`-Rechte.

Neue von `postgres` erzeugte Datenbankobjekte erhalten nach der P800-Härtung keine pauschalen Rechte für Browser- oder Service-Rollen und kein automatisches Funktions-EXECUTE über `PUBLIC`.

## 7. P800-Reparaturstand

Reparaturbranch:

`fix/p800-dev-baseline-r1`

Reparatur-Worktree:

`C:\Projekte\PDAPP\frontend\portal-v4-dev-p800-r1`

Wesentliche bestätigte Stände:

- Baseline-Reparaturcommit: `03fd7286aac4fd53243a2b00e05cf0d9cb31e61f`
- GitHub-Pages-Workflow entfernt: `f86c7cd03bd2580db9f68d8791b6a2d5ef1d8a07`
- Deployment-Testvertrag korrigiert: `7b7f076c54c9d923d122c5831aa8b6f06e55de8a`

Supabase DEV ist für F01/F02 abgeglichen und nachgeprüft.

Der Reparaturbranch ist Release Candidate. Die endgültige P800-Freigabe erfolgt erst nach:

1. PR-Abnahme,
2. separat freigegebenem Merge nach `main`,
3. erfolgreichem Cloudflare-Deploy des `main`-Stands,
4. Live-Abnahme auf `https://dev.plaerrdeifl.de/`.

## 8. PROD-Schutz

DEV-Arbeiten dürfen PROD nicht implizit verändern.

Insbesondere dürfen folgende Aktionen nicht ohne eigenen Freigabeschritt stattfinden:

- PROD-Migration
- PROD-Deployment
- Änderung von PROD-Secrets
- Änderung von PROD-Auth-Konfiguration
- Push auf einen produktiven Zielpfad

P800 selbst besitzt keine automatische PROD-Freigabe.

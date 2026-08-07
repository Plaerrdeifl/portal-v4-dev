# Plärrdeifl Portal V4 – DEV-Betrieb

**Stand:** 7. August 2026

Diese Datei beschreibt die aktuelle DEV-Zielumgebung. Sie ist keine Anleitung für einen erst noch zukünftigen Erstaufbau.

## 1. DEV-Identität

Aktuelle DEV-Zielumgebung:

- Portal: `https://dev.plaerrdeifl.de/`
- Repository: `Plaerrdeifl/portal-v4-dev`
- Deployment-Branch: `main`
- geprüfter Deployment-Baseline-Commit: `2c77d1e4edbd398fa60bcbb707b55c46f53a448d`
- Supabase-Projekt: `plaerrdeifl-portal-dev`
- Supabase-Ref: `tpieykhhawszlzsoflnl`
- Supabase-URL: `https://tpieykhhawszlzsoflnl.supabase.co`

DEV und PROD sind strikt getrennt.

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

Der Service-Role-Schlüssel darf niemals im Frontend, im statischen Build, in `runtime-config.js` oder als öffentlich auslieferbare Pages-Variable verwendet werden.

## 4. Build

Der statische Build wird über den Repository-Buildprozess erzeugt.

Für DEV wird eine DEV-spezifische Runtime-Konfiguration generiert.

Der reproduzierbare P800-Baseline-Test für Commit `2c77d1e4edbd398fa60bcbb707b55c46f53a448d` ergab zwei identische Builds mit 61 Dateien und ohne Manifestabweichung.

## 5. Datenbankänderungen

Schema-, Funktions-, Rollen- und sonstige strukturrelevante Datenbankänderungen erfolgen ausschließlich über Dateien unter:

`supabase/migrations`

Direkte, nicht versionierte Cloud-Strukturänderungen sind kein zulässiger Normalprozess.

Vor einem DEV-Apply sollen neue Migrationen mindestens lokal über einen vollständigen:

```powershell
supabase db reset --local
```

gegen einen frischen lokalen Stand geprüft werden.

## 6. Sicherheitsgrenze

Browserzugriff:

`authenticated -> public.pd_api(text,jsonb)`

Nicht zulässig:

`anon -> public.pd_api(text,jsonb)`

Interne Push-Servicefunktionen besitzen nur die konkret benötigten expliziten `service_role`-Rechte.

Neue Datenbankobjekte erhalten nach der P800-Härtung keine pauschalen Rechte für Browser- oder Service-Rollen.

## 7. P800-Reparaturstand

Die P800-Reparatur wird isoliert auf `fix/p800-dev-baseline-r1` bearbeitet.

Der Reparatur-Worktree lautet:

`C:\Projekte\PDAPP\frontend\portal-v4-dev-p800-r1`

Die lokalen Reparaturmigrationen wurden erfolgreich gegen einen vollständigen lokalen Supabase-Neuaufbau geprüft.

Solange sie nicht committed, gepusht und ausdrücklich auf DEV angewendet wurden, verändern sie die DEV-Cloud nicht.

## 8. PROD-Schutz

DEV-Arbeiten dürfen PROD nicht implizit verändern.

Insbesondere dürfen folgende Aktionen nicht ohne eigenen Freigabeschritt stattfinden:

- PROD-Migration
- PROD-Deployment
- Änderung von PROD-Secrets
- Änderung von PROD-Auth-Konfiguration
- Push auf einen produktiven Zielpfad

P800 selbst besitzt keine automatische PROD-Freigabe.
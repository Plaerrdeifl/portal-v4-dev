# Plärrdeifl Portal V4

Aktuelle technische Referenz für das Plärrdeifl Portal V4.

**Stand:** 7. August 2026
**DEV:** `https://dev.plaerrdeifl.de/`
**DEV-Branch:** `main`
**P800-Reparaturbranch:** `fix/p800-dev-baseline-r1`
**P800-Release-Candidate vor Doku-Closeout:** `7b7f076c54c9d923d122c5831aa8b6f06e55de8a`
**Supabase DEV:** `tpieykhhawszlzsoflnl`
**DEV-Hosting:** Cloudflare Pages

## Aktueller Funktionsumfang

Das Portal ist ein statisches PWA-Frontend mit Supabase als Authentifizierungs-, Datenbank- und Serverplattform.

Der aktuelle Funktionsumfang umfasst insbesondere:

- Google-Login über Supabase Auth
- Freischaltungsanträge und manuelle Benutzerfreigabe
- dynamische Portalrollen und Berechtigungen
- Benutzer- und Mitgliedsverknüpfung
- Fanclub-Mitglieder und feste Amtsplätze
- Teams, Teamleitungen und Teammitgliedschaften
- Team- und Vorstandsaufgaben
- persönliche Aufgabeninformationen und Aufgabenhistorie
- Fanclub-Beiträge
- vollständige bestehende Fanclub-Finanzfunktionen
- Konten, Buchungen und zugehörige Auswertungen
- Audit- und Operationsdaten
- PWA-Unterstützung
- Web Push und Benachrichtigungseinstellungen
- responsive mobile, Tablet- und Desktop-Oberfläche

Die bestehenden Fanclub-Finanzfunktionen sind bereits funktionsfähig und produktiv veröffentlicht. Sie sind kein später noch zu entwickelndes Grundmodul.

Das zukünftige Fanbus-Modul wird als klar abgegrenzte Erweiterung entwickelt. Fanbusbezogene Zahlungen, Abrechnung und Auswertung dürfen an die bestehende Finanzstruktur angebunden werden, ohne die bestehende Finanzfunktion neu aufzubauen.

## Architektur

Der Browser greift nicht direkt auf Anwendungstabellen zu.

Die zentrale Browser-RPC-Grenze ist:

`public.pd_api(text, jsonb)`

Für die aktuelle Zielarchitektur gilt:

- `anon` darf `public.pd_api` nicht ausführen.
- `authenticated` darf `public.pd_api` ausführen.
- Fachliche Berechtigungen werden innerhalb der Datenbank anhand des aktuell angemeldeten Benutzers und seiner wirksamen Rechte geprüft.
- Anwendungstabellen liegen außerhalb des öffentlich exponierten API-Schemas.
- interne Funktionen sind nicht für Browserrollen freigegeben.
- benötigte serverseitige Push-RPCs werden ausdrücklich an `service_role` freigegeben.
- der Service-Role-Schlüssel wird niemals im Browser verwendet.
- Google-Profildaten dienen nicht zur Autorisierung.

Alle Datenbankänderungen erfolgen versioniert über SQL-Migrationen.

Nach P800 gilt für zukünftige von `postgres` erzeugte Objekte ein Default-Deny-Grundsatz:

- keine pauschalen Rechte für `anon`
- keine pauschalen Rechte für `authenticated`
- keine pauschalen Rechte für `service_role`
- kein automatisches `EXECUTE` auf neue Funktionen über `PUBLIC`

Benötigte Zugriffe müssen ausdrücklich per `GRANT` vergeben werden.

## Lokale Entwicklung

Voraussetzungen und Versionen werden über `package.json`, `package-lock.json` und die Supabase-Konfiguration festgelegt.

Typischer lokaler Neuaufbau:

```powershell
npm.cmd ci
npm.cmd run supabase:start
npm.cmd run supabase:db:reset
node .\scripts\write-runtime-config.mjs --url http://127.0.0.1:54321 --key "<LOKALER_PUBLISHABLE_KEY>" --environment LOCAL
npm.cmd run dev
```

Die Runtime-Konfiguration wird generiert und nicht als geheime Konfiguration committed.

## DEV und PROD

DEV und PROD sind strikt getrennte Zielumgebungen.

Aktuelle DEV-Zielidentität:

- Portal: `https://dev.plaerrdeifl.de/`
- Git-Branch: `main`
- Hosting/Deployment: Cloudflare Pages über die GitHub-Integration
- Supabase-Projekt: `plaerrdeifl-portal-dev`
- Supabase-Ref: `tpieykhhawszlzsoflnl`

Der frühere Repository-Workflow `.github/workflows/deploy-v4-dev-pages.yml` für GitHub Pages ist obsolet und wurde in P800 entfernt.

Der aktuelle P800-Reparaturstand ist als Release Candidate auf `fix/p800-dev-baseline-r1` verifiziert. Die endgültige DEV-Baseline wird erst nach Merge nach `main`, erfolgreichem Cloudflare-Deploy und Live-Abnahme von `https://dev.plaerrdeifl.de/` festgeschrieben.

PROD darf durch normale DEV-Arbeiten nicht verändert werden.

## Verbindliche Dokumentation

Aktuelle technische Referenzen:

- `docs/V4_CORE_IMPLEMENTATION.md`
- `docs/V4_DEV_ACTIVATION.md`
- `docs/DB_SCHEMA.md`
- `docs/SUPABASE_TARGET_ARCHITECTURE.md`
- `docs/P800_DEV_BASELINE_R1.md`
- `docs/UX_INTERACTION_STANDARD.md`

Ältere Phase-1-/Phase-2-Abnahmen und frühere Testberichte sind historische Projektdokumente. Sie beschreiben den damaligen Zwischenstand und sind nicht die aktuelle V4-Baseline.

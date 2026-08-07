# P800 – DEV-Baseline R1

**Stand:** 7. August 2026
**Projekt:** Plärrdeifl Portal V4
**DEV-URL:** `https://dev.plaerrdeifl.de/`
**DEV-Branch:** `main`
**geprüfter Baseline-Commit:** `2c77d1e4edbd398fa60bcbb707b55c46f53a448d`
**Supabase DEV:** `tpieykhhawszlzsoflnl`

## 1. Zweck

P800 prüft die vorhandene V4-DEV-Baseline vor dem Start weiterer Module.

Ziel ist der Nachweis, dass der bestehende Portalstand technisch stabil, sicher abgegrenzt, reproduzierbar und dokumentiert ist.

M210 bleibt gesperrt, bis die P800-Reparatur abgeschlossen, auf DEV nachvollziehbar angewendet und die Baseline erneut freigegeben wurde.

## 2. Geprüfte Identitäten

### Frontend DEV

- URL: `https://dev.plaerrdeifl.de/`
- Branch: `main`
- Baseline: `2c77d1e4edbd398fa60bcbb707b55c46f53a448d`

### Supabase DEV

- Projekt: `plaerrdeifl-portal-dev`
- Ref: `tpieykhhawszlzsoflnl`

### Supabase PROD

- Projekt: `plaerrdeifl-portal-prod`
- Ref: `wplescvhlgctynkfwvrj`

PROD wurde durch P800 nicht verändert.

### M000

M000 ist abgeschlossen und eingefroren.

Technischer Freeze:

`2b6da38722d389a2074b1ec1a186a438f2b39875`

Formaler Abschluss:

`97b1af34cf64e78f5dd5bf6b29025e0b856fd70f`

P800 verändert M000 nicht.

## 3. Auditblöcke

| Block | Inhalt | Ergebnis der Erstprüfung |
|---|---|---|
| B00 | Identität und DEV-Zuordnung | BESTANDEN |
| B01 | Repository, Toolchain, Tests und Build | BESTANDEN |
| B02 | Auth, Rollen, RLS und Security | FUNKTIONAL BESTANDEN |
| B03 | Portalbereiche und Finanzregression | BESTANDEN |
| B04 | Mobile, PWA, Cache und Push | BESTANDEN |
| B05 | Robustheit und Performance | BESTANDEN |
| B06 | Dokumentation und Reproduzierbarkeit | NICHT FREIGABEFÄHIG |

Der technische Portalbetrieb war stabil. Die Baseline-Freigabe wurde wegen Reproduzierbarkeits- und Dokumentationsabweichungen nicht erteilt.

## 4. B01 – reproduzierbarer Build

Ergebnisse:

- Node.js `v24.18.0`
- npm `12.0.1`
- `npm ci` erfolgreich
- Node-Tests erfolgreich
- statische Prüfungen erfolgreich
- Frontend-Prüfung erfolgreich
- Syntaxprüfung ohne Fehler
- zwei identische statische Builds
- jeweils 61 Builddateien
- keine Manifestabweichungen

Build-Fingerprint:

`7143223d3a124b8e4c1211dce4c9fb737eff028b988f26f6147e20dd5f3d0137`

## 5. Findings

### P800-F01 – HIGH – fehlende angewendete DEV-Migration

Auf DEV war bereits `20260802211306_harden_pd_api_revoke_anon_execute` wirksam, im Repository der Baseline fehlte die entsprechende Datei jedoch.

Lokale Reparatur:

`supabase/migrations/20260802211306_harden_pd_api_revoke_anon_execute.sql`

Status:

**lokal behoben und reproduzierbar geprüft**

Noch nicht committed, gepusht oder erneut mit DEV abgeglichen.

### P800-F02 – HIGH – permissive Default Privileges

DEV besaß für zukünftige Objekte im Schema `public` zu weit gefasste Default-Rechte.

Lokale Reparatur:

`supabase/migrations/20260807120000_harden_public_default_privileges.sql`

Zielmodell:

- `anon`: keine pauschalen Default-Rechte
- `authenticated`: keine pauschalen Default-Rechte
- `service_role`: keine pauschalen Default-Rechte
- `PUBLIC`: kein automatisches EXECUTE auf neue Funktionen
- benötigte Rechte nur durch explizite GRANTs

Der vollständige lokale Neuaufbau bestätigte:

```text
table_anon=false
table_authenticated=false
table_service_role=false
sequence_anon=false
sequence_authenticated=false
sequence_service_role=false
function_anon=false
function_authenticated=false
function_service_role=false
```

Die bestehenden benötigten Push-Funktionen blieben ausdrücklich erreichbar:

```text
push_validate_service_role=true
push_claim_service_role=true
push_complete_service_role=true
```

Status:

**lokal behoben und reproduzierbar geprüft**

Noch nicht committed, gepusht oder auf DEV angewendet.

### P800-F03 – MEDIUM – veraltete Kerndokumentation

Die Baseline-Dokumentation enthielt widersprüchliche historische Aussagen, darunter Finanzen als zukünftiges Modul, alter Entwicklungsbranch, alte Pages-URL, Google-Login als Zukunftsfunktion und die frühere Sheet-Struktur als scheinbar aktuelle DB-Dokumentation.

P800-R04 ersetzt die zentralen aktuellen Referenzen durch den geprüften Istzustand.

Status:

**mit P800-R04 lokal behoben, finale Git-/Releaseprüfung noch ausstehend**

### P800-F04 – MEDIUM – schreibender Aufgaben-Snapshot

`tasks_snapshot` kann abgelaufene Pending-Transfers bereinigen und dadurch beim Snapshot-Aufruf schreiben.

Kein aktueller Funktionsfehler. Spätere Folgearbeit: lesende Snapshot-Semantik und Maintenance-/Expiry-Logik klarer trennen.

### P800-F05 – MEDIUM – gezielte FK-Indizes vor Skalierung

Supabase meldet mehrere nicht indizierte Fremdschlüssel. Aufgrund der aktuell kleinen Datenmengen besteht kein gegenwärtiger Performance-Blocker.

Spätere Folgearbeit: Indizes anhand realer Zugriffsmuster gezielt ergänzen.

### P800-F06 – LOW – alte ausgelieferte JavaScript-Artefakte

`js/warmup.js` und `js/performance.js` befinden sich nicht im aktiven Anwendungspfad, werden vom aktuellen Build aber mit ausgeliefert.

Spätere Folgearbeit: sauber integrieren oder entfernen.

## 6. Reparatursequenz

### P800-R01

Isolierter Reparatur-Worktree:

`C:\Projekte\PDAPP\frontend\portal-v4-dev-p800-r1`

Branch:

`fix/p800-dev-baseline-r1`

Basis:

`2c77d1e4edbd398fa60bcbb707b55c46f53a448d`

Ergebnis: **BESTANDEN**

### P800-R02

Zwei Sicherheits-/Reproduzierbarkeitsmigrationen erstellt und fachlich korrigiert.

Ergebnis: **BESTANDEN**

### P800-R03

Vollständiger lokaler Supabase-Neuaufbau durchgeführt.

Nachgewiesen:

- beide P800-Migrationen werden erfolgreich angewendet
- `anon` bleibt von `pd_api` ausgeschlossen
- `authenticated` behält den vorgesehenen `pd_api`-Zugang
- Default-Deny für neue Tabellen
- Default-Deny für neue Sequenzen
- Default-Deny für neue Funktionen
- kein pauschaler Service-Role-Zugang
- benötigte Push-Service-Grants bleiben erhalten
- Testobjekte werden per Rollback vollständig entfernt

Ergebnis:

`P800_R03_LOCAL_MIGRATION_BASELINE_OK`

### P800-R04

Aktuelle technische Kerndokumentation wird auf den geprüften Istzustand gebracht.

Betroffene aktuelle Referenzen:

- `README.md`
- `docs/V4_CORE_IMPLEMENTATION.md`
- `docs/V4_DEV_ACTIVATION.md`
- `docs/DB_SCHEMA.md`
- `docs/P800_DEV_BASELINE_R1.md`

Historische Phase-1-/Phase-2-Dokumente werden nicht nachträglich inhaltlich umgeschrieben.

## 7. Aktueller Freigabestatus

Vor der endgültigen P800-Freigabe sind mindestens noch erforderlich:

1. Git-Diff und Dokumentationsumfang prüfen.
2. gesamte lokale Test-/Build-Baseline erneut ausführen.
3. Reparaturänderungen sauber committen.
4. freigegebenen Reparaturbranch pushen.
5. DEV-Migrationshistorie kontrolliert mit dem Repository abgleichen.
6. neue Default-Privilege-Migration auf DEV anwenden.
7. DEV-Sicherheitszustand erneut prüfen.
8. DEV-Build/Deployment kontrolliert aktualisieren, soweit der freigegebene Ablauf dies vorsieht.
9. abschließende P800-Freigabeentscheidung treffen.

Bis dahin:

```text
Technischer DEV-Betrieb:   STABIL
Lokale Reparatur:          IN ARBEIT
PROD:                      UNVERÄNDERT
M000:                      EINGEFROREN
M210:                      GESPERRT
P800-Freigabe:             NOCH NICHT ERTEILT
```

## 8. Historische Dokumente

Frühere Dateien wie `TEST_REPORT.md`, `PHASE1_ABNAHME.md` und `PHASE2_ABNAHME.md` bilden den damaligen Projektstand ab.

Sie bleiben als historische Nachweise erhalten, sind aber keine aktuelle technische Baseline.

Bei Widersprüchen ist für den heutigen V4-Stand diese P800-Dokumentation zusammen mit den aktuellen technischen Referenzdokumenten maßgeblich.
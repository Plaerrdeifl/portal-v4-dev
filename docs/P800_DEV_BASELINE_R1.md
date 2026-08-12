# P800 – DEV-Baseline R1

**Stand:** 7. August 2026
**Projekt:** Plärrdeifl Portal V4
**DEV-URL:** `https://dev.plaerrdeifl.de/`
**DEV-Branch:** `main`
**Main vor P800-Integration:** `2c77d1e4edbd398fa60bcbb707b55c46f53a448d`
**P800 Runtime-/Security-Reparaturbaseline:** `03fd7286aac4fd53243a2b00e05cf0d9cb31e61f`
**P800 Reparaturbranch vor Doku-Closeout:** `7b7f076c54c9d923d122c5831aa8b6f06e55de8a`
**Finale technische DEV-Baseline:** `55ffccb6b501dd5973ad044b885e3ef5a74ead00`
**Abschlussstatus:** `P800 FREIGEGEBEN`
**Supabase DEV:** `tpieykhhawszlzsoflnl`

## 1. Zweck

P800 prüft und stabilisiert die vorhandene V4-DEV-Baseline vor dem Start weiterer Module.

Die technische Reparatur, die Integration nach `main`, der Cloudflare-Deploy und die Live-Abnahme auf `https://dev.plaerrdeifl.de/` sind abgeschlossen. P800 ist final freigegeben. M210 ist für die nachfolgende Modulplanung entsperrt.

## 2. Geprüfte Identitäten

### Frontend DEV

- Repository: `Plaerrdeifl/portal-v4-dev`
- Zielbranch: `main`
- DEV-URL: `https://dev.plaerrdeifl.de/`
- aktiver Deploypfad: Cloudflare Pages über die GitHub-Integration
- Branch-Previews: `*.portal-v4-dev.pages.dev`
- der frühere GitHub-Pages-Workflow wurde als obsolet entfernt

### Supabase DEV

- Projekt: `plaerrdeifl-portal-dev`
- Ref: `tpieykhhawszlzsoflnl`
- URL: `https://tpieykhhawszlzsoflnl.supabase.co`

### Supabase PROD

- Projekt: `plaerrdeifl-portal-prod`
- Ref: `wplescvhlgctynkfwvrj`

PROD wurde durch P800 nicht verändert.

### M000

M000 ist abgeschlossen und eingefroren.

- technischer Freeze: `2b6da38722d389a2074b1ec1a186a438f2b39875`
- formaler Abschluss: `97b1af34cf64e78f5dd5bf6b29025e0b856fd70f`

P800 verändert M000 nicht.

## 3. Auditblöcke

| Block | Inhalt | Stand nach Reparatur |
|---|---|---|
| B00 | Identität und DEV-Zuordnung | BESTANDEN |
| B01 | Repository, Toolchain, Tests und Build | BESTANDEN |
| B02 | Auth, Rollen, RLS und Security | BESTANDEN |
| B03 | Portalbereiche und Finanzregression | BESTANDEN |
| B04 | Mobile, PWA, Cache und Push | BESTANDEN |
| B05 | Robustheit und Performance | BESTANDEN |
| B06 | Dokumentation und Reproduzierbarkeit | BESTANDEN |

## 4. Reproduzierbare Test-/Build-Baseline

Nachgewiesen wurden unter anderem:

- Node.js `v24.18.0`
- npm-Installationslauf erfolgreich
- vollständige Testsuite erfolgreich
- statische Prüfungen erfolgreich
- Frontend-Prüfung erfolgreich
- JavaScript-Syntaxprüfung erfolgreich
- zwei identische statische Builds mit jeweils 61 Dateien
- direkter Buildvergleich ohne Abweichung

Historischer Build-Fingerprint der geprüften Ausgangsbaseline:

`7143223d3a124b8e4c1211dce4c9fb737eff028b988f26f6147e20dd5f3d0137`

Für den finalen P800-Reparaturbranch wurden zusätzlich nach der Entfernung des obsoleten GitHub-Pages-Workflows erneut 182/182 Tests sowie Static- und Frontend-Checks erfolgreich ausgeführt.

## 5. Findings

### P800-F01 – HIGH – angewendete DEV-Migration fehlte im Repository

Auf DEV war `20260802211306_harden_pd_api_revoke_anon_execute` bereits wirksam, im Repository der Ausgangsbaseline fehlte die Datei.

Reparatur:

`supabase/migrations/20260802211306_harden_pd_api_revoke_anon_execute.sql`

Status: **BEHOBEN**

Die Migration ist versioniert im Reparaturstand enthalten. DEV-Migrationshistorie und Repository sind auf den exakten Zeitstempel `20260802211306` abgeglichen.

### P800-F02 – HIGH – permissive Default Privileges

Für zukünftige von `postgres` erzeugte Objekte im Schema `public` waren die Default-Rechte zu weit gefasst.

Reparatur:

`supabase/migrations/20260807120000_harden_public_default_privileges.sql`

Status: **BEHOBEN UND AUF DEV ANGEWENDET**

Auf DEV wurde nachgewiesen:

- kein pauschales Defaultrecht für `anon`
- kein pauschales Defaultrecht für `authenticated`
- kein pauschales Defaultrecht für `service_role`
- kein automatisches Funktions-EXECUTE über `PUBLIC`
- benötigte Push-Servicefunktionen behalten ihre expliziten `service_role`-Grants
- ein transaktionaler Future-Object-Probe bestätigte das Default-Deny-Modell und wurde vollständig zurückgerollt

Die Plattform-Defaults von `supabase_admin` wurden nicht verändert.

### P800-F03 – MEDIUM – veraltete Kerndokumentation

Mehrere zentrale Dokumente enthielten historische Aussagen als scheinbar aktuellen Stand.

Status: **BEHOBEN**

Aktuelle Referenzen wurden auf die reale V4-Architektur, Supabase DEV, bestehende Finanzfunktionen, Google-Login und den tatsächlichen Deploypfad aktualisiert.

### P800-F04 – MEDIUM – schreibender Aufgaben-Snapshot

`tasks_snapshot` kann abgelaufene Pending-Transfers bereinigen und dadurch beim Snapshot-Aufruf schreiben.

Status: **NICHT BLOCKIERENDE TECHNISCHE SCHULD**

### P800-F05 – MEDIUM – gezielte FK-Indizes vor Skalierung

Mehrere Fremdschlüssel sind aktuell nicht zusätzlich indiziert.

Status: **NICHT BLOCKIERENDE TECHNISCHE SCHULD**

Indizes sollen anhand realer Zugriffsmuster gezielt ergänzt werden.

### P800-F06 – LOW – alte ausgelieferte JavaScript-Artefakte

`js/warmup.js` und `js/performance.js` liegen nicht im aktiven Anwendungspfad, werden aber weiterhin ausgeliefert.

Status: **NICHT BLOCKIERENDE TECHNISCHE SCHULD**

### P800-F07 – HIGH – obsoleter GitHub-Pages-Deployworkflow

Im Repository existierte noch `.github/workflows/deploy-v4-dev-pages.yml`, obwohl DEV tatsächlich über Cloudflare Pages bereitgestellt wird.

Status: **BEHOBEN**

- Commit `f86c7cd03bd2580db9f68d8791b6a2d5ef1d8a07` entfernt den obsoleten Workflow.
- Der zugehörige veraltete Testvertrag wurde in Commit `7b7f076c54c9d923d122c5831aa8b6f06e55de8a` korrigiert.
- GitHub Actions und Cloudflare Pages waren auf `7b7f076...` erfolgreich.
- Cloudflare erzeugte erfolgreich die Branch-Preview für `fix/p800-dev-baseline-r1`.

## 6. Reparatursequenz

### P800-R01 bis R04

- isolierter Reparatur-Worktree und Branch erstellt
- beide P800-Migrationen ergänzt
- vollständiger lokaler Supabase-Neuaufbau erfolgreich
- zentrale Dokumentation auf die reale V4-Architektur umgestellt

Ergebnis: **BESTANDEN**

### P800-R05

Vollständige lokale Test-/Build-Abnahme:

- 182/182 Tests
- Static-Check
- Frontend-Check
- Syntaxprüfung
- zwei reproduzierbare Builds
- direkter Buildvergleich ohne Abweichung
- `git diff --check` ohne Fehler

Ergebnis: **BESTANDEN**

### P800-R06

Lokaler Reparaturcommit:

`03fd7286aac4fd53243a2b00e05cf0d9cb31e61f`

Ergebnis: **BESTANDEN**

### P800-R07

Reparaturcommit auf `v4dev/fix/p800-dev-baseline-r1` gepusht und remote verifiziert.

Ergebnis: **BESTANDEN**

### P800-R08

DEV-Migrationshistorie read-only geprüft.

Ergebnis: **BESTANDEN**

### P800-R09

Migration `20260807120000_harden_public_default_privileges` kontrolliert auf Supabase DEV angewendet und live verifiziert.

Ergebnis: **BESTANDEN**

### P800-R10A

Obsoleten GitHub-Pages-Workflow entfernt.

Commit:

`f86c7cd03bd2580db9f68d8791b6a2d5ef1d8a07`

Cloudflare-Branch-Preview erfolgreich.

### P800-R10B/R10C

Veralteten Deployment-Testvertrag ausschließlich in `tests/prod_safe_build.test.mjs` korrigiert.

Nachprüfung:

- gezielter Test: 6/6
- gesamte Testsuite: 182/182
- Static-Check: bestanden
- Frontend-Check: bestanden
- `git diff --check`: 0

Commit:

`7b7f076c54c9d923d122c5831aa8b6f06e55de8a`

Remote Checks:

- GitHub Actions: erfolgreich
- Cloudflare Pages: erfolgreich

### P800-R11

Abschlussdokumentation auf dem Reparaturbranch aktualisiert, als docs-only Commit verifiziert und Pull Request #10 gegen `main` erstellt.

Ergebnis: **BESTANDEN**

### P800-R12

Pull Request #10 wurde per Merge-Commit nach `main` integriert.

Finale technische DEV-Baseline:

`55ffccb6b501dd5973ad044b885e3ef5a74ead00`

Nachgewiesen:

- PR #10 erfolgreich gemergt
- `main` zeigt auf den erwarteten Merge-Commit
- GitHub Actions erfolgreich
- Cloudflare Pages erfolgreich
- `https://dev.plaerrdeifl.de/` erfolgreich erreichbar
- Live-Portal und Cloudflare-Deploy byte-identisch für Portal-HTML, Runtime-Konfiguration, Manifest und Service Worker
- Runtime-Umgebung: `DEV`
- Runtime-Supabase: `tpieykhhawszlzsoflnl`

Ergebnis: **BESTANDEN**

### P800-R13

Der formale P800-Abschluss wird mit diesem Dokumentationsschritt auf `main` festgeschrieben.

Festgelegter Endstatus:

- B00 bis B06: **BESTANDEN**
- P800: **ABGESCHLOSSEN / FREIGEGEBEN**
- M210: **ENTSPERRT**
- M000: **EINGEFROREN**
- PROD: **UNVERÄNDERT**

## 7. Finaler Freigabestatus

P800 ist nach technischer Reparatur, Sicherheitsabgleich, reproduzierbarer Test-/Build-Abnahme, Merge nach `main`, erfolgreichem Cloudflare-Deploy und erfolgreicher Live-DEV-Abnahme final freigegeben.

Die nicht blockierenden technischen Schulden P800-F04 bis P800-F06 bleiben als spätere Folgearbeiten bestehen und verhindern die Baseline-Freigabe nicht.

```text
Technischer DEV-Betrieb:   STABIL
Finale technische Baseline: 55ffccb6b501dd5973ad044b885e3ef5a74ead00
B00-B06:                   BESTANDEN
P800:                      ABGESCHLOSSEN / FREIGEGEBEN
M210:                      ENTSPERRT
M000:                      EINGEFROREN
PROD:                      UNVERÄNDERT
```

Mit diesem Stand darf die nachfolgende Modulplanung auf der freigegebenen DEV-Baseline fortgesetzt werden.

## 8. Historische Dokumente

Frühere Dateien wie `TEST_REPORT.md`, `PHASE1_ABNAHME.md` und `PHASE2_ABNAHME.md` bilden ihren damaligen Projektstand ab.

Sie bleiben als historische Nachweise erhalten, sind aber keine aktuelle technische Baseline. Bei Widersprüchen sind diese P800-Dokumentation und die aktuellen technischen Referenzdokumente maßgeblich.

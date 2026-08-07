# Plärrdeifl Portal V4 – aktuelle Core-Umsetzung

**Stand:** 7. August 2026
**DEV-URL:** `https://dev.plaerrdeifl.de/`
**DEV-Branch:** `main`
**geprüfte Baseline:** `2c77d1e4edbd398fa60bcbb707b55c46f53a448d`

## 1. Systemgrenze

Der aktive Portalpfad basiert auf:

- statischem PWA-Frontend
- Supabase Auth
- PostgreSQL
- SQL-Migrationen
- kontrollierter RPC-Schnittstelle
- optionalen Edge-/Push-Komponenten

Apps Script und Google Sheets sind keine aktive V4-Anwendungsdatenbank mehr. Alte Dateien oder Dokumentationen hierzu besitzen nur historischen Referenzwert.

## 2. Authentifizierung

Der reale Portal-Login erfolgt über Google OAuth und Supabase Auth.

Google-Profilinformationen dürfen für editierbare Namensvorschläge verwendet werden, sind aber keine Quelle für Rollen, Rechte oder sonstige Autorisierungsentscheidungen.

Portalzugang und Rollen werden aus dem aktuellen Datenbankzustand bestimmt.

Relevante Benutzerzustände sind insbesondere:

- `UNREGISTERED`
- `PENDING`
- `REJECTED`
- `ACTIVE`
- `INACTIVE`
- `BLOCKED`

Der erste administrative Zugang wird über den geschützten Bootstrap-Prozess eingerichtet.

## 3. Datenbank und RPC-Grenze

Anwendungsdaten liegen in getrennten Anwendungsschemas:

- `app_fanclub`
- `app_modules`
- `app_portal`
- `app_private`

Das Schema `public` dient nicht als allgemeiner Speicherort für Fachdatentabellen.

Der einzige allgemeine Browser-RPC-Einstieg ist:

`public.pd_api(text, jsonb)`

Berechtigungsmodell:

- `anon`: kein EXECUTE auf `pd_api`
- `authenticated`: EXECUTE auf `pd_api`
- interne Hilfs- und Routerfunktionen: nicht für Browserrollen
- benötigte Push-Servicefunktionen: ausschließlich explizit für `service_role`

Der Browser erhält keinen direkten Zugriff auf Anwendungstabellen.

RLS ist für die Fachdatentabellen aktiviert. Das Schutzmodell beruht zusätzlich auf fehlenden direkten Schema-/Tabellenrechten und der kontrollierten RPC-Grenze.

## 4. Portalbereiche

Der aktuelle Stand umfasst reale Funktionen und Daten für:

- Dashboard
- Profil und Registrierung
- Fanclub-Mitglieder
- Ämter
- Teams
- Aufgaben
- Administration
- Beiträge
- Finanzen
- Benachrichtigungen und Push

Nicht berechtigte Aktionen werden serverseitig anhand der aktuellen Identität und Berechtigungen abgewiesen.

## 5. Fanclub-Finanzen

Die bestehenden Fanclub-Finanzfunktionen sind bereits vollständig funktionsfähig und produktiv veröffentlicht.

Sie sind ausdrücklich kein später zu implementierendes V4-Grundmodul.

Die vorhandene Finanzstruktur umfasst den bestehenden fachlichen Umgang mit Beiträgen, Konten, Buchungen und zugehöriger Auswertung.

Das zukünftige Fanbus-Modul darf diese Funktionen nur gezielt erweitern beziehungsweise integrieren, soweit fanbusbezogene Zahlungen, Abrechnung, Zuordnung und Auswertung betroffen sind.

Ein Neuaufbau des bestehenden Finanzmoduls ist nicht Bestandteil dieser Planung.

## 6. PWA und Push

Das Frontend besitzt:

- Web-App-Manifest
- Service Worker
- Offline-Fallback
- Update-Mechanismus
- responsive Darstellung
- Push-Unterstützung
- Benachrichtigungseinstellungen
- Deep-Link-Verarbeitung

Die Push-Service-RPCs werden nicht pauschal öffentlich freigegeben. Benötigte Serverzugriffe erhalten gezielte `service_role`-Grants.

## 7. Migrations- und Sicherheitsregeln

Datenbankänderungen erfolgen ausschließlich über versionierte SQL-Migrationen.

P800 hat zwei Baseline-Probleme identifiziert:

1. eine auf DEV bereits angewendete Härtungsmigration fehlte im Repository;
2. die Default Privileges für zukünftige Objekte waren nicht ausreichend restriktiv und zwischen Cloud-DEV und lokalem Neuaufbau nicht reproduzierbar.

Die lokale P800-Reparatur ergänzt:

`20260802211306_harden_pd_api_revoke_anon_execute.sql`

und:

`20260807120000_harden_public_default_privileges.sql`

Der daraus resultierende Default-Deny-Vertrag für neue von `postgres` erzeugte Objekte lautet:

- keine Default-Rechte für `anon`
- keine Default-Rechte für `authenticated`
- keine Default-Rechte für `service_role`
- kein automatisches Funktions-EXECUTE über `PUBLIC`

Benötigte Rechte müssen objektbezogen ausdrücklich vergeben werden.

## 8. Bekannte nicht blockierende technische Schulden

### Aufgaben-Snapshot

`tasks_snapshot` kann beim Aufruf abgelaufene ausstehende Transfers bereinigen und dabei Daten schreiben.

Das ist aktuell funktional korrekt, erschwert aber die klare Trennung zwischen lesenden Snapshot-Operationen und Wartungslogik.

### Fremdschlüssel-Indizes

Vor größerer Datenmenge sollen fehlende sinnvolle FK-Indizes gezielt bewertet und ergänzt werden.

Es soll kein pauschales Indexing ohne konkrete Zugriffsmuster erfolgen.

### Alte JavaScript-Artefakte

`js/warmup.js` und `js/performance.js` sind derzeit nicht in den aktiven Anwendungspfad eingebunden, werden durch den Build aber weiterhin ausgeliefert.

Sie sollen in einem späteren Cleanup entweder sauber integriert oder entfernt werden.

## 9. Historische Dokumente

Frühere Phase-1-/Phase-2-Abnahmen und ältere Testberichte bilden ihren damaligen Projektstand ab.

Sie sind keine aktuelle Aussage über den heutigen Login, den heutigen DEV-Deploy, vorhandene Finanzen, vorhandenes Push/PWA oder die aktuelle PostgreSQL-Struktur.

Die aktuelle Baseline wird in `P800_DEV_BASELINE_R1.md` dokumentiert.
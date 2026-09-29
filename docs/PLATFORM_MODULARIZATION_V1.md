# Plärrdeifl Plattform – Modularisierung V1

**Stand:** 29.09.2026  
**Status:** Phase 0 – Zielbild und Migrationsregeln  
**Geltungsbereich:** DEV zuerst; PROD nur nach separater Freigabe

## 1. Ziel

Die Digitalplattform wird schrittweise von einem großen Portal-Repository zu klar getrennten Fachanwendungen und gemeinsamen Plattformbausteinen weiterentwickelt.

Dabei gilt:

- keine Big-Bang-Migration
- keine doppelte fachliche Source of Truth
- bestehende produktive Abläufe bleiben bis zur nachgewiesenen Ablösung erhalten
- alle neuen Frontends werden auf React + TypeScript + Vite ausgerichtet
- Supabase bleibt zentrale Auth-, Daten- und API-Ebene
- Browserzugriffe bleiben an die zentrale API-Grenze `public.pd_api(text, jsonb)` gebunden
- DEV und PROD bleiben strikt getrennt

## 2. Ziel-Repositories

### 2.1 Plattform-Core

#### `Plaerrdeifl/portal`

Verantwortet langfristig nur noch die zentrale Plattformoberfläche:

- Login und Session-Einstieg
- Dashboard
- Profil
- Benutzer
- Rollen und Capabilities
- Portal-Teams und Teamfunktionen
- Administration und Einstellungen
- zentrale Benachrichtigungsoberfläche
- Audit-/Betriebsoberflächen
- Modulnavigation und Integration der Fachanwendungen
- Nextcloud-/OIDC-Einstieg

Fachlogik von Events, Fanbus, Liveticker, Social Media, Mitgliedern, Finanzen, Aufgaben und Shop soll nicht dauerhaft im Portal-Frontend verbleiben.

#### `Plaerrdeifl/platform-ui` – Zielbild

Gemeinsame Frontend-Bausteine für die Plattform:

- Design-System und UI-Komponenten
- Auth-/Session-Integration
- `pd_api`-Client
- Capability-Prüfung
- gemeinsame Fehler- und Ladezustände
- PWA-Grundlagen
- gemeinsame Typen und Navigationsverträge

Die Fachanwendungen dürfen keine voneinander abweichenden Auth-/API-Grundlagen aufbauen.

#### `Plaerrdeifl/platform-backend` – Zielbild nach kontrolliertem Cutover

Langfristige gemeinsame Heimat für:

- Supabase-Migrationen
- gemeinsame Edge Functions
- Datenbanktests
- Storage-Konfiguration
- zentrale API-Verträge
- Plattform-Sicherheitsregeln

**Übergangsregel:** Bis dieser Cutover ausdrücklich durchgeführt und verifiziert wurde, bleibt `Plaerrdeifl/portal-v4-dev/supabase` die führende Migrationshistorie. Es gibt niemals zwei konkurrierende aktive Migrationshistorien.

## 2.2 Fachanwendungen

### `Plaerrdeifl/events`

Verantwortet:

- Kalender
- Spielplan
- allgemeine Events
- Spieldaten in `events` / `event_games`
- externe Eventreferenzen
- ICS-Import
- öffentliche und interne Terminansichten

Events ist vorgelagerte Fachdatenquelle für Fanbus, Liveticker und Social-Media-Spieltag.

### `Plaerrdeifl/fanbus`

Verantwortet:

- Fahrten
- öffentliche Anmeldung
- Buchungen
- Teilnehmer
- Busse und Zuweisungen
- Zustiegsorte
- Check-in
- Hauptbuchung / verbundene Buchungsdarstellung
- Reisegruppen
- Stammfahrer / Personengruppen
- Kontakt- und Selbstserviceabläufe
- Fanbus-Tippspiel
- M340-/On-Tour-Publishing

Bestehende Trip-UUIDs und funktionierende Abläufe werden bei der Migration beibehalten.

### `Plaerrdeifl/liveticker`

Besteht bereits und bleibt verantwortlich für:

- Ticker 2.0
- Spieltagssteuerung
- Liveticker-Teams und Kader
- Teamlogos
- Spielereignisse
- Textsystem
- Grafik-/FINAL-/Archivabläufe
- WhatsApp/WPP
- Liveticker-Renderer und zugehörige Worker

### `Plaerrdeifl/social-media-generator`

Besteht bereits und bleibt verantwortlich für:

- Generator 1.0
- Grafikdokumentmodell
- Vorlagen und Pakete
- Medienbibliothek
- Renderjobs
- Social-Media-Render-Worker
- spiel- und fanbusbezogene Grafikpakete

### `Plaerrdeifl/members`

Verantwortet:

- Mitglieder
- Mitgliedsanträge
- Antragsentscheidungen
- Portaluser-zu-Mitglied-Verknüpfung als Fachprozess
- Vorstand / Ämter
- Mitgliedsprofilbezogene Workflows
- Mitgliedsantrags-PDF, E-Mail- und öffentliche Intake-Abläufe

Portalbenutzer und Portalrollen bleiben Plattform-Core; Mitglied ist weiterhin keine einfache Portalrolle.

### `Plaerrdeifl/finance`

Verantwortet:

- Finanzkonten
- Buchungen
- Beiträge
- Beitragsklassen
- Beitragssaisons
- Zahlungsberichte
- Finanz-Auswertungen

Mitgliederdaten werden referenziert, aber nicht dupliziert.

### `Plaerrdeifl/tasks`

Verantwortet:

- Aufgaben
- Teamaufgaben
- Zuweisungen
- Übergaben
- Status- und Waiting-Workflow
- Updates / Verlauf
- aufgabenbezogene Push-/Benachrichtigungsintegration

Portal-Dashboard und andere Module dürfen Aufgaben aggregiert anzeigen, ohne die Aufgabenlogik zu duplizieren.

### `Plaerrdeifl/shop`

Verantwortet langfristig:

- Shop-/WooCommerce-Integration
- Bestellansichten
- Portal-Identity-Bridge
- WordPress-Plugin-Code
- Mitglieder-/Benutzerbezug des Shops

## 3. Abhängigkeitsrichtung

Die Zielabhängigkeiten werden bewusst einseitig gehalten:

```text
Platform Core
  ├─ Identity / User / Capabilities / Teams
  ├─ Auth / API / Notifications
  │
  ├─ Events
  │   ├─ Fanbus
  │   ├─ Liveticker
  │   └─ Social-Media-Generator
  │
  ├─ Members
  │   └─ Finance
  │
  ├─ Tasks
  └─ Shop
```

Grundregeln:

- Fanbus, Liveticker und Generator dürfen Events konsumieren.
- Events kennt keine Fanbus-, Liveticker- oder Generator-Fachlogik.
- Finance darf Members referenzieren; Members kennt keine Finanzbuchungslogik.
- alle Fachmodule dürfen zentrale Portalidentitäten und Capabilities verwenden.
- keine Fachanwendung legt eine zweite Benutzer-, Rollen-, Team- oder Auth-Welt an.

## 4. Migrationsverfahren pro Modul

Jedes Modul durchläuft dieselben Gates.

### Gate A – Inventar

Vor Änderungen werden live erfasst:

- aktuelle Dateien und Einstiegspunkte
- verwendete API-Actions
- Tabellen, Funktionen und Storage-Abhängigkeiten
- Rechte / Capabilities
- Edge Functions / Worker
- Tests
- externe Integrationen
- DEV-/PROD-Unterschiede

### Gate B – neue Anwendung parallel aufbauen

- React + TypeScript + Vite
- gemeinsame Plattformgrundlagen verwenden
- gegen DEV-Supabase arbeiten
- bestehende Identitäten und IDs beibehalten
- kein PROD-Umbau

### Gate C – Funktionsparität

Die neue Anwendung muss den freigegebenen bestehenden Funktionsumfang abdecken.

Nicht automatisch übernommen werden:

- historischer Altcode
- tote Zwischenlösungen
- obsolete Tests
- technisch unnötige Doppelimplementierungen

### Gate D – technische Abnahme

Mindestens passend zum Modul:

- Unit-/Integrationstests
- TypeScript-/Static-Checks
- Produktionsbuild
- API-/DB-Vertragstests
- PWA-/Routing-Prüfung
- reale DEV-Abnahme
- bei Worker-/Delivery-Themen echter End-to-End-Test

### Gate E – DEV-Umschaltung

Erst nach erfolgreicher Abnahme:

- Portal verweist auf bzw. integriert die neue Anwendung
- alter DEV-Einstieg wird kontrolliert stillgelegt
- alte Implementierung wird erst danach entfernt
- keine Daten oder IDs werden unnötig neu modelliert

### Gate F – PROD

PROD erfolgt separat:

- konkreten getesteten Stand auswählen
- PROD-Abhängigkeiten live prüfen
- separate Freigabe
- deployen/migrieren
- live verifizieren
- erst danach Altpfade in PROD entfernen

## 5. Reihenfolge V1

### Phase 0 – Architektur und Grenzen

- Ziel-Repos und Verantwortungen festlegen
- gemeinsame Modulverträge definieren
- keine Fachfunktion verschieben

### Phase 1 – gemeinsame Frontend-Grundlage

- `platform-ui` vorbereiten
- Auth-/Session-Vertrag
- API-Client
- Capability-Handling
- Basiskomponenten und App-Shell-Vertrag

### Phase 2 – Events als Pilot

Events ist der erste vollständige Migrationstest:

1. Event-/Spielplan-Inventar
2. neue Events-PWA lokal/gegen DEV
3. ICS-Import und Event-APIs anbinden
4. Standalone-Betrieb
5. Portal-Integration
6. Funktionsparität und Live-Abnahme
7. alten DEV-Event-Frontendcode entfernen

Der Events-Pilot definiert die Blaupause für weitere Module.

### Phase 3 – Fanbus

In dieser Reihenfolge:

1. Fahrten und Übersichten
2. öffentliche Anmeldung / Selbstservice
3. Buchungsverwaltung
4. Teilnehmer und Check-in
5. Busplanung / Zustiegsorte
6. Gruppen / Hauptbuchung / Reisegruppen
7. Publishing / On-Tour
8. Tippfunktion

Keine bestehende Fanbus-Fachidentität wird dabei unnötig ersetzt.

### Phase 4 – Members und Finance

Zuerst Mitglieder-/Antragsdomäne stabilisieren, anschließend Finanzmodul davon trennen.

### Phase 5 – Tasks

Aufgabenmodul auslagern; Dashboard konsumiert danach nur noch dessen öffentliche Plattformverträge.

### Phase 6 – Portal-Core auf React/TypeScript/Vite

Erst wenn die großen Fachbereiche ausgelagert sind:

- Portal-Shell modernisieren
- Core-Oberflächen übernehmen
- alte statische Portalstruktur kontrolliert abbauen

### Phase 7 – Shop

Shop-/WordPress-Integration als letztes Fachmodul bereinigen.

### Phase 8 – Backend-Cutover

Wenn Frontendgrenzen und Verantwortungen stabil sind:

- zentrale Supabase-Historie in `platform-backend` übernehmen
- Cutover atomar durchführen
- alte Migrationsquelle deaktivieren
- niemals zwei aktive Migration-Sources führen

## 6. Gemeinsame Integrationsregeln

### Auth

Alle Anwendungen verwenden dieselbe Supabase-/Portalidentität.

Standalone bedeutet nicht eigene Benutzerverwaltung.

### Autorisierung

Capabilities bleiben zentral. Fachmodule definieren fachliche Capabilities, aber keine konkurrierende Rollenverwaltung.

### API

Browserkommunikation bleibt über definierte `pd_api`-Actions bzw. ausdrücklich freigegebene öffentliche Endpunkte.

### Daten

Eine Information hat genau eine führende Fachquelle.

Beispiele:

- Portaluser / Portalteams → Platform Core
- Kalender / Spiele → Events
- Liveticker-Team / Kader / Teamlogo → Liveticker
- Fahrt / Buchung / Bus / Reisegruppe → Fanbus
- Mitglied → Members
- Buchung / Beitrag → Finance
- Aufgabe → Tasks
- Grafikdokument / Generatorvorlage → Social-Media-Generator

### Portalintegration

Standalone-Fachanwendungen müssen im Portal vollständig erreichbar und fachlich integrierbar bleiben.

Keine zweite Portal-Implementierung derselben Fachfunktion.

## 7. Schutzregeln während der Migration

- PROD ohne konkrete Freigabe unverändert
- keine Force-Pushes oder History-Rewrites
- keine bestehenden IDs ohne fachliche Notwendigkeit ersetzen
- keine verdeckten DB-Schemaänderungen
- keine parallelen zweiten Tabellenmodelle als Dauerlösung
- keine neue Auth- oder Benutzerwelt pro Modul
- keine stillen Datenübernahmen oder Synchronisationsmagie
- alten Code erst nach verifizierter Ablösung entfernen
- bestehende Liveticker-/Generator-Migrationen nicht zurückbauen

## 8. Aktuelle Modulzuordnung als Migrationsinventar

| Aktueller Bereich | Ziel |
| --- | --- |
| Portal Auth/User/Roles/Teams | Portal / Platform Core |
| Dashboard / Profil / Admin | Portal |
| Kalender / Spielplan / ICS | Events |
| Fanbus / Bus-Orga / M340 | Fanbus |
| Portal-Liveticker-Altcode | Liveticker |
| Social-Media-Generator | Social-Media-Generator |
| Mitglieder / Anträge / Vorstand | Members |
| Finanzen / Beiträge | Finance |
| Aufgaben | Tasks |
| Shop / WordPress | Shop |
| Supabase-Migrationen | Übergangsweise portal-v4-dev, später Platform Backend |
| gemeinsame Frontend-Basis | Platform UI |

## 9. Definition of Done für Phase 0

Phase 0 ist abgeschlossen, wenn:

- die Zielgrenzen dokumentiert sind
- keine widersprüchlichen Modulzuständigkeiten offen sind
- bestehender DEV-/PROD-Schutz unverändert bleibt
- Events als erster Pilot feststeht
- die Backend-Migrationshistorie bis zum späteren atomaren Cutover weiterhin eindeutig genau eine Source of Truth besitzt

Danach beginnt Phase 1 mit der gemeinsamen Frontend-Grundlage und dem Events-Inventar.

# PD-Portal – Modularisierung V1

**Stand:** 29.09.2026  
**Status:** Phase 0 – Zielbild und Migrationsregeln  
**Geltungsbereich:** DEV zuerst; PROD nur nach separater Freigabe

## 1. Ziel

Das PD-Portal wird schrittweise von einem großen Portal-Repository zu klar getrennten Fachanwendungen und gemeinsamen Plattformbausteinen weiterentwickelt.

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
- zentrale Identity-/OAuth-/OIDC-Integration für Nextcloud, WordPress und weitere freigegebene Dienste

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
- shopbezogenen WordPress-Plugin-Code
- Mitglieder-/Benutzerbezug des Shops

WordPress selbst bleibt öffentliche Website-/Content-/WooCommerce-Schicht und ist nicht die führende Quelle für Portal-Fachdaten.

### `Plaerrdeifl/mail`

Verantwortet langfristig:

- Portal-Mailoberfläche für berechtigte Benutzer
- gemeinsame Funktionspostfächer
- Posteingang, Ordner, Lesen, Antworten, Weiterleiten und neue Nachrichten
- Entwürfe, Gesendet, Papierkorb und Anhänge
- serverseitige IMAP-/SMTP-Anbindung an den Mailprovider
- Berechtigungszuordnung von Portalteams/-capabilities zu Postfächern
- Mail-bezogene Integrationen in Aufgaben und andere Fachmodule

Mailpasswörter und andere Provider-Secrets liegen niemals im Browser. Das Frontend arbeitet ausschließlich über einen serverseitigen Mail-Gateway-Vertrag.

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
  ├─ Mail
  └─ Shop
```

Grundregeln:

- Fanbus, Liveticker und Generator dürfen Events konsumieren.
- Events kennt keine Fanbus-, Liveticker- oder Generator-Fachlogik.
- Finance darf Members referenzieren; Members kennt keine Finanzbuchungslogik.
- alle Fachmodule dürfen zentrale Portalidentitäten und Capabilities verwenden.
- WordPress, Nextcloud und weitere integrierte Dienste verwenden die zentrale Portalidentität als Vertrauensquelle.
- Mailzugriff wird aus zentralen Portalrechten auf Funktionspostfächer abgeleitet.
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

### Gate F – DEV-Integration

Nach erfolgreicher Modulabnahme wird auf DEV auf die neue Implementierung umgeschaltet:

- neuer DEV-Einstieg wird aktiv
- Integration in Portalnavigation und gemeinsame PWA wird geprüft
- DEV-Altpfad wird erst nach bestätigter Parität entfernt
- PROD bleibt während des Gesamtumbaus Portal 1.0

### Gate G – gemeinsamer PROD-Cutover

Erst wenn **alle für Portal 2.0 freigegebenen Module** auf DEV vollständig integriert und als Gesamt-Release-Candidate abgenommen sind:

- aktuellen PROD-Zustand live prüfen
- Recovery-/Rollback-Punkt herstellen
- Datenbankmigration gegen aktuellen isolierten PROD-Datenstand proben
- bei Bedarf kontrollierten Write-Freeze vorbereiten
- Migrationen, Backends, Worker und Frontends koordiniert ausrollen
- Cloudflare-/Domainrouting gemeinsam umschalten
- Portal, Liveticker, Generator und weitere freigegebene Module End-to-End live prüfen
- Alt-PWA auf den geführten Wechsel zum neuen Portal umstellen
- Portal 1.0 zunächst als begrenzte Rückfallebene erhalten
- alte PROD-Pfade erst nach bestätigter Stabilität endgültig entfernen

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

### Phase 3 – Identity/OAuth verallgemeinern und WordPress-SSO

Der bestehende Portal-OAuth-/OIDC-Flow wird von einer Nextcloud-spezifischen Oberfläche zu einer allgemeinen PD-Portal-Identity-Integration weiterentwickelt.

Ziel:

1. OAuth-Clients erhalten eigene Namen und Zugangsregeln
2. Nextcloud bleibt bestehender Client
3. WordPress wird als weiterer Client angebunden
4. WordPress-Zugang für berechtigte Social-Media-Nutzer wird aus Portalteam/-capability abgeleitet
5. WordPress erhält nur die für seine lokale Autoren-/Redaktionsfunktion nötige Identität
6. WordPress-Rollen werden minimal und portalgeführt zugeordnet
7. Entzug der Portalberechtigung entzieht bei der nächsten Autorisierungsprüfung auch den WordPress-Zugang

Kein separates WordPress-Passwortsystem für diese Portalnutzer als führende Identität.

### Phase 4 – Fanbus

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

### Phase 5 – Members und Finance

Zuerst Mitglieder-/Antragsdomäne stabilisieren, anschließend Finanzmodul davon trennen.

### Phase 6 – Tasks

Aufgabenmodul auslagern; Dashboard konsumiert danach nur noch dessen öffentliche Plattformverträge.

### Phase 7 – Mail

Nach stabilen gemeinsamen Auth-/API-Verträgen wird das Mail-Modul aufgebaut:

1. Postfach-/Berechtigungsmodell festlegen
2. serverseitigen Mail-Gateway für IMAP/SMTP schaffen
3. read-only Posteingang als ersten Slice
4. Lesen / Ordner / Suche
5. Senden / Antworten / Weiterleiten
6. Anhänge / Entwürfe / Gesendet
7. Team-/Capability-gesteuerte gemeinsame Funktionspostfächer
8. optionale Integrationen zu Tasks/Members/Fanbus erst nach stabilem Grundbetrieb

Das Browserfrontend erhält niemals Mailbox-Passwörter oder SMTP-/IMAP-Secrets.

### Phase 8 – Portal-Core auf React/TypeScript/Vite

Erst wenn die großen Fachbereiche ausgelagert sind:

- Portal-Shell modernisieren
- Core-Oberflächen übernehmen
- alte statische Portalstruktur kontrolliert abbauen

### Phase 9 – Shop

Shop-/WordPress-Integration als letztes Fachmodul bereinigen.

### Phase 10 – Backend-Cutover

Wenn Frontendgrenzen und Verantwortungen stabil sind:

- zentrale Supabase-Historie in `platform-backend` übernehmen
- Cutover atomar durchführen
- alte Migrationsquelle deaktivieren
- niemals zwei aktive Migration-Sources führen

### Phase 11 – Gesamt-Release-Candidate und PROD-Cutover

Nachdem die vorgesehenen Portal-2.0-Bausteine auf DEV vollständig integriert sind:

1. grundlegende Architektur einfrieren
2. Gesamt-E2E auf DEV durchführen
3. PWA-Installations- und Wechselpfad testen
4. aktuelle PROD-Datenkopie isoliert migrieren und prüfen
5. Rollback-/Recovery-Verfahren testen
6. konkreten gemeinsamen PROD-Cutover planen
7. erst nach ausdrücklicher Freigabe gemeinsam umschalten

Bis dahin bleibt Portal 1.0 auf PROD das produktive System.

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
- Mailnachricht / Mailordner → externer Mailprovider; PD-Portal hält nur nötigen Integrations-/Berechtigungszustand
- WordPress-Inhalt / WooCommerce → WordPress/WooCommerce; Portal-Fachdaten bleiben in ihren jeweiligen PD-Portal-Modulen

### Portalintegration

Direkt aufrufbare Fachanwendungen müssen im Portal vollständig erreichbar und fachlich integriert bleiben.

Für Benutzer gibt es eine gemeinsame installierbare PD-Portal-PWA. Fachmodule bleiben eigenständige technische Builds, erzeugen in der integrierten Zielumgebung aber keine konkurrierenden Installationspflichten oder überlappenden Service Worker.

Keine zweite Portal-Implementierung derselben Fachfunktion.

### Externe Identity-Integrationen

Das PD-Portal ist die zentrale Identitäts- und Berechtigungsquelle für angebundene Dienste.

- Nextcloud bleibt an Portal-OAuth/OIDC gekoppelt.
- WordPress erhält einen eigenen Portal-SSO-Client für berechtigte Nutzer, insbesondere das Social-Media-Team.
- WordPress darf lokale technische Benutzer für Autoren-/Revisionszwecke führen, aber keine unabhängig gepflegte führende Zugangsentscheidung.
- Entfernte Portalrechte müssen spätestens bei der nächsten Autorisierung/Session-Prüfung wirksam werden.
- Externe Dienste erhalten nur die jeweils notwendigen Claims/Scopes.

### WordPress-Rolle

WordPress bleibt:

- öffentliche Vereinswebsite
- Content-/News-System
- WooCommerce-/Shop-Laufzeit
- öffentlicher Einstiegspunkt in ausgewählte Portalprozesse

WordPress wird nicht:

- zweite Mitgliederverwaltung
- zweite Event-/Spielplandatenbank
- zweite Fanbus-Datenbank
- zweite Benutzer-/Rollen-Source-of-Truth
- Heimat von Ticker, Tasks, Finance oder Generator

### Mail-Rolle

Das Mail-Modul ist Portal-Fachoberfläche für bestehende Mailkonten/Funktionspostfächer.

- Zugriff wird über Portalteams/-capabilities gesteuert.
- IMAP/SMTP-Zugangsdaten verbleiben ausschließlich serverseitig.
- der Browser kommuniziert nur mit dem PD-Mail-Gateway.
- mehrere berechtigte Portalnutzer können dasselbe Funktionspostfach nutzen, ohne das Providerpasswort zu kennen.

## 7. Kanonische Domains und Pfade

Das langfristige Zielbild verwendet eine gemeinsame Vereinsdomain und klare Modulpfade.

### PROD

```text
https://plaerrdeifl.de/            -> öffentliche WordPress-Website
https://plaerrdeifl.de/portal      -> Portal-Core / Dashboard
https://plaerrdeifl.de/events      -> Events
https://plaerrdeifl.de/fanbus      -> Fanbus
https://plaerrdeifl.de/liveticker  -> Liveticker
https://plaerrdeifl.de/generator   -> Social-Media-Generator
https://plaerrdeifl.de/members     -> Members
https://plaerrdeifl.de/finance     -> Finance
https://plaerrdeifl.de/tasks       -> Tasks
https://plaerrdeifl.de/mail        -> Mail
```

### DEV

DEV spiegelt dieselbe Struktur unter `https://dev.plaerrdeifl.de`:

- `/portal`
- `/events`
- `/fanbus`
- `/liveticker`
- `/generator`
- `/members`
- `/finance`
- `/tasks`
- `/mail`

Die öffentliche WordPress-Website bleibt auf PROD unter `/` bei Lima-City. Für die Modulpfade wird eine vorgelagerte Cloudflare-Routing-Schicht vorgesehen. DNS allein kann nicht nach URL-Pfaden verteilen.

`portal.plaerrdeifl.de` bleibt während der Migration höchstens Übergangsadresse und soll nach dem kontrollierten PROD-Cutover auf `https://plaerrdeifl.de/portal` weiterleiten. Eigenständige Modul-Subdomains sind kein langfristiges kanonisches Ziel.

Die gemeinsame Portal-PWA ist das kanonische Installationsziel. Fachmodule behalten ihre direkten Pfade und eigenständigen Builds, registrieren in der integrierten Zielumgebung aber keine konkurrierenden oder überlappenden Service Worker. Der konkrete gemeinsame PWA-Scope wird in DEV so abgenommen, dass WordPress auf `/` außerhalb der Portal-Service-Worker-Kontrolle bleibt.

Der PROD-DNS-/Nameserver-Cutover ist eine eigene Infrastrukturänderung. Vor Umsetzung müssen alle DNS-, Mail- und Website-Records vollständig inventarisiert und übernommen, das Routing getestet und die konkrete PROD-Aktion ausdrücklich freigegeben werden.

## 8. Schutzregeln während der Migration

- PROD bleibt während des Portal-2.0-Gesamtumbaus grundsätzlich Portal 1.0; nur ausdrücklich freigegebene Betriebs-/Fehlerkorrekturen verändern es
- keine Force-Pushes oder History-Rewrites
- keine bestehenden IDs ohne fachliche Notwendigkeit ersetzen
- keine verdeckten DB-Schemaänderungen
- keine parallelen zweiten Tabellenmodelle als Dauerlösung
- keine neue Auth- oder Benutzerwelt pro Modul
- keine stillen Datenübernahmen oder Synchronisationsmagie
- alten Code erst nach verifizierter Ablösung entfernen
- bestehende Liveticker-/Generator-Migrationen nicht zurückbauen
- projektweite Architekturspiegel unter `docs/pd-portal/` in vorhandenen Repositories nicht repo-spezifisch verändern; Änderungen werden zentral abgestimmt und synchron gespiegelt

## 9. Aktuelle Modulzuordnung als Migrationsinventar

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
| WordPress öffentliche Website / Content | externe Website-Schicht + Portal-SSO |
| WooCommerce / Shop-Integration | Shop |
| Lima-City-/Funktionspostfächer | Mail |
| Supabase-Migrationen | Übergangsweise portal-v4-dev, später Platform Backend |
| gemeinsame Frontend-Basis | Platform UI |

## 10. Definition of Done für Phase 0

Phase 0 ist abgeschlossen, wenn:

- die Zielgrenzen dokumentiert sind
- keine widersprüchlichen Modulzuständigkeiten offen sind
- bestehender DEV-/PROD-Schutz unverändert bleibt
- Events als erster Pilot feststeht
- die Backend-Migrationshistorie bis zum späteren atomaren Cutover weiterhin eindeutig genau eine Source of Truth besitzt

Danach beginnt Phase 1 mit der gemeinsamen Frontend-Grundlage und dem Events-Inventar.


## 11. Prioritäten nach Phase 0

Die Umsetzung erfolgt bewusst nacheinander. Aktuelle Reihenfolge:

| Priorität | Baustein | Grund |
| --- | --- | --- |
| P0 | Platform UI / gemeinsame React-Vite-Basis | Voraussetzung für alle neuen Module |
| P1 | Events / Spielplan | erster überschaubarer Pilot und zentrale Fachdatenquelle |
| P2 | allgemeine Portal-Identity + WordPress-SSO | kleiner, strategischer Core-Baustein; nutzt bestehende OAuth-Grundlage |
| P3 | Fanbus | größter verbliebener Fachblock im alten Portal |
| P4 | Members | klare Fachdomäne und Grundlage für weitere Mitgliedsprozesse |
| P5 | Finance | sauber auf Members aufbauend |
| P6 | Tasks | querschnittlich, aber fachlich gut abgrenzbar |
| P7 | Mail | wertvoll, aber zusätzlicher sicherer Server-Gateway nötig |
| P8 | Portal-Core React/Vite | erst wenn große Fachblöcke ausgelagert sind |
| P9 | Shop-/WordPress-Codebereinigung | bestehende externe Website-/WooCommerce-Schicht sauber integrieren |
| P10 | Platform-Backend-Cutover | erst wenn Fachgrenzen stabil und Migration-Ownership eindeutig ist |

Ticker 2.0 und Social-Media-Generator laufen parallel als bereits eigenständige Modernisierungsstränge. Ihre funktionierenden Bereiche werden während dieser Modularisierung nicht unnötig zurückgebaut.

Die Priorität steuert die Arbeitsreihenfolge, nicht die fachliche Wichtigkeit. Ein später priorisiertes Modul darf geplant und dokumentiert werden, wird aber nicht parallel implementiert, solange ein höher priorisierter Umbau noch aktiv ist.
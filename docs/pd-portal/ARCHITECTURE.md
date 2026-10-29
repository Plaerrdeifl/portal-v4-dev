# Cockpit – ARCHITECTURE (vormals PD-Portal)

**Stand:** 29.10.2026  
**Zweck:** Stabile technische Landkarte des Cockpits als neuem Gesamtprodukt und seiner weiterhin benötigten Plattformdienste. Tagesaktuelle SHAs, Testzahlen, Deployments, Laufzeitstatus und offene Aufgaben gehören ausdrücklich nicht in diese Datei und werden bei Bedarf live geprüft.

## 1. Systembild

**Neues Gesamtprodukt: Fanszene Schweinfurt Cockpit (Cockpit).** Das ehemals geplante separate Portal 2.0 entfällt als Zielprodukt (D-054). Das Cockpit ist die einzige neue gemeinsame Bedienoberfläche, kein Zusatz neben einem zweiten Portal. Die frühere Portal-1.0-Technik bleibt auf PROD bis zu einem separat genehmigten Release bestehen.

```text
Benutzer
  |
  +--> Cockpit (gemeinsame App-Shell, PWA, Anmeldung, Profil,
  |             zentrale Benutzerverwaltung, Navigation)
  |      |- Liveticker [zuerst]
  |      |- Bildgenerator [zuerst]
  |      |- Bus-Orga / Fanbus [danach, kontrollierte Rückkehr]
  |      |- weitere Fachmodule [erst nach einzelner Freigabe]
  |
  +--> separat installierbare Fach-PWAs
         |- Liveticker
         |- Bildgenerator
         |- Bus-Orga/Fanbus (bleibt eigenständig)

Gemeinsame Plattformdienste (weiterverwenden, kein zweites Produkt)
  |- Supabase Auth / zentrale Benutzeridentität
  |- Cockpit-Zugang / Cockpit-Rollen / fachliche Capabilities
  |- public.pd_api(text, jsonb) / geschützte Backendfunktionen
  |- PostgreSQL / einzige führende Migrationshistorie
  |- OAuth/OIDC / Nextcloud / WordPress-Integration
  |- Worker / WPP / Medien / Mail-/Fachdienste
  |- führende fachliche Daten- und Quellrepositories
```

Cockpit und Fach-PWAs verwenden dieselbe Identität, dieselben Fachrechte und denselben Backend-Vertrag. Pro Fachfunktion existiert nur **eine führende Implementierung**. Fachlogik wird kontrolliert geteilt, nicht dauerhaft kopiert. Kein iframe als Standard.

**Keine alte organisatorische Portalteamwelt im Ziel-Cockpit (D-055).** Sportliche Mannschaften, Kader, Teamlogos und Spielpläne bleiben Liveticker-/Generator-Fachdaten; Bus-Reisegruppen sind ebenfalls fachliche Daten. Team- und Wildcard-Zugänge aus dem alten Portalvertrag sind **nur Migrationsbestand**, bis alle betroffenen Verbraucher geprüft umgestellt sind.

## 2. Umgebungen

### DEV

- bestehendes Übergangsrepository: `Plaerrdeifl/portal-v4-dev`
- Standardbranch: `main`
- **DEV-Ziel:** `https://dev.plaerrdeifl.de/` führt direkt zum Cockpit; ein kontrollierter Redirect nach `/cockpit/` bewahrt dessen engen PWA-Scope.
- weiterhin eigenständiger Cockpit-Pfad: `https://dev.plaerrdeifl.de/cockpit/`
- technischer Legacy-/Core-Pfad `/portal` bleibt nur soweit für zentrale Integrationen nötig; kein separates neues Portal-2.0-Frontend
- Fachmodule spiegelgleich unter eigenen Pfaden, z. B. `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`
- Supabase-Ref: `tpieykhhawszlzsoflnl`

### PROD

- Repository: `Plaerrdeifl/portal`
- Standardbranch: `main`
- öffentliche Vereinswebsite: `https://plaerrdeifl.de/`
- bisheriger technischer Portal-Core-/Legacy-Zielpfad: `https://plaerrdeifl.de/portal` (kein separates neues Produkt)
- kanonisches Cockpit-Ziel: `https://plaerrdeifl.de/cockpit/` (nur nach separater PROD-Freigabe)
- Fachmodule unter eigenen Pfaden, z. B. `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`
- Supabase-Ref: `wplescvhlgctynkfwvrj`

`https://portal.plaerrdeifl.de` ist während der Migration nur eine technische Übergangsadresse. Ein späterer Redirect ist neu zu planen und separat zu genehmigen; ein PROD-Cockpit-Cutover erfolgt nicht implizit aus DEV.

DEV und PROD sind bewusst getrennt. Ein DEV-Commit oder ein erfolgreicher DEV-Test ist keine automatische PROD-Freigabe.

Der Name `portal-v4-dev` bleibt als technisches Build-/API-/Migrationsrepository erhalten, solange Fachmodule und Cockpit darauf angewiesen sind. Er ist **kein Produktname** und kein Löschauftrag.

## 3. Repository- und Modulstruktur

### Technischer Portal-Core / zentrale Plattformdienste

DEV-Integrations- und Migrationsrepository: `Plaerrdeifl/portal-v4-dev`. PROD-Altbestand: `Plaerrdeifl/portal`. Beide bleiben strikt getrennt.

**Zu behalten, solange benötigt:** zentrale Supabase-/Portalidentität, Login/Session, individuelle Cockpit-Rollen, `pd_api`-Verträge, Capabilities, OAuth/OIDC, Audit, betrieblich sichere Änderungen, Worker-Anbindungen, zentrale Fachdaten und die allein führende Supabase-Migrationshistorie in `portal-v4-dev/supabase`.

Die bisherige **Portal-Oberfläche/Dashboard/organisatorische Teamverwaltung** ist **kein neuer Produktkern**. Ihre tatsächlich nicht mehr benötigten DEV-Dateien und Routen werden nach D-057 inventarisiert, gesichert, technisch abgelöst und erst anschließend entfernt. Keine pauschale Löschung von Repo, Backend oder Authentifizierungsdaten.

### Gemeinsame Frontend-Basis

`Plaerrdeifl/platform-ui`

Gemeinsame Bausteine für React-/TypeScript-/Vite-Anwendungen:

- Runtime-Konfiguration
- Supabase-Client
- Auth-/Session-Integration
- `pd_api`-Client
- Bootstrap
- Capability-Prüfung
- Google-Login-Bausteine
- gemeinsame Fehlerbehandlung
- Navigationsverträge
- gemeinsame UI-Komponenten
- PWA-Grundlagen

Gemeinsame Plattformlogik wird geteilt; Fachlogik bleibt im jeweiligen Fachrepository.

### Fanszene Schweinfurt Cockpit – einzige neue Produktoberfläche

Führendes Frontendrepository: `Plaerrdeifl/fanszene-cockpit`; React, TypeScript, Vite und `Plaerrdeifl/platform-ui`. Die DEV-Integration verwendet ein versioniertes, reproduzierbares Release in `portal-v4-dev/integrations/cockpit` statt eines zweiten Cockpit-Quellcodes.

**Verantwortung:** Cockpit-Shell, gemeinsamer Einstieg, Login/Session, Profil/Abmeldung, Navigation, Cockpit-Zugang und die begrenzte, auditierte, revisionsgesicherte Benutzer-/Rechteverwaltung mit anwendungsbezogenen Rollen **SYSTEM_ADMIN**, **ADMIN**, **USER**.

**Modulreihenfolge:** Erst Liveticker (führendes Repo `Plaerrdeifl/liveticker`) und Bildgenerator (führendes Repo `Plaerrdeifl/social-media-generator`). Danach wird Bus-Orga/Fanbus aus den bestehenden Fachdaten und UUIDs in **die neue Cockpit-Struktur ohne organisatorische Portalteams** integriert. Events und andere Domänen folgen erst mit eigenen Entscheidungen/Abnahmen.

**Gemeinsame Plattform, kein Parallelprodukt:** Die Cockpit-Identität bleibt die zentrale Supabase-/Portalidentität, ohne zweite Benutzer-/Rollendatenbank und ohne allgemeine Portal-Admin-Wildcards für Cockpit-Freigaben. Systemadministrator und Administrator erhalten nur die ausdrücklich serverseitig autorisierten Cockpit-/Fachrechte. Fachberechtigungen umfassen zunächst `liveticker.manage` und `social_media_generator.use`.

Die bestehende Generator-Rechteprojektion berücksichtigt noch alte Team-/Wildcard-Quellen. Sie ist **Ist-Verträglichkeit**, nicht das Zielmodell; erst nach kontrollierter Rechteinventur, Migration und Gegenprüfung dürfen diese Quellen entfallen (D-055). Cockpit-Fachmodule besitzen nur eine führende Implementierung; keine geklonten Editoren, Worker oder API-Welten.

**PWA:** Das Cockpit behält zunächst Manifest-/Installations-ID, Start-URL, Assets und Worker-Scope `/cockpit/`. Der neue DEV-Root-Einstieg kann geprüft dorthin verweisen. Liveticker, Bildgenerator und später Bus-Orga behalten eigene PWAs mit begrenzten Scopes. Ein Root-Service-Worker darf nicht unkontrolliert die übrigen Module übernehmen.

### Events / Spielplan

`Plaerrdeifl/events`

Verantwortet:

- Kalender
- Spielplan
- allgemeine Veranstaltungen
- interne und öffentliche Terminansichten
- Event- und Spieldaten
- externe Eventreferenzen
- kontrollierten ICS-Import

Events ist vorgelagerte Fachdatenquelle für Fanbus, Liveticker und Social-Media-Spieltag.

Führende Tabellen sind insbesondere:

- `app_modules.events`
- `app_modules.event_games`
- `app_modules.event_external_refs`
- `app_modules.event_import_runs`

Bestehende Event-UUIDs bleiben erhalten.

### Fanbus

Zielrepository: `Plaerrdeifl/fanbus`

Fachliche Verantwortung:

- Fahrten
- öffentliche Anmeldung
- Buchungen
- Teilnehmer
- Busse und Zuweisungen
- Zustiegsorte
- Check-in
- Hauptbuchung
- kompakte/verbundene Buchungsdarstellung
- Reisegruppen
- Stammfahrer / Personengruppen
- Kontakte und Selbstservice
- Fanbus-Tippspiel
- Publishing / M340 / On-Tour

Reisegruppe, Buchung, Hauptbuchung und verbundene Darstellung bleiben fachlich getrennte Konzepte. Bestehende Trip-UUIDs und funktionierende Abläufe werden geschützt.

### Liveticker

Repository: `Plaerrdeifl/liveticker`

Eigenständige React-/TypeScript-/Vite-Anwendung und zugleich vollständig in das Portal integrierbares Fachmodul.

Fachliche Bausteine umfassen u. a.:

- Spieltagssteuerung
- Spiele / Teams / Kader
- Spielereignisse
- Textvorlagen / Textsystem
- grafische Templates und Jobs
- Drittel-/FINAL-/manuelle Outputs
- Archiv
- WhatsApp-Outbox
- Stickerbibliothek
- Delivery-/Retry-Status
- externe WhatsApp-Laufzeit über WPP
- zugehörige Publishing-/WhatsApp-Worker

Teams und Kader sind zentrale Liveticker-Stammdaten. Führende Tabellen sind insbesondere:

- `app_modules.liveticker_teams`
- `app_modules.liveticker_players`

Teamlogos werden zentral in Supabase Storage im Bucket `liveticker-team-logos` gespeichert. Logo-Änderungen erfolgen über die Liveticker-Teamverwaltung; andere Module konsumieren diese zentrale Quelle.

### Social-Media-Generator

Repository: `Plaerrdeifl/social-media-generator`

Eigenständige React-/TypeScript-/Vite-PWA mit gemeinsamem Grafikmodell und eigenem Render-Worker.

Stabile Bausteine:

- bestehende Portalidentität und Generator-Berechtigung
- strukturiertes Grafik-Dokumentmodell als Source of Truth
- SVG als vollständiges Darstellungs-/Austauschformat mit Generator-Metadaten
- versionierte Vorlagen, Paket-Vorlagen, Entwürfe und Medienpakete
- gemeinsame Paketdaten und lokale Overrides ohne stille Überschreibungen
- zentrale Team- und Kaderdaten aus dem Liveticker
- zentrale Teamlogos aus `liveticker-team-logos`
- serverseitiges finales PNG-Rendering
- sichtbare Renderjobs mit Status, Retry und Kompatibilitätsversion
- Nextcloud als sichtbare gemeinsame Dateiablage für Medien und finale Ausgaben

Generatorinterne Tabellen liegen im privaten Schema `app_social_media`. Browserzugriffe bleiben an `public.pd_api(text, jsonb)` gebunden.

### Members

Zielrepository: `Plaerrdeifl/members`

Verantwortet:

- Mitglieder
- Mitgliedsanträge
- Antragsentscheidungen
- Mitgliedsstatus
- Portaluser-zu-Mitglied-Verknüpfung als Fachprozess
- Vorstand / Ämter
- mitgliedsbezogene Profile und Workflows
- Mitgliedsantrags-PDF, E-Mail- und öffentliche Intake-Abläufe

Portalbenutzer und Portalrollen bleiben Plattform-Core. Mitgliedschaft ist keine einfache globale Portalrolle.

### Finance

Zielrepository: `Plaerrdeifl/finance`

Verantwortet:

- Finanzkonten
- Buchungen
- Beiträge
- Beitragsklassen
- Beitragssaisons
- Zahlungsberichte
- Finanz-Auswertungen

Finance darf Members referenzieren, führt aber keine zweite Mitgliederverwaltung.

### Tasks

Zielrepository: `Plaerrdeifl/tasks`

Verantwortet:

- Aufgaben
- Teamaufgaben
- Zuweisungen
- Übergaben
- Status-/Waiting-Workflow
- Updates und Verlauf
- aufgabenbezogene Push-/Benachrichtigungsintegration

Portal-Dashboard und andere Module dürfen Aufgaben aggregiert anzeigen, ohne die Aufgabenlogik zu duplizieren.

### Mail

Zielrepository: `Plaerrdeifl/mail`

Verantwortet langfristig:

- Portal-Mailoberfläche für berechtigte Benutzer
- gemeinsame Funktionspostfächer
- Posteingang und Ordner
- Lesen, Antworten, Weiterleiten und neue Nachrichten
- Suche
- Entwürfe, Gesendet, Papierkorb
- Anhänge
- Berechtigungszuordnung von Portalteams/-capabilities zu Postfächern

Der Browser verbindet sich nicht direkt per IMAP/SMTP mit dem Mailprovider. Ein serverseitiger Mail-Gateway hält Provider-Credentials und spricht IMAP/SMTP. Mailbox-Passwörter oder andere Mailprovider-Secrets gelangen nicht in Browsercode oder LocalStorage.

Der Mailprovider bleibt Source of Truth für Nachrichten, Ordner, Flags und Anhänge. Das PD-Portal hält nur den für Berechtigungen, Audit und optionale Fachverknüpfungen notwendigen Zustand.

### Shop / WordPress / WooCommerce

Zielrepository für Shop-Integration: `Plaerrdeifl/shop`

WordPress bleibt:

- öffentliche Vereinswebsite
- Content-/News-System
- WooCommerce-/Shop-Laufzeit
- öffentlicher Einstiegspunkt in ausgewählte Portalprozesse

WordPress ist nicht Source of Truth für Portalbenutzer, Portalteams, Mitglieder, Events, Fanbus, Liveticker, Tasks, Finance oder Generator.

Die Shop-Integration verantwortet insbesondere:

- WooCommerce-Integration
- Bestellansichten
- Portal-Identity-Bridge
- shopbezogenen WordPress-Plugin-Code
- Mitglieder-/Benutzerbezug des Shops

## 4. Abhängigkeitsrichtung

```text
Cockpit / gemeinsame Anmeldung und Rechte
  |
  +-- zentrale Identity / pd_api / Plattformdienste (keine neue Datenwelt)
  |
  +-- Liveticker  <- Events-/Spielplandaten
  +-- Bildgenerator <- Liveticker-Team-/Kaderdaten und Events
  +-- Bus-Orga (später) <- Events und Fanbus-Fachdaten
  |
  +-- weitere Fachdienste nach späterer Freigabe
```

- Fachrepositories bleiben für ihre Fachlogik und Daten führend.
- Events bleibt zentrale Termin-/Spielplanquelle.
- Reisegruppe ist keine Buchung und keine organisatorische Portalteammitgliedschaft.
- Keine zweite Benutzer-, Team-, Rollen-, Auth- oder API-Welt.
- Organisatorische Portalteam-Berechtigungen werden nicht als neues Cockpit-Ziel übernommen; aktuelle Altverträge werden kontrolliert abgelöst.

## 5. Frontend / PWA

Das Cockpit ist das **gemeinsame installierbare Frontend** des neuen Produkts. Neue Fachfrontends verwenden grundsätzlich React + TypeScript + Vite und gemeinsame Bausteine aus `platform-ui`. Es entsteht keine parallele gemeinsame Portal-2.0-PWA.

- Initiale Cockpit-Module sind Liveticker und Bildgenerator; Bus-Orga kommt **danach**.
- Liveticker, Generator und Bus-Orga bleiben zugleich eigenständig direkt aufrufbar und installierbar.
- Jede PWA benötigt eindeutige Manifest-/Installations-ID und abgegrenzte Router-, Asset-, Start-URL- und Service-Worker-Scopes.
- Das aktuelle Cockpit nutzt `/cockpit/`; eine Root-Weiterleitung ist gegenüber einer unüberlegten Worker-Scope-Erweiterung vorzuziehen.
- Der bestehende alte Portal-Root-Service-Worker erfordert vor Ablösung eine nachweisbare Deinstallation/Entkopplung ohne Verlust fremder Modul-Caches oder aktiver Sitzungen.
- Kein iframe als Standardarchitektur, keine doppelte Fachlogik; eine führende Implementierung.
- DEV-Root-Umstellung und Legacy-Entfernung benötigen Browser-/Offline-/Login-/Fachmodul- und Recovery-E2E nach D-057.

## 6. Auth, Identity und externe Dienste

### Zentrale Portalidentität

Supabase Auth und der zentrale Portal-Bootstrap bilden die gemeinsame Identitäts- und Berechtigungsbasis.

Fachanwendungen verwenden dieselbe Session- und Capability-Logik.

Cockpit-Rollen sind an die vorhandene Portalidentität gebundene, **anwendungsbezogene** Zuordnungen; sie erzeugen weder globale Portal-Adminrechte noch zusätzliche Auth-Identitäten. Cockpit-Zugang wird unabhängig von der allgemeinen `portal.admin`-Wildcard serverseitig geprüft. Für Cockpit-Systemadministratoren werden die notwendigen Liveticker- und Generatorrechte gezielt autorisiert, nicht als allgemeiner Plattform-Wildcard gewährt. Die Cockpit-Zugangssperre wirkt nur auf `/cockpit/` und seine autorisierten Cockpit-Aktionen, nicht als globale Kontosperre.

### OAuth/OIDC

Das PD-Portal dient als zentrale Identity-/Autorisierungsquelle für angebundene Dienste.

Bestehender Systembestandteil:

- Portal OAuth/OIDC
- Nextcloud-Login über Portal
- Zugriffsableitung aus Portalteam/-berechtigung

Zielstruktur:

- Nextcloud bleibt eigener OAuth/OIDC-Client.
- WordPress wird eigener OAuth/OIDC-/SSO-Client.
- Clientname, Scopes und Zugangsregel werden clientbezogen behandelt und nicht im Consent-Flow fest auf Nextcloud verdrahtet.
- WordPress darf lokale technische Benutzer für Autoren, Revisionen und WordPress-interne Zuordnung führen.
- die führende Entscheidung, wer WordPress über das Portal nutzen darf, bleibt im PD-Portal.
- Social-Media-Zugang zu WordPress wird aus zentraler Portalteam-/Capability-Zuordnung abgeleitet.
- externe Dienste erhalten nur notwendige Claims/Scopes.

## 7. API- und Datenbankgrenze

Zentrale Browser-RPC-Grenze:

`public.pd_api(text, jsonb)`

Grundsätze:

- fachliche Aktionen über definierte API-Actions
- Autorisierung server-/datenbankseitig
- Anwendungstabellen nicht pauschal direkt aus dem Browser beschreiben
- interne Funktionen nur gezielt freigeben
- `service_role` ausschließlich serverseitig
- Default-Deny bei neuen Objekten und Rechten
- öffentliche Endpunkte nur bewusst und minimal freigeben
- Cockpit-Benutzeranlage, Rollen- und Fachrechteänderungen ausschließlich über eng begrenzte, auditierte Backend-Actions; keine generische Portal-Rechteverwaltung für Cockpit-Administratoren freigeben
- Änderungsberechtigung zusätzlich gegen den konkreten Zielbenutzer, dessen Cockpit-Rolle und die erlaubten Rechte prüfen; persönliche und anderweitig effektive Fachrechte getrennt behandeln

## 8. Plattformmodus / Schutzmechanismen

Die Plattform besitzt Betriebsmodi wie:

- `NORMAL`
- `READ_ONLY`
- `MAINTENANCE`

Zusätzlich bestehen Schutzmechanismen für User-Mutationen und ein streng benutzergebundener Release-Bypass.

Diese Mechanismen sind Betriebs- und Sicherheitsinfrastruktur und dürfen bei Fachfeature-Arbeiten nicht beiläufig entfernt oder umgangen werden.

**Offene Zielkorrektur nach D-056:** Das aktuelle `READ_ONLY` ist in M900 noch global und blockiert damit auch `cockpit_admin_access_set` und `cockpit_admin_personal_capabilities_set`. Das Cockpit braucht eine eng abgegrenzte, auditable serverseitige Betriebsregel sowie eine passende Frontend-Anpassung, sodass die Schutzsperre der alten Portaloberfläche nicht alle Cockpit-Mutationen blockiert. Kein globaler Modus-Bypass, keine ungeschützten Mutationen und keine automatische Aufhebung von `MAINTENANCE`.

## 9. Worker / Edge-Function-Muster

Das System nutzt Supabase Edge Functions und externe Worker/Gateways.

Bekannte Funktionsbereiche umfassen u. a.:

- Web Push / Notifications
- Mitgliedschaft
- Fanbus
- Kalender/ICS
- Publishing
- Liveticker
- WhatsApp/Sticker
- Social-Media-Rendering
- Mail-Gateway

Eine Supabase Edge Function und ein externer Worker sind nicht dasselbe. Laufzeitprobleme werden entlang der gesamten Kette untersucht.

## 10. WhatsApp-Kette

```text
Spieltags-UI
   |
   v
Liveticker API / Supabase
   |
   v
WhatsApp Outbox
   |
   v
Worker / Gateway
   |
   v
WPP Runtime / Session
   |
   v
WhatsApp
   |
   v
Delivery/Ack zurück ins Statusmodell
```

Fehler können auf jeder Ebene entstehen. UI-Status allein ist kein vollständiger Zustellnachweis.

## 11. Grafik-/Publishing-Kette

```text
Portal-/Fachmodulaktion
   |
   v
Job / Queue
   |
   v
Publishing Worker
   |
   v
Template + Fachdaten
   |
   v
Grafik / Datei
   |
   +--> Download / Archiv / Share
```

Fanbus-Publishing und Liveticker-Publishing sind fachlich getrennte Bereiche, auch wenn ähnliche Queue-/Worker-/Template-Muster genutzt werden.

Der Social-Media-Generator nutzt einen eigenen `social-media-render-worker`. Bestehende Liveticker- und M340-Worker werden dafür nicht umgebaut. Fachzustand liegt in Supabase, Acer dient als Rechenlaufzeit/temporäre Ablage und Nextcloud als sichtbare gemeinsame Dateiablage.

## 12. Supabase- und Backend-Ownership

SQL-Migrationen bilden die dauerhafte Datenbankhistorie.

Während der Modularisierung bleibt `Plaerrdeifl/portal-v4-dev/supabase` die einzige führende zentrale Migrationshistorie.

Ein zukünftiges Zielrepository `Plaerrdeifl/platform-backend` ist vorgesehen für:

- zentrale Supabase-Migrationen
- gemeinsame Edge Functions
- Datenbanktests
- Storage-Konfiguration
- zentrale API-Verträge
- Plattform-Sicherheitsregeln

Der Übergang zu `platform-backend` darf nur als eigener, ausdrücklich freigegebener und atomarer Cutover erfolgen. Es darf zu keinem Zeitpunkt zwei konkurrierende aktive Migrationshistorien geben.

Regeln für Migrationen:

- dauerhafte Schemaänderungen über versionierte Migrationen
- nicht nur Zeitstempel vergleichen
- fachliche Änderung und Zielzustand vergleichen
- DEV und PROD können kontrolliert unterschiedliche Zeitstempel oder Namen besitzen
- Drift bewusst analysieren
- keine manuelle PROD-Schemaänderung als dauerhafte Endlösung

## 13. Deployment

Cockpit ist das einzige neue Gesamtprodukt; es wird schrittweise mit **Liveticker und Bildgenerator zuerst**, **Bus-Orga danach** und später weiteren Fachdomänen ausgebaut. Der bisherige Portal-2.0-Gesamt-Cutover ist als Produktstrategie abgelöst (D-054).

DEV: Cockpit ist über `/cockpit/` integriert; die neue Ziel-Root-Adresse ist `https://dev.plaerrdeifl.de/`. Root-Routing, Alt-PWA-Rückbau, differenzierter Plattformmodus, echte Cockpit-Benutzer-/Rechte-E2E und sichere Bereinigung bilden **eigene nachzuweisende Arbeitsschritte**, nicht implizit erledigte Bestandteile der Entscheidung.

PROD: Das bestehende Portal 1.0 und die WordPress-Seite bleiben unverändert. Ein Cockpit-PROD-Release erfordert **immer** die separate ausdrückliche Freigabe und die vollständigen Voraussetzungen von D-053: Rollen-/Sicherheits-/Rechteentzugtests, Kompatibilität, isolierte Migrationsprobe, Worker-/Delivery-E2E, Routing/PWA-Isolation, Backup/Recovery/Rollback. Kein DEV-Datenkopieren nach PROD, keine zweite Migrationshistorie und kein automatisches Deployment in PROD.

Vor jeder technischen Änderung werden GitHub, CI, aktuelle Deployments, DEV-API/DB und erforderliche Runtime live geprüft; Commit oder Deployment allein ist keine fachliche Abnahme.

## 14. Domain- und Pfadrouting

Das neue Cockpit-Zielbild nutzt unter DEV die eigene Root-Adresse; PROD behält WordPress unter Root und fachlich freigegebene Modulpfade.

### PROD

```text
https://plaerrdeifl.de/            -> öffentliche WordPress-Website
https://plaerrdeifl.de/portal      -> PD-Portal-Core / Dashboard
https://plaerrdeifl.de/cockpit/     -> Fanszene Schweinfurt Cockpit (eigene PWA)
https://plaerrdeifl.de/events      -> Events / Spielplan
https://plaerrdeifl.de/fanbus      -> Fanbus
https://plaerrdeifl.de/liveticker  -> Liveticker
https://plaerrdeifl.de/generator   -> Social-Media-Generator
https://plaerrdeifl.de/members     -> Members
https://plaerrdeifl.de/finance     -> Finance
https://plaerrdeifl.de/tasks       -> Tasks
https://plaerrdeifl.de/mail        -> Mail
```

### DEV

**DEV-Ziel:** `https://dev.plaerrdeifl.de/` führt unmittelbar ins Cockpit, zunächst vorzugsweise über einen kontrollierten Redirect nach `/cockpit/`. Die benötigten Fach- und Integrationspfade (`/liveticker/`, `/generator/`, `/fanbus/`, `/events/`, `/oauth/` und API-/Runtime-/Assetpfade) bleiben erhalten. `/portal/` und alte Root-Assets bleiben nur während der nachgewiesenen Übergangs-/Abhängigkeitsphase. Kein PROD-Root-Redirect.

### Technische Routing-Grenze

Die öffentliche WordPress-Website bleibt als Origin bei Lima-City. Für PROD wird vor der Domain eine kontrollierte Routing-Schicht vorgesehen, die Portal-/Modulpfade an die jeweiligen Anwendungen leitet und alle übrigen öffentlichen Websitepfade weiterhin an WordPress/Lima-City durchreicht. Die dafür vorgesehene Zieltechnik ist Cloudflare-basiertes Pfadrouting.

DNS allein kann diese Pfadverteilung nicht abbilden. Ein Nameserver-/DNS-Cutover ist daher eine eigene PROD-Infrastrukturänderung und darf erst nach vollständigem DNS-Inventar, Übernahme aller für Website und Mail benötigten Records, DEV-/Staging-Test und ausdrücklicher PROD-Freigabe erfolgen.

Die Cockpit-PWA ist der neue gemeinsame Einstieg und bleibt zunächst unter `/cockpit/` gekapselt. Zusätzlich installierbare Fach-PWAs wie Fanbus, Liveticker und Generator verwenden ihre eigenen Anwendungspfade, eindeutige Manifest-IDs und voneinander getrennte Router-, Asset- und Service-Worker-Scopes. Der bestehende alte DEV-Root-Worker muss vor dem Root-Cutover gesondert bereinigt bzw. kontrolliert abgelöst werden; weder er noch die neue Cockpit-PWA dürfen eigenständige Fachmodule kontrollieren. Insbesondere darf die alte Portal-PWA weder WordPress unter `/` noch eigenständige Fachmodule kontrollieren; fachliche Service Worker dürfen keine fremden Anwendungsbereiche kontrollieren. Das Cockpit verwendet eine eindeutige Manifest-ID, Start-URL und ausschließlich auf `/cockpit/` begrenzte Router-, Asset-, Manifest- und Service-Worker-Scopes. Liveticker `/liveticker/` und Generator `/generator/` behalten eigene Installations-IDs und getrennte Scopes. Die konkreten Ziel-Scopes und appübergreifenden Session-/Navigationswege werden auf DEV abgenommen.

`portal.plaerrdeifl.de` und andere alte Moduladressen dürfen während der Migration als Übergang bestehen bleiben, sind aber nicht das langfristige kanonische Ziel.

## 15. Kontrollierte Modularisierung

Die Modularisierung erfolgt schrittweise.

Für jedes Modul gilt grundsätzlich:

1. aktuellen Ist-Zustand live inventarisieren
2. neues Modul parallel gegen DEV aufbauen
3. bestehende IDs und zentrale Fachdaten beibehalten
4. Funktionsparität definieren
5. Tests, Build und reale DEV-Abnahme durchführen
6. DEV kontrolliert auf die neue Modulversion umschalten
7. DEV-Altimplementierung erst danach entfernen
8. nächstes Modul auf DEV beginnen

Es wird jeweils eine aktive Migrationsphase entweder sauber abgeschlossen oder nach ausdrücklicher Koordinatorentscheidung mit dokumentierten offenen Arbeiten und Wiederaufnahmepunkt kontrolliert pausiert, bevor die nächste größere Phase begonnen wird. Neue Ideen dürfen geplant und dokumentiert werden, werden aber nicht ungeordnet als parallele Umbauten gestartet.

Die frühere separate Portal-2.0-Gesamtumschaltung entfällt als Ziel. Das Cockpit wird als neues Gesamtprodukt auf DEV ausgebaut, jedes Arbeitspaket separat geprüft; PROD-Releases nur nach konkreter Freigabe gemäß D-053. Die Legacy-DEV-Oberfläche wird erst nach Sicherung und Abhängigkeitsnachweisen gemäß D-057 entfernt.

## 16. Projektdokumentation

Die dauerhaften projektweiten Quellen bleiben bewusst klein:

- `ARCHITECTURE.md` → stabile technische Struktur
- `DECISIONS.md` → verbindliche fachliche und technische Entscheidungen

Tagesaktuelle technische Zustände, Testzahlen, Deployments und offene Aufgaben werden nicht als dauerhafte Snapshot-Dateien gepflegt.

Detaillierte Migrations- und Modulpläne dürfen versioniert in den betroffenen Repositories liegen, ersetzen aber nicht `ARCHITECTURE.md` und `DECISIONS.md` als projektweite verbindliche Quellen.

Damit Coding-Agenten und Entwickler in jedem bestehenden Repository denselben Projektkontext sehen, werden die aktuell relevanten projektweiten Architekturdateien zusätzlich als synchronisierte Spiegel unter `docs/pd-portal/` abgelegt. Diese Repo-Kopien sind keine eigene Source of Truth und dürfen nicht repo-spezifisch auseinanderentwickelt werden.

Ältere Chats dienen als Verlauf. Der aktuelle technische Ist-Zustand wird bei Bedarf live geprüft.

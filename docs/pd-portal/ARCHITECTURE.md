# PD-Portal – ARCHITECTURE

**Stand:** 29.09.2026  
**Zweck:** Stabile technische Landkarte des PD-Portals. Tagesaktuelle SHAs, Testzahlen, Deployments, Laufzeitstatus und offene Aufgaben gehören ausdrücklich nicht in diese Datei und werden bei Bedarf live geprüft.

## 1. Systembild

Das Gesamtprodukt heißt **PD-Portal** bzw. im Benutzerkontext einfach **Portal**.

Das PD-Portal ist eine gemeinsame Vereinsplattform aus einem zentralen Portal-Core, klar getrennten Fachmodulen und gemeinsamen Plattformdiensten.

```text
Benutzer
   |
   +--> PD-Portal
   |      |- Dashboard / Profil / Administration
   |      |- Moduleinbindung
   |      |- zentrale Identity / Capabilities / Teams
   |
   +--> eigenständig aufrufbare Fachanwendungen
          |- Events / Spielplan
          |- Fanbus
          |- Liveticker
          |- Social-Media-Generator
          |- Members
          |- Finance
          |- Tasks
          |- Mail
          |- Shop-Integration

Browser / PWA
   |
   | Auth + definierte RPC/API-Aufrufe
   v
Supabase
   |- Auth
   |- PostgreSQL
   |- public.pd_api(text, jsonb)
   |- Edge Functions
   |- Push / Notification
   |- zentrale Fachdaten
   |
   +----> externe/operative Worker und Dienste
          |- WPP / WhatsApp
          |- Grafik-/Publishing-Verarbeitung
          |- Social-Media-Render-Worker
          |- Mail-Gateway
          |- Nextcloud
          |- WordPress / WooCommerce
```

Fachmodule dürfen eigenständig aufrufbar sein, bleiben aber vollständig in das PD-Portal integrierbar. Es gibt pro Fachfunktion nur eine aktive fachliche Implementierung; das Portal baut keine zweite parallele Version desselben Moduls.

## 2. Umgebungen

### DEV

- bestehendes Übergangsrepository: `Plaerrdeifl/portal-v4-dev`
- Standardbranch: `main`
- gemeinsame DEV-Basis: `https://dev.plaerrdeifl.de`
- Portal-Core: `https://dev.plaerrdeifl.de/portal`
- Fachmodule spiegelgleich unter eigenen Pfaden, z. B. `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`
- Supabase-Ref: `tpieykhhawszlzsoflnl`

### PROD

- Repository: `Plaerrdeifl/portal`
- Standardbranch: `main`
- öffentliche Vereinswebsite: `https://plaerrdeifl.de/`
- Portal-Core: `https://plaerrdeifl.de/portal`
- Fachmodule unter eigenen Pfaden, z. B. `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`
- Supabase-Ref: `wplescvhlgctynkfwvrj`

`https://portal.plaerrdeifl.de` ist während der Migration nur eine technische Übergangsadresse. Nach dem kontrollierten PROD-Cutover soll sie auf `https://plaerrdeifl.de/portal` weiterleiten und nicht mehr die kanonische Benutzeradresse sein.

DEV und PROD sind bewusst getrennt. Ein DEV-Commit oder ein erfolgreicher DEV-Test ist keine automatische PROD-Freigabe.

Der Name `portal-v4-dev` bleibt während der Migration als bestehender technischer Repositoryname erhalten; er ist nicht mehr der Produktname des Gesamtsystems.

## 3. Repository- und Modulstruktur

### Portal-Core

`Plaerrdeifl/portal`

Langfristige Verantwortung:

- zentrale Portaloberfläche
- Dashboard
- Profil
- Benutzer
- Rollen und Capabilities
- Portal-Teams
- Administration und Einstellungen
- zentrale Benachrichtigungsoberfläche
- Audit-/Betriebsoberflächen
- Modulnavigation
- zentrale Identity-/OAuth-/OIDC-Integration

Der Portal-Core soll keine dauerhaft duplizierte Fachlogik aus Events, Fanbus, Liveticker, Generator, Members, Finance, Tasks, Mail oder Shop enthalten.

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

Die fachlichen Abhängigkeiten werden bewusst einseitig gehalten:

```text
Portal Core / Identity / Capabilities / Teams
   |
   +--> Events
   |      +--> Fanbus
   |      +--> Liveticker
   |      +--> Social-Media-Generator
   |
   +--> Members
   |      +--> Finance
   |
   +--> Tasks
   +--> Mail
   +--> Shop-Integration
   |
   +--> externe Identity-Clients
          |- Nextcloud
          |- WordPress
```

Grundregeln:

- Fanbus, Liveticker und Generator dürfen Events konsumieren.
- Events kennt keine Fanbus-, Liveticker- oder Generator-Fachlogik.
- Finance darf Members referenzieren; Members kennt keine Finanzbuchungslogik.
- alle Fachmodule verwenden zentrale Portalidentitäten und Capabilities.
- keine Fachanwendung baut eine zweite Benutzer-, Rollen-, Team- oder Auth-Welt auf.
- Cross-Modul-Navigation erfolgt über stabile IDs und definierte Navigationsverträge, nicht durch das Übernehmen fremder Fachlogik.

## 5. Frontend / PWA

Neue Fachanwendungen werden auf React + TypeScript + Vite ausgerichtet.

Bestehende ältere Portalbereiche werden schrittweise auf DEV migriert. PROD bleibt während dieses Gesamtumbaus als Portal 1.0 in Betrieb; es gibt keinen Big-Bang-Rewrite innerhalb der Entwicklung.

Gemeinsame Grundsätze:

- responsive Bedienung für Mobile, Tablet und Desktop
- gemeinsame Auth-/API-/Capability-Grundlagen
- gemeinsame Design-/UI-Bausteine, soweit sinnvoll
- Fachmodule dürfen eigenständige Arbeitsoberflächen und direkte URLs haben
- dieselbe Fachanwendung kann direkt und über das Portal genutzt werden
- kein iframe als Standardarchitektur für interne Fachmodule
- keine zweite Portalimplementierung derselben Fachfunktion
- für Benutzer wird genau **eine gemeinsame PD-Portal-PWA** als Installationsziel vorgesehen
- Fachmodule wie Events, Fanbus, Liveticker oder Generator bleiben technisch getrennte Builds/Module, werden aber nicht als konkurrierende Pflicht-PWAs beworben
- der endgültige Manifest-, Routing- und Service-Worker-Scope der gemeinsamen PWA wird in DEV so festgelegt und getestet, dass die öffentliche WordPress-Website auf `/` nicht von einem Portal-Service-Worker kontrolliert wird

Die bisherige Portal-1.0-PWA unter `portal.plaerrdeifl.de` kann wegen des Origin-Wechsels nicht still in die neue PWA unter `plaerrdeifl.de` umgewandelt werden. Für den PROD-Cutover ist deshalb ein geführter Nutzerwechsel vorgesehen: letzte Alt-PWA-Version mit deutlichem Wechselhinweis, Link zum neuen Portal, Installationshilfe je nach Browser/OS und Übergangsredirect der alten Portaladresse.

## 6. Auth, Identity und externe Dienste

### Zentrale Portalidentität

Supabase Auth und der zentrale Portal-Bootstrap bilden die gemeinsame Identitäts- und Berechtigungsbasis.

Fachanwendungen verwenden dieselbe Session- und Capability-Logik.

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

## 8. Plattformmodus / Schutzmechanismen

Die Plattform besitzt Betriebsmodi wie:

- `NORMAL`
- `READ_ONLY`
- `MAINTENANCE`

Zusätzlich bestehen Schutzmechanismen für User-Mutationen und ein streng benutzergebundener Release-Bypass.

Diese Mechanismen sind Betriebs- und Sicherheitsinfrastruktur und dürfen bei Fachfeature-Arbeiten nicht beiläufig entfernt oder umgangen werden.

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

DEV und PROD besitzen getrennte Deployments.

Während des Portal-2.0-Gesamtumbaus gilt:

- **DEV ist die vollständige Aufbau- und Abnahmeumgebung für das neue PD-Portal.**
- **PROD bleibt bis zum gemeinsamen Release weiterhin Portal 1.0.**
- neue Module werden auf DEV nacheinander integriert und dort nach erfolgreicher Abnahme auch als neue DEV-Einstiege verwendet
- es findet während dieses Umbaus grundsätzlich kein modulweiser Portal-2.0-Cutover nach PROD statt
- notwendige PROD-1.0-Bugfixes, Sicherheitskorrekturen oder dringende Betriebsarbeiten bleiben separat möglich
- Ticker, Generator, Frontends, Migrationen, Worker, Routing und Integrationen werden vor dem Release als gemeinsamer Release Candidate des neuen Portals geprüft
- vor dem echten PROD-Cutover wird die Migration gegen einen aktuellen, isolierten PROD-Datenstand geprobt; DEV-Daten werden nicht nach PROD kopiert
- der PROD-Wechsel erfolgt als koordinierter Cutover mit Recovery-Punkt, kontrollierten Migrationen, Deployments, Routing-Umschaltung und anschließendem End-to-End-Smoke-Test
- Portal 1.0 bleibt unmittelbar nach dem Cutover technisch als begrenzte Rückfallebene erhalten und wird erst nach bestätigter Stabilität entfernt

Jede konkrete PROD-Aktion braucht weiterhin eine eigene ausdrückliche Freigabe. Für Deployment-Arbeiten wird der aktuelle Hosting-, Workflow-, Datenbank- und Runtime-Status live geprüft. Diese Datei beschreibt keine tagesaktuellen Deployments.


## 14. Domain- und Pfadrouting

Das Zielbild verwendet eine gemeinsame Vereinsdomain mit klaren Anwendungspfaden.

### PROD

```text
https://plaerrdeifl.de/            -> öffentliche WordPress-Website
https://plaerrdeifl.de/portal      -> PD-Portal-Core / Dashboard
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

DEV spiegelt dieselbe Pfadstruktur unter `https://dev.plaerrdeifl.de`: `/portal`, `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`.

### Technische Routing-Grenze

Die öffentliche WordPress-Website bleibt als Origin bei Lima-City. Für PROD wird vor der Domain eine kontrollierte Routing-Schicht vorgesehen, die Portal-/Modulpfade an die jeweiligen Anwendungen leitet und alle übrigen öffentlichen Websitepfade weiterhin an WordPress/Lima-City durchreicht. Die dafür vorgesehene Zieltechnik ist Cloudflare-basiertes Pfadrouting.

DNS allein kann diese Pfadverteilung nicht abbilden. Ein Nameserver-/DNS-Cutover ist daher eine eigene PROD-Infrastrukturänderung und darf erst nach vollständigem DNS-Inventar, Übernahme aller für Website und Mail benötigten Records, DEV-/Staging-Test und ausdrücklicher PROD-Freigabe erfolgen.

Die Benutzer erhalten langfristig eine gemeinsame installierbare PD-Portal-PWA. Fachmodule dürfen direkte Pfade und eigenständige Builds besitzen, registrieren in der integrierten Zielumgebung aber keine konkurrierenden oder überlappenden Service Worker. Der endgültige PWA-Scope wird auf DEV so abgenommen, dass `/` als öffentliche WordPress-Website außerhalb der Portal-Service-Worker-Kontrolle bleibt.

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

Es wird jeweils eine aktive Migrationsphase sauber abgeschlossen, bevor die nächste größere Phase begonnen wird. Neue Ideen dürfen geplant und dokumentiert werden, werden aber nicht ungeordnet als parallele Umbauten gestartet.

Erst wenn das neue Portal auf DEV insgesamt vollständig, integriert und als Release Candidate abgenommen ist, wird ein gemeinsamer PROD-Cutover vorbereitet und separat freigegeben.

## 16. Projektdokumentation

Die dauerhaften projektweiten Quellen bleiben bewusst klein:

- `ARCHITECTURE.md` → stabile technische Struktur
- `DECISIONS.md` → verbindliche fachliche und technische Entscheidungen

Tagesaktuelle technische Zustände, Testzahlen, Deployments und offene Aufgaben werden nicht als dauerhafte Snapshot-Dateien gepflegt.

Detaillierte Migrations- und Modulpläne dürfen versioniert in den betroffenen Repositories liegen, ersetzen aber nicht `ARCHITECTURE.md` und `DECISIONS.md` als projektweite verbindliche Quellen.

Damit Coding-Agenten und Entwickler in jedem bestehenden Repository denselben Projektkontext sehen, werden die aktuell relevanten projektweiten Architekturdateien zusätzlich als synchronisierte Spiegel unter `docs/pd-portal/` abgelegt. Diese Repo-Kopien sind keine eigene Source of Truth und dürfen nicht repo-spezifisch auseinanderentwickelt werden.

Ältere Chats dienen als Verlauf. Der aktuelle technische Ist-Zustand wird bei Bedarf live geprüft.
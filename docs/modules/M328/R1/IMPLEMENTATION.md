# P300 / M328-R1 – BUS_ORGA Verwaltungszentrale

## Ziel

M328-R1 bündelt die bereits vorhandenen Fanbus-Verwaltungsfunktionen in einer eigenen, direkt erreichbaren Verwaltungszentrale. Es wird keine zweite Fanbus-Fachlogik und kein zweites Authentifizierungssystem eingeführt.

## Direktzugang

- statischer Einstieg: `/bus-orga/`
- Weiterleitung in dieselbe Portal-App auf `/#/bus-orga`
- nicht angemeldet: bestehender Portal-Login
- nach erfolgreichem Login: Rückkehr auf die geschützte Route über den bestehenden Post-Login-Mechanismus

## Zugriff

Mindestens eine der vorhandenen Capabilities ist erforderlich:

- `fanbus.manage`
- `fanbus.registrations.manage`
- `fanbus.operations.manage`
- `fanbus.payment_marker.manage`

Innerhalb der Verwaltungszentrale werden Arbeitsbereiche weiterhin granular nach den bestehenden Capabilities angeboten.

## R1-Oberfläche

Die Verwaltungszentrale bietet:

- nächste Fahrt mit Teilnehmer-/Wartelisten-/Kapazitätsübersicht
- priorisierte Schnellaktion `+ Anmeldung erfassen`
- Fahrtenverwaltung
- Teilnehmer & Warteliste
- Busse & Zuordnung
- Fahrtbetrieb
- Stammfahrer
- Personengruppen
- Fanbus-Einstellungen
- Fahrt anlegen

Die Schnellaktion verwendet den vorhandenen M326-Mehrpersonen-Composer. M328 erzeugt keine parallele Buchungslogik.

## Trennung von der normalen Fanbusansicht

Für berechtigte Verwaltungsnutzer wird auf der normalen Fanbusseite nur ein kompakter Einstieg `Bus-Orga` ergänzt. Verwaltungsfunktionen werden dort im normalen Kontext ausgeblendet:

- Fahrt anlegen
- Stammfahrer
- Personengruppen
- Fanbus-Einstellungen
- Teilnehmerliste / Busverwaltung / Fahrtbetrieb / Bearbeiten
- weitere Fahrtverwaltungsaktionen

Persönliche Portaluser-Funktionen wie `Meine Buchungen`, `Meine Fanbus-Standards` und `Meine Mitfahrer` bleiben davon unberührt.

Im BUS_ORGA-Kontext werden die bestehenden Fanbus-Arbeitsbereiche wieder sichtbar und unverändert verwendet.

## Backend / Datenmodell

M328-R1 benötigt keine neue Business-Migration und keine neue Datenhaltung. Wiederverwendet werden insbesondere:

- M310 Fahrtenverwaltung
- M320 Teilnehmer-/Kapazitäts-/Buszuordnung
- M320-R3 automatische Buszuordnung
- M325 Fahrtbetrieb
- M326 Stammfahrer, Personengruppen und manuelle Mehrpersonenbuchung
- M020 Benachrichtigungen
- M900 Plattformmodus

## Security

Die neue Route ist nur für aktive Portalnutzer mit mindestens einer Fanbus-Verwaltungscapability erreichbar. Die bestehende API-Autorisierung bleibt maßgeblich; das Ausblenden von UI-Elementen ist keine Sicherheitsgrenze.

## Scope

Keine neue Rolle, keine zweiten Passwörter, keine zweite Buchungslogik, keine zweite Zuordnungslogik und keine neue Notification-Pipeline.

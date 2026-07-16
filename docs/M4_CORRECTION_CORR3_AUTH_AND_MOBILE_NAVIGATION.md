# M4 Corr3 – Auth-UX und mobile Navigation

**Status:** gebündelte letzte UX-Korrektur innerhalb von Milestone 4  
**Basis:** `37b4657bbd67c4073c9ba92a17561bcc145b8e36` / `r7.1-m4-final-corr2`  
Backend: Version 69, unverändert  
**Build:** `2026.07.16-r7.1.m4-corr3-auth-mobile-navigation`

## Ziel

Corr3 schließt die sichtbaren Einstiegs-, Ausstiegs- und Mobilnavigationspunkte in einer gemeinsamen Korrektur ab. Fachlogik, API-Verträge, Rollen, Rechte und Datenbanken werden nicht verändert.

## Auth-UX

- Kompaktes A/B-Mischdesign: dunkler Markenbereich plus zentrale weiße Karte.
- Keine Portalnavigation auf Login, Registrierung, Pending und Profilvervollständigung.
- Öffentliche Startseite ohne Burger- und Bottom-Navigation.
- Fester Google-Button-Bereich ohne Layoutspringen.
- Registrierung in derselben Karte; Google-E-Mail schreibgeschützt, Vorname/Nachname getrennte Pflichtfelder.
- Eindeutiger Pending-Status ohne doppelten Antrag.
- Sitzungsablauf, Offline-/Verbindungsprobleme und Google-Fehler werden in der Karte gespiegelt.
- Deep-Link-Merker bleibt bei Sitzungsablauf erhalten.
- Logout zeigt unmittelbar „Du wirst abgemeldet …“ und blockiert Mehrfachklicks.
- Auch während der verpflichtenden Profilvervollständigung bleibt eine sichere Abmeldung möglich.
- Logout in einem zweiten Tab löst einen kontrollierten lokalen Rücksprung aus.

## Mobile Navigation

- Bottom-Navigation: vier häufige erlaubte Hauptbereiche plus „Mehr“.
- Mit Fanclubzugriff: Dashboard, Fanclub, Aufgaben, Teams, Mehr.
- Ohne Fanclubzugriff: Dashboard, Aufgaben, Teams, Fanbusse, Mehr.
- Burger und „Mehr“ öffnen dieselbe vollständige Portalübersicht.
- Unterseiten werden nur entsprechend vorhandener Rollen-, Team- und Bereichsrechte angeboten.
- Konto, Verbindungsstatus, Aktualisieren, App-Installation, Version und Abmeldung sind im vollständigen Menü gebündelt.

## Gestaltungsregeln

- Bestehende Petrol-/Marine-/Blau-Farbwelt bleibt unverändert.
- Gleiche Buttonhöhen und konsistente Schriftgrößen.
- Keine Zeilenumbrüche auf Navigations- und Aktionsbuttons.
- Weiße Logo-Innenränder auf ungefähr zehn Prozent reduziert.
- Safe Areas, 320/390/430 Pixel und reduzierte Bewegung berücksichtigt.

## Scope

Exakt neun Dateien:

- `css/m4-corr3.css`
- `docs/CHANGELOG.md`
- `docs/M4_CORRECTION_CORR3_AUTH_AND_MOBILE_NAVIGATION.md`
- `index.html`
- `js/config.js`
- `js/m4-corr3-ux.js`
- `pages/login.html`
- `pages/profile.html`
- `service-worker.js`

## Abnahme

- Login und Registrierung ohne Portalnavigation.
- Pending, Session-Expired, Offline, Google-Fehler und Logout sichtbar und verständlich.
- Bottom-Navigation immer gleichmäßig, einzeilig und rollenabhängig.
- Burger und „Mehr“ öffnen identische vollständige Navigation.
- Keine horizontale Seitenbreite bei 320, 390 und 430 Pixeln.
- Keine First-Party-JavaScript- oder CSP-Fehler.


# Changelog

## R7.1 Milestone 4 – Paketstand 14. Juli 2026

### Hinzugefügt

- AE-R7.1-01 mit getrennten Pflichtfeldern Vorname/Nachname
- verpflichtende Registrierung und Profilvervollständigung
- feste sechs Hauptbereiche
- Aufgabenmodul mit vier Unterseiten
- Teamsmodul mit vier Unterseiten
- Fanbusse-Informationsseite
- exakte Admin-Unterseitenstruktur
- frühe App-Shell und dynamische Modulimporte
- minimaler Service-Worker-Shellcache
- Namensintegritätsstatus und datensparsame Audits

### Geändert

- normaler Apps-Script-Aufruf leitet zur GitHub-Pages-PWA
- Kasse in Fanclub integriert
- Vorstand in Aufgaben integriert
- `Fanbus` zu `Fanbusse`
- Cache-, Query- und Buildkennungen auf M4
- Google-Login ohne Anzeigename-/E-Mail-Fallback
- Admin- und Antragsformulare mit serverseitiger Namensprüfung

### Sicherheit

- Profilzustand wird zentral am API-Dispatch erzwungen
- keine API-/Bridgeantworten im dauerhaften Service-Worker-Cache
- führende Tabellen-Formelzeichen in Namen werden abgewiesen
- alte und neue Vollnamen werden im M4-Namensaudit nicht gespeichert

### Weiter offen vor Release

Produktiver Pull/Push/Deploymentnachweis, Bestandszahlen und -bereinigung, Live-Smoke, Browser-/Geräteabnahme und A-M3-01-Laufzeitmatrix.

## 2026-07-15 – R7.1 M4 Performance-/Startup-Finish

- Der Vollbild-Ladebildschirm bleibt bis zur vollständig nutzbaren ersten Route sichtbar.
- Startphasen und kontrollierter Neustart werden im unteren Splashbereich angezeigt.
- Hintergrund-Warmup startet erst nach der ersten nutzbaren Ansicht und nutzt einen gebündelten Leseaufruf.
- Dashboard, Aufgaben, Teams, Fanclub und Administration verwenden gemeinsame kurzlebige In-Memory-/Sofortansichten.
- Der Systemstatus öffnet als Schnellstatus; die vollständige 26-Tabellen-Prüfung wird nur noch ausdrücklich gestartet.
- Service Worker und Offlinezustand wurden für verständliche Wiederverbindung und Sitzungserhalt erweitert.
- Mobile Breiten und angenäherter 200-%-Zoom wurden gegen horizontales Seitenoverflow abgesichert.
- Favicon und automatisierte Browser-Abnahme wurden ergänzt.
- Apps-Script-Backend und produktive Backend-Version 62 bleiben unverändert.

## 2026-07-15 – R7.1 M4 Performance-Finish 2

- Aufgaben- und Fanclub-Warmup verwenden jetzt pro Datensatz geteilte laufende Requests statt paralleler Doppelaufrufe.
- Aufgaben werden unmittelbar nach dem ersten nutzbaren Dashboard im Hintergrund vorbereitet.
- Dashboard-Sofortansichten bleiben für normale Wiederstarts bis zu 24 Stunden nutzbar und werden im Hintergrund aktualisiert.
- Offline-Navigation liefert eine eindeutige Offline-Seite statt eines erneut startenden Online-App-Shells.
- Der Browser-Runner erzwingt für die Startmessung ein echtes neues Dokument und misst bis zum sichtbaren nutzbaren Dashboard.
- Backend-Version 62 und alle fachlichen Rechte-/Schreibregeln bleiben unverändert.
## 2026.07.15-r7.1.m4-uiux-p1

- Neues visuelles Grundsystem in Petrol/Marineblau mit hellem Kartenbereich und blauem Hauptakzent.
- Mobile Kopfzeile und feste Fünf-Punkt-Navigation mit Bereich „Mehr“.
- Desktop-Seitenleiste, Benutzeranzeige, Buttons, Formulare, Dialoge und Statusflächen vereinheitlicht.
- Dashboard als erste Referenzseite vollständig neu gestaltet.
- Bestehende Fachlogik, Rollen, Rechte und Backend-Verträge unverändert.
- App-Icon bleibt vorläufig als austauschbarer Logo-Platzhalter eingebunden.

## 2026.07.16-r7.1.m4-uiux-p1.1-mobile

- Mobile Fachseiten werden strikt auf die Viewportbreite begrenzt.
- Unterseiten-Tabs werden mobil vollständig als zweispaltiges Raster dargestellt; auf sehr schmalen Geräten einspaltig.
- Teams-, Fanclub-, Aufgaben- und Admin-Inhalte können keine unsichtbare Seitenbreite mehr erzeugen.
- Die mobile Desktop-Topbar-Überschrift bleibt absichtlich verborgen; die sichtbare Überschrift steht im jeweiligen Seiteninhalt.
- Der Browser-Runner prüft mobil Hash, Ladezustand und sichtbare Inhaltsüberschrift statt das absichtlich verborgene Desktop-Element `#routeTitle`.
- Fachlogik, Rollen, Rechte und Backend-Version 62 bleiben unverändert.

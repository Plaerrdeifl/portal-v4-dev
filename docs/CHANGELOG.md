# Changelog
## 2026-07-16 – M4 UI/UX Paket 3

- Teams vollständig als moderne Arbeitsansicht mit KPI-Zusammenfassung, Rollen- und Mitgliederkarten überarbeitet.
- Teamverwaltung, Teamdetails und Teamfunktionen visuell vereinheitlicht, Fachlogik und Rechte unverändert.
- Administration in klar getrennte Fanclub- und Portalbereiche mit geschützten Aktionskarten gegliedert.
- Dialoge, Formulare und Verwaltungslisten für Desktop und Mobil vereinheitlicht.
- Fanbusse als hochwertige v4-Vorschau gestaltet, weiterhin ohne vorgezogene Bus-Fachlogik.
- Buildmarker und Service-Worker-Cache auf `2026.07.16-r7.1.m4-uiux-p3` erhöht.
- Backend-Version 62, API-Verträge und R7.1-Fachentscheidungen unverändert.

## 2026-07-16 – M4 UI/UX Paket 2

- Fanclub und Aufgaben vollständig an das neue App-Shell-Design angepasst.
- Unterseiten-Navigation auf Desktop und Mobil vollständig sichtbar.
- Mitglieder, Beiträge und Kassenbuch mit Desktoptabellen und eigenständigen Mobilkarten.
- Fanclubübersicht, Konten und Zahlungsmeldungen als moderne KPI- und Kartenansichten.
- Aufgaben mit Prioritätsleiste, Statusübersicht, Suche und lokalen Filtern.
- Dashboard- und Teams-Sofortansichten nutzen einen 24-Stunden-Lesecache und aktualisieren im Hintergrund.
- Buildmarker und Service-Worker-Cache auf `2026.07.16-r7.1.m4-uiux-p2` erhöht.
- Backend, Rechte und API-Verträge unverändert.


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

## 2026-07-16 – M4 corr1: frühe App-Shell

- App-Shell, Navigation und Lade-/Skeletonzustand werden vor der langsamen Backend-Antwort sichtbar.
- Service-Worker-Cache und Buildkennung auf `2026.07.16-r7.1.m4-corr1-startup-shell` angehoben.
- Keine Backend- oder Fachlogikänderung.

## 2026-07-16 – M4 Corr1 Startup-Shell und Login-Übergang

- App-Shell und Skeleton werden vor der langsamen Backend-Antwort sichtbar.
- Nach Google-Anmeldung erscheint bis zur fertigen Portalroute eine neutrale Portal-Ladeansicht statt des öffentlichen Bereichs.
- Geschützte Deep Links werden über den Login hinweg erhalten und nach erfolgreicher Anmeldung wiederhergestellt.
- Neuer Korrektur-Build: `2026.07.16-r7.1.m4-corr1-startup-login`.
- Keine Backend-, Datenbank-, Rollen- oder Rechteänderung.

## 2026-07-16 – M4 Corr2 mobiler Google-Login und Logo

- Die Login-Übergangsansicht ist bereits statisch im Dokument vorhanden und wird auf Mobilgeräten unmittelbar nach der Google-Kontoauswahl eingeblendet.
- Ein zusätzlicher, unabhängiger Beobachter aktiviert die Übergangsansicht schon beim Status „Google-Konto und Rechte werden geprüft“, bevor die Backend-Anmeldung abgeschlossen ist.
- Während der Rechteprüfung wird das Google-Iframe vollständig ausgeblendet; Text und Button können sich nicht mehr überlagern oder gegenseitig zusammendrücken.
- Das Logo auf der öffentlichen Startseite behält mit `height: auto` und `object-fit: contain` immer sein natürliches Seitenverhältnis.
- Neuer Korrektur-Build: `2026.07.16-r7.1.m4-corr2-mobile-login-logo`.
- Backend-Version 69, Deployment, Datenbanken, Rollen, Rechte und Fachlogik bleiben unverändert.

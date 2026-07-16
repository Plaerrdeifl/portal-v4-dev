# ADR – M4 UI/UX P1.1 Mobile Fachseiten und Routenprüfung

## Status

Verbindlich für den M4-UI/UX-Stand ab `2026.07.16-r7.1.m4-uiux-p1.1-mobile`.

## Entscheidung

Die Überschrift `#routeTitle` gehört zur Desktop-Topbar und bleibt auf mobilen Viewports verborgen. Jede Fachseite besitzt im eigentlichen Inhaltsbereich eine sichtbare Seitenüberschrift. Eine zusätzliche mobile Einblendung von `#routeTitle` würde Überschriften doppeln und ist daher nicht vorgesehen.

Der Browser-Runner bewertet mobile Routen anhand von:

1. korrektem Hash,
2. abgeschlossenem Ladezustand von `#view`,
3. sichtbarer Überschrift im Inhaltsbereich,
4. fehlender Fehleransicht.

Unterseiten-Navigationen (`.module-tabs`) werden mobil nicht mehr als breiter horizontaler Streifen behandelt. Sie erscheinen vollständig als zweispaltiges Raster, auf sehr schmalen Geräten einspaltig. Alle Fachseiten-Container erhalten eine explizite Breitenbegrenzung und `min-width: 0`.

## Begründung

Der frühere Test meldete sechs mobile Fehler, obwohl die Seiten sichtbar waren. Ursache war ausschließlich der falsche Prüfselektor auf das absichtlich verborgene Desktop-Element. Unabhängig davon zeigte die Teams-Aufnahme einen echten mobilen Breitenfehler und nur teilweise sichtbare Unterseiten-Tabs. Beide Themen werden getrennt und korrekt behoben.

## Unverändert

Backend-Version 62, API-Verträge, Fachlogik, Rollen, Rechte und Datenbankstruktur bleiben unverändert.

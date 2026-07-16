# ADR – M4 UI/UX Paket 2: Fanclub und Aufgaben

**Status:** umgesetzt, noch nicht final getaggt  
**Stand:** 16. Juli 2026

## Entscheidung

Die Fachbereiche **Fanclub** und **Aufgaben** erhalten dieselbe visuelle Sprache wie App-Shell und Dashboard aus Paket 1:

- dunkle Marine-/Petrol-Heldenbereiche,
- überlappende helle Inhaltsflächen,
- vollständig sichtbare Unterseiten-Navigation,
- große Touchflächen,
- rollenabhängige Schnellzugriffe,
- moderne Tabellen auf Desktop und eigenständige Karten auf Mobilgeräten,
- klare Prioritäts-, Status- und Finanzdarstellung,
- einheitliche Lade-, Leer- und Fehlerzustände.

Die fachlichen API-Verträge, Rechte und Schreibabläufe bleiben unverändert.

## Fanclub

Überarbeitet werden:

- Übersicht,
- Mitglieder,
- Beiträge,
- Beitragszahlungsmeldungen,
- Kassenbuch,
- Konten,
- zugehörige Formulare und Detaildialoge.

Alle Unterseiten bleiben auf 390 Pixel Breite gleichzeitig erreichbar. Desktoptabellen werden mobil durch geeignete Karten ersetzt.

## Aufgaben

Überarbeitet werden:

- Meine Aufgaben,
- Teamaufgaben,
- Vorstandsaufgaben,
- Archiv,
- Prioritäts- und Statusdarstellung,
- lokale Suche und Filter,
- Erstellen, Bearbeiten, Statuswechsel, Wiederöffnen, Archivieren und eigene Notizen.

Die im Backend gelieferten Fähigkeiten bestimmen weiterhin, welche Aktionen sichtbar sind.

## Sofortansichten

Dashboard- und Teamsdaten dürfen aus einem höchstens 24 Stunden alten lokalen Lesecache sofort dargestellt werden. Die Aktualisierung läuft anschließend im Hintergrund. Schreibvorgänge bleiben davon unberührt und invalidieren weiterhin die bestehenden Laufzeitcaches.

## Abgrenzung

Nicht Bestandteil dieses Pakets:

- Änderungen am Apps-Script-Backend,
- neue Rollen oder Rechte,
- neue Fachfelder,
- visuelle Vollüberarbeitung von Teams und Administration,
- finaler Milestone-4-Tag.

# ADR – M4 Performance-Finish 2

## Status

Angenommen am 15. Juli 2026.

## Ausgangslage

Die automatisierte Browser-Abnahme des ersten Performance-/Startup-Finish zeigte:

- Aufgaben Desktop: 11,108 Sekunden,
- Fanclub Mobil: 5,495 Sekunden,
- Offline-Test: keine eindeutig erkennbare Offline-Shell,
- Startmessung des Runners: falscher Frühabschluss trotz sichtbarer Timeline von rund 11 Sekunden.

## Entscheidung

1. Fach-Warmups werden als einzelne, gemeinsam genutzte Promises geführt.
2. Aufgaben und Fanclub starten unmittelbar nach dem ersten nutzbaren Dashboard.
3. Öffnet eine Route während ihres Warmups, nutzt sie denselben laufenden Request.
4. Der Service Worker liefert bei fehlgeschlagener Navigation ausdrücklich `offline.html`.
5. Der Runner erzwingt für die Startmessung eine echte Dokumentnavigation mit eindeutigem Laufparameter.
6. Dashboard-Sofortdaten dürfen auf dem bereits authentifizierten Gerät bis zu 24 Stunden angezeigt und anschließend im Hintergrund aktualisiert werden.

## Nicht geändert

- Apps-Script-Backend; Backend-Version 62,
- Rollen, Rechte und serverseitige Autorisierung,
- schreibende Fachfunktionen,
- Datenbankschemata.

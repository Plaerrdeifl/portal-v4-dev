# Administrierbare Aufgabenrechte R1

## Fachliche Festlegung

Rollen, Ämter und Teamfunktionen definieren Mindestzugriffe. Individuelle
Aufgabenrechte sind ausschließlich additive Ausnahmen und werden nur durch
vollständige Portaladministratoren vergeben.

## Admin-Oberfläche

`Administration → Benutzer → Aufgabenrechte`

Dort werden getrennt angezeigt:

- automatisch geerbter Rollenstandard;
- individuell gespeicherte Zusatzrechte;
- daraus berechneter effektiver Zugriff.

## Aufgabenspezifische Zusatzregeln

- alle Teamaufgaben;
- Vorstandsaufgaben;
- Archiv: eigene / ausgewählte Teams / alle Teams / vollständig;
- sichtbare Aufgaben direkt übertragen.

Die früheren persönlichen Schalter `Aufgaben erstellen` und `Aufgaben global
verwalten` werden nicht mehr hier geführt. Sie entsprechen den zentralen
Capabilities `tasks.create` und `tasks.manage` unter
`Administration → Benutzer → Zusatzrechte`.

## Rücksetzung

`Auf Rollenstandard zurücksetzen` löscht nur die individuellen
aufgabenspezifischen Regeln. Ämter, Teamrollen, Portalrollen und deren
Mindestzugriffe bleiben unverändert. Zentrale persönliche Capabilities bleiben
ebenfalls unverändert.

## Sicherheit

Die Anzeige im Frontend ist nur eine Darstellung. Die eigentliche
Berechtigungsprüfung und Archivfilterung erfolgt serverseitig in Supabase.

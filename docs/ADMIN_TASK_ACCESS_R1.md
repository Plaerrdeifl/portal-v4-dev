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

## Zusatzrechte

- alle Teamaufgaben;
- Vorstandsaufgaben;
- Archiv: eigene / ausgewählte Teams / alle Teams / vollständig;
- Aufgaben erstellen;
- Aufgaben global verwalten;
- sichtbare Aufgaben direkt übertragen.

## Rücksetzung

`Auf Rollenstandard zurücksetzen` löscht nur die individuellen Zusatzrechte.
Ämter, Teamrollen, Portalrollen und deren Mindestzugriffe bleiben unverändert.

## Sicherheit

Die Anzeige im Frontend ist nur eine Darstellung. Die eigentliche
Berechtigungsprüfung und Archivfilterung erfolgt serverseitig in Supabase.

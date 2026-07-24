# Rollenabhängiges Dashboard R1

## Grundsatz

Das Dashboard ist additiv. Eine Karte wird nur erzeugt, wenn der Benutzer
fachlich berechtigt ist und die Karte einen relevanten Inhalt besitzt.

## Rollenmatrix

| Benutzer | Mitgliedsdaten | Eigene Aufgaben | Teamaufgaben | Vorstand | Finanzen |
|---|---:|---:|---:|---:|---:|
| Portalbenutzer | Nein | Nein | Nein | Nein | Nein |
| Mitglied | Ja | Bei vorhandenen Aufgaben | Nach Teamrecht | Nein | Nein |
| Teammitglied | Bei Mitgliedslink | Bei vorhandenen Aufgaben | Ja | Nein | Nein |
| Vorstand | Ja | Bei vorhandenen Aufgaben | Ja | Ja | Ja |
| Administration | Bei Mitgliedslink | Bei vorhandenen Aufgaben | Nach Recht | Ja | Ja |

Individuelle Aufgabenrechte erweitern die Aufgabenbereiche entsprechend der
bereits bestehenden Aufgabenberechnung.

## Geburtstagsdatenschutz

Gespeichert wird das vollständige Geburtsdatum. An das Dashboard werden
jedoch nur Name und nächstes Kalenderdatum übertragen. Das Geburtsjahr und
das Alter bleiben verborgen.

## Leeres Dashboard

Ein normaler Portalbenutzer erhält keine Ersatzkarte. Nach erfolgreichem
Laden bleibt `#dashboardWidgets` ohne Kindelemente.

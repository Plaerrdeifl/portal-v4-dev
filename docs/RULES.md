# Verbindliche Regeln – Plärrdeifl Portal v3 R7.1

Stand: 14. Juli 2026

## Identität und Namen – AE-R7.1-01

Jeder Portalbenutzer und jeder gültige Freischaltungsantrag besitzt getrennte, getrimmte Pflichtfelder `Vorname` und `Nachname`. Google `given_name` und `family_name` dürfen ausschließlich vorbelegen. Google-Anzeigename, E-Mail und technisch erzeugte Platzhalter ersetzen die Felder nicht. Unvollständige aktive Benutzer erhalten ausschließlich den Zustand `PROFIL_VERVOLLSTAENDIGUNG_ERFORDERLICH`, Profil-Speichern und Logout. Rechte und Zuordnungen bleiben unverändert.

## Portalrollen und Rechte

Ein Benutzer besitzt genau eine Portalrolle. Teamrechte ergänzen ausschließlich teambezogene Funktionen. Admin-Override, drei feste Portalrollen, fünf feste Amtsplätze und die feste Hauptnavigation sind nicht konfigurierbar abschaltbar. Jede Fachaktion wird serverseitig geprüft; versteckte Buttons sind kein Sicherheitsmechanismus.

## Navigation

Die angemeldete Hauptnavigation ist unveränderlich geordnet: Dashboard, Fanclub, Aufgaben, Teams, Fanbusse, Administration. Kasse ist Fanclub-Unterseite, Vorstandsaufgaben sind Aufgaben-Unterseite. Fanbusse ist in v3 ausschließlich eine Informationsseite.

## Datenbanken

Tabellenkopf steht in Zeile 1, Daten beginnen in Zeile 2. Es werden stabile IDs statt physischer Zeilennummern verwendet. Datenbanktabellen enthalten keine Formeln. Benutzertexte werden vor Spreadsheet- und Scriptinjektion geschützt.

## Legacy

Die alte Apps-Script-SPA bleibt als gekennzeichneter Rückfallbestand physisch erhalten, besitzt aber keinen normalen produktiven Einstieg. Der normale Apps-Script-Aufruf leitet zur GitHub-Pages-PWA; Bridge- und OAuth-Funktionen bleiben erhalten.

## Milestone-Gates

A-M3-01 und AE-R7.1-01 bleiben verbindliche M5-Release-Gates. Nicht ausgeführte Live-, Datenbank-, Nebenläufigkeits-, Browser- oder Gerätetests dürfen nicht als bestanden markiert werden.

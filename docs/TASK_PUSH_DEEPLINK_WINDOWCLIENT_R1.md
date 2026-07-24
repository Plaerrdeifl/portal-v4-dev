# Aufgaben-Push-Deep-Link über WindowClient R1

Beim Antippen einer Aufgaben-Push-Meldung wird die vollständige Hash-Route dauerhaft in die URL des PWA-Fensters übernommen.

Reihenfolge:
1. vorhandenes Fenster mit `WindowClient.navigate()` navigieren;
2. navigiertes Fenster fokussieren;
3. bei fehlender Unterstützung `OPEN_PUSH_ROUTE` senden;
4. ohne Fenster ein neues Fenster mit der Ziel-URL öffnen.

Die Browserseite besitzt genau einen zuständigen Listener für `OPEN_PUSH_ROUTE`: `js/task-push-r3.js`.

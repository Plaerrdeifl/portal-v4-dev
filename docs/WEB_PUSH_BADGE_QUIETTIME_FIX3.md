# Plärrdeifl Portal V4 – Web Push Badge & Quiet Time FIX3

## Ziel

Nach dem erfolgreichen Web-Push-Dialog-UI-Fix bleiben noch zwei Punkte:

1. Die Uhrzeitfelder im Bereich **Ruhezeit** sollen unten ebenfalls sauber zum Portalstil passen und bei deaktivierter Ruhezeit nicht wie aktive Hauptelemente wirken.
2. Das App-Badge zeigt noch eine rote Zahl, obwohl keine echten ungelesenen Portal-Meldungen mehr vorhanden sind.

## Umsetzung

### Frontend
- Uhrzeitfelder unten im Push-Dialog werden portaltypisch nachgestylt.
- Bei deaktivierter Ruhezeit werden die Zeitfelder automatisch deaktiviert und visuell zurückgenommen.
- Nach dem Öffnen eines Aufgabenverlaufs wird das App-Badge sofort neu synchronisiert.
- Zusätzlich wird ein internes Änderungsereignis für Benachrichtigungsstände ausgelöst.
- Service-Worker-Cache-Version wird erhöht.

### Datenbank / DEV-Migration
- Bestehende `PUSH_TEST`-Meldungen werden rückwirkend als gelesen markiert.
- `PUSH_TEST`-Meldungen zählen künftig **nicht mehr** zum Badge-Zähler.
- Neue Testmeldungen werden direkt als gelesen gespeichert, damit Testläufe das App-Symbol nicht dauerhaft verfälschen.

## Ergebnis

- Testmeldungen vermüllen das rote App-Badge nicht mehr.
- Das Badge aktualisiert sich nach dem Lesen von Aufgabenverläufen unmittelbar.
- Die Ruhezeit-Uhrzeiten am unteren Rand wirken stimmig und sind bei deaktivierter Ruhezeit passend gedimmt.

## Abschlusskennung

`V4_WEB_PUSH_BADGE_QUIETTIME_FIX3_OK`

## FIX2

- Behebt den Operator-ReferenceError bei `${escapeHtml(...)}`.
- Alle vier Uhrzeit-Quelltextanker werden jetzt als Literale behandelt.
- Ein eigener Patch-Laufzeittest läuft vor dem isolierten Repository-Preflight.
- Ruhezeitwerte bleiben beim Ausschalten erhalten.
## FIX3

FIX3 entfernt die fehleranfällige dynamische HTML-Attributzeile vollständig.
Die Uhrzeitfelder werden nach dem Rendern per DOM-Eigenschaft auf
`readOnly` gesetzt beziehungsweise wieder freigegeben. Dadurch bleiben
die Werte im Formular enthalten, ohne dass verschachtelte Anführungszeichen
den erzeugten JavaScript-Code beschädigen können.

Der Operator schreibt den vollständig gepatchten Push-Quelltext außerdem
in eine temporäre Datei und führt `node --check` darauf aus, bevor ein
Repository geklont oder verändert wird.

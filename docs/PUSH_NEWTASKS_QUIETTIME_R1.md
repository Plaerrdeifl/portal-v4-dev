# Plärrdeifl Portal V4 – Neue-Aufgaben-Push & kompakte Ruhezeit R1

## Ausgangsstand

- Commit: `2375278043de70e6740d6da7b6d9c891fb69ec09`
- Branch: `v4-supabase-dev`
- Supabase DEV wird ausschließlich für die neue Migration verwendet.
- Supabase PROD bleibt ausgeschlossen.
- Edge Function, VAPID-Schlüssel und Push-Secrets bleiben unverändert.

## Enthaltene Änderung 1: Push bei neuen Aufgaben

Beim Erstellen einer Aufgabe wurde sie im Portal bereits als **neu**
angezeigt. Für Web Push fehlte jedoch noch ein Eintrag in
`app_portal.notifications`.

Das gemeinsame Paket ergänzt:

- Ereignis `TASK_CREATED`
- Push an alle aktiven Benutzer, für die die neue Aufgabe sichtbar ist
- Ersteller erhält keine eigene Meldung
- Team- und Vorstandsrechte werden über die vorhandene Sichtbarkeitsfunktion geprüft
- Antippen öffnet direkt die neue Aufgabe
- eigener Schalter **Neue Aufgaben**
- keine rückwirkenden Meldungen für alte Aufgaben

## Enthaltene Änderung 2: kompakte Ruhezeitfelder

Die nativen iOS-Zeitfelder wurden trotz äußerer CSS-Höhe weiterhin groß
gerendert. Deshalb werden jetzt auch die internen WebKit-Bestandteile
überschrieben.

Das gemeinsame Paket ergänzt:

- kompakte zweispaltige Zeile **Von / Bis**
- feste Feldhöhe von 34 Pixeln
- `appearance: none` und `-webkit-appearance: none`
- Anpassung der internen Stunden-, Minuten- und Wertbereiche
- kein großer weißer iOS-Zeitblock
- 16-Pixel-Schrift gegen automatischen iOS-Zoom
- kompakte gedimmte Darstellung bei ausgeschalteter Ruhezeit

## Technische Reihenfolge

1. isolierter Klon
2. Frontend- und Migrationstest
3. vollständiger lokaler Supabase-Reset
4. Tests, statische Prüfung und Build
5. Migration ausschließlich in Supabase DEV
6. ein gemeinsamer Commit
7. Synchronisierung beider DEV-Remotes

## Abschlusskennung

`V4_PUSH_NEWTASKS_QUIETTIME_R1_OK`

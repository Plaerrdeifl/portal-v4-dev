# Plärrdeifl Portal V4 – Web-Push-Dialog UI FIX1

## Ausgangsstand

- Commit: `bcf643a65aad93367d8c049dbb1aec8b8347cca1`
- Branch: `v4-supabase-dev`
- Supabase DEV und PROD werden nicht verändert.

## Korrekturen

- Push-Dialog besitzt einen echten internen Scrollbereich.
- Kopfzeile bleibt fest sichtbar.
- iOS-Safe-Areas und PWA-Viewport werden berücksichtigt.
- Scrollen verwendet `-webkit-overflow-scrolling: touch`.
- Statuswerte stehen kompakt nebeneinander.
- Standard-Checkboxen werden durch kleine Portal-Schalter ersetzt.
- Aktionsbuttons werden kompakter.
- Deaktivieren erscheint zurückhaltend statt als großer roter Block.
- Überschriften, Abstände und Flächen entsprechen dem Portalstil.
- Speichern bleibt am unteren Rand erreichbar.
- Service-Worker-Cache wird erneuert.

## Nicht verändert

- Push-Abonnements
- Supabase-Migrationen
- VAPID-Schlüssel
- Edge Function
- Versandlogik
- Benachrichtigungseinstellungen und deren Daten

## Abschlusskennung

`V4_WEB_PUSH_DIALOG_UI_FIX1_OK`

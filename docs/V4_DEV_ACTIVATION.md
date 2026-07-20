# Supabase DEV und Google-Login aktivieren

## Vom Core-Operator erledigt

- lokale Datenbank vollständig zurücksetzen und prüfen
- Core-API end-to-end mit temporären Testbenutzern prüfen
- Migrationen in das verknüpfte Supabase-DEV-Projekt übertragen
- öffentliche DEV-Runtime-Konfiguration lokal erzeugen
- einmaligen Initialisierungscode für DEV erzeugen
- Änderungen committen und auf `v4-supabase-dev` pushen

## Einmalige Google-Konfiguration

Für den echten Google-Login werden ein Google OAuth Web Client und dessen Secret benötigt. Diese Werte gehören weder in Git noch in eine Chatnachricht.

Im Google-Cloud-Projekt muss als autorisierte Redirect-URI die Callback-URL des Supabase-DEV-Projekts eingetragen werden:

```text
https://<DEV-PROJECT-REF>.supabase.co/auth/v1/callback
```

Im Supabase-DEV-Dashboard werden anschließend unter Authentication → Providers → Google die Client-ID und das Client-Secret hinterlegt und Google aktiviert.

Unter Authentication → URL Configuration werden mindestens erlaubt:

```text
http://127.0.0.1:3000
http://localhost:3000
https://plaerrdeifl.github.io/portal/
```

## Erster echter Login

1. Lokalen Frontendserver starten: `npm.cmd run dev`.
2. `http://127.0.0.1:3000` öffnen.
3. Mit Google anmelden.
4. Initialisierungscode aus der vom Operator genannten Datei eingeben.
5. Ersten Administrator anlegen.
6. Danach weitere Benutzer anmelden lassen und im Adminbereich freischalten.

## GitHub Pages

Für einen späteren Pages-Deploy müssen im Repository beziehungsweise GitHub-Environment folgende Variablen gesetzt werden:

- `PORTAL_SUPABASE_URL`
- `PORTAL_SUPABASE_PUBLISHABLE_KEY`

Der Publishable Key ist ein Browser-Schlüssel, kein Service-Role-Schlüssel. Der Service-Role-Schlüssel darf niemals als GitHub-Pages-Variable verwendet werden.

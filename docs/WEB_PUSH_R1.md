# Plärrdeifl Portal V4 – Web Push R1 FIX2

## Ausgangsstand

- Commit: `f887879d2b5a4dd1d18db3e8f08f559992972487`
- Branch: `v4-supabase-dev`
- Supabase DEV: `tpieykhhawszlzsoflnl`
- PROD bleibt ausgeschlossen

## Enthalten

- Push-Aktivierung im Benutzermenü
- Android, Desktop und iPhone/iPad als installierte Home-Screen-Web-App
- bewusste Berechtigungsabfrage erst nach Benutzertipp
- Geräteabonnements mit automatischer Deaktivierung abgelaufener Endpunkte
- persönliche Auswahl für Updates, Status, Übertragungen und Wartefristen
- optionale Ruhezeit
- App-Badge mit ungelesenen Meldungen
- Testmeldung
- Service-Worker-Empfang und direkter Aufgabenlink
- Supabase Edge Function mit VAPID
- verschlüsselter interner Dispatch-Schlüssel in Supabase Vault
- asynchroner Versand nach Datenbankeintrag
- Wartefristprüfung alle 15 Minuten über Supabase Cron
- private Tabellen und service-role-exklusive Versand-RPCs

## Sicherheitsgrenzen

- Der private VAPID-Schlüssel wird beim Operatorlauf erzeugt.
- Er wird ausschließlich als Supabase-Edge-Function-Secret gespeichert.
- Im Repository landet nur der öffentliche VAPID-Schlüssel.
- Der interne Dispatch-Schlüssel wird direkt in Supabase Vault erzeugt.
- Browser und angemeldete Benutzer erhalten keinen Service-Role-Schlüssel.
- Die Edge Function verwendet den Secret-Key ausschließlich serverseitig als `apikey` und nicht als Browser- oder JWT-Wert.
- PROD wird nicht angesprochen.

## Abschlusskennung

`V4_WEB_PUSH_R1_FIX2_OK`
## FIX1

FIX1 korrigiert einen ausschließlich testseitigen Fehlalarm:

- Die alte Negativ-RegExp lief vom Grant für `pd_push_claim_batch`
  bis zu einem späteren Grant für `public.pd_api`.
- Die drei internen Versand-RPCs werden jetzt jeweils exakt gegen ihre
  vollständige Funktionssignatur geprüft.
- Ein Grant an `authenticated` für eine andere Funktion kann keinen
  Fehlalarm mehr auslösen.
- Ein eigener Laufzeittest bildet genau diesen Fall nach.

Die produktive Push-, Datenbank- und Edge-Function-Logik wurde nicht verändert.
## FIX2

FIX2 korrigiert die Scope-Prüfung für bereits erfüllte Dateiverträge:

- `manifest.webmanifest` besitzt am Ausgangscommit bereits `id: "./"`.
- Die Datei wird nur noch dann zur erwarteten Git-Änderungsliste
  hinzugefügt, wenn ihr serialisierter Inhalt wirklich verändert wurde.
- Ein bereits korrekter Manifestvertrag erzeugt dadurch keinen
  `verifyScope`-Fehler mehr.
- Ein eigener Laufzeittest prüft sowohl den No-op-Fall als auch eine
  tatsächlich notwendige Manifeständerung.

Die produktive Push-, Datenbank- und Edge-Function-Logik wurde nicht verändert.

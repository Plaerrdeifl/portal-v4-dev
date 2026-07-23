# Aufgabenverlauf R1 – FIX7 alle Cacheverträge

## Fehlerbild

Nach FIX6 bestand weiterhin mindestens ein Testfehler in
`tests/pwa_bottom_nav_final_r1.test.mjs`. Der Test erwartete noch:

`pd-portal-v4-task-history-r1-30min-20260723`

Der Service Worker enthielt bereits eine neuere Version.

## Ursache

Mehrere bestehende Regressionstests prüfen dieselbe Service-Worker-Version.
FIX6 aktualisierte nur einen einzelnen Aufgabenverlauf-Test.

## Korrektur

FIX7 sucht vor jeder Projektänderung rekursiv alle `*.test.mjs`-Dateien, die
die alte Cache-Version enthalten.

Alle gefundenen Dateien werden:

1. in den erlaubten Paketumfang aufgenommen,
2. vor der Änderung gesichert,
3. gemeinsam auf `pd-portal-v4-task-history-r1-fix7-showtoast-cache-20260723` aktualisiert,
4. nach der Änderung erneut auf veraltete Referenzen geprüft,
5. zusammen getestet und committed.

Zusätzlich prüft ein neuer Regressionstest, dass `showToast` importiert ist
und kein anderer Test mehr den alten Cachevertrag enthält.

## Abgrenzung

- keine Datenbankmigration
- Supabase DEV unverändert
- Supabase PROD unberührt
- Aufgabenverlauf und 30-Minuten-Regel unverändert

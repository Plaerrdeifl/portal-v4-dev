# Plärrdeifl Portal V4 – Aufgabenworkflow R2 Core FIX3

## Ziel

Paket 1 des neuen Aufgaben- und Benachrichtigungssystems:

- Status **Wartet**
- Pflichtfeld „Worauf wird gewartet?“
- optionale Wartefrist mit Datum und Uhrzeit
- Zeitpunkt und Benutzer jedes Statuswechsels
- Wartefrist-Überschreitung in Liste und Detail
- nachvollziehbare Aufgabenübertragung
- Anfrage, Annahme, Ablehnung, Zurückziehen und Ablauf
- dokumentierte Sofortübertragung für Leitung/Vorstand/Administration
- vollständige Einträge im Aufgabenverlauf und Audit
- Neu-/Gelesen-Markierung je Benutzer und Aufgabe
- Benachrichtigungs-Warteschlange als Grundlage für Web Push
- direkte Route `#/tasks?taskId=...` für spätere Push-Klicks

## Noch nicht Bestandteil dieses Pakets

Der tatsächliche Web-Push-Versand mit VAPID, Geräteabonnements,
Benutzereinstellungen und Supabase Edge Function folgt als separates
**Web Push R1**-Paket. Der Aufgabenworkflow funktioniert unabhängig davon.

## Ausgangsstand

- Repository: `C:\Projekte\PDAPP\frontend\portal-v4-dev`
- Branch: `v4-supabase-dev`
- Commit: `301f4d7395f27d16bdac8cae0a393b92855e7deb`
- Supabase DEV: `tpieykhhawszlzsoflnl`
- PROD bleibt ausgeschlossen

## Abschlusskennung

`V4_TASK_WORKFLOW_R2_CORE_FIX3_OK`
## FIX1-Härtung

Der Operator führt vor dem isolierten Klon einen eigenen Laufzeittest für
den dynamischen Funktionstausch aus. Zusätzlich wurden die Zustandswechsel
beim Archivieren wartender Aufgaben und die Empfängerlogik bei zuvor
unzugewiesenen Aufgaben abgesichert.
## FIX2

FIX2 korrigiert ausschließlich die Regressionstest-Verträge für die
bereits vorhandene Transferlogik:

- Anfrage und Sofortübertragung werden über einen ternären Operationswert geprüft.
- Annahme wird weiterhin als direkter `ACCEPT`-Wert geprüft.
- Ablehnung und Zurückziehen werden an den tatsächlichen
  `openTransferResponse`-Aufrufen geprüft.

Die produktive Workflow-Implementierung aus FIX1 wurde nicht verändert.
## FIX3

FIX3 aktualisiert veraltete Testverträge aus der früheren
Workflow-Härtung:

- Tests mit `doesNotMatch(... WAITING|Warten ...)` werden dynamisch gefunden.
- Nur der Ausschluss im Aufgabenmodul wird auf den neuen positiven
  Vertrag `WAITING` / `Wartet` umgestellt.
- Der Vertrag, dass `common.js` keinen eigenen hart codierten
  WAITING-Status erhält, bleibt unverändert.
- Vor jedem Testlauf wird geprüft, dass kein alter WAITING-Ausschluss
  im Testbestand zurückgeblieben ist.

Die produktive Workflow-Implementierung aus FIX1/FIX2 wurde nicht verändert.

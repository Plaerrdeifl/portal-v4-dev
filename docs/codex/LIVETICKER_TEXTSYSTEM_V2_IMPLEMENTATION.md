# Liveticker Textsystem V2 – Implementierung

## Datenmodell

Das V2-Modell ist additiv. `app_modules.liveticker_output_types` beschreibt die
stabilen Ausgabetypen und deren erlaubte beziehungsweise erforderliche
Platzhalter. `app_modules.liveticker_output_variants` enthält die unabhängig
verwalteten Varianten mit UUID, sichtbarem Namen, Template, Sortierung,
Aktiv-/Standardstatus, Revision und Audit-Metadaten.

Die bestehende Tabelle `app_modules.liveticker_output_templates` bleibt während
der Übergangsphase erhalten. Sie wird weiterhin ausgeliefert, damit historische
Aktionen mit `style = classic|emotional|short` unverändert gerendert werden
können. Neue Aktionen speichern ausschließlich `outputVariantId`.

Direkte Tabellenrechte sind entzogen, RLS ist aktiviert. Lesen und Schreiben
erfolgen über capability-geschützte Funktionen. Schreibvorgänge benötigen bei
bestehenden Varianten die erwartete Revision. Eine referenzierte, letzte oder
aktuelle Standardvariante kann nicht gelöscht werden.

## Stabile Ausgabetypen

| Key | Zweck |
| --- | --- |
| `goal_mighty` | Tor Mighty Dogs |
| `goal_opponent` | Tor Gegner |
| `penalty` | Gemeinsame Strafausgabe für ein oder beide Teams |
| `penalty_shot` | Straf-Penalty |
| `shootout_attempt` | Einzelner Versuch im Penaltyschießen |
| `period_summary` | Kumulative Drittel-/Overtime-Zusammenfassung |
| `final_summary` | Endstand |
| `goal_summary_line` | Wiederverwendete Torzeile |
| `penalty_summary_line` | Wiederverwendete Strafzeile |
| `penalty_shot_summary_line` | Straf-Penalty-Zeile im Endstand |
| `shootout_summary_line` | Versuchzeile im Penaltyschießen-Block |
| `shootout_summary` | Gesamter Penaltyschießen-Block |
| `no_goals` | Text für eine leere Torliste |
| `no_penalties` | Text für eine leere Strafliste |

Die Keys sind technische Verträge. Sichtbare Bezeichnungen und beliebig viele
Varianten werden im Portal verwaltet.

## Laufzeit und Übergang

- Der Spieltagsmodus baut seine Auswahl aus allen aktiven Varianten des
  jeweiligen Ausgabetyps auf. Änderungen werden regelmäßig nachgeladen.
- Eine manuelle Auswahl hat Vorrang vor den semantischen Vorschlägen `normal`,
  `major`, `both` und `hattrick`.
- Inaktive Varianten werden nicht mehr angeboten, bleiben über ihre UUID aber
  für gespeicherte Aktionen renderbar.
- Die alte Strafenteilung wird nur im historischen `style`-Lesepfad erhalten.
  Neue Strafaktionen verwenden immer genau eine Variante des Typs `penalty` und
  übergeben die betroffenen Teams und Strafzeilen als Daten.
- POST-/STORY-Erzeugung, WhatsApp Summary Resend und Worker-Steuerung sind nicht
  Teil dieses Umbaus und werden nicht verändert.

## Spätere Integration

Vor einer Integration in `main` ist der Feature-Branch durch einen Menschen auf
den dann aktuellen `main` zu rebasen oder kontrolliert mit ihm zusammenzuführen.
Dabei sind insbesondere neu hinzugekommene Dispatcher-Migrationen in
chronologischer Reihenfolge zu prüfen. Anschließend müssen die statischen Checks,
die fokussierten Liveticker-Tests und die vollständige Core-Suite erneut laufen.

Die Migration wird erst im freigegebenen Zielprozess angewendet. Die
Altmodell-Bereinigung ist ausdrücklich nicht Bestandteil dieser Migration und
benötigt später eine eigene, explizit freigegebene Migration, nachdem keine
historischen `style`-Aktionen mehr unterstützt werden müssen.

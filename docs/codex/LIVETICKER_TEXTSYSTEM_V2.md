# Codex Task – Liveticker Textsystem V2

## Branch / Ziel
Arbeite ausschließlich auf dem bereits vorbereiteten Branch:

`feature/liveticker-textsystem-v2`

Repository:
`Plaerrdeifl/portal-v4-dev`

Der Branch wurde vom aktuellen DEV-`main` erstellt.

## Harte Grenzen

- PROD ist vollständig tabu.
- Kein Merge nach `main`.
- Kein Deployment.
- Keine Migration auf die gemeinsame DEV-Supabase `tpieykhhawszlzsoflnl` anwenden.
- Keine Änderungen am laufenden WPP-/WhatsApp-Betrieb auf `acer01`.
- Keine Änderungen an PROD-Worker, PROD-Repository oder PROD-Supabase.
- Datenbankmigrationen ausschließlich als versionierte Migrationsdateien vorbereiten.
- Lokale/isolierte Tests dürfen verwendet werden, wenn sie keine gemeinsame DEV-Umgebung verändern.
- Bestehende Liveticker-Funktion darf während der Migration nicht unnötig gebrochen werden.
- Bestehende historische Aktionen mit `classic`, `emotional`, `short` müssen während der Übergangsphase lesbar bleiben.
- Beachte vollständig `AGENTS.md`.

## Ausgangslage

Das heutige Textsystem basiert auf drei technischen Slots:

- `classic`
- `emotional`
- `short`

Eine Zeile in `app_modules.liveticker_output_templates` enthält gleichzeitig:

- `own_goal_template`
- `opponent_goal_template`
- `own_penalty_template`
- `opponent_penalty_template`

Zusätzlich existieren kontextspezifische Titel.

Dadurch ist z. B. derselbe technische Slot `short` gleichzeitig:
- Tor Mighty Dogs = Hattrick
- Tor Gegner = Hattrick
- Strafe Mighty Dogs = Spieldauer
- Strafe Gegner = Hattrick

Diese Kopplung soll vollständig ersetzt werden.

Aktuell werden außerdem mehrere sichtbare Texte direkt in `js/liveticker-engine-v4.js` erzeugt und sind nicht im Portal editierbar, darunter insbesondere:
- Straf-Penalty
- Penaltyschießen / einzelner Versuch
- Drittelzusammenfassung
- Endstand
- Torschützenzeilen
- Strafenzeilen
- "Keine Tore"
- "Keine Strafen"
- Teile der Penaltyschießen-Zusammenfassung

## Zielarchitektur

Jede Textvariante ist zukünftig ein eigener Datensatz und gehört genau zu einem Ausgabetyp.

Beispielhafte Ausgabetypen:

- `goal_mighty`
- `goal_opponent`
- `penalty`
- `penalty_shot`
- `shootout_attempt`
- `period_summary`
- `final_summary`

Zusätzlich wiederverwendbare Textbausteine, z. B.:
- `goal_summary_line`
- `penalty_summary_line`
- `shootout_summary_line`
- `no_goals`
- `no_penalties`

Die genauen stabilen technischen Keys darfst du sinnvoll benennen, aber sie müssen klar, konsistent und dokumentiert sein.

Eine Variante benötigt mindestens:
- stabile ID
- Ausgabetyp
- frei editierbaren sichtbaren Namen
- Template-Text
- Sortierung
- aktiv/inaktiv
- Standard ja/nein
- Revision / optimistic locking
- Audit-Metadaten analog zum bestehenden System

## Fachliche Regeln

### Tor Mighty Dogs
Unabhängige Varianten. Bestehende DEV-Texte sinnvoll übernehmen:
- Normal
- Emotional
- Hattrick

### Tor Gegner
Unabhängige Varianten. Bestehende DEV-Texte sinnvoll übernehmen:
- Normal
- Mit Torschütze
- Hattrick

### Strafen
Die Trennung `Strafe – Wir` / `Strafe – Gegner` soll verschwinden.

Es gibt fachlich nur noch einen Ausgabetyp `Strafe`.

Der Inhalt muss über Daten/Platzhalter bestimmen können, welches Team betroffen ist. Eine Strafaktion darf Strafen von Mighty Dogs, Gegner oder beiden Mannschaften enthalten.

Bestehende sinnvolle Varianten übernehmen:
- Normal
- Spieldauer
- Beide Teams

Die heutige Sonderlogik "wenn ownPenaltyTemplate === opponentPenaltyTemplate dann gemeinsamer Text, sonst zwei Blöcke" muss entfernt werden.

### Weitere Ausgaben
Mindestens folgende heute hart codierte Ausgaben müssen über Templates steuerbar werden:
- Straf-Penalty
- einzelner Penaltyschießen-Versuch
- Drittelende
- Endstand

Auch die wiederverwendeten Zusammenfassungszeilen sollen nicht als deutscher fertiger Text im Engine-Code verbleiben.

## Variantenverwaltung im Portal

Unter Liveticker soll ein klarer Bereich für Textausgaben entstehen.

Nicht mehr technisch präsentieren:
- "Option 1"
- "Technischer Key classic"
- "Version 3" als primäre Nutzerinformation

Stattdessen nach Ausgabetyp gruppieren, z. B.:
- Tor Mighty Dogs
- Tor Gegner
- Strafe
- Straf-Penalty
- Penaltyschießen
- Drittelende
- Endstand
- Textbausteine

Für Ausgabetypen mit Varianten muss die Oberfläche unterstützen:
- Variante hinzufügen
- Namen ändern
- Text bearbeiten
- aktivieren/deaktivieren
- als Standard festlegen
- sortieren
- löschen, sofern fachlich sicher
- Live-/Beispielvorschau
- verfügbare Platzhalter als anklickbare Chips
- Validierung vor Speicherung

Neu angelegte aktive Varianten müssen ohne Codeänderung automatisch im Spieltagsmodus erscheinen.

## Spieltagsmodus

Die bisher fest im HTML vorhandenen drei Radio-Buttons `classic/emotional/short` dürfen nicht die langfristige Quelle der Varianten sein.

Die Auswahl wird dynamisch aus den aktiven Varianten des jeweiligen Ausgabetyps aufgebaut.

Eine gespeicherte neue Aktion soll eine eindeutige Template-/Variantenreferenz speichern, nicht nur einen mehrdeutigen Style wie `short`.

Historische Aktionen mit dem alten `style`-Feld müssen kompatibel bleiben.

Sinnvolle automatische Vorauswahl darf vorbereitet werden, z. B.:
- normale Strafe -> Normal
- große Strafe -> Spieldauer
- Strafen beider Teams -> Beide Teams
- drittes Tor desselben Spielers -> Hattrick

Diese Vorschläge dürfen die manuelle Auswahl nie blockieren.

## Templates / Platzhalter

Baue ein kontextabhängiges Variablensystem. Platzhalter müssen je Ausgabetyp validiert werden.

Vorhandene sinnvolle Variablen weiterverwenden, soweit passend:
- minute
- scorer
- assists
- score
- home_score
- away_score
- mighty_score
- opponent_score
- opponent_name
- player_name
- jersey_number
- player
- penalty_duration
- penalty_reason
- team_name
- penalties

Erweitere für Zusammenfassungen sinnvoll, z. B.:
- period_label
- score_line
- own_goals
- opponent_goals
- own_penalties
- opponent_penalties
- shootout_summary
- shooter
- goalie
- result

Die Engine berechnet Daten; der sichtbare Wortlaut soll soweit fachlich sinnvoll aus Templates kommen.

## Datenmigration

Entwirf eine saubere additive Migration.

Wichtig:
- bestehende Tabelle zunächst nicht destruktiv entfernen
- bestehende Texte in das neue Modell migrieren
- keine PROD-spezifischen Werte erfinden
- keine bestehende Historie zerstören
- Rollout muss in einer Übergangsphase beide Modelle lesen können
- destruktive Bereinigung des Altmodells erst als späterer, expliziter Schritt vorbereiten oder dokumentieren, nicht eigenmächtig durchführen

## Relevante aktuelle Dateien

Mindestens prüfen:
- `js/liveticker-output-templates.js`
- `js/liveticker-engine-v4.js`
- `js/modules/liveticker-admin.js`
- `js/liveticker-game-storage.js`
- `liveticker/index.html`
- bestehende Liveticker-Migrationsdateien unter `supabase/migrations/`
- relevante Tests unter `tests/`

Nicht blind nur diese Dateien ändern; zuerst die tatsächliche gesamte Verwendung der heutigen Template-/Style-Struktur suchen.

## Tests / Akzeptanzkriterien

Ergänze zielgerichtete Regressionstests.

Mindestens nachweisen:

1. Tor Mighty Dogs und Tor Gegner besitzen unabhängige Varianten.
2. Strafen verwenden einen gemeinsamen Ausgabetyp unabhängig vom Team.
3. Eine Strafaktion mit beiden Teams erzeugt eine deterministische gemeinsame Ausgabe.
4. Portal kann zusätzliche Variante anlegen.
5. Variante kann umbenannt, bearbeitet, deaktiviert, sortiert und als Standard gesetzt werden.
6. Neu aktive Variante erscheint dynamisch im Spieltagsmodus.
7. Neue Aktion speichert eindeutige Variantenreferenz.
8. Alte Aktionen mit `classic/emotional/short` funktionieren weiterhin.
9. Straf-Penalty kommt aus Template.
10. Penaltyschießen-Versuch kommt aus Template.
11. Dritteltext kommt aus Template und behält kumulative Torlisten bei:
    - P1 = Tore P1
    - P2 = Tore P1 + P2
    - P3/final = kumulativ
12. Endstand kommt aus Template.
13. POST/STORY-Grafiklogik wird nicht verändert.
14. WhatsApp Summary Resend verwendet weiterhin aktuellen Text und bestehenden erfolgreichen POST-Flyer.
15. Kein automatischer STORY-Versand wird eingeführt.
16. Keine WPP-Ownership-/Worker-Logik wird verändert.

Führe die relevanten vorhandenen Tests sowie neue fokussierte Tests aus. Falls die globale Core-Suite wegen bereits bestehender, unabhängiger Altfehler rot ist, dokumentiere exakt:
- welche neuen/fokussierten Tests grün sind
- welche bestehenden Tests weiterhin rot sind
- warum diese nicht durch diese Änderung verursacht wurden

## Ergebnis / Übergabe

Am Ende:
- Änderungen ausschließlich im Feature-Branch
- keine Merge-Aktion
- keine DEV-/PROD-DB-Mutation
- kein Deployment
- kurze technische Zusammenfassung
- Liste der geänderten Dateien
- neue Migration(en) benennen
- Testergebnisse nennen
- bekannte Risiken / offene Punkte nennen
- klar beschreiben, wie der Branch später auf den dann aktuellen `main` rebased/integriert werden soll

Ziel ist kein weiteres Patchwork am bestehenden Vier-Felder-Modell, sondern ein dauerhaft erweiterbares Textsystem, bei dem neue Varianten später vollständig über das Portal angelegt werden können.

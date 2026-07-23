# Fachentscheidung: Chronologischer Aufgabenverlauf R1

## Status

Fachlich freigegeben am 23. Juli 2026.

## Verbindliches Verhalten

Die Aufgabenbeschreibung bildet den aktuellen Auftrag ab und bleibt für
berechtigte Personen bearbeitbar. Änderungen an wesentlichen Aufgabendaten
werden zusätzlich als Systemereignisse in einem chronologischen Verlauf
sichtbar.

Fortschritte, Hinweise und Ergänzungen werden nicht mehr durch Überschreiben
einer gemeinsamen Notiz gepflegt. Jeder Beitrag ist ein eigener Eintrag.

## Bearbeitung

Eigene manuelle Updates können nach dem Anlegen exakt 30 Minuten lang
korrigiert werden. Das Zeitfenster wird im Backend geprüft. Nach Ablauf
bleibt der Eintrag unverändert; eine Korrektur erfolgt als neues Update.

## Moderation

Zuständige Leitung, Vorstand oder Administration können einen Eintrag nur
mit Begründung ausblenden. Der Datensatz wird nicht gelöscht. Das Ausblenden
wird im Audit-Protokoll festgehalten.

## Datenschutz bei Altbeständen

Die bisherige persönliche Aufgabennotiz war benutzerbezogen. Bestehende
Notizen werden daher als private Alt-Einträge übernommen und ausschließlich
dem bisherigen Autor angezeigt. Dadurch entsteht bei der Umstellung keine
unbeabsichtigte Offenlegung.

## Technische Abgrenzung

- Neue Tabelle `app_modules.task_updates`
- Soft-Hide statt Löschung
- Audit für Anlegen, Bearbeiten und Ausblenden
- Rückwärtskompatibilität für eine kurzzeitig noch alte DEV-Oberfläche
- Keine Änderung an Supabase PROD
- Keine Änderung an der bestätigten iOS-Standalone-Geometrie
## Technische FIX1-Korrektur

Der Installationsoperator ergänzt die Migration in der chronologisch
korrekten Position des Core-Vertrags und ersetzt die durch den neuen
Verlauf überholte `ownNoteRevision`-Frontendprüfung.
## Technische FIX2-Korrektur

`app_modules.task_notes` besitzt keine eigenständige ID und keine
Zeitstempelspalten. Der Altimport verwendet deshalb ausschließlich die
vorhandenen Felder `task_id`, `user_id`, `content` und `revision`.

Der Importschlüssel wird deterministisch aus Aufgaben- und Benutzer-ID
gebildet. Für den Altbestand wird kein erfundener historischer Zeitpunkt
ausgegeben; die fehlende Zeitinformation wird in den Metadaten festgehalten.
## Technische FIX3-Korrektur

Die Scope-Prüfung des Installationsoperators verarbeitet den Paketumfang nun
ausschließlich repository-relativ und normalisiert Windows-Pfadtrenner sowie
die Groß-/Kleinschreibung für Vergleiche. Dadurch wird `css/app.css` nicht
mehr fälschlich als Änderung außerhalb des Pakets eingestuft.
## Technische FIX4-Korrektur

Der letzte Scope-Abbruch entstand, weil die allgemeine Capture-Funktion die
Ausgabe von `git status` mit `.trim()` veränderte. Das führende Statuszeichen
ging dadurch verloren und `css/app.css` wurde beim Parsen verstümmelt.

Die Scope-Prüfung nutzt nun eine eigene unveränderte Rohdatenerfassung und
das NUL-getrennte Porcelain-v1-Format. Ein integrierter Selbsttest prüft den
Parser vor jeder Projektänderung.

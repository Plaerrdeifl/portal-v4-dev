# Testmatrix R7.1 – Ergänzung Milestone 4

## Lokal automatisiert

- M4-Static-Contract: 80/80 bestanden
- M4-Namensrichtlinie: 9/9 bestanden
- Syntax Frontend und Apps Script: 54/54 bestanden

## AE-R7.1-01

Verbindlich sind NAME-01 bis NAME-20; zusätzlich NAME-21 für Tabellenformelinjektion. Die vollständige Matrix steht in `03_Matrizen/M4_Namepflicht_Validierungs_und_Migrationsmatrix.csv`.

## UI und PWA

Navigation, Aufgaben AUF-01 bis AUF-14, Teams/Datenschutz, Fanclub/Zahlungen/Finanzen, Administration, Installation/Update, Browser/Geräte, Mobilansichten und Barrierefreiheit sind in separaten CSV-Matrizen dokumentiert.

## Nicht lokal ersetzbare Tests

Produktive Google-Anmeldung, echte Sitzungen, Datenbankmigration, parallele Schreibvorgänge, reale Browser-/Geräteinstallation und Live-Deployment müssen durch den Operator ausgeführt werden. `AUSSTEHEND_OPERATOR` bedeutet ausdrücklich nicht bestanden.

## Fortgeltendes M5-Gate A-M3-01

Parallele Beitragsreaktivierung, Zahlungsbestätigung, wiederholte Request-IDs, Teilfehler, parallele Team-/Aufgabenänderungen, Revisionskonflikte sowie die vollständige Rechte-/Negativmatrix sind in isolierten Datenbankkopien nachzuweisen.

# Sicherheits- und Ausführungsrichtlinien (Workspace Rules)

Dieses Dokument definiert verbindliche Verhaltens- und Sicherheitsregeln für KI-Agenten in diesem Workspace.

---

## 1. Erlaubte Aktionen (Standard / Ohne gesonderte Rückfrage)
Folgende Operationen sind standardmäßig ohne gesonderte Rückfrage zulässig:

* **Ausschließlich folgende READ-ONLY Git-Befehle (Positivliste):**
  * `git status`
  * `git diff` (inkl. Flags wie `--stat`, `--cached` etc.)
  * `git log`
  * `git show`
  * `git rev-parse`
  * `git branch --show-current` *(Wichtig: `git branch` ist nicht pauschal erlaubt, sondern nur mit `--show-current`)*
  * `git remote -v`
  * `git tag --list`
* **Codeanalyse & Lesezugriffe:**
  * Durchsuchen, Lesen und Analysieren von Projektdateien, Verzeichnissen und Dokumentationen.
* **Tests, Builds & Validierungen (nur ohne schreibende Nebenwirkungen):**
  * Ausführen lokaler Test-Suites (z. B. `npm test`, `npm run check`, `npm run check:static`, `npm run check:frontend`), Build-Vorgänge (z. B. `npm run build`) und statische Code-Prüfungen/Linter.
  * **Bedingung:** Diese dürfen ohne Rückfrage nur ausgeführt werden, wenn anhand der vorhandenen Projektkonfiguration eindeutig feststeht, dass sie keine versionierten Projektdateien verändern.
  * Skripte mit `--fix`, Snapshot-Updates, Codegenerierung oder sonstigen schreibenden Nebenwirkungen benötigen vorher eine ausdrückliche Beauftragung.

---

## 2. Nur auf ausdrücklichen Auftrag (Explicit Request Only)
Folgende Aktionen dürfen **ausschließlich dann** ausgeführt werden, wenn der Nutzer sie in der aktuellen Aufgabenstellung explizit beauftragt hat:

* **Dateiänderungen & generierende/korrigierende Skripte:**
  * Erstellen, Modifizieren oder Löschen von Quellcode-, Asset- oder Konfigurationsdateien.
  * Ausführen von Skripten mit schreibenden Nebenwirkungen (z. B. Linter/Formatter mit `--fix`, Snapshot-Aktualisierungen, Codegeneratoren).
* **Staging & Commits:**
  * `git add`
  * `git commit`

---

## 3. Vorherige Bestätigung zwingend erforderlich (Confirmation Required)
Folgende Aktionen dürfen **niemals eigenständig** ohne vorherige Rückfrage und explizite Bestätigung durch den Nutzer ausgeführt werden:

* **Remote-Pushes & Synchronisation:**
  * `git push`
  * `git pull`
  * `git fetch` (mit anschließender Integration)
* **Branch- & Workspace-Management:**
  * `git switch`
  * `git checkout`
  * Branch-Erstellung oder Branch-Löschung (z. B. `git branch <name>`, `git branch -d/-D`, `git checkout -b <name>`)
  * `git merge`
  * `git rebase`
  * `git stash` (inkl. `stash apply`, `stash pop`, `stash drop` etc.)
  * `git restore`
* **⚠️ Besonderer Schutz für Befehle mit Datenverlust-Gefahr:**
  * `git restore`
  * `git checkout -- <datei>`
  * *Befehle, die lokale oder ungesicherte Änderungen verwerfen oder überschreiben können, müssen zwingend vorab mit konkreter Nennung der betroffenen Dateien bestätigt werden.*
* **Dependency-Änderungen:**
  * Installieren, Aktualisieren oder Entfernen von Abhängigkeiten (z. B. `npm install`, `npm update`, `npm uninstall`, Modifikationen an `package.json` oder `package-lock.json`).
* **Datenbank-Operationen & Migrationen:**
  * Schema-Migrationen, `supabase db push`, `supabase db reset` oder sonstige datenbankverändernde Befehle.
* **Deployments:**
  * Sämtliche Deployment- oder Release-Vorgänge.

---

## 4. Streng verboten ohne explizite Freigabe (Strictly Forbidden)
Folgende Aktionen sind strikt untersagt:

* **PROD-Aktionen:**
  * Jegliche Zugriffe, Befehle, Mutationen oder Deployments auf Produktionsumgebungen (PROD) oder Produktionsdatenbanken.
  * **Gültigkeitsbereich:** Eine PROD-Freigabe gilt **ausschließlich für die konkret benannte Aktion der aktuellen Aufgabe** und darf **keinesfalls** auf spätere Aktionen oder Folgeaufgaben übertragen werden.
* **Destruktive Git-Operationen:**
  * Force Pushes (`git push --force`, `git push -f`, `--force-with-lease`).
  * Harte Resets (`git reset --hard`).
  * Bereinigen unversionierter Dateien (`git clean`, `git clean -fd` etc.).

---

## 5. Geheimhaltung & Netzwerksicherheit
* **Secrets & Zugangsdaten:**
  * Secrets, API-Keys, Tokens, Passwörter, Inhalte von `.env`-Dateien und Zugangsdaten dürfen **niemals** im Chat ausgegeben, committet, in Log-Dateien kopiert oder anderweitig offengelegt werden.
* **Keine impliziten Netzwerk-/Remote-Aktionen:**
  * Keine Remote- oder Netzwerkaktionen (wie ausgehende API-Aufrufe, Remote-Fetches oder Uploads) nur aufgrund einer impliziten Annahme durchführen.

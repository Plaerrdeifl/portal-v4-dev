# Operator-Framework-Verträge V1

## Zweck und Geltungsbereich

Dieses Dokument ist der verbindliche technische Vertrag des lokalen Plaerrdeifl Portal Operators in Version `1.0.0`. Es beschreibt die implementierten Grenzen für Aufruf, Manifest, Checks, Prozesse, Berichte, Sicherheit, Repositoryprüfung und wiederholte Ausführung. Maßgeblich sind `scripts/operator/portal-operator.ps1`, das Manifest `scripts/operator/manifests/M000-R1.json`, die registrierten M000-R1-Checks sowie die Operator-Module und deren Abnahmetests.

Der Vertrag gilt ausschließlich für lokale Prüfungen. DEV- und PROD-Stufen sind weder freigegeben noch als Deployment implementiert. `LocalFreeze` prüft nur den Freeze-Vertrag; die Stufe erzeugt keinen Commit und führt kein Deployment aus.

## Versionen und Stufen

- Operatorversion: `1.0.0`
- Manifestschema: `1`
- Resultatschema: `1`
- Timeoutprofile: `short` = 15 Sekunden, `standard` = 60 Sekunden, `long` = 300 Sekunden

Manifest- und Resultatschema sind geschlossene Verträge; unbekannte Zusatzfelder werden abgewiesen.

| Stufe | Zustand | Vertrag |
| --- | --- | --- |
| `SelfTest` | unterstützt | Prüft die neun fest registrierten Prozess-Fixtures und ihre erwarteten Ergebnisse. |
| `Preflight` | unterstützt | Prüft Repositorypolicy, erforderliche Umgebung, lokale Isolation, Pfadumfang und Secret-Hinweise. |
| `LocalVerify` | unterstützt | Führt die fünf Preflight-Prüfungen, `npm test`, `npm run check:frontend`, `npm run check:static` und eine frische Fingerprinterfassung aus. |
| `LocalFreeze` | unterstützt | Verlangt eine gültige `ReferenceRunId`, prüft den Freeze-Vertrag, führt die gebundenen lokalen Prüfungen einschließlich Build aus und vergleicht den frischen Fingerprint mit dem vollständigen bestandenen `LocalVerify`-Referenzlauf. Erstellt keinen Commit. |
| `DevDeploy`, `DevVerify` | gesperrt | Enden ohne Manifestauswertung und ohne Deployment mit `blocked`/`20`. |
| `ProdPreflight`, `ProdDeploy`, `ProdVerify` | gesperrt | Enden ohne Manifestauswertung und ohne Deployment mit `blocked`/`20`. |

## Status-, Exitcode- und Prioritätsvertrag

| Status | Exitcode | Bedeutung |
| --- | ---: | --- |
| `passed` | `0` | Vollständig validierter Erfolg. |
| `failed` | `10` | Eine ausgeführte fachliche Prüfung ist fehlgeschlagen. |
| `blocked` | `20` | Eine Sicherheits-, Policy-, Referenz- oder Cleanup-Bedingung sperrt den Lauf. |
| `error` | `30` | Aufruf-, Manifest- oder sonstiger externer Integritätsfehler. |
| `error` | `40` | Interner Operator- oder Vertragsfehler. |

Bei mehreren Ergebnissen gilt absteigend: Cleanup-Fehler, `error`/`40`, `error`/`30`, `blocked`/`20`, `failed`/`10`, `passed`/`0`. Bei gleicher Priorität bleibt der zuerst festgestellte Grund erhalten. Ein Cleanup-Fehler verhindert immer `passed` und wird als `blocked`/`20` klassifiziert.

Öffentliches `stderr` verwendet ausschließlich feste Meldungen. Interne Pfade, ungeprüfte Eingaben, Manifestinhalte, Exceptiontexte und Stackinformationen dürfen dort nicht erscheinen.

## Manifestimport und Bindung

Manifestdaten sind ausschließlich Daten und niemals ausführbarer Code. Der Import ist auf 1.048.576 Byte begrenzt, dekodiert strikt als UTF-8, akzeptiert nur striktes JSON, verwirft Duplicate Properties und begrenzt die Rekursionstiefe auf 32. Manifest- und eingebettete Stufen-/Checkobjekte sind geschlossen; zusätzliche Felder sind verboten. Insbesondere dürfen Manifestdaten keine Befehle, Scriptblöcke, Argumentlisten, URLs, SQL, Zugangsdaten, Secrets, frei gewählte Timeouts, Handler oder Erfolgsmarker bereitstellen.

Der SHA-256-Hash wird aus den ursprünglichen Manifestbytes vor dem Parsing gebildet. Der Import bindet Manifestobjekt, Snapshot, Originalpfad, Hash und Schema-/Operatorversion. Vor der Orchestrierung, vor jedem Check, nach der Ausführung und vor der finalen Ausgabe wird diese Bindung erneut geprüft. Dateiinhalt, Snapshot, Objekt, Hash und Version müssen zusammenpassen. Eine äußere Mutation ergibt `error`/`30`; ein beschädigter interner Bindungsvertrag ergibt `error`/`40`. Nach einer früheren Ablehnung werden keine Repository-, npm- oder Prozessaktionen gestartet.

## Checkregistry und sequenzielle Orchestrierung

Die codeeigene Checkregistry enthält exakt 20 eindeutige Paare aus `checkId` und `targetId`: neun SelfTest-Checks, fünf gemeinsame Repository-/Umgebungs-/Sicherheitschecks, vier lokale npm-Checks sowie `fingerprint.capture` und `fingerprint.compare`. Stufe, Timeoutprofil, Pflichtstatus, Semantik und Handlerreferenz werden gegen die unveränderliche Matrix geprüft. Fremde oder lediglich textgleiche Handler werden abgewiesen.

Alle Manifestchecks sind erforderlich und werden strikt in Manifestreihenfolge ausgeführt. Es gibt keine parallele Handlerausführung. Bei einer Ablehnung oder einem nicht bestandenen Pflichtcheck endet die Sequenz; nachfolgende Handler werden nicht aufgerufen. Ein insgesamt bestandener Lauf akzeptiert weder `failed`, `blocked`, `error` noch `skipped` in seiner Checkliste.

## Prozessregistry, Start und Laufzeit

Die unveränderliche Prozessregistry enthält exakt 13 Targets:

- npm: `npm.test`, `npm.check-frontend`, `npm.check-static`, `npm.build`
- SelfTest-Fixtures: `fixture.exit-success`, `fixture.stderr-success`, `fixture.exit-failure`, `fixture.health-ready`, `fixture.health-failure`, `fixture.timeout`, `fixture.child-tree`, `fixture.secret-output`, `fixture.large-output`

Manifestdaten wählen nur ein registriertes Target und ein erlaubtes Timeoutprofil. Pfade, Befehle, Argumente, Umgebungen, Health-Logik und Handler stammen ausschließlich aus vertrauenswürdigem Code. Eine dynamische Befehlsausführung aus Manifestdaten ist ausgeschlossen. Npm wird über das zur lokalen Node-Installation gehörende `npm-cli.js` und einen fest gebundenen `package.json`-Scriptnamen gestartet; Fixtures werden über Windows PowerShell 5.1 und die repositoryeigene Fixturedatei aufgerufen.

Jede Registrierung besitzt das geschlossene `environmentProfile` `inherit` oder `local-build`. Ausschließlich `npm.build` verwendet `local-build` und wird für `LocalVerify`/`LocalFreeze` innerhalb des kontrollierten Workers immer mit `PORTAL_ENVIRONMENT=LOCAL` gestartet. Ein ambienter DEV-/PROD-Wert darf den lokalen Operatorbuild nicht beeinflussen; der Aufrufer muss `PORTAL_ENVIRONMENT` nicht vorbereiten. Unmittelbar nach dem Startversuch wird der vorherige Workerwert auch bei einem Startfehler wiederhergestellt. Die übrigen zwölf Targets verwenden `inherit` und behalten ihr bisheriges Umgebungsverhalten.

Der Manager erzeugt ein eindeutiges lokales Start-Gate, startet den festen Worker, erstellt ein Windows Job Object mit Kill-on-close, ordnet den Worker zu und öffnet erst danach das Gate. Der Worker validiert das Target erneut. `stdout` und `stderr` werden gleichzeitig, aber getrennt abgeführt und gespeichert. Starttimeout und Laufzeittimeout sind codegebunden. Der einzige Health-Typ ist `stdout-token`; ein Token zählt nur, solange das Target noch dem Job angehört.

Worker, Target und Nachkommen bilden den eigenen Prozessbaum. Timeout- und Health-Fehler lösen eine unmittelbare Bereinigung dieses Job Objects aus. Beendet oder gezählt werden ausschließlich PIDs aus dem eindeutigen Job beziehungsweise, bei fehlgeschlagener Jobzuordnung, der konkret gestartete Worker über dessen Handle. Prozessnamensuche, WMI-/CIM-Baumsuche, `taskkill` und breite Terminierung sind ausgeschlossen. Fremde oder bereits vorhandene PowerShell-, Node- und npm-Prozesse bleiben unberührt.

## Cleanup- und Prozessberichtvertrag

Jeder Cleanupzustand enthält `status`, `ownedProcessCount`, `terminatedProcessCount` und `remainingOwnedProcessCount`. Alle Zähler sind nichtnegative Ganzzahlen; terminierte und verbleibende Prozesse dürfen weder einzeln noch zusammen die Zahl eigener Prozesse überschreiten. `passed` verlangt null verbleibende eigene Prozesse, `failed` mindestens einen verbleibenden eigenen Prozess und `skipped` ausschließlich Nullzähler.

Ein Prozessversuch schreibt getrennte `stdout.log`, `stderr.log` und `process.json`. Gestartete bestandene oder fehlgeschlagene Targets benötigen verschiedene positive Worker-/Target-PIDs, mindestens zwei beobachtete eigene Prozesse, bestandenen Cleanup und null verbleibende Prozesse. Vor einem weiteren Versuch wird eine lückenlose Sequenz ab `0001` mit exakt diesen drei dauerhaften Artefakten geprüft. Fremde, fehlende, zusätzliche oder transiente Einträge sperren die Fortsetzung.

Der Laufcleanup vereinigt Inline-Git-Prozesse und Prozessmanager-Zähler. `Complete-OperatorProcessRun` wird pro Stufe genau einmal ausgeführt. Ein Cleanupfehler oder ein verbleibender eigener Prozess verhindert `passed`, auch wenn alle fachlichen Checks bestanden sind.

## Berichte, atomare Writer und Erfolgsmarker

Zum Vertragsumfang gehören insbesondere:

- `invocation.json` mit registrierter Stufe oder `INVALID`, redigiertem `manifestPath` und kanonischem UTC-Zeitpunkt,
- `manifest.snapshot.json` und `manifest.sha256` für ein importiertes oder fest klassifiziert abgelehntes Manifest,
- `result.json` nach Resultatschema 1 und zusätzlicher semantischer Prüfung,
- `cleanup.json` mit geschlossenem Cleanupvertrag,
- Repository-, Umgebungs-, Fingerprint- und Prozessreports sowie begrenzte Run-/Prozesslogs.

Alle Writer validieren geschlossene Typ- und Semantikverträge vor der Veröffentlichung und schreiben UTF-8 ohne BOM atomar über eine temporäre Datei im selben Verzeichnis. Ungültige Daten dürfen keinen vorhandenen gültigen Report ersetzen. Dictionary-Cleanupobjekte werden für die Resultatvertragsprüfung zu einem Objekt normalisiert; die Typ- und Zählerregeln bleiben dabei unverändert.

Reservierte Erfolgsmarker werden ausschließlich zentral durch den finalen Reporter ausgegeben, nachdem ein semantisch validiertes `result.json` atomar geschrieben wurde und `passed`/`0` vorliegt:

- `V4_M000_R1_SELFTEST_OK`
- `V4_M000_R1_PREFLIGHT_OK`
- `V4_M000_R1_LOCAL_OK`
- `V4_M000_R1_LOCAL_FROZEN`

Manifest, Check, Prozessausgabe und Log dürfen keinen Erfolgsmarker erzeugen. Nicht bestandene oder nicht validierte Resultate erzeugen keinen Marker.

## Logredaktion und Secret-Schutz

Pro Prozess werden `stdout` und `stderr` unabhängig auf 5.242.880 Zeichen begrenzt; überschüssige Ausgabe wird weiter konsumiert, aber nicht gespeichert. Nach Schutz und Normalisierung wird erneut begrenzt, sodass der vollständige Marker `[TRUNCATED:stream-limit]` innerhalb des Limits bleibt. Run-Aggregate wenden dieselben Grenzen an und prüfen auch später gelesene, nicht mehr aufgenommene Logs.

Die Schutzfolge entfernt ANSI- und verbotene Steuerzeichen, normalisiert Zeilenenden, redigiert unter anderem private Schlüssel, JWT-artige Werte, GitHub-/Supabase-Token, Passwörter, Verbindungsdaten, URL-Userinfo, verbotene Projekt-Refs und reservierte Erfolgsmarker und begrenzt Einzelzeilen. Anschließend werden Secret- und Markerprüfungen wiederholt. Reports enthalten keine Trefferwerte, vollständigen Quellzeilen oder Secrets.

Der Secret-Hinweis-Scanner liest nur reguläre, nicht als Reparse Point markierte Textdateien innerhalb des Repositorys und höchstens 1.048.576 Byte plus ein Erkennungsbyte. Findings enthalten nur Regel-ID, relativen Pfad, sichere Zeilennummer, Schweregrad und feste Beschreibung. Dokumentierte Platzhalter und explizite Beispiel-/Dummywerte werden ausgenommen.

## Repositorypfade und lokaler Isolationsvertrag

Die allgemeine deny-by-default-Pfadpolicy erlaubt nur `scripts/operator/**`, `docs/project/**` und `docs/modules/M000/R1/**`; alle anderen Pfade, insbesondere Produktcode, `tests/**`, `package.json`, `package-lock.json`, `.gitignore`, `.git/**`, `supabase/**` und `.github/**`, sind gesperrt. Für M000-R1-D wird dieser Rahmen zusätzlich auf die exakt 19 im Checkmodul registrierten Lieferpfade eingeschränkt.

Die kanonische Pfadauflösung verwirft leere und absolute Pfade, UNC-, Device-, Drive- und ADS-Formen, Steuerzeichen, `.`-/`..`-Traversal, `.git`, Root-Ausbruch, Reparse-Routen, Segmente mit abschließenden Leerzeichen oder Punkten, reservierte Windows-Gerätenamen, 8.3-Kurznamen, abweichende Groß-/Kleinschreibung bestehender Einträge und Normalisierungsaliasse. Repositoryroot und vorhandene Elternsegmente müssen lokale, existierende, reparsefreie Verzeichnisse sein. Containment wird nicht durch einen bloßen Stringpräfix entschieden.

Lokale Läufe dürfen keine DEV-/PROD-Verbindungsdaten verwenden. Verboten sind die gebundenen DEV-/PROD-Projekt-Refs, zugehörige Supabase-/Datenbankhosts, nichtlokale PostgreSQL- und Supabase-URLs, klassische Verbindungsstrings mit nichtlokalem Host, verbotene `--project-ref`-Argumente, passende Umgebungswerte und bekannte Linkdateien. Nur `localhost`, `127.0.0.1`, `::1` und `[::1]` gelten als lokal. Der lokale Lauf führt keine WordPress-, Docker- oder Supabase-Aktion aus.

## Repositorypolicy und Working-Tree-Fingerprint

Die vertrauenswürdige Policy bindet:

- den tatsächlich aus dem Entry-Point abgeleiteten Repositoryroot,
- Branch `infra/m000-r1`,
- keinen Upstream,
- exakt `origin` = `https://github.com/Plaerrdeifl/portal.git` und `v4dev` = `https://github.com/Plaerrdeifl/portal-v4-dev.git`,
- einen vollständigen erwarteten HEAD, sofern die Stufe beziehungsweise Referenzprüfung ihn bindet.

Die sechs erlaubten Git-Abfragen sind fest, lesend und umfassen Root, HEAD, Branch, Upstream, Remote-URLs und Porcelain-Status. Netzwerk- und Schreiboperationen sind nicht registriert.

Der Working-Tree-Fingerprint verwendet Schema 1 und `SHA256`. Seine kanonischen UTF-8-Daten enthalten HEAD, Branch, Upstream, ordinal sortierte Remotes und ordinal sortierte Statuspfade einschließlich Status, Originalpfad und typabhängiger Inhaltsrepräsentation. Dynamische Felder werden längencodiert und Base64-kodiert. Absolute Pfade, Zeitstempel, Diffs und Klartextinhalte gehen nicht in den Hash ein. Ungültige Fingerprintobjekte stimmen niemals überein.

Nach lokal verändernden Prüfschritten wird der Repositoryzustand frisch erfasst. `LocalVerify` vergleicht diesen frischen Fingerprint mit seinem Startzustand und veröffentlicht ihn erst bei Übereinstimmung. `LocalFreeze` vergleicht den frischen Zustand sowohl mit seinem Startzustand als auch mit dem Fingerprint des Referenzlaufs. Stale Context-Daten ersetzen keine frische Erfassung.

## `ReferenceRunId` und Freeze-Referenz

`ReferenceRunId` ist ausschließlich für `LocalFreeze` erlaubt und dort zwingend. Alle anderen Stufen sperren einen übergebenen Wert. Syntax, lokaler Runpfad und reparsefreie Struktur werden geprüft.

Die Referenz muss ein vollständiger `LocalVerify`-Lauf mit `passed`/`0` sein. Geprüft werden RunId, Stufe, Modul, Revision, Operatorversion, Manifest-Snapshot und -Hash, Invocation-Metadaten, Repositoryroot, Branch, HEAD, Remotes, Environmentreport, Resultatsemantik, exakte neun Checks in Reihenfolge, sichere Texte, der exakte Satz aus drei npm-Prozessversuchen, deren Reports und getrennte Logs, Rootlogs, Summary, Cleanupzähler und null verbleibende eigene Prozesse. Der Referenzfingerprint muss sowohl zum Referenzsnapshot als auch zum frisch erfassten aktuellen Zustand passen. Fehlende, zusätzliche, beschädigte oder abweichende Artefakte sperren den Freeze oder werden als Aufruffehler klassifiziert.

## Idempotenz und Wiederholung

Die Registrierung der exakt 20 Checks ist innerhalb derselben Modulinstanz idempotent; abweichende bestehende Registrierungen werden nicht überschrieben, sondern abgewiesen. Jeder Operatorlauf erhält eine neue RunId und ein eigenes lokales Runverzeichnis. Ein bereits initialisierter Lauf wird nicht zurückgesetzt, aktive Versuche werden durch den rungebundenen Mutex serialisiert, und bestehende Versuche werden vor Fortsetzung vollständig geprüft.

Wiederholte Aufrufe verändern keine getrackten Repositorydateien, erzeugen keinen Commit und senden keine Remoteoperation. Sie dürfen bei identischer Eingabe und unverändertem Zustand nur über dieselben geschlossenen Verträge fortfahren. Ein früher abgelehnter Aufruf startet keine spätere Repository-, npm- oder Prozessaktion; Cleanup und sichere Abschlussberichte bleiben dennoch verpflichtend.

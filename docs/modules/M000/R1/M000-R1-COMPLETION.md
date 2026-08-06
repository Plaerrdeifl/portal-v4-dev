# M000-R1 – Completion- und Freigabecheckliste

## 1. Modulidentität

- Modul: `P800–M000-R1`
- Bezeichnung: Stabiles Operator-Framework V1
- Operatorversion: `1.0.0`
- Manifestschema: `1`
- Resultatschema: `1`
- Completionstatus: **Vorbereitet – finale zweiphasige Abnahme ausstehend**

## 2. Scope

Die Checkliste gilt für die lokale Fertigstellungsprüfung von M000-R1 nach D1, D2, dem historischen D3-Dokumentationsauftrag, der vor Phase-B-Abschluss erforderlichen LOCAL-Build-Korrektur und der anschließenden exakten Path-Scope-Ausrichtung. Sie autorisiert keine weitere Produktcodeänderung, keine DEV-/PROD-Stufe, kein Deployment sowie keine Commit-, Push- oder sonstige Remoteoperation.

## 3. Aktueller finaler Abnahmekandidat

Der aktuelle finale Abnahmekandidat umfasst exakt neun Pfade:

- `docs/project/operator-framework-contracts-v1.md`
- `docs/modules/M000/R1/M000-R1-D.md`
- `docs/modules/M000/R1/M000-R1-COMPLETION.md`
- `scripts/operator/checks/M000.R1.Checks.psm1`
- `scripts/operator/Operator.ProcessWorker.ps1`
- `scripts/operator/modules/Operator.Process.psm1`
- `scripts/operator/tests/Operator.Process.Tests.ps1`
- `scripts/operator/tests/Operator.Registry.Tests.ps1`
- `scripts/operator/tests/Test.Helpers.ps1`

Außerhalb dieser neun Pfade ist keine Änderung und keine zusätzliche untracked Datei zulässig.

## 4. Commitnachweise

| Teilpaket | Commit | Parent | Umfang |
| --- | --- | --- | --- |
| D1 | `94eab3c5228e77d4b70f7507216583407e8d9dc4` | `464832756ece9ea6b8e94bc3d229648e195feb19` | Operator-Orchestrierung und offizielles Manifest, fünf Dateien |
| D2 | `bda75c3b7d5ccaba509696445b37b3fbefb39733` | `94eab3c5228e77d4b70f7507216583407e8d9dc4` | Pester-3.4-Abnahmesuite und BF-002, zehn Dateien einschließlich neun Testdateien |

D3 besitzt vor der finalen Abnahme keinen Commitnachweis. Ein Commit darf erst nach dokumentierter Freigabe erfolgen und wird durch diese Checkliste nicht selbst erzeugt.

## 5. Bereits bestandene D1-/D2-Prüfungen

| Prüfung | Nachgewiesenes Ergebnis |
| --- | --- |
| Pester 3.4 / Windows PowerShell 5.1 | `232/232` bestanden |
| `npm test` | `182/182` bestanden |
| `npm run check:static` | bestanden |
| `npm run check:frontend` | bestanden |
| Parserprüfung | 21 PowerShell-Dateien geparst |
| `git diff --check` | bestanden |

Diese Ergebnisse sind Nachweise des D1-/D2-Stands und ersetzen nicht die offene finale Abnahme.

## 6. Offene finale Abnahme

Die finale Abnahme besteht zwingend aus Phase A und Phase B in dieser Reihenfolge. Dokumente müssen vor Beginn von Phase B final sein. Phase B darf erst beginnen, wenn Phase A vollständig bestanden und der dabei festgestellte Repositoryzustand als Ausgangszustand festgehalten wurde.

Eine erste `LocalFreeze`-Abnahme deckte beim Check `local.build` die fehlende deterministische LOCAL-Build-Umgebung für `npm.build` auf. Der Defekt wurde vor Abschluss der Phase B korrigiert. Die anschließende Phase A bestand; der erneut ausgeführte offizielle `Preflight` wurde danach beim Check `path.scope` kontrolliert mit `path-scope-extra-path-blocked` blockiert. Die allgemeine Pfadpolicy akzeptierte alle Kandidatenpfade, während die geschlossene interne D-Liste die beiden LOCAL-Build-Reparaturpfade noch nicht enthielt. Diese exakte Liste wurde minimal um die beiden Pfade erweitert. Der begonnene Phase-B-Lauf gilt nicht als bestanden; Phase B muss nach dieser Codeänderung vollständig neu durchgeführt werden. Das Gesamtmodul ist daher noch nicht final abgeschlossen.

## 7. Phase A – Dokumentations- und statische Abnahme

Phase A muss vollständig bestätigen:

- [ ] Der finale Kandidat umfasst exakt die neun Pfade aus Abschnitt 3.
- [ ] Außerhalb dieser neun Pfade besteht keine Änderung und keine zusätzliche untracked Datei.
- [ ] Der Windows-PowerShell-5.1-Parser prüft alle 21 Operator-PS1-/PSM1-Dateien ohne Fehler (`21/21`).
- [ ] Pester 3.4 unter Windows PowerShell 5.1 besteht mit `238/238`.
- [ ] `npm test` besteht mit Exitcode `0`.
- [ ] `npm run check:frontend` besteht mit Exitcode `0`.
- [ ] `npm run check:static` besteht mit Exitcode `0`.
- [ ] `git diff --check` besteht.
- [ ] Der echte Operator-Prozesstarget `npm.build` besteht bei ambientem `PORTAL_ENVIRONMENT=PROD` mit `passed`/`0`.
- [ ] Der ambient gesetzte Wert des aufrufenden Prozesses ist nach dem Operator-`npm.build` weiterhin `PROD`.
- [ ] Der direkte Build ohne `PORTAL_ENVIRONMENT` endet vertragsgemäß mit Exitcode `1`; dies ist kein Phase-A-Fehler, weil ausschließlich der kontrollierte Operatorbuild die LOCAL-Umgebung bereitstellt.
- [ ] `operator-framework-contracts-v1.md` ist gegen den korrigierten Code- und Teststand geprüft.
- [ ] Der Dokumentationsinhalt ist gegen Entry-Point, offizielles Manifest, Checkregistry, Orchestrierung, Reporting, Prozess-, Git-, Manifest- und Securitymodule sowie alle Operator-Testdateien geprüft.
- [ ] Alle drei Dokumente sind nicht leer und als UTF-8 ohne BOM gespeichert.
- [ ] Die Dokumente enthalten keine Secrets, erfundenen RunIds oder erfundenen Zeitpunkte.
- [ ] Der nach Finalisierung der Dokumente erfasste Repositoryzustand ist vor und nach den Phase-A-Prüfungen unverändert.

Jede Abweichung beendet Phase A sofort. Phase B darf dann nicht gestartet werden.

## 8. Phase B – Offizieller lokaler Operatorlauf

Phase B muss nach Finalisierung dieser Path-Scope-Ausrichtung vollständig neu ausgeführt werden. Sie verwendet ausschließlich den finalen neunpfadigen Abnahmekandidaten und das offizielle Manifest `scripts/operator/manifests/M000-R1.json`. Die Reihenfolge ist verbindlich:

1. Offizieller `SelfTest`; erwarteter Marker `V4_M000_R1_SELFTEST_OK`.
2. Offizieller `Preflight`; erwarteter Marker `V4_M000_R1_PREFLIGHT_OK`.
3. Offizieller `LocalVerify`; erwarteter Marker `V4_M000_R1_LOCAL_OK`.
4. Offizieller `LocalFreeze` mit der tatsächlichen `ReferenceRunId` genau dieses bestandenen `LocalVerify`; erwarteter Marker `V4_M000_R1_LOCAL_FROZEN`.

Für jeden Lauf muss ein semantisch validiertes `result.json` mit dem zur Stufe passenden `passed`/`0` vorliegen. Jeder Lauf muss über `cleanup.json` und das Resultat bestätigen, dass Cleanup bestanden wurde und keine eigenen Prozesse verbleiben. Ein Marker allein genügt nicht.

Nach Beginn des finalen `LocalVerify` ist jede Repositoryänderung verboten. `LocalFreeze` muss exakt diesen unmittelbar vorgesehenen, vollständig bestandenen `LocalVerify` referenzieren und dessen Metadaten, Manifest, Fingerprint, Checks, Attempts, Logs und Cleanup erfolgreich validieren. `LocalFreeze` erstellt keinen Commit.

## 9. Erfolgskriterien

Eine finale Freigabe ist nur zulässig, wenn:

- Phase A ohne Abweichung vollständig bestanden ist,
- alle vier Phase-B-Läufe in der festgelegten Reihenfolge `passed`/`0` liefern,
- alle vier exakten Erfolgsmarker erst nach validiertem `result.json` erscheinen,
- alle Cleanupberichte bestanden sind und null verbleibende eigene Prozesse melden,
- der `LocalFreeze` genau die dokumentierte `LocalVerify`-RunId referenziert,
- Repositoryzustand und Fingerprint die jeweiligen Verträge erfüllen,
- seit Beginn des finalen `LocalVerify` keine Repositoryänderung eingetreten ist,
- keine Remote-, Deployment- oder Commitoperation ausgeführt wurde.

## 10. Abbruchkriterien

Sofortiger Abbruch gilt insbesondere bei:

- einer Änderung oder zusätzlichen Datei außerhalb der neun Kandidatenpfade,
- einer fehlgeschlagenen Phase-A-Prüfung oder verändertem Repositoryzustand,
- einem anderen Status/Exitcode als `passed`/`0`, fehlendem oder falschem Marker,
- fehlendem, unlesbarem oder semantisch ungültigem `result.json`,
- Cleanupfehlern oder verbleibenden eigenen Prozessen,
- Repository-, Manifest-, Check-, Attempt-, Log- oder Fingerprintabweichungen,
- fehlender, falscher oder nicht ausschließlich für `LocalFreeze` verwendeter `ReferenceRunId`,
- einer Repositoryänderung nach Beginn des finalen `LocalVerify`,
- dem Versuch einer DEV-/PROD-, Remote-, Commit- oder Deploymentoperation.

Nach einem Abbruch dürfen keine nachfolgenden offiziellen Stufen gestartet werden. Der Completionstatus bleibt ausstehend.

## 11. Remote- und Commitregeln

- Kein Fetch, Pull, Push, Merge, Rebase oder sonstiger Remotezugriff.
- Kein Commit während D3, Phase A oder Phase B.
- `LocalFreeze` erstellt keinen Commit.
- Kein Push.
- Keine DEV-/PROD-Stufe.
- Kein WordPress-, Docker- oder Supabase-Deployment.
- Eine spätere Commitfreigabe ist eine getrennte Entscheidung und muss im Abschlussprotokoll ausdrücklich dokumentiert werden.

## 12. Abschlussprotokoll

Die Felder bleiben bis zur tatsächlichen Ausführung leer; es werden keine RunIds, Zeitpunkte oder Resultate vorweggenommen.

| Stufe | Tatsächliche RunId | Zeitpunkt | Resultat / Exitcode | Marker validiert | Cleanup validiert |
| --- | --- | --- | --- | --- | --- |
| `SelfTest` |  |  |  |  |  |
| `Preflight` |  |  |  |  |  |
| `LocalVerify` |  |  |  |  |  |
| `LocalFreeze` |  |  |  |  |  |

| Abschlussangabe | Tatsächlicher Eintrag nach Abnahme |
| --- | --- |
| Phase A abgeschlossen am |  |
| Phase B abgeschlossen am |  |
| Referenzbeziehung `LocalFreeze` → `LocalVerify` bestätigt |  |
| Repositoryzustand nach Phase B |  |
| Commitfreigabe |  |
| Freigabeverantwortliche Person |  |

Bis diese tatsächlichen Angaben vollständig und prüfbar eingetragen sind, bleibt der Status: **Vorbereitet – finale zweiphasige Abnahme ausstehend**.

# M150 R1 / F1.3 – internes Portal für Mitgliedsanträge

F1.3 ergänzt die bestehende Fanclub-Hauptroute um den Fanclub-Tab **„Mitgliedsanträge“**. Sichtbar ist der Tab ausschließlich für die aktuellen aktiven Vorstandsmitglieder: Der Portalbenutzer muss mit einem aktiven Mitglied verknüpft sein, das aktuell einen der in `fanclub_snapshot.offices` gelieferten Vorstandsplätze innehat. Eine Adminrolle oder allgemeine Mitgliederberechtigung ersetzt diese Prüfung nicht. Der Server bleibt die Autoritätsgrenze; die Frontendprüfung steuert nur die Darstellung.

## Liste, Details und Status

Die Antragsliste wird über `membership_applications_list` in der bestehenden Serverreihenfolge geladen und kann lokal nach Offen, Angenommen, Abgelehnt, Zurückgezogen oder Alle gefiltert werden. Beim Öffnen eines Eintrags werden die Details immer frisch über `membership_application_detail` geladen. Die Detailansicht trennt Personen-, Antrags- und Entscheidungsdaten sowie internen Entscheidungsgrund und eine separate Mitteilung an den Antragsteller.

Die Abstimmungsanzeige übernimmt ausschließlich den serverseitigen Stand. Eine eigene Stimme kann nur einmal als Ja oder Nein abgegeben werden. Wird mit der eigenen Nein-Stimme die dritte Nein-Stimme erreicht, ist ein interner Grund mit maximal 4.000 Zeichen Pflicht. Dieser Text ist nicht für den Antragsteller bestimmt.

Die **7-Tage-Manuellentscheidung** wird nur angeboten, wenn der Server `sevenDayDecisionAvailable` liefert. Das Frontend berechnet keine Frist. Aufnahme und Ablehnung benötigen einen internen Entscheidungsgrund; nur bei Ablehnung kann zusätzlich eine getrennte Mitteilung an den Antragsteller erfasst werden. Mehrheiten, Board-Snapshot und aktuelle Vorstandsbesetzung werden weiterhin ausschließlich serverseitig geprüft.

## Hinweise und kontrollierte Übernahme

Hinweise zu ähnlichen Mitgliedern, Portalusern oder weiteren offenen Anträgen erscheinen ausdrücklich als **„Hinweise – keine automatische Zuordnung“**. Sie führen weder zu einem Auto-Match noch zu einer vorausgewählten Zielperson.

**APPROVED ist noch kein Mitglied.** Ein angenommener Antrag bleibt bis zu einer zweiten, ausdrücklichen Aktion unkonvertiert. Für die Übernahme stehen genau drei Modi zur Verfügung:

- `NEW_MEMBER`: neues Mitglied aus den Antragsdaten anlegen;
- `REACTIVATE_EXISTING`: bewusst ausgewähltes inaktives Mitglied reaktivieren;
- `RESOLVE_EXISTING_ACTIVE`: Antrag bewusst einem ausgewählten aktiven Mitglied zuordnen.

Bei `NEW_MEMBER` blockieren vorhandene Hinweise die Neuanlage nicht automatisch, werden aber vor der Bestätigung hervorgehoben. Für beide Bestandsmodi gibt es keine Vorauswahl. Antragsdaten und ausgewählter Mitgliedsdatensatz werden getrennt dargestellt.

Die D-017-Reaktivierung setzt Status, Austrittsdatum und neues Eintrittsdatum ausschließlich nach dem bestehenden Serververtrag. Vorhandene Stammdaten werden nicht automatisch überschrieben. Ist ein inaktives Mitglied noch einem Vorstandsamt zugeordnet, zeigt F1.3 den stale-office Blocker an; das Amt muss zuerst bewusst im Tab „Vorstand“ geklärt werden. M150 entfernt, bestätigt oder reaktiviert keine Amtszuordnung automatisch. Beim Zuordnen eines bereits aktiven Mitglieds wird dessen Datensatz nicht verändert.

Nach Abstimmung, manueller Entscheidung und Konvertierung werden Liste und Detail frisch vom Server geladen. Nach einer erfolgreichen Mitgliedskonvertierung lädt `fanclub.js` zusätzlich den bestehenden Fanclub-Mitgliedersnapshot neu. Dadurch sind Statusänderungen und neu angelegte Mitglieder unmittelbar in der nächsten Zielauswahl wirksam.

Scheitert ausschließlich dieses Nachladen nach einer bereits erfolgreichen Conversion, wird die Conversion nicht wiederholt. Der alte Kandidatenbestand wird verworfen, Antragsliste und Detail werden soweit möglich aktualisiert und die Oberfläche fordert zum erneuten Öffnen des Fanclub-Bereichs auf. Bei einem Revision Conflict erfolgt ebenfalls kein automatischer erneuter Schreibversuch.

## Abgrenzung

F1.3 erzeugt und aktiviert keinen Portalzugang, keine `user_member_links`, keine Rolle und kein Amt. Es enthält keine Finance-, Beitrags-, Zahlungs- oder SEPA-Aktion. Ebenfalls nicht enthalten sind E-Mail, PDF, Public Submit, WordPress, Turnstile, Datenschutz-/Satzungsseiten und eine öffentliche Rücknahmeaktion.

Es gibt keine neue Datenbankmigration, keine neue RPC-Aktion und keine direkte Tabellenabfrage aus dem Browser. Alle fünf bestehenden M150-Aktionen laufen über den gemeinsamen `call(...)`-Helfer und damit über `public.pd_api`.

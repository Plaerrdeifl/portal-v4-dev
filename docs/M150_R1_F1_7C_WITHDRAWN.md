# M150 R1 F1.7C – WITHDRAWN

`WITHDRAWN` dokumentiert, dass ein Antragsteller seinen noch offenen Mitgliedsantrag außerhalb des öffentlichen Portals zurückgezogen hat. Die Erfassung ist ausschließlich eine interne Aktion; es gibt keinen öffentlichen Withdrawal-Endpunkt und keine Withdrawal-Funktion im WordPress-Formular.

Die Aktion darf nur ein aktuell amtierendes, digital auflösbares Vorstandsmitglied ausführen. Sie ist keine 3-von-5-Vorstandsentscheidung und erfordert weder eine vollständige aktuelle Fünferbesetzung noch die Übereinstimmung des bei Antragseingang gespeicherten Board-Snapshots mit dem aktuellen Vorstand.

Zulässig ist ausschließlich der revisionssichere Übergang `PENDING -> WITHDRAWN`. Der Zielstatus ist serverseitig festgelegt. In M150 R1 ist der Übergang über die Anwendungs-API irreversibel; es gibt keine Undo- oder Restore-Aktion.

Der Rückzug setzt keine Entscheidungs- oder Conversion-Felder. Bereits vorhandene Stimmen und der gespeicherte Board-Roster bleiben als historischer Stand erhalten. Weitere Stimmen, die 7-Tage-Entscheidung und eine Conversion sind nach dem Statuswechsel durch die bestehende Folgelogik ausgeschlossen.

Es wird keine automatische E-Mail erzeugt und kein interner Freitextgrund erfasst. Das Audit enthält ausschließlich den Statuswechsel von `PENDING` zu `WITHDRAWN` und technisch notwendige Metadaten, jedoch keine vollständigen Antrags- oder Personendaten.

Die F1.7A-Retention bleibt unverändert und behandelt `WITHDRAWN` weiterhin anhand von `updated_at`. Durch den Statuswechsel wird `updated_at` auf den serverseitigen Zeitpunkt der Rückzugserfassung gesetzt.

Die Aktion verändert weder Mitglieder noch Portalzugänge, Rollen, Ämter oder Finanzdaten.

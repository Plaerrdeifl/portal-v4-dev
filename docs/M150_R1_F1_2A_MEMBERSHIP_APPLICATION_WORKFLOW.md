# M150 R1 F1.2A – Membership-Application-Workflow

F1.2A führt `app_fanclub.membership_applications` als vom Mitgliederbestand strikt getrennte Entität, `app_fanclub.membership_application_board_roster` als unveränderbaren Entscheidungssnapshot und `app_fanclub.membership_application_votes` als unveränderbares Abstimmungsprotokoll ein. Ein Antrag erzeugt weder Mitglied, Portaluser, Rolle, Amt, Portalzugang noch Finanzbuchung. `submitted_at` bleibt als später nutzbare Quelle für ein mögliches Eintrittsdatum unveränderbar.

## Interner Zugriff

Nur aktive Portaluser, die über `office_slots`, `user_member_links` und ein aktives Mitglied aktuell einen der fünf festen Amtsplätze innehaben, dürfen die vier neuen Aktionen des authentifizierten `public.pd_api` verwenden:

- `membership_applications_list`
- `membership_application_detail`
- `membership_application_vote`
- `membership_application_manual_decide`

Die Tabellen und privaten Funktionen sind für `public`, `anon` und `authenticated` direkt gesperrt. Es gibt keinen öffentlichen Submit-Endpunkt.

## Entscheidung

Beim Einfügen eines Antrags wird die zu diesem Zeitpunkt digital ermittelbare Besetzung der fünf festen Amtsplätze automatisch mit Amtsplatz, Portaluser und Mitglied eingefroren. Ist der Vorstand beim Eingang unvollständig, bleibt der tatsächlich ermittelte Zustand unverändert gespeichert; der Antrag selbst wird dadurch weder verworfen noch in ein Mitglied umgewandelt.

Vote- und manuelle Entscheidungsaktionen setzen voraus, dass sowohl der Eingangssnapshot als auch der aktuelle digitale Vorstand exakt fünf unterschiedliche Board-User auf den fünf erwarteten Amtsplätzen enthalten und in Amtsplatz, Portaluser und Mitglied vollständig übereinstimmen. Ein unvollständiger aktueller Vorstand führt zu `M150_BOARD_INCOMPLETE`, ein unvollständiger Eingangssnapshot zu `M150_BOARD_SNAPSHOT_INCOMPLETE` und jede spätere Besetzungsänderung zu `M150_BOARD_ROSTER_CHANGED`. Das gilt auch vor der ersten Stimme und beim Wechsel eines noch nicht abstimmenden Boardmitglieds. Der Snapshot wird weder neu erzeugt noch auf den aktuellen Stand überschrieben. Es gibt keinen Admin-, Capability- oder sonstigen Fallback.

Jeder Board-User kann pro Antrag genau einmal `YES` oder `NO` stimmen. Drei `YES` setzen den Antrag automatisch auf `APPROVED`; drei `NO` auf `REJECTED`. Die entscheidende dritte `NO`-Stimme benötigt einen internen Grund, der nicht als Antragsteller-Mitteilung übernommen wird. Antragssperre, erwartete Revision und der eindeutige Vote-Schlüssel schützen die Mutation vor Konkurrenz und Doppelabgabe.

Eine manuelle Entscheidung ist nur bei weiterhin `PENDING`, ohne Mehrheit, bei unverändert passendem Vorstandssnapshot und ab dem lokalen Datum von `submitted_at` plus sieben Kalendertagen in `Europe/Berlin` möglich. Bei unvollständigem oder abweichendem Board ist `sevenDayDecisionAvailable` falsch. `APPROVED` und `REJECTED` benötigen bei manueller Entscheidung einen internen Grund; `applicant_notice` ist separat und optional. Eine per Stimmenmehrheit entstandene `APPROVED`-Entscheidung darf dagegen ohne internen Grund gespeichert werden.

## Hinweise und Audit

Die Detailansicht liefert ausschließlich konservative Trefferhinweise über normalisierte E-Mail, exakte Namens-/Geburtsdatumskombination, normalisierte Telefonnummer, Portaluser-E-Mail und andere offene Anträge. Treffer lösen keine Mutation oder Verknüpfung aus.

Votes, automatische Mehrheitsentscheidungen und Sieben-Tage-Entscheidungen werden über `app_private.log_audit` datensparsam protokolliert. Personenbezogene Vollanträge werden nicht in das Audit kopiert.

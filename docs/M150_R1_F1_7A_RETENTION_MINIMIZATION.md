# M150 R1 / F1.7A – Retention und Datenminimierung

## Zweck und Grenzen

F1.7A minimiert den optionalen öffentlichen Antragsteller-Freitext nach erfolgreicher Membership Conversion und ergänzt eine kontrollierte 12-Monats-Retention für alte Membership Applications. Die Umsetzung verändert keine bestehende M150-Migration, keine Conversion-API und keinen Statusworkflow. Sie löscht keine Mitglieder und erzeugt weder Portalzugang noch Rollen oder Ämter.

## Minimierung bei Conversion

Beim erstmaligen Übergang von `converted_at IS NULL` zu `converted_at IS NOT NULL` setzt ein `BEFORE UPDATE`-Trigger ausschließlich `applicant_message` auf `NULL`. Die Minimierung erfolgt atomar mit dem Setzen der erfolgreichen Conversion-Metadaten. Ein enger Backfill setzt außerdem `applicant_message` bei bereits konvertierten Applications auf `NULL`, ohne `revision`, `updated_at`, Conversion-Metadaten, Mitgliedsdaten oder Audit zu verändern.

Bewusst erhalten bleiben die strukturierten Application-Daten: Vor- und Nachname, Geburtsdatum, E-Mail, Telefon, Anschrift, `submitted_at`, Erklärungs- und Satzungsversionen samt Referenz und Bestätigungen, Entscheidungsstatus und -metadaten sowie die vollständigen Conversion-Metadaten. Der interne Entscheidungsgrund ist kein öffentlicher Antragsteller-Freitext und wird nicht minimiert. `rejection_applicant_notice` bleibt fachlich auf REJECTED begrenzt; die Legacy-Spalte `applicant_notice` bleibt `NULL`.

## Zwölf-Monats-Retention

Eine Application ist bei einer Grenze von kleiner oder gleich 12 Monate nur in genau diesen Fällen fällig:

- `PENDING`: `submitted_at` ist der Retention-Anker.
- `REJECTED`: `decided_at` ist der Retention-Anker.
- `WITHDRAWN`: `updated_at` ist der Retention-Anker, weil das bestehende Modell weder `decided_at` noch ein separates `withdrawn_at` für WITHDRAWN besitzt.

`APPROVED` ist nicht purge-fähig. Das gilt unabhängig vom Alter und insbesondere für konvertierte APPROVED Applications. Frische Applications bleiben erhalten.

## Kontrollierter Retention-Run

`public.m150_membership_retention_run()` ist ein parameterloser, ausschließlich für `service_role` freigegebener Wrapper. Er delegiert an `app_private.m150_membership_retention_run()`. Die private Funktion ist nicht direkt für `service_role`, `anon`, `authenticated` oder `PUBLIC` freigegeben. Es gibt keine Browser-Schnittstelle und keine `pd_api`-Action.

Jeder Run verarbeitet in deterministischer Reihenfolge maximal 100 Applications. Kandidaten werden mit `FOR UPDATE SKIP LOCKED` gesperrt, damit parallele Board-, Conversion- und Retention-Prozesse einander nicht unsicher überschreiben. Applications mit einem aktuell `SENDING` Outbox-Event werden übersprungen. Die Outbox-Zeilen eines Kandidaten werden vor dem Purge gesperrt und anschließend erneut auf `SENDING` geprüft, damit ein gleichzeitig stattfindender Claim nicht durch Retention gelöscht wird. Outbox-Zustände `PENDING`, `SENT` und `FAILED` blockieren den Purge nicht.

## FK-Reihenfolge und Cascades

Die bestehenden Foreign Keys bleiben unverändert. Für jede tatsächlich zu löschende Application entfernt die Funktion zuerst Zeilen aus `membership_application_intake_idempotency`, danach aus `membership_application_votes` und erst anschließend die Application. Die bestehenden `ON DELETE CASCADE`-Verträge entfernen zugehörigen Board-Roster und Outbox-Einträge.

## Audit und Rückgabe

Vor jedem Application-Delete entsteht das minimale Audit-Event `MEMBERSHIP_APPLICATION_RETENTION_PURGED`. Der Actor ist `NULL`; `before_data` und `after_data` bleiben `NULL`. Die Metadaten enthalten nur den vorherigen Status und einen technischen `retentionReason`: `STALE_PENDING`, `REJECTED_12_MONTHS` oder `WITHDRAWN_12_MONTHS`. Namen, Kontaktdaten, Anschrift, Geburtsdatum, Antragstexte, Applicant Notice, interne Gründe und Mitgliedsdaten werden nicht ins Retention-Audit übernommen. Historische Audit-Events bleiben unverändert erhalten.

Die Rückgabe enthält ausschließlich die technischen Counts `purged`, `pending`, `rejected` und `withdrawn`; sie enthält keine PII.

## Abgrenzung und Betrieb

F1.7A erstellt keinen Cron, keine Edge Function, keinen Workflow und keinen Remote Schedule. Die regelmäßige Betriebsaktivierung muss separat vor dem Go-live eingerichtet werden. Dieses Paket enthält kein Deployment und kein PROD.

WordPress und Portal bleiben unverändert; es gibt kein WordPress-Mail und keinen neuen Portalzugang. Members, Portal-User-Verknüpfungen, Rollen, Ämter, Office Slots, Finance, Beiträge, Zahlungen, SEPA, M210 und M000 werden nicht verändert.

F1.7A implementiert keine interne WITHDRAWN-Bedienaktion. Als separater Abschluss-Punkt muss die RC-Gesamtprüfung verifizieren, dass der verbindlich vorgesehene interne WITHDRAWN-Workflow vorhanden ist oder vor RC geschlossen wird.

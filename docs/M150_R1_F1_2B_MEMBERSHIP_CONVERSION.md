# M150 R1 / F1.2B – Kontrollierte Mitgliedskonvertierung

`APPROVED` bedeutet ausschließlich, dass der Mitgliedsantrag angenommen wurde. Der Antrag ist damit weder automatisch konvertiert noch mit einem Portalzugang verbunden. Eine Konvertierung muss ein aktuell digital auflösbarer Vorstandsnutzer ausdrücklich auslösen.

## Conversion-Modi

Die interne Aktion `membership_application_convert` akzeptiert genau drei Modi:

- `NEW_MEMBER` erzeugt genau einen neuen Datensatz in `app_fanclub.members`. Die Mitgliedsnummer wird über den bestehenden Default `app_private.next_member_code()` vergeben. `joined_on` ist das lokale Antragsdatum: `(submitted_at at time zone 'Europe/Berlin')::date`.
- `REACTIVATE_EXISTING` setzt ein ausdrücklich über `targetMemberId` gewähltes, nicht aktives Mitglied wieder auf `ACTIVE`. Gemäß D-017 bleiben `member.id` und `member_code` erhalten. `left_on` wird geleert und `joined_on` auf das lokale Datum des neuen Antrags gesetzt. Antragsstammdaten und interne Texte überschreiben den Bestandsdatensatz nicht.
- `RESOLVE_EXISTING_ACTIVE` löst den Antrag ausdrücklich zu einem aktiven Bestandsmitglied auf. Der Mitgliedsdatensatz wird nicht verändert.

Duplicate-Hinweise dienen nur der menschlichen Prüfung. Es gibt keine automatische Identitätsentscheidung, kein Best-Match und kein Auto-Linking. Für die beiden Bestandsmodi ist `targetMemberId` Pflicht; bei `NEW_MEMBER` ist das Feld verboten.

Ist ein inaktives Mitglied noch einem bestehenden Eintrag in `office_slots` zugeordnet, wird `REACTIVATE_EXISTING` blockiert. M150 entfernt oder bestätigt diesen Amtsplatz nicht automatisch. Erst nach bewusster Klärung der Amtszuordnung kann die Mitgliedsreaktivierung erfolgen, damit keine Amts- oder daraus abgeleitete Portalberechtigung implizit wieder aktiviert wird.

## Sicherheit, Idempotenz und Audit

Die private Funktion sperrt den Antrag mit `SELECT ... FOR UPDATE`, prüft `expectedRevision`, den Status `APPROVED` und noch nicht gesetzte Conversion-Metadaten. Bei Bestandsmodi wird zusätzlich das Zielmitglied gesperrt. Die Metadaten `converted_at`, `converted_by`, `converted_member_id` und `conversion_mode` werden nur vollständig gesetzt; ein DB-Constraint verhindert partielle Zustände und erlaubt gesetzte Conversion-Metadaten ausschließlich bei `APPROVED`. Dadurch kann ein konvertierter Antrag auch nicht direkt in einen anderen Status versetzt werden. Nach erfolgreicher Konvertierung schützt ein Trigger alle vier Felder vor Änderungen.

Jede erfolgreiche Konvertierung erzeugt `MEMBERSHIP_APPLICATION_CONVERTED` über `app_private.log_audit`. Das Audit enthält Modus, Mitglied, ausführenden Nutzer und Zeitpunkt. Bei Wiederaufnahme wird zusätzlich der vorherige Status sowie `joined_on` und `left_on` dokumentiert. Vollständige personenbezogene Antragspayloads werden nicht protokolliert.

## Abgrenzung

Die Konvertierung verändert weder Portalnutzer, Zugangsanforderungen, Benutzer-Mitglied-Verknüpfungen, Rollen oder Ämter noch Finance-, Beitrags- oder SEPA-Daten. Sie erzeugt keinen Portalzugang. Es gibt keine neue öffentliche Schnittstelle: Der Browser verwendet weiterhin ausschließlich das authentifizierte `public.pd_api`; private Funktionen besitzen keine direkten Browser-Grants und `anon` darf `pd_api` nicht ausführen.

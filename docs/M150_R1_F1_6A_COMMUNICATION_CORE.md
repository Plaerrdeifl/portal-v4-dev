# M150 R1 / F1.6A – Membership Application Communication Core

## Zweck und Autoritätsgrenze

F1.6A ergänzt einen providerunabhängigen Kommunikationskern für Mitgliedsanträge. Es wird noch keine E-Mail gesendet. Kommunikationsereignisse entstehen ausschließlich aus dem autoritativen Zustand von `app_fanclub.membership_applications` und werden als technische Events in `app_private.membership_application_email_outbox` gespeichert.

Browser- und WordPress-Aktionen erzeugen keine Kommunikationsereignisse. Insbesondere sind weder ein Browser-Submit noch WordPress HTTP 200 ein Receipt-Nachweis. Das WordPress-Plugin bleibt unverändert und verwendet kein `wp_mail()`.

## Fachliche Ereignisse

F1.6A kennt exakt drei E-Mail-Typen:

- `RECEIPT`: entsteht nach dem tatsächlichen INSERT einer neuen Membership Application. Ein technischer Idempotency-Retry oder eine erkannte PENDING-Dublette legt keine zweite Application und damit kein zweites Receipt an. Zusätzlich verhindert `UNIQUE (application_id, email_type)` doppelte Events.
- `REJECTION`: entsteht nur bei einer echten Status-Transition von einem anderen Status nach `REJECTED`. Das gilt sowohl für die entscheidende dritte NO-Stimme als auch für die manuelle Ablehnung nach sieben Tagen. Eine oder zwei NO-Stimmen, `APPROVED` und `WITHDRAWN` erzeugen kein Rejection-Event.
- `ADMISSION`: entsteht erst, wenn die Conversion-Metadaten erstmals vollständig und erfolgreich gesetzt werden. Das umfasst `NEW_MEMBER`, `REACTIVATE_EXISTING` und `RESOLVE_EXISTING_ACTIVE`. `APPROVED` allein ist keine Aufnahmebestätigung und erzeugt kein Admission-Event. Eine fehlgeschlagene Conversion erzeugt ebenfalls kein Event.

Für `WITHDRAWN` besteht in R1 keine Pflichtkommunikation. Es gibt keine Approval-Mail vor einer erfolgreichen Conversion.

Die Trigger laufen nach dem autoritativen INSERT beziehungsweise UPDATE. Event und fachliche Mutation liegen in derselben Datenbanktransaktion; bei einem Fehler wird beides zurückgerollt.

## Interner Ablehnungsgrund und Applicant Notice

Der interne Ablehnungsgrund bleibt bei der entscheidenden dritten NO-Stimme und bei der manuellen Sieben-Tage-Entscheidung unverändert Pflicht. Er bleibt Audit-/Entscheidungsinformation und wird niemals als externe Nachricht verwendet oder automatisch kopiert.

Die externe, optionale Eigenschaft heißt in der Tabelle `rejection_applicant_notice` und im vorhandenen Payload-/Detailvertrag weiterhin `applicantNotice`. Sie ist strikt auf tatsächliche Ablehnungen begrenzt:

- maximal 2000 Zeichen;
- serverseitig getrimmt;
- leerer Text wird `NULL`;
- Plain Text ohne HTML-Markup;
- atomare Speicherung nur bei der erfolgreichen `REJECTED`-Transition;
- keine dauerhafte Speicherung bei einer nicht entscheidenden NO-Stimme;
- keine Speicherung bei Approval;
- nach `REJECTED` unveränderlich.

Die alte generische Tabellenspalte `applicant_notice` wird aus Kompatibilitätsgründen nicht als neue Schnittstelle verwendet und per Constraint leer gehalten. Vorhandene Rejection-Inhalte werden bei der Migration in die neue fachlich eindeutige Spalte überführt. Die interne Detailansicht zeigt „Interner Ablehnungsgrund“ und „Mitteilung an Antragsteller“ separat. Es gibt kein Auto-Copy zwischen beiden Feldern.

Applicant Notice wird nicht als Klartext in Audit-Metadaten kopiert. Ergänzt wird nur die datensparsame Information `applicantNoticeProvided = true/false`. Die bestehende Auditierung des internen Entscheidungsvorgangs bleibt erhalten.

## Outbox-Modell

`app_private.membership_application_email_outbox` enthält ausschließlich technische Event- und Delivery-Metadaten:

- Event-ID und führende `application_id`;
- `email_type`;
- Status und Claim-Versuche;
- Verfügbarkeit, Lease und Claim-Token;
- Versandzeitpunkt;
- kurzer technischer Fehlercode;
- Erstellungs- und Änderungszeitpunkt.

Die vier Zustände lauten exakt `PENDING`, `SENDING`, `SENT` und `FAILED`. E-Mail-Adresse, Name, Geburtsdatum, Telefon, Adresse, Antragstext, interner Ablehnungsgrund und Applicant Notice werden nicht redundant in der Outbox gespeichert. Die benötigten Kommunikationsdaten werden beim Claim kontrolliert aus der führenden Application gelesen.

Die Outbox besitzt RLS. Direkte Tabellenrechte sind für `PUBLIC`, `anon`, `authenticated` und `service_role` entzogen. Auch `service_role` darf ausschließlich die kontrollierten öffentlichen Wrapper ausführen.

## Claim-Vertrag

`public.m150_membership_email_claim()` ist ausschließlich für `service_role` ausführbar und akzeptiert keine Browser- oder Empfängerparameter. Die private Implementierung claimt atomar maximal ein fälliges Event mit `FOR UPDATE SKIP LOCKED`.

Claimbar sind:

- `PENDING` mit `available_at <= now()`;
- ein verwaistes `SENDING` mit abgelaufenem `claim_expires_at`;
- jeweils nur bei weniger als fünf bisherigen Claims.

Ein Claim setzt `SENDING`, erhöht `attempts`, erzeugt einen neuen zufälligen Claim-Token und setzt eine Lease von 10 Minuten. Es gibt maximal fünf Claims/Versuche. Ein verwaister fünfter Claim wird endgültig `FAILED` und nicht erneut ausgeliefert.

Wenn kein Event fällig ist, lautet die Rückgabe `{"claimed": false}`. Andernfalls enthält sie nur:

- `claimed`
- `outboxId`
- `claimToken`
- `emailType`
- `recipientEmail`
- `firstName`
- bei `REJECTION` zusätzlich `applicantNotice`

`recipientEmail` und `firstName` stammen aus der autoritativen Application. Ein Claim-Request kann sie nicht vorgeben. Interner Ablehnungsgrund, Votes, Board-Roster, Geburtsdatum, Telefon, Adresse, applicantMessage, Finance-, SEPA-, Rollen- oder Amtsdaten sind nicht Teil des Claim-JSON.

## Complete-Vertrag und Retry

`public.m150_membership_email_complete(uuid, uuid, boolean, text)` ist ebenfalls ausschließlich für `service_role` ausführbar. Nur der aktuelle, noch gültige Claim-Token darf ein `SENDING`-Event abschließen.

Bei Erfolg wird das Event `SENT`, `sent_at` wird gesetzt, Claim-Felder und Fehlercode werden geleert. Bei einem fehlgeschlagenen Versuch unterhalb des fünften Claims wird es erneut `PENDING` und nach fünf Minuten wieder verfügbar. Beim fünften fehlgeschlagenen Versuch wird es endgültig `FAILED`.

`last_error_code` ist auf maximal 80 Zeichen und ein enges technisches Codeformat begrenzt. Provider-Rohantworten, HTTP-Bodies, E-Mail-Adressen, PII, Secrets oder Stacktraces werden dort nicht gespeichert.

## Providerunabhängigkeit und F1.6B

F1.6A implementiert keine E-Mail und wählt keinen Provider. Es gibt kein WordPress-Mail. Resend, Brevo, SMTP, SendGrid, Mailgun, PHP `mail`, Provider-APIs, eine E-Mail-Edge-Function, `pg_net` und ein Cron-Delivery-Worker sind nicht enthalten. Der tatsächliche Transport folgt in F1.6B.

Für F1.6B ist verbindlich: Der spätere Provider-Aufruf muss `outboxId` als externe Idempotency-Referenz verwenden, sofern der Provider dies unterstützt. Falls der Provider eine Nachricht akzeptiert und der Worker vor dem Complete-RPC ausfällt, kann die Lease ablaufen und das Event erneut geclaimt werden. Die externe Idempotency-Referenz muss einen Doppelversand dann soweit technisch möglich verhindern.

## Abgrenzung

F1.6A verändert das WordPress-Plugin, F1.4A, F1.4B und F1.5A nicht. Es erzeugt keine automatische Mitgliedschaft; ADMISSION folgt lediglich einer bereits erfolgreich abgeschlossenen kontrollierten Conversion. Es erzeugt keinen Portalzugang, keine Rollen, keine Ämter und keine Finance-, Beitrags-, Zahlungs- oder SEPA-Daten. M210 und M000 bleiben unverändert.

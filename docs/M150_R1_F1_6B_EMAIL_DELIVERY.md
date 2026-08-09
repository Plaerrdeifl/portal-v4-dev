# M150 R1 / F1.6B – Transactional Email Delivery

## Zweck und Autoritätsgrenze

F1.6B ergänzt den tatsächlichen Versand der in F1.6A erzeugten M150-E-Mail-Outbox. R1 verwendet Resend als Provider und die Supabase Edge Function `m150-membership-email-dispatch` als serverseitigen Transport. F1.6A bleibt die alleinige Autorität für Entstehung, Claim, Lease, Retry und Abschluss der Kommunikationsereignisse. F1.6B verändert weder die F1.6A-Migration noch die Outbox oder deren RPC-Vertrag.

Die Edge Function entscheidet keine Mitgliedschaft. Sie verwendet ausschließlich das bereits von `public.m150_membership_email_claim()` gelieferte Ereignis und ruft nach jedem Versandversuch `public.m150_membership_email_complete(...)` auf. Es gibt keine direkten Tabellenzugriffe und keine zusätzlichen PII-Abfragen.

## Dispatch-Schutz und Konfiguration

Die Function akzeptiert ausschließlich `POST` und ist keine CORS-, Browser- oder Benutzer-JWT-Schnittstelle. In `supabase/config.toml` ist für sie `verify_jwt = false` gesetzt, weil sie eine eigene enge Dispatch-Authentifizierung ausführt. Jeder interne Aufruf muss im Header `X-M150-Mail-Dispatch-Secret` den Wert des serverseitigen Secrets `M150_MAIL_DISPATCH_SECRET` senden. Das Secret muss mindestens 32 UTF-8-Bytes lang sein und wird soweit mit Web Crypto und einem festen Bytevergleich sinnvoll möglich zeitkonstant verglichen.

Vor dem ersten Claim werden alle notwendigen Runtime-Werte validiert. Fehlende oder ungültige Konfiguration führt geschlossen zu einem generischen HTTP-500-Fehler, ohne ein Ereignis zu claimen oder eine E-Mail zu senden:

- `M150_MAIL_DISPATCH_SECRET`
- `RESEND_API_KEY`
- `M150_EMAIL_FROM`
- optional `M150_EMAIL_REPLY_TO`
- `SUPABASE_URL`
- bevorzugt `SUPABASE_SECRET_KEYS`, kompatibel mit `SUPABASE_SERVICE_ROLE_KEY`

From und optionales Reply-To dürfen keine CR/LF-Zeichen enthalten und sind längenbegrenzt. Secrets werden ausschließlich als Edge-Function-Secrets bereitgestellt. Sie gehören weder in das Repository noch in Browser, Responses, Logs, WordPress oder Resend-Nutzdaten.

## Claim, Batch und Complete

Pro Invocation werden nacheinander höchstens fünf Ereignisse verarbeitet. Der kleinere feste R1-Batch lässt bei sequenziellen Provider-Timeouts Reserve gegenüber dem Edge-Request-Zeitbudget. Jeder Durchlauf claimt genau ein Ereignis über `public.m150_membership_email_claim()`. Bei `claimed = false` endet die Invocation sofort sauber. Nach jedem erfolgreich abgeschlossenen Ereignis wird erneut geclaimt, bis die Outbox leer oder das feste Batch-Limit erreicht ist.

Nach einem Provider-2xx wird Complete mit `p_success = true` und `p_error_code = null` aufgerufen. Bei Provider-HTTP-, Timeout- oder Netzwerkfehlern wird Complete mit `p_success = false` und einem kurzen technischen Code wie `PROVIDER_HTTP_429` oder `PROVIDER_NETWORK` aufgerufen. Provider-Bodies, Rohfehlermeldungen, Empfängeradressen und andere PII werden nicht gespeichert.

Wenn Resend die E-Mail angenommen hat, aber der nachfolgende Complete-Aufruf fehlschlägt, bricht die Invocation ab. Das Ereignis wird nicht künstlich als fehlgeschlagen abgeschlossen. Dasselbe gilt, wenn sowohl der Versand als auch sein Failure-Complete nicht erreichbar sind. Lease und späterer Retry bleiben in beiden Fällen Sache von F1.6A.

## Resend und Idempotenz

Der Provider-Endpunkt ist fest `POST https://api.resend.com/emails`. Jeder Request enthält den Resend API-Key als Bearer-Authentifizierung, JSON mit `text` und `html` sowie den Header `Idempotency-Key`. Der Idempotency-Key ist exakt die von F1.6A geclaimte `outboxId` und bleibt bei einem späteren Retry desselben Ereignisses identisch.

Resends Provider-Idempotenzfenster von 24 Stunden ist eine Betriebsannahme. Innerhalb dieses Fensters kann derselbe Key eine Wiederholung nach „Provider accepted, Complete fehlgeschlagen“ deduplizieren. Nach Ablauf des Providerfensters besteht das Restrisiko eines Doppelversands, falls ein noch nicht abgeschlossenes Ereignis erneut versendet werden muss. F1.6B speichert deshalb weder einen neuen Zufallsschlüssel noch ersetzt es die `outboxId` durch Application-, Empfänger- oder Provider-Daten.

Der Provider-Aufruf besitzt einen engen Timeout von ungefähr 15 Sekunden. Ausschließlich HTTP 2xx gilt als Annahme durch Resend. Provider-Response-Bodies und Provider-IDs werden weder persistiert noch geloggt oder in der Function-Response ausgegeben.

## Feste M150-Templates

F1.6B kennt exakt drei deutschsprachige Templates:

- `RECEIPT`: bestätigt nur den Eingang des Mitgliedsantrags und die folgende Prüfung durch den Vorstand. Die Mail behauptet weder eine bestehende Mitgliedschaft noch Portalzugang oder Zahlung.
- `REJECTION`: informiert freundlich und neutral, dass der Antrag nicht angenommen wurde. Nur dieses Template darf die optionale Applicant Notice als zusätzliche Mitteilung enthalten. Der interne Ablehnungsgrund, Votes, Vorstandsdaten und Auditdaten werden niemals extern verwendet.
- `ADMISSION`: heißt die Person erst nach dem bereits von F1.6A geclaimten ADMISSION-Ereignis im Fanclub willkommen. Die Edge Function leitet oder entscheidet diesen Status nicht selbst.

Jede Mail enthält semantisch gleiches Plain Text und schlichtes HTML. `firstName` und die optionale Applicant Notice werden vor der HTML-Ausgabe escaped; Zeilenumbrüche der Applicant Notice werden kontrolliert dargestellt. Es gibt kein ungefiltertes HTML, keine Skripte, keine Remote Assets und keinen selbst implementierten Trackingcode.

Keine E-Mail erzeugt Portalzugang, Rollen, Ämter, Mitgliedsnummern oder Finance-, Beitrags-, Zahlungs- und SEPA-Aussagen.

## Datenschutz und ausgeschlossene Transportwege

Die Implementierung schreibt keine PII-Logs. Insbesondere werden `recipientEmail`, `firstName`, Applicant Notice und Mailinhalte nicht geloggt. Responses enthalten nur technische Summen oder eine generische Fehlermeldung; Claim-Tokens, Outbox-Inhalte, Provider-IDs und Secrets werden nicht ausgegeben.

Es gibt kein WordPress-Mail, kein `wp_mail()`, kein PHP-Mail und kein SMTP aus WordPress. Es gibt auch kein Browser-Mail: Portal- und Browser-Code claimt, completed oder versendet keine Ereignisse und kennt Resend sowie dessen API-Key nicht.

## Betrieb und Go-live

F1.6B erstellt keinen Cron und enthält keine environment-spezifische URL. Vor einem späteren Go-live sind außerhalb dieses Pakets noch erforderlich:

- Resend Account;
- Domain-Verifikation;
- Resend API-Key;
- verifizierte From-Adresse;
- optional Reply-To;
- Dispatch Secret mit mindestens 32 UTF-8-Bytes;
- regelmäßiger interner Aufruf der Edge Function.

Dieses Paket setzt keine Remote-Secrets, erstellt keinen Resend Account, ändert kein DNS, richtet keinen Cron ein und deployt keine Edge Function. Es enthält kein PROD.

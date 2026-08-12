# M150 R1 / F1.4B – Public Membership Intake Edge Transport Security

F1.4B ergänzt ausschließlich die serverseitige Transport-Sicherheitsgrenze für den späteren öffentlichen Mitgliedsantrag. Der Gesamtpfad lautet:

`WordPress-Server → signierter HTTPS-Request → m150-membership-submit → F1.4A-Service-RPC → membership_applications`

F1.4A bleibt der führende Datenbankkern für Fachvalidierung, PENDING-Dubletten, Idempotenz, Board-Snapshot und Audit. F1.4B greift ausschließlich über `public.m150_submit_membership_application(jsonb, text)` darauf zu und führt keine direkten Tabellenoperationen aus.

## Endpoint und Authentisierung

Die Supabase Edge Function heißt exakt `m150-membership-submit` und akzeptiert ausschließlich `POST` mit `Content-Type: application/json`; ein optionaler UTF-8-Charset ist zulässig. Für diese Function ist in `supabase/config.toml` gezielt `verify_jwt = false` gesetzt, weil kein Browser- oder Portal-JWT verwendet wird. Die Authentisierung erfolgt stattdessen über einen serverseitigen HMAC-Nachweis von WordPress.

Der Request muss exakt diese drei Transportheader tragen:

- `X-M150-Timestamp`: Unix-Zeit in ganzen Dezimalsekunden
- `X-M150-Idempotency-Key`: kanonische UUID v4
- `X-M150-Signature`: 64 Zeichen lowercase Hex des HMAC-SHA256

Der Timestamp darf höchstens 300 Sekunden in der Vergangenheit oder Zukunft liegen. Der Idempotency-Key wird unverändert als `p_idempotency_key` an F1.4A weitergegeben; die Edge Function erzeugt, verändert oder hasht ihn nicht.

## Raw Body, Signatur und Größenlimit

Der tatsächlich übertragene Request-Body ist auf 16 KiB beziehungsweise 16384 Byte begrenzt. Ein vorhandener zu großer `Content-Length` wird vorab abgelehnt. Unabhängig davon liest die Function den Stream begrenzt und bricht bei Überschreitung ab. Body, Payload und personenbezogene Daten werden nicht geloggt.

Die HMAC-Prüfung findet vor `JSON.parse` statt. Die Function berechnet den SHA256 selbst über die unveränderten Raw-Body-Bytes und erzeugt daraus 64 Zeichen lowercase Hex. Die Signaturbasis besteht exakt aus Timestamp, LF, Idempotency-Key, LF und Body-Hash, ohne abschließendes LF:

```text
timestamp + "\n" + idempotencyKey + "\n" + bodyHash
```

Der HMAC verwendet SHA-256 und das ausschließlich serverseitige Secret `M150_INTAKE_HMAC_SECRET`. Das UTF-8-codierte Secret muss mindestens 32 Byte lang sein. Es gibt keinen Default und keinen Fallback. Die Signaturprüfung verwendet `crypto.subtle.importKey` und `crypto.subtle.verify`; sie erfolgt nicht über einen manuellen Stringvergleich.

## Secrets und Datenbankaufruf

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden ausschließlich aus der Supabase-Function-Umgebung gelesen. Der Service-Role-Key wird weder an WordPress noch an Browser ausgeliefert, nicht als Request-Header erwartet, nicht im Repository gespeichert und nicht geloggt. WordPress erhält später ausschließlich `M150_INTAKE_HMAC_SECRET`.

Nach erfolgreicher HMAC-Prüfung wird der Raw Body als JSON geparst und muss ein Objekt sein. Die fachliche Feldvalidierung wird nicht dupliziert, sondern bleibt in F1.4A. Die Function ruft ausschließlich folgenden REST-RPC auf:

```text
/rest/v1/rpc/m150_submit_membership_application
```

Die RPC-Parameter lauten exakt `p_payload` und `p_idempotency_key`. `public.pd_api`, private Funktionen und Tabellen werden nicht direkt angesprochen.

## Neutrale Antworten und Anti-Enumeration

Neuanlage, erkannte PENDING-Dublette und identischer Idempotency-Retry erhalten öffentlich dieselbe Antwort:

```json
{
  "ok": true,
  "message": "Der Antrag wurde entgegengenommen."
}
```

Interne Felder wie `applicationId`, `created`, Duplicate-Signale, Mitglieds-/Portalhinweise, Status oder Board-Daten werden nicht veröffentlicht. Öffentliche Fehler enthalten unabhängig von der internen Ursache nur:

```json
{
  "ok": false,
  "message": "Die Anfrage konnte nicht verarbeitet werden."
}
```

Die Statusklassen bleiben getrennt: `405` für falsche Methoden, `413` für einen zu großen Body, `401` für ungültige Transportauthentisierung oder ein überschrittenes Replay-Fenster, `400` für formale Eingabefehler sowie intern als Eingabefehler klassifizierte F1.4A-Fehler und `500` für Konfigurations-, Board-, RPC- oder unerwartete interne Fehler. SQLSTATE, PostgREST-Details, DB-Fehlermeldungen, Stacktraces und F1.4A-Fehlercodes erscheinen nie in der Response.

Die Function setzt keinen CORS-Browservertrag und loggt weder PII noch Raw Body, Payload, Signatur, HMAC-Secret, Service-Role-Key oder vollständige Fehlerobjekte.

## Verbindliche spätere WordPress-Signatur für F1.5

WordPress muss exakt dieselben Raw-JSON-Bytes signieren, die anschließend gesendet werden. Es darf zwischen Signatur und Versand keine erneute JSON-Serialisierung geben.

```text
bodyHash =
lowercase_hex(
  SHA256(rawJsonBodyBytes)
)

signatureBase =
timestamp
+ "\n"
+ idempotencyKey
+ "\n"
+ bodyHash

signature =
lowercase_hex(
  HMAC_SHA256(
    key = M150_INTAKE_HMAC_SECRET,
    data = UTF8(signatureBase)
  )
)
```

## Abgrenzung

F1.4B implementiert kein WordPress-Plugin, kein Formular, kein Browser-JavaScript, kein Turnstile und kein Rate Limit; Abuse-Schutz und öffentliche Einbindung folgen in F1.5. Ebenso entstehen keine automatische Mitgliedschaft, kein Portalzugang und keine Finance-, Beitrags-, Zahlungs- oder SEPA-Daten. E-Mail, PDF und Retention sind nicht Teil von F1.4B.

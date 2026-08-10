# M150-R1 / F1.5A – WordPress Public Membership Form Core

## Zweck und Architektur

F1.5A stellt den öffentlichen WordPress-Plugin-Core für den Mitgliedsantrag bereit. Der verbindliche Pfad ist:

`Browser → WordPress-Plugin → serverseitige Turnstile-Prüfung → HMAC-signierter Raw-JSON-Request → m150-membership-submit → F1.4A → membership_applications`

WordPress ist ausschließlich UI- und Transportschicht. Der eingefrorene F1.4A-DB-Core bleibt für die fachliche Annahme führend; F1.4B bleibt die serverseitige Edge-Transportgrenze. Das Plugin führt keine dauerhafte WordPress-Antragsspeicherung ein und legt weder Antragstabellen noch Antragsposts, Meta-Daten, Cookies oder Browser-Speicher für Formulardaten an.

## Plugin und Shortcode

Der Pluginpfad lautet:

`wordpress/plugins/plaerrdeifl-m150-membership/`

Das Plugin rendert das Formular ausschließlich über:

`[plaerrdeifl_mitglied_werden]`

Es erstellt keine Seite, ändert kein Theme und wird durch F1.5A weder installiert noch aktiviert. Public-JavaScript und -CSS werden erst beim Rendern des Shortcodes eingebunden. Der Browser sendet ausschließlich an die WordPress-REST-Route `POST /wp-json/plaerrdeifl/v1/m150-membership-application` und kennt den Edge-Endpunkt nicht als nutzbaren Browser-Endpunkt.

## Dokumente und Einstellungen

Die Adminseite „Mitglied werden – Dokumente & Einstellungen“ ist nur mit `manage_options` zugänglich. Sie verwendet die WordPress Settings API, Nonce- und Capability-Prüfung sowie `wp.media`. Medienbibliothek und Admin-JavaScript werden nur auf dieser Adminseite geladen.

Alle öffentlichen und fachlichen Werte liegen in genau einer Option:

`plaerrdeifl_m150_settings`

Zulässige Schlüssel sind ausschließlich:

- `privacy_page_id`
- `statutes_attachment_id`
- `minor_form_attachment_id`
- `declaration_version`
- `statutes_version`
- `statutes_reference`

Die Satzung und der Papierantrag für Minderjährige werden über die WordPress-Mediathek ausgewählt. Serverseitig werden nur existierende Attachments mit MIME-Typ `application/pdf` akzeptiert. Gespeichert wird jeweils nur die Attachment-ID; die öffentliche URL wird bei der Ausgabe dynamisch mit WordPress aufgelöst und sicher escaped.

„PDF ersetzen“ bedeutet, eine neue PDF hochzuladen oder eine andere vorhandene PDF auszuwählen und deren Attachment-ID zu speichern. Das Plugin überschreibt keine Binärdatei eines bestehenden Attachments.

Datenschutz ist kein Upload und keine freie externe URL. Der Admin wählt eine vorhandene, veröffentlichte WordPress-Seite. Gespeichert wird nur deren Seiten-ID; der öffentliche Link wird dynamisch über `get_permalink()` erzeugt.

## Fachliche Versionierung

`declaration_version`, `statutes_version` und `statutes_reference` werden im Admin gepflegt, serverseitig getrimmt, als reiner Text bereinigt und längenbegrenzt. Sie sind Pflichtwerte für den digitalen Submit.

Der Browser bestätigt nur `declarationConfirmed` und `statutesConfirmed`. Die zugehörigen Versions- und Referenzwerte werden beim Submit ausschließlich aus der aktuellen serverseitigen Option in den Edge-Payload übernommen. Ein Antrag speichert daher die zum Submit-Zeitpunkt konfigurierte Version. Spätere Änderungen einer PDF, einer Attachment-ID oder eines Versionswerts verändern bereits eingegangene Supabase-Anträge nicht.

## Öffentliche Dokumente und Erklärungen

Das Formular verlinkt die konfigurierte Datenschutzseite, die Satzungs-PDF und – sofern vorhanden – den Papierantrag für Minderjährige. Der Datenschutzhinweis ist Information und keine allgemeine Pflichtcheckbox.

Getrennt verpflichtend bestätigt werden:

- der Antrag auf Aufnahme mit dem Hinweis, dass der Vorstand entscheidet und durch Absenden noch keine Mitgliedschaft entsteht;
- die Satzung als Grundlage des Aufnahmeantrags.

F1.5A behauptet nicht, dass die digitale Erklärung eine handschriftliche Unterschrift ersetzt.

## Öffentliche Eingabe und Volljährigkeit

WordPress akzeptiert nur die vereinbarten Personen-, Kontakt- und Adressfelder, die optionale Nachricht, beide Bestätigungen und `cf-turnstile-response`. Unbekannte Felder werden abgelehnt. Attachment-IDs, URLs und fachliche Versionen werden nicht aus dem Browser akzeptiert. Typen, Pflichtfelder, Längen, E-Mail, Datum und Bestätigungen werden serverseitig geprüft; F1.4A prüft zusätzlich authoritative.

Der digitale Antrag ist ausschließlich für Volljährige vorgesehen. Die Serverprüfung verwendet den echten Kalendertag in `Europe/Berlin` und den achtzehnten Geburtstag, keine 365-Tage-Näherung. Bei Minderjährigen erfolgen kein Edge- oder Supabase-Aufruf und keine Antragsspeicherung. Ist ein gültiger Minderjährigen-Papierantrag konfiguriert, wird dessen öffentlicher Link angeboten. Fehlt er, erscheint nur der neutrale Hinweis, dass der Papierweg aktuell nicht online bereitgestellt werden kann. Das fehlende Minderjährigen-PDF blockiert den digitalen Erwachsenen-Submit nicht.

## Fail-closed Konfiguration

Der digitale Submit ist nur verfügbar, wenn folgende serverseitige WordPress-Konstanten gültig gesetzt sind:

- `PD_M150_EDGE_URL`
- `PD_M150_INTAKE_HMAC_SECRET`
- `PD_M150_TURNSTILE_SITE_KEY`
- `PD_M150_TURNSTILE_SECRET_KEY`

Zusätzlich müssen eine veröffentlichte Datenschutzseite, ein gültiges Satzungs-PDF sowie alle drei Versions-/Referenzwerte konfiguriert sein. Bei unvollständiger Konfiguration erfolgt kein Edge-Aufruf; öffentlich wird nur eine neutrale technische Nichtverfügbarkeitsmeldung gezeigt.

Der Turnstile-Sitekey darf im Formular erscheinen. HMAC-Secret und Turnstile-Secret bleiben ausschließlich serverseitig. Die Edge-URL wird nicht als Browser-Endpunkt exponiert. In der Admin-Option werden keine Konstanten, Secrets oder Infrastruktur-URLs gespeichert. Die früheren Konstanten für Dokument-URLs und Versionen werden nicht verwendet.

## Turnstile

Das öffentliche Widget verwendet die Action `m150_membership_application`. Der Browser liefert das Token als `cf-turnstile-response`; das Secret erscheint nie in HTML oder JavaScript.

Vor jedem Edge-Aufruf prüft WordPress das maximal 2048 Zeichen lange Token über Cloudflare Siteverify. Übermittelt werden ausschließlich `secret`, `response` und `idempotency_key`; `remoteip` wird nicht gesendet. Erfolg setzt gleichzeitig voraus:

- `success === true`
- Action exakt `m150_membership_application`
- Hostname exakt gleich dem Host von `home_url()`

Nur bei einem reinen Siteverify-Transportfehler erfolgt höchstens ein unmittelbarer Retry. Beide Versuche verwenden dieselbe serverseitig erzeugte UUID als Siteverify-Idempotency-Key. Nach einem endgültigen Fehler erfolgt kein Edge-Aufruf; der Browser setzt das Widget für einen neuen Versuch zurück.

## Rate Limit

Das Plugin erlaubt standardmäßig sechs Submit-Versuche je 15 Minuten und technischer Quelladresse. Es verwendet ausschließlich `REMOTE_ADDR` und vertraut keinem `X-Forwarded-For`-Header. Der Transient-Schlüssel wird mit HMAC-SHA256 aus Quelladresse und WordPress-Salt abgeleitet. Gespeichert werden nur Zähler und kurze TTL, niemals rohe IP oder Formulardaten. Bei Erreichen des Limits antwortet WordPress mit HTTP 429 und neutraler Meldung.

## HMAC, Raw JSON und Idempotency

Nach erfolgreicher Validierung erzeugt WordPress mit `wp_generate_uuid4()` den Edge-Idempotency-Key. Er wird nicht vom Browser übernommen und nicht aus PII abgeleitet.

Der Edge-Payload enthält ausschließlich die vereinbarten F1.4A-Felder. Das Turnstile-Token wird nicht an die Edge Function weitergegeben. WordPress erzeugt den Raw-JSON-String genau einmal mit `wp_json_encode()` und verwendet danach exakt diesen String für Hash, Signatur und HTTP-Body:

```text
bodyHash = hash('sha256', rawJson)
timestamp = (string) time()
signatureBase = timestamp + "\n" + idempotencyKey + "\n" + bodyHash
signature = hash_hmac('sha256', signatureBase, PD_M150_INTAKE_HMAC_SECRET)
```

Gesendet werden `Content-Type: application/json` sowie `X-M150-Timestamp`, `X-M150-Idempotency-Key` und `X-M150-Signature`. Bei Transportfehler oder HTTP 5xx erfolgt höchstens ein unmittelbarer Edge-Retry. Der Retry verwendet unverändert denselben Raw Body, Idempotency-Key, Timestamp und dieselbe Signatur.

Der Supabase-Service-Role-Key bleibt ausschließlich in der Edge-Umgebung. WordPress erhält und verwendet keinen Service-Role-Key.

## Antworten, Datenschutz und Abgrenzung

Nur Edge-HTTP 200 mit JSON `ok === true` bestätigt die Annahme. Öffentlich lautet die neutrale Erfolgsmeldung: „Dein Mitgliedsantrag wurde entgegengenommen.“ IDs, Duplicate-Informationen oder interne Zustände werden nicht ausgegeben. Edge-, Supabase-, SQL- und `M150_*`-Fehler werden nicht weitergereicht. Öffentliche Fehler bleiben in den neutralen Kategorien Eingabe, Sicherheitsprüfung, Rate Limit, technische Nichtverfügbarkeit und Minderjährigen-Papierweg.

Das Plugin loggt weder PII noch Raw Body, Turnstile-Token oder Secrets. Es implementiert keine automatische Mitgliedschaft, keinen Portalzugang, kein Finance/SEPA, keine E-Mail, keine PDF-Erzeugung und keine Retention.

## Go-live-Blocker

1. Der konfigurierte Minderjährigen-Papierantrag muss vor dem öffentlichen Go-live fachlich korrigiert und freigegeben sein und die erforderliche Unterschrift einer sorgeberechtigten Person vorsehen. F1.5A nimmt keine fachliche Freigabe des aktuellen PDFs vor.
2. Satzungs-PDF und Datenschutzseite müssen vor Go-live final konfiguriert sein.
3. Die Werte für Erklärungsversion, Satzungsversion und Satzungsreferenz müssen vor Go-live fachlich gesetzt sein.
4. F1.5A trifft keine rechtliche Aussage dazu, ob der digitale Antrag allein die satzungsrechtlich verlangte Schriftform erfüllt.

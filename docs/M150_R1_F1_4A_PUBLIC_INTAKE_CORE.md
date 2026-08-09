# M150 R1 / F1.4A – Public Membership Intake Database Core

F1.4A implementiert ausschließlich den serverseitigen Datenbankkern für einen späteren öffentlichen Mitgliedsantrag. Es gibt in diesem Schritt noch keinen öffentlichen HTTP-Endpunkt. WordPress, Supabase Edge Function, HMAC, CORS, Turnstile, Rate Limiting und das öffentliche Formular folgen nicht in F1.4A.

## Sicherheitsgrenze

Der enge Wrapper `public.m150_submit_membership_application(jsonb, text)` ist ausschließlich für `service_role` ausführbar. `PUBLIC`, `anon` und `authenticated` besitzen kein Execute-Recht. Der Wrapper enthält keine parallele Fachlogik, sondern delegiert an `app_private.m150_submit_membership_application(jsonb, text)`. Die private Intake-Funktion und die beteiligten Tabellen sind auch für `service_role` nicht direkt ausführbar beziehungsweise zugänglich. `public.pd_api` bleibt unverändert.

## Payload und Validierung

Die Payload-Whitelist erlaubt ausschließlich:

- `firstName`, `lastName`, `birthDate`, `email`, `phone`
- `street`, `houseNumber`, `postalCode`, `city`
- optional `applicantMessage`
- `declarationConfirmed`, `declarationVersion`
- `statutesConfirmed`, `statutesVersion`, `statutesReference`

Unbekannte Schlüssel und fehlende Pflichtfelder werden abgelehnt. Supabase validiert Typen, Pflichtbestätigungen, E-Mail-Struktur und die bereits durch M150 festgelegten Längengrenzen erneut. Der Antragsteller muss am serverseitigen Kalendertag in `Europe/Berlin` mindestens 18 Jahre alt sein. Die Prüfung verwendet echte Kalenderjahre; zukünftige Geburtsdaten sind unzulässig. Validierung und Altersprüfung erfolgen vor jeder dauerhaften Intake-Speicherung.

Der Eingangszeitpunkt wird nicht aus der Payload übernommen. `submitted_at` entsteht ausschließlich serverseitig über den bestehenden Tabellenvertrag. Ein neuer Antrag wird immer als `PENDING` angelegt.

## Board-Snapshot und Duplicate-PENDING

Vor einer Neuanlage muss der bestehende dynamische M150-Board-Resolver exakt fünf unterschiedliche digitale Amtsbesetzungen liefern. Der vorhandene F1.2A-Insert-Trigger erzeugt anschließend in derselben Transaktion den unveränderbaren Board-Snapshot. Es gibt keine zweite Board-Definition, keine festen Nutzer-IDs und keinen Admin- oder Capability-Fallback.

Ein vorhandener `PENDING`-Antrag verhindert eine zweite Neuanlage bei gleicher normalisierter E-Mail oder gleicher normalisierter Kombination aus Vorname, Nachname und Geburtsdatum. Partielle Unique-Indizes sichern beide Regeln auch bei konkurrierenden Requests. Eine gleiche Telefonnummer allein blockiert nicht; sie bleibt lediglich ein interner Hinweis.

Matches mit aktiven oder inaktiven Mitgliedern sowie Portalusern sind kein automatischer Blocker. Es gibt kein Auto-Linking, keine Auto-Reaktivierung und kein Auto-Resolve. Ein inaktives Mitglied durchläuft weiterhin Antrag, Abstimmung und gegebenenfalls die spätere D-017-Reaktivierung.

## Technische Idempotenz

Technische Idempotenz ist von der fachlichen PENDING-Dublette getrennt. `app_private.membership_application_intake_idempotency` speichert ausschließlich den technischen Schlüssel, einen in PostgreSQL berechneten kanonischen Payload-SHA256, die Ergebnis-Antrags-ID, das Outcome und den Erstellungszeitpunkt. Formulardaten oder PII werden dort nicht gespeichert.

Ein identischer Schlüssel mit identischer Payload erzeugt weder einen zweiten Antrag noch ein zweites Audit-Event. Derselbe Schlüssel mit abweichender Payload führt intern zu `M150_IDEMPOTENCY_KEY_REUSED`. Die interne Rückgabe an den späteren Edge-Layer lautet `accepted`, `created` und `applicationId`. F1.4B neutralisiert diese internen Unterschiede später öffentlich zur Vermeidung von Enumeration.

## Audit und Abgrenzung

Nur eine tatsächliche Neuanlage erzeugt `MEMBERSHIP_APPLICATION_SUBMITTED_PUBLIC` mit null-Akteur. Die Metadaten enthalten ausschließlich die technische Quelle `WORDPRESS_PUBLIC_INTAKE` und den Status `PENDING`; Name, Kontaktdaten, Adresse, Nachricht und Geburtsdatum werden nicht ins Audit kopiert.

F1.4A erzeugt keine automatische Mitgliedschaft, keinen Portaluser, keinen Portalzugang, keine Benutzer-Mitglied-Verknüpfung, keine Rolle, kein Amt und keine Finance-, Beitrags-, Zahlungs- oder SEPA-Daten. E-Mail, PDF, Datenschutz-/Satzungsseiten, Retention-Job sowie WordPress-, Edge- und Turnstile-Funktionen sind ebenfalls nicht enthalten.

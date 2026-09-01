# M327-R1 – Fanbus-Buchungs-Selfservice

## Repository-Reconciliation

Die historische F0-Referenz ist Commit `b219e30a8eb292863b019658d1d312ed455404b7`. Der saubere aktuelle DEV-Stand wurde vor der Implementierung abgeglichen. Die bereits in DEV vorhandenen Hotfixes `20260827184505` und `20260827195421` wurden im Repository rekonstruiert und mit Commit `80355225b5b136ca477e06e08b4cd9361eca4cb9` versioniert; dieser Commit mit Tree `fc3996f9f4d6ff87050c9fa78832592e800cc050` ist die technische M327-Implementierungsbasis.

Die vier ebenfalls bereits registrierten DEV-Overlays `20260827223113`, `20260828052514`, `20260828140655` und `20260828161808` wurden byteidentisch aus `supabase/dev-overlays` in die reguläre Migrationskette übernommen. Dadurch ist die Repository-Historie wieder vollständig; die Übernahme verändert den bestehenden DEV-Datenbankzustand nicht. Ein frischer lokaler Aufbau bis einschließlich M327 sowie der verknüpfte DEV-Dry-Run wurden mit dieser vollständigen Kette validiert.

## Vertrag

Diese Umsetzung folgt Master-Entscheidung D-076. Sie erweitert den vorhandenen Bereich `Fanbus` um `Meine Buchungen`; es gibt keinen neuen Hauptmenüpunkt und keinen Gast-Selfservice.

Der Actor wird ausschließlich serverseitig über `auth.uid()` und `app_private.require_active_user()` ermittelt. Creator-Rechte entstehen nur bei `fanbus_bookings.source = 'PORTAL'` zusammen mit `fanbus_bookings.created_by = actor`. Eine eigene Teilnahme wird ausschließlich über `fanbus_registrations.portal_user_id = actor` bestimmt. `PRIMARY` oder eine MANUAL-Buchung erzeugen keine Creator-Rechte. Ein inaktiver Portalaccount verliert alle Selfservice-Rechte; Creator werden nicht übertragen.

## Read und Datenschutz

`fanbus_my_bookings_list` liefert vergangene und kommende Buchungen, wenn der Actor Creator oder selbst Teilnehmer ist. Creator sehen die für die Gruppenverwaltung notwendigen Teilnehmerdaten. Non-Creator sehen ihre eigene Detailzeile; andere Teilnehmer derselben Buchung werden auf Name und Status reduziert. Technische Teilnehmer-ID und Revision dienen ausschließlich sicheren Aktionen und werden nicht als Nutzdaten dargestellt.

Die Action ist in M900 als `READ` klassifiziert. Update, Cancel und Append bleiben `USER_MUTATION`; READ_ONLY erlaubt damit die Ansicht, aber keine Mutation. MAINTENANCE folgt unverändert dem zentralen M900-Vertrag. Der nach M326/M320 erneut verkettete aktuelle Dispatcher wird in dieser Migration auf direkte aktuelle Aufrufe konsolidiert.

## Mutationen

Selfservice ist nur für `PUBLISHED` und strikt vor `departure_at - interval '72 hours'` möglich. Exakt am Cutoff sowie bei fehlender Abfahrt ist die Mutation gesperrt. `registration_closes_at` blockiert weiterhin neue öffentliche Buchungen, aber nicht die Verwaltung oder Erweiterung einer vorhandenen eigenen Buchung vor dem Cutoff.

Participant Update akzeptiert nur Teilnehmer-ID, erwartete Revision, Zustieg und Buswunsch. Lock-Reihenfolge, Ownership, Status, Cutoff und CAS sind serverautoritativ. Ein neuer Zustieg muss aktiv und mit einer vorhandenen Buszuordnung kompatibel sein. Weder Zustiegs- noch Präferenzänderung löschen oder verändern eine konkrete Buszuordnung automatisch.

Operator- und Selfservice-Cancel verwenden denselben privaten Cancel-Kernel. Der Operator-Wrapper behält `fanbus.registrations.manage`; der Selfservice-Wrapper prüft aktive Identität, Ownership, Status, Cutoff und CAS. Es gibt keine M327-Wartelistenpromotion. Ein Creator bleibt nach Stornierung der eigenen Teilnahme Creator der Buchung.

## Append

Nur der Creator einer PORTAL-Buchung darf Teilnehmer ergänzen. Alle Inserts verwenden dieselbe `booking_id`; der vorhandene `PRIMARY`, vorhandene Sequenzen, Zustiege, Präferenzen, Status, Identitäten und Buszuordnungen bleiben unverändert. Neue Teilnehmer werden unter Trip- und Booking-Lock fortlaufend als `COMPANION` nummeriert.

Erlaubte Quellen sind die private Mitfahrerliste einschließlich verknüpfter aktiver Portaluser und vorhandener Companion-Identität sowie One-off-Gäste. Die vorhandene M325 Duplicate-Preview wird in der UI wiederverwendet; die DB validiert den vollständigen Batch weiterhin abschließend. Duplicate-Konflikte rollen den gesamten Batch zurück.

Kapazität und Warteliste folgen dem vorhandenen Batch-Vertrag: Bei bestehender Warteliste oder unzureichender Gesamtkapazität wird der vollständige neue Batch WAITLISTED, sonst ACTIVE. Es gibt keinen Split und keine Änderung vorhandener ACTIVE-Teilnehmer. Ein WAITLISTED-Batch erhält einen gemeinsamen fachlichen Zeitpunkt; `participant_sequence` stabilisiert die Reihenfolge. Idempotency trennt APPEND semantisch von CREATE und bindet Key, Actor, Buchung, Fahrt, kanonischen Batch und Vertragsversion.

## Notifications und zentraler Kontakt

Ein erfolgreicher Append erzeugt genau `FANBUS_BOOKING_EXTENDED`. Die vorhandene M020-Expansion und BUS_ORGA-Recipient-Logik werden wiederverwendet; `FANBUS_BOOKING_CREATED` bleibt ausschließlich der ursprünglichen Buchung vorbehalten. Payload und interner Link enthalten Fahrt, vorhandene Buchung, Teilnehmerzahl und ACTIVE-/WAITLISTED-Ergebnis ohne unnötige PII.

`fanbus.organization_contact` ist die einzige zentrale Quelle für öffentliche BUS_ORGA-Kontaktdaten. Die dedizierte Projection `pd_public_fanbus_contact()` gibt ausschließlich validierte öffentliche E-Mail-/Telefonwerte mit optionalem Label aus; es gibt keinen generischen Settings-Read und keine Tabellenfreigabe. Gast-Erfolg und Gast-Bestätigungsmail zeigen den BUS_ORGA-Hinweis und verwenden dieselbe Projection. Ein Ladefehler kann einen erfolgreichen Gastabschluss nicht in einen Fehler verwandeln.

## Sicherheit und Audit

Fanbus-Tabellen bleiben RLS-geschützt und ohne direkte Browser-Grants. Browsermutationen laufen nur über `public.pd_api`; private Funktionen verwenden leere `search_path`-Konfigurationen. SECURITY-DEFINER-Funktionen prüfen Ownership explizit und verlassen sich dafür nicht auf RLS. Fremde oder nicht vorhandene Teilnehmer-/Buchungs-IDs liefern nach außen denselben `NOT_FOUND`-Vertrag. Participant-Mutationen verwenden Lock plus `revision`-CAS.

Audit-Events sind `SELF_SERVICE_PARTICIPANT_UPDATED`, `SELF_SERVICE_PARTICIPANT_CANCELLED` und `SELF_SERVICE_PARTICIPANT_ADDED`. Sie enthalten Actor, Trip, Booking, Participant und notwendige technische Vorher-/Nachher-Werte, aber keine duplizierten Namen, E-Mail-Adressen oder Telefonnummern.

## Tests und DEV-E2E

- `supabase/tests/m327_r1.sql`: Ownership A–I, Konflikte A–R, 72h-Grenzen, registration-close-Ausnahme, Append-/Idempotency-/Capacity-/Waitlist-/Notification-/Contact-/Security-Verträge.
- `tests/run-m327-concurrency.sh`: C1 parallele Appends und C2 Selfservice-/BUS_ORGA-CAS-Rennen in einer isolierten Datenbankkopie.
- `tests/m327_r1_contract.test.mjs`: Migration, API, M900, M020, Contact und responsive Frontend-Verträge.
- Relevante M020-, M320-, M320-R3-, M325-, M326-, M330- und M900-Suites werden isoliert ausgeführt; Fixture-Dateien mit Parallelrunnern werden nicht als unverbundene Sammelsuite interpretiert.
- Mobile Verträge prüfen Karten, lange Inhalte, Dialoge, Contact/Cutoff/Waitlist und horizontale Überläufe. Eine praktische authentifizierte Browserprüfung benötigt eine vorhandene DEV-Sitzung; ohne Sitzung bleibt sie auf öffentliche/mobile Oberflächen und automatisierte Verträge begrenzt.

## Nicht enthalten

Kein Gast-Selfservice, Magic Link, Token, freie Portalusersuche, Creator-Transfer, Payment, Check-in, User-Buszuordnung, M320-Preview/Apply aus Selfservice, Reoptimierung, neue Notification-Pipeline, WordPress-Kontaktkonfiguration oder PROD-Änderung.

`M327_R1_PROD_TOUCHED = NO`

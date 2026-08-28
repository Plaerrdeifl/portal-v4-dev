# M320-R3 – Completion Report

## Status

`M320_R3_IMPLEMENTATION_COMPLETE = JA`

`M320_R3_SCOPE_FREEZE_STATUS = FINAL`

`M320_R3_MASTER_DECISIONS_OPEN = 0`

## Umsetzung

M320-R3 ergänzt die bestehende Fanbus-Domäne um eine serverautoritativ geplante automatische Buszuordnung mit getrenntem Preview-/Apply-Vertrag.

Kernbestandteile:

- additive automatische Zuordnungsplanung für unzugeordnete `ACTIVE`-Teilnehmer,
- deterministische Preview mit Fingerprint,
- serverseitiger Stale-Schutz beim Apply,
- Schutz vorhandener Zuordnungen,
- harte Kapazitäts- und Zustiegskompatibilität,
- Präferenzbehandlung `EGAL | RUHIG | PARTY`,
- nachvollziehbare Warnungen und Erklärungen,
- `assignment_source = MANUAL | AUTO`,
- kompakte mobile Preview-/Apply-UI im bestehenden Teilnehmer-Workflow,
- sofortiger Teilnehmer-Refresh nach Apply,
- korrekter UI-Reset nach Schließen der Preview.

Die Umsetzung bleibt innerhalb der bestehenden M010-/`pd_api`-Autorisierungsgrenze und führt kein paralleles Berechtigungsmodell ein.

## Preview-/Apply-Vertrag

Preview ist eine nicht mutierende Planung. Sie liefert Vorschläge, Konflikte, Kapazitätsinformationen und einen Fingerprint über die für die Entscheidung relevanten Zustände.

Apply:

- übernimmt nur eine noch aktuelle Vorschau,
- sperrt und validiert serverseitig erneut,
- akzeptiert keinen vertrauenswürdigen `assignment_source` vom Client,
- prüft Busstatus, Kapazität und Stop-Kompatibilität erneut,
- schützt bestehende Zuordnungen,
- verwirft bei Topologie-/Teilnehmer-/Zuordnungsänderungen eine stale Preview.

## Konflikt- und Sicherheitsregeln

- Kein kompatibler Bus für den Zustieg: keine automatische Zuordnung.
- Keine freie gültige Kapazität: keine automatische Zuordnung.
- Bestehende ungültige oder stop-inkompatible Zuordnung: blockierender Konflikt statt stiller Umhängung.
- Bereits bestehende MANUAL/AUTO-Zuordnungen werden in R1 nicht automatisch reoptimiert.
- CANCELLED bleibt über den bestehenden M330-Vertrag geschützt.
- Browserrollen erhalten keinen direkten Tabellenzugriff auf private Planungs-/Mutationslogik.

## D-072

Die Herkunft einer Zuordnung ist fachlich eingefroren:

1. `assignment_source` ist `MANUAL` oder `AUTO`.
2. Vorbestehende Zeilen sind `MANUAL`.
3. Manuelle Set-/Change-Aktionen erzeugen `MANUAL`.
4. Unveränderte Preview-Vorschläge werden beim Apply `AUTO`.
5. Busorga-Änderung eines Preview-Vorschlags führt zu `MANUAL`.
6. Clientwerte für `assignment_source` sind nicht autoritativ.
7. R1 verschiebt bestehende Zuordnungen nicht automatisch.
8. Nur unzugeordnete, zuordenbare `ACTIVE`-Teilnehmer werden geplant.
9. Eine spätere Reoptimierung bestehender AUTO-Zuordnungen ist nicht Bestandteil von R1.

## Abnahmebegleitende DEV-Erweiterungen

Im selben Fachentwicklungsblock wurden zwei angrenzende, praktisch abgenommene DEV-Erweiterungen ergänzt:

### Persönlicher Busstandard

- Portaluser kann einen persönlichen Standard `EGAL | RUHIG | PARTY` speichern.
- Bei wirksamer Buswahl wird der Standard vorausgewählt.
- Fahrtspezifischer Override verändert den persönlichen Standard nicht.
- Bei deaktivierter Buswahl ist der konkrete Registrierungswert effektiv `EGAL` und der persönliche Standard bleibt ohne sichtbare Abweichungswirkung.

DEV-Overlay:

`supabase/dev-overlays/20260828_fanbus_user_default_bus_preference.sql`

DEV-Migration:

`20260828140655_fanbus_user_default_bus_preference`

### Manuelle Voranmeldung vor öffentlicher Öffnung

- MANUAL darf auf vollständigen `DRAFT`- oder `PUBLISHED`-Fahrten vor `registration_opens_at` anmelden.
- Öffentlicher PORTAL-/GUEST-Vertrag bleibt unverändert.
- Anmeldeschluss sowie CLOSED/CANCELLED bleiben gesperrt.

DEV-Overlay:

`supabase/dev-overlays/20260828_m326_manual_registration_before_public_open.sql`

DEV-Migration:

`20260828161808_m326_manual_registration_before_public_open`

## Kernmigrationen M320-R3 in DEV

- `20260827203217_m320_r3_auto_bus_assignment`
- `20260827203255_m320_r3_planner_greatest_fix`

Beide sind in DEV registriert.

## UX

- vorhandene Portal-Dialog-/Form-/Buttonmuster werden wiederverwendet,
- mobile-first und kompakte Informationsdichte,
- keine neue Navigationsebene,
- automatische Zuordnung bleibt im Teilnehmer-/Belegungsworkflow,
- bestehende Zuordnungen werden als geschützt dargestellt,
- Preview ist vor Apply sichtbar und bewusst bestätigungspflichtig.

## Tests und Abnahme

Vollständige Code-Quality-Basis vor Abschlussdokumentation:

- `c4c64fccbfc25ae5efc2af595a72c13910aeaf51`
- `V4 Core quality` Run #501 / ID `33188872584`: PASS
- 699/699 Node-Vertragstests PASS
- Static Check PASS
- JavaScript-Syntax PASS

Praktische Nutzerabnahme einschließlich Preview, Apply, Refresh, Preview-Close, persönlicher Vorauswahl/Override und manueller Voranmeldung: ACCEPTED.

Haltestellen-Kompatibilität wurde zusätzlich anhand Implementierung und vorhandener Verträge belastbar bestätigt.

## Bewusst nicht umgesetzt

- automatische Reoptimierung bereits bestehender AUTO-Zuordnungen,
- Sitzplan/Sitzplatzreservierung,
- garantierte Präferenzerfüllung,
- neue Rechtearchitektur,
- flexible wechselnde Gruppenbindung als unteilbarer Busblock,
- M020/D-073-Erweiterungen außerhalb des freigegebenen R3-Scopes.

## Release-Hinweis

Die beiden unter `supabase/dev-overlays/` liegenden, in DEV angewendeten Erweiterungen dürfen beim gemeinsamen PROD-Release nicht als DEV-Sonderzustand vergessen werden. Der Projekt-Master muss sie vor PROD in die reguläre, geordnete PROD-Migrationskette integrieren bzw. mit dem finalen Releasepaket reconciliieren.

PROD wurde in diesem Arbeitsblock nicht verändert.

## Ergebnis

`M320_R3_COMPLETION = ACCEPTED`

`M320_R3_READY_FOR_DEV_RC = JA`

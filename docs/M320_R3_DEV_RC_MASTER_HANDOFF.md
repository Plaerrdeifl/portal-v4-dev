# P300 / M320-R3 – DEV-RC & Rückgabe an Projekt-Master

## Übergabestatus

`M320_R3_DEV_RC = ACCEPTED`

`M320_R3_HANDOFF_TO_MASTER = READY`

`M320_R3_OPEN_BLOCKERS = 0`

Arbeitsblock: **M320-R3 – Automatische Buszuordnung**

PROD wurde nicht verändert.

## Referenzstände

- letzte fachliche Code-Basis vor Abschlussdokumentation: `c4c64fccbfc25ae5efc2af595a72c13910aeaf51`
- Acceptance-Dokumentation: Commit `ecffbdc17345231b45243ab4952c5bc57acdca1c`
- Completion Report: Commit `0e0738c9f9d65b5f9e83b4839f15ad5b68649905`
- letzter vollständiger Code-Quality-Lauf auf der Code-Basis: `V4 Core quality` Run #501 / ID `33188872584` – PASS
- 699/699 Vertragstests PASS
- Static Check PASS
- JavaScript-Syntax PASS

Die nachfolgenden Abschlussdokumentations-Commits sind dokumentations-only; der finale Main-Quality-Status ist vor Release erneut zu prüfen.

## Fachlicher Abschluss

M320-R3 ist für DEV-RC abgenommen:

- automatische Buszuordnung mit Preview/Apply,
- serverautoritatives Apply und Stale-Schutz,
- harte Kapazitäts- und Zustiegskompatibilität,
- Präferenzlogik `EGAL | RUHIG | PARTY`,
- geschützte bestehende Zuordnungen,
- D-072 `MANUAL | AUTO`,
- kompakte mobile Preview-UX,
- Teilnehmerrefresh nach Apply,
- sauberer Preview-Close-/Reopen-Zustand.

Praktische Nutzerabnahme ist abgeschlossen.

## Zusätzliche im Block abgenommene DEV-Erweiterungen

### Persönlicher Busstandard

Praktisch bestätigt: persönliche Vorauswahl funktioniert, fahrtspezifischer Override funktioniert, persönlicher Standard bleibt unverändert; deaktivierte Buswahl bleibt effektiv `EGAL`.

DEV-Overlay:

`supabase/dev-overlays/20260828_fanbus_user_default_bus_preference.sql`

DEV-Migration:

`20260828140655_fanbus_user_default_bus_preference`

### Manuelle Voranmeldung vor öffentlichem Start

Praktisch bestätigt: Busorga kann auf vollständiger DRAFT/PUBLISHED-Fahrt vor öffentlichem Öffnungszeitpunkt manuell anmelden; PORTAL/GUEST bleiben am öffentlichen Fenster; Close/CANCELLED bleiben geschützt.

DEV-Overlay:

`supabase/dev-overlays/20260828_m326_manual_registration_before_public_open.sql`

DEV-Migration:

`20260828161808_m326_manual_registration_before_public_open`

## DEV-Datenbankstand für M320-R3

Registrierte Kernmigrationen:

- `20260827203217_m320_r3_auto_bus_assignment`
- `20260827203255_m320_r3_planner_greatest_fix`

Relevante angrenzende DEV-Migrationen:

- `20260828140655_fanbus_user_default_bus_preference`
- `20260828161808_m326_manual_registration_before_public_open`

Weitere M326-DEV-Overlays existieren separat und sind im gemeinsamen Releasekontext ebenfalls über die jeweilige Modulübergabe zu behandeln.

## Testdatenstatus

M320-Abnahmedaten wurden nach erfolgreicher Abnahme bereinigt.

- Landsberg ist auf die ursprüngliche Test-/Arbeitskonfiguration zurückgestellt: 5 ursprüngliche aktive Teilnehmer, Buswahl aus, Bus1 NORMAL/54 aktiv, Bus2 NORMAL/46 inaktiv, temporärer Bus3 entfernt.
- Dingolfing 25.10. ist wieder DRAFT, Buswahl aus, Bus1 NORMAL/54 aktiv, Bus2 NORMAL/48 inaktiv; M320-Abnahmeanmeldungen entfernt.
- temporäre M320-Testmitglieder, Testgruppe und Test-Stammfahrer entfernt.
- persönliche Portaluser-Standards wurden nicht als Testmüll gelöscht.

## Bewusst verschobener Punkt

**Flexible wechselnde Gruppenbindung für Mehrbusfahrten** ist ausdrücklich kein M320-R3-/V4-Blocker.

Spätere Fachoption: frei definierbare Gruppe als unteilbarer Busblock inklusive Wartelisten-, Konflikt- und manueller Override-Regeln. Begründung für Verschiebung: Mehrbusfahrten sind aktuell selten; der Zusatzscope steht nicht im Verhältnis zum aktuellen Nutzen.

## Release-/Master-Aufgaben

Der Projekt-Master übernimmt ab hier:

1. M320-R3 als DEV-RC in die gemeinsame Releaseplanung aufnehmen.
2. P800-R2, M326-R1 und M320-R3 als gemeinsames Fanbus-Releasepaket betrachten.
3. DEV-Overlays vor PROD in eine reguläre geordnete Migrationskette reconciliieren; insbesondere persönlicher Busstandard und manuelle Voranmeldung dürfen nicht nur als DEV-Sonderzustand bestehen bleiben.
4. Bekannte PROD-Abweichungen nach dem früheren R4-Freeze vor dem gemeinsamen Release gegen den tatsächlichen PROD-Runtime-Stand reconciliieren (post-freeze Emergency-Overlays nicht überschreiben oder verlieren).
5. Erst nach separater PROD-Freigabe: PROD-Migration/Deployment durchführen.
6. Danach vollständige PROD-Regression des gemeinsamen Releasepakets.

## Nicht durch diese Übergabe freigegeben

- kein PROD-Deployment,
- keine PROD-Datenbankmutation,
- kein automatischer Merge DEV → PROD,
- keine neue Gruppenbindungsfunktion,
- keine automatische Reoptimierung bestehender AUTO-Zuordnungen,
- keine Sitzplatzreservierung.

## Abschluss

`M320_R3_SCOPE_FREEZE_COMPLETE = JA`

`M320_R3_DEV_E2E = ACCEPTED`

`M320_R3_USER_ACCEPTANCE = ACCEPTED`

`M320_R3_DEV_RC = ACCEPTED`

`M320_R3_RETURN_TO_PROJECT_MASTER = JA`

# M320-R3 – DEV Acceptance

## Status

`M320_R3_DEV_ACCEPTANCE = ACCEPTED`

M320-R3 – Automatische Buszuordnung ist in DEV fachlich und technisch abgenommen. PROD wurde nicht verändert.

## Praktisch abgenommene Kernfälle

- Automatische Zuordnung erzeugt eine Preview vor Apply.
- Präferenzfall RUHIG mit ausschließlich freier PARTY-Kapazität schlägt den gültigen Fallback vor.
- Apply übernimmt den unveränderten Preview-Vorschlag mit `assignment_source = AUTO`.
- Nach Apply wird die Teilnehmeransicht unmittelbar mit der neuen Buszuordnung aktualisiert.
- Schließen der Preview setzt den Einstieg zur automatischen Zuordnung zuverlässig zurück; erneutes Öffnen funktioniert.
- Bereits bestehende Zuordnungen bleiben geschützt und werden in R1 nicht automatisch reoptimiert.
- Fahrtenliste ist nach Lifecycle gruppiert: aktive, geplante sowie vergangene/abgesagte Fahrten.

## Persönliche Busstandards / Registrierung

Die im Abnahmeblock ergänzte persönliche Buspräferenz ist praktisch bestätigt:

- Portaluser-Standard `RUHIG` wird bei einer Fahrt mit aktivierter Buswahl automatisch vorausgewählt.
- Fahrtspezifischer Override auf `PARTY` wird in der konkreten Anmeldung gespeichert.
- Der persönliche Standard bleibt nach diesem Override unverändert `RUHIG`.
- Bei Fahrten ohne wirksame Buswahl bleibt die konkrete Anmeldung effektiv `EGAL`; der persönliche Standard wird weder angezeigt noch für M320 wirksam.

## Manuelle Voranmeldung durch Busorga

Praktisch bestätigt:

- Interne manuelle Anmeldung ist auf vollständigen `DRAFT`- oder `PUBLISHED`-Fahrten vor öffentlichem Anmeldebeginn möglich.
- Nur die öffentliche Öffnungszeit wird für `MANUAL` übergangen.
- Anmeldeschluss bleibt verbindlich.
- `CLOSED` bleibt gesperrt.
- `CANCELLED` bleibt durch den M330-Wrapper gesperrt.
- PORTAL- und GUEST-Selbstanmeldung behalten den öffentlichen Lifecycle-/Zeitvertrag.

## Haltestellen-Kompatibilität

Für neue automatische M320-Zuordnungen ist die Zustiegskompatibilität als harte Regel abgesichert:

- Preview berücksichtigt nur Busse, die den konkreten `trip_boarding_stop_id` bedienen.
- Ohne kompatiblen Bus bleibt der Teilnehmer unzugeordnet und erhält `STOP_NO_COMPATIBLE_BUS`.
- Apply prüft die Kompatibilität erneut serverseitig.
- Ein bewusst inkompatibler Preview-Override wird mit `FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP` abgelehnt.
- Änderungen der Stop-/Bus-Topologie zwischen Preview und Apply invalidieren die Vorschau.
- Bereits vorhandene inkompatible Zuordnungen werden nicht automatisch verändert; sie erzeugen einen blockierenden Konflikt.

Ein vorhandener SQL-Vertrag bildet den Fall ab, dass ein gewünschter RUHIG-Bus den Spezialzustieg nicht bedient und deshalb nicht vorgeschlagen wird. Ein separater Browser-Laufzeittest für einen bewusst inkompatiblen UI-Override wurde für diese Revision nicht zusätzlich verlangt.

## D-072 – Assignment Origin

Verbindlich:

- `assignment_source` ist exakt `MANUAL | AUTO`.
- Vorbestehende Zuordnungen wurden als `MANUAL` übernommen.
- Manuell gesetzte/geänderte Zuordnungen sind `MANUAL`.
- Unverändert angewendete Preview-Vorschläge werden `AUTO`.
- Ändert Busorga den vorgeschlagenen Bus im Preview, wird die Zuordnung `MANUAL`.
- Der Browser kann keinen vertrauenswürdigen `assignment_source` setzen.
- R1 plant nur unzugeordnete, zuordenbare `ACTIVE`-Teilnehmer.
- `AUTO` beschreibt die Herkunft der Zuordnung, nicht eine generelle Erlaubnis zur späteren automatischen Verschiebung.

## Bewusst verschoben

**Flexible Gruppenbindung bei Mehrbusfahrten** wird nicht als V4-Blocker behandelt.

Spätere Erweiterung: wechselnde, frei definierbare Personengruppen können optional als unteilbare Busgruppe markiert werden. Dazu gehören dann auch Wartelisten-, Konflikt- und bewusste manuelle Override-Regeln. Mehrbusfahrten sind aktuell selten; diese Erweiterung bleibt daher außerhalb des eingefrorenen M320-R3-Scopes.

## DEV-Testdaten-Bereinigung

Nach der Abnahme wurden die gezielt erzeugten M320-Testdaten entfernt und die Testfahrten auf ihre Ausgangskonfiguration zurückgestellt:

- Landsberg: wieder 5 ursprüngliche aktive Teilnehmer; Buswahl aus; kein Fahrt-Defaultstop; Bus1 `NORMAL/54/aktiv`, Bus2 `NORMAL/46/inaktiv`; temporärer Bus3 entfernt.
- Dingolfing 25.10.: wieder `DRAFT`; Buswahl aus; Bus1 `NORMAL/54/aktiv`, Bus2 `NORMAL/48/inaktiv`; Abnahmeanmeldungen entfernt.
- Temporäre M320-Testmitglieder, Testgruppe und Test-Stammfahrer entfernt.
- Persönlicher Portaluser-Standard `RUHIG` blieb bewusst erhalten.

## Qualität

Letzter vollständiger Code-Quality-Stand vor Abschlussdokumentation:

- Code-Basis: `c4c64fccbfc25ae5efc2af595a72c13910aeaf51`
- GitHub Actions `V4 Core quality` Run `33188872584` / Run #501: PASS
- `npm test`: 699/699 PASS
- `npm run check:static`: PASS
- JavaScript-Syntaxprüfung: PASS

## Ergebnis

`M320_R3_USER_ACCEPTANCE = ACCEPTED`

`M320_R3_DEV_E2E = ACCEPTED`

`M320_R3_ACCEPTANCE_COMPLETE = JA`

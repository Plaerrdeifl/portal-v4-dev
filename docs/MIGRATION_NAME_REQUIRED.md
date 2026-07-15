# Migration und Datenbereinigung – AE-R7.1-01

## Vorprüfung

`m4NameIntegrityReport()` ermittelt Benutzer gesamt, aktive Benutzer, fehlende Vor-/Nachnamen, relevante unvollständige Anträge und den Schutzstatus von `U-0001` und `U-0009`.

## Zulässige Behandlung

- Benutzer ergänzt selbst beim nächsten Login.
- Admin ergänzt bestätigte Angaben.
- unvollständiger Antrag wird zur Ergänzung zurückgestellt.
- klar markierte synthetische Testdaten werden über die Testbereinigung entfernt.

## Verbote

Keine Fantasienamen, keine E-Mail-Ableitung, keine stille Rollen-/PD-ID-/Amts-/Teamänderung und keine Löschung gültiger Benutzer.

## Abschlusskriterien

Kein aktiver Benutzer und kein genehmigter/übernahmefähiger Antrag besitzt leere Namensfelder; beide Administratoren bleiben erhalten; jede Änderung ist datensparsam auditiert.

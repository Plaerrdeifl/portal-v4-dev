# M320-R2 – F1 Completion Report

## Umsetzung

- Additives, standardmäßig deaktiviertes Tripflag ergänzt.
- Fail-closed Effektivitätsresolver und feste Allowed-Liste umgesetzt.
- Effektive `EGAL`-Normalisierung im bestehenden gemeinsamen Neuregistrierungs-Insert verankert.
- Request-basierte Idempotenz und historische Teilnehmerwerte unverändert gelassen.
- `fanbus_trip_update` um sofortige Strukturvalidierung erweitert.
- `api_fanbus_bus_upsert` um transaktionales `AUTO_RESET_FALSE` erweitert.
- Public-/Internal-Snapshots sowie Public-, Companion- und Manual-New-UI angepasst.

Keine automatische Buszuordnung, neue Kategorie, Capability, Notification oder M320-R3-Funktion wurde implementiert.

## Verifikation

Die lokalen Vertrags-, Frontend-, Migrations- und Regressionsprüfungen sind im F1-Abschlussbericht mit exakten Kommandos dokumentiert. Es erfolgte keine DEV- oder PROD-Migration.

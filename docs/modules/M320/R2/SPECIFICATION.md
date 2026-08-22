# M320-R2 – Buswunsch-, Buskategorie- und Zuordnungssteuerung

## Fachgrenze

M320-R2 ergänzt die Freigabesteuerung für vorhandene Buswünsche und Kategorien. Kategorien bleiben `NORMAL`, `RUHIG`, `PARTY`; Fahrgastwünsche bleiben `EGAL`, `RUHIG`, `PARTY`. Es gibt keine automatische Zuordnung und keine zweite Konfigurationstabelle.

## Effektiver Vertrag

`fanbus_trips.bus_preference_enabled` ist für bestehende und neue Fahrten standardmäßig `false`. Der zentrale Resolver liefert Auswahl nur, wenn gleichzeitig gilt:

1. Flag `true`,
2. mindestens zwei aktive Busse,
3. mindestens ein aktiver PARTY-Bus,
4. mindestens ein aktiver RUHIG-Bus.

Dann lautet `allowedBusPreferences` exakt `["EGAL","RUHIG","PARTY"]`, sonst `[]`. Unbekannte Eingabewerte werden weiterhin abgelehnt. Bei gesperrter Auswahl wird unmittelbar vor dem gemeinsamen Insert für jede neue ACTIVE- oder WAITLISTED-Registration effektiv `EGAL` gespeichert. Der Idempotenzhash bleibt vorher auf der Benutzeranforderung aufgebaut.

## Trip- und Busmutation

`fanbus_trip_update` akzeptiert additiv `busPreferenceEnabled`. `true` wird nur bei sofort gültiger aktiver Struktur gespeichert.

`api_fanbus_bus_upsert` behält Capability, M330-Lock, CAS, Kategorie-, Capacity-, Occupancy- und Auditverträge. Wird eine zuvor wirksame Struktur durch eine erfolgreiche Busmutation ungültig, setzt `AUTO_RESET_FALSE` das Flag in derselben Transaktion auf `false`, erhöht die Triprevision, setzt `updated_by` und auditiert. Eine spätere gültige Struktur aktiviert das Flag nicht automatisch.

## Projektion und UI

Public liefert `busPreferenceSelectionEnabled` und `allowedBusPreferences`, aber keine Bustopologie. Intern kommen zusätzlich `busPreferenceEnabled` und die bestehenden Capabilityfelder unverändert mit. Ist Auswahl gesperrt, blenden Public- und Manual-New-UI den Wunsch aus und senden `EGAL`; Companiondefaults bleiben unverändert.

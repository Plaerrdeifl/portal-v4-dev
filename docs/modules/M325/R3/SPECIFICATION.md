# M325-R3 – Standard-Zustiegsorte und Zustiegspräferenzen

## Fachgrenze

M325-R3 ergänzt ausschließlich Zustiegsdefaults. Die bestehende Hierarchie aus `fanbus_boarding_stops` und `fanbus_trip_boarding_stops` bleibt alleinige Quelle. Portaluser bleiben der Personenanker; Mitgliedschaft, Dashboardpräferenzen und fremde Linked-User-Präferenzen sind nicht Bestandteil des Modells.

## Daten und Verträge

- `fanbus_trips.default_boarding_stop_id` speichert eine allgemeine Stop-ID und ist nullable.
- `fanbus_user_preferences` speichert pro Portaluser höchstens einen allgemeinen Standard-Zustieg mit Revision und Zeitstempeln.
- Die Tabelle hat RLS, keine Browserpolicy und keine direkten Rechte für `anon`, `authenticated` oder `service_role`.
- `fanbus_user_preference_get|set|delete` bestimmen den Actor ausschließlich mit `require_active_user()`; `userId` ist kein Clientfeld.
- `fanbus_trip_update` akzeptiert additiv `defaultBoardingStopId`. Ein Wert ist nur gültig, wenn derselbe aktive Fahrtstop ihn für genau diese Fahrt anbietet; `null` entfernt den Default.

## Zentraler Resolver

`fanbus_resolve_trip_boarding_stop` löst in dieser Reihenfolge auf:

1. gültige explizite konkrete Fahrtstop-ID,
2. anwendbarer persönlicher beziehungsweise Companion-Masterstop,
3. Fahrtdefault,
4. `NONE`.

Portal-PRIMARY übergibt ausschließlich die eigene Preference. Ein Template-Companion übergibt ausschließlich `companion.default_boarding_stop_id`; `linked_portal_user_id` löst niemals einen Preference-Lesezugriff aus. Guest und freie Begleiter verwenden nur den Fahrtdefault. Der Resolver wird im Insert-Guard sowie in Preference-Readmodel und Companion-Preview wiederverwendet.

## Lifecycle und Projektionen

Wird der als Fahrtdefault verwendete Fahrtstop deaktiviert oder auf einen anderen Masterstop umgestellt, wird der Fahrtdefault in derselben Transaktion gelöscht, die Triprevision erhöht, `updated_by` gesetzt und auditiert. Zeit-, Hinweis- und Positionsänderungen löschen ihn nicht. Es gibt keinen Ersatzstop und keine Wiederherstellung.

Public liefert `defaultTripBoardingStopId` bereits als aktive konkrete Fahrtstop-ID. Der interne Snapshot liefert `defaultBoardingStopId`; das eigene Preference-Readmodel liefert zusätzlich `effectiveTripBoardingStopId` und `effectiveSource` (`PERSONAL`, `TRIP`, `NONE`).

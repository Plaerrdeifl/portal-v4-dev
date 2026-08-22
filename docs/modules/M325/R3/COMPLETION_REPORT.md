# M325-R3 – F1 Completion Report

## Umsetzung

- Additives Tripfeld und geschlossenes Self-Service-Preference-Modell ergänzt.
- Bestehendes `fanbus_trip_update` um servervalidierten Fahrtdefault erweitert.
- Zentralen Master-zu-Fahrtstop-Resolver in den gemeinsamen Insert-Guard integriert.
- Portal-, Guest- und Companion-Fallbacks einschließlich Linked-User-Datengrenze umgesetzt.
- Stop-Lifecycle mit `NULL`, Triprevision, `updated_by` und Audit ergänzt.
- Public-/Internal-/Own-Readmodels und kompakte Self-Service-/Anmelde-UI erweitert.

Keine neue Stop-Hierarchie, Capability, Personentabelle, Notification oder Einstellungsarchitektur wurde eingeführt. Historische Registrierungen und Promotion werden nicht verändert.

## Verifikation

Die lokalen Vertrags-, Frontend-, Migrations- und Regressionsprüfungen sind im F1-Abschlussbericht mit exakten Kommandos dokumentiert. Es erfolgte keine DEV- oder PROD-Migration.

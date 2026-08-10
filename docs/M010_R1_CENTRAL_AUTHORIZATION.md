# P800 / M010-R1 – Zentrales Berechtigungsmodell

## Effektive globale Capability

Die einzige allgemeine Capability-Engine ist
`app_private.has_capability(uuid, text)`. Für einen gültigen Portalbenutzer
gilt:

```text
ROLE OR OFFICE OR PERSONAL
```

Zusätzlich bleibt `ADMIN_OVERRIDE` erhalten: Eine aktive Rolle mit
`portal.admin` wirkt weiterhin als Wildcard. Für alle Quellen gilt derselbe
Grundzustand: Der Portalbenutzer ist `ACTIVE` und seine zugeordnete Rolle ist
aktiv. Inaktive oder gesperrte Benutzer sowie Benutzer mit inaktiver Rolle
erhalten keine globale Capability.

## Additive persönliche Rechte

`app_portal.user_capabilities` speichert persönliche Zusatzrechte eindeutig
über `(user_id, capability_code)`. Die Tabelle besitzt Fremdschlüssel auf
Portalbenutzer und Capability-Katalog, RLS ist aktiviert und Browserrollen
besitzen keine direkten Tabellenrechte.

Persönliche Rechte können ausschließlich hinzufügen. M010 enthält kein Deny,
kein Entfernen geerbter Rechte, keine Prioritäten und keine Negativrechte. Ein
persönlicher Grant simuliert weder eine Rolle noch ein Amt.

`portal.admin` ist durch API-Validierung und einen Datenbank-Constraint als
persönlicher Grant ausgeschlossen. Der Admin-Wildcard und
`active_admin_count()` bleiben ausschließlich rollenbasiert.

## Herkunft

`app_private.user_capability_provenance(uuid)` liefert jede effektive
Capability mit allen gleichzeitig wirksamen Quellen:

- `ROLE` mit Rolle,
- `OFFICE` mit Amtsplatz,
- `PERSONAL` mit Grant-Metadaten,
- `ADMIN_OVERRIDE` mit der rollenbasierten Wildcard.

Mehrfachquellen werden nicht zusammengefasst. Wird beispielsweise nur ein
persönlicher Grant entfernt, bleiben Rolle oder Amt sichtbar und wirksam.

## Administration und Audit

`Administration → Benutzer → Zusatzrechte` zeigt den zentralen
Capability-Katalog, effektiven Zustand und Herkunft. Nur der persönliche Anteil
ist editierbar; `portal.admin` wird nicht angeboten.

Der Browser verwendet `public.pd_api` mit `set_user_capabilities`. Die interne
Operation erfordert `portal.admin`, sperrt den Zielbenutzer, vergleicht den
erwarteten Vorzustand, validiert den vollständigen Satz und schreibt atomar.
Jede tatsächliche Änderung erzeugt ein zentrales Audit-Ereignis mit Actor,
Zielbenutzer, Vorher-/Nachher-Satz sowie hinzugefügten und entfernten Codes.

## Aufgabenrechte

Bestehende Werte aus `can_create_tasks` und `can_manage_tasks` werden nach
`tasks.create` beziehungsweise `tasks.manage` migriert. Danach sind die alten
Felder datenbankseitig auf `false` beschränkt und die beiden UI-Schalter
entfallen. Nur das zentrale Capability-Modell autorisiert diese globalen
Rechte.

Aufgabenspezifische Regeln – Sicht auf Team- oder Board-Aufgaben,
Archivumfang, ausgewählte Archivteams und direkte Übertragung – bleiben als
fachlich begrenzte Task-Regeln bestehen. Sie sind keine globalen
Capability-Quellen.

## Ämter, Teams, M210 und M150

Alle fünf echten Ämter (`VORSTAND_1`, `VORSTAND_2`, `VORSTAND_3`, `KASSIER`,
`SCHRIFTFUEHRER`) erhalten `events.manage`. Weitere Portalbenutzer können
`events.manage` persönlich erhalten. Das M210-Eventmodell und seine zentrale
Backend-Prüfung bleiben unverändert.

Teamrelationen und Teamfunktionen sind keine allgemeinen globalen
Capability-Quellen. Fachlich begrenzte Team- und Aufgabenbeziehungen bleiben
zulässig.

Eine persönliche Capability ist niemals Ersatz für einen echten Amtsplatz.
M150 ermittelt Board-Roster, Voting und manuelle 7-Tage-Entscheidung weiterhin
ausschließlich aus den fünf tatsächlichen Amtsbesetzungen. Auch
`portal.admin` ersetzt dort kein Amt.

## Security Boundary

Die PostgreSQL-Funktionen sind autoritativ. Frontend-Anzeige und Navigation
dienen nur der UX. Es gibt keine direkte Browser-Schreibmöglichkeit auf
Authorization-Tabellen, keine anonyme Bearbeitung und keine Service-Role-Logik
im Frontend.

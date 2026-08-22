# M325-R3 – Acceptance

## Preference und Zugriff

- Create, Own-Read, Update-CAS und Delete-CAS funktionieren ohne Capability.
- Ein Client kann keine fremde `userId` senden; alle Operationen verwenden den aktiven Actor.
- Inaktive Masterstops sind nicht speicherbar.
- Tabelle und private Funktionen bleiben für Browserrollen geschlossen.

## Fahrtdefault und Resolver

- Gültiger aktiver Stop derselben Fahrt ist speicherbar; andere Fahrt, nicht zugeordneter Master und inaktiver Fahrtstop werden abgelehnt.
- `null` entfernt den Default.
- Portal-PRIMARY: persönlich, danach Fahrt, danach `NONE`.
- Guest: Fahrt, danach `NONE`.
- Template-Companion: Companiondefault, danach Fahrt, danach `NONE`.
- Linked-Portaluser-Preferences werden nicht gelesen.
- Eine gültige explizite konkrete Auswahl gewinnt immer.

## Lifecycle und Regression

- Deaktivierung oder Masterwechsel des Default-Fahrtstops löscht den Default mit Triprevision und Audit.
- Abfahrtszeit, Hinweis und Reihenfolge erhalten den Default.
- ACTIVE/WAITLISTED-Daten und Promotion werden nicht umgeschrieben.
- Duplicate Preview, Companion Link/Privacy, Assignment Stop Guard, Check-in, Paid Marker und CANCELLED-Guard bleiben erhalten.
- Mobile Ansichten bei 390 px, 620 px und Desktop zeigen kompakt `Ort · Zeit` ohne technische IDs und ohne horizontalen Overflow.

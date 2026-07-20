# AE-V4-01 – Dynamisch verwaltbare Portalrollen

**Entscheidungs-ID:** AE-V4-01
**Datum:** 19. Juli 2026
**Status:** fachlich freigegeben
**Geltungsbereich:** Plärrdeifl Portal V4 / Supabase-Neuaufbau

## Ausgangslage

R7.1 definierte drei feste und nicht erweiterbare Portalrollen. Diese Regel wird
nicht in den Supabase-Neuaufbau übernommen.

Die eingefrorene Legacy-Version bleibt unverändert. Diese Entscheidung ändert
ausschließlich die Zielarchitektur von V4.

## Entscheidung

Portalrollen werden vollständig datenbankgestützt und über den
Administrationsbereich des Portals verwaltet.

Das System startet mit:

- Admin,
- Plärrdeifl Mitglied,
- Portaluser.

Diese Einträge sind initiale Rollen und keine abschließende Rollenliste.

## Verwaltungsumfang

Administratoren können:

- Rollen anlegen,
- Rollen bearbeiten,
- Rollen umbenennen,
- Beschreibungen und Darstellung ändern,
- Berechtigungen zuweisen oder entfernen,
- Rollen aktivieren und deaktivieren,
- Rollen löschen, wenn alle Schutzbedingungen erfüllt sind,
- Benutzer einer anderen aktiven Rolle zuweisen.

Die interne Rollen-UUID bleibt der technische Primärschlüssel. Dadurch können
alle fachlich sichtbaren Eigenschaften geändert werden, ohne Referenzen oder
Auditnachweise zu beschädigen.

## Benutzerzuordnung

Jeder aktive Portalbenutzer besitzt grundsätzlich genau eine aktive
Portalrolle.

Ämter, Teamrollen und Teamfunktionen ergänzen die Rolle, ersetzen sie aber
nicht.

## Berechtigungskatalog

Neue Funktionen und Module ergänzen den zentralen Berechtigungskatalog über
SQL-Migrationen.

Nach einer Migration erscheinen neue Berechtigungen in der
Rollenverwaltung des Frontends und können dort Rollen zugewiesen werden.

## Schutz des administrativen Zugriffs

Das System verhindert insbesondere:

- das Deaktivieren der letzten administrativ wirksamen Rolle,
- das Entfernen der vollständigen Administrationsrechte vom letzten
  administrativ wirksamen Benutzer,
- das Löschen einer Rolle mit bestehenden Benutzer- oder Fachreferenzen,
- die eigene Aussperrung des letzten Administrators.

Mindestens ein aktiver Benutzer muss jederzeit über eine aktive Rolle mit
vollständiger Portaladministration verfügen.

## Technische Umsetzung

Schreibvorgänge erfolgen später ausschließlich über kontrollierte
Datenbankfunktionen.

Jede Änderung wird mit ausführendem Benutzer, Zeitpunkt, Zielobjekt,
Änderungsart und Ergebnis auditiert.

RLS und Datenbankfunktionen prüfen den aktuellen Datenbankzustand. Browserdaten,
Navigation, Google-Metadaten und frei veränderbare Benutzer-Metadaten sind keine
vertrauenswürdige Autorisierungsquelle.

## Ersetzte V4-Regel

Für V4 ist die Aussage „Es existieren genau drei unveränderbare Portalrollen“
nicht mehr gültig.

Verbindlich ist stattdessen:

> Das Portal startet mit drei initialen Rollen und unterstützt beliebig weitere,
> administrativ verwaltete Portalrollen.

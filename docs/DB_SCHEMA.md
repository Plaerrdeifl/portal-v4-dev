# Plärrdeifl Portal V4 – aktuelle Datenbankstruktur

**Stand:** 7. August 2026
**P800-Reparaturbaseline:** `03fd7286aac4fd53243a2b00e05cf0d9cb31e61f`
**Supabase DEV:** `tpieykhhawszlzsoflnl`

Diese Datei beschreibt die aktive PostgreSQL-/Supabase-Struktur des V4-Portals.

Frühere Beschreibungen von `DB_Benutzer`, `DB_BenutzerAntraege`, `DB_AuditLog` und vergleichbaren Google-Sheet-Strukturen gehören zum Legacy-System und sind nicht das aktuelle V4-Datenbankschema.

## 1. Grundstruktur

Die Fachanwendung verwendet getrennte PostgreSQL-Schemas:

### `app_portal`

Portalweite Kerninformationen, beispielsweise Portalbenutzer, Rollen und Berechtigungen, Einstellungen, Benachrichtigungen, Push-Abonnements und Audit-/Portalzustände.

### `app_fanclub`

Fanclubbezogene Fachdaten, beispielsweise Mitglieder, Ämter, Beiträge und bestehende Finanzdaten.

### `app_modules`

Modulbezogene Fachobjekte, beispielsweise Teams, Aufgaben, Aufgabenverlauf sowie Transfer- und Workflowdaten.

### `app_private`

Interne Funktionen und Implementierungslogik.

Dieses Schema ist kein Browser-API-Schema und darf nicht als öffentliche Anwendungsoberfläche verwendet werden.

### `public`

Kontrollierte technische Eintrittspunkte.

Die zentrale Browserfunktion ist:

`public.pd_api(text, jsonb)`

Zusätzliche öffentliche Funktionen existieren nur für klar begrenzte interne beziehungsweise serverseitige Abläufe.

## 2. Authentifizierung und Portalidentität

Supabase Auth verwaltet die externe Authentifizierungsidentität.

Portalrechte werden nicht unmittelbar aus Google-Profilfeldern abgeleitet.

Der Datenbankzustand entscheidet unter anderem über Portalaktivierung, Rolle, Fähigkeiten, Mitgliedsverknüpfung und administrative Rechte.

Google-Metadaten dürfen für Namensvorschläge verwendet werden, aber nicht als Autorisierungsquelle.

## 3. Zugriffsschutz

Für die Fachdatentabellen gilt:

- RLS aktiviert
- kein direkter Browser-Tabellenzugriff
- kein allgemeiner Zugriff der Rollen `anon` oder `authenticated` auf Anwendungsschemas
- fachliche Zugriffe ausschließlich über kontrollierte Funktionen

Die fehlenden direkten Tabellen-Policies im Anwendungsbereich sind unter diesem Architekturmodell beabsichtigt, weil die Tabellen bereits auf Grant-/Schemaebene nicht direkt erreichbar sind.

## 4. Browser-RPC

Browseraktionen verwenden:

`public.pd_api(text, jsonb)`

Aktueller Berechtigungsvertrag:

| Rolle | EXECUTE auf `pd_api` |
|---|---|
| `anon` | nein |
| `authenticated` | ja |

Jede fachliche Aktion muss darüber hinaus innerhalb der Datenbank die aktuelle Benutzeridentität und die erforderliche Capability beziehungsweise Berechtigung prüfen.

## 5. Service-RPCs

Serverseitige Funktionen dürfen nicht durch pauschale Default-Rechte zugänglich werden.

Die benötigten Web-Push-RPCs erhalten ihre Rechte gezielt für `service_role`.

Damit gilt:

- kein allgemeines Service-Role-Defaultrecht
- benötigte Serverrechte nur durch explizites `GRANT`
- Service-Role-Schlüssel niemals im Browser

## 6. Default Privileges

P800 hat für zukünftig durch `postgres` erzeugte Objekte ein reproduzierbares Default-Deny-Modell eingeführt.

Die Migration `20260807120000_harden_public_default_privileges.sql` entzieht:

- automatisches Funktions-EXECUTE von `PUBLIC`
- Default-Rechte auf neue Tabellen für `anon`, `authenticated`, `service_role`
- Default-Rechte auf neue Sequenzen für `anon`, `authenticated`, `service_role`
- Default-Rechte auf neue Funktionen für `anon`, `authenticated`, `service_role`

Die Migration wurde am 7. August 2026 kontrolliert auf Supabase DEV angewendet.

Die Nachprüfung auf DEV bestätigte:

- `pd_api`: `anon` ohne EXECUTE
- `pd_api`: `authenticated` mit EXECUTE
- keine pauschalen Default-Rechte für `anon`, `authenticated` oder `service_role`
- kein automatisches Funktions-EXECUTE über `PUBLIC`
- die benötigten Push-Funktionen behalten ihre expliziten `service_role`-Grants

Ein transaktionaler Future-Object-Probe bestätigte das Default-Deny-Modell; die Testobjekte wurden vollständig zurückgerollt.

Die Plattform-Defaults von `supabase_admin` wurden nicht verändert.

## 7. Migrationen

Die Datenbankhistorie liegt versioniert unter `supabase/migrations`.

P800 stellt die auf DEV bereits vorhandene, im Repository zuvor fehlende Migration wieder her:

`20260802211306_harden_pd_api_revoke_anon_execute.sql`

Sie enthält:

```sql
revoke execute
on function public.pd_api(text, jsonb)
from anon;
```

Die DEV-Migrationshistorie enthält außerdem die neu angewendete Migration:

`20260807120000_harden_public_default_privileges`

Damit sind Repository und Supabase DEV für beide P800-Härtungsschritte nachvollziehbar abgeglichen.

## 8. Finanzdaten

Beiträge und Fanclub-Finanzen sind Bestandteil des vorhandenen Systems.

Die bestehende Finanzfunktion ist produktiv und wird nicht als zukünftiges Grundmodul betrachtet.

Das spätere Fanbus-Modul darf auf dieser Struktur nur gezielt für fanbusbezogene Zahlungen, Abrechnung und Auswertung aufbauen.

## 9. Änderungsregel

Neue Datenbankobjekte oder strukturelle Änderungen werden ausschließlich über versionierte Migrationen eingeführt.

Nicht zulässig als Normalprozess sind:

- unversionierte Studio-Strukturänderungen
- manuelle Cloud-DDL ohne entsprechende Repository-Migration
- pauschale Browsergrants
- pauschale Service-Role-Grants
- Verwendung von Google-Metadaten als Autorisierung

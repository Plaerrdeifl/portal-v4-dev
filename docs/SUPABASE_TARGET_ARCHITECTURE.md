# Plärrdeifl Portal V4 – Supabase-Zielarchitektur

**Stufe:** 2 – Zielarchitektur und Datenbankfundament
**Status:** FACHLICH ABGENOMMEN
**Stand:** 19. Juli 2026
**Ausgangsbasis:** Branch `v4-supabase-dev`, Commit `85fd08b`

## 1. Zweck

Dieses Dokument ist die verbindliche Architekturgrundlage für den vollständigen
Supabase-Neuaufbau des Plärrdeifl Portals.

Die eingefrorene Apps-Script-/Google-Sheets-Version bleibt unverändert und dient
ausschließlich als fachliche und optische Legacy-Referenz. Fehlerhafte
Legacy-Logik wird nicht übernommen.

R7.1 bleibt die fachliche Grundlage. Abweichungen, die für V4 ausdrücklich
beschlossen wurden, werden in eigenen Änderungsentscheidungen dokumentiert.

## 2. Technische Grundstruktur

Jedes Supabase-Projekt verwendet folgende Anwendungsschemas:

| Schema | Verantwortung |
|---|---|
| `app_portal` | Benutzer, Portalrollen, Berechtigungen, Teams, Einstellungen und Audit |
| `app_fanclub` | Mitglieder, Ämter, Beiträge, Konten und Finanzdaten |
| `app_modules` | Aufgaben und spätere eigenständige Portalmodule |
| `app_private` | interne Autorisierungs-, Validierungs- und Hilfsfunktionen |

Das Schema `public` enthält keine fachlichen V4-Tabellen.

`app_private` wird niemals über die Data API exponiert. Die drei Fachschemas
werden erst dann exponiert, wenn ihre Tabellen, Grants und RLS-Policies
vollständig umgesetzt und getestet sind.

DEV und PROD besitzen später dieselbe migrationsbasierte Struktur. Sie bleiben
technisch, organisatorisch und hinsichtlich ihrer Datenbestände strikt getrennt.

## 3. Migrationsprinzip

Sämtliche Datenbankänderungen erfolgen ausschließlich über versionierte
SQL-Migrationen im Verzeichnis `supabase/migrations`.

Unzulässig sind:

- manuell erzeugte Tabellen oder Funktionen,
- nicht dokumentierte Änderungen über Supabase Studio,
- direkte Strukturänderungen im Cloudprojekt,
- Secrets im Repository,
- produktive Änderungen vor erfolgreicher DEV-Abnahme.

Jede Migration muss lokal mit einem vollständigen `supabase db reset` getestet
werden.

## 4. Identitätsmodell

### 4.1 Supabase-Identität

Die technische Authentifizierungsidentität ist `auth.users.id`.

Der spätere Portalbenutzer verwendet dieselbe UUID als Primärschlüssel:

```text
auth.users.id
    ↓
app_portal.users.id
```

Authentifizierungsdaten und fachliche Profildaten bleiben getrennt.

### 4.2 Portalbenutzer

Portalbenutzer erhalten zusätzlich einen stabilen sichtbaren Benutzercode,
beispielsweise `U-0001`.

Interne Fremdschlüssel verwenden die UUID. Namen, E-Mail-Adressen und sichtbare
Codes werden niemals als technische Fremdschlüssel verwendet.

### 4.3 Fanclub-Mitglied

Fanclub-Mitglieder besitzen eine eigene UUID und den stabilen sichtbaren
Mitgliedscode `PD-xxx`.

Ein Mitglied kann ohne Portalzugang existieren. Ein Portalbenutzer kann ohne
Mitgliedschaft existieren.

Die optionale Verbindung wird später eindeutig über eine eigene
Benutzer-Mitglied-Zuordnung abgebildet.

## 5. Dynamisch verwaltbare Portalrollen

Die frühere R7.1-Regel mit exakt drei unveränderbaren Portalrollen wird für V4
durch die Änderungsentscheidung `AE-V4-01` ersetzt.

Das System startet mit drei initialen Rollen:

- Admin
- Plärrdeifl Mitglied
- Portaluser

Diese Rollen sind nur die Startkonfiguration und keine abschließende Rollenliste.

Administratoren können über das Portal:

- neue Rollen anlegen,
- bestehende Rollen bearbeiten,
- Anzeigenamen und Beschreibungen ändern,
- Berechtigungen zuweisen oder entfernen,
- Rollen aktivieren oder deaktivieren,
- Rollen unter geprüften Bedingungen löschen,
- Benutzer anderen aktiven Rollen zuweisen.

Jeder Benutzer besitzt grundsätzlich genau eine aktive Portalrolle.

Die technische Identität einer Rolle ist eine interne UUID. Alle fachlich und im
Frontend sichtbaren Eigenschaften der Rolle sind administrierbar.

Das System muss jederzeit verhindern, dass der letzte aktive administrative
Zugriff verloren geht. Mindestens ein aktiver Benutzer muss über eine aktive
Rolle mit vollständiger Portaladministration verfügen.

Rollenänderungen erfolgen ausschließlich über kontrollierte
Datenbankfunktionen und werden auditiert.

## 6. Berechtigungsmodell

Berechtigungen werden in einem zentralen Katalog geführt.

Rechte können aus folgenden Quellen entstehen:

1. Portalrolle,
2. festes Amt,
3. Teamrolle,
4. Teamfunktion,
5. direkte fachliche Beziehung, beispielsweise eine eigene Aufgabe.

Zusätzliche Amts- oder Teamrechte ersetzen die Portalrolle nicht.

Berechtigungen werden nicht aus Browserzustand, ausgeblendeter Navigation,
Google-Metadaten oder frei veränderbaren Benutzer-Metadaten abgeleitet.

Die maßgebliche Entscheidung trifft immer PostgreSQL anhand des aktuellen
Datenbestands.

## 7. Fünf feste Amtsplätze

Die Vereinsstruktur besitzt dauerhaft genau diese Amtsplätze:

- `VORSTAND_1`
- `VORSTAND_2`
- `VORSTAND_3`
- `KASSIER`
- `SCHRIFTFUEHRER`

Die Amtsplätze sind feste fachliche Strukturen und werden nicht wie
Portalrollen frei angelegt oder gelöscht.

Regeln:

- Ein Amtsplatz darf unbesetzt sein.
- Ein Amtsplatz darf höchstens einem aktiven Mitglied zugeordnet sein.
- Ein Mitglied darf höchstens einen Amtsplatz besitzen.
- Die Zuweisung erfolgt an das Mitglied, nicht direkt an den Auth-Benutzer.
- Portalrechte wirken nur über eine aktive Benutzer-Mitglied-Verknüpfung.
- Jede Änderung wird auditiert.

Alle fünf Amtsinhaber erhalten die festgelegten Vorstandsgrundrechte. Nur der
Kassier und Administratoren erhalten die geschützten Finanz-Schreibrechte.

Die vollständige Regelung steht in `AE-V4-02`.

## 8. Google-Login und Namenspflicht

Die Anmeldung erfolgt später über Supabase Auth mit Google.

Google-Profilwerte `given_name` und `family_name` dürfen ausschließlich als
editierbare Vorbelegung verwendet werden.

Vorname und Nachname sind getrennte Pflichtfelder. Serverseitig gilt:

```text
length(btrim(first_name)) > 0
length(btrim(last_name)) > 0
```

Unzulässig sind insbesondere:

- E-Mail-Präfixe als Namensersatz,
- automatisch aufgeteilte Anzeigenamen als verbindlicher Wert,
- Platzhalter wie `Unbekannt`, `User`, `N/A` oder `-`,
- Werte, die nur aus Leerzeichen bestehen.

Ein unvollständiges Profil darf nicht freigeschaltet werden.

Der geplante Zustandsablauf lautet:

```text
AUTHENTICATED_UNREGISTERED
→ PROFILE_REQUIRED
→ APPROVAL_PENDING
→ ACTIVE
```

Zusätzlich sind mindestens `INACTIVE` und `BLOCKED` vorgesehen.

Die vollständige Auth-Implementierung ist nicht Bestandteil dieses ersten
Architekturblocks.

## 9. RLS-Grundstrategie

Es gilt standardmäßig:

```text
Kein Zugriff, solange er nicht ausdrücklich erlaubt wurde.
```

Für später exponierte Fachdatentabellen gilt:

- RLS wird ausdrücklich aktiviert.
- `anon` erhält keinen Zugriff auf interne Portaldaten.
- `authenticated` erhält nur die erforderlichen Objektprivilegien.
- Policies werden getrennt nach `SELECT`, `INSERT`, `UPDATE` und `DELETE`
  formuliert.
- Policy-relevante Fremdschlüssel werden indexiert.
- sensible Schreibvorgänge laufen über kontrollierte transaktionale Funktionen.
- `service_role` wird niemals im Browser oder Repository verwendet.

Interne RLS-Hilfsfunktionen liegen in `app_private`, verwenden vollständig
qualifizierte Objektnamen und werden nicht über die Data API exponiert.

Views werden später nur als abgesicherte `security_invoker`-Views oder über
gezielte RPC-Funktionen bereitgestellt.

## 10. Geplante Tabellenbereiche

### `app_portal`

- `users`
- `access_requests`
- `user_member_links`
- `portal_roles`
- `capabilities`
- `role_capabilities`
- `teams`
- `team_memberships`
- `team_functions`
- `team_function_assignments`
- `settings`
- `audit_events`
- `operation_runs`

### `app_fanclub`

- `members`
- `office_slots`
- `office_capabilities`
- `seasons`
- `contribution_classes`
- `contributions`
- `payment_reports`
- `account_types`
- `accounts`
- `ledger_entries`
- `annual_closings`

### `app_modules`

- `tasks`
- `task_notes`

Diese Liste ist die fachliche Zielstruktur. Die Tabellen werden nicht in einem
einzigen großen Paket angelegt, sondern in überschaubaren, geprüften
Migrationsblöcken.

## 11. Verbindliche Umsetzungsreihenfolge

1. Anwendungsschemas und Sicherheitsgrundlage
2. dynamische Rollen und Berechtigungskatalog
3. Auth-Benutzerprofil und Freischaltungsanträge
4. Mitgliedsgrundlage und Benutzer-Mitglied-Verknüpfung
5. feste Amtsplätze und Amtsrechte
6. Teams, Teamrollen und Teamfunktionen
7. Aufgabenmodul
8. Beiträge und Finanzen
9. Bus-Modul
10. vollständige Frontend-Integration und Release

Ein Fachmodul wird nicht vorgezogen, wenn sein Identitäts-, Berechtigungs- oder
RLS-Fundament noch fehlt.

## 12. Umfang des ersten Umsetzungsblocks

Der erste Block nach der Architekturabnahme erstellt ausschließlich:

- dieses Architekturdokument,
- die Änderungsentscheidungen `AE-V4-01` und `AE-V4-02`,
- die Schemas `app_portal`, `app_fanclub` und `app_modules`,
- restriktive Schema- und Standardprivilegien,
- automatische lokale Prüfungen.

Noch nicht enthalten sind Tabellen, Seed-Daten, RLS-Policies,
Google-OAuth-Konfiguration oder Änderungen am Supabase-DEV-Cloudprojekt.

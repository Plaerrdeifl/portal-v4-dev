# Plärrdeifl Portal V4 – Core-Umsetzung

**Stand:** 19. Juli 2026
**Zielbranch:** `v4-supabase-dev`

## Ergebnis

Der aktive Frontendpfad verwendet nicht mehr Apps Script oder den alten Google-GIS-Bridge-Login. Das bestehende statische PWA-Frontend arbeitet über Supabase Auth und genau eine kontrollierte PostgreSQL-RPC-Grenze `public.pd_api`.

## Datenbank

Die Core-Migrationen erstellen:

- Benutzer, Anträge, dynamische Rollen und Berechtigungen,
- Mitglieder und Benutzer-Mitglied-Verknüpfungen,
- fünf feste Amtsplätze,
- Teams, Teamrollen und vorbereitete Teamfunktionen,
- Team- und Vorstandsaufgaben mit persönlichen Notizen,
- Einstellungen, Audit und Operationsjournal.

Alle Fachdatentabellen besitzen RLS. `anon` und `authenticated` erhalten keinen direkten Tabellenzugriff. Die Browseranwendung darf nur die ausdrücklich freigegebene RPC-Funktion ausführen. Jede RPC-Aktion prüft den aktuellen Auth-Benutzer und seine wirksamen Rechte in PostgreSQL.

## Ersteinrichtung

Solange kein aktiver Benutzer vollständige Administrationsrechte besitzt, liefert der Bootstrap den Zustand `INITIALIZATION_REQUIRED`.

Der Operator erzeugt einen kryptografisch zufälligen, einmalig verwendbaren Initialisierungscode und speichert nur dessen SHA-256-Hash in der Datenbank. Der Klartext liegt ausschließlich in einer Datei außerhalb des Repositories. Nach Google-Anmeldung kann der erste Administrator damit das Portal initialisieren.

## Benutzerzustände

- `UNREGISTERED`: angemeldet, aber noch kein Antrag
- `PENDING`: Freischaltungsantrag wartet
- `REJECTED`: Antrag wurde abgelehnt und kann korrigiert erneut eingereicht werden
- `ACTIVE`: Portalzugang aktiv
- `INACTIVE`: Zugang deaktiviert
- `BLOCKED`: Zugang gesperrt
- `INITIALIZATION_REQUIRED`: erster Administrator fehlt

## Frontendbereiche

- Dashboard
- Profil und Registrierung
- Fanclub-Mitglieder und Ämter
- Teams und Teammitgliedschaften
- Aufgaben
- Administration für Anträge, Benutzer, Rollen, Rechte und Audit

Nicht berechtigte Bereiche erscheinen weder in der Navigation noch als nutzbare API-Aktion. Die Datenbankprüfung bleibt trotzdem maßgeblich.

## Sicherheitsgrenzen

- Google-Metadaten dienen nur zur Namensvorbelegung.
- Vorname und Nachname werden serverseitig validiert.
- Rollen- und Rechteänderungen wirken ohne erneute Anmeldung, weil jede Aktion den aktuellen Datenbankstand prüft.
- Der letzte vollständige administrative Zugriff kann nicht entfernt werden.
- Der Service-Role-Schlüssel wird ausschließlich kurzzeitig im Operatorprozess verwendet.
- Die Runtime-Konfiguration enthält nur Browser-geeignete öffentliche Supabase-Werte.

## Noch nicht enthalten

- Beiträge und vollständige Finanzbuchhaltung
- Bus-Modul
- Migration echter Legacy-Daten
- PROD-Projekt und produktive Veröffentlichung

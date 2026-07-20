# Plärrdeifl Portal V4 Core

Supabase-basierter Neuaufbau des Plärrdeifl Portals auf Basis des bestehenden statischen PWA-Frontends.

## Aktueller Funktionsumfang

- öffentlicher PWA-Bereich
- Google-Login über Supabase Auth
- verpflichtende getrennte Felder für Vorname und Nachname
- Freischaltungsanträge und geschützte Erstinitialisierung
- dynamische Portalrollen und Berechtigungskatalog
- Benutzer- und Mitgliedsverknüpfung
- fünf feste Amtsplätze
- Teams mit Teamleiter, bis zu zwei Co-Teamleitern und Mitgliedern
- Team- und Vorstandsaufgaben mit Notizen und Status
- Audit-Protokoll
- migrationsbasierte PostgreSQL-Struktur mit RLS und kontrollierter RPC-Grenze

Beiträge, vollständige Finanzbuchhaltung und das Bus-Modul folgen auf diesem Core.

## Lokaler Start

```powershell
npm.cmd install
npm.cmd run supabase:start
npm.cmd run supabase:db:reset
node .\scripts\write-runtime-config.mjs --url http://127.0.0.1:54321 --key "<LOKALER_ANON_KEY>" --environment LOCAL
npm.cmd run dev
```

Die Runtime-Datei `js/runtime-config.js` wird generiert und nicht committed.

## Regeln

- Apps Script und Google Sheets bleiben unveränderte Legacy-Referenz.
- Datenbankänderungen erfolgen ausschließlich über SQL-Migrationen.
- DEV und PROD bleiben strikt getrennt.
- Keine geheimen Schlüssel im Repository.
- Der Service-Role-Schlüssel wird niemals im Browser verwendet.
- `app_private` wird nicht über die Data API exponiert.

Siehe `docs/SUPABASE_TARGET_ARCHITECTURE.md` und `docs/V4_CORE_IMPLEMENTATION.md`.

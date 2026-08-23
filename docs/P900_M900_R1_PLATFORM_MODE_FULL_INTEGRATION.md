# P900 / M900-R1 – Plattformmodus: Vollintegration und Release-Bypass

## Betriebsvertrag

Der öffentliche Status wird ausschließlich über `public.pd_public_platform_status()` gelesen. Portal und WordPress laden ihn ohne Cache. Ungültige, fehlende oder nicht erreichbare Zustände werden als Wartung behandelt.

- `NORMAL`: bestehendes Verhalten unverändert.
- `READ_ONLY`: alle klassifizierten Leseaktionen bleiben offen; User-Mutationen werden gesperrt.
- `MAINTENANCE`: das Portal zeigt vor Authentifizierung und Modulstart nur die Wartungsansicht.

Zusätzlich zu `public.pd_api(...)` sind die öffentlichen Mutationsgrenzen für M150, M210-Confirm und M310 geschützt. M210-Preview und technische Hintergrundworker bleiben ungesperrt.

Für das M150-WordPress-Plugin müssen serverseitig zusätzlich gesetzt sein:

- `PD_M150_PLATFORM_STATUS_URL`: vollständige HTTPS-RPC-URL zu `pd_public_platform_status`
- `PD_M150_PLATFORM_PUBLIC_KEY`: öffentlicher Supabase-Schlüssel

Die WordPress-Admin-Einstellungen und ihre Berechtigungen bleiben unverändert.

## Kontrollierter Release-Test-Bypass

Der Bypass ist keine Portalberechtigung und nicht über Browserrollen oder `service_role` administrierbar. Erstellung und Widerruf erfolgen ausschließlich im geschützten PostgreSQL-Ops-Kontext. Die interne `platform.mode`-Konfiguration muss dazu eine zur Zielumgebung passende `environment` enthalten.

Beispiel für einen auf einen Testuser gebundenen, 15 Minuten gültigen Token:

```sql
select app_private.create_platform_release_bypass(
  'DEV',
  'release-2026-08-23-smoke-01',
  now() + interval '15 minutes',
  '<portal-user-uuid>'::uuid
);
```

Nur dieser Aufruf gibt den Roh-Token einmalig zurück. In der Datenbank wird ausschließlich sein SHA-256-Digest gespeichert. Der Bypass ist maximal eine Stunde gültig, aktiv widerrufbar und an Umgebung, Laufkennung sowie optional einen Portaluser gebunden.

Widerruf:

```sql
select app_private.revoke_platform_release_bypass('<bypass-id>'::uuid);
```

Ein E2E-Lauf injiziert den Token ausschließlich flüchtig vor dem Seitenstart in `window.__PD_RELEASE_TEST_CONTEXT__`:

```js
await context.addInitScript(value => {
  Object.defineProperty(window, "__PD_RELEASE_TEST_CONTEXT__", {
    value: Object.freeze(value),
    configurable: false,
    writable: false
  });
}, {
  token: process.env.PD_RELEASE_BYPASS_TOKEN,
  runId: process.env.PD_RELEASE_RUN_ID,
  environment: "DEV"
});
```

Es gibt keine Speicherung in Local Storage, Session Storage, IndexedDB oder Cookies und keine normale UI dafür. Portal, WordPress und die betroffenen Edge Functions transportieren die drei validierten Header bis zum Datenbank-Guard. Falsche oder unvollständige Werte werden verworfen und enden im normalen Plattformfehler.

Jede erfolgreiche Verwendung schreibt `PLATFORM_RELEASE_BYPASS_USED` mit Action, Umgebung, Lauf und Bindungsstatus ins zentrale Audit. Roh-Token und Digest erscheinen dort nicht. Der Bypass überspringt ausschließlich den Plattformmodus; Authentifizierung, Capability-Prüfung, Fachvalidierung, Turnstile, HMAC, Rate Limits, Idempotenz und Revisionsschutz laufen unverändert weiter.

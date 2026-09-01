# P900 – M900-R1 Security Hardening (Auftrag 3/4)

## Ergebnis und Disposition

| Bereich | Fund | Entscheidung | Status |
|---|---|---|---|
| Release-Testkontext | Ein syntaktisch gültiger Clientkontext konnte die Maintenance-UX öffnen | Clientkontext ist nur Transporthilfe; MAINTENANCE bleibt immer Shell | umgesetzt |
| Companion-Suche | Substring ab drei Zeichen und Mitgliedschaftsausgabe ermöglichten Enumeration | Namens-Tokenpräfix, spezifischere Eingabe, acht Treffer, 30 Suchen je fünf Minuten und keine Mitgliedschaft/Kontaktdaten | umgesetzt |
| Historische Router | Direkte Rechte waren über Migrationen uneinheitlich verteilt | Alle 26 aktiven Vorgänger nur für `postgres`; allein `pd_api(text,jsonb)` bleibt authenticated | umgesetzt |
| Öffentliche Reads | Advisor meldet bewusst öffentliche `SECURITY DEFINER`-RPCs | API-only-Projektionen mit leerem `search_path`, minimalem Output und exakter Grant-Matrix beibehalten | akzeptiert |
| Private Bootstrap-Tokens | Kein direkter Grant, aber RLS fehlte | RLS ohne Policy als Defense in depth, kein `FORCE RLS` | umgesetzt |
| Auth-Passwörter | Lokale Vorlage enthielt Mindestlänge 6 ohne Anforderungen | Repo-Vorlage: 12 Zeichen, alle Zeichenklassen, sichere Passwortänderung; Email-/SMS-Signup bleibt aus | umgesetzt |
| Leaked-Password-Protection | Hosted-Einstellung ist nicht durch SQL-Migration verwaltet | Operations-Schritt dokumentiert; keine Remote-Änderung | offen für kontrollierten Betriebsschritt |
| Dialoge | Dynamisches Markup ging direkt in einen Live-`innerHTML`-Sink | Inert parsen, Elemente/Attribute/URLs validieren, dann DOM-Knoten einsetzen; Actions per DOM API | umgesetzt |
| URL/Links | Keine ausnutzbare Link-Schwachstelle gefunden | HTTPS-/Credential-Prüfung und `noopener noreferrer` beibehalten; Dialoglinks zusätzlich zentral validiert | akzeptiert |
| SQL-Injection | Kein dynamisches SQL gefunden | Statische, typisierte SQL-Aufrufe und vollständig qualifizierte Relationen beibehalten | akzeptiert |

## Public-RPC-Matrix

| RPC | Zweck | Definer nötig | Outputgrenze | Execute |
|---|---|---:|---|---|
| `pd_public_events()` | öffentliche Termine | ja, Tabellen bleiben API-only | ausschließlich PUBLIC-Termine ohne interne IDs/Benutzerdaten | `anon` |
| `pd_public_fanbus_trip(uuid)` | öffentliche Fahrtdetailprojektion | ja | veröffentlichte/abgesagte Fahrt, öffentliche Buchungskennzahlen und Rechtsreferenzen | `anon`, `authenticated` |
| `pd_public_fanbus_trip_boarding_stops(uuid)` | öffentliche Zustiegsorte | ja | aktive Fahrtstopps veröffentlichter/abgesagter Fahrten | `anon`, `authenticated` |
| `pd_public_fanbus_trips()` | öffentliche Fahrtliste | ja | gleiche öffentliche Projektion ohne Teilnehmerdaten | `anon`, `authenticated` |
| `pd_public_platform_status()` | Platform Mode | ja | nur `mode`, `message`, `expectedEnd`, `revision` | `anon`, `authenticated` |

Alle fünf Funktionen sind reine Reads, besitzen `SECURITY DEFINER`, `search_path = ''` und vollständig qualifizierte Tabellenzugriffe. Die verbleibende Advisor-Warnung ist deshalb eine bewusst akzeptierte API-only-Architekturentscheidung.

## Grant-Matrix

| Objektgruppe | anon | authenticated | service_role | postgres |
|---|---:|---:|---:|---:|
| `pd_api(text,jsonb)` | – | EXECUTE | – | Eigentümer/intern |
| öffentliche Read-RPCs | gemäß obiger Matrix | gemäß obiger Matrix | – | Eigentümer/intern |
| `pd_api_before_*` (26) | – | – | – | EXECUTE |
| Companion-Suchkern/-Limit | – | – | – | EXECUTE |
| `bootstrap_tokens` | – | – | – | Eigentümer/intern, RLS |
| Release-Bypass-Tabelle | – | – | – | Eigentümer/intern, RLS |
| Release-Bypass create/revoke | – | – | – | EXECUTE |

Service-Role-RPCs für M150/M210/M310 und Worker sind keine historischen Router und bleiben unverändert.

## Companion-Search-Privacy-Vertrag

- Nur aktive Portaluser werden berücksichtigt.
- Ausgabe: ausschließlich `portalUserId` und `displayName`; die UUID ist für den bestehenden Linkvorgang erforderlich.
- Keine Mitgliedschaft, E-Mail-Adresse, Telefonnummer, Rolle, Capability oder Teamzugehörigkeit.
- Eingaben werden kleingeschrieben, außen getrimmt und interne Leerzeichen normalisiert.
- Mindestens fünf, höchstens 120 Zeichen; jedes Token mindestens zwei Zeichen.
- Jedes Suchtoken muss Präfix eines Namenstokens sein. Beliebige Infixsuche ist ausgeschlossen.
- Maximal acht Ergebnisse, keine Pagination oder Gesamtzahl.
- Pro aktivem Actor maximal 30 gültige Suchen je fünf Minuten; Suchbegriffe werden nicht gespeichert.
- Link/Unlink bleibt auf Mitglieder der eigenen Companion-Liste mit Revision/CAS begrenzt. Administrative Identity-Aktionen bleiben capabilitygeschützt.

## Release-Bypass-Bedrohungsmodell

`window.__PD_RELEASE_TEST_CONTEXT__` beweist keine Autorisierung. Er stellt nach enger Syntax- und Environment-Prüfung lediglich drei Request-Header bereit. In READ_ONLY darf der Browser den Request senden; ausschließlich der DB-Guard entscheidet über Token-Digest, Ablauf, Aktivität, Environment, Run und optionales User-Binding. In MAINTENANCE wird die normale Portaloberfläche unabhängig vom Clientkontext nicht gestartet.

Roh-Tokens werden nur einmal bei der Ops-Erzeugung zurückgegeben. Persistent bleibt ausschließlich SHA-256. Tabelle und create/revoke sind nur `postgres` zugänglich, die TTL bleibt auf eine Stunde begrenzt. Erfolgreiche Erzeugung, Nutzung und Widerruf werden mit Environment, Run, Verwendung/Status und Operator-/Actor-Kontext auditiert; Roh-Token und Digest erscheinen nie im Audit.

## Audit Policy

### MUST AUDIT

- Rollen-, Office-, Teamfunktions- und persönliche Capability-Änderungen
- Membership-, Portalidentity- und Companion-/Teilnehmer-Identity-Linking
- kritische Fanbus-Betriebs-, Buchungs-, Storno- und Konfigurationsänderungen
- Finanzbuchungen, Transfers, Korrekturen und administrative Stammdatenänderungen
- Release-Bypass-Erzeugung, erfolgreiche Nutzung und Widerruf
- sicherheitsrelevante Admin-, Bootstrap- und Account-Lifecycle-Aktionen

### OPTIONAL / KEIN FULL BEFORE-AFTER

- persönliche UI-/Dashboard-Präferenzen
- Read-State und Notification-gelesen-Zustände
- geringkritische Self-Service-Defaults, wenn Actor, aktueller Zustand oder technisches Event bereits ausreichend nachvollziehbar sind

Auditdaten bleiben datensparsam: keine vollständigen Formulare, Passwörter, Token, Digests, HMAC-/Turnstile-Secrets oder unnötige Kontakt-/Namenskopien.

## Auth-Hardening Operations Note

Das Portal nutzt Google OAuth. `auth.email.enable_signup` und `auth.sms.enable_signup` bleiben `false`; keine Passwortauthentifizierung und kein MFA-Rollout werden eingeführt. Die lokale deklarative Vorlage setzt für neue oder geänderte Passwörter 12 Zeichen, Groß-/Kleinbuchstaben, Ziffern und Symbole sowie sichere Reauthentifizierung bei Passwortänderungen.

Leaked-Password-Protection wird für gehostete Projekte über **Dashboard → Auth → Password security** verwaltet und ist laut Supabase auf Pro und höher verfügbar. Kontrollierter späterer Betriebsschritt je Umgebung:

1. vorhandene Auth-Provider und mögliche Passwortidentitäten inventarisieren;
2. Google OAuth und deaktiviertes Email-/SMS-Signup bestätigen;
3. Auswirkungen auf bestehende Passwortnutzer prüfen und kommunizieren;
4. Mindestlänge/Anforderungen und Leaked-Password-Protection zunächst in DEV setzen und testen;
5. PROD ausschließlich in einem separat freigegebenen Auftrag ändern.

Auftrag 3 verändert weder Remote-DEV- noch PROD-Auth-Konfiguration.

## Später / Auftrag 4

- verbleibende Advisor-Gesamtinventur und freigegebene Operations-Schritte
- keine Performance-Indexrunde, Router-Neustrukturierung, MFA-, DTO- oder Fachlogikänderung in diesem Auftrag

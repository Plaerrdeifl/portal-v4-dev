# Gemeinsamer React/Vite-Plattformvertrag V1

**Stand:** 29.09.2026  
**Status:** Phase 1 – technischer Vertrag vor Auslagerung in `platform-ui`

## 1. Ausgangspunkt

`Plaerrdeifl/liveticker` und `Plaerrdeifl/social-media-generator` verwenden bereits React + TypeScript + Vite und dieselbe zentrale Supabase-/Portalidentität.

Beide Implementierungen lösen heute ähnliche Plattformaufgaben noch separat. Vor weiteren Fach-Repositories wird dafür ein gemeinsamer Vertrag festgelegt.

## 2. Gemeinsame Kernbausteine

Der künftige gemeinsame Plattformbaustein soll mindestens folgende Bereiche bereitstellen:

```text
@plaerrdeifl/platform
├── runtime
├── supabase
├── api
├── auth
├── capabilities
├── google-signin
├── navigation
└── errors

@plaerrdeifl/ui
├── app-shell
├── buttons
├── dialogs
├── forms
├── tables
├── status
├── loading
└── toast
```

Ob diese beiden Pakete später in einem Repository `platform-ui` oder unter einem anderen Paketnamen liegen, ändert den Vertrag nicht.

## 3. Runtime-Konfiguration

Alle Apps benötigen denselben logischen Runtime-Vertrag:

- Supabase URL
- Supabase Publishable Key
- Google Web Client ID
- Environment-Kennung
- optionale Portal-/Asset-Basis
- keine Secrets im Browser

Konfiguration darf aus:

1. einer vom Portal/Hosting injizierten öffentlichen Runtime-Konfiguration
2. lokalen Vite-Variablen

gelesen werden.

Apps dürfen keine fest verdrahteten DEV-/PROD-Secrets enthalten.

## 4. Supabase-Client

Gemeinsamer Clientvertrag:

- `@supabase/supabase-js`
- PKCE-kompatibel
- Session persistent
- Auto Refresh aktiv
- Session aus Redirect/URL erkennbar
- genau eine Clientinstanz pro App-Laufzeit
- testbar/resetbar

Kein `service_role` im Browser.

## 5. `pd_api`-Client

Gemeinsamer Browservertrag:

```ts
type PdApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { code?: string; message?: string } }
```

API-Aufrufe:

- gehen an `public.pd_api(text, jsonb)`
- normalisieren Action-Namen und Payload
- entpacken das zentrale Envelope
- erzeugen einen typisierten Plattformfehler
- geben Fehlercode, Meldung und optionale Details weiter

Release-Bypass ist **kein allgemeines Fachfeature**. Falls ein freigegebener Testlauf zusätzliche Header benötigt, wird dies als optionale Plattformfunktion injiziert und nicht in jedem Modul kopiert.

## 6. Auth-/Bootstrap-Vertrag

Nach vorhandener Supabase-Session lädt eine App den zentralen:

- `bootstrap`

über `pd_api`.

Minimal benötigte Bootstrap-Daten:

- Portalzustand
- aktive/inaktive Benutzerlage
- effektive Permissions/Capabilities
- Benutzeranzeigedaten

Gemeinsame Helfer:

```ts
hasCapability(code)
hasAnyCapability(codes)
isPortalAdmin()
isActivePortalUser()
```

Ein Fachmodul definiert nur, welche Capability es braucht.

Beispiele:

- Events: `events.manage`
- Fanbus: fachliche `fanbus.*`
- Liveticker: `liveticker.manage`
- Generator: `social_media_generator.use`

`portal.admin` bleibt zentraler Wildcard und wird nicht pro App neu interpretiert.

## 7. Google-Anmeldung

Ticker und Generator besitzen bereits funktionierende Google-ID-Token-/Supabase-Login-Bausteine.

Der gemeinsame Vertrag soll:

- Google Identity Services laden
- sicheren Nonce erzeugen
- ID-Token an Supabase `signInWithIdToken` geben
- danach den normalen Portal-Bootstrap laden
- keine Google-Profildaten zur Autorisierung verwenden

Apps sollen keinen eigenen abweichenden Google-Login-Flow mehr entwickeln.

## 8. Fehlervertrag

Gemeinsamer Fehler:

```ts
class PlatformApiError extends Error {
  code: string
  details?: unknown
}
```

UI und Fachlogik dürfen auf stabile Fehlercodes reagieren, ohne rohe Supabase-Fehler überall selbst zu interpretieren.

Insbesondere:

- Auth erforderlich
- Capability fehlt
- Revision/Stale Conflict
- Plattform READ_ONLY
- Plattform MAINTENANCE
- Write unavailable
- Netzwerk-/HTTP-Fehler

## 9. Standalone und Portal

Jede neue Fachanwendung muss zwei Startmodi unterstützen:

### Standalone

Direkter Aufruf der eigenen Anwendung.

Die App:

- liest die bestehende Supabase-Session
- bietet bei Bedarf denselben Google-Login
- lädt Bootstrap und Capabilities
- zeigt ihre eigene Fachoberfläche

### Portalintegriert

Das Portal öffnet dieselbe Anwendung mit fachlichem Kontext.

Möglicher Kontext:

- `eventId`
- `tripId`
- gewünschte Unteransicht
- Rücksprungziel

Die Fachanwendung bleibt dieselbe Codebasis.

Keine zweite Portalimplementierung und kein iframe als Standardarchitektur.

## 10. Navigation zwischen Modulen

Cross-Modul-Navigation erfolgt über stabile IDs und registrierte Routen, nicht über fremde Fachabfragen im UI.

Beispiel Events ↔ Fanbus:

**Nicht Ziel:**

```text
Events UI
  -> fanbus_trips_list
  -> Fanbus-Fachlogik in Events
```

**Ziel:**

```text
Events/Portal Integration
  -> Event-ID
  -> registrierter Fanbus-Einstieg
  -> Fanbus löst seinen eigenen Fachzustand
```

Dadurch bleibt Events vorgelagerte Quelle und Fanbus Eigentümer der Fahrt.

## 11. Gemeinsame UI-Regeln

Neue Apps sollen denselben visuellen Grundvertrag verwenden:

- gleiche Grundtypografie
- gleiche Abstände und Breakpoints
- gleiche Button-/Dialogsemantik
- gleiche Statusdarstellung
- gleiche Fehlerdarstellung
- gleiche Ladezustände
- gleiche mobile Bedienprinzipien
- gleiche Tastatur-/Accessibility-Grundlagen

Fachspezifische Oberflächen dürfen davon abweichen, wenn der Arbeitsablauf es benötigt; sie sollen aber nicht ihr eigenes unabhängiges Design-System aufbauen.

## 12. Versionierung

Gemeinsame Plattformpakete werden versioniert.

Ein Fachrepo aktualisiert nicht automatisch blind auf jede neue Plattformversion.

Vor einem Upgrade:

- Tests
- TypeScript-Check
- Build
- relevante Fachabnahme

Damit kann ein gemeinsamer Unterbau gepflegt werden, ohne alle Apps gleichzeitig zu brechen.

## 13. Erste Extraktionskandidaten aus bestehenden Apps

Aus Ticker und Generator lassen sich konzeptionell zusammenführen:

### bereits sehr ähnlich

- Runtime-Konfiguration
- Supabase-Client
- `pd_api`-Envelope
- typisierte API-Fehler
- Bootstrap / Session
- Google-ID-Token-Login

### bleibt fach- bzw. app-spezifisch

Ticker:

- Release-/Runtime-Control
- WPP/WhatsApp
- Tickerzustand
- Renderer

Generator:

- Grafikdokumentmodell
- SVG
- Medienbibliothek
- Renderjobs

Gemeinsam wird nur Plattformlogik extrahiert, keine Fachlogik.

## 14. Events-Pilot verwendet diesen Vertrag

Der neue Events-Pilot soll nicht noch einmal eine dritte Auth-/API-Implementierung erstellen.

Sein erster vertikaler Slice benötigt nur:

1. Runtime-Konfiguration
2. Supabase-Client
3. Session/Bootstrap
4. Capability-Helper
5. `pd_api`-Client
6. read-only `events_list`
7. gemeinsame Basisoberfläche

Erst wenn dieser Slice gegen DEV funktioniert, folgen Event-Schreibfunktionen und ICS-Import.

## 15. Noch keine Bestands-App umbauen

In Phase 1 werden Ticker 2.0 und Generator 1.0 **nicht** vorschnell auf gemeinsame Pakete umgestellt.

Ablauf:

1. Vertrag stabilisieren
2. Events als erster neuer Konsument
3. gemeinsame Pakete real testen
4. danach Generator/Ticker kontrolliert auf die gemeinsame Implementierung migrieren

So vermeiden wir, dass die bereits funktionierenden neuen Anwendungen während der Plattformmigration unnötig destabilisiert werden.

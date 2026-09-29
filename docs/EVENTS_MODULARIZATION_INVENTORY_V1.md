# Events / Spielplan – Modularisierungsinventar V1

**Stand:** 29.09.2026  
**Ziel:** belastbare Schnittkante für den ersten Fachmodul-Pilot `Plaerrdeifl/events`  
**Status:** Analyse; noch keine Fachfunktion verschoben

## 1. Aktueller Frontend-Einstieg

Der heutige Kalender-/Spielplanbereich liegt im Portal-Frontend.

Relevante Dateien:

- `pages/dates.html`
- `js/modules/dates.js`
- `js/router.js`
- `js/pages.js`
- gemeinsame Helfer über `js/modules/common.js` und `js/api.js`

Die Route heißt aktuell `dates`, wird direkt nach dem Dashboard eingeordnet und lazy über `hydrateDates` geladen.

## 2. Aktueller Funktionsumfang

Die bestehende Oberfläche unterstützt:

- Liste kommender Termine
- Suche
- Filter nach Typ
- Filter nach Sichtbarkeit
- Filter Heim/Auswärts
- Detailansicht
- Termin anlegen
- Termin bearbeiten
- Termin löschen
- GAME-, FANCLUB- und OTHER-Termine
- PUBLIC- und INTERNAL-Sichtbarkeit
- HOME-/AWAY-Spieldaten
- revisionssichere Änderungen
- kontrollierten ICS-Spielplanimport mit Vorschau und Bestätigung
- aktuell zusätzlich einen Fanbus-Link zu veröffentlichten Fahrten

## 3. Browser-API-Verträge

Die heutige Event-Oberfläche verwendet über den gemeinsamen Portal-API-Client:

- `events_list`
- `event_create`
- `event_update`
- `event_delete`

Für Schreiboperationen wird `events.manage` geprüft.

Updates und Deletes verwenden die bestehende `revision` als Optimistic-Concurrency-Schutz.

Öffentliche Termine werden separat über:

- `public.pd_public_events()`

bereitgestellt.

Diese Verträge bleiben beim ersten Repo-Schnitt bestehen. Die Events-PWA baut keine direkten Browserrechte auf Anwendungstabellen auf.

## 4. ICS-Import

Aktueller Edge-Function-Pfad:

- `supabase/functions/m210-ics-import/index.ts`
- `supabase/functions/m210-ics-import/ics-parser.js`

Aktueller Datenbankvertrag:

- `public.m210_ics_import_preview(...)`
- `public.m210_ics_import_confirm(...)`

Aktuelles Importprofil:

- Typ: `ICS`
- Source Key: `ERV_BAYERNLIGA_2026_27`
- Label: `ERV Bayernliga 2026/27`
- Dateigröße maximal 1 MiB
- Preview vor Confirm
- Fingerprint gegen stale previews
- Autorisierung über `events.manage`
- bestehende Plattformmodi / Release-Bypass werden respektiert

Der Importparser unterstützt bewusst nur den für den Spielplan vereinbarten kontrollierten RFC5545-Ausschnitt. Dieser Vertrag wird beim Repo-Schnitt nicht beiläufig erweitert.

## 5. Führende Tabellen

Die Events-Domäne besitzt aktuell als fachlichen Kern:

- `app_modules.events`
- `app_modules.event_games`
- `app_modules.event_external_refs`
- `app_modules.event_import_runs`

### Events

Enthält u. a.:

- ID
- Typ
- Titel
- Datum / Uhrzeit
- Enddatum / Endzeit
- Ort
- Beschreibung
- Sichtbarkeit
- Revision
- Audit-Akteure

### Event Games

Erweitert GAME-Termine um:

- Heim / Auswärts
- Gegner

### External Refs

Bindet externe ICS-UIDs stabil an bestehende Event-IDs.

### Import Runs

Dokumentiert bestätigte Importläufe inklusive Datei-Hash, Preview-Fingerprint und Ergebniszählern.

## 6. Nachgelagerte Konsumenten

Live bestehen Fremdschlüssel auf `app_modules.events(id)` aus folgenden Fachbereichen:

### Fanbus

- `fanbus_trips.event_id`
- `fanbus_prediction_games.event_id`
- `fanbus_publishing_event_places.event_id`
- `fanbus_publishing_jobs.event_id`

### Liveticker

- `liveticker_actions.event_id`
- `liveticker_game_states.event_id`
- `liveticker_graphic_jobs.event_id`
- `liveticker_journal.event_id`

### Social Media

- `app_social_media.liveticker_render_requests.event_id`

Damit ist bestätigt:

**Events / Spielplan ist eine vorgelagerte zentrale Fachdatenquelle und darf beim Umbau nicht in Fanbus, Liveticker oder Generator aufgehen.**

Bestehende Event-UUIDs müssen erhalten bleiben.

## 7. Erkannte aktuelle Querkopplung

`js/modules/dates.js` ruft derzeit zusätzlich:

- `fanbus_trips_list`

auf, um direkt in der Terminliste einen Badge/Link zu einer veröffentlichten Fanbusfahrt anzuzeigen.

Diese Kopplung wird **nicht** in das neue Events-Fachmodul übernommen.

Zielregel:

- Events besitzt die Termindaten.
- Fanbus besitzt Fahrten.
- Das Portal bzw. ein neutraler Modul-Navigationsvertrag darf beide Oberflächen verbinden.
- Events bekommt keine Fanbus-Fachlogik und führt keine Fanbus-Datenhaltung.

Für die Migration muss der bestehende Bedienkomfort erhalten werden, ohne die Fachgrenze wieder aufzuweichen.

## 8. Rechte

Zentrale Capability:

- `events.manage`

Die normale authentifizierte Terminansicht benötigt aktuell keine separate `events.read` Capability.

Diese Regel bleibt zunächst bestehen. Eine neue Read-Capability wird nicht nur wegen des Repo-Schnitts eingeführt.

## 9. Bestehende relevante Tests

Mindestens folgende aktuelle Verträge müssen beim neuen Repo ersetzt bzw. übernommen werden:

- `tests/m210_dates_frontend.test.mjs`
- `tests/m210_ics_import.test.mjs`
- `tests/m210_ics_parser.test.mjs`
- `tests/m210_ics_concurrency.integration.mjs`
- `tests/m310_m210_r1_contract.test.mjs`

Zusätzlich müssen beim Umbau die nachgelagerten Fanbus-, Liveticker- und Generator-Verträge weiterlaufen, weil sie Event-IDs und Eventdaten konsumieren.

## 10. Was im ersten Schnitt ausdrücklich unverändert bleibt

Beim Aufbau von `Plaerrdeifl/events` werden zunächst **nicht** verändert:

- Tabellen
- Event-UUIDs
- `pd_api`-Action-Namen
- `events.manage`
- öffentliche Event-RPC
- ICS-Datenbankfunktionen
- zentrale Supabase-Migrationshistorie
- Fanbus-, Liveticker- oder Generator-Datenmodelle
- PROD

Ziel des ersten Schritts ist ausschließlich, die bestehende Fachoberfläche reproduzierbar auf die neue React-/TypeScript-/Vite-Basis zu bringen.

## 11. Zielstruktur des Events-Repositories

Vorgesehene Struktur:

```text
events/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── calendar/
│   │   ├── event-editor/
│   │   └── ics-import/
│   ├── lib/
│   └── main.tsx
├── tests/
├── public/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Der ICS-Edge-Function-Code verbleibt bis zum späteren Backend-Cutover in der zentralen Supabase-Source. Das Events-Repo konsumiert dessen Vertrag, führt aber keine konkurrierende Migration oder Edge-Function-Source ein.

## 12. Paritätscheck für den Pilot

Vor der DEV-Umschaltung muss die neue Events-App nachweislich können:

- kommende Termine laden
- GAME/FANCLUB/OTHER korrekt darstellen
- PUBLIC/INTERNAL korrekt darstellen
- Suche und Filter
- Details
- Create
- Update mit Revision
- Delete mit Revision
- ICS Preview
- ICS Confirm
- stale Preview korrekt behandeln
- Fehlerzustände korrekt darstellen
- `events.manage` respektieren
- mobile und Desktop-Bedienung
- standalone starten
- aus dem Portal mit bestehender Session erreichbar sein

## 13. Nächster Implementierungsschritt

Nach diesem Inventar:

1. gemeinsamen minimalen Plattformvertrag für React/Vite festlegen
2. Events-Repo erzeugen
3. read-only Events-Liste als ersten vertikalen Slice implementieren
4. Auth + `events_list` gegen DEV verifizieren
5. erst danach Schreibfunktionen und ICS-Import ergänzen

Der bestehende Portal-Kalender bleibt bis zur vollständigen DEV-Abnahme aktiv.

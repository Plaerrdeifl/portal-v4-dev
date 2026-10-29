# Cockpit – kontrollierte Ablösung des alten DEV-Portal-Frontends

**Geltung:** DEV-only, Zielstruktur gemäß D-054 bis D-057. Ergänzende Migrationsanleitung; `ARCHITECTURE.md` und `DECISIONS.md` bleiben verbindlich. Dieses Dokument ist **kein Live-Status oder To-do-Snapshot**.

## 1. Ziel und Reihenfolge

Das **Fanszene Schweinfurt Cockpit ist das einzige neue Gesamtprodukt**. Die ursprünglich geplante separate Anwendung „Portal 2.0“ entfällt. Unter `https://dev.plaerrdeifl.de/` erscheint künftig direkt das Cockpit; solange Manifest/Worker auf `/cockpit/` begrenzt sind, ist ein geprüfter Root-Redirect dorthin die risikoärmere Einstiegslösung.

**Phase 1 (Produktstart):** Cockpit-Shell, Anmeldung, Benutzer-/Rechteverwaltung sowie Liveticker und Bildgenerator. **Danach**, in separatem Arbeitspaket, Bus-Orga/Fanbus in der neuen Struktur. Spätere Fachfunktionen werden einzeln entschieden und integriert. Kein Big-Bang und keine parallele Portal-2.0-Frontendanwendung.

## 2. Technischer Bestand: zunächst behalten

| Bereich | Schutzgrund |
|---|---|
| `Plaerrdeifl/fanszene-cockpit` und versioniertes Release unter `integrations/cockpit` | Einzige Cockpit-Implementierung, reproduzierbare DEV-Assets |
| `Plaerrdeifl/portal-v4-dev/supabase`, Supabase Auth/DB, `app_private` und `public.pd_api(text,jsonb)` | Zentrale Identitäten, sichere API, **einzige** führende DB-Migrationshistorie |
| Portal-Core-Laufzeitfunktionen, Login/Google/Supabase, OAuth/OIDC/Consent, notwendige Konfigurations- und API-Routen | Cockpit und andere Clients nutzen gemeinsame Identität und Verträge |
| Liveticker, Bildgenerator und zugehörige Fach-Repositories, Worker, Fachdaten und Fach-PWAs | Führende Fachlogik; Schutz bestehender Sportteam-/Kaderdaten |
| Fanbus-/Bus-Orga-Fachdaten, Buchungen, Trip-UUIDs, Gruppen- und Hauptbuchungsmodell sowie bestehende Fach-PWA | Spätere sichere Reintegration ohne Datenverlust |
| Notwendige Events-/Fachdaten und externe Integrationen (u. a. WPP, Nextcloud, WordPress, Mail) | Solange reale Abhängigkeit besteht |
| Audit-, Revisions-, Rechte- und Betriebsmechanismen | Kein Sicherheitsverlust durch Frontend-Ablösung |

**Nicht verwechseln:** Organisatorische Portalteams sollen **nicht** Teil des neuen Cockpit-Modells sein. Sportliche Mannschaften/Teamlogos/Kader bleiben bestehen. Alte `SOCIAL_MEDIA`-Team-/`portal.admin`-Rechtequellen sind aktuell Bestandteil von Generator/Nextcloud/WordPress-Verträgen und **nicht** vor der kontrollierten Rechteumstellung zu löschen.

## 3. Nur nach Abhängigkeitsnachweis als entfernbar markieren

Kandidaten sind ausschließlich alte **DEV-Portal-UI**-Artefakte, Dashboard-, Teamverwaltungs- und Navigationsoberflächen, deren Nutzung ersetzt wurde: z. B. historische Root-`index.html`-, `pages/`-, `components/`-, `js/modules/`- und CSS-/PWA-Assets. **Diese Pfade sind keine Freigabe zur Löschung**; einzelne Dateien können noch zentrale Login-/OAuth-/Generator-/Fanbus-/Worker-/Fachabhängigkeiten erfüllen.

Das gesamte Repo `portal-v4-dev`, `supabase/`, Migrationen, Datenbanken, Benutzer-/Auth-/Teamtabellen, `oauth/`, Fachmodule, Worker und Release-Metadaten dürfen nicht pauschal entfernt werden.

## 4. Gefährliche Übergänge / Abnahmeschutz

### Root, PWA und Routing

- Vor Root-Redirect verifizieren, was aktuell `/`, `/index.html`, `/portal/`, `/oauth/consent`, `/cockpit/` sowie Fachpfade liefern.
- Die alte Root-PWA kann bereits einen Worker mit Scope `/` installiert haben. Für bestehende Nutzer müssen dessen Caches, Updates und eventuelle Kontrollen über Fachpfade kontrolliert abgelöst werden; keine ungetesteten `skipWaiting`-/Unregister-/Cache-Löschaktionen und kein pauschaler Catch-all-Redirect.
- Cockpit-PWA behält zunächst `/cockpit/` als Manifest-/SW-/Asset-Scope; Fanbus, Liveticker und Generator bleiben isoliert.
- Redirect nicht auf OAuth-/API-/Runtime-/Asset- oder fremde Fachmodule ausweiten. Kontrolliere echte HTTP-Statuscodes, Redirect-Loops, Login/Logout, Offline-Kaltstart und Session-Rückkehr.
- Root-Einstieg und fachliche Benutzer-/Admin-Mutationen sind getrennte Abnahmen.

### READ_ONLY ist **kein** Cockpit-Sicherheitskonzept

Aktuell prüft das Cockpit-Frontend den globalen M900-Status, und die beiden Cockpit-Admin-Schreibactions sind serverseitig als `USER_MUTATION` eingestuft. Das bestehende `READ_ONLY` blockiert damit die Cockpit-Rechte-E2E. Eine automatische Freigabe von `platform.mode=NORMAL` wäre zu breit.

Der spätere, eigene Änderungsvertrag nach D-056 muss **nur** ausdrücklich benannte Cockpit-Actions unter gesonderter, auditierter Betriebsentscheidung erlauben; er muss Akteur, Cockpit-Rolle, Zielbenutzer, Revision, persönliche Capabilities, letzte Systemadministration, andere Module und Notfallsperren serverseitig absichern. Das Frontend muss den neuen Vertrag verstehen. Niemals `pd_api` pauschal vom Schutz entkoppeln.

### Kein neues organisatorisches Teammodell

Die neue Cockpit-Benutzerverwaltung nutzt appbezogene Rollen und persönliche Fach-Capabilities. Teamabgeleitete **effektive** Generator-/SSO-Rechte im Altbestand erst inventarisieren, fachlich zuordnen, migrationsgesichert umstellen und die Wirkung auf Nextcloud/WordPress prüfen, **dann** alte Teamzugänge abschalten. Kein stille Entzug und keine parallele Teamwelt.

## 5. Reihenfolge der gesonderten Umsetzungs-/Abnahme-Pakete

1. **Architekturentscheidung und Sicherheitsgrenzen verankern** (diese Dokumente; keine Runtime-Mutation).
2. **DEV-Root-Einstieg des Cockpits** nur nach Routen-/Root-SW-Abhängigkeitsinventar, Sicherung und Tests umstellen; altes Root-Frontend zunächst erhalten.
3. **Gezielte READ_ONLY-/Cockpit-Schreibvertragskorrektur** (Migrationen im allein führenden Supabase-Repo, UI im Cockpit-Source-Repo, versioniertes Release), keine globale Entsperrung.
4. **Vollständige authentifizierte AP-03/R3-DEV-E2E** mit genehmigten Testidentitäten und Revisions-/Rollen-/Rechteentzugtests, Testdaten-Restore.
5. **Legacy-DEV-Frontend stufenweise entfernen** erst nach nachgewiesenem Nichtgebrauch und Recovery-Test; Alt-Teamrechte separat migrieren, nicht mit UI-Löschung erzwingen.
6. **Bus-Orga integrieren**, erst wenn die aktive Cockpit-Hauptphase kontrolliert abgeschlossen/pausiert ist; Reisemodell und separate PWA bleiben.
7. Weitere Funktionen nur nach neuen fachlichen Freigaben.

Die Reihenfolge ist eine technische Schutz- und Abhängigkeitsreihenfolge, kein laufend gepflegtes Aufgabenregister. Pro technischem Chat gilt genau ein Arbeitspaket und ein aktiver Implementierer.

## 6. Sicherung, Rückfall und Release-Gates

Vor jeder Altlast-Entfernung nachweisen: Git-/Deployment-Restore-Punkt, vollständiges Pfad-/Asset-Inventar, Rückspielbarkeit der benötigten DEV-Daten und Sicherheits-/Auditdaten, Vergleich der Live-Verträge vor/nach Änderung und definierte Rückfallentscheidung. Keine destruktiven Git-Befehle, keine uncommitteten Daten überschreiben.

Vor „fertig“: CI, Tests/Build, Live-HTTP-/MIME-/Hashnachweise, OAuth/Login, autorisierte und abgelehnte Cockpit-Actions, PWA-Scopes, Fanbus/Liveticker/Generator, Worker-/Delivery-E2E bei betroffenen Diensten sowie reale Acer-Browserabnahme.

**PROD bleibt vollständig unverändert.** Die öffentliche WordPress-Website bleibt auf `plaerrdeifl.de/`, Portal 1.0 läuft weiter. Jegliche spätere PROD-Aktion erfordert explizite Freigabe nach D-053. DEV-Daten werden nicht nach PROD kopiert.

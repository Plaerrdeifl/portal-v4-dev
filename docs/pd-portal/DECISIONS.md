# PD-Portal – DECISIONS

**Stand:** 29.09.2026  
**Zweck:** Verbindliche fachliche und technische Entscheidungen. Diese Datei beschreibt Soll-Entscheidungen, nicht automatisch den aktuellen Implementierungs- oder Betriebsnachweis.

## D-001 – DEV und PROD bleiben strikt getrennt

**Entscheidung:** Entwicklung und Erprobung erfolgen grundsätzlich zuerst auf DEV. PROD-Änderungen brauchen eine eigene, konkrete Freigabe.

**Folge:** Ein funktionierender DEV-Stand ist keine automatische PROD-Freigabe.

## D-002 – Aktueller Ist-Zustand wird live verifiziert

**Entscheidung:** Tagesaktuelle technische Zustände werden nicht aus alten Chats oder Statusdateien übernommen.

Für Aussagen über aktuellen Code, CI, Deployment, Supabase, Runtime oder Fehler gilt der live verifizierte Zustand.

Ältere Chats dienen nur als Verlauf und Hinweis.

## D-003 – WPP ist das WhatsApp-Zielsystem

**Entscheidung:** Liveticker-WhatsApp läuft strategisch über WPP.

GOWS bleibt Altbestand/Backup. Keine Rückumstellung auf GOWS als normale Lösung.

## D-004 – Sticker sind eigenständige Ausgaben

**Entscheidung:**

- Sticker können solo gesendet werden.
- Sticker können mit Text kombiniert werden.
- Es gibt teambezogene und allgemeine Sticker.
- Sticker müssen teamspezifisch speicherbar sein.

## D-005 – Tor-Sequenz

**Entscheidung:** Ein Tor-Sticker darf sofort gesendet werden. Der Tor-Text darf ebenfalls sofort gesendet werden, auch wenn der Torschütze noch nicht bekannt ist. In diesem Fall muss die Bedienoberfläche vor dem Versand klar warnen (z. B. „Torschütze offen – trotzdem senden?“) und eine ausdrückliche Bestätigung verlangen. Ist der Torschütze bekannt, wird er regulär in den Tor-Text aufgenommen.

Fehlerzustände müssen transparent bleiben. Ein fehlgeschlagener Sticker darf nicht durch einen späteren Text so aussehen, als sei die komplette Sequenz erfolgreich gewesen.

## D-006 – Korrektur und Retry sind normale Bedienfälle

**Entscheidung:** Spieltagsbedienung muss Korrekturen, erneutes Senden und sinnvolle Retry-Pfade berücksichtigen.

Kein Design, das davon ausgeht, dass ein einzelner Klick immer perfekt funktioniert.

## D-007 – PROD hat keinen normalen Testspiel-Reset

**Entscheidung:** Reset-/Testhilfen gehören nach DEV/local. PROD zeigt die produktive Bedienoberfläche.

## D-008 – Archivierung nach FINAL-Output

**Entscheidung:** Ein Liveticker-Spiel wird im vorgesehenen Flow nach erfolgreicher neuer FINAL-Grafik archiviert. Final-Flyer sollen anschließend über das Archiv erreichbar sein.

## D-009 – Reisegruppe ist nicht gleich Buchungsnummer

**Entscheidung:** Mehrere Buchungen können einer Reisegruppe zugeordnet sein, ohne automatisch zu einer einzigen Buchung oder Buchungsnummer zu verschmelzen.

## D-010 – Hauptbuchung muss steuerbar sein

**Entscheidung:** Bei kompakten/verbundenen Buchungen muss die gewünschte Hauptbuchung auswählbar sein.

## D-011 – Bestehende Fanbus-Identitäten schützen

**Entscheidung:** Bestehende Trip-UUIDs und funktionierende Fanbus-Abläufe nicht ohne fachlichen Grund neu modellieren.

## D-012 – Datenbankänderungen werden migriert

**Entscheidung:** Dauerhafte Schema- und Datenmodelländerungen erfolgen über versionierte Migrationen.

Keine schnelle manuelle PROD-Schemaänderung als Endlösung.

## D-013 – Security Default-Deny

**Entscheidung:**

- Browser arbeitet über die vorgesehene API-/RPC-Grenze.
- Keine pauschalen neuen Rechte.
- `service_role` nicht in Browsercode.
- Neue Funktionen und Rechte explizit freigeben.
- Release-Bypass bleibt strikt benutzergebunden.

## D-014 – Nicht vorschnell „grün“ melden

**Entscheidung:** Code vorhanden ≠ fertig. Commit vorhanden ≠ deployed. Deployment vorhanden ≠ live funktionierend.

Fertigmeldung erst nach den für das Thema relevanten Tests und/oder Live-Prüfungen.

## D-015 – Nextcloud-Berechtigung aus Portal-Team

**Entscheidung:** Der gewünschte Social-Media-Zugriff auf Nextcloud wird aus der Portal-Teamzugehörigkeit abgeleitet.

Kein paralleles, unabhängig gepflegtes Berechtigungsmodell aufbauen, wenn es technisch nicht erforderlich ist.

## D-016 – Mitgliedschaft ist keine einfache Portalrolle

**Entscheidung:** „Mitglied“ wird fachlich über die Verknüpfung zum aktiven Mitglied modelliert, nicht als einfache globale Portalrolle.

## D-017 – Dauerhafte Dokumentation bleibt bewusst klein

**Entscheidung:** Dauerhaft gepflegt werden nur stabile Architektur und verbindliche Entscheidungen.

Tagesaktuelle SHAs, Testzahlen, Deployments, Betriebszustände und To-do-Listen werden nicht als dauerhaft zu pflegende Snapshot-Dateien geführt.

## D-018 – Veraltete Lösungen nicht automatisch wiederbeleben

**Entscheidung:** Wenn ein Problem heute auftritt, zuerst den aktuellen Stack analysieren.

Eine frühere Zwischenlösung darf nicht allein deshalb zurückkehren, weil sie in einem alten Chat beschrieben wurde.

## D-019 – Alte Statusdateien sind außer Betrieb

**Entscheidung:** `CURRENT_STATE.md` und `OPEN_TASKS.md` sind keine aktiven Projektquellen mehr.

Erwähnungen dieser Dateien in älteren Projektchats sind historisch und dürfen keine Suche nach diesen Dateien oder eine Verwendung alter Inhalte auslösen.

Offene Punkte werden aus Projektverlauf und aktuellem Live-Zustand ermittelt.

## D-020 – Entscheidung ist kein Implementierungsnachweis

**Entscheidung:** Ein Eintrag in `DECISIONS.md` beschreibt den verbindlichen Soll-Zustand.

Ob die Funktion tatsächlich implementiert, deployed und funktionsfähig ist, muss bei Bedarf separat über Code, Datenbank, Runtime und Tests bestätigt werden.


## D-021 – Social-Media-Generator ist eigenständige PWA mit gemeinsamem Backend

**Entscheidung:** Der Social-Media-Generator wird als eigenständige React-/TypeScript-/Vite-PWA im Repository `Plaerrdeifl/social-media-generator` geführt. Er nutzt die bestehende Supabase-/Portal-Identität, die zentrale API-Grenze und die gemeinsamen Plattformdaten.

Ein zweites unabhängiges Benutzer-, Spiel-, Team- oder Fanbus-System wird nicht aufgebaut.

## D-022 – Zentrale Plattformdaten bleiben Source of Truth

**Entscheidung:** Spiele, Teams, Fanbusfahrten, Benutzer, Berechtigungen und zentrale Teamidentität bleiben in der bestehenden Plattform führend.

Der Generator darf lokale Overrides und aufbereitete Medienvarianten führen, schreibt manuelle Grafikänderungen aber nicht still in die Plattform zurück und überschreibt lokale Änderungen nicht still mit späteren Zentralwerten.

## D-023 – Strukturiertes Grafikdokument ist Source of Truth

**Entscheidung:** Vorlagen und Entwürfe basieren auf einem strukturierten Grafik-Dokumentmodell mit stabilen technischen Element-IDs, Datenbindungen, Gruppen und effektiven Stilen.

SVG ist vollständige Darstellung und Austauschformat mit Generator-Metadaten, aber nicht die alleinige Datenquelle. Import/Reimport darf bei uneindeutiger Zuordnung niemals raten.

## D-024 – Vorlagen, Pakete und Exporte sind versioniert

**Entscheidung:** Vorlagen und Paket-Vorlagen besitzen versionierte Draft-/Published-Stände. Bestehende Entwürfe bleiben an konkrete Vorlagenversionen gebunden. Updates, zentrale Datenänderungen und neue Medienversionen werden sichtbar angeboten und niemals still übernommen.

Autosave ersetzt keine sichtbare fachliche Version. Exporte referenzieren eine konkrete Entwurfsversion.

## D-025 – Generator-Browserzugriff bleibt über `pd_api` und Default-Deny

**Entscheidung:** Generator-Funktionen nutzen die bestehende Browsergrenze `public.pd_api(text, jsonb)`. Generatorinterne Tabellen liegen im privaten Schema `app_social_media`. Autorisierung erfolgt serverseitig, Browser erhalten keine freien Tabellenrechte und `service_role` bleibt ausschließlich serverseitig.

Zentrale Plattform-/Supabase-Migrationen werden während der Modularisierung weiterhin in `Plaerrdeifl/portal-v4-dev` geführt; das Generator-Repository bekommt keine konkurrierende zweite Datenbankhistorie. Ein späterer Wechsel in ein gemeinsames Backend-Repository ist nur als eigener, ausdrücklich freigegebener und atomarer Cutover zulässig.

## D-026 – Generatorzugriff nutzt bestehende Plattformidentität

**Entscheidung:** Zugriff erfolgt über bestehende Plattformbenutzer. `social_media_generator.use` ist die fachliche Generator-Berechtigung; aktive Mitglieder des Portal-Teams `SOCIAL_MEDIA` erhalten ebenfalls Zugriff. `portal.admin` bleibt zentraler Admin-Wildcard.

Normal- und Expert-Modus gehören zum Generator. In V1 ist der Expert-Modus eine benutzerspezifische Einstellung; eine spätere eigene Capability bleibt möglich.

## D-027 – Finales Rendering erfolgt serverseitig über eigenen Worker

**Entscheidung:** Finale PNG-Ausgaben werden serverseitig über einen eigenen `social-media-render-worker` erzeugt. Bestehende Liveticker- und M340-Worker werden dafür nicht umgebaut.

Supabase hält den Fachzustand, Acer dient als Rechenlaufzeit und temporäre Ablage, Nextcloud als sichtbare gemeinsame Dateiablage. Browser und Renderer verwenden dieselben Grafikgrundlagen und Fonts.

## D-028 – Nextcloud ist Dateiablage, nicht Generator-Datenbank

**Entscheidung:** Der Browser schreibt niemals direkt nach Nextcloud. Schreiben erfolgt ausschließlich über Backend/Worker-Serviceaccount.

Nextcloud dient für große/geteilte Medien und sichtbare finale Dateien; Supabase bleibt die führende fachliche Datenhaltung. Generatorzustand darf nicht durch direkte Dateiumbenennungen oder -löschungen umgangen werden.

## D-029 – Bestehender Liveticker und Fanbus-Generator bleiben während V1 geschützt

**Entscheidung:** Der aktuelle Liveticker und der bestehende Fanbus-Flyergenerator bleiben während des Generatoraufbaus funktional unangetastet und parallel nutzbar.

Der neue Generator darf deren zentrale Daten konsumieren und manuelle Backup-Grafiken erzeugen, ersetzt die bestehenden Abläufe aber erst nach eigener, ausdrücklich freigegebener Migration.

## D-030 – Generator-V1 wird in vier Arbeitsphasen umgesetzt

**Entscheidung:** Die vereinbarte Arbeitsreihenfolge lautet:

1. Grundsystem
2. Vorlagen & Pakete
3. Rendering & Nextcloud
4. Spieltag/Fanbus & Feinschliff

Diese Phasen sind Arbeitsorganisation und keine zusätzliche Facharchitektur.

## D-031 – Generator-PROD wird gezielt freigegeben, nicht automatisch aus `main` aktualisiert

**Entscheidung:** Entwicklung erfolgt lokal/gegen DEV-Supabase. Für PROD wird ein konkreter getesteter Stand ausgewählt und ausdrücklich freigegeben. Ein Commit auf `main` löst keine automatische fachliche PROD-Freigabe aus. Frontend und Renderer werden getrennt betrachtet.

Das langfristige kanonische PROD-Ziel ist `https://plaerrdeifl.de/generator`. Eine eigenständige Generator-Subdomain ist kein verbindliches Ziel mehr. Acer ist nicht der Frontend-Host.

## D-032 – Generator-V1 braucht gezielte Tests und echten E2E vor PROD

**Entscheidung:** Automatische Tests konzentrieren sich auf Dokumentmodell, Versionierung, Paketdaten/Overrides, SVG-Import/-Export und Sanitizing, Rechte/API, Renderjob-Logik, Browser-/Worker-Kompatibilität und relevante Renderfälle.

Vor einer PROD-Freigabe ist mindestens ein echter End-to-End-Test mit einem realen Medienpaket erforderlich. Harte Vorlagenfehler blockieren; Warnungen können bewusst übergangen werden.

## D-033 – Teams, Kader und Teamlogos bleiben zentrale Liveticker-Stammdaten

**Entscheidung:** Mannschaften und Kader werden zentral im Liveticker verwaltet. Die führenden Fachdaten liegen in `app_modules.liveticker_teams` und `app_modules.liveticker_players`. Der Social-Media-Generator konsumiert diese Daten und baut keine zweite Team- oder Kaderverwaltung auf.

Teamlogos werden zentral in Supabase Storage im Bucket `liveticker-team-logos` gehalten. Die Teamtabelle enthält die zugehörige Storage-Referenz und Metadaten. Änderungen an Teamlogos erfolgen über die Liveticker-Teamverwaltung.

Nextcloud ist für Teamlogos nicht die führende Quelle. Eine dort sichtbare Kopie kann für die menschliche Nutzung existieren, darf aber nicht Voraussetzung für Liveticker oder Generator sein.

## D-034 – Das Gesamtprodukt heißt PD-Portal

**Entscheidung:** Das Gesamtsystem wird fachlich und in der Kommunikation als **PD-Portal** bzw. **Portal** bezeichnet.

„Digitalplattform V4“ ist kein fortzuführender Produktname. Bestehende technische Namen wie `portal-v4-dev`, historische Migrationsbezeichner oder Legacy-Pfade dürfen während der kontrollierten Migration bestehen bleiben, bis ihre Umbenennung technisch sinnvoll und separat freigegeben ist.

## D-035 – Das PD-Portal wird modularisiert, nicht als Big-Bang neu geschrieben

**Entscheidung:** Große Fachdomänen werden schrittweise in klar abgegrenzte Repositories und Anwendungen überführt.

Die Zielgrenzen umfassen insbesondere:

- Portal-Core
- Platform UI
- Events
- Fanbus
- Liveticker
- Social-Media-Generator
- Members
- Finance
- Tasks
- Mail
- Shop-/WordPress-Integration
- perspektivisch Platform Backend

Bestehende produktive Abläufe bleiben bis zur nachgewiesenen Ablösung bestehen. Alter Fachcode wird erst nach getesteter DEV-Parität und kontrollierter Umschaltung entfernt.

## D-036 – Neue Fachfrontends verwenden React, TypeScript und Vite

**Entscheidung:** Neue eigenständige Fachanwendungen werden grundsätzlich auf React + TypeScript + Vite ausgerichtet.

Gemeinsame technische Plattformlogik wird über gemeinsame Pakete bzw. `Plaerrdeifl/platform-ui` bereitgestellt. Dazu gehören insbesondere Runtime-Konfiguration, Supabase-Client, Session/Auth, `pd_api`-Client, Bootstrap, Capability-Prüfung, Google-Login, Fehlerbehandlung und gemeinsame UI-Grundlagen.

Fachlogik bleibt im jeweiligen Fachrepository.

## D-037 – Events ist die zentrale Termin- und Spielplan-Fachquelle

**Entscheidung:** Kalender, Spielplan und allgemeine Veranstaltungen bilden eine eigene Events-Domäne im Repository `Plaerrdeifl/events`.

Die bestehenden zentralen Event-IDs und Eventtabellen bleiben führend. Fanbus, Liveticker und Social-Media-Generator dürfen Events konsumieren, bauen aber keinen zweiten Spielplan auf.

Cross-Modul-Komfortfunktionen werden über stabile IDs und Integrations-/Navigationsverträge gelöst; Events übernimmt keine Fanbus-, Liveticker- oder Generator-Fachlogik.

## D-038 – Standalone-Fachmodule bleiben vollständig ins Portal integriert

**Entscheidung:** Eigenständige Fachanwendungen wie Events, Liveticker oder Generator dürfen direkt aufrufbar sein und werden gleichzeitig vollständig in das PD-Portal integriert.

Das Portal wird nicht zu einem bloßen Link-Hub. Es gibt keine zweite Portalimplementierung derselben Fachfunktion und kein iframe als Standardarchitektur für interne Fachmodule.

## D-039 – WordPress bleibt öffentliche Website- und WooCommerce-Schicht

**Entscheidung:** WordPress bleibt für öffentliche Website-Inhalte, News/Content, WooCommerce und öffentliche Einstiege in ausgewählte Portalprozesse zuständig.

WordPress wird keine zweite führende Datenhaltung für Portalbenutzer, Portalteams, Mitglieder, Events, Fanbus, Liveticker, Tasks, Finance oder Generator.

Fachdaten stammen aus dem jeweils zuständigen PD-Portal-Modul bzw. werden über definierte Integrationsschnittstellen konsumiert.

## D-040 – WordPress-Login für berechtigte Nutzer wird an die Portalidentität gekoppelt

**Entscheidung:** WordPress wird als eigener Portal-OAuth/OIDC-/SSO-Client angebunden.

Insbesondere berechtigte Mitglieder des Social-Media-Teams sollen WordPress über ihre bestehende PD-Portal-Identität verwenden können. Die führende Zugangsentscheidung bleibt im Portal.

WordPress darf lokale technische Benutzer für Autoren, Revisionen und WordPress-interne Zuordnung führen. Lokale WordPress-Rollen werden minimal vergeben und ersetzen nicht die zentrale Portalberechtigung.

Der bestehende Nextcloud-spezifische Consent-Flow wird dafür zu einem clientbezogenen allgemeinen Portal-Identity-Flow weiterentwickelt, ohne den funktionierenden Nextcloud-Zugang zurückzubauen.

## D-041 – Mail wird eigenes Portal-Fachmodul mit serverseitigem Gateway

**Entscheidung:** Berechtigte Portalnutzer sollen bestehende Funktionspostfächer über ein eigenes Mail-Modul verwenden können.

Zielrepository ist `Plaerrdeifl/mail`. Das Frontend nutzt die gemeinsame Portalidentität und zentrale Rechte. Der Zugriff auf den Mailprovider erfolgt ausschließlich über einen serverseitigen Mail-Gateway per IMAP/SMTP bzw. den jeweils dafür geeigneten Provider-Schnittstellen.

Mailbox-Passwörter, SMTP-/IMAP-Credentials oder andere Provider-Secrets dürfen nicht im Browser, in LocalStorage oder in frei lesbaren Anwendungstabellen landen.

Der Mailprovider bleibt Source of Truth für Nachrichten, Ordner, Flags und Anhänge. Das Portal hält nur den für Berechtigungen, Audit und optionale Fachverknüpfungen nötigen Zustand.

## D-042 – Zentrale Supabase-Migrationshistorie bleibt bis zum atomaren Backend-Cutover eindeutig

**Entscheidung:** Während der Modularisierung bleibt `Plaerrdeifl/portal-v4-dev/supabase` die einzige führende zentrale Migrationshistorie.

Ein zukünftiges `Plaerrdeifl/platform-backend` darf diese Verantwortung erst in einem eigenen, ausdrücklich freigegebenen und vollständig verifizierten Cutover übernehmen. Es gibt niemals zwei konkurrierende aktive Migration-Sources.

## D-043 – Modularisierungsarbeiten folgen einer einzigen aktiven Hauptphase

**Entscheidung:** Der große Portalumbau wird kontrolliert nacheinander durchgeführt.

Neue Ideen und spätere Module dürfen jederzeit geplant und dokumentiert werden. Eine neue größere Migrationsbaustelle wird aber nicht ungeordnet parallel begonnen, solange die aktuell priorisierte Hauptphase noch nicht ihre definierten Abnahmekriterien erreicht hat.

Ausgenommen sind notwendige Fehlerbehebungen, Sicherheitsprobleme oder ausdrücklich separat freigegebene dringende Betriebsarbeiten.



## D-044 – Kanonische Portal- und Modulpfade liegen unter der gemeinsamen Vereinsdomain

**Entscheidung:** Die langfristigen Benutzeradressen des PD-Portals und seiner Fachmodule werden unter der gemeinsamen Vereinsdomain geführt.

PROD:

- `https://plaerrdeifl.de/` → öffentliche WordPress-Website
- `https://plaerrdeifl.de/portal` → Portal-Core / Dashboard
- `https://plaerrdeifl.de/events` → Events
- `https://plaerrdeifl.de/fanbus` → Fanbus
- `https://plaerrdeifl.de/liveticker` → Liveticker
- `https://plaerrdeifl.de/generator` → Social-Media-Generator
- `https://plaerrdeifl.de/members` → Members
- `https://plaerrdeifl.de/finance` → Finance
- `https://plaerrdeifl.de/tasks` → Tasks
- `https://plaerrdeifl.de/mail` → Mail

DEV spiegelt dieselbe Pfadstruktur unter `https://dev.plaerrdeifl.de`.

Die öffentliche WordPress-Website bleibt auf `/`. Für PROD wird eine vorgeschaltete Pfad-Routing-Schicht vorgesehen, die die Portal-/Modulpfade an ihre Anwendungen und alle übrigen Websitepfade weiterhin an WordPress/Lima-City routet. Cloudflare ist dafür die vorgesehene Routing-Ebene.

DNS-/Nameserver-Änderungen, Cloudflare-Routing und Redirects sind eigene PROD-Infrastrukturänderungen und werden erst nach vollständigem DNS-/Mail-Inventar, Test und ausdrücklicher PROD-Freigabe umgesetzt.

`portal.plaerrdeifl.de` bleibt während der Migration höchstens Übergangsadresse und soll nach dem Cutover auf `https://plaerrdeifl.de/portal` weiterleiten. Eigenständige Modul-Subdomains wie `generator.plaerrdeifl.de` sind kein langfristiges kanonisches Ziel.

Jede PWA muss Router-, Asset- und Service-Worker-Scope auf ihren eigenen Pfad begrenzen, damit kein Modul andere Portalpfade kontrolliert.

## D-045 – Portal 2.0 wird vollständig auf DEV aufgebaut und gemeinsam nach PROD umgeschaltet

**Entscheidung:** Während des Gesamtumbaus bleibt das bestehende PROD-System als Portal 1.0 in Betrieb. Das neue PD-Portal wird vollständig auf DEV aufgebaut, dort Modul für Modul integriert und als Gesamtsystem abgenommen.

Es erfolgt grundsätzlich **kein regulärer modulweiser Portal-2.0-Cutover nach PROD**. Notwendige Fehlerbehebungen, Sicherheitskorrekturen und dringende Betriebsarbeiten an Portal 1.0 bleiben davon unberührt.

Vor der gemeinsamen PROD-Freigabe muss ein vollständiger Release Candidate auf DEV bestehen. Dazu gehören insbesondere Portal-Core, Events, Fanbus, Liveticker, Social-Media-Generator und die bis dahin freigegebenen weiteren Module sowie die zugehörigen Auth-, Worker-, Routing- und Integrationspfade.

DEV-Daten werden nicht nach PROD kopiert. Datenbankänderungen bleiben reproduzierbare Migrationen und werden vor dem Cutover gegen einen aktuellen isolierten PROD-Datenstand geprobt.

Der spätere PROD-Wechsel ist ein koordinierter Cutover mit Recovery-Punkt, ggf. kontrolliertem Write-Freeze, Migrationen, Backend-/Worker-/Frontend-Aktivierung, Domain-/Pfadrouting und anschließendem echten End-to-End-Smoke-Test. Portal 1.0 wird unmittelbar danach nicht vorschnell gelöscht, sondern zunächst als begrenzte Rückfallebene erhalten.

## D-046 – Für Benutzer gibt es eine gemeinsame installierbare PD-Portal-PWA

**Entscheidung:** Das neue PD-Portal wird für Benutzer als **eine gemeinsame installierbare PWA** angeboten. Fachmodule wie Events, Fanbus, Liveticker und Social-Media-Generator bleiben technisch getrennte Module/Builds und direkt per URL erreichbar, werden aber nicht als mehrere konkurrierende Pflicht-PWAs positioniert.

Die gemeinsame PWA darf die öffentliche WordPress-Website unter `https://plaerrdeifl.de/` nicht durch einen zu breiten Service-Worker-Scope kontrollieren. Manifest-, Routing- und Service-Worker-Scope werden deshalb in Phase 1 auf DEV verbindlich implementiert und abgenommen, bevor das Installationsmodell nach PROD geht.

Die bestehende Portal-1.0-PWA unter `portal.plaerrdeifl.de` kann aufgrund des Origin-Wechsels nicht still in die neue PWA unter `plaerrdeifl.de` migriert werden. Für den PROD-Cutover wird deshalb ein geführter Wechsel vorgesehen: letzte Alt-PWA-Version mit deutlichem Hinweis und Link, optionaler Push-Hinweis, Installationshilfe im neuen Portal und Redirect der alten Portaladresse.

## D-047 – Projektweite Architekturdateien werden in vorhandene Repositories gespiegelt

**Entscheidung:** Die für die aktuelle Portal-2.0-Planung relevanten projektweiten Architekturdateien werden als synchronisierte Kopien unter `docs/pd-portal/` in allen bestehenden PD-Portal-Repositories abgelegt.

Die Spiegelung erzeugt keine neue fachliche Source of Truth. Für die Projektarbeit bleiben `ARCHITECTURE.md` und `DECISIONS.md` im ChatGPT-Projekt die verbindlichen Hauptquellen; die Repo-Kopien dienen Entwicklern und Coding-Agenten als lokaler Kontext. Projektweite Änderungen an diesen Dokumenten müssen kontrolliert auf die vorhandenen Repo-Spiegel übertragen werden, damit keine abweichenden lokalen Varianten entstehen.

## D-048 – Technische Chats haben einen festen Lifecycle mit Pflicht-Handoff

**Entscheidung:** Ein technischer Projektchat bearbeitet genau ein klar abgegrenztes Arbeitspaket. Chatwechsel werden nicht von einer geschätzten Rest-Kontextlänge abhängig gemacht, sondern an objektive Arbeitsgrenzen gekoppelt.

Ein neuer Chat ist spätestens verpflichtend, wenn mindestens einer dieser Punkte eintritt:

- eine neue Hauptphase beginnt,
- ein anderes Fachmodul oder Repository zum neuen Hauptgegenstand wird,
- das aktuelle Arbeitspaket nach Implementierung, PR/Merge, Migration oder DEV-Abnahme abgeschlossen ist und das nächste eigenständige Paket beginnt,
- der ursprüngliche Scope wesentlich erweitert werden müsste,
- innerhalb desselben Chats bereits ein vollständiger größerer Zyklus aus Analyse → Änderung → Test/Abnahme abgeschlossen wurde und nun ein weiterer eigenständiger Zyklus folgen würde.

Vor dem Wechsel erstellt der laufende Chat zwingend einen **Handoff** mit mindestens:

1. Ziel und Scope des abgeschlossenen Chats,
2. zuletzt live verifiziertem Ist-Zustand,
3. betroffenen Repositories, Branches, PRs und relevanten Commit-SHAs,
4. vorgenommenen Änderungen,
5. durchgeführten Tests und deren Ergebnis,
6. offenen, unbekannten oder noch zu verifizierenden Punkten,
7. ausdrücklichem PROD-Status – insbesondere ob PROD unverändert blieb,
8. exakt einem benannten nächsten Arbeitspaket,
9. den Zuständen, die der neue Chat vor Änderungen erneut live prüfen muss.

Nach Ausgabe des Handoffs beginnt im alten Chat keine neue substanzielle Implementierung mehr. Zulässig sind nur noch Korrekturen oder Ergänzungen am Handoff selbst.

Der neue Chat liest zuerst `ARCHITECTURE.md` und `DECISIONS.md`, übernimmt den Handoff nur als Verlauf und verifiziert veränderliche technische Zustände erneut live. Ein Handoff ist kein Ersatz für aktuelle GitHub-, Supabase-, CI-, Deployment- oder Runtime-Prüfungen.

Wenn unklar ist, ob ein neuer Arbeitsschritt noch zum bestehenden Paket gehört, wird zugunsten eines **neuen Chats** entschieden. Der Benutzer muss den Chatwechsel nicht selbst anmahnen.
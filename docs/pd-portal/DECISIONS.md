# Cockpit – DECISIONS (vormals PD-Portal)

**Stand:** 29.10.2026  
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

## D-015 – Historischer Nextcloud-Teamvertrag (Ablösung nach D-055)

**Übergang:** Bestehende Nextcloud-/WordPress-Zugänge dürfen nicht durch Entfernen von Teamdaten unterbrochen werden. Als neues Cockpit-Zielmodell werden organisatorische Portalteams als Rechtequelle abgelöst; Migration der tatsächlichen Fremdclient-Rechte und -Verträge nur kontrolliert nach D-055.

**Bisherige Entscheidung:** Der gewünschte Social-Media-Zugriff auf Nextcloud wird aus der Portal-Teamzugehörigkeit abgeleitet.

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

**Übergang nach D-055:** Team- und Portaladmin-abgeleitete Generatorrechte existieren im Altvertrag weiterhin; sie werden nicht unkontrolliert gelöscht oder als neue Cockpit-Rechtequelle perpetuiert. Ziel sind explizite, fachbezogene persönliche Capabilities mit kontrollierter Bestandsmigration und geprüfter Kompatibilität.

**Bisheriger Fachvertrag:** Zugriff erfolgt über bestehende Plattformbenutzer. `social_media_generator.use` ist die fachliche Generator-Berechtigung; aktive Mitglieder des Portal-Teams `SOCIAL_MEDIA` erhalten ebenfalls Zugriff. `portal.admin` bleibt zentraler Admin-Wildcard.

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

## D-034 – Produktname: Cockpit löst PD-Portal als Entwicklungsziel ab

**Aktualisierung durch D-054:** Das neue Gesamtprodukt heißt **Cockpit** (Fanszene Schweinfurt Cockpit). **PD-Portal/Portal 2.0 ist kein eigenständiges neues Zielprodukt mehr.** „Portal 1.0“, „Portal-Core“ und `portal-v4-dev` dürfen als Bezeichnungen des produktiven Altbestands beziehungsweise der weiterhin notwendigen technischen Plattform bestehen bleiben. Eine technische Umbenennung hat keinen Vorrang vor einer sicheren Ablösung.

## D-035 – Das Cockpit wird modularisiert, nicht als Big-Bang neu geschrieben

**Aktualisierung durch D-054:** Große Fachdomänen werden schrittweise in das Cockpit als gemeinsames Zielprodukt mit klar abgegrenzten führenden Fachrepositories integriert. Ein separates Portal-2.0-Frontend wird nicht zusätzlich aufgebaut.

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

## D-038 – Standalone-Fachmodule bleiben vollständig ins Cockpit integriert

**Aktualisierung durch D-054:** Eigenständige Fachanwendungen wie Liveticker, Generator und später Bus-Orga bleiben direkt aufrufbar und werden zugleich vollständig in das Cockpit integriert.

Das Cockpit wird nicht zu einem bloßen Link-Hub. Es gibt keine zweite Portalimplementierung derselben Fachfunktion und kein iframe als Standardarchitektur für interne Fachmodule.

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

**Kontrollierter Hauptphasenwechsel:** Eine Hauptphase darf nach ausdrücklicher Koordinatorentscheidung auch **kontrolliert pausiert** werden, wenn Quellcode, offene PRs, Integrationsstand, fehlende Abnahmen und Wiederaufnahmepunkt nachvollziehbar gesichert und von einer vollständigen Fachabnahme unterschieden sind. Eine pausierte Hauptphase wird bis zur ausdrücklich freigegebenen Wiederaufnahme nicht parallel als zweite Hauptimplementierung fortgesetzt. Dringende Ausnahmen bleiben separat freigabepflichtig.

## D-044 – Kanonische Portal- und Modulpfade liegen unter der gemeinsamen Vereinsdomain

**Entscheidung:** Die langfristigen Benutzeradressen des PD-Portals und seiner Fachmodule werden unter der gemeinsamen Vereinsdomain geführt.

PROD:

- `https://plaerrdeifl.de/` → öffentliche WordPress-Website
- `https://plaerrdeifl.de/portal` → Portal-Core / Dashboard
- `https://plaerrdeifl.de/cockpit/` → Fanszene Schweinfurt Cockpit
- `https://plaerrdeifl.de/events` → Events
- `https://plaerrdeifl.de/fanbus` → Fanbus
- `https://plaerrdeifl.de/liveticker` → Liveticker
- `https://plaerrdeifl.de/generator` → Social-Media-Generator
- `https://plaerrdeifl.de/members` → Members
- `https://plaerrdeifl.de/finance` → Finance
- `https://plaerrdeifl.de/tasks` → Tasks
- `https://plaerrdeifl.de/mail` → Mail

**DEV-Ziel ab D-054:** `https://dev.plaerrdeifl.de/` eröffnet künftig unmittelbar das Cockpit (beispielsweise durch einen geprüften Redirect nach `/cockpit/`, solange die Cockpit-PWA auf diesen Scope begrenzt ist). Die alte Portal-Root-Oberfläche ist kein neues Zielprodukt. PROD-Root bleibt ausdrücklich die WordPress-Website; keine implizite PROD-Routingänderung.

DEV spiegelt bis zur kontrollierten Umstellung dieselbe Pfadstruktur unter `https://dev.plaerrdeifl.de`.

Die öffentliche WordPress-Website bleibt auf `/`. Für PROD wird eine vorgeschaltete Pfad-Routing-Schicht vorgesehen, die die Portal-/Modulpfade an ihre Anwendungen und alle übrigen Websitepfade weiterhin an WordPress/Lima-City routet. Cloudflare ist dafür die vorgesehene Routing-Ebene.

DNS-/Nameserver-Änderungen, Cloudflare-Routing und Redirects sind eigene PROD-Infrastrukturänderungen und werden erst nach vollständigem DNS-/Mail-Inventar, Test und ausdrücklicher PROD-Freigabe umgesetzt.

`portal.plaerrdeifl.de` bleibt während der Migration höchstens Übergangsadresse und soll nach dem Cutover auf `https://plaerrdeifl.de/portal` weiterleiten. Eigenständige Modul-Subdomains wie `generator.plaerrdeifl.de` sind kein langfristiges kanonisches Ziel.

Jede PWA muss Router-, Asset- und Service-Worker-Scope auf ihren eigenen Pfad begrenzen, damit kein Modul andere Portalpfade kontrolliert.

## D-045 – Historische Portal-2.0-Gesamtreleaseplanung (durch D-054 ersetzt)

**Status ab 29.10.2026:** Das separate Zielprodukt und der gemeinsame Portal-2.0-Cutover sind **abgelöst**. Es gilt D-054 mit Cockpit als einzigem neuem Gesamtprodukt, und für jeden PROD-Release gelten die Sicherheits-/Freigabebedingungen aus D-053. Der folgende Text dokumentiert den vorherigen Plan und ist **keine fortgeltende eigenständige Zielvorgabe**.

**Historische Entscheidung:** Während des Gesamtumbaus bleibt das bestehende PROD-System als Portal 1.0 in Betrieb. Das neue PD-Portal wird vollständig auf DEV aufgebaut, dort Modul für Modul integriert und als Gesamtsystem abgenommen.

Es erfolgt grundsätzlich **kein regulärer modulweiser Portal-2.0-Cutover nach PROD**. Notwendige Fehlerbehebungen, Sicherheitskorrekturen und dringende Betriebsarbeiten an Portal 1.0 bleiben davon unberührt.

Vor der gemeinsamen PROD-Freigabe muss ein vollständiger Release Candidate auf DEV bestehen. Dazu gehören insbesondere Portal-Core, Events, Fanbus, Liveticker, Social-Media-Generator und die bis dahin freigegebenen weiteren Module sowie die zugehörigen Auth-, Worker-, Routing- und Integrationspfade.

DEV-Daten werden nicht nach PROD kopiert. Datenbankänderungen bleiben reproduzierbare Migrationen und werden vor dem Cutover gegen einen aktuellen isolierten PROD-Datenstand geprobt.

Der spätere PROD-Wechsel ist ein koordinierter Cutover mit Recovery-Punkt, ggf. kontrolliertem Write-Freeze, Migrationen, Backend-/Worker-/Frontend-Aktivierung, Domain-/Pfadrouting und anschließendem echten End-to-End-Smoke-Test. Portal 1.0 wird unmittelbar danach nicht vorschnell gelöscht, sondern zunächst als begrenzte Rückfallebene erhalten.

**Ausdrücklich begrenzte Ausnahme – Fanszene Schweinfurt Cockpit (D-053):** Nur für das Cockpit und seine zwingend notwendigen, mit Portal 1.0 kompatiblen Backend-, Worker- und Fachabhängigkeiten darf nach vollständiger gesonderter Prüfung ein eigener PROD-Release vorbereitet und ausdrücklich freigegeben werden. Der Release des Cockpits ist weder eine allgemeine Modul-für-Modul-Freigabe noch der gemeinsame Portal-2.0-Cutover; die übrigen Module, Portal 1.0 und alle bisherigen Schutzregeln bleiben unberührt. Die Architekturentscheidung erlaubt **jetzt keine** PROD-Änderung.

## D-046 – Historisches PD-Portal-PWA-Zielbild (durch D-054 ersetzt)

**Status ab 29.10.2026:** Die Cockpit-PWA wird der normale gemeinsame Einstieg des neuen Produkts. Eine zweite Portal-2.0-PWA als parallele Zielanwendung wird **nicht** aufgebaut. Fach-PWAs für Liveticker, Generator und später Bus-Orga bleiben eigenständig installierbar, mit getrennten Scopes. Alte Root-/Portal-PWAs werden nur nach verifiziertem Übergang abgelöst; siehe D-057. Der folgende Text dokumentiert das frühere Zielbild.

**Historische Entscheidung:** Für die reguläre Portalnutzung gibt es **eine gemeinsame installierbare PD-Portal-PWA** als normalen Benutzereinstieg. Benutzer müssen nicht mehrere PWAs installieren, um das Portal und seine Fachfunktionen regulär zu verwenden. Die Fachanwendungen bleiben über die zentrale Portalnavigation integriert und zugleich unter ihren eigenen URLs direkt erreichbar; pro Fachfunktion gibt es nur eine führende Implementierung.

**Zusätzliche Fach-PWAs:** **Fanbus und Liveticker bleiben ausdrücklich eigenständig installierbare PWAs.** Der **Social-Media-Generator bleibt gemäß D-021 ebenfalls eine eigenständige PWA**. Das **Fanszene Schweinfurt Cockpit** ist zusätzlich eine eigenständig installierbare Anwendungs-PWA für genau Liveticker und Bild-Generator. Es ersetzt weder die gemeinsame Portal-PWA noch die beiden eigenständigen Fach-PWAs. Weitere Fachmodule dürfen entsprechend ihren freigegebenen fachlichen Entscheidungen zusätzliche eigenständig installierbare PWAs anbieten. Diese Installationsmöglichkeiten sind optional und ersetzen die gemeinsame Portal-PWA nicht; sie sind keine konkurrierenden Pflichtinstallationen.

**Gemeinsame Plattformbasis:** Portal-PWA und eigenständige Fach-PWAs verwenden dieselbe zentrale Portal-/Supabase-Identität, Session- und Berechtigungsbasis sowie dieselben führenden Plattform- und Fachdaten. Es entsteht keine zweite Benutzer-, Rollen-, Team-, Auth- oder API-Welt. Die Browser-API-Grenze bleibt `public.pd_api(text, jsonb)`.

**Installations- und Routinggrenzen:** Jede installierbare PWA erhält eine eindeutige Manifest-/Installations-ID und eine passende Start-URL. Router-, Asset-, Manifest- und Service-Worker-Scope werden je Anwendung eindeutig abgegrenzt. Service Worker dürfen keine fremden Anwendungs- oder WordPress-Pfade kontrollieren; insbesondere darf die gemeinsame Portal-PWA die eigenständigen Fach-PWAs nicht übernehmen. Das kanonische PROD-Ziel verwendet `https://plaerrdeifl.de/portal/` für das Portal, eigene Pfade wie `/cockpit/`, `/fanbus/`, `/liveticker/` und `/generator/` für Cockpit und Fachmodule sowie `https://plaerrdeifl.de/` für die öffentliche WordPress-Website. DEV bildet die Ziel-Pfadgrenzen vor dem PROD-Cutover ab und nimmt Manifest, Scope, Installation, Navigation und Session-Übergänge real ab. Die Vorgaben für den gemeinsamen Release Candidate und den koordinierten PROD-Cutover nach D-045 bleiben für alle anderen Module bestehen; ausschließlich die ausdrücklich begrenzte Cockpit-Ausnahme nach D-053 kann separat freigegeben werden.

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

## D-049 – ChatGPT, Codex Cloud und Codex Remote haben feste Rollen im Entwicklungsablauf

**Entscheidung:** Für technische Arbeiten am PD-Portal werden ChatGPT-Projektchat, Codex Cloud und Codex Remote auf dem Acer bewusst mit unterschiedlichen Rollen eingesetzt. Pro klar abgegrenztem Arbeitspaket gibt es nur einen aktiven Implementierer; mehrere Agenten ändern nicht parallel unabhängig denselben Code.

Der Standardablauf lautet:

1. **ChatGPT-Projektchat** steuert Scope, Architektur, Arbeitsreihenfolge und Handoffs, liest die verbindlichen Projektquellen und prüft veränderliche Zustände wie GitHub, CI, Supabase, Deployments und Runtime vor konkreten Entscheidungen live.
2. **Codex Cloud** ist der bevorzugte Implementierer für isolierte Repository-Arbeit wie Branches, Codeänderungen, Tests, Builds, Commits und Pull Requests.
3. **Codex Remote auf dem Acer** ist der bevorzugte Ausführungsort für Aufgaben, die die reale Acer-Umgebung benötigen, insbesondere Browser-E2E, lokale Runtime, Worker, systemd/Docker, lokale Dateien und echte DEV-Abnahmen.
4. Nach einer Implementierung werden CI, Backend und Deployment erneut geprüft; reale Browser-/Runtime-Abnahmen erfolgen bei Bedarf über Codex Remote. Erst danach gilt ein Arbeitspaket als vollständig abgenommen.

Für normale Codex-Entwicklungs- und Abnahmeaufträge ist der Projektstandard **GPT-5.6 Sol mit Denkstufe Mittel**. Eine höhere Denkstufe wird nur verwendet, wenn die konkrete Aufgabe eine nachweislich komplexe Ursachenanalyse oder besonders schwierige technische Problemstellung erfordert. Ein anderes oder stärkeres Modell wird nicht ohne konkreten Grund während eines laufenden Arbeitspakets empfohlen.

Jeder neu formulierte Codex-Auftrag nennt künftig ausdrücklich:

- den Ausführungsort bzw. Modus (`Codex Cloud` oder `Codex Remote`),
- das Modell,
- die Denkstufe,
- den erlaubten Änderungsbereich,
- den DEV-/PROD-Schutz.

Falls das festgelegte Modell oder eine benötigte Codex-Funktion im verwendeten Client vorübergehend nicht verfügbar ist, wird vor dem Start eine konkrete Ersatzwahl benannt; daraus entsteht keine dauerhafte Änderung dieser Entscheidung.

Die bestehenden DEV-/PROD-Regeln bleiben unverändert. Insbesondere ist ein erfolgreicher DEV-Commit, Cloud-Lauf oder Remote-Test keine automatische PROD-Freigabe.


## D-050 – Fanszene Schweinfurt Cockpit ist eigenständige PWA und gemeinsamer Facheinstieg

**Aktualisierung durch D-054:** Das Cockpit ist **nicht mehr ein zusätzlicher Einstieg neben einem künftigen Portal 2.0**, sondern die alleinige neue Produktoberfläche. Die anfänglichen zwei Fachmodule bleiben Liveticker und Bildgenerator; Bus-Orga folgt danach. Die nachfolgende technische D-050-V1-Beschränkung auf zwei Module und eine zusätzliche Portal-PWA gilt nur für den bestehenden Ausbaustand, nicht als dauerhaftes Produktlimit.

**Bisheriger PWA-Vertrag:** Das **Fanszene Schweinfurt Cockpit** ist eine eigenständig installierbare **React-/TypeScript-/Vite-PWA** im neuen Repository `Plaerrdeifl/fanszene-cockpit`. Seine kanonische Adresse liegt unter `/cockpit/` (DEV `https://dev.plaerrdeifl.de/cockpit/`, langfristiges PROD-Ziel `https://plaerrdeifl.de/cockpit/`). Es nutzt `Plaerrdeifl/platform-ui` für Runtime-Konfiguration, Supabase-/Portalidentität, Session, `public.pd_api(text, jsonb)`, Bootstrap und UI-Grundlagen.

**Cockpit-Verantwortung:** App-Shell, Navigation, Anmeldung, Profil/Abmeldung sowie Cockpit-spezifische Zugangs-, Benutzer- und Rechteverwaltung. **Einzige Fachmodule:** Liveticker und Bild-Generator. Liveticker-Fachlogik, -Daten und -Worker bleiben in `Plaerrdeifl/liveticker`; Generator-Fachlogik, -Daten und -Worker bleiben in `Plaerrdeifl/social-media-generator`. Deren eigenständig installierbare PWAs und die gemeinsame Portal-PWA bleiben erhalten.

**Code-Integration:** Fachkomponenten werden aus den führenden Fachrepositories über kontrollierte, versionierte Integrations-/Komponentenverträge gemeinsam genutzt, nicht dauerhaft dupliziert. Keine konkurrierenden Liveticker- oder Generatorimplementierungen, kein zweites Benutzer-, Team-, Rollen-, Auth- oder API-System und kein iframe als Standardlösung. Cockpit und andere PWAs grenzen Manifest-ID, Start-URL, Router-, Asset- und Service-Worker-Scopes auf ihre eigenen Pfade ab.

## D-051 – Cockpit-Rollen sind anwendungsbezogen und strikt von globalen Portalrollen getrennt

**Entscheidung:** Innerhalb der zentralen Portalidentität gibt es für das Cockpit genau drei **anwendungsbezogene** Rollen: **Systemadministrator**, **Administrator** und **Benutzer**. Sie sind keine zusätzlichen globalen Portalrollen und erteilen niemals automatisch `portal.admin` oder Rechte an anderen Fachmodulen.

- **Systemadministrator:** voller Cockpit-Zugriff einschließlich Cockpit-Benutzerverwaltung, Ernennung/Entzug von Cockpit-Administratoren und -Systemadministratoren sowie voller Liveticker- und Generatorzugriff. Letzterer wird nur durch explizit autorisierte Fachberechtigungen oder einen entsprechend engen, serverseitig geprüften Fachvertrag gewährt; eine globale Portal-Adminrolle ist hierfür nicht erforderlich.
- **Administrator:** legt über kontrollierte zentrale Funktionen neue Benutzerzugänge für Cockpit-Zwecke an, aktiviert/sperrt Cockpit-Zugänge und verwaltet **normale Cockpit-Benutzer** einschließlich Zuweisung der Benutzerrolle und der beiden persönlichen Fachberechtigungen `liveticker.manage` und `social_media_generator.use`. Er darf keine Cockpit-Administratoren oder -Systemadministratoren ernennen, herabstufen oder verwalten und keine globalen Portalrollen, Portalteams oder fremden Fachrechte ändern.
- **Benutzer:** verwendet das Cockpit nur mit eigener Cockpit-Freigabe und sieht/nutzt ausschließlich Fachmodule, für die ein wirksamer Fachzugang besteht; eigenes Profil und Abmeldung bleiben möglich.

**Sicherheitsgrenze:** `portal.admin` bleibt im bestehenden Portal-Fachrechtesystem ein zentraler Wildcard gemäß D-026, führt aber **nicht automatisch** zu `cockpit.access`, einer Cockpit-Rolle oder `cockpit.system_admin`. Cockpit-Zutritt und Rollenaufstieg benötigen eine eigene ausdrückliche serverseitige Zuordnung und Prüfung, die den allgemeinen Portal-Admin-Wildcard nicht als Ersatz akzeptiert. Cockpit-Systemadministrator-Vollzugriff darf keine zusätzlichen globalen Portalrechte erzeugen. Entzug der letzten Cockpit-Systemadministratorzuordnung wird serverseitig verhindert.

## D-052 – Cockpit-Benutzerverwaltung bleibt zentral und verwendet begrenzte, auditierte Backend-Verträge

**Ergänzung nach D-055:** Die aktuelle Darstellung teamabgeleiteter *effektiver* Generatorrechte ist für Altvertragskompatibilität beizubehalten, solange diese Quellen noch real wirksam sind. Das neue Cockpit baut **keine organisatorische Teamverwaltung** auf. Die spätere Abschaltung teamabgeleiteter und global-wildcardbasierter Fachzugriffe erfolgt erst nach vollständiger Berechtigungsinventur, Migration, Tests und separatem geprüften Cutover.

**Entscheidung:** Benutzeridentitäten und globale Benutzerzustände bleiben bei Portal-Core bzw. Supabase Auth führend. Das Cockpit erstellt **keine** zweite Benutzer-/Auth-Datenbank. Neue Identitäten, Einladungen, Freischaltung und erforderliche Profiländerungen erfolgen ausschließlich über geeignete kontrollierte zentrale Backend-Funktionen. Cockpit-Benutzer-/Rollenverwaltung, Cockpit-Freigabe und -Sperre sind **anwendungsbezogen**; eine Cockpit-Sperre darf weder eine globale Portalbenutzersperre noch das Sperren anderer Module auslösen.

**Administration:** Alle Verwaltungsaktionen laufen über auf genau diesen Zweck begrenzte `public.pd_api(text, jsonb)`-Actions. Sie prüfen serverseitig Akteur, ausdrückliche Cockpit-Rolle, konkreten Zielbenutzer, erlaubte Mutation und Rechte-Allowlist; sie sind auditierbar, konflikt-/revisionsgeschützt und schützen gegen Rechteausweitung und den Verlust des letzten Systemadministrators. Allgemeine Portal-Admin- oder unbeschränkte Benutzerrechte-Mutationsfunktionen werden nicht als direkte Cockpit-Adminoberfläche exponiert. Cockpit-Administratoren dürfen nur normale Cockpit-Benutzer und deren persönliche Liveticker-/Generatorrechte verwalten. Administrator- und Systemadministrator-Zuordnungen sind Systemadministratoren vorbehalten.

**Fachzugang:** `liveticker.manage` und `social_media_generator.use` bleiben die bestehenden Fachrechte. Persönliche Gewährung/Entziehung durch berechtigte Cockpit-Administratoren erfolgt über eng eingeschränkte serverseitige Actions. Der Generatorzugang über aktive Mitgliedschaft im Portalteam `SOCIAL_MEDIA` und der bisherige `portal.admin`-Wildcard bleiben nach D-026 wirksam; eine Teammitgliedschaft oder ein globaler Portal-Admin-Wildcard ist **niemals allein eine Cockpit-Freigabe**. Die Cockpit-UI und Backend-Antworten unterscheiden deshalb **persönlich zugewiesenes Fachrecht** von **effektivem Fachzugriff aus allen zulässigen Quellen**. Der Entzug eines persönlichen Generatorrechts hebt nicht still andere wirksame Zugangsquellen auf.

**Geltungsbereich:** Änderungen des zentralen Auth-/API-/Berechtigungsvertrags werden kompatibel mit anderen Portalmodulen ausgeführt; der Browser nutzt allein die bestehende `pd_api`-Grenze, niemals `service_role`. Dauerhafte Datenbankänderungen folgen D-042 mit nur einer führenden Migrationshistorie.

## D-053 – Cockpit-PROD-Releases brauchen gesonderte Sicherheits- und Betriebsfreigabe

**Aktualisierung durch D-054:** Das Cockpit ist nun das neue Gesamtprodukt, kein Ausnahmemodul neben einem künftig separat auszurollenden Portal 2.0. Die nachfolgend definierten, strengen PROD-Freigabebedingungen gelten weiter; die ehemalige Interpretation als *Ausnahme* von einem anderen Portal-2.0-Cutover entfällt. **Diese Entscheidung autorisiert keinerlei aktuelle PROD-Arbeit.**

**Historischer Ausnahmevertrag / weiterhin geltende Sicherheitsbedingungen:** Als **einzige eng begrenzte Ausnahme** von der regulären gemeinsamen Portal-2.0-PROD-Umschaltung nach D-045 darf das Fanszene Schweinfurt Cockpit **einschließlich ausschließlich zwingend notwendiger und mit Portal 1.0 kompatibler Backend-, Worker- und Fachabhängigkeiten** eigenständig nach PROD veröffentlicht werden. Andere Module erhalten dadurch keine reguläre vorgezogene PROD-Freigabe; Portal 1.0 bleibt in Betrieb, der gemeinsame Portal-2.0-Cutover bleibt für das übrige Gesamtsystem verbindlich.

**Zwingende Bedingungen vor jeder gesonderten PROD-Freigabe:**

1. vollständige integrierte Cockpit-DEV-Abnahme einschließlich Liveticker und Generator;
2. nachgewiesene Sicherheits-, Rollen-, Zielbenutzer-, Rechteentzug- und Eskalationsschutztests;
3. nachgewiesene Kompatibilität mit dem laufenden Portal 1.0 und bestehenden Modulzugängen;
4. reproduzierbare, isolierte Migrationsprobe gegen einen aktuellen geeigneten PROD-Datenstand; keine DEV-Datenkopie und kein zweiter Migrationsführer;
5. echte End-to-End-Nachweise für notwendige Worker, Grafik-/WhatsApp-Ausgaben und Delivery/Acknowledgement;
6. geprüftes Routing, eindeutige PWA-Scopes, Koexistenz mit Portal 1.0, Liveticker und Generator sowie nötige Domain-/DNS-/Mail-Schutzmaßnahmen;
7. geplantes und erprobtes Backup, Recovery und Rollback für Frontends, API/DB, Worker und Routing;
8. **separate konkrete ausdrückliche PROD-Freigabe** des festgelegten Releaseumfangs.

**Freigabegrenze:** Diese Entscheidung ist nur eine Architektur- und spätere Release-Option; sie autorisiert **jetzt weder PROD-Migrationen noch Worker-/Routing-/Frontend-Deployments**. Die zentrale `Plaerrdeifl/portal-v4-dev/supabase`-Migrationshistorie bleibt bis zu einem ausdrücklich freigegebenen atomaren Backend-Cutover führend (D-042).

## D-054 – Cockpit ersetzt Portal 2.0 vollständig als neues Zielprodukt

**Entscheidung vom 29.10.2026:** Das geplante **Portal 2.0 wird nicht als eigenständiges Produkt umgesetzt**. An seine Stelle tritt das **Fanszene Schweinfurt Cockpit** (kurz **Cockpit**) als einzige neue gemeinsame Anwendung und langfristiger Nachfolger der bisher für Portal 2.0 gedachten Funktionen. Das Cockpit ist weder ein Zusatz zu Portal 2.0 noch dessen vorübergehender Einstieg. Bestehende Repository- und Datenbanknamen wie `portal-v4-dev` bleiben vorläufig bestehen; sie definieren kein zweites Produkt.

**Einführungsreihenfolge:** Zunächst Liveticker und Bildgenerator; **danach** Bus-Orga/Fanbus in der neuen Struktur; weitere bisher für Portal 2.0 vorgesehene Funktionen werden später einzeln freigegeben. Die führende Fachlogik bleibt in genau einem Fachrepository je Funktion. Liveticker und Bus-Orga bleiben auch eigenständig installierbare PWAs; für den Generator gilt bis zu einer gesonderten Entscheidung dessen Standalone-PWA-Vertrag. Cockpit ist der gemeinsame Einstieg, keine zweite Fachimplementierung.

**DEV-Adresse:** `https://dev.plaerrdeifl.de/` eröffnet künftig das Cockpit. Der vorhandene Cockpit-Pfad `/cockpit/` und sein abgegrenzter PWA-/Service-Worker-Scope können erhalten bleiben; die Root-Adresse darf geprüft dorthin weiterleiten. Die alte Portal-Root-Oberfläche wird erst nach Inventar, Sicherung, Abhängigkeitsprüfung, Rückfallplan und DEV-E2E abgelöst. OAuth-/Login-, API-/Asset- und Fachmodulpfade bleiben funktionsfähig. Die produktive WordPress-Website unter `https://plaerrdeifl.de/` bleibt unverändert.

**Gemeinsame Plattform:** Supabase Auth, zentrale Identitäten, individuelle Cockpit-Rollen, Fach-Capabilities, `public.pd_api(text, jsonb)`, geschützte Backendfunktionen, Worker, OAuth/OIDC und die einzige führende Migrationshistorie werden als benötigte Infrastruktur behalten. Es gibt weder eine parallele neue Portal-2.0-Oberfläche noch eine zweite Identität oder einen Big-Bang-Rewrite.

**Vorrang:** Diese Entscheidung ersetzt widersprechende **Zielaussagen** in D-034/035/038/044–046/050/053. Die Betriebs-, Sicherheits-, Daten-, DEV-/PROD-Trennungs- und ausdrücklichen PROD-Freigaberegeln bleiben verbindlich.

## D-055 – Cockpit verwendet keine organisatorischen Portalteams als Rollen- oder Rechtebasis

**Entscheidung vom 29.10.2026:** Die **organisatorische Teamwelt des alten Portals** wird nicht in das neue Cockpit übernommen. Zugang, Verwaltung und Fachnutzung basieren auf zentraler Benutzeridentität, anwendungsbezogenen Cockpit-Rollen und ausdrücklichen Fach-Capabilities. Es gibt weder eine neue Teamzuordnung als Bedingung für Cockpit-Zugang noch eine zweite Teamverwaltung.

**Abgrenzung:** Sportliche Mannschaften, Spielpläne, Kader, Mannschaftslogos und teambezogene Liveticker-Ausgaben sind **Fachdaten** und bleiben bestehen. Reisegruppen bei Bus-Orga sind ebenfalls keine organisatorischen Portalteams; Reisegruppe, Buchung und Hauptbuchung bleiben getrennte Fachbegriffe.

**Kontrollierte Ablösung:** D-015/D-026/D-040/D-052 beschreiben noch tatsächlich existierende alte Portalteam-, `SOCIAL_MEDIA`- und `portal.admin`-Zugangsquellen. Diese bleiben für laufende Altverträge wirksam, bis Generator, Nextcloud, WordPress und andere Konsumenten inventarisiert und auf persönliche bzw. eng begrenzte Fachrechte sicher migriert sind. Keine stille Löschung, keine unkontrollierte Rechteausweitung und kein Wiederaufbau der alten organisatorischen Teamwelt. Die Abschaltung der Altquellen braucht einen eigenen geprüften Daten-/Rechte-Cutover.

## D-056 – Legacy-Portal-READ_ONLY darf Cockpit-Schreibbetrieb nicht pauschal blockieren

**Entscheidung vom 29.10.2026:** Ein bewusst zum Schutz der **alten DEV-Portaloberfläche** gesetztes `READ_ONLY` darf nicht automatisch die ausdrücklich autorisierten Cockpit-Verwaltungsaktionen stilllegen. Der derzeitige zentrale M900-Modus `platform.mode` gilt **technisch global**; die Cockpit-Actions für Zugang und persönliche Rechte werden als `USER_MUTATION` blockiert. Das ist ein **noch zu korrigierender Ist-/Soll-Konflikt**, kein bereits implementierter Fix.

**Sicheres Ziel:** Ein gesonderter, serverseitig autorisierter und eng begrenzter Cockpit-Betriebsvertrag trennt die Legacy-Frontend-Sperre von Cockpit-Mutationen. Bestehende Cockpit-Rollen-, Zielbenutzer-, Revisions-, Audit- und Notfallschutzprüfungen gelten unverändert. Allgemeine Portal-/andere Fachmutationen, `MAINTENANCE`-Notfallsperren und Sicherheitsgrenzen dürfen nicht umgangen werden. Das Frontend muss denselben differenzierten Serververtrag abbilden. Kein pauschaler M900-Bypass und keine globale DEV-Umschaltung auf `NORMAL` als Ersatz für diese Korrektur.

## D-057 – DEV-Altoberfläche nur mit Sicherung und nachgewiesener Entbehrlichkeit entfernen

**Entscheidung vom 29.10.2026:** Die nicht mehr benötigte alte DEV-Portaloberfläche darf nach Archivierung entfernt werden, sobald das Cockpit über die DEV-Root-Adresse erreichbar ist und alle noch genutzten Dienste unverändert funktionieren. Identität, OAuth, API, Datenbanken, Migrationen, Worker, Fachmodule und erforderliche Pfade/Assets bleiben erhalten.

**Pflichtreihenfolge:** Live-Inventar und Keep/Remove-Nachweis → reproduzierbare Sicherung inkl. Routing-/Build-Konfiguration und erforderlichem DEV-Datenstand → Root-Einstieg und abgegrenzte PWA-Scopes verifizieren → authentifizierte Rollen-/Mutation-/Login- und Modul-E2E → schrittweise Entfernung nachgewiesenen Altbestands → Recovery-Test. Keine pauschale Löschung von `portal-v4-dev`, `supabase`, Identitäts-/Teamtabellen oder genutzten APIs. Teamdaten erst nach D-055-Migration entfernen.

**PROD-Schutz:** Portal 1.0 und WordPress bleiben unverändert; jeder Cockpit-PROD-Release braucht eine neue ausdrückliche Freigabe nach D-053.

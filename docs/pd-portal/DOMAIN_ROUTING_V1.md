# PD-Portal – Domain- und Pfadrouting V1

**Stand:** 29.09.2026  
**Status:** verbindliches Zielbild für die Modularisierung; noch kein PROD-Cutover

## 1. Ziel

Das PD-Portal und seine Fachmodule werden langfristig unter der gemeinsamen Vereinsdomain über klare Pfade erreichbar.

## 2. PROD-Zielbild

```text
https://plaerrdeifl.de/            -> öffentliche WordPress-Website
https://plaerrdeifl.de/portal      -> Portal-Core / Dashboard
https://plaerrdeifl.de/events      -> Events
https://plaerrdeifl.de/fanbus      -> Fanbus
https://plaerrdeifl.de/liveticker  -> Liveticker
https://plaerrdeifl.de/generator   -> Social-Media-Generator
https://plaerrdeifl.de/members     -> Members
https://plaerrdeifl.de/finance     -> Finance
https://plaerrdeifl.de/tasks       -> Tasks
https://plaerrdeifl.de/mail        -> Mail
```

## 3. DEV-Zielbild

DEV spiegelt dieselben Modulpfade unter `https://dev.plaerrdeifl.de`: `/portal`, `/events`, `/fanbus`, `/liveticker`, `/generator`, `/members`, `/finance`, `/tasks`, `/mail`.

Damit werden Routing, Modulnavigation und das gemeinsame PWA-Verhalten vor PROD mit derselben Pfadstruktur getestet. DEV ist während des Gesamtumbaus die vollständige Portal-2.0-Aufbau- und Abnahmeumgebung; PROD bleibt bis zum gemeinsamen Cutover Portal 1.0.

## 4. WordPress / Lima-City

Die öffentliche Website bleibt bei Lima-City und unter `https://plaerrdeifl.de/` erreichbar. WordPress bleibt zuständig für öffentliche Website-Inhalte, News/Content und WooCommerce. Die Einführung der Portalpfade bedeutet keinen WordPress-Umzug.

## 5. Routing-Schicht

DNS kann nicht nach URL-Pfaden unterscheiden. Deshalb wird für PROD eine vorgeschaltete Cloudflare-Routing-Schicht vorgesehen.

```text
/portal*      -> Portal-App
/events*      -> Events-App
/fanbus*      -> Fanbus-App
/liveticker*  -> Liveticker-App
/generator*   -> Generator-App
/members*     -> Members-App
/finance*     -> Finance-App
/tasks*       -> Tasks-App
/mail*        -> Mail-App
alles andere  -> WordPress / Lima-City
```

Die genaue Cloudflare-Ausgestaltung wird vor Umsetzung live gegen den dann aktuellen DNS-/Hosting-Stand geprüft.

## 6. Übergangsadressen

`portal.plaerrdeifl.de` bleibt während der Migration als technische Übergangsadresse bestehen. Nach dem kontrollierten PROD-Cutover soll sie auf `https://plaerrdeifl.de/portal` weiterleiten. Eigenständige Modul-Subdomains wie `generator.plaerrdeifl.de` sind kein langfristiges kanonisches Ziel.

## 7. Gemeinsame PWA und Routing-Schutz

Für Benutzer ist genau **eine gemeinsame PD-Portal-PWA** das kanonische Installationsziel. Fachmodule bleiben technisch getrennte Builds und über ihre direkten Modulpfade erreichbar, sollen in der integrierten Zielumgebung aber keine konkurrierenden Installations-PWAs oder überlappenden Service Worker registrieren.

Der konkrete Manifest-, Router- und Service-Worker-Scope wird in Phase 1 auf DEV festgelegt und getestet. Dabei ist zwingend, dass die öffentliche WordPress-Website auf `/` nicht von einem Portal-Service-Worker kontrolliert wird. Bis dieser Vertrag auf DEV bewiesen ist, wird kein Service Worker mit Root-Scope eingeführt.

Die bestehende Portal-1.0-PWA unter `portal.plaerrdeifl.de` kann wegen des Origin-Wechsels nicht still auf `plaerrdeifl.de` migriert werden. Beim späteren PROD-Cutover erhält die alte PWA deshalb einen klaren Wechselhinweis zum neuen Portal; das neue Portal bietet eine verständliche Installationsführung. Die alte Portaladresse bleibt als Redirect/Migrationsadresse bestehen.

## 8. PROD-Cutover-Regel

PROD bleibt während des Portal-2.0-Gesamtumbaus auf Portal 1.0. Der Wechsel auf die neue Domain-/Pfadarchitektur erfolgt nicht modulweise, sondern als gemeinsamer, separat freigegebener Release-Cutover nach vollständiger DEV-Gesamtabnahme.

Vor Freigabe werden mindestens DNS, MX/SPF/DKIM/DMARC, WordPress-Origin, TLS, Pfadrouting, Redirects, Website, Mailzustellung, aktuelle PROD-Datenmigration, Rollback/Recovery sowie echte Login-/PWA-/Modul-E2E-Tests geprüft. Keine Nameserver-, DNS- oder Routing-Umschaltung ohne separate konkrete PROD-Freigabe.
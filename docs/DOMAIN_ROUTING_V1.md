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

DEV spiegelt dieselben Modulpfade unter:

`https://dev.plaerrdeifl.de`

also insbesondere:

- `/portal`
- `/events`
- `/fanbus`
- `/liveticker`
- `/generator`
- `/members`
- `/finance`
- `/tasks`
- `/mail`

Damit werden Routing, PWA-Scope und Modulnavigation vor PROD mit derselben Pfadstruktur getestet.

## 4. WordPress / Lima-City

Die öffentliche Website bleibt bei Lima-City und unter `https://plaerrdeifl.de/` erreichbar.

WordPress bleibt zuständig für öffentliche Website-Inhalte, News/Content und WooCommerce.

Die Einführung der Portalpfade bedeutet keinen WordPress-Umzug.

## 5. Routing-Schicht

DNS kann nicht nach URL-Pfaden unterscheiden. Deshalb wird für PROD eine vorgeschaltete Cloudflare-Routing-Schicht vorgesehen.

Logik:

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

`portal.plaerrdeifl.de` bleibt während der Migration als technische Übergangsadresse bestehen.

Nach dem kontrollierten PROD-Cutover soll sie auf `https://plaerrdeifl.de/portal` weiterleiten.

Eigenständige Modul-Subdomains wie `generator.plaerrdeifl.de` sind kein langfristiges kanonisches Ziel.

## 7. PWA- und Routing-Schutz

Jedes Modul muss seinen technischen Scope auf den eigenen Pfad begrenzen:

- Vite Base Path
- Client Router Base
- Asset-Pfade
- PWA Manifest Scope
- Service Worker Scope
- Auth-/OAuth-Redirects

Ein Service Worker eines Moduls darf keine fremden Portalpfade kontrollieren.

## 8. PROD-Cutover-Regel

Der Wechsel der Hauptdomain vor eine Cloudflare-Routing-Schicht ist eine eigene PROD-Infrastrukturänderung.

Vor Freigabe müssen mindestens geprüft werden:

1. vollständiges aktuelles DNS-Inventar
2. MX-/SPF-/DKIM-/DMARC- und sonstige Mail-Records
3. WordPress-Origin bei Lima-City
4. TLS/Zertifikate
5. Cloudflare-Routing für alle Portalpfade
6. Redirects alter Portal-/Moduladressen
7. Website ohne Regression
8. Mailzustellung ohne Regression
9. echte Login-/PWA-/Modultests

Keine Nameserver- oder DNS-Umstellung ohne separate konkrete PROD-Freigabe.

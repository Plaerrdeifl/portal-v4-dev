# Frontend-Architektur

Status: Verbindliche Grundlage ab Frontend-Foundation-Reset.

## Aktive Stylesheets

Das Portal lädt ausschließlich:

1. `css/tokens.css`
2. `css/app.css`

Weitere Stylesheets, CSS-Imports oder nachträgliche Corr-/Patch-Dateien sind unzulässig.

## Änderungsregel

Design- und Layoutänderungen werden an der fachlich richtigen Stelle in `css/app.css` durchgeführt. Bestehende Regeln werden angepasst oder ersetzt. Es werden keine später geladenen Gegenregeln angehängt.

## Öffentlicher Login

Der Login ist eine normale öffentliche Inhaltsseite innerhalb der Portalhülle. Kopfzeile und Navigation bleiben erhalten. Routenspezifische CSS-Sonderbehandlungen für `data-route="login"` sind verboten.

## Mobile Navigation

Die feste Bottom-Navigation ist ein verbindlicher Bestandteil des angemeldeten mobilen Portals.

Die primären Bereiche werden direkt angezeigt. Der Eintrag „Mehr“ öffnet die vollständige Seitenleiste. Ein zweites separates Mehr-Panel existiert nicht.

## Schutzmechanismus

`npm test` startet zuerst `scripts/check-frontend-foundation.mjs`. Die Prüfung bricht unter anderem ab bei:

- zusätzlichen CSS-Dateien,
- Corr-/Patch-Dateien,
- alten Login-Sonderregeln,
- Entfernung der Bottom-Navigation,
- einem nicht angebundenen „Mehr“-Button,
- alter Mehr-Panel-Logik,
- veralteten M4-Corr-JavaScript-Dateien,
- nicht ausgeglichener CSS-Syntax.

Die frühere Struktur bleibt ausschließlich über die Git-Historie nachvollziehbar.

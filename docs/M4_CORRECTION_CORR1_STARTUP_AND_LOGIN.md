# M4 Corr1 - frühe App-Shell und unterbrechungsfreier Login-Übergang

## Ausgangsfehler

1. Die eigentliche App-Shell blieb beim Start bis ungefähr acht Sekunden verborgen.
2. Nach erfolgreicher Google-Anmeldung konnte während der Sitzungs- und Rechteprüfung vorübergehend wieder der öffentliche Bereich erscheinen, bevor das Portal geladen war.

## Korrektur

- Die App-Shell wird direkt nach dem Komponenten-Mount sichtbar und zeigt einen klaren Skeletonzustand, während das Backend noch antwortet.
- Ab Auswahl des Google-Kontos deckt eine neutrale Portal-Ladeansicht den öffentlichen Bereich ab.
- Der Login-Übergang bleibt sichtbar, bis die erste erlaubte Portalroute vollständig gerendert ist.
- Ein geschützter Deep Link wird vor dem Login nur in Session Storage gemerkt und nach erfolgreicher Anmeldung wiederhergestellt.
- Während eines erfolgreichen Login-Übergangs wird weder `#/home` gesetzt noch die öffentliche Startseite als Zwischenansicht verwendet.
- Registrierungs-, Fehler- und Abbruchfälle kehren kontrolliert zur Anmeldeseite zurück.

## Scope

Geändert werden ausschließlich sieben Frontenddateien:

- `js/app.js`
- `js/pages.js`
- `js/config.js`
- `index.html`
- `service-worker.js`
- `docs/CHANGELOG.md`
- `docs/M4_CORRECTION_CORR1_STARTUP_AND_LOGIN.md`

Backend-Version 69, Apps Script, Datenbanken, Rollen, Rechte und Fachlogik bleiben unverändert. Der historische Tag `r7.1-m4-final` wird nicht verschoben. Bei erfolgreicher Regression wird zusätzlich `r7.1-m4-final-corr1` erzeugt.

## Laufzeitnachweis vor Veröffentlichung

Der lokale Edge-Lauf simuliert:

- acht Sekunden verzögerte Bootstrap-Antwort,
- drei Sekunden verzögerte erfolgreiche Google-Anmeldung,
- einen geschützten Deep Link auf `#/fanbuses`,
- Überwachung aller Hash-Routen während des Login-Übergangs.

Der Lauf muss belegen, dass die frühe Shell innerhalb von 1.500 ms sichtbar ist, während der Anmeldung kein `#/home` erscheint, die Portal-Ladeansicht den öffentlichen Inhalt vollständig abdeckt und der geschützte Deep Link nach erfolgreichem Login wiederhergestellt wird.

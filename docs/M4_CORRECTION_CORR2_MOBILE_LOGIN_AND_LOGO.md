# M4 Corr2 – mobiler Google-Login und unverzerrtes Startseitenlogo

**Status:** kontrollierte Korrektur innerhalb von Milestone 4  
**Basis:** `9db4424edf0363a5e5c940cdd5a09d399874b9a6` / `r7.1-m4-final-corr1`  
**Backend:** Version 69, unverändert  
**Build:** `2026.07.16-r7.1.m4-corr2-mobile-login-logo`

## Beobachtete Fehler

1. Auf dem iPhone blieb nach der Google-Kontoauswahl die Loginseite während der Rechteprüfung sichtbar.
2. Der Busy-Text und das Google-Iframe belegten gleichzeitig dieselbe schmale Zeile. Dadurch wurde der Google-Button abgeschnitten und die Anzeige gequetscht.
3. Das Logo der öffentlichen Startseite wurde durch konkurrierende Breiten- und Höhenregeln sichtbar verzerrt.

## Korrektur

- Die Portal-Ladeansicht für den Login-Übergang liegt statisch in `index.html` vor. Sie muss nicht erst nach der Kontoauswahl dynamisch erzeugt werden.
- `js/m4-corr2-login-overlay.js` hört sowohl auf `pd-auth-transition` als auch auf den tatsächlichen Busy-Zustand des Google-Login-Platzhalters.
- Sobald „Google-Konto und Rechte werden geprüft“ aktiv ist, wird die Ladeansicht sofort angezeigt.
- Das Google-Iframe wird während dieses Zustands vollständig ausgeblendet.
- `css/m4-corr2.css` überschreibt die alte feste Bildhöhe der Hero-Komponente ausschließlich für `#publicLogo` und erhält das natürliche Seitenverhältnis.

## Scope

Geändert oder neu angelegt werden ausschließlich:

- `index.html`
- `css/m4-corr2.css`
- `js/m4-corr2-login-overlay.js`
- `js/config.js`
- `service-worker.js`
- `docs/CHANGELOG.md`
- `docs/M4_CORRECTION_CORR2_MOBILE_LOGIN_AND_LOGO.md`

Apps Script, Backend-Deployment, Datenbanken, Rollen, Rechte und Fachlogik werden nicht verändert. Der Tag `r7.1-m4-final-corr1` bleibt unverändert. Bei erfolgreicher Installation wird zusätzlich `r7.1-m4-final-corr2` erzeugt.

## Abnahmekriterien

- Startseitenlogo ist auf 320, 390, 430 und 768 Pixel Breite nicht verzerrt.
- Nach Google-Kontoauswahl erscheint die vollflächige Portal-Ladeansicht ohne sichtbare öffentliche Loginseite.
- Google-Button und Busy-Text überlagern sich nicht.
- Kein Zwischenwechsel zu `#/home`.
- Geschützte Zielroute bleibt erhalten.
- Keine First-Party-Browser- oder CSP-Fehler.

# M4 Corr7 – klare Trennung öffentlicher Bereich und Portal

Status: Korrekturbranch, noch nicht produktiv bestätigt  
Basis: `d805fcb337fdf29596409b5233360c6552178b4b`  
Zielbranch: `fix/m4-corr7-portal-separation`

## Enthalten

- ein dynamischer Menüpunkt: „Anmelden / Registrieren“ ohne Sitzung, „Ins Portal“ bei erkannter gespeicherter Sitzung
- keine automatische Portalweiterleitung; die Sitzungsprüfung beginnt erst nach „Ins Portal“
- vollständiger Wechsel von öffentlicher Navigation auf berechtigte Portalnavigation nach erfolgreicher Anmeldung
- öffentlicher Headerkontext „ÖFFENTLICHER BEREICH“, im geschützten Portal „PORTAL“
- dunkler horizontaler Headerverlauf passend zur vertikalen Navigation
- dezenter vollflächiger Eisflächenhintergrund mit Hockeylinien
- echte Desktop-Zweispaltenansicht für Anmeldung, Registrierung und Profil
- Entfernung aller weißen CSS-Trägerflächen um das Logo
- Startseite ohne künstlichen Mini-Scrollbereich auf normalen Desktopgrößen
- öffentliche HTML-Dateien sind die verbindliche Textquelle; die aktuell sichtbaren Texte bleiben erhalten

## Öffentliche Textquellen

- `pages/home.html`
- `pages/news.html`
- `pages/dates.html`
- `pages/about.html`
- `pages/contact.html`
- `pages/install.html`

## Nicht geändert

- Backend-Version 69 und Deployment
- Datenbanken, Tabellen und Fachbestand
- Rollen, Rechte und Fachlogik
- Google-Login-Protokoll und Registrierungsprozess

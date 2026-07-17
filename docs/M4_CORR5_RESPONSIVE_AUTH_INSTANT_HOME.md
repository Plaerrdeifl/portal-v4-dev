# M4 Corr5 – Responsive Auth und sofortige Startseite

Status: Installationspaket, noch nicht produktiv bestätigt  
Basis: `4837feba108ed877ab23575acf9b9f551b22acf8`  
Zielbranch: `fix/m4-corr5-responsive-startup`

## Ziel

Corr5 korrigiert die schmale Browser-/Mobilansicht der Authentifizierung und entfernt den vorgeschalteten Start-Ladebildschirm. Beim Öffnen ist sofort die öffentliche Startseite sichtbar; Login, Sitzung und Backend werden parallel im Hintergrund initialisiert.

## Enthalten

- durchgehender dunkelblauer Auth-Hintergrund seitlich und unterhalb der weißen Login-/Profilkarte
- identische gestalterische Grundlogik in PC-Browser und mobiler App
- stabile Darstellung zwischen 320 und 430 Pixeln sowie in schmalen PC-Browserfenstern
- Status-Pill innerhalb der Karte ohne seitliches Überragen
- Google-Button und Google-Iframe bleiben innerhalb der verfügbaren Kartenbreite
- kompaktere Überschrift, Kartenabstände und Markenfläche auf schmalen Ansichten
- sofort vorgerenderte öffentliche Startseite statt „Portal wird geladen …“
- bestehender Auth-Übergang nach dem tatsächlichen Google-Login bleibt erhalten
- bestehende Corr4-Desktopnavigation, Kontomenü und horizontaler Scrollbalken bleiben unverändert

## Nicht geändert

- Backend-Version 69 und Deployment
- Datenbanken und Tabellen
- Rollen, Rechte und Fachlogik
- Google-Login-Protokoll
- Service-Worker-Updatebestätigung

## Veröffentlichungsweg

Das Paket erstellt ausschließlich den Branch `fix/m4-corr5-responsive-startup`. Erst ein grüner Pull Request und der anschließende Merge nach `main` lösen den geprüften GitHub-Actions-Pages-Deploy aus.

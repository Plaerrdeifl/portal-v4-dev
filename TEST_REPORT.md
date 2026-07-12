# Testbericht Phase 1

Build: `2026.07.12-github-pages-phase1`

## Automatisch geprüft

- vollständige erwartete Projektstruktur
- gültiges JSON in `manifest.webmanifest`
- Existenz und korrekte Abmessungen aller App-Icons
- alle im Service Worker vorab gecachten Dateien vorhanden
- JavaScript-Syntax aller ES-Module und des Service Workers
- alle Stylesheets, Module, Komponenten und Seiten über lokalen HTTP-Server erreichbar
- kein Apps-Script-Backendcode, keine `.clasp.json` und keine privaten Schlüssel im Paket
- relative Ressourcenpfade für GitHub Pages unter `/portal/` und einen späteren Domainwechsel
- Browser-Smoke-Test in isolierter Chromium-Testumgebung:
  - App-Shell startet
  - sieben Navigationseinträge werden aufgebaut
  - Route `#/home` wird geladen
  - Wechsel zu `#/login` funktioniert
  - keine JavaScript-Laufzeitfehler im Testablauf

**Ergebnis: Alle automatisierten Phase-1-Prüfungen erfolgreich.**

## Bewusst noch nicht produktiv getestet

Diese Funktionen gehören zu Phase 2 oder später:

- Google OAuth
- produktive Apps-Script-HTTP-API
- Benutzer- und Rechteverwaltung über HTTP
- echte Fanclub-, Team-, Fanbus- oder Admin-Daten
- Push-Benachrichtigungen

Die manuelle Abnahme auf der echten GitHub-Pages-Adresse ist in `PHASE1_ABNAHME.md` beschrieben.

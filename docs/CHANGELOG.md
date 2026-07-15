# Changelog

## R7.1 Milestone 4 – Paketstand 14. Juli 2026

### Hinzugefügt

- AE-R7.1-01 mit getrennten Pflichtfeldern Vorname/Nachname
- verpflichtende Registrierung und Profilvervollständigung
- feste sechs Hauptbereiche
- Aufgabenmodul mit vier Unterseiten
- Teamsmodul mit vier Unterseiten
- Fanbusse-Informationsseite
- exakte Admin-Unterseitenstruktur
- frühe App-Shell und dynamische Modulimporte
- minimaler Service-Worker-Shellcache
- Namensintegritätsstatus und datensparsame Audits

### Geändert

- normaler Apps-Script-Aufruf leitet zur GitHub-Pages-PWA
- Kasse in Fanclub integriert
- Vorstand in Aufgaben integriert
- `Fanbus` zu `Fanbusse`
- Cache-, Query- und Buildkennungen auf M4
- Google-Login ohne Anzeigename-/E-Mail-Fallback
- Admin- und Antragsformulare mit serverseitiger Namensprüfung

### Sicherheit

- Profilzustand wird zentral am API-Dispatch erzwungen
- keine API-/Bridgeantworten im dauerhaften Service-Worker-Cache
- führende Tabellen-Formelzeichen in Namen werden abgewiesen
- alte und neue Vollnamen werden im M4-Namensaudit nicht gespeichert

### Weiter offen vor Release

Produktiver Pull/Push/Deploymentnachweis, Bestandszahlen und -bereinigung, Live-Smoke, Browser-/Geräteabnahme und A-M3-01-Laufzeitmatrix.

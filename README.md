# Plärrdeifl Portal – GitHub Pages Phase 1

Dieses Paket ist das getestete Frontend-Grundgerüst für die Migration des Plärrdeifl Portals von Google Apps Script HTMLService zu GitHub Pages.

## Enthalten

- installierbare PWA mit Plärrdeifl-App-Icon
- iOS Apple-Touch-Icon und Android-Maskable-Icons
- App-Shell mit Desktop- und Mobilnavigation
- Hash-Routing, das unter `/portal/` und später unter einer eigenen Domain funktioniert
- getrennte CSS- und JavaScript-Module
- zentrale Konfiguration
- vorbereitete, aktuell deaktivierte API-Schicht
- Login-Grundseite ohne Geheimnisse im Frontend
- Service Worker und Offline-Grundseite
- Platzhalter für Dashboard, Fanclub, Teams, Fanbusse und Admin

## Installation im vorhandenen Repository

Den gesamten Inhalt dieses Pakets direkt nach `C:\Projekte\Portal\portal` kopieren. Vorhandene Phase-1-Testdateien ersetzen.

```powershell
git add .
git commit -m "Frontend-Grundgerüst Phase 1"
git push
```

GitHub Pages veröffentlicht anschließend automatisch aus `main` und `/ (root)`.

## Wichtiger Sicherheitsstand

Die produktive Apps-Script-API ist bewusst noch deaktiviert. Das öffentliche Repository enthält keine Client-Secrets, Tabellen, Benutzerdaten oder Backenddateien. Der Button „Bestehendes Portal öffnen“ führt weiterhin zum funktionierenden Apps-Script-Portal.

## Nächste Phase

Phase 2 umfasst:

1. HTTP-API-Endpunkt im Apps-Script-Backend
2. erlaubte Herkunft für `https://plaerrdeifl.github.io`
3. Google-Login und sichere Sitzungen
4. serverseitige Rechteprüfung
5. erste echte Datenabfrage aus der PWA

# Plärrdeifl Portal – GitHub Pages Phase 2

Dieses Frontend verbindet die installierbare GitHub-Pages-PWA mit dem bestehenden Apps-Script-Backend.

## In Phase 2 produktiv verbunden

- Google-Login über das bestehende serverseitige OAuth-Verfahren
- einmaliges, kurzlebiges Login-Ticket im URL-Fragment
- feste 12-Stunden-Portalsitzung
- sichere Apps-Script-IFrame-Brücke mit Herkunfts- und Kanalprüfung
- bestehender API-Dispatcher und bestehende serverseitige Rollen-/Rechteprüfung
- echte Initialdaten und echte Dashboard-Kennzahlen
- rollenabhängige Sichtbarkeit von Dashboard, Fanclub, Teams, Fanbus und Admin
- Logout und erneuter Login

## Noch nicht migriert

Die Fachoberflächen für Fanclub, Teams und Admin bleiben in Phase 2 bewusst Platzhalter. Das bisherige Apps-Script-Portal bleibt als Rückfalllösung verlinkt. Die eigentlichen Fachseiten folgen in Phase 3.

## Aktualisierung

Den Inhalt dieses Ordners direkt in das lokale GitHub-Repository `C:\Projekte\Portal\portal` kopieren und vorhandene Phase-1-Dateien ersetzen.

```powershell
git add .
git commit -m "Phase 2 Login und Backend verbinden"
git push
```

Vor dem GitHub-Push muss zuerst das mitgelieferte Apps-Script-Backend bereitgestellt werden.

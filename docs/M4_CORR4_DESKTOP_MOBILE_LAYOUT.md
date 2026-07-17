# M4 Corr4 – Gemeinsames Desktop-/Mobile-Layout

Status: Installationspaket, noch nicht produktiv bestätigt  
Basis: `b5870a174fe4983d3adaa91c9f4704d5a4677573`  
Vorheriger eingefrorener Korrektur-Tag: `r7.1-m4-final-corr3` → `bdbc5e278bb478a88d517ea6180eed3456357dcf`  
Neuer Tag nach erfolgreicher Installation: `r7.1-m4-final-corr4`

## Ziel

Corr4 vereinheitlicht die visuelle Struktur von PC-Browser und mobiler App, ohne den App-Fokus zu verändern. Die mobile Navigation aus Corr3 bleibt maßgeblich. Desktop erhält dieselbe klare Marken-/Kartenlogik, ein verständliches Kontomenü und robustes Breitenverhalten.

## Enthalten

- vertikales Login-/Registrierungslayout auf Desktop und Mobil
- kompakter dunkelblauer Markenbereich über die gesamte Breite
- mittig überlappende weiße Auth-Karte mit begrenzter Maximalbreite
- keine 50/50-Teilung und kein ungenutzter Ultrawide-Bereich
- responsive Desktop-Kartenraster und vollständige Seitenleistenhöhe
- mitwandernder horizontaler Scrollbalken nur bei echtem Desktop-Überlauf
- Benutzername/Avatar als Einstieg in das Kontomenü
- ausgeschriebene Aktionen „Ansicht aktualisieren“ und „Abmelden“
- unveränderter Logout-Vollbildübergang aus Corr3
- einheitliche Buttonhöhen, Schriftgrößen und einzeilige Beschriftungen

## Nicht enthalten

- keine Backend-, Datenbank-, Rollen-, Rechte- oder Fachlogikänderung
- keine Änderung am Google-Login-Vertrag
- keine v4-Funktion
- keine Änderung am roten Workflow `PWA quality`; dessen Ursachenanalyse erfolgt separat

## Erwartete Abnahme

Desktop: 1280, 1440, Full-HD und Ultrawide sowie 100 %, 125 %, 150 % und 200 % Zoom.  
Mobil: 320, 390 und 430 Pixel, Safari/PWA und Android-Browser.  
Auf Auth-Seiten sollen PC und Mobil dieselbe Komposition und dieselben Zustände zeigen.

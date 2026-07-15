# ADR-UI – GitHub-Pages-PWA als einziges normales Produktfrontend

**Status:** beschlossen und im M4-Quellpaket umgesetzt  
**Datum:** 14. Juli 2026

## Entscheidung

Die GitHub-Pages-PWA ist der einzige normale Produkteinstieg. Der Apps-Script-Endpunkt bleibt Bridge, OAuth-Callback und Ticket-/Sitzungskomponente. Ein normaler Aufruf leitet zur PWA. Die alte Apps-Script-SPA bleibt physisch erhalten, wird als Legacy/Rückfallbestand gekennzeichnet und nicht aus normalen Navigations- oder Initialisierungspfaden geladen.

## Gründe

Klare Trennung von UI und Fachservices, frühe App-Shell, echtes Lazy Loading, kontrolliertes PWA-Update und einheitliche mobile Oberfläche.

## Konsequenzen

Deep Links, Callback und Bridge müssen separat getestet werden. Ein Rollback kann den M3-Quellstand wiederherstellen, ohne Legacy-Dateien rekonstruieren zu müssen.

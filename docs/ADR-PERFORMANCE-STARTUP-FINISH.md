# ADR – R7.1 M4 Performance-/Startup-Finish

Status: angenommen  
Datum: 15. Juli 2026

## Problem

Die PWA zeigte die App-Shell bereits, während Login, Sitzung und erste Fachdaten noch geladen wurden. Dadurch entstand eine lange leere Zwischenansicht. Mehrere Fachrouten benötigten zwischen fünf und elf Sekunden; der Systemstatus blockierte bis zu rund 27 Sekunden. Offlinezustand und 200-%-Zoom waren nicht ausreichend abgesichert.

## Entscheidung

1. Der Vollbild-Splash bleibt bis zum Abschluss von Authentifizierung, Rechteaufbau und Hydrierung der ersten Route sichtbar.
2. Der Splash zeigt echte Phaseninformationen, aber keinen erfundenen Prozentwert.
3. Daten- und Modul-Warmup beginnt erst nach der ersten nutzbaren Ansicht und wird in einem gebündelten, rein lesenden Batch ausgeführt.
4. Kurzlebige Daten werden im gemeinsamen In-Memory-State wiederverwendet; das Dashboard verwendet zusätzlich eine zeitlich begrenzte lokale Sofortansicht.
5. Der Systemstatus trennt schnellen Portal-/Namensstatus von der vollständigen Datenbankprüfung. Die teure Tabellenprüfung läuft nur nach ausdrücklicher Benutzeraktion.
6. Der Service Worker cached die App-Shell und statische Routenfragmente. Fach- und Sitzungsdaten werden nicht im Service Worker gespeichert.
7. Bei Offline-Start bleibt eine vorhandene Sitzung lokal erhalten und die Oberfläche zeigt einen verständlichen Wiederverbindungszustand.
8. Das Apps-Script-Backend bleibt auf Version 62 unverändert.

## Konsequenzen

- Die erste sichtbare Portalansicht erscheint später, dafür vollständig und ohne leere Zwischenphase.
- Nachgelagerte Routen profitieren vom gebündelten Warmup.
- Eine vollständige Systemprüfung bleibt verfügbar, blockiert aber nicht mehr den normalen Adminzugang.
- Service-Worker-Updates bleiben bestätigungspflichtig.
- Schreibende Aktionen, Rechteprüfung und Datenzugriff bleiben ausschließlich serverseitig autorisiert.

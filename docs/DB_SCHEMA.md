# Datenbankschema-Ergänzung R7.1 / M4

## Allgemeiner Tabellenstandard

- Header: Zeile 1
- Daten: ab Zeile 2
- keine reservierten Leerzeilen
- keine Formeln in DB-Tabellen
- stabile fachliche IDs

## DB_Benutzer

| Feld | Regel |
|---|---|
| Benutzer-ID | stabiler technischer Schlüssel |
| Vorname | Pflicht; getrimmt; kein E-Mail-/Platzhalter-/Formel-Fallback |
| Nachname | Pflicht; getrimmt; kein E-Mail-/Platzhalter-/Formel-Fallback |
| Anzeigename | ausschließlich aus validiertem Vorname + Nachname |
| Aktiv | Aktivierung/Reaktivierung nur mit vollständigem Namen |
| Google-Sub | verifizierte Google-Identität; ersetzt keine Namensfelder |
| Google-E-Mail | Kontakt-/Loginwert; ersetzt keine Namensfelder |

## DB_BenutzerAntraege

Offene, genehmigte oder zu übernehmende Anträge benötigen gültigen Vor- und Nachnamen. Ein unvollständiger Antrag ist nicht genehmigungsfähig. Die Google-Profilwerte `given_name` und `family_name` dürfen als editierbare Vorbelegung dienen.

## DB_AuditLog

M4-Namensvorgänge speichern Objekt-ID, ausführenden Benutzer, Zeitpunkt, Aktion, betroffene Feldnamen und Ergebnis. Alte und neue vollständige Namen werden nicht unnötig dauerhaft abgelegt.

## Integritätsabfrage

`apiGetNameIntegrityStatus` beziehungsweise `m4NameIntegrityReport()` ermittelt Gesamtzahlen, fehlende Vornamen, fehlende Nachnamen, aktive unvollständige Benutzer, unvollständige relevante Anträge und den Status der geschützten Admin-IDs `U-0001` und `U-0009`.

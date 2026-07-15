# AE-R7.1-01 – Pflichtfelder Vorname und Nachname

**Entscheidungs-ID:** AE-R7.1-01  
**Datum:** 14. Juli 2026  
**Status:** fachlich freigegeben; im M4-Quellpaket umgesetzt; produktive Daten- und Geräteabnahme ausstehend  
**Ersetzt durch:** keine spätere Änderungsentscheidung

## Fachliche Begründung

Google-Anzeigename, E-Mail-Adresse und technisch erzeugte Ersatzwerte sind keine belastbare Grundlage für getrennte Vor- und Nachnamen. Jeder Portalbenutzer und jeder gültige Freischaltungsantrag benötigt deshalb einen getrimmten, nicht leeren Vornamen und Nachnamen.

## Betroffene Prozesse

Erstanmeldung unbekannter Google-Nutzer, Freischaltungsantrag, Antragsänderung und -genehmigung, direkte Benutzeranlage, Benutzerbearbeitung, Aktivierung und Reaktivierung, verpflichtende Profilvervollständigung sowie Bestandsanalyse und Migration.

## Betroffene Tabellen

- `DB_Benutzer`: `Vorname`, `Nachname`, `Anzeigename`, Aktivstatus
- `DB_BenutzerAntraege`: `Vorname`, `Nachname`, Antragsstatus
- `DB_AuditLog`: datensparsame Aktions- und Feldnachweise

## Betroffene APIs

- `apiGetRequiredProfile`
- `apiCompleteRequiredProfile`
- `apiGetNameIntegrityStatus`
- `apiGetNavigationContext`
- `pwaBridgeSubmitAccessRequest`
- bestehende Benutzer-, Antrags-, Aktivierungs- und Login-APIs über das zentrale Dispatch-Gate

## Betroffene Oberflächen

Öffentliche Google-Anmeldung, Registrierung/Freischaltungsantrag, verpflichtende Profilvervollständigung, Administration → Benutzer, Administration → Freischaltungsanträge und Systemstatus.

## Validierungsregeln

1. `Vorname.trim().length > 0` und `Nachname.trim().length > 0`.
2. Whitespace und Steuerzeichen werden normalisiert; äußere Leerzeichen werden entfernt.
3. E-Mail, Anzeigename als alleiniger Ersatz, `Unbekannt`, `User`, `N/A`, `-` und vergleichbare Platzhalter sind unzulässig.
4. Werte werden niemals aus dem Teil vor `@` abgeleitet.
5. Unicode, Umlaute, Akzente, Leerzeichen und Bindestriche innerhalb realer Namen bleiben zulässig.
6. Führende Tabellen-Formelzeichen `=`, `+`, `-` und `@` werden zur Vermeidung von Spreadsheet-Injektionen abgewiesen.
7. Clientprüfungen ergänzen die serverseitige Prüfung, ersetzen sie aber nicht.

## Migrationsauswirkung

Unvollständige aktive Bestandsbenutzer werden nach erfolgreicher Authentifizierung in `PROFIL_VERVOLLSTAENDIGUNG_ERFORDERLICH` gesetzt. In diesem Zustand sind nur Profilprüfung, Speichern von Vor-/Nachname und Logout zulässig. Rollen, PD-ID, Ämter, Teams und Rechte werden nicht verändert. Unvollständige Anträge dürfen nicht genehmigt werden. Namen werden nicht geraten.

## Audit

Protokolliert werden die Benutzer- oder Antrags-ID, ausführender Benutzer, Zeitpunkt, Aktion, betroffene Feldnamen und Ergebnis. Alte und neue vollständige Namen werden nicht in das M4-Namensaudit geschrieben.

## Testanforderungen

Die verbindlichen Fälle NAME-01 bis NAME-20 sowie der zusätzliche Injektionsfall NAME-21 sind in `M4_Namepflicht_Validierungs_und_Migrationsmatrix.csv` geführt. API-Negativtests, Bestandsprüfung, Browser-/Geräteabnahme und Datenintegritätsprüfung bleiben Release-Gates für M5.

## Umsetzungsergebnis

- zentrale Backendrichtlinie in `28_R7_1_M4_PWA_NamePolicy.gs`
- Pflichtprüfung in Benutzer-, Antrags-, Login-, Aktivierungs- und Profilabläufen
- klar unterscheidbare Fehlercodes
- eingeschränkter Profilzustand
- datensparsame Audits
- feste UI-Formulare mit getrennten Feldern und zugeordneten Fehlern
- lokale Vertrags-, Syntax- und Regeltests bestanden

## Offene Punkte

Die produktiven Bestandszahlen, Bereinigung realer Datensätze, Live-API-Negativtests und Browser-/Geräteabnahme können ohne authentifizierten Google-/GitHub-Zugriff nicht in der Artefaktumgebung ausgeführt werden. Sie sind im Operatorpaket und im M5-Prompt verbindlich aufgeführt.

## Freigabestatus

**Quell- und Dokumentationsfreigabe M4:** bestanden.  
**Produktive Daten-/Releasefreigabe:** ausstehend bis Operatornachweise vollständig vorliegen.

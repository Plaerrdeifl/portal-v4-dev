# AE-V4-02 – Fünf feste Amtsplätze

**Entscheidungs-ID:** AE-V4-02
**Datum:** 19. Juli 2026
**Status:** fachlich freigegeben
**Geltungsbereich:** Plärrdeifl Portal V4 / Supabase-Neuaufbau

## Entscheidung

Die Vereinsstruktur besitzt dauerhaft genau fünf feste Amtsplätze:

- `VORSTAND_1`
- `VORSTAND_2`
- `VORSTAND_3`
- `KASSIER`
- `SCHRIFTFUEHRER`

Diese Amtsplätze sind keine frei verwaltbaren Portalrollen. Sie werden weder
beliebig angelegt noch gelöscht.

## Besetzung

Ein Administrator kann im Portal:

- einen Amtsplatz einem aktiven Mitglied zuweisen,
- eine Besetzung ändern,
- eine Besetzung entfernen,
- alle fünf Amtsplätze gemeinsam prüfen und speichern.

Die Zuweisung erfolgt an die technische Mitgliedsidentität. Eine PD-ID dient
als sichtbarer fachlicher Code, nicht als Fremdschlüssel.

## Integritätsregeln

Die Datenbank erzwingt:

- höchstens eine aktive Besetzung je Amtsplatz,
- höchstens einen Amtsplatz je Mitglied,
- ausschließlich aktive Mitglieder als Amtsinhaber,
- zulässige vorübergehend unbesetzte Amtsplätze,
- konfliktfreie gemeinsame Speicherung aller fünf Besetzungen,
- vollständige Auditierung jeder Änderung.

## Wirkung im Portal

Die Rechtekette lautet:

```text
Supabase-Auth-Benutzer
→ aktiver Portalbenutzer
→ aktive Benutzer-Mitglied-Verknüpfung
→ aktives Mitglied
→ besetzter Amtsplatz
→ Amtsberechtigungen
```

Ohne aktiven verknüpften Portalzugang bleibt die Amtsbesetzung fachlich
bestehen, erzeugt aber keine nutzbaren Portalrechte.

## Amtsrechte

Alle fünf Amtsinhaber erhalten die Vorstandsgrundrechte:

- Mitgliedsdaten ansehen und bearbeiten,
- Beiträge ansehen,
- Beitragszahlungen melden,
- Kassenbuch, Konten und Salden ansehen,
- Vorstandsaufgaben erstellen und verwalten.

Zusätzlich gilt:

- `KASSIER` erhält die festgelegten Finanz-Schreibrechte.
- Administratoren besitzen unabhängig von einer Amtsbesetzung vollständige
  Rechte.
- `VORSTAND_1`, `VORSTAND_2`, `VORSTAND_3` und `SCHRIFTFUEHRER` erhalten nicht
  automatisch die geschützten Finanz-Schreibrechte.
- Der Schriftführer besitzt keine zusätzlichen Finanzrechte.

## Trennung von Rolle und Amt

Portalrollen sind frei erweiterbar und administrierbar.

Die fünf Amtsplätze bleiben dagegen eine feste Vereinsstruktur. Amtsrechte
ergänzen die jeweilige Portalrolle und ersetzen sie nicht.

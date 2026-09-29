# PD-Portal – Mail-Modul V1

**Stand:** 29.09.2026  
**Status:** Zielbild; Umsetzung nach höher priorisierten Modularisierungsphasen

## Ziel

Berechtigte Portalnutzer sollen Funktionspostfächer direkt im PD-Portal verwenden können, ohne die Mailbox-Passwörter zu kennen.

## Ziel-Repository

`Plaerrdeifl/mail`

Frontend:

- React
- TypeScript
- Vite
- gemeinsame PD-Portal-Auth-/API-/UI-Basis

Serverseitig:

- eigener Mail-Gateway
- IMAP für Lesen/Ordner/Status
- SMTP für Versand
- Provider-Secrets ausschließlich serverseitig

## Funktionsumfang V1

- Postfachauswahl nach Berechtigung
- Posteingang
- Ordner
- ungelesen/gelesen
- Nachricht lesen
- Suche
- Antworten
- Allen antworten
- Weiterleiten
- neue Nachricht
- Anhänge
- Entwürfe
- Gesendet
- Papierkorb

## Berechtigungsmodell

Beispiel:

- SOCIAL_MEDIA → Social-Media-Funktionspostfach
- VORSTAND → Vorstands-Funktionspostfach
- FANBUS → Fanbus-Funktionspostfach
- weitere Postfächer über explizite Capability-/Teamzuordnung

Ein Benutzer sieht nur die Postfächer, für die das PD-Portal ihm Zugriff gibt.

Mehrere Benutzer dürfen dasselbe Funktionspostfach verwenden, ohne das Providerpasswort zu kennen.

## Sicherheitsgrenze

Nicht zulässig:

- IMAP-/SMTP-Passwörter im Browser
- Secrets in LocalStorage
- direkte Browser-IMAP-/SMTP-Verbindungen
- frei lesbare Credentials in Supabase-Anwendungstabellen

Zielkette:

```text
PD-Portal / Mail-PWA
        |
        | Portal-Session + Capability
        v
PD Mail Gateway
        |
        +--> IMAPS
        +--> SMTPS
        |
        v
Mailprovider
```

## Source of Truth

Der Mailprovider bleibt Source of Truth für:

- Nachrichten
- Ordner
- Flags
- Anhänge

Das PD-Portal hält nur den für Integration, Berechtigungen, Audit und optionale Verknüpfungen notwendigen Zustand.

## Spätere Integrationen

Erst nach stabilem Mail-Grundbetrieb:

- Mail als Aufgabe anlegen
- Nachricht mit Mitglied verknüpfen
- Fanbus-/Buchungskontext
- Social-Media-Anfrage zuordnen
- interne Zuständigkeit/Übergabe

Diese Integrationen dürfen nicht dazu führen, dass Mailinhalte ungeprüft in andere Fachdomänen dupliziert werden.

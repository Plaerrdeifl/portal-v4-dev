# PD-Portal – Identity-Integrationen V1

**Stand:** 29.09.2026  
**Status:** Architektur-/Migrationsplan, noch keine PROD-Umsetzung

## Ziel

Das PD-Portal ist die zentrale Identitäts- und Berechtigungsquelle für integrierte Dienste. Externe Systeme dürfen lokale technische Benutzer führen, aber keine konkurrierende führende Zugangslogik aufbauen.

## Nextcloud

Der bestehende Portal-OAuth/OIDC-Zugang bleibt erhalten.

Zugriff wird weiterhin aus Portalzustand und Portalberechtigungen abgeleitet.

## WordPress

WordPress wird als weiterer Portal-SSO-Client angebunden.

Zielablauf:

1. Benutzer wählt in WordPress „Mit PD-Portal anmelden“.
2. PD-Portal prüft bestehende Supabase-/Portal-Session.
3. PD-Portal prüft aktive Benutzerlage und die für WordPress geltende Zugangsregel.
4. Für das Social-Media-Team wird der Zugriff aus zentraler Teamzugehörigkeit bzw. einer geeigneten Capability abgeleitet.
5. Nach erfolgreicher OAuth/OIDC-Autorisierung erhält WordPress nur notwendige Identitätsdaten.
6. WordPress ordnet die Identität einem lokalen technischen WordPress-Benutzer zu.
7. Die lokale WordPress-Rolle ist minimal und für Redaktions-/Autorenaufgaben zugeschnitten.
8. Ein Entzug der Portalberechtigung wirkt spätestens bei der nächsten Session-/Autorisierungsprüfung.

WordPress-Passwörter sind für diese Portalnutzer nicht die führende Identität.

## WordPress-Rolle im Gesamtsystem

WordPress bleibt:

- öffentliche Vereinswebsite
- News-/Content-System
- WooCommerce-Laufzeit
- öffentlicher Einstiegspunkt in ausgewählte Portalprozesse

WordPress wird nicht zur Source of Truth für:

- Portalbenutzer
- Portalrollen
- Portalteams
- Mitglieder
- Events / Spielplan
- Fanbus
- Liveticker
- Tasks
- Finance
- Generator

## Bestehender OAuth-Flow

Der aktuelle Consent-Flow ist noch Nextcloud-spezifisch. Er wird vor WordPress-SSO zu einer allgemeinen Client-basierten Portal-Identity-Oberfläche weiterentwickelt.

Der Consent-Dialog muss Clientname, Scopes und Zugangsregel aus dem tatsächlichen OAuth-Client ableiten statt Nextcloud fest zu verdrahten.

## Sicherheitsregeln

- keine Portal- oder Supabase-Secrets in WordPress-Frontendcode
- nur notwendige OAuth/OIDC-Scopes
- Autorisierung serverseitig/über den bestehenden Portal-Identity-Flow
- Portalteam/-capability bleibt Zugangsquelle
- keine automatische Admin-Rolle in WordPress
- lokale WordPress-Rechte nach Least Privilege
- bestehender Nextcloud-Zugang darf durch die Verallgemeinerung nicht regressieren

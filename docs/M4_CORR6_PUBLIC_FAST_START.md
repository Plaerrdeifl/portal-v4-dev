# M4 Corr6 – öffentlicher Schnellstart

## Ziel

Der normale Aufruf des Portals zeigt sofort den öffentlichen Bereich. Die öffentliche Startseite und das Burger-Menü sind direkt in `index.html` vorgerendert und benötigen weder Google noch das Backend.

## Verhalten

- Startseite, Aktuelles, Termine, Über uns, Kontakt und Installationshinweise laden ohne Anmeldung.
- Auf der Startseite gibt es keinen Anmelde- oder Registrierungsbutton im Inhalt.
- Ein Hinweis verweist auf das Burger-Menü.
- Im Burger-Menü stehen „Anmelden“ und „Registrieren“ getrennt zur Verfügung.
- Erst bei Auswahl von Anmeldung, Registrierung oder „Portal öffnen“ wird `auth.initialize()` ausgeführt.
- Eine vorhandene gespeicherte Sitzung leitet beim normalen Aufruf nicht automatisch auf das Dashboard weiter.
- Bei vorhandener Sitzung erscheint im Menü zusätzlich „Portal öffnen“.
- Backend, Datenmodell, Rollen, Rechte und Fachlogik bleiben unverändert.

## Technische Abgrenzung

Der öffentliche Schnellstart lädt nur statische Dateien desselben GitHub-Pages-Ursprungs. Die bisherigen Backend-Preconnects wurden aus `index.html` entfernt. Google Identity Services wird weiterhin erst innerhalb der Loginseite dynamisch geladen.

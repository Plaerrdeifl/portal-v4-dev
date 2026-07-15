# Identität und Login

## Öffentlicher Ablauf

Die öffentliche Landingpage bleibt vor der Anmeldung sichtbar. Google Identity Services liefert eine verifizierte Identität. `given_name` und `family_name` werden als editierbare Vorbelegung verwendet; `name` und E-Mail ersetzen keine getrennten Felder.

## Unbekannter Benutzer

Das Backend erzeugt einen kurzlebigen, einmalig verwendbaren Registrierungsnachweis. Der Benutzer ergänzt Vor- und Nachname und übermittelt erst danach einen Freischaltungsantrag. Ohne beide gültigen Felder wird nichts gespeichert.

## Bekannter vollständiger Benutzer

Nach erfolgreichem Login lädt die PWA Identität, Rechte und die feste Navigation. Ein zusätzlicher „Portal öffnen“-Schritt ist nicht erforderlich.

## Bekannter unvollständiger Benutzer

Die Sitzung erhält `PROFIL_VERVOLLSTAENDIGUNG_ERFORDERLICH`. Nur Profilprüfung, Namensspeicherung und Logout sind erlaubt. Nach erfolgreichem Speichern werden Identität und Rechte neu geladen.

## Deep Links und OAuth

OAuth-Callback und Bridge bleiben im Apps-Script-Endpunkt. Der normale Apps-Script-Aufruf führt kontrolliert zur PWA. Registrierungsparameter werden nach einmaliger Übernahme aus der URL entfernt.

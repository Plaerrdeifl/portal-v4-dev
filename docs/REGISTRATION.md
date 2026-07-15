# Benutzerregistrierung und Freischaltungsantrag

1. Google-Identität verifizieren.
2. `given_name` und `family_name` getrennt vorbelegen, sofern vorhanden.
3. Vor- und Nachname als editierbare Pflichtfelder anzeigen.
4. Clientseitig verständliche Feldfehler ausgeben.
5. Server validiert unabhängig vom Client.
6. Antrag nur mit vollständigem Namen speichern.
7. Keine Ableitung aus E-Mail, Anzeigename oder technischen Platzhaltern.
8. Audit speichert technische ID, Aktion, Felder und Ergebnis, nicht alte/neue Vollnamen.

Unvollständige Anträge sind nicht genehmigungsfähig. Unicode-, Mehrfach- und Bindestrichnamen bleiben zulässig.

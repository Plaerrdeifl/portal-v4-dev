# Plärrdeifl Portal V4 – verbindlicher UX-Interaktionsstandard

Status: VERBINDLICH  
Geltungsbereich: gesamtes Portal V4 einschließlich Fanclub, Aufgaben, Teams, Administration, Fanbusse und zukünftige Module

## 1. Mobile First und kompakte Informationsdichte

Mobile Listen und Karten zeigen zunächst nur die für die Orientierung notwendigen Angaben. Detailinformationen werden erst nach dem Antippen geladen oder geöffnet. Unnötige Kartenhöhe, große Leerflächen, wiederholte Erklärtexte und große Verwaltungsflächen sind zu vermeiden. Desktop darf ausführlicher darstellen, muss aber dasselbe Bedienmodell verwenden.

## 2. Überschrift mit kleiner Nebenaktion

Bereichsüberschriften stehen links. Hinzufügen, Verwalten, Filtern und vergleichbare Nebenaktionen erscheinen als kleine graue Schaltfläche direkt daneben, zum Beispiel `+ Mitglied`, `+ Beitragsklasse` oder `Verwalten`.

Große seitenbreite Verwaltungsbuttons sind nur zulässig, wenn eine einzelne Hauptaktion fachlich wirklich im Mittelpunkt steht.

## 3. Verbindliche Button-Hierarchie

- Grau: Öffnen, Anzeigen, Verwalten, Filtern, Bearbeiten und weitere Nebenaktionen.
- Blau: Speichern, Bestätigen, Buchen und wichtige abschließende Aktionen.
- Rot: Löschen, Ablehnen und Stornieren.

## 4. Antippbare Datensätze und Chevron

Die gesamte kompakte Zeile oder Karte ist nach Möglichkeit antippbar. Antippbare Mitglieder, Beiträge, Beitragsklassen, Konten, Buchungen, Aufgaben, Teams, Fahrten und Benutzer erhalten rechts einen kleinen Chevron. Zusätzliche große `Anzeigen`-Buttons sind zu vermeiden.

## 5. Lesen vor Bearbeiten

Detailansichten öffnen grundsätzlich im Lesemodus. Erst `Bearbeiten` aktiviert Eingabefelder. Danach stehen `Speichern` und `Abbrechen` zur Verfügung. Dadurch werden versehentliche Änderungen vermieden.

## 6. Suche, Filter und historische Daten

Längere Listen erhalten eine kompakte Suche. Inaktive, erledigte oder archivierte Datensätze sind standardmäßig ausgeblendet und werden nur über einen kleinen, berechtigungsabhängigen Filter eingeblendet.

## 7. Berechtigungen und Datenschutz

Verwaltungsfunktionen werden nur berechtigten Benutzern angeboten. Sensible Daten dürfen nicht lediglich im Frontend verborgen werden, sondern müssen bereits serverseitig aus der Standardantwort entfernt oder über eine gesondert geschützte Detailaktion geladen werden.

## 8. Scrollverhalten

Auf Mobilgeräten scrollt grundsätzlich die Seite. Verschachtelte kleine Scrollbereiche sind zu vermeiden. Lange Listen verwenden Suche, Filter, Pagination oder `Weitere anzeigen`. Dialoge dürfen als Ganzes scrollen. Das letzte Element einer Seite muss vollständig oberhalb der festen unteren Navigation erreichbar bleiben.

## 9. Statusdarstellung

Status werden mit Farbe, Punkt und lesbarem Text dargestellt. Farbe allein reicht nicht aus.

- Grau: nicht zugeordnet, inaktiv oder neutral.
- Rot: offen, fehlerhaft oder Handlungsbedarf.
- Gelb: in Bearbeitung oder in Prüfung.
- Grün: aktiv, abgeschlossen oder bezahlt.

## 10. Globale UI-Bausteine und Übergänge

Seiten, Bereichsüberschriften, Nebenaktionen, kompakte Listen, Karten, Dialoge, Formulare, Navigation und mobile Sicherheitsabstände werden über gemeinsame Portalbausteine gesteuert. Module dürfen diese Grundlagen fachlich ergänzen, aber keine parallelen Größen-, Scroll-, Dialog- oder Navigationssysteme einführen.

Anmeldung und Abmeldung verwenden einen einzigen zentralen Übergangscontroller und den vorhandenen Portal-Splash. Zwischenzustände dürfen weder die Login-Seite noch geschützte Portalansichten erneut sichtbar machen.

Mobile Eingabefelder verwenden mindestens 16 Pixel Schriftgröße. Dialoge entfernen den Eingabefokus beim Schließen und geben den Fokus anschließend an den Auslöser zurück.

## 11. Verwaltbare Reihenfolge

Fachlich verwaltbare Listen wie Beitragsklassen und Finanzkonten besitzen eine explizite Position. Die Position wird serverseitig gespeichert und ist Bestandteil der geschützten Fachantwort. Kleinere Werte erscheinen zuerst; bei gleicher Position entscheidet die Bezeichnung stabil über die Reihenfolge.

Neue Einträge erhalten standardmäßig Abstände in Zehnerschritten. Dadurch können Administratoren später Einträge dazwischen einsortieren, ohne die gesamte Liste neu nummerieren zu müssen. Inaktive Einträge behalten ihre Position.

## 12. Löschen unbenutzter Stammdaten

Falsch angelegte Beitragsklassen dürfen endgültig gelöscht werden, solange sie noch keiner Beitragszuordnung verwendet wurden. Die Löschbarkeit wird serverseitig ermittelt und beim Löschvorgang erneut geprüft. Bereits verwendete Beitragsklassen bleiben aus Gründen der Nachvollziehbarkeit erhalten und können nur deaktiviert werden. Jede endgültige Löschung wird auditiert.

## 13. Abweichungen

Abweichungen von diesem Standard benötigen einen konkreten fachlichen Grund und müssen ausdrücklich dokumentiert werden.

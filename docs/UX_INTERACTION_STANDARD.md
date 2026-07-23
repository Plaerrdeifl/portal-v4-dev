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
## 12. Fanclub-Abschlussregeln für Beiträge und Dialoge

Sortierpositionen sind technische Verwaltungswerte. Sie werden in normalen Listen und Karten nicht angezeigt und erscheinen nur beim Bearbeiten bestehender Beitragsklassen oder Finanzkonten. Neue Einträge erhalten serverseitig automatisch die nächste Position.

Eine ungebuchte Beitragszuordnung darf wieder auf `Keine Beitragsklasse` gesetzt und dadurch vollständig entfernt werden. Sobald für die Zuordnung eine Zahlungsmeldung existiert, bleibt sie aus Gründen der Nachvollziehbarkeit erhalten.

Ein Beitragsjahr darf nur endgültig gelöscht werden, wenn es keine Beitragszuordnungen mehr enthält. Verwendete Jahre werden deaktiviert. Alle endgültigen Löschungen und entfernten Zuordnungen werden serverseitig geprüft und auditiert.

Fanclub-Dialoge verwenden dieselbe Button-Hierarchie, dunkle Umrandungen, ausreichende Mindesthöhen und mobile einspaltige Aktionsflächen. Buttontexte dürfen nicht abgeschnitten werden.

## 14. Portalweiter Phase-2-Abnahmestandard

Der kompakte Interaktionsstandard gilt für Dashboard, Fanclub, Aufgaben, Teams,
Administration, Benutzermenü, Profil- und Datendialoge sowie für alle
fachlichen Dialoge. Formulare verwenden kurze Abstände, 42 bis 44 Pixel hohe
Bedienelemente, mindestens 16 Pixel Schriftgröße in mobilen Eingabefeldern,
zweispaltige sinnvolle Feldpaare und kompakte, erreichbare Aktionsleisten.

Portalaktionen verwenden einheitlich Blau für primäre Bestätigungen,
Hellgrau oder Weiß für neutrale Nebenaktionen und Rot für destruktive
Aktionen. Bedienbare Schaltflächen besitzen eine klar erkennbare dunkle
Umrandung. Fachliche Validierungsfehler werden am betroffenen Feld und als
kompakte Meldung ausgegeben; sie verändern nicht den globalen
Verbindungsstatus.

Die mobile Inhaltsfläche reserviert den vollständigen Platz für die feste
Bottom-Navigation und die Safe Area. Toasts liegen oberhalb der Navigation.
Leere, ladende und fehlerhafte Zustände dürfen keine künstlichen Großflächen
erzeugen.

Bei Kontoauszügen und Buchungslisten wird die gesamte Einnahmezeile hellgrün
und die gesamte Ausgabezeile hellrot hinterlegt. Betrag, Vorzeichen,
Buchungsart und Stornohinweise bleiben zusätzlich als textliche Kennzeichnung
erhalten.

Eine Beitragszuordnung bleibt bei `PENDING` und bei einer noch wirksamen
`CONFIRMED`-Zahlung gesperrt. `REJECTED` und `REVERSED` blockieren die
Entfernung nicht. Die Zahlungsmeldung, Prüfdaten, ursprüngliche Buchung,
Gegenbuchung und Audit-Historie bleiben erhalten.

## 15. Kompakte Listen, proportionale Formulare und Finanzkonto-Ruhestand

Aufgaben und Teams werden in Übersichten als kompakte, vollständig anklickbare Zeilen dargestellt. Beschreibungen, Verwaltungsdaten und Aktionen erscheinen erst in der jeweiligen Detailansicht.

Formulare verwenden ein gemeinsames Zwölf-Spalten-Raster. Feldbreiten richten sich nach dem erwarteten Inhalt. Bei sehr schmalen Geräten fällt das Raster kontrolliert auf eine Spalte zurück.

Inaktive Finanzkonten mit einem Kontostand von exakt 0,00 Euro dürfen nur durch Portaladmins aus der aktiven Kontoverwaltung entfernt werden. Buchungen, Gegenkonten, Zahlungsmeldungen und Audit-Nachweise bleiben erhalten. Offene Zahlungsmeldungen verhindern die Entfernung.

## 16. Abschließende mobile Portalhülle

Die Desktop-Sidebar darf horizontal niemals scrollen. Navigationsschaltflächen
bleiben innerhalb der verfügbaren Breite; notwendiges vertikales Scrollen der
Navigation bleibt erhalten.

Dialogformulare verwenden das gemeinsame Zwölf-Spalten-Raster ohne
konkurrierende Zwei-Spalten-Regel. Feldproportionen bleiben auf mobilen Geräten
erhalten und fallen bei sehr schmalen Viewports kontrolliert auf eine Spalte
zurück.

Finanzkonten zeigen in Übersichten Name und Betrag in getrennten Rasterzeilen
mit festem Öffnungs-Chevron. Beitragszusammenfassungen verwenden dieselben
dezenten Grün- und Rotflächen wie Kontoauszüge; offene Prüfungen werden gelb
hervorgehoben.

Die installierte PWA verwendet die reale dynamische Viewporthöhe. Die
Portalhülle selbst bleibt fest auf `100dvh`, während ausschließlich die
Inhaltsansicht vertikal scrollt. Die untere Navigation endet am tatsächlichen
Bildschirmrand und berücksichtigt die iOS-Safe-Area genau einmal.

## 17. Finale visuelle Konsistenz

Die mobile Bottom-Navigation besitzt eine exakt begrenzte Inhaltshöhe zuzüglich
der tatsächlichen Safe Area. Eine flexible oder gestreckte Restfläche unter den
Navigationsschaltflächen ist unzulässig.

Dialoge, Profilfenster und Benutzermenü sind inhaltsbasiert. Kurze Inhalte
ziehen die Hülle zusammen; lange Inhalte nutzen höchstens den verfügbaren
Viewport und scrollen ausschließlich im Inhaltsbereich. Unter dem letzten
Element bleibt ein normaler Innenabstand, jedoch keine künstliche Resthöhe.

Smart Forms behalten in allen mobilen Media Queries ihr Zwölf-Spalten-Raster.
Allgemeine Zwei-Spalten-Regeln dürfen Smart Forms nicht überschreiben.
Feldpaare erhalten einen echten Rasterabstand und wechseln erst auf sehr
schmalen Geräten kontrolliert auf eine Spalte.

Vertikale Abstände in Modulansichten entstehen ausschließlich über den
gemeinsamen Panel-Gap. Zusätzliche Außenabstände direkter Panel-Kinder werden
entfernt, damit Überschrift, Filter, Listen und Folgeabschnitte einen
einheitlichen Rhythmus besitzen.

## 18. Globaler UI-Abschluss

Der Sichtbarkeitszustand von Overlays wird ausschließlich über den nativen
`hidden`-Vertrag gesteuert. Komponentenregeln dürfen `[hidden]` niemals durch
ein späteres `display` mit `!important` überstimmen. Benutzermenü und Backdrop
müssen über Schließen-Schaltfläche, Backdrop, Escape und Navigation zuverlässig
geschlossen werden; anschließend wird der Fokus zum auslösenden Profilknopf
zurückgegeben.

Safe Areas werden nur an fest am Bildschirmrand sitzenden Komponenten
berücksichtigt. Frei im Viewport platzierte Dialoge erhalten unter ihren
Aktionsschaltflächen ausschließlich den normalen Innenabstand.

Native Datums- und Auswahlfelder dürfen ihre Rasterzelle nicht durch eine
intrinsische Mindestbreite vergrößern. Smart Forms begrenzen alle Felder auf
ihre Grid-Spalte. Auf Mobilgeräten werden Vier-Spalten-Felder zu stabilen
Halbbreiten; lange Kontoauswahlen stehen untereinander.

## 19. iOS-Datumsfelder und mobile Safe Area

Native iOS-Datumsfelder verwenden dieselbe feste Feldhöhe wie Text- und
Auswahlfelder. WebKit-interne Datumsbestandteile dürfen weder die Rasterzelle
verbreitern noch die Feldhöhe verändern. Das Smart-Form-Raster begrenzt die
intrinsische Inline-Größe und stellt einen sichtbaren Spaltenabstand sicher.

Die Bottom-Navigation verwendet eine eigene, begrenzte mobile Safe Area. Der
ungeprüfte Systemwert darf die Navigation nicht künstlich vergrößern. Der
Buttonbereich bleibt 64 Pixel hoch; darunter wird höchstens die tatsächlich
benötigte iPhone-Unterkante von 34 Pixeln reserviert.

## 20. Bottom-Navigation nach Darstellungsmodus

Die mobile Bottom-Navigation besitzt einen 64 Pixel hohen Buttonbereich.

Im normalen Browser wird kein zusätzlicher unterer Navigationsraum reserviert.
Der globale Token `--mobile-safe-bottom` beträgt dort 0 Pixel.

Nur in der installierten Standalone-PWA wird derselbe Token innerhalb der
bestehenden `display-mode: standalone`-Regel auf 10 Pixel gesetzt. Dadurch
bleibt ein kleiner Abstand zur iPhone-Gestenzone erhalten, ohne die
Navigationsbuttons sichtbar nach oben zu verschieben.

Alle von der Bottom-Navigation abhängigen Inhalts-, Menü-, Toast- und
Scrollabstände verwenden weiterhin denselben Token.

## 21. iOS-Standalone-Viewport

Die PWA behält `viewport-fit=cover` und den Statusbarmodus
`black-translucent`. Die Footerposition wird nicht über den Statusbarmodus
korrigiert, sondern ausschließlich über die gemeinsame
Bottom-Navigationsgeometrie.

Negative Gegenversätze, Transformationen oder gerätespezifische
Korrekturlayer sind unzulässig.


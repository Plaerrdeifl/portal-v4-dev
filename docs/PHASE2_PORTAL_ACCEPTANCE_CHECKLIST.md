# Plärrdeifl Portal V4 – Phase-2-Abnahmecheckliste

Diese Checkliste wird nach erfolgreicher technischer Installation auf dem
echten DEV-Portal durchgeführt. PROD bleibt bis zur ausdrücklichen Freigabe
unberührt.

## Geräte und Betriebsarten

- iPhone Safari im Hochformat
- iPhone als installierte PWA
- schmales Android-Gerät
- Tablet
- Desktop-Browser
- Online, kurzzeitig offline und nach erneuter Verbindung
- Aktualisierung bei bereits installiertem Service Worker

## Portalhülle

- Kopfzeile bleibt stabil und verdeckt keinen Inhalt.
- Bottom-Navigation verdeckt den letzten Eintrag nicht.
- Alle Seiten lassen sich bis zum echten Ende scrollen.
- Safe Areas funktionieren in Safari und PWA.
- Ein fachlicher Formularfehler ändert „Live“ nicht auf „Fehler“.
- Echte Offline- oder Supabase-Fehler werden weiterhin als Fehler angezeigt.
- Toasts sind lesbar, kompakt, antippbar und liegen oberhalb der Navigation.

## Dialoge und Formulare

- Mitglied anlegen und bearbeiten
- Vorstand verwalten
- Beitragsjahr und Beitragsklasse
- Beitragszuordnung und Zahlungsmeldung
- Konto, Einnahme, Ausgabe, Umbuchung und Storno
- Aufgabe, Aufgabennotiz und endgültige Löschung
- Team, Teamrolle und Teammitgliedschaft
- Benutzermenü sowie Profil und Daten
- Administration und Rollenverwaltung

Prüfpunkte:

- Keine horizontale Überbreite.
- Eingabefelder bleiben bei eingeblendeter Tastatur erreichbar.
- Sinnvolle Feldpaare stehen nebeneinander.
- Abbrechen und Speichern sind kompakt erreichbar.
- Lange Namen, E-Mail-Adressen, Texte und Beträge brechen sauber um.
- Feldfehler erscheinen am betroffenen Eingabefeld.
- Destruktive Bestätigungen verwenden den einheitlichen Portaldialog.

## Fanclub

- Kein Leerraum zwischen Mitgliedersuche, Inaktiv-Filter und Mitgliederliste.
- Der 1. Vorstand ist in der normalen Ansicht mittig.
- Die Vorstandsverwaltung ist mobil einspaltig und vollständig bedienbar.
- Beiträge und Kasse sind kompakt.
- Positionen erscheinen nur beim Bearbeiten.
- Unbenutzte Beitragsklassen und Beitragsjahre lassen sich sicher löschen.

## Beitragszahlungen

- PENDING verhindert das Entfernen der Zuordnung.
- CONFIRMED verhindert das Entfernen, solange die Buchung wirksam ist.
- REJECTED erlaubt das Entfernen.
- CONFIRMED, danach storniert zu REVERSED, erlaubt das Entfernen.
- Abgelehnte und stornierte Meldungen bleiben in der Historie sichtbar.
- Buchung und Gegenbuchung bleiben im Kassenbuch.
- Nach Auflösung kann erneut eine Beitragsklasse zugeordnet werden.
- Teilzahlungen und mehrere Meldungen werden korrekt summiert.

## Kasse

- Jede Einnahmezeile ist hellgrün.
- Jede Ausgabezeile ist hellrot.
- Farben gelten im Gesamtkassenbuch und in jedem Kontoauszug.
- Stornozeilen folgen ihrer tatsächlichen Buchungsrichtung.
- Stornohinweis und Vorzeichen bleiben zusätzlich sichtbar.
- Suche, weitere Buchungen und Kontodetails funktionieren.

## Aufgaben, Teams und Dashboard

- Karten, Rahmen, Radien, Abstände und Buttons entsprechen dem Fanclub-Design.
- Aufgabenfilter und Teamwerkzeuge sind kompakt und umbrechen sauber.
- Aufgabenstatus, Bearbeiten, Notiz und Archivierung sind erreichbar.
- Teammitglieder, Rollen und Löschabhängigkeiten sind lesbar.
- Dashboard-Karten sind kompakt und auf Mobilgeräten zweispaltig.
- Leere und große Datenmengen bleiben stabil.

## Abschluss

Phase 2 wird erst geschlossen, wenn alle Punkte auf DEV geprüft, dokumentiert
und ausdrücklich abgenommen sind.

## Finale visuelle Prüfrunde

### PWA und Navigation

- Dashboard öffnen: Unter den fünf Navigationsschaltflächen bleibt nur die
  tatsächliche iPhone-Safe-Area.
- Fanclub, Aufgaben, Teams und Mehr öffnen: Höhe und Position der
  Bottom-Navigation bleiben identisch.
- Letzten Datensatz jeder Ansicht erreichen, ohne dass er verdeckt wird.
- Desktop-Navigation mit der Maus überfahren: kein horizontaler Scrollbalken.

### Dialoge

- Fanclub → Mitglieder → „+ Mitglied“:
  Vorname/Nachname und E-Mail/Telefon stehen gleich breit nebeneinander;
  Straße/Hausnummer und PLZ/Ort sind 9:3 verteilt; Datumsfelder besitzen Abstand;
  Status zeigt „Aktiv“ vollständig.
- Fanclub → Beiträge → Verwalten → Beitragsjahr anlegen und bearbeiten:
  Beginn und Ende sind gleich breit und klar getrennt.
- Fanclub → Kasse → Verwaltung:
  Unter „Konto anlegen“ bleibt ein normaler Innenabstand.
- Kurze Dialoge enden direkt nach Aktionsleiste und Safe Area.
- Lange Dialoge scrollen nur im Inhaltsbereich.

### Modulabstände

- Mitglieder: Überschrift, Suche, Inaktiv-Filter und erste Mitgliederzeile.
- Kasse: Überschrift, Kontokarten und Buchungsbereich.
- Beiträge, Aufgaben und Teams: gleiche kompakte vertikale Abfolge.
- Kein Abstand entsteht doppelt aus `gap` und zusätzlichen Außenabständen.

### Benutzermenü und Profil

- Profilbild → Benutzermenü:
  Menü endet mit normalem Abstand direkt nach „Abmelden“.
- „Profil und Daten“:
  Profil- und Mitgliedsdaten verwenden dieselben Feldproportionen wie der
  Mitgliederdialog.
- Bei langen Daten scrollt nur der Inhaltsbereich.

## Globaler UI-Abschluss R1

- Profilbild öffnen, anschließend mit X schließen.
- Profilbild öffnen, anschließend auf den abgedunkelten Hintergrund tippen.
- Benutzermenü erneut öffnen und mit Escape schließen.
- Nach jedem Schließen ist die Seite wieder scrollbar und der Profilknopf
  erhält den Fokus zurück.
- Dashboard und alle Hauptbereiche prüfen: Bottom-Navigation bleibt kompakt.
- Mitglied anlegen: Eintritt und Austritt besitzen sichtbaren Abstand.
- Beitragsjahr anlegen und bearbeiten: Beginn und Ende besitzen sichtbaren Abstand.
- Einnahme und Ausgabe: Buchungsdatum und Zahlungsart bleiben getrennt.
- Konto anlegen: Status, Startsaldo und Stand zum werden mobil kontrolliert
  auf zwei Zeilen verteilt; das Datum bleibt vollständig sichtbar.
- Umbuchung: Quell- und Zielkonto stehen mobil untereinander.
- Unter Dialogaktionen bleibt nur der normale Innenabstand.

## iOS-Datum und PWA-Navigation – finale Sichtprüfung

- Dashboard in der installierten PWA öffnen: Unter den Navigationsbuttons bleibt
  höchstens die normale iPhone-Unterkante.
- Fanclub, Aufgaben, Teams und Mehr öffnen: Navigationshöhe bleibt identisch.
- Mitglied anlegen: Eintritt und Austritt sind gleich hoch wie Textfelder und
  besitzen einen sichtbaren Abstand.
- Beitragsjahr anlegen und bearbeiten: Beginn und Ende sind gleich hoch und
  berühren sich nicht.
- Einnahme und Ausgabe: Buchungsdatum und Zahlungsart besitzen identische Höhe
  und einen sichtbaren Zwischenraum.
- Konto anlegen und Umbuchung: Datumsfelder bleiben vollständig innerhalb ihrer
  jeweiligen Rasterspalte.

## Bottom-Navigation – finale Geometrieprüfung

- Im mobilen Browser endet die Navigation direkt nach dem 64 Pixel hohen
  Buttonbereich.
- In der installierten PWA bleiben unter dem Buttonbereich nur 10 Pixel.
- Die Buttons sitzen dadurch deutlich näher am tatsächlichen Bildschirmende.
- Dashboard, Fanclub, Aufgaben, Teams und Mehr besitzen dieselbe Position.
- Die geöffnete Seitennavigation darf hinter dem festen Footer weiterlaufen,
  darf dessen Höhe aber nicht verändern.

## iOS-Standalone-Viewport – Abschlussprüfung

- GitHub-Pages-Bereitstellung für den neuen Commit muss grün sein.
- PWA vollständig aus dem App-Umschalter entfernen und erneut öffnen.
- Browser und PWA getrennt prüfen.
- Browser: kein künstlicher Unterraum.
- PWA: lediglich 10 Pixel Abstand unter den Navigationsbuttons.
- Kein CSS-Gegenversatz und keine Veränderung der 64-Pixel-Buttonhöhe.

## iOS-Standalone-Bildschirmrand – finale Sichtprüfung

- Mobiles Safari prüfen: Die Navigation bleibt unverändert direkt oberhalb der
  Safari-Bedienelemente.
- Installierte PWA vollständig schließen und erneut öffnen.
- PWA prüfen: Die Navigationsfläche reicht bis zum physischen unteren
  Bildschirmrand.
- Unter der Navigation ist keine zusätzliche dunkelblaue Fläche mehr sichtbar.
- Unter den 56 Pixel hohen Buttons bleiben nur die vorgesehenen 10 Pixel.
- Seitennavigation öffnen: Sie läuft hinter dem Footer weiter, ohne darunter
  sichtbar zu werden.
- Toast, Installationshinweis und Benutzermenü stehen weiterhin unmittelbar
  oberhalb der Navigation.

## Standalone-Unterkante ohne abgeschnittene Buttons

- Browserdarstellung bleibt unverändert.
- In der installierten PWA sind alle fünf Navigationsbuttons vollständig
  sichtbar.
- Die Navigation endet am sichtbaren Standalone-Viewport mit `bottom: 0`.
- Der dunkelblaue Hintergrund reicht ohne zusätzliche Bedienelemente bis zum
  physischen unteren Bildschirmrand.
- Unterhalb der Navigation sind keine Buttonbögen oder abgeschnittenen Inhalte
  sichtbar.
- Seitennavigation, Toasts, Update-Hinweis und Benutzermenü bleiben korrekt zur
  sichtbaren Navigation ausgerichtet.

## Fester Standalone-Hintergrundstreifen – Abnahme

- Safari-Browser bleibt gegenüber dem vorherigen Stand unverändert.
- Die installierte PWA zeigt alle fünf Navigationsbuttons vollständig.
- Unterhalb der Navigation befindet sich kein andersfarbiger oder leerer
  Portalbereich.
- Der dunkelblaue Hintergrund reicht bis zum physischen Bildschirmende.
- Das Pseudo-Element ist `position: fixed`; die Navigation selbst bleibt
  `bottom: 0`.
- Toasts, Installationshinweis und Benutzermenü bleiben oberhalb der sichtbaren
  Navigation.

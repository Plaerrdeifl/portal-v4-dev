# M150 R1 / F1.7B – autoritativer Mitgliedsantrag-PDF-Download

## Zweck und Autorisierung

F1.7B ergänzt im internen Bereich „Mitgliedsanträge“ den Download „Antrag als PDF“. Das PDF ist ein interner Erwachsenen-Antragsauszug. Die Supabase Membership Application bleibt die führende Quelle; die bereits vorhandene Aktion `membership_application_detail` bleibt die serverseitige Autorisierungsgrenze und erfordert ein aktuell autorisiertes Vorstandsmitglied.

Unmittelbar vor jedem Download lädt das Portal den Detaildatensatz erneut. Ein bereits geöffneter oder anderweitig stale Detailstand reicht allein nie aus. Nur wenn dieser Fresh-Detail-Call erfolgreich ist und exakt dieselbe Application-ID zurückgibt, beginnt die PDF-Erzeugung. Damit beendet ein zwischenzeitlicher Verlust der Vorstandsberechtigung auch die Downloadmöglichkeit.

F1.7B ergänzt keine Datenbankfunktion, Migration, `pd_api`-Aktion, Edge Function oder Service-Role-Schnittstelle. Es gibt keinen direkten Tabellenzugriff, keinen separaten PDF-Endpunkt, kein Supabase Storage und keine Signed URL. Die fünf bestehenden M150-Aktionen bleiben unverändert.

## Datenumfang und Retention

Für das PDF wird aus dem frischen Detaildatensatz eine neue, explizit begrenzte Datenstruktur gebildet. Die Whitelist enthält ausschließlich `id`, `firstName`, `lastName`, `birthDate`, `email`, `phone`, `street`, `houseNumber`, `postalCode`, `city`, `submittedAt`, `applicantMessage`, `declarationVersion`, `declarationConfirmed`, `statutesVersion`, `statutesReference` und `statutesConfirmed`.

Nicht enthalten sind Status, Abstimmungen, interne Entscheidungsgründe, Applicant Notices, Duplicate-Hinweise und Match-Daten, Conversion-Daten, Mitglieds- oder Portaluserdaten, Rollen, Rechte, Ämter sowie Finance-, Beitrags-, Zahlungs- oder SEPA-Daten. Der Auszug dokumentiert den Antrag, nicht den internen Entscheidungs- oder Conversionprozess, und enthält keine Aufnahmeentscheidung.

Die F1.7A-Minimierung von `applicantMessage` wird respektiert. Ist der Wert im frischen Datensatz leer oder `NULL`, erscheint ausschließlich der neutrale Hinweis „Im aktuellen Antragssatz nicht vorhanden.“ Minimierte Inhalte werden weder aus einem alten Browserstand noch aus Mitgliedsnotizen, Audit oder E-Mail-Daten wiederhergestellt.

## Erzeugung und Darstellung

Das Portal rendert die Whitelist-Daten in A4-Hochformat auf eine oder mehrere lokale Canvas-Seiten. Robuster Text- und Seitenumbruch berücksichtigt Absätze, lange untrennbare Zeichenfolgen, E-Mail-Adressen und Satzungsreferenzen. Geburtsdaten werden als kontrollierte Date-only-Werte dargestellt; der Eingangszeitpunkt wird ausdrücklich für `Europe/Berlin` formatiert. Fußzeilen zeigen nach Abschluss des Renderns die korrekte Angabe „Seite X / Y“.

Unicode wird durch den Browser mit lokalen Systemfont-Fallbacks wie `system-ui`, Segoe UI, Arial und `sans-serif` in das Canvas gerendert. Es werden keine Fontdateien und keine externen Ressourcen geladen. Weil die Seite als JPEG in den PDF-Container eingebettet wird, besitzt das PDF keinen garantiert durchsuchbaren Textlayer.

Die JPEG-Seiten werden ausschließlich im Arbeitsspeicher gehalten und durch einen eng begrenzten binären PDF-1.4-Container mit A4-Seiten, JPEG-Image-XObjects, Content Streams, xref und Trailer zusammengeführt. Es gibt keine externe PDF-Library, npm-Abhängigkeit oder CDN-Ressource. Binäre JPEG-Daten werden nicht in Text umgewandelt; der Container enthält keine personenbezogenen PDF-Metadaten.

## Download und Grenzen

Das fertige PDF wird als temporärer Blob mit `application/pdf` und einer Object URL heruntergeladen. Der Dateiname besteht ausschließlich aus `mitgliedsantrag-`, den ersten acht Zeichen der Application-ID und `.pdf`; Namen oder andere Personendaten werden nicht verwendet. Der temporäre Link wird entfernt und die Object URL nach dem gestarteten Download wieder freigegeben. Das Portal und Supabase legen keine PDF-Datei persistent ab.

Nach einem Download befindet sich die Datei außerhalb der Anwendungskontrolle auf dem Gerät des berechtigten Benutzers. F1.7B implementiert kein DRM.

Der PDF-Auszug enthält keine Unterschrift, kein Signaturbild und keine Behauptung über QES, Schriftform oder rechtliche Gleichwertigkeit. Er bestätigt weder Aufnahme noch Mitgliedschaft. F1.7B verändert kein WordPress, keine Mitgliedsdaten, keinen Portalzugang, kein Finance oder SEPA, kein M210 und kein M000. Dieses Paket enthält kein Deployment und kein PROD.

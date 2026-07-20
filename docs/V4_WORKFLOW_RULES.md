# Verbindliche Arbeits- und Chatregeln für Portal V4

- Zusammengehörige Planung, Umsetzung, Reset, Prüfung, Commit und Push bilden einen Arbeitsblock.
- Bei Fehlern bleibt die Arbeit im aktuellen Block, bis die Ursache gelöst oder kontrolliert abgegrenzt ist.
- Keine Annahmen über ungelesene Dateien.
- Operatoren werden mit Node.js umgesetzt; PowerShell dient nur zum Aufruf.
- Vor jedem größeren Block werden Branch, Commit und sauberer Git-Status geprüft.
- Datenbankstrukturen entstehen ausschließlich durch SQL-Migrationen.
- Ein Chatwechsel erfolgt nur an einem sauberen Übergabepunkt.
- Sobald ein Chatwechsel sinnvoll ist, wird dies ausdrücklich angekündigt und ein vollständiger Experten-Übergabeprompt ausgegeben.

## Phasenfolge

Technisches Fundament → Architektur → Auth und Portal-Core → Rollen/Ämter/Teams → Mitglieder/Aufgaben → Beiträge/Finanzen → Bus-Modul → Migration/Release.

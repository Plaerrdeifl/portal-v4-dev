# M320-R2 – Acceptance

## Strukturmatrix

- 1 NORMAL, 1 PARTY, NORMAL+NORMAL, PARTY+PARTY und RUHIG+RUHIG: keine Auswahl, effektiv `EGAL`.
- PARTY+RUHIG oder NORMAL+PARTY+RUHIG mit Flag `true`: exakt `EGAL`, `RUHIG`, `PARTY`.
- Jede gültige Struktur mit Flag `false`: keine Auswahl, effektiv `EGAL`.
- Aktivierungsversuch ohne mindestens zwei aktive Busse sowie PARTY und RUHIG wird serverseitig abgelehnt.

## Manipulation, Lifecycle und Idempotenz

- `PARTY` oder `RUHIG` bei gesperrter Fahrt wird effektiv `EGAL`; Fantasiewerte werden abgelehnt.
- Companiondefault bleibt bei gesperrter Fahrt unverändert, die neue Registration wird `EGAL`.
- Deaktivierung oder Umkategorisierung des letzten PARTY-/RUHIG-Busses gelingt und setzt das Flag auf `false`.
- Eine später wieder gültige Struktur reaktiviert das Flag nicht.
- Replay eines gesperrten `PARTY`-Requests liefert dieselbe ursprüngliche Response, auch nach Konfigurationsänderung.
- WAITLISTED und manuell neue Registrierungen verwenden denselben Insertvertrag.

## Unveränderte Bereiche

Historische Registrierungen, Teilnehmerbearbeitung, Capacity Core, FIFO, Promotion, manuelle Assignmentlogik, M330-CANCELLED und die Edge-Syntaxgrenze bleiben unverändert. Es entsteht keine automatische Assignment-Zeile.

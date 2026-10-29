# Liveticker – versioniertes DEV-Release

Das Liveticker-Frontend wird aus dem führenden Repository Plaerrdeifl/liveticker
ausgeliefert. Die Source-SHA und jedes einzelne JS-/CSS-/PWA-Asset sind in
release.json mit Dateigröße und SHA-256 verankert; die verifizierende
Integration liegt in scripts/integrate-liveticker-release.mjs.

Der DEV-Build veröffentlicht dieselbe Fachanwendung in zwei Formen:

1. standalone nach /liveticker/ – eigenständig installierbare PWA mit
   eng begrenztem Manifest- und Service-Worker-Scope /liveticker/.
2. embed nach /liveticker/embed/ – ES-Modul für die Cockpit-Shell,
   ohne iframe, zusätzliche fachliche Kopie oder eigenen Login.

Öffentliche DEV-Runtime-Konfiguration wird aus dem bereits geprüften
Cockpit-Release übernommen. Browserrufe benutzen public.pd_api(text,jsonb)
und dieselbe Supabase-Identität. Die Fachapp prüft Cockpit-Zugang und
effektive Liveticker-Capability selbst serverseitig.

LOCAL/PROD integrieren die neuen Artefakte nicht und behalten ihre bisherigen
Liveticker-/Worker-/DB-Verträge. Es gibt keine Migration und keinen
WhatsApp-Worker-Wechsel durch diese Frontend-Veröffentlichung.

Wichtig: Der globale DEV-Plattformmodus READ_ONLY bleibt serverseitig aktiv.
Die Aktivierung der DEV-Frontend-Bedienelemente ist kein Bypass; echte
Spiel-/Sendemutationen brauchen einen ausdrücklich autorisierten Backend-
Vertrag und einen authentifizierten E2E-Nachweis (UI, API/Outbox, Worker,
WPP/WhatsApp, Ack). Nicht aufgrund grüner UI-Checks als nutzbar melden.

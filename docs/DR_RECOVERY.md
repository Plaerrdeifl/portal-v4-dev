# Disaster Recovery – PROD

Diese Anleitung beschreibt den dauerhaften Wiederherstellungsweg. Tagesaktuelle
SHAs, letzte Laufzeiten und Betriebszustände gehören nicht in dieses Dokument und
müssen live geprüft werden.

## Quellen

- PROD-Code: Repository Plaerrdeifl/portal, Branch main.
- Datenbankschema: versionierte Supabase-Migrationen aus dem PROD-Repository.
- Produktive Nutzdaten: verschlüsselte Restic-Snapshots.
- Supabase Storage: im Restic-Snapshot als separat heruntergeladene Objektdateien.
- acer01: letzter vollständiger lokaler Snapshot wird zusätzlich in Restic gesichert.
- Nicht versionierte PROD-Runtime-Konfiguration und optional die WPP-Session werden
  direkt in denselben verschlüsselten Restic-Snapshot aufgenommen.

Der Restic-Repository-Zugang und das Restic-Passwort müssen unabhängig vom
Repository und unabhängig von acer01 sicher verwahrt werden. Ein Passwort, das
nur im eigenen Restic-Repository liegt, ist kein Recovery-Weg.

## Host-Konfiguration

Der Runtime-Job erwartet /etc/plaerrdeifl-dr-backup/env mit mindestens:

- RESTIC_REPOSITORY
- RESTIC_PASSWORD_FILE

Optionale Werte mit sicheren Defaults sind SUPABASE_PROJECT_REF,
SUPABASE_CLI_USER, SUPABASE_CLI_HOME, LOCAL_SNAPSHOT_ROOT,
LOCAL_SNAPSHOT_MAX_AGE_HOURS, STAGING_ROOT, RESTIC_HOST, RESTIC_TAG,
KEEP_DAILY, KEEP_WEEKLY, KEEP_MONTHLY und INCLUDE_WPP_SESSION.

Die echte Konfiguration und alle Credentials bleiben ausschließlich auf dem
Runtime-Host bzw. im unabhängigen Credential-Escrow. Sie werden nie committed.

Vor dem Aktivieren des Timers wird das externe Repository absichtlich einmalig
initialisiert und ein manueller Voll-Lauf samt Restore-Test durchgeführt. Der
automatische Job initialisiert kein unbekanntes Ziel selbst.

## Wiederherstellung

### 1. Code und Runtime-Basis

1. Neuen Host installieren und das PROD-Repository aus GitHub auschecken.
2. Docker, Supabase CLI, PostgreSQL-Client und Restic passend installieren.
3. Die versionierten Worker-/Runtime-Dateien und systemd-Units einspielen.
4. Restic-Zugang und Restic-Passwort aus dem unabhängigen Credential-Escrow
   bereitstellen.
5. Mit restic snapshots und restic check das externe Repository prüfen.

### 2. Supabase-Datenbank

Im Restic-Snapshot liegen getrennt roles.sql, schema.sql und data.sql. Das ist
das von Supabase empfohlene logische Drei-Dateien-Format. data.sql enthält auch
Auth-Daten sowie die Storage-Metadaten; die eigentlichen Storage-Dateien liegen
separat.

Für einen echten Restore zuerst eine isolierte Supabase-Instanz mit einer zum
Quellprojekt passenden Service-/Schema-Version bereitstellen. Nicht direkt in
die laufende PROD-Datenbank restoren. Dann:

1. roles.sql einspielen.
2. schema.sql einspielen bzw. das versionierte Migrationsschema herstellen.
3. Für den Datenimport session_replication_role auf replica setzen.
4. data.sql mit ON_ERROR_STOP einspielen.
5. Repräsentative Zeilenzahlen und fachliche Daten prüfen.
6. Erst nach erfolgreicher isolierter Abnahme einen kontrollierten
   Wiederanlauf planen.

Ein nacktes PostgreSQL-/Supabase-Postgres-Image kann bei Auth-/Storage-internen
Tabellen von der Platform-Version abweichen. Deshalb den vollständigen
Auth-/Storage-Restore gegen eine passende Supabase-Service-Schemaversion testen.

### 3. Supabase Storage

1. Den Storage-Unterbaum aus Restic in ein temporäres Verzeichnis restoren.
2. Bucket-Struktur und Storage-Metadaten aus dem DB-Dump prüfen.
3. Objekte mit der Supabase CLI wieder in die privaten Ziel-Buckets hochladen.
4. Für Stichproben Dateigröße und SHA-256 mit dem gesicherten Manifest
   vergleichen.
5. Private Buckets nicht versehentlich öffentlich schalten.

### 4. acer01 und Runtime-Secrets

Der Restic-Snapshot enthält den letzten vollständigen lokalen acer01-Snapshot
sowie die zusätzlich benötigten, nicht versionierten PROD-Konfigurationen aus
Liveticker/WhatsApp, M340 und Nextcloud. Bei einem Hostverlust diese Daten zuerst
in ein temporäres Verzeichnis restoren, Hashs/Dateirechte prüfen und erst danach
an ihre Zielpfade übernehmen.

Die WPP-Session ist optional mitgesichert. Sie darf nur bei gestopptem WPP in
einen neuen Runtime-Host zurückgespielt werden. Wenn der Zustand technisch oder
sicherheitlich nicht mehr verwendbar ist, WPP regulär per QR neu pairen; niemals
eine laufende Session durch einen Testrestore überschreiben.

## Automatisierung und Retention

Die vorgesehene systemd-Timerzeit ist täglich 05:45 Uhr mit zufälligem Versatz.
Der Job akzeptiert nur einen vollständigen lokalen acer01-Snapshot, der
standardmäßig höchstens 30 Stunden alt ist. Standard-Retention in Restic:

- 7 tägliche Stände
- 4 Wochenstände
- 6 Monatsstände

Restic dedupliziert zwischen Generationen. Die Werte können erst nach Prüfung
der realen externen Zielkapazität bewusst angepasst werden.

Fehler liefern einen Nicht-Null-Exitcode, erscheinen im systemd-Journal und
werden – sofern /usr/local/sbin/acer-notify vorhanden ist – zusätzlich über den
bestehenden acer01-Benachrichtigungsweg gemeldet.

## Restore-Nachweis

Nach Einrichtung oder Änderung des Backupziels mindestens:

1. restic check ausführen.
2. Einen DB-Export isoliert wiederherstellen und repräsentative Tabellen lesen.
3. Ein Storage-Objekt restoren und SHA-256/Größe vergleichen.
4. Eine harmlose Datei aus dem acer01-Snapshot restoren und Hash vergleichen.
5. Eine Runtime-Konfig aus dem verschlüsselten Repository restoren und Hash
   vergleichen, ohne Secrets auszugeben.
6. Das Ergebnis dokumentieren, aber niemals Dumps, Tokens oder Sessiondaten
   committen.

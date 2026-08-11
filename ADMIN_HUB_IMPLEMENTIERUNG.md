# LUMINA Admin Hub

Globaler Adminbereich unter `/admin`.

## Funktionen
- Benutzer: anlegen, ändern, sperren/entsperren, Passwort auf `start123` setzen, kontrolliert löschen.
- Gesellschaften: anlegen, umbenennen/bearbeiten, aktivieren, sperren, archivieren, dokumentfreie Gesellschaften endgültig löschen.
- Projekte: mit vollständiger LUMINA-202-Struktur anlegen, bearbeiten/umbenennen, öffnen, sperren, archivieren, dokumentfreie Projekte endgültig löschen.
- Berechtigungen: Company- und Project-Memberships einschließlich Rollen zuweisen oder entfernen.
- Globaler Admin: `admin@volkerkusch.de` wird durch die Migration als LUMINA-Admin registriert und erhält Zugriff auf alle Gesellschaften/Projekte.

## Sicherheit
- `/admin` ist serverseitig geschützt.
- Alle Admin-APIs prüfen `lumina_admins` und verwenden den Service Role Key nur serverseitig.
- Der Service Role Key darf nie als `NEXT_PUBLIC_*` exponiert werden.
- Endgültiges Löschen von Gesellschaften/Projekten wird blockiert, sobald Dokumente vorhanden sind. Dann muss archiviert werden.

## Migration
`supabase/migrations/20260811210000_admin_hub.sql`

Sie legt `lumina_admins` an, ergänzt `companies.status`, erweitert den Projektzugriff für globale Admins und stellt `admin_create_project(...)` für serverseitige vollständige Projektanlage bereit.

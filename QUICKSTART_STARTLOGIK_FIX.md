# KAI Quickstart – Startlogik Fix

## Verhalten
- `/workflow` bleibt die Projektzentrale.
- `+ KAI Quickstart` öffnet `/quickstart?mode=company` und startet immer bei **Neue Gesellschaft**.
- Eine alte unvollständige Quickstart-Session wird nicht mehr implizit in der UI fortgesetzt.
- `+ Projekt anlegen` innerhalb einer Gesellschaft öffnet `/quickstart?company=<company_uuid>` und startet direkt bei **Projekt** für genau diese Gesellschaft.
- Ein Benutzer ohne Gesellschafts-/Projektzugriff sieht die leere Projektzentrale und `Mit KAI starten`.
- Eine bereits sichtbare Gesellschaft gleichen Namens kann im Neue-Gesellschaft-Flow nicht versehentlich nochmals angelegt werden.

## Geänderte Dateien
- `src/app/quickstart/page.tsx`
- `src/app/quickstart/quickstart-client.tsx`
- `src/app/workflow/project-hub.tsx`

Keine neue Supabase-Migration erforderlich.

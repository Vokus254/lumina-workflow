# Sammelpatch-Korrektur 7B-2

Diese Korrektur ersetzt ausschließlich die Migration:

supabase/migrations/20260804090000_save_task_progress.sql

Geprüft:
- `completed` ist in der produktiven `tasks.work_status`-Constraint erlaubt.
- Die Funktion läuft als `security definer`.
- Der `search_path` ist fest gesetzt.
- Fehlende Aufgaben werden explizit mit `LUMINA_TASK_NOT_FOUND` behandelt.
- Die Kommentarzeile verwendet ASCII, damit keine Zeichencodierungsfehler entstehen.

Die ZIP kann direkt über das bestehende Projekt entpackt werden.

# KAI Quickstart – Abmelden und Refresh

- Im Quickstart-Header stehen jetzt dauerhaft `Refresh` und `Abmelden` zur Verfügung.
- `Refresh` löscht Session-/LUMINA-Appdaten, Cache-Storage und Service-Worker und lädt die aktuelle Seite mit einem Cache-Buster neu. Die aktive Supabase-Anmeldung bleibt erhalten.
- `Abmelden` beendet die Supabase-Sitzung, entfernt lokale Supabase-/LUMINA-Sessiondaten und führt zurück auf `/login?fresh=1`.
- Hintergrund: Der gemeinsame Quickstart-Zugang und persönliche Testnutzer sollen nicht durch alte Browser-Sitzungen oder lokale Appdaten verwechselt werden.

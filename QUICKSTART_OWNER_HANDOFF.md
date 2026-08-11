# KAI Quickstart – persönlicher Owner-Handoff

Der gemeinsame Pilotzugang `quickstart@volkerkusch.de` ist ausschließlich ein Bootstrap-Zugang für neue LUMINA-Teilnehmer.

Nach Gesellschaft, Projekt, Team und PBC fragt KAI im letzten Schritt nach der persönlichen E-Mail-Adresse des künftigen Owners. Der serverseitige Handoff:

1. prüft, dass die Anfrage tatsächlich vom gemeinsamen Quickstart-Zugang kommt,
2. prüft, dass dieser Zugang Owner des gerade erzeugten Projekts ist,
3. verwendet einen vorhandenen Supabase-Auth-Nutzer oder legt einen neuen persönlichen Pilotnutzer an,
4. setzt diesen Nutzer als `owner` in `company_members` und `project_members`,
5. entfernt den gemeinsamen Quickstart-Zugang aus dem konkreten Projekt/der Gesellschaft,
6. meldet den Quickstart-Nutzer ab und führt zur persönlichen Anmeldung zurück.

Neu erzeugte persönliche Pilotnutzer erhalten zunächst das Erstpasswort `start123`. Bestehende Nutzer behalten ihr vorhandenes Passwort.

## Vercel-Konfiguration

Für die serverseitige Auth-Administration ist zwingend erforderlich:

- `SUPABASE_SERVICE_ROLE_KEY` (server-only, niemals `NEXT_PUBLIC_*`)
- optional `LUMINA_QUICKSTART_TEMP_PASSWORD=start123`
- `NEXT_PUBLIC_LUMINA_QUICKSTART_EMAIL=quickstart@volkerkusch.de`
- `NEXT_PUBLIC_LUMINA_QUICKSTART_PASSWORD=start123`

Der Service-Role-Key darf niemals in Client-Code, Screenshots oder öffentliches Git gelangen.

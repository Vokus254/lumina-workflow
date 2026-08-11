# LUMINA Startdesktop & Quickstart-Testzugang

## Zielbild

- Persönliche Teilnehmer melden sich auf `/login` mit ihrer eigenen E-Mail-Adresse an.
- Danach öffnet `/workflow` ausschließlich die Gesellschaften und Projekte, für die der Nutzer berechtigt ist.
- Über `+ KAI Quickstart` kann ein berechtigter Nutzer ein weiteres Projekt anlegen.
- Neue Pilotnutzer können über den gemeinsamen Testzugang direkt in den KAI Quickstart einsteigen.

## Gemeinsamer Pilotzugang

- E-Mail: `quickstart@volkerkusch.de`
- gewünschtes Testpasswort: `123`

Der Auth-Nutzer muss in Supabase Authentication vorhanden sein. Falls die aktuelle Supabase-Passwortrichtlinie ein längeres Passwort verlangt, muss dort ein zulässiges Testpasswort gesetzt und in Vercel über `NEXT_PUBLIC_LUMINA_QUICKSTART_PASSWORD` hinterlegt werden.

Optional in Vercel:

- `NEXT_PUBLIC_LUMINA_QUICKSTART_EMAIL=quickstart@volkerkusch.de`
- `NEXT_PUBLIC_LUMINA_QUICKSTART_PASSWORD=123`

## Sicherheitslogik des Pilotzugangs

Der gemeinsame Quickstart-Account ist absichtlich **kein normaler Workflow-Benutzer**:

- `/workflow` leitet ihn immer in den Quickstart um.
- `project_hub_context()` liefert für ihn keine bestehenden Gesellschaften oder Projekte.
- `quickstart_context()` liefert für ihn keine alten Quickstart-Projekte.
- Neu angelegte Gesellschaften/Projekte werden zusätzlich `admin@volkerkusch.de` als Owner zugeordnet, sofern dieser Auth-Nutzer existiert.

Damit dient der Dummy-Login nur zur Projekterstellung im Pilotbetrieb. Für Produktivbetrieb sollen Teilnehmer persönliche Auth-Konten erhalten.

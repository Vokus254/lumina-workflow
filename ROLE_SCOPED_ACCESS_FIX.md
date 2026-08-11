# Rollenbezogener Aufgaben-Zugriff

Dieser Stand korrigiert den Zugriff von Workflow-Teilnehmern, die ausschließlich über `role_user_assignments` einem Projekt zugeordnet sind.

## Verhalten

- LUMINA-Admin: projektweiter Zugriff.
- Direkter `project_member`: projektweiter Zugriff entsprechend der bestehenden Projektmitgliedschaft.
- Gesellschaft `owner` / `manager`: projektweiter Zugriff auf aktive Projekte der Gesellschaft.
- Workflow-Rollen-Nutzer: ausschließlich Aufgaben, deren `responsibility_role_id` seiner Rolle zugeordnet ist.
- Externe Einladung: ausschließlich die konkret eingeladene Aufgabe.

`get_lumina_source_state()` filtert die PBC-Zeilen bereits über `private.can_access_task()`. Durch die korrigierte Funktion zeigt daher auch **Mein Tag** bei einem reinen Rollen-Nutzer nur seine tatsächlich zugewiesenen Aufgaben.

Der Admin Hub zeigt zusätzlich direkten Projektzugriff und effektiven Zugriff über Workflow-Rollen getrennt an.

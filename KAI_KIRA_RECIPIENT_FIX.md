# KAI/KIRA Empfänger-Fix

Die Spezialrollen KAI und KIRA können über `role_user_assignments` einem Benutzerkonto zugeordnet sein, ohne dass am Datensatz in `responsibility_roles.email` zusätzlich eine E-Mail hinterlegt ist.

`get_task_message_recipients(uuid)` verwendet deshalb nun als Fallback die E-Mail des zugeordneten Auth-Benutzers. Dadurch erscheinen KAI/KIRA in der Kommunikations-Empfängerliste und die vorhandenen Buttons können die jeweilige Rolle automatisch auswählen.

Für das Serafin-Projekt gilt derzeit:
- KAI (Bilanzbuchhalter) → Hans Haupt / haupt@volkerkusch.de
- KIRA (Wirtschaftsprüferin) → Walter Audit / audit@volkerkusch.de

Die produktive Supabase-Funktion wurde am 11.08.2026 bereits aktualisiert. Die Migration liegt zusätzlich im Repository, damit der Datenbankstand reproduzierbar bleibt.

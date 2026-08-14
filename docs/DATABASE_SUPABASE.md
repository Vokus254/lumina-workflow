# Supabase / Database Context

## Active project

The active Supabase project used during the latest work was:

`pmdpjftonhlvcdvxmnky`

Old inactive projects must not be modified.

Before any database action, confirm the current project reference in the user's environment.

## Important existing migration sequence observed

Examples from the active database included:

- `20260802110000_lumina_core`
- `20260802110100_lumina_access`
- `20260802110200_lumina_storage`
- `20260802110300_lumina_api_grants`
- `20260802110400_lumina_admin_bootstrap`
- `20260802110500_lumina_task_update_rpc`
- `20260802110600_lumina_project_source_state`
- `20260802110700_lumina_document_storage_rpc`
- `20260802110800_lumina_role_user_bootstrap`
- `20260802110900_lumina_role_scoped_access`
- `20260802111000_lumina_role_project_visibility`
- `20260802111100_lumina_task_communication`
- `20260803101500_lumina_task_work_packages`
- `20260803124000_assign_missing_task_folders`
- `20260803124500_allow_role_users_to_upload`
- `20260803131500_lumina_ai_assistants`
- `20260803152000_task_approval_workflow`
- `20260803191500_kira_review_by_document_version`
- `20260803212000_fix_accounting_lead_approval_access`
- `20260803213500_restore_can_access_task_execute`
- `20260804090000_save_task_progress`
- `20260805120000_lumina_process_step_guidance`
- `20260806120000_guidance_datenbasis_hinweis`
- `20260806140000_step_level_document_upload`
- `20260806170000_source_state_3_14_guidance_subitems`
- `20260811203559_specialist_message_recipient_from_assigned_user`

Newer repository migrations include at least:
- `20260814170000_kai_kira_context_memory.sql`
- `20260814193000_kai_kira_project_schedule_matrix.sql`

Inspect actual migration history before adding new versions.

## Important entities

### Projects and access
- `projects`
- `project_members`
- `lumina_admins`

### Roles
- `responsibility_roles`
- `role_user_assignments`

### Workflow
- `process_steps`
- `process_step_due_dates`
- `tasks`

### Communication/evidence
- `task_messages`
- `documents`

### Stored structured source state
- `project_source_states`
  - column `project_id`
  - `state` JSONB
  - `source_sha256`
  - `updated_at`

A backup table has also existed:
- `project_source_states_backup_20260806`

### KAI/KIRA
- `project_milestones`
- `kai_kira_memories`

## V9 schedule/responsibility matrix

Migration:
`supabase/migrations/20260814193000_kai_kira_project_schedule_matrix.sql`

RPC:
`get_project_schedule_responsibility(project_id)`

Purpose:
Expose project-wide steering data required to answer deadline/responsibility questions while preserving detailed RLS on sensitive task/document/comment content.

Do not turn this into an unrestricted "read every task detail" RPC.

## Existing data demonstrated that responsibilities are available

Examples observed in the project included:
- 2.0 Projektplanung & Kick-off → RW (Leitung), Ralf Lewe
- 2.3 Abstimmung Prüfungsfahrplan → RW (Leitung), Ralf Lewe
- 2.6 Kick-off-Meeting → RW (Leitung), Ralf Lewe
- 6.1 Prüfungsplanung → WP (Leitung), Walter Audit
- 6.2 Anforderung Prüfungsunterlagen → WP (Leitung), Walter Audit
- 1.3 Abstimmung Honorar & Prüfungszeitraum → VO (Vorstand), Victor Vorst

These are data examples from the current test/demo project, not hard-coded role assumptions.

## RLS

A task SELECT policy observed:
- policy: `tasks_access_select`
- expression: `private.can_access_task(id)`

Do not bypass it casually.

## Project milestones created for V8

Initial migration/backfill created actual project milestone records from named process due-date rules.

At one observed point the project contained:
- Beginn Vorprüfung
- Beginn Hauptprüfung

Do not assume these are the only milestones after later edits.

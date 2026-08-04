-- RLS entscheidet anschließend zeilenweise, was ein angemeldeter Benutzer sehen darf.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.companies, public.projects, public.project_members,
  public.responsibility_roles, public.external_contacts, public.process_steps,
  public.tasks, public.dataroom_folders, public.task_folder_assignments,
  public.document_requests, public.task_invitations, public.documents,
  public.document_versions, public.document_reviews, public.task_messages,
  public.task_activity_events, public.project_notification_settings
to authenticated;

-- Änderungen erfolgen ausschließlich über kontrollierte serverseitige Funktionen.
revoke insert, update, delete, truncate, references, trigger
on all tables in schema public from authenticated;

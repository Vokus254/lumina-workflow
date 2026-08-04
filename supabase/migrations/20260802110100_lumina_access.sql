create or replace function private.is_project_member(p_project uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.project_members m where m.project_id=p_project and m.user_id=auth.uid() and m.active and (p_roles is null or m.security_role=any(p_roles)))
$$;
create or replace function private.external_contact_id()
returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select id from public.external_contacts where auth_user_id=auth.uid() and active and access_enabled limit 1
$$;
create or replace function private.can_access_task(p_task uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.tasks t where t.id=p_task and private.is_project_member(t.project_id))
 or exists(select 1 from public.task_invitations i join public.external_contacts c on c.id=i.external_contact_id
   where i.task_id=p_task and c.auth_user_id=auth.uid() and c.active and c.access_enabled
   and i.status in ('sent','opened','accepted','completed') and i.revoked_at is null and i.expires_at>now())
$$;
create or replace function private.can_access_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.dataroom_folders f where f.id=p_folder and private.is_project_member(f.project_id))
 or exists(select 1 from public.task_folder_assignments a where a.folder_id=p_folder and private.can_access_task(a.task_id))
$$;
revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;

create policy companies_member_select on public.companies for select to authenticated using(exists(select 1 from public.projects p where p.company_id=id and private.is_project_member(p.id)));
create policy projects_access_select on public.projects for select to authenticated using(private.is_project_member(id) or exists(select 1 from public.tasks t where t.project_id=id and private.can_access_task(t.id)));
create policy members_self_select on public.project_members for select to authenticated using(user_id=auth.uid() or private.is_project_member(project_id,array['owner','manager']));
create policy roles_member_select on public.responsibility_roles for select to authenticated using(private.is_project_member(project_id));
create policy contacts_self_select on public.external_contacts for select to authenticated using(auth_user_id=auth.uid() or exists(select 1 from public.projects p where p.company_id=company_id and private.is_project_member(p.id,array['owner','manager'])));
create policy steps_access_select on public.process_steps for select to authenticated using(private.is_project_member(project_id) or exists(select 1 from public.tasks t where t.process_step_id=id and private.can_access_task(t.id)));
create policy tasks_access_select on public.tasks for select to authenticated using(private.can_access_task(id));
create policy folders_access_select on public.dataroom_folders for select to authenticated using(private.can_access_folder(id));
create policy assignments_access_select on public.task_folder_assignments for select to authenticated using(private.can_access_task(task_id));
create policy requests_access_select on public.document_requests for select to authenticated using(private.can_access_task(task_id));
create policy invitations_self_select on public.task_invitations for select to authenticated using(external_contact_id=private.external_contact_id() or exists(select 1 from public.tasks t where t.id=task_id and private.is_project_member(t.project_id,array['owner','manager'])));
create policy documents_access_select on public.documents for select to authenticated using(private.can_access_task(task_id) or private.can_access_folder(folder_id));
create policy versions_access_select on public.document_versions for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and (private.can_access_task(d.task_id) or private.can_access_folder(d.folder_id))));
create policy reviews_member_select on public.document_reviews for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and private.is_project_member(d.project_id)));
create policy messages_access_select on public.task_messages for select to authenticated using(private.can_access_task(task_id));
create policy events_access_select on public.task_activity_events for select to authenticated using(private.is_project_member(project_id) or private.can_access_task(task_id));
create policy settings_member_select on public.project_notification_settings for select to authenticated using(private.is_project_member(project_id,array['owner','manager']));

-- Mutationen bleiben absichtlich serverseitigen RPCs/Edge Functions vorbehalten.
-- Dadurch kann ein externer Nutzer weder Task-/Ordner-IDs austauschen noch interne Daten verändern.

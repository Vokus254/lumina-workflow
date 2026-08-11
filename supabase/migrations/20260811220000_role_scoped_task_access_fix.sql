-- LUMINA: task access must distinguish project-wide membership from role-scoped access.
-- A workflow participant assigned through responsibility_roles may see only tasks of that role.

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  -- Global LUMINA administrators may access every task.
  select private.is_lumina_admin()

  -- Direct project members and company owner/manager receive project-wide task access,
  -- but only while company/project are available to normal users.
  or exists(
    select 1
    from public.tasks t
    join public.projects p on p.id=t.project_id
    join public.companies c on c.id=p.company_id
    where t.id=p_task
      and c.status='active'
      and p.status in ('active','draft')
      and (
        private.is_project_member(p.id)
        or private.is_company_member(p.company_id,array['owner','manager'])
      )
  )

  -- Responsibility-role users receive only tasks assigned to their role.
  or exists(
    select 1
    from public.tasks t
    join public.projects p on p.id=t.project_id
    join public.companies c on c.id=p.company_id
    join public.role_user_assignments a on a.role_id=t.responsibility_role_id
    where t.id=p_task
      and a.user_id=auth.uid()
      and c.status='active'
      and p.status in ('active','draft')
  )

  -- External invited users receive only the explicitly invited task.
  or exists(
    select 1
    from public.task_invitations i
    join public.tasks t on t.id=i.task_id
    join public.projects p on p.id=t.project_id
    join public.companies co on co.id=p.company_id
    join public.external_contacts c on c.id=i.external_contact_id
    where i.task_id=p_task
      and c.auth_user_id=auth.uid()
      and c.active
      and c.access_enabled
      and co.status='active'
      and p.status in ('active','draft')
      and i.status in ('sent','opened','accepted','completed')
      and i.revoked_at is null
      and i.expires_at>now()
  )
$$;

revoke all on function private.can_access_task(uuid) from public,anon;
grant execute on function private.can_access_task(uuid) to authenticated;

-- get_lumina_source_state already filters PBC rows through private.can_access_task().
-- Replacing can_access_task therefore also fixes the legacy "Mein Tag" list for role users.

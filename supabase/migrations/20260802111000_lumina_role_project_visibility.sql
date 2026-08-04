create or replace function private.can_access_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_project_member(p_project)
  or exists(
    select 1
    from public.responsibility_roles r
    join public.role_user_assignments a on a.role_id = r.id
    where r.project_id = p_project
      and a.user_id = auth.uid()
  )
  or exists(
    select 1
    from public.tasks t
    where t.project_id = p_project
      and private.can_access_task(t.id)
  )
$$;

drop policy if exists projects_access_select on public.projects;
create policy projects_access_select
on public.projects for select to authenticated
using(private.can_access_project(id));

drop policy if exists companies_member_select on public.companies;
create policy companies_access_select
on public.companies for select to authenticated
using(
  exists(
    select 1
    from public.projects p
    where p.company_id = id
      and private.can_access_project(p.id)
  )
);

revoke all on function private.can_access_project(uuid) from public, anon;
grant execute on function private.can_access_project(uuid) to authenticated;

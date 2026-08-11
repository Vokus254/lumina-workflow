-- LUMINA multi-company / multi-project hub and strict project scoping.
-- Company owners/managers can administer all projects of their company.
-- Company members/viewers only see projects where they are explicitly project members
-- or have a responsibility-role assignment. This prevents cross-project aggregation.

create or replace function private.can_access_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project
      and (
        private.is_project_member(p.id)
        or private.is_company_member(p.company_id, array['owner','manager'])
        or private.is_project_role_user(p.id)
      )
  )
$$;

revoke all on function private.can_access_project(uuid) from public,anon;
grant execute on function private.can_access_project(uuid) to authenticated;

-- Company visibility stays broad enough to show a company selector, but not its projects.
drop policy if exists companies_member_select on public.companies;
create policy companies_member_select on public.companies
for select to authenticated
using (
  private.is_company_member(id)
  or exists (
    select 1 from public.projects p
    where p.company_id=id and private.can_access_project(p.id)
  )
);

-- Project/table policies use the single can_access_project gate for full project access.
drop policy if exists projects_access_select on public.projects;
create policy projects_access_select on public.projects
for select to authenticated
using (private.can_access_project(id));

drop policy if exists roles_access_select on public.responsibility_roles;
drop policy if exists roles_member_select on public.responsibility_roles;
create policy roles_access_select on public.responsibility_roles
for select to authenticated
using (
  private.can_access_project(project_id)
  or exists (
    select 1 from public.role_user_assignments a
    where a.role_id=id and a.user_id=auth.uid()
  )
);

drop policy if exists steps_access_select on public.process_steps;
create policy steps_access_select on public.process_steps
for select to authenticated
using (
  private.can_access_project(project_id)
  or exists (
    select 1 from public.tasks t
    where t.process_step_id=id and private.can_access_task(t.id)
  )
);

-- Company owner/manager gets full task access; scoped role users still only get their tasks.
create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists(
    select 1
    from public.tasks t
    where t.id=p_task and private.can_access_project(t.project_id)
  )
  or exists(
    select 1
    from public.tasks t
    join public.role_user_assignments a on a.role_id=t.responsibility_role_id
    where t.id=p_task and a.user_id=auth.uid()
  )
  or exists(
    select 1
    from public.task_invitations i
    join public.external_contacts c on c.id=i.external_contact_id
    where i.task_id=p_task
      and c.auth_user_id=auth.uid()
      and c.active and c.access_enabled
      and i.status in ('sent','opened','accepted','completed')
      and i.revoked_at is null and i.expires_at>now()
  )
$$;

revoke all on function private.can_access_task(uuid) from public,anon;
grant execute on function private.can_access_task(uuid) to authenticated;

-- Project switcher / project hub. The RPC intentionally returns only projects the caller may open.
create or replace function public.project_hub_context()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  with accessible_companies as (
    select c.id,c.name,c.legal_form,c.registered_office,c.currency_code,
           coalesce(cm.company_role,'') as company_role
    from public.companies c
    left join public.company_members cm
      on cm.company_id=c.id and cm.user_id=auth.uid() and cm.active
    where private.is_company_member(c.id)
       or exists (
          select 1 from public.projects p
          where p.company_id=c.id and private.can_access_project(p.id)
       )
  ), project_rows as (
    select p.id,p.company_id,p.name,p.fiscal_year_start,p.fiscal_year_end,p.reporting_date,p.status,
           coalesce(pm.security_role,'') as project_role,
           case
             when private.is_company_member(p.company_id,array['owner','manager']) then true
             when pm.user_id is not null then true
             else private.is_project_role_user(p.id)
           end as can_open,
           (select count(*) from public.tasks t where t.project_id=p.id) as tasks_total,
           (select count(*) from public.tasks t where t.project_id=p.id and t.work_status='completed') as tasks_completed,
           (select count(*) from public.tasks t where t.project_id=p.id and coalesce(t.due_date_override,t.due_date)<current_date and t.work_status not in ('completed','not_relevant')) as tasks_overdue
    from public.projects p
    left join public.project_members pm
      on pm.project_id=p.id and pm.user_id=auth.uid() and pm.active
    where private.can_access_project(p.id)
  )
  select jsonb_build_object(
    'companies',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,
          'name',c.name,
          'legal_form',c.legal_form,
          'registered_office',c.registered_office,
          'currency_code',c.currency_code,
          'company_role',c.company_role,
          'can_manage_company',(c.company_role in ('owner','manager')),
          'projects',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id',p.id,
                'name',p.name,
                'fiscal_year_start',p.fiscal_year_start,
                'fiscal_year_end',p.fiscal_year_end,
                'reporting_date',p.reporting_date,
                'status',p.status,
                'project_role',p.project_role,
                'can_open',p.can_open,
                'tasks_total',p.tasks_total,
                'tasks_completed',p.tasks_completed,
                'tasks_overdue',p.tasks_overdue
              ) order by p.reporting_date desc,p.name
            ) from project_rows p where p.company_id=c.id
          ),'[]'::jsonb)
        ) order by c.name
      ) from accessible_companies c
    ),'[]'::jsonb)
  )
$$;

revoke all on function public.project_hub_context() from public,anon;
grant execute on function public.project_hub_context() to authenticated;

-- Tighten Quickstart context: member/viewer does not inherit every project of a company.
create or replace function public.quickstart_context()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select jsonb_build_object(
    'companies',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,'legal_form',c.legal_form,'registered_office',c.registered_office,'currency_code',c.currency_code,
        'projects',coalesce((
          select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'reporting_date',p.reporting_date,'status',p.status) order by p.reporting_date desc)
          from public.projects p
          where p.company_id=c.id and private.can_access_project(p.id)
        ),'[]'::jsonb)
      ) order by c.name)
      from public.companies c
      where private.is_company_member(c.id)
         or exists(select 1 from public.projects p where p.company_id=c.id and private.can_access_project(p.id))
    ),'[]'::jsonb),
    'session',(
      select jsonb_build_object('id',q.id,'company_id',q.company_id,'project_id',q.project_id,'current_step',q.current_step,'state',q.state,'completed_at',q.completed_at)
      from public.quickstart_sessions q
      where q.user_id=auth.uid() and q.completed_at is null
      order by q.updated_at desc limit 1
    )
  )
$$;

revoke all on function public.quickstart_context() from public,anon;
grant execute on function public.quickstart_context() to authenticated;

-- Full-project roles created by KAI Quickstart.
-- CFO/GF and RW-Leitung require project-wide transparency; Bilanzbuchhalter/WP/StB remain task-role scoped.
create or replace function public.quickstart_save_team(p_project_id uuid,p_team jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  item jsonb;
  v_role_key text;
  v_email text;
  v_user uuid;
  v_role uuid;
  v_kind text;
  v_security_role text;
  v_company uuid;
begin
  if not private.is_project_member(p_project_id,array['owner','manager'])
     and not exists(select 1 from public.projects p where p.id=p_project_id and private.is_company_member(p.company_id,array['owner','manager']))
  then raise exception 'Nur Projekt- oder Gesellschaftsleitung darf das Team festlegen.'; end if;
  if jsonb_typeof(p_team)<>'array' then raise exception 'Team muss eine Liste sein.'; end if;
  select company_id into v_company from public.projects where id=p_project_id;

  for item in select * from jsonb_array_elements(p_team) loop
    v_role_key := item->>'role_key';
    v_kind := item->>'kind';
    v_email := nullif(lower(btrim(coalesce(item->>'email',''))),'');
    v_role := null;
    v_user := null;

    if v_role_key is not null then
      update public.responsibility_roles set
        first_name=nullif(btrim(coalesce(item->>'first_name','')),''),
        last_name=nullif(btrim(coalesce(item->>'last_name','')),''),
        email=v_email
      where project_id=p_project_id and role_key=v_role_key
      returning id into v_role;
    end if;

    if v_email is not null then
      select id into v_user from auth.users where lower(email)=v_email limit 1;
    end if;

    if v_role is not null and v_user is not null then
      insert into public.role_user_assignments(role_id,user_id)
      values(v_role,v_user) on conflict do nothing;
    end if;

    v_security_role := case v_kind
      when 'project_lead' then 'manager'
      when 'cfo' then 'viewer'
      when 'accounting_lead' then 'reviewer'
      else null
    end;

    if v_user is not null and v_security_role is not null then
      insert into public.project_members(project_id,user_id,security_role,active)
      values(p_project_id,v_user,v_security_role,true)
      on conflict(project_id,user_id) do update set security_role=excluded.security_role,active=true;

      insert into public.company_members(company_id,user_id,company_role,active)
      values(v_company,v_user,'member',true)
      on conflict(company_id,user_id) do update set active=true;
    end if;
  end loop;

  update public.quickstart_sessions
  set current_step=3,state=state||jsonb_build_object('team',p_team),updated_at=now()
  where user_id=auth.uid() and project_id=p_project_id and completed_at is null;

  return jsonb_build_object('saved',true);
end $$;

revoke all on function public.quickstart_save_team(uuid,jsonb) from public,anon;
grant execute on function public.quickstart_save_team(uuid,jsonb) to authenticated;

-- Project-specific source state must honor company owner/manager access too.
create or replace function public.get_lumina_source_state(p_project_id uuid default null)
returns table(project_id uuid, state jsonb, source_sha256 text)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_project_id uuid;
  v_company_id uuid;
  v_state jsonb;
  v_sha text;
  v_station integer;
  v_measure integer;
  v_subitem integer;
  v_rows jsonb;
  v_full_project_access boolean;
begin
  select p.id,p.company_id into v_project_id,v_company_id
  from public.projects p
  where (p_project_id is null or p.id=p_project_id)
    and private.can_access_project(p.id)
  order by p.created_at
  limit 1;

  if v_project_id is null then return; end if;

  select s.state,s.source_sha256 into v_state,v_sha
  from public.project_source_states s
  where s.project_id=v_project_id;
  if v_state is null then return; end if;

  v_full_project_access := private.is_project_member(v_project_id)
    or private.is_company_member(v_company_id,array['owner','manager']);

  -- Responsibility-role users without project-wide membership only receive PBC rows
  -- for tasks that are actually assigned to them.
  if not v_full_project_access then
    for v_station in 0..jsonb_array_length(v_state)-1 loop
      for v_measure in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures'],'[]'::jsonb))-1 loop
        for v_subitem in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems'],'[]'::jsonb))-1 loop
          if v_state #>> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'type']='pbc' then
            select coalesce(jsonb_agg(entry),'[]'::jsonb) into v_rows
            from jsonb_array_elements(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'data','rows'],'[]'::jsonb)) entry
            where exists(
              select 1 from public.tasks t
              where t.project_id=v_project_id
                and t.source_number=entry->>0
                and private.can_access_task(t.id)
            );
            v_state:=jsonb_set(v_state,array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'data','rows'],v_rows,false);
          end if;
        end loop;
      end loop;
    end loop;
  end if;

  return query select v_project_id,v_state,v_sha;
end $$;

revoke all on function public.get_lumina_source_state(uuid) from public,anon;
grant execute on function public.get_lumina_source_state(uuid) to authenticated;

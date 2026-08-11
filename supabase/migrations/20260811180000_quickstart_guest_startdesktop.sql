-- LUMINA pilot start desktop / shared Quickstart bootstrap account.
-- The shared account is deliberately onboarding-only. It must never expose a
-- common project hub containing projects created by unrelated pilot users.

create or replace function private.is_quickstart_guest()
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,auth
as $$
  select lower(coalesce(auth.jwt()->>'email','')) = 'quickstart@volkerkusch.de'
$$;

revoke all on function private.is_quickstart_guest() from public,anon;
grant execute on function private.is_quickstart_guest() to authenticated;

-- The project hub of the shared bootstrap account is always empty. Normal
-- personal users keep the existing multi-company/project logic unchanged.
create or replace function public.project_hub_context()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_result jsonb;
begin
  if private.is_quickstart_guest() then
    return jsonb_build_object('companies','[]'::jsonb,'quickstart_guest',true);
  end if;

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
             true as can_open,
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
            'id',c.id,'name',c.name,'legal_form',c.legal_form,
            'registered_office',c.registered_office,'currency_code',c.currency_code,
            'company_role',c.company_role,
            'can_manage_company',(c.company_role in ('owner','manager')),
            'projects',coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id',p.id,'name',p.name,'fiscal_year_start',p.fiscal_year_start,
                  'fiscal_year_end',p.fiscal_year_end,'reporting_date',p.reporting_date,
                  'status',p.status,'project_role',p.project_role,'can_open',p.can_open,
                  'tasks_total',p.tasks_total,'tasks_completed',p.tasks_completed,
                  'tasks_overdue',p.tasks_overdue
                ) order by p.reporting_date desc,p.name
              ) from project_rows p where p.company_id=c.id
            ),'[]'::jsonb)
          ) order by c.name
        ) from accessible_companies c
      ),'[]'::jsonb)
    )
  into v_result;
  return v_result;
end $$;

revoke all on function public.project_hub_context() from public,anon;
grant execute on function public.project_hub_context() to authenticated;

-- Likewise, KAI must not list prior companies/projects for the shared account.
-- Personal users still receive their own context.
create or replace function public.quickstart_context()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_result jsonb;
begin
  if private.is_quickstart_guest() then
    return jsonb_build_object('companies','[]'::jsonb,'session',null,'quickstart_guest',true);
  end if;

  select jsonb_build_object(
      'companies',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',c.id,'name',c.name,'legal_form',c.legal_form,
          'registered_office',c.registered_office,'currency_code',c.currency_code,
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
  into v_result;
  return v_result;
end $$;

revoke all on function public.quickstart_context() from public,anon;
grant execute on function public.quickstart_context() to authenticated;

-- When the shared pilot account creates a company/project, also grant the
-- designated LUMINA administrator access when that Auth user exists. This
-- keeps pilot projects administrable instead of stranding them on the shared ID.
create or replace function private.quickstart_admin_user()
returns uuid
language sql
stable
security definer
set search_path=pg_catalog,auth
as $$
  select id from auth.users where lower(email)='admin@volkerkusch.de' limit 1
$$;

revoke all on function private.quickstart_admin_user() from public,anon;
grant execute on function private.quickstart_admin_user() to authenticated;

create or replace function public.quickstart_create_company(
  p_name text,
  p_legal_form text default null,
  p_registered_office text default null,
  p_currency_code text default 'EUR'
)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_company uuid; v_admin uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  if length(btrim(coalesce(p_name,''))) < 2 then raise exception 'Bitte einen Gesellschaftsnamen angeben.'; end if;
  insert into public.companies(name,legal_form,registered_office,currency_code)
  values(btrim(p_name),nullif(btrim(coalesce(p_legal_form,'')),''),nullif(btrim(coalesce(p_registered_office,'')),''),upper(coalesce(nullif(btrim(p_currency_code),''),'EUR')))
  returning id into v_company;

  insert into public.company_members(company_id,user_id,company_role)
  values(v_company,auth.uid(),'owner');

  if private.is_quickstart_guest() then
    v_admin := private.quickstart_admin_user();
    if v_admin is not null and v_admin <> auth.uid() then
      insert into public.company_members(company_id,user_id,company_role,active)
      values(v_company,v_admin,'owner',true)
      on conflict(company_id,user_id) do update set company_role='owner',active=true;
    end if;
  end if;

  insert into public.quickstart_sessions(user_id,company_id,current_step,state)
  values(auth.uid(),v_company,1,jsonb_build_object('company_name',btrim(p_name)))
  on conflict do nothing;
  return v_company;
end $$;

revoke all on function public.quickstart_create_company(text,text,text,text) from public,anon;
grant execute on function public.quickstart_create_company(text,text,text,text) to authenticated;

-- Add the administrator to projects created by the shared pilot account.
-- Keep the established cloning logic untouched by wrapping the post-condition
-- in a trigger on project_members rather than re-copying the 202-line clone RPC.
create or replace function private.quickstart_guest_project_admin()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_admin uuid;
begin
  if new.user_id=auth.uid() and new.security_role='owner' and private.is_quickstart_guest() then
    v_admin := private.quickstart_admin_user();
    if v_admin is not null and v_admin <> new.user_id then
      insert into public.project_members(project_id,user_id,security_role,active)
      values(new.project_id,v_admin,'owner',true)
      on conflict(project_id,user_id) do update set security_role='owner',active=true;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists quickstart_guest_project_admin_trg on public.project_members;
create trigger quickstart_guest_project_admin_trg
after insert on public.project_members
for each row execute function private.quickstart_guest_project_admin();

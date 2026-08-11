-- LUMINA Admin Hub: global administrators, company lifecycle and project creation.

create table if not exists public.lumina_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lumina_admins enable row level security;
revoke all on public.lumina_admins from anon, authenticated;

insert into public.lumina_admins(user_id,active)
select id,true from auth.users where lower(email)='admin@volkerkusch.de'
on conflict(user_id) do update set active=true;

create or replace function private.is_lumina_admin()
returns boolean
language sql stable security definer
set search_path=pg_catalog,public
as $$
  select exists(
    select 1 from public.lumina_admins a
    where a.user_id=auth.uid() and a.active
  )
$$;
revoke all on function private.is_lumina_admin() from public,anon;
grant execute on function private.is_lumina_admin() to authenticated;

alter table public.companies
  add column if not exists status text not null default 'active';

do $$ begin
  alter table public.companies add constraint companies_status_check
  check(status in ('active','locked','archived'));
exception when duplicate_object then null; end $$;

-- Global admins see all companies/projects through the same access gate.
create or replace function private.can_access_project(p_project uuid)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  select private.is_lumina_admin()
  or exists (
    select 1
    from public.projects p
    join public.companies c on c.id=p.company_id
    where p.id = p_project
      and c.status='active'
      and p.status in ('active','draft')
      and (
        private.is_project_member(p.id)
        or private.is_company_member(p.company_id, array['owner','manager'])
        or private.is_project_role_user(p.id)
      )
  )
$$;
revoke all on function private.can_access_project(uuid) from public,anon;
grant execute on function private.can_access_project(uuid) to authenticated;

drop policy if exists companies_member_select on public.companies;
create policy companies_member_select on public.companies
for select to authenticated
using (
  private.is_lumina_admin()
  or (status='active' and private.is_company_member(id))
  or (status='active' and exists (
    select 1 from public.projects p
    where p.company_id=id and private.can_access_project(p.id)
  ))
);

-- Service-role-only wrapper around the proven Quickstart project cloner.
-- It impersonates the selected project owner only for the nested transaction.
create or replace function public.admin_create_project(
  p_company_id uuid,
  p_name text,
  p_fiscal_year_start date,
  p_fiscal_year_end date,
  p_reporting_date date,
  p_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_project uuid;
begin
  if current_user <> 'postgres' and current_user <> 'service_role' then
    raise exception 'Nur serverseitige Administration zulässig.';
  end if;
  if p_owner_user_id is null then raise exception 'Owner fehlt.'; end if;
  if not exists(select 1 from auth.users where id=p_owner_user_id) then raise exception 'Owner-Benutzer existiert nicht.'; end if;

  insert into public.company_members(company_id,user_id,company_role,active)
  values(p_company_id,p_owner_user_id,'owner',true)
  on conflict(company_id,user_id) do update set company_role='owner',active=true;

  perform set_config('request.jwt.claim.sub',p_owner_user_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_owner_user_id::text,'role','authenticated')::text,true);

  v_project := public.quickstart_create_project(
    p_company_id,
    p_name,
    p_fiscal_year_start,
    p_fiscal_year_end,
    p_reporting_date,
    null
  );
  return v_project;
end $$;

revoke all on function public.admin_create_project(uuid,text,date,date,date,uuid) from public,anon,authenticated;
grant execute on function public.admin_create_project(uuid,text,date,date,date,uuid) to service_role;

-- KAI Quickstart: Multi-Company / Multi-Project onboarding.
-- One data model: Quickstart creates ordinary companies/projects and clones only template structure.

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_role text not null default 'member' check (company_role in ('owner','manager','member','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(company_id,user_id)
);

alter table public.company_members enable row level security;

drop policy if exists company_members_self_select on public.company_members;
create policy company_members_self_select on public.company_members
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.company_members cm
    where cm.company_id = company_members.company_id
      and cm.user_id = auth.uid() and cm.active
      and cm.company_role in ('owner','manager')
  )
);

grant select on public.company_members to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.company_members from authenticated;
revoke all on public.company_members from anon;

create or replace function private.is_company_member(p_company uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1 from public.company_members cm
    where cm.company_id=p_company and cm.user_id=auth.uid() and cm.active
      and (p_roles is null or cm.company_role=any(p_roles))
  )
$$;

revoke all on function private.is_company_member(uuid,text[]) from public,anon;
grant execute on function private.is_company_member(uuid,text[]) to authenticated;

-- Existing project memberships bootstrap company access once.
insert into public.company_members(company_id,user_id,company_role)
select distinct p.company_id, pm.user_id,
  case when pm.security_role='owner' then 'owner'
       when pm.security_role='manager' then 'manager'
       else 'member' end
from public.project_members pm
join public.projects p on p.id=pm.project_id
where pm.active
on conflict(company_id,user_id) do update set
  active=true,
  company_role=case
    when public.company_members.company_role='owner' then 'owner'
    when excluded.company_role='owner' then 'owner'
    when excluded.company_role='manager' then 'manager'
    else public.company_members.company_role end;

-- Companies are visible either through company membership or existing project membership.
drop policy if exists companies_member_select on public.companies;
create policy companies_member_select on public.companies for select to authenticated
using(
  private.is_company_member(id)
  or exists(select 1 from public.projects p where p.company_id=id and private.is_project_member(p.id))
);

create table if not exists public.quickstart_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  current_step integer not null default 0 check(current_step between 0 and 5),
  state jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quickstart_sessions enable row level security;
drop policy if exists quickstart_sessions_self_select on public.quickstart_sessions;
create policy quickstart_sessions_self_select on public.quickstart_sessions for select to authenticated using(user_id=auth.uid());
grant select on public.quickstart_sessions to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.quickstart_sessions from authenticated;
revoke all on public.quickstart_sessions from anon;

create or replace function public.quickstart_context()
returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  select jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'name',c.name,'legal_form',c.legal_form,'registered_office',c.registered_office,'currency_code',c.currency_code,
        'projects',coalesce((
          select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'reporting_date',p.reporting_date,'status',p.status) order by p.reporting_date desc)
          from public.projects p
          where p.company_id=c.id and (private.is_project_member(p.id) or private.is_company_member(c.id))
        ),'[]'::jsonb)
      ) order by c.name)
      from public.companies c
      where private.is_company_member(c.id)
         or exists(select 1 from public.projects p where p.company_id=c.id and private.is_project_member(p.id))
    ),'[]'::jsonb),
    'session',(
      select jsonb_build_object('id',q.id,'company_id',q.company_id,'project_id',q.project_id,'current_step',q.current_step,'state',q.state,'completed_at',q.completed_at)
      from public.quickstart_sessions q where q.user_id=auth.uid() and q.completed_at is null order by q.updated_at desc limit 1
    )
  )
$$;
revoke all on function public.quickstart_context() from public,anon;
grant execute on function public.quickstart_context() to authenticated;

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
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  if length(btrim(coalesce(p_name,''))) < 2 then raise exception 'Bitte einen Gesellschaftsnamen angeben.'; end if;
  insert into public.companies(name,legal_form,registered_office,currency_code)
  values(btrim(p_name),nullif(btrim(coalesce(p_legal_form,'')),''),nullif(btrim(coalesce(p_registered_office,'')),''),upper(coalesce(nullif(btrim(p_currency_code),''),'EUR')))
  returning id into v_company;
  insert into public.company_members(company_id,user_id,company_role) values(v_company,auth.uid(),'owner');
  insert into public.quickstart_sessions(user_id,company_id,current_step,state)
  values(auth.uid(),v_company,1,jsonb_build_object('company_name',btrim(p_name)))
  on conflict do nothing;
  return v_company;
end $$;
revoke all on function public.quickstart_create_company(text,text,text,text) from public,anon;
grant execute on function public.quickstart_create_company(text,text,text,text) to authenticated;

create or replace function public.quickstart_use_company(p_company_id uuid)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_session uuid;
begin
  if not private.is_company_member(p_company_id) and not exists(
    select 1 from public.projects p where p.company_id=p_company_id and private.is_project_member(p.id)
  ) then raise exception 'Kein Zugriff auf diese Gesellschaft.'; end if;
  insert into public.company_members(company_id,user_id,company_role)
  values(p_company_id,auth.uid(),'member') on conflict(company_id,user_id) do update set active=true;
  insert into public.quickstart_sessions(user_id,company_id,current_step,state)
  values(auth.uid(),p_company_id,1,'{}'::jsonb) returning id into v_session;
  return v_session;
end $$;
revoke all on function public.quickstart_use_company(uuid) from public,anon;
grant execute on function public.quickstart_use_company(uuid) to authenticated;

create or replace function private.shift_quickstart_json_dates(p_value jsonb, p_days integer)
returns jsonb
language plpgsql immutable
set search_path=pg_catalog,public
as $$
declare v_type text; v_result jsonb; v_key text; v_item jsonb; v_text text;
begin
  if p_value is null or p_days=0 then return p_value; end if;
  v_type:=jsonb_typeof(p_value);
  if v_type='object' then
    v_result:='{}'::jsonb;
    for v_key,v_item in select key,value from jsonb_each(p_value) loop
      v_result:=v_result || jsonb_build_object(v_key,private.shift_quickstart_json_dates(v_item,p_days));
    end loop;
    return v_result;
  elsif v_type='array' then
    select coalesce(jsonb_agg(private.shift_quickstart_json_dates(value,p_days)),'[]'::jsonb) into v_result from jsonb_array_elements(p_value);
    return v_result;
  elsif v_type='string' then
    v_text:=p_value #>> '{}';
    if v_text ~ '^\\d{4}-\\d{2}-\\d{2}$' then
      return to_jsonb(((v_text::date)+p_days)::text);
    end if;
  end if;
  return p_value;
end $$;

revoke all on function private.shift_quickstart_json_dates(jsonb,integer) from public,anon;

create or replace function public.quickstart_create_project(
  p_company_id uuid,
  p_name text,
  p_fiscal_year_start date,
  p_fiscal_year_end date,
  p_reporting_date date,
  p_auditor text default null
)
returns uuid
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_project uuid;
  v_template uuid;
  v_template_reporting date;
  v_sender text;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  if not private.is_company_member(p_company_id,array['owner','manager']) then raise exception 'Kein Zugriff auf diese Gesellschaft.'; end if;
  if p_fiscal_year_start is null or p_fiscal_year_end is null or p_reporting_date is null or p_fiscal_year_start>p_fiscal_year_end then raise exception 'Ungültiges Geschäftsjahr.'; end if;

  select p.id,p.reporting_date into v_template,v_template_reporting
  from public.projects p
  order by (select count(*) from public.tasks t where t.project_id=p.id) desc, p.created_at asc
  limit 1;
  if v_template is null then raise exception 'Kein LUMINA-Referenzprojekt für die 78/202-Struktur gefunden.'; end if;

  insert into public.projects(company_id,name,fiscal_year_start,fiscal_year_end,reporting_date,status)
  values(p_company_id,btrim(p_name),p_fiscal_year_start,p_fiscal_year_end,p_reporting_date,'active')
  returning id into v_project;
  insert into public.project_members(project_id,user_id,security_role,active) values(v_project,auth.uid(),'owner',true);

  create temp table qs_role_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  create temp table qs_step_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  create temp table qs_task_map(old_id uuid primary key,new_id uuid not null) on commit drop;
  create temp table qs_folder_map(old_id uuid primary key,new_id uuid not null) on commit drop;

  insert into qs_role_map(old_id,new_id)
  select id,gen_random_uuid() from public.responsibility_roles where project_id=v_template;
  insert into public.responsibility_roles(id,project_id,role_key,display_name,legacy_source_key)
  select rm.new_id,v_project,r.role_key,r.display_name,r.legacy_source_key
  from public.responsibility_roles r join qs_role_map rm on rm.old_id=r.id
  where r.project_id=v_template;

  -- Steps: allocate IDs first, then wire parents.
  insert into qs_step_map(old_id,new_id)
  select id,gen_random_uuid() from public.process_steps where project_id=v_template;
  insert into public.process_steps(id,project_id,parent_id,code,name,sort_order,legacy_source_key)
  select m.new_id,v_project,null,s.code,s.name,s.sort_order,s.legacy_source_key
  from public.process_steps s join qs_step_map m on m.old_id=s.id where s.project_id=v_template;
  update public.process_steps n set parent_id=pm.new_id
  from public.process_steps o join qs_step_map cm on cm.old_id=o.id join qs_step_map pm on pm.old_id=o.parent_id
  where n.id=cm.new_id and n.project_id=v_project;

  -- Guidance belongs to step and is reusable content.
  insert into public.process_step_guidance(process_step_id,ziel,was_ist_zu_tun,benoetigte_unterlagen,liefergegenstand,typische_fehler,erledigt_wenn,zustaendige_rolle,rechtsgrundlage,arbeitshilfe_name,arbeitshilfe_felder,arbeitshilfe_storage_bucket,arbeitshilfe_storage_path)
  select sm.new_id,g.ziel,g.was_ist_zu_tun,g.benoetigte_unterlagen,g.liefergegenstand,g.typische_fehler,g.erledigt_wenn,g.zustaendige_rolle,g.rechtsgrundlage,g.arbeitshilfe_name,g.arbeitshilfe_felder,g.arbeitshilfe_storage_bucket,g.arbeitshilfe_storage_path
  from public.process_step_guidance g join qs_step_map sm on sm.old_id=g.process_step_id;

  insert into qs_task_map(old_id,new_id)
  select id,gen_random_uuid() from public.tasks where project_id=v_template;
  insert into public.tasks(id,project_id,process_step_id,responsibility_role_id,source_number,title,category,required_documents_text,expected_format,company_scope_text,due_rule_label,due_offset_days,due_date,due_date_override,internal_comment,work_status,review_status,legacy_source_id,legacy_source_key)
  select tm.new_id,v_project,sm.new_id,rm.new_id,t.source_number,t.title,t.category,t.required_documents_text,t.expected_format,t.company_scope_text,t.due_rule_label,t.due_offset_days,
    case when t.due_date is null then null else t.due_date + (p_reporting_date-v_template_reporting) end,
    null,null,'open','unreviewed',t.legacy_source_id,t.legacy_source_key
  from public.tasks t join qs_task_map tm on tm.old_id=t.id
  left join qs_step_map sm on sm.old_id=t.process_step_id
  left join qs_role_map rm on rm.old_id=t.responsibility_role_id
  where t.project_id=v_template;

  -- Multiple step due dates, shifted relative to reporting date.
  insert into public.process_step_due_dates(project_id,process_step_id,phase_key,due_rule_label,due_date,due_date_override,sort_order)
  select v_project,sm.new_id,d.phase_key,d.due_rule_label,
    case when d.due_date is null then null else d.due_date + (p_reporting_date-v_template_reporting) end,
    null,d.sort_order
  from public.process_step_due_dates d join qs_step_map sm on sm.old_id=d.process_step_id
  where d.project_id=v_template;

  -- Visible thematic dataroom + technical step folders. No documents are copied.
  insert into qs_folder_map(old_id,new_id)
  select id,gen_random_uuid() from public.dataroom_folders where project_id=v_template and archived_at is null;
  insert into public.dataroom_folders(id,project_id,parent_folder_id,name,template_key,sort_order,visibility_scope,legacy_path_key,process_step_id,folder_kind)
  select fm.new_id,v_project,null,f.name,f.template_key,f.sort_order,f.visibility_scope,f.legacy_path_key,sm.new_id,f.folder_kind
  from public.dataroom_folders f join qs_folder_map fm on fm.old_id=f.id left join qs_step_map sm on sm.old_id=f.process_step_id
  where f.project_id=v_template and f.archived_at is null;
  update public.dataroom_folders n set parent_folder_id=pm.new_id
  from public.dataroom_folders o join qs_folder_map cm on cm.old_id=o.id join qs_folder_map pm on pm.old_id=o.parent_folder_id
  where n.id=cm.new_id and n.project_id=v_project;

  insert into public.task_folder_assignments(task_id,folder_id,is_primary,assigned_by)
  select tm.new_id,fm.new_id,a.is_primary,auth.uid()
  from public.task_folder_assignments a join qs_task_map tm on tm.old_id=a.task_id join qs_folder_map fm on fm.old_id=a.folder_id;

  insert into public.document_requests(task_id,folder_id,title,description,expected_format,required,sort_order)
  select tm.new_id,fm.new_id,rq.title,rq.description,rq.expected_format,rq.required,rq.sort_order
  from public.document_requests rq join qs_task_map tm on tm.old_id=rq.task_id left join qs_folder_map fm on fm.old_id=rq.folder_id;

  -- Legacy dashboard needs a source state. It is UI source material only; live task/role/document state overlays it.
  insert into public.project_source_states(project_id,state,source_sha256)
  select v_project,private.shift_quickstart_json_dates(state,(p_reporting_date-v_template_reporting)),source_sha256 from public.project_source_states where project_id=v_template
  on conflict(project_id) do nothing;

  select email into v_sender from auth.users where id=auth.uid();
  insert into public.project_notification_settings(project_id,sender_email)
  values(v_project,coalesce(v_sender,'info@lumina.local'));

  if p_auditor is not null and btrim(p_auditor)<>'' then
    update public.responsibility_roles set display_name=btrim(p_auditor)
    where project_id=v_project and role_key='WP (Leitung)';
  end if;

  update public.quickstart_sessions set project_id=v_project,current_step=2,
    state=state || jsonb_build_object('project_name',p_name,'reporting_date',p_reporting_date),updated_at=now()
  where id=(select id from public.quickstart_sessions where user_id=auth.uid() and company_id=p_company_id and completed_at is null order by updated_at desc limit 1);

  return v_project;
end $$;
revoke all on function public.quickstart_create_project(uuid,text,date,date,date,text) from public,anon;
grant execute on function public.quickstart_create_project(uuid,text,date,date,date,text) to authenticated;

create or replace function public.quickstart_save_team(p_project_id uuid,p_team jsonb)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private,auth
as $$
declare item jsonb; v_role_key text; v_email text; v_user uuid; v_role uuid;
begin
  if not private.is_project_member(p_project_id,array['owner','manager']) then raise exception 'Nur Projektleitung darf das Team festlegen.'; end if;
  if jsonb_typeof(p_team)<>'array' then raise exception 'Team muss eine Liste sein.'; end if;
  for item in select * from jsonb_array_elements(p_team) loop
    v_role_key := item->>'role_key'; v_email := nullif(lower(btrim(coalesce(item->>'email',''))),'');
    if v_role_key is not null then
      update public.responsibility_roles set
        first_name=nullif(btrim(coalesce(item->>'first_name','')),''),
        last_name=nullif(btrim(coalesce(item->>'last_name','')),''),
        email=v_email
      where project_id=p_project_id and role_key=v_role_key
      returning id into v_role;
      if v_role is not null and v_email is not null then
        select id into v_user from auth.users where lower(email)=v_email limit 1;
        if v_user is not null then insert into public.role_user_assignments(role_id,user_id) values(v_role,v_user) on conflict do nothing; end if;
      end if;
    end if;
    if item->>'kind'='project_lead' and v_email is not null then
      select id into v_user from auth.users where lower(email)=v_email limit 1;
      if v_user is not null then insert into public.project_members(project_id,user_id,security_role,active) values(p_project_id,v_user,'manager',true)
        on conflict(project_id,user_id) do update set security_role='manager',active=true; end if;
    end if;
  end loop;
  update public.quickstart_sessions set current_step=3,state=state||jsonb_build_object('team',p_team),updated_at=now()
  where user_id=auth.uid() and project_id=p_project_id and completed_at is null;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.quickstart_save_team(uuid,jsonb) from public,anon;
grant execute on function public.quickstart_save_team(uuid,jsonb) to authenticated;

create or replace function public.quickstart_finish(p_project_id uuid)
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_steps int; v_tasks int; v_requests int; v_due int;
begin
  if not private.is_project_member(p_project_id,array['owner','manager']) then raise exception 'Kein Zugriff.'; end if;
  select count(*) into v_steps from public.process_steps where project_id=p_project_id and code ~ '^[1-8]\\.[0-9]+$';
  select count(*) into v_tasks from public.tasks where project_id=p_project_id;
  select count(*) into v_requests from public.document_requests r join public.tasks t on t.id=r.task_id where t.project_id=p_project_id;
  select count(*) into v_due from public.process_step_due_dates where project_id=p_project_id;
  update public.quickstart_sessions set current_step=5,completed_at=now(),updated_at=now()
  where user_id=auth.uid() and project_id=p_project_id and completed_at is null;
  return jsonb_build_object('process_stations',v_steps,'tasks',v_tasks,'document_requests',v_requests,'due_dates',v_due);
end $$;
revoke all on function public.quickstart_finish(uuid) from public,anon;
grant execute on function public.quickstart_finish(uuid) to authenticated;

-- Multi-project safe source state for the legacy dashboard.
drop function if exists public.get_lumina_source_state();
create or replace function public.get_lumina_source_state(p_project_id uuid default null)
returns table(project_id uuid, state jsonb, source_sha256 text)
language plpgsql stable security definer
set search_path = pg_catalog, public, private
as $$
declare v_project_id uuid; v_state jsonb; v_sha text; v_station integer; v_measure integer; v_subitem integer; v_rows jsonb;
begin
  select p.id into v_project_id
  from public.projects p
  where (p_project_id is null or p.id=p_project_id)
    and (private.is_project_member(p.id) or private.is_project_role_user(p.id))
  order by p.created_at limit 1;
  if v_project_id is null then return; end if;
  select s.state,s.source_sha256 into v_state,v_sha from public.project_source_states s where s.project_id=v_project_id;
  if v_state is null then return; end if;
  if not private.is_project_member(v_project_id) then
    for v_station in 0..jsonb_array_length(v_state)-1 loop
      for v_measure in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures'],'[]'::jsonb))-1 loop
        for v_subitem in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems'],'[]'::jsonb))-1 loop
          if v_state #>> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'type'] = 'pbc' then
            select coalesce(jsonb_agg(entry),'[]'::jsonb) into v_rows
            from jsonb_array_elements(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'data','rows'],'[]'::jsonb)) entry
            where exists(select 1 from public.tasks t where t.project_id=v_project_id and t.source_number=entry->>0 and private.can_access_task(t.id));
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

-- V10-Fix: get_project_schedule_responsibility nutzte eine eigene, engere Zugriffsprüfung
-- (is_project_member OR is_project_role_user) statt der kanonischen private.can_access_project(),
-- die überall sonst (companies/projects/process_steps/tasks) gilt und bereits
-- private.is_lumina_admin() einschließt (siehe admin_hub.sql). Dadurch schlug die RPC für
-- adminall@volkerkusch.de fehl: adminall hat weder eine project_members- noch eine
-- role_user_assignments-Zeile, sein Zugriff läuft ausschließlich über lumina_admins.
--
-- Diese Migration gewährt KEINE neue Berechtigung. Sie ersetzt die Zugriffsprüfung der RPC
-- durch exakt dieselbe Funktion, die bereits companies/projects/process_steps/tasks für
-- denselben Nutzerkreis freigibt. Normale Projektnutzer und Rollennutzer bestehen weiterhin
-- unverändert; adminall erhält dadurch nicht mehr Zugriff als auf jede andere Projektseite.
create or replace function public.get_project_schedule_responsibility(p_project_id uuid)
returns table (
  schedule_type text,
  schedule_key text,
  label text,
  due_date date,
  status text,
  process_step_code text,
  process_step_name text,
  responsibility_role text,
  responsible_person text,
  responsible_email text,
  source text
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.can_access_project(p_project_id) then
    raise exception 'Kein Zugriff auf dieses Projekt';
  end if;

  return query
  select
    'task'::text,
    t.id::text,
    coalesce(nullif(t.source_number,''), ps.code, '') || case when coalesce(t.title,'')<>'' then ' · '||t.title else '' end,
    coalesce(t.due_date_override,t.due_date),
    t.work_status::text,
    ps.code::text,
    ps.name::text,
    coalesce(rr.display_name,rr.role_key)::text,
    nullif(concat_ws(' ',rr.first_name,rr.last_name),'')::text,
    rr.email::text,
    'tasks'::text
  from public.tasks t
  left join public.process_steps ps on ps.id=t.process_step_id
  left join public.responsibility_roles rr on rr.id=t.responsibility_role_id
  where t.project_id=p_project_id
    and coalesce(t.due_date_override,t.due_date) is not null

  union all

  select
    'process_date'::text,
    d.id::text,
    coalesce(nullif(btrim(d.due_rule_label),''), ps.code || ' · ' || ps.name),
    coalesce(d.due_date_override,d.due_date),
    'planned'::text,
    ps.code::text,
    ps.name::text,
    string_agg(distinct coalesce(rr.display_name,rr.role_key), ', ') filter (where rr.id is not null),
    string_agg(distinct nullif(concat_ws(' ',rr.first_name,rr.last_name),''), ', ') filter (where nullif(concat_ws(' ',rr.first_name,rr.last_name),'') is not null),
    string_agg(distinct rr.email, ', ') filter (where rr.email is not null),
    'process_step_due_dates'::text
  from public.process_step_due_dates d
  left join public.process_steps ps on ps.id=d.process_step_id
  left join public.tasks t on t.project_id=d.project_id and t.process_step_id=d.process_step_id
  left join public.responsibility_roles rr on rr.id=t.responsibility_role_id
  where d.project_id=p_project_id
    and coalesce(d.due_date_override,d.due_date) is not null
  group by d.id,d.due_rule_label,d.due_date_override,d.due_date,ps.code,ps.name

  union all

  select
    'milestone'::text,
    m.id::text,
    m.label::text,
    m.milestone_date,
    m.status::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    'project_milestones'::text
  from public.project_milestones m
  where m.project_id=p_project_id
    and m.milestone_date is not null

  order by 4 nulls last,1,3;
end;
$$;

revoke all on function public.get_project_schedule_responsibility(uuid) from public;
grant execute on function public.get_project_schedule_responsibility(uuid) to authenticated;

comment on function public.get_project_schedule_responsibility(uuid) is
  'Projektweite Termin-/Verantwortlichkeitsmatrix für KAI/KIRA. Zugriff über die kanonische private.can_access_project() (identisch zu companies/projects/process_steps/tasks), nicht über eine eigene, engere Prüfung.';

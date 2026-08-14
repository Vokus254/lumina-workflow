-- V9: Projektweite Termin-/Verantwortlichkeitsmatrix für KAI/KIRA.
-- Liefert ausschließlich Steuerungsdaten (Termin, Prozess, Rolle/Person), keine Dokumentinhalte.

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
  if auth.uid() is null or not (
    private.is_project_member(p_project_id)
    or private.is_project_role_user(p_project_id)
  ) then
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
  'Projektweite Termin-/Verantwortlichkeitsmatrix für KAI/KIRA. Projektmitglieder sehen Steuerungsdaten aller Termine unabhängig von taskbezogener Detail-RLS.';

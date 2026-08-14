-- V10: project_milestones können jetzt eine Zuständigkeit tragen (responsibility_role_id),
-- analog zu tasks.responsibility_role_id. Bisher hatten Meilensteine strukturell nie eine
-- Zuständigkeit, weshalb KAI/KIRA für "Beginn Vorprüfung"/"Beginn Hauptprüfung" zwingend
-- "keine Zuständigkeit hinterlegt" melden mussten - unabhängig davon, ob real jemand
-- zuständig ist. Die Zuordnung wird als echte Projektdaten hinterlegt, nicht im KI-Prompt.

alter table public.project_milestones
  add column if not exists responsibility_role_id uuid references public.responsibility_roles(id) on delete set null;

comment on column public.project_milestones.responsibility_role_id is
  'Optionale Zuständigkeit für den Meilenstein, analog zu tasks.responsibility_role_id. Null = keine Zuständigkeit in LUMINA hinterlegt.';

-- Fachliche Zuordnung: für "Beginn Vorprüfung" (2026-05-31) und "Beginn Hauptprüfung"
-- (2027-01-21) ist der Leiter Rechnungswesen (RW (Leitung), Ralf Lewe, lewe@volkerkusch.de)
-- verantwortlich - dieselbe Rolle, die im Projekt bereits für andere Termine hinterlegt ist.
-- Die Zuordnung erfolgt bewusst über die vorhandene E-Mail-Adresse als stabilen Schlüssel
-- statt über eine geratene role_key-Namenskonvention. Projekte/Umgebungen ohne passende
-- responsibility_roles-Zeile bleiben unverändert (kein Fehler, keine Neuanlage einer Rolle).
update public.project_milestones m
set responsibility_role_id = rr.id
from public.responsibility_roles rr
where rr.project_id = m.project_id
  and lower(rr.email) = 'lewe@volkerkusch.de'
  and m.milestone_date in (date '2026-05-31', date '2027-01-21')
  and (
    m.label ilike '%vorprüfung%' or m.label ilike '%vorpr%'
    or m.label ilike '%hauptprüfung%' or m.label ilike '%hauptpr%'
  );

-- Termin-/Verantwortlichkeitsmatrix: Meilensteinzweig gibt jetzt ebenfalls Rolle/Person/E-Mail
-- aus, sofern responsibility_role_id gesetzt ist. Zugriffsprüfung unverändert gegenüber der
-- vorherigen Migration (private.can_access_project).
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
    coalesce(rr.display_name,rr.role_key)::text,
    nullif(concat_ws(' ',rr.first_name,rr.last_name),'')::text,
    rr.email::text,
    'project_milestones'::text
  from public.project_milestones m
  left join public.responsibility_roles rr on rr.id=m.responsibility_role_id
  where m.project_id=p_project_id
    and m.milestone_date is not null

  order by 4 nulls last,1,3;
end;
$$;

revoke all on function public.get_project_schedule_responsibility(uuid) from public;
grant execute on function public.get_project_schedule_responsibility(uuid) to authenticated;

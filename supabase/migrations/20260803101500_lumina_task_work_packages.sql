create table if not exists public.task_work_guides (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  objective text not null,
  rationale text,
  expected_result text not null,
  completion_note text,
  common_errors text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.task_work_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  title text not null,
  instruction text not null,
  required boolean not null default true,
  unique(task_id, step_number)
);

create table if not exists public.task_work_step_progress (
  step_id uuid not null references public.task_work_steps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(step_id, user_id)
);

alter table public.task_work_guides enable row level security;
alter table public.task_work_steps enable row level security;
alter table public.task_work_step_progress enable row level security;

create policy task_work_guides_access_select on public.task_work_guides
  for select to authenticated using(private.can_access_task(task_id));
create policy task_work_steps_access_select on public.task_work_steps
  for select to authenticated using(private.can_access_task(task_id));
create policy task_work_step_progress_self_select on public.task_work_step_progress
  for select to authenticated using(user_id=auth.uid());

revoke all on public.task_work_guides, public.task_work_steps, public.task_work_step_progress from anon;
grant select on public.task_work_guides, public.task_work_steps, public.task_work_step_progress to authenticated;

insert into public.task_work_guides(task_id,objective,rationale,expected_result,completion_note,common_errors)
select id,
  'Alle aktiven Rechnungsabgrenzungsposten zum Abschlussstichtag vollständig ermitteln, abstimmen und prüfbar dokumentieren.',
  'Aktive RAP grenzen Auszahlungen ab, die Aufwand eines späteren Zeitraums betreffen. Die Dokumentation muss den Bilanzansatz und seine periodengerechte Auflösung nachvollziehbar machen.',
  'Eine abgestimmte Excel-Aufstellung aller aktiven RAP mit Belegnachweisen, Kontenabstimmung, Laufzeiten und dokumentierter Auflösung im Folgejahr.',
  'Markieren Sie die Aufstellung und die wesentlichen Nachweise im Arbeitsbereich als finales Ergebnis und reichen Sie die Aufgabe anschließend bei KIRA ein.',
  array['Buchungsdatum statt Leistungszeitraum beurteilt','Kontensumme stimmt nicht mit Hauptbuch oder Saldenliste überein','Auflösung im Folgejahr fehlt','Wesentliche Positionen haben keinen Belegnachweis']
from public.tasks where source_number='82'
on conflict(task_id) do update set objective=excluded.objective,rationale=excluded.rationale,expected_result=excluded.expected_result,completion_note=excluded.completion_note,common_errors=excluded.common_errors,updated_at=now();

insert into public.task_work_guides(task_id,objective,rationale,expected_result,completion_note,common_errors)
select id,
  'Alle passiven Rechnungsabgrenzungsposten zum Abschlussstichtag vollständig ermitteln, abstimmen und prüfbar dokumentieren.',
  'Passive RAP grenzen Einzahlungen ab, die Ertrag eines späteren Zeitraums betreffen. Die Dokumentation muss den Bilanzansatz und seine periodengerechte Auflösung nachvollziehbar machen.',
  'Eine abgestimmte Excel-Aufstellung aller passiven RAP mit Vertrags- oder Belegnachweisen, Kontenabstimmung, Laufzeiten und dokumentierter Auflösung im Folgejahr.',
  'Markieren Sie die Aufstellung und die wesentlichen Nachweise im Arbeitsbereich als finales Ergebnis und reichen Sie die Aufgabe anschließend bei KIRA ein.',
  array['Zahlungseingang statt Leistungszeitraum beurteilt','Kontensumme stimmt nicht mit Hauptbuch oder Saldenliste überein','Auflösung im Folgejahr fehlt','Wesentliche Positionen haben keinen Vertrags- oder Belegnachweis']
from public.tasks where source_number='112'
on conflict(task_id) do update set objective=excluded.objective,rationale=excluded.rationale,expected_result=excluded.expected_result,completion_note=excluded.completion_note,common_errors=excluded.common_errors,updated_at=now();

insert into public.task_work_steps(task_id,step_number,title,instruction)
select t.id,v.n,v.title,v.instruction from public.tasks t cross join (values
  (1,'Konten und Vorjahr sichten','Öffnen Sie die RAP-Konten, die aktuelle Saldenliste und – sofern vorhanden – die finalen Vorjahresunterlagen.'),
  (2,'Vollständige Einzelaufstellung erstellen','Erfassen Sie je Position mindestens Vertragspartner, Beleg, Betrag, Zahlungsdatum, Leistungszeitraum und RAP-Betrag.'),
  (3,'Abgrenzung berechnen','Berechnen Sie den Anteil, der wirtschaftlich in das Folgejahr gehört, und dokumentieren Sie die Berechnungslogik.'),
  (4,'Mit Hauptbuch abstimmen','Stimmen Sie die Summe der Einzelaufstellung mit RAP-Konto, Hauptbuch und Saldenliste ab. Erläutern Sie jede Differenz.'),
  (5,'Nachweise beifügen','Laden Sie für wesentliche Positionen Rechnungen, Verträge, Zahlungsnachweise oder andere geeignete Belege hoch.'),
  (6,'Auflösung kontrollieren','Dokumentieren Sie Zeitpunkt und Buchungslogik der Auflösung im Folgejahr.'),
  (7,'Ergebnis finalisieren','Prüfen Sie die Vollständigkeit, kennzeichnen Sie die finale Aufstellung und ergänzen Sie eine kurze Erläuterung.'),
  (8,'Zur Prüfung übergeben','Reichen Sie die vollständige Arbeitsakte bei KIRA ein oder fordern Sie vorher Unterstützung durch KAI an.')
) as v(n,title,instruction)
where t.source_number in ('82','112')
on conflict(task_id,step_number) do update set title=excluded.title,instruction=excluded.instruction;

create or replace function public.get_task_work_package(p_task_id uuid)
returns jsonb
language sql stable security definer
set search_path=pg_catalog,public,private
as $$
  with current_task as (
    select t.*,p.reporting_date,p.company_id
    from public.tasks t join public.projects p on p.id=t.project_id
    where t.id=p_task_id and private.can_access_task(t.id)
  ), previous_task as (
    select pt.id,pt.source_number,pt.title,pp.reporting_date,pp.name as project_name
    from current_task c
    join public.projects pp on pp.company_id=c.company_id and pp.reporting_date<c.reporting_date
    join public.tasks pt on pt.project_id=pp.id and pt.source_number=c.source_number
    order by pp.reporting_date desc limit 1
  ), specialist as (
    select r.role_key,r.display_name,r.email,
      exists(select 1 from public.role_user_assignments a where a.role_id=r.id) as assigned
    from current_task c join public.responsibility_roles r on r.project_id=c.project_id
    where r.role_key like 'KAI%' or r.role_key like 'KIRA%'
  )
  select jsonb_build_object(
    'guide',(select to_jsonb(g) - 'task_id' from public.task_work_guides g where g.task_id=p_task_id),
    'steps',coalesce((select jsonb_agg((to_jsonb(s)-'task_id') || jsonb_build_object('completed',coalesce(pr.completed,false)) order by s.step_number)
      from public.task_work_steps s left join public.task_work_step_progress pr on pr.step_id=s.id and pr.user_id=auth.uid()
      where s.task_id=p_task_id),'[]'::jsonb),
    'previous_year',(select to_jsonb(previous_task) from previous_task),
    'previous_documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'display_name',d.display_name,'status',d.document_status,'created_at',d.created_at))
      from previous_task pt join public.documents d on d.task_id=pt.id and d.archived_at is null),'[]'::jsonb),
    'specialists',coalesce((select jsonb_agg(to_jsonb(specialist)) from specialist),'[]'::jsonb)
  )
  where exists(select 1 from current_task)
$$;

create or replace function public.set_task_work_step_completed(p_step_id uuid,p_completed boolean)
returns boolean
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare v_task_id uuid;
begin
  select task_id into v_task_id from public.task_work_steps where id=p_step_id;
  if v_task_id is null or not private.can_access_task(v_task_id) then raise exception 'Kein Zugriff auf diesen Arbeitsschritt'; end if;
  insert into public.task_work_step_progress(step_id,user_id,completed,completed_at,updated_at)
  values(p_step_id,auth.uid(),p_completed,case when p_completed then now() end,now())
  on conflict(step_id,user_id) do update set completed=excluded.completed,completed_at=excluded.completed_at,updated_at=now();
  return p_completed;
end
$$;

revoke all on function public.get_task_work_package(uuid) from public,anon;
revoke all on function public.set_task_work_step_completed(uuid,boolean) from public,anon;
grant execute on function public.get_task_work_package(uuid) to authenticated;
grant execute on function public.set_task_work_step_completed(uuid,boolean) to authenticated;

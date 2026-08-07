-- Pilot 202-Kacheln-Architektur, Schritt 2 von 7: mehrere Faelligkeiten je Kachel.
--
-- Hintergrund: In der PBC-Liste stehen 15 Massnahmen doppelt - inhaltlich identisch,
-- unterschiedlich nur in der Faelligkeit (Beginn Vorpruefung 2026-07-31 vs. Beginn
-- Hauptpruefung 2027-01-21). Betroffen sind vor allem die 14 Paare unter 3.0
-- (#1/#3, #2/#4, #5-#16 gegen #17-#28) sowie #64/#113 unter 4.5.
--
-- Entscheidung: eine Kachel je Massnahme mit mehreren Terminen, nicht zwei Kacheln.
-- Bei "eine Massnahme = ein Datenraum" waere eine zweite Kachel fuer dieselbe Aufgabe
-- ein zweiter Datenraum fuer dieselben Dateien.
--
-- tasks.due_date bleibt unangetastet. Diese Tabelle ist der Termintraeger der Kachel;
-- die Zusammenfuehrung der 3.0-Dubletten erfolgt spaeter in einem eigenen Schritt und
-- ist nicht Teil des 3.13-Piloten. 3.13 selbst ist dublettenfrei und bekommt hier
-- genau einen Termin je Massnahme - die Struktur steht damit trotzdem bereit.

create table if not exists public.process_step_due_dates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  process_step_id uuid not null references public.process_steps(id) on delete cascade,
  -- Stabiler Schluessel der Phase; der Anzeigetext steht in due_rule_label.
  phase_key text not null check (phase_key in ('vorpruefung', 'hauptpruefung', 'sonstige')),
  due_rule_label text,
  due_date date,
  due_date_override date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (process_step_id, phase_key)
);

create index if not exists process_step_due_dates_step_idx
  on public.process_step_due_dates(process_step_id, sort_order);

comment on table public.process_step_due_dates is
  'Termine je Prozessschritt. Mehrere Zeilen je Schritt sind der Normalfall (Vor- und Hauptpruefung), damit inhaltlich identische Massnahmen nicht als doppelte Kachel gefuehrt werden muessen.';
comment on column public.process_step_due_dates.due_date_override is
  'Manuell gesetzter Termin. Hat Vorrang vor due_date - gleiche Semantik wie tasks.due_date_override.';

alter table public.process_step_due_dates enable row level security;

-- Sichtbar fuer jeden, der den zugehoerigen Prozessschritt sehen darf.
-- Gleiche Regel wie process_step_guidance nach 20260806140000.
drop policy if exists step_due_dates_access_select on public.process_step_due_dates;
create policy step_due_dates_access_select on public.process_step_due_dates for select to authenticated
using(exists(
  select 1 from public.process_steps s
  where s.id = process_step_id
    and (private.is_project_member(s.project_id)
      or private.is_project_role_user(s.project_id)
      or exists(select 1 from public.tasks t where t.process_step_id = s.id and private.can_access_task(t.id)))));

grant select on public.process_step_due_dates to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.process_step_due_dates from authenticated;

-- ---------------------------------------------------------------------------
-- Befuellung fuer die 13 Massnahmen unter 3.13 aus den vorhandenen Aufgaben.
-- Alle 13 tragen "Beginn Hauptpruefung" zum 2027-01-21; die Werte werden nicht
-- hart kodiert, sondern aus tasks uebernommen, damit ein spaeter geaenderter
-- Projekttermin nicht auseinanderlaeuft.
--
-- Laeuft erst nach Schritt 4 vollstaendig, weil tasks.process_step_id bis dahin
-- noch auf 3.13 zeigt. Deshalb hier der Bezug ueber source_number statt ueber
-- den Schrittknoten - das funktioniert vor und nach dem Umhaengen.
-- ---------------------------------------------------------------------------
insert into public.process_step_due_dates
  (project_id, process_step_id, phase_key, due_rule_label, due_date, due_date_override, sort_order)
select
  leaf.project_id,
  leaf.id,
  case
    when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
    when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
    else 'sonstige'
  end,
  t.due_rule_label,
  t.due_date,
  t.due_date_override,
  0
from (values
  ('3.13.1.1', '96'), ('3.13.1.2', '97'),
  ('3.13.2.1', '98'), ('3.13.2.2', '99'), ('3.13.2.3', '100'), ('3.13.2.4', '101'),
  ('3.13.3.1', '105'), ('3.13.3.2', '106'), ('3.13.3.3', '107'), ('3.13.3.4', '108'),
  ('3.13.3.5', '109'), ('3.13.3.6', '110'), ('3.13.3.7', '111')
) as v(code, source_number)
join public.process_steps leaf on leaf.code = v.code
join public.tasks t
  on t.project_id = leaf.project_id
 and t.source_number = v.source_number
 and t.legacy_source_key like '%|3.13. %'
on conflict (process_step_id, phase_key) do update set
  due_rule_label = excluded.due_rule_label,
  due_date = excluded.due_date,
  due_date_override = excluded.due_date_override,
  updated_at = now();

do $$
declare
  v_row record;
begin
  for v_row in
    select leaf.project_id, count(d.id) as termine
    from public.process_steps leaf
    left join public.process_step_due_dates d on d.process_step_id = leaf.id
    where leaf.code ~ '^3\.13\.[0-9]+\.[0-9]+$'
    group by leaf.project_id
  loop
    if v_row.termine <> 13 then
      raise exception 'Projekt %: erwartet 13 Termine fuer die 3.13-Massnahmen, gefunden %.',
        v_row.project_id, v_row.termine;
    end if;
    raise notice 'Projekt %: 13 Termine fuer die 3.13-Massnahmen uebernommen.', v_row.project_id;
  end loop;
end $$;

-- Rollout Welle 2, Schritt 4: Termine der 23 Massnahmen.
--
-- Erstmals gemischte Phasen innerhalb einer Station: unter 3.5 liegen drei Massnahmen auf
-- "Beginn Vorpruefung" 2026-05-31 (#33, #34, #35), eine auf "Beginn Vorpruefung" 2026-07-31
-- (#41) und vier auf "Beginn Hauptpruefung" 2027-01-21. Die uebrigen Stationen der Welle
-- liegen einheitlich auf der Hauptpruefung.
--
-- Deshalb werden die Werte konsequent aus tasks uebernommen und nicht hart kodiert - der
-- Bezug laeuft ueber source_number und funktioniert vor wie nach dem Umhaengen.

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
  ('3.3.1.1','74'), ('3.3.1.2','75'), ('3.3.1.3','76'),
  ('3.3.2.1','102'), ('3.3.2.2','103'), ('3.3.2.3','104'),
  ('3.5.1.1','33'), ('3.5.1.2','34'), ('3.5.1.3','35'), ('3.5.1.4','65'),
  ('3.5.2','41'), ('3.5.3.1','66'), ('3.5.3.2','67'), ('3.5.4','134'),
  ('3.11.1.1','84'), ('3.11.1.2','85'), ('3.11.2','117'),
  ('3.16.1.1','68'), ('3.16.1.2','69'),
  ('3.16.2.1','78'), ('3.16.2.2','79'), ('3.16.2.3','80'), ('3.16.2.4','81')
) as v(code, source_number)
join public.process_steps leaf on leaf.code = v.code
join public.tasks t
  on t.project_id = leaf.project_id
 and t.source_number = v.source_number
on conflict (process_step_id, phase_key) do update set
  due_rule_label = excluded.due_rule_label,
  due_date = excluded.due_date,
  due_date_override = excluded.due_date_override,
  updated_at = now();

do $$
declare
  v_anzahl integer;
  v_ohne_datum integer;
begin
  select count(*) into v_anzahl
  from public.process_steps s
  join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code ~ '^3\.(3|5|11|16)\.[0-9]+(\.[0-9]+)?$'
    and not exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_anzahl <> 23 then
    raise exception 'Erwartet 23 Termine fuer Welle 2, gefunden %.', v_anzahl;
  end if;

  select count(*) into v_ohne_datum
  from public.process_steps s
  join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code ~ '^3\.(3|5|11|16)\.[0-9]+(\.[0-9]+)?$' and d.due_date is null;
  if v_ohne_datum > 0 then
    raise notice 'Hinweis: % Massnahme(n) der Welle 2 ohne Datum uebernommen.', v_ohne_datum;
  end if;

  raise notice 'Welle 2: 23 Termine uebernommen.';
end $$;

-- Rollout Welle 1, Schritt 4: Termine der sechs Massnahmen.
--
-- Alle sechs tragen genau einen Termin ("Beginn Hauptpruefung", 2027-01-21). Die Tabelle
-- traegt trotzdem mehrere Termine je Kachel - gebraucht wird das erst in Welle 3, wo die
-- 14 Dublettenpaare unter 3.0 zu je einer Kachel mit Vor- und Hauptpruefungstermin
-- zusammengefuehrt werden.
--
-- Die Werte werden aus tasks uebernommen statt hart kodiert, damit ein spaeter geaenderter
-- Projekttermin nicht auseinanderlaeuft. Der Bezug laeuft ueber source_number und
-- funktioniert dadurch vor und nach dem Umhaengen aus Schritt 3.

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
  ('3.6.1', '70'), ('3.6.2', '71'), ('3.6.3', '72'), ('3.6.4', '73'),
  ('3.9.1', '82'), ('3.9.2', '112')
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
begin
  select count(*) into v_anzahl
  from public.process_steps s
  join public.process_step_due_dates d on d.process_step_id = s.id
  where s.code ~ '^3\.(6|9)\.[0-9]+$';
  if v_anzahl <> 6 then
    raise exception 'Erwartet 6 Termine fuer Welle 1, gefunden %.', v_anzahl;
  end if;
  raise notice 'Welle 1: 6 Termine uebernommen.';
end $$;

-- ===========================================================================
-- Nachtrag: die 24 Aufgaben der Station 3.14 auf ihre Blattknoten umhaengen.
--
-- Beim 3.14-Piloten wurden seinerzeit process_steps, process_step_guidance und die
-- Subitems im Source-State fuer 3.14.1 bis 3.14.6 angelegt - der Repoint der Aufgaben
-- unterblieb aber, weil das Frontend die Zuordnung damals noch ueber den Titel-Praefix
-- herstellte und kein Fremdschluessel noetig war.
--
-- Seit der Umstellung auf process_steps als Wirbelsaeule faellt das auf: die 24 Aufgaben
-- zeigen weiter auf den Stationsknoten 3.14. Der hat Kinder und ist damit eine reine
-- Navigationsseite - die Aufgaben waren ueber die Kachel nicht mehr erreichbar, und die
-- sechs Blattkacheln standen ohne Aufgabe da. Genau diese beiden Symptome hat die
-- Audit-Abfrage gemeldet.
--
-- Zuordnung wie im urspruenglichen Plan (20260806170000, Kopfkommentar):
--     3 Umsatzerloese                     -> 3.14.1   #114-#116
--    10 Personalaufwand                   -> 3.14.2   #124-#133
--     4 Sonstige betriebliche Aufwendungen-> 3.14.3   #135-#138
--     5 Sonstige betriebliche Ertraege    -> 3.14.4   #118-#122
--     1 Zinsertraege u. ae.               -> 3.14.5   #139
--     1 Materialaufwand                   -> 3.14.6   #123
--
-- Die Luecken #117 und #134 sind kein Fehler: #117 gehoert zu 3.11, #134 zu 3.5.
--
-- Additiv, idempotent, mit Sicherung. Es wird ausschliesslich tasks.process_step_id
-- gesetzt; legacy_source_key und tasks.title bleiben unangetastet.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Sicherung der betroffenen Zuordnung. Nur solange noch etwas umzuhaengen ist -
-- ein Wiederholungslauf ueberschreibt die Sicherung des Vorzustands damit nicht.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.tasks t
    join public.process_steps s on s.id = t.process_step_id
    where s.code = '3.14'
  ) then
    drop table if exists public.tasks_process_step_backup_20260811;
    create table public.tasks_process_step_backup_20260811 as
    select id, project_id, source_number, process_step_id, legacy_source_key, now() as gesichert_am
    from public.tasks;
    raise notice 'Sicherung tasks_process_step_backup_20260811 neu angelegt.';
  else
    raise notice 'Keine Aufgabe haengt mehr an 3.14 - vorhandene Sicherung bleibt unveraendert.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- Vorpruefung: die sechs Blattknoten muessen existieren und Blaetter sein.
-- ---------------------------------------------------------------------------
do $$
declare
  v_knoten integer;
  v_keine_blaetter integer;
begin
  select count(*) into v_knoten
  from public.process_steps where code in ('3.14.1','3.14.2','3.14.3','3.14.4','3.14.5','3.14.6');
  if v_knoten <> 6 then
    raise exception 'Vorpruefung: erwartet 6 Knoten 3.14.1-3.14.6, gefunden %.', v_knoten;
  end if;

  select count(*) into v_keine_blaetter
  from public.process_steps s
  where s.code in ('3.14.1','3.14.2','3.14.3','3.14.4','3.14.5','3.14.6')
    and exists (select 1 from public.process_steps k where k.parent_id = s.id);
  if v_keine_blaetter > 0 then
    raise exception 'Vorpruefung: % der Knoten 3.14.x haben selbst Kinder.', v_keine_blaetter;
  end if;

  raise notice 'Vorpruefung ok: 6 Blattknoten unter 3.14 vorhanden.';
end $$;


-- ---------------------------------------------------------------------------
-- Umhaengen. Zuordnung ueber source_number, abgesichert ueber den Stationsteil
-- des legacy_source_key.
-- ---------------------------------------------------------------------------
update public.tasks t
set process_step_id = leaf.id, updated_at = now()
from (values
  -- Umsatzerlöse
  ('114','3.14.1'), ('115','3.14.1'), ('116','3.14.1'),
  -- Sonstige betriebliche Erträge
  ('118','3.14.4'), ('119','3.14.4'), ('120','3.14.4'), ('121','3.14.4'), ('122','3.14.4'),
  -- Materialaufwand
  ('123','3.14.6'),
  -- Personalaufwand
  ('124','3.14.2'), ('125','3.14.2'), ('126','3.14.2'), ('127','3.14.2'), ('128','3.14.2'),
  ('129','3.14.2'), ('130','3.14.2'), ('131','3.14.2'), ('132','3.14.2'), ('133','3.14.2'),
  -- Sonstige betriebliche Aufwendungen
  ('135','3.14.3'), ('136','3.14.3'), ('137','3.14.3'), ('138','3.14.3'),
  -- Zinserträge u. ä. (Finanzergebnis)
  ('139','3.14.5')
) as v(source_number, code)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|3.14. %'
  and t.process_step_id is distinct from leaf.id;


-- ---------------------------------------------------------------------------
-- Termine der sechs Kacheln nachziehen, damit der Datenbestand vollstaendig ist.
-- Hinweis: das Frontend liest process_step_due_dates derzeit nicht - die Anzeige
-- speist sich aus der Maßnahmenliste. Die Tabelle wird trotzdem gefuellt, damit sie
-- ueber alle Stationen denselben Stand hat.
-- ---------------------------------------------------------------------------
insert into public.process_step_due_dates
  (project_id, process_step_id, phase_key, due_rule_label, due_date, due_date_override, sort_order)
select distinct on (leaf.id, case when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
                                  when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
                                  else 'sonstige' end)
  leaf.project_id, leaf.id,
  case when t.due_rule_label ilike '%vorpr%' then 'vorpruefung'
       when t.due_rule_label ilike '%hauptpr%' then 'hauptpruefung'
       else 'sonstige' end,
  t.due_rule_label, t.due_date, t.due_date_override,
  case when t.due_rule_label ilike '%vorpr%' then 0 else 1 end
from public.tasks t
join public.process_steps leaf on leaf.id = t.process_step_id
where leaf.code in ('3.14.1','3.14.2','3.14.3','3.14.4','3.14.5','3.14.6')
on conflict (process_step_id, phase_key) do update set
  due_rule_label=excluded.due_rule_label, due_date=excluded.due_date,
  due_date_override=excluded.due_date_override, updated_at=now();


-- ---------------------------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------------------------
do $$
declare
  v_row record;
  v_an_station integer;
  v_ohne_aufgabe integer;
begin
  for v_row in
    select s.code, count(t.id) as anzahl
    from public.process_steps s
    left join public.tasks t on t.process_step_id = s.id
    where s.code in ('3.14.1','3.14.2','3.14.3','3.14.4','3.14.5','3.14.6')
    group by s.code order by s.code
  loop
    if (v_row.code = '3.14.1' and v_row.anzahl <> 3)
       or (v_row.code = '3.14.2' and v_row.anzahl <> 10)
       or (v_row.code = '3.14.3' and v_row.anzahl <> 4)
       or (v_row.code = '3.14.4' and v_row.anzahl <> 5)
       or (v_row.code = '3.14.5' and v_row.anzahl <> 1)
       or (v_row.code = '3.14.6' and v_row.anzahl <> 1) then
      raise exception 'Kachel % traegt % Aufgaben - erwartet 3/10/4/5/1/1 fuer 3.14.1 bis 3.14.6.',
        v_row.code, v_row.anzahl;
    end if;
  end loop;

  select count(*) into v_an_station
  from public.tasks t join public.process_steps s on s.id = t.process_step_id
  where s.code = '3.14';
  if v_an_station > 0 then
    raise exception '% Aufgabe(n) haengen weiterhin direkt an 3.14.', v_an_station;
  end if;

  select count(*) into v_ohne_aufgabe
  from public.process_steps s
  where s.code in ('3.14.1','3.14.2','3.14.3','3.14.4','3.14.5','3.14.6')
    and not exists (select 1 from public.tasks t where t.process_step_id = s.id);
  if v_ohne_aufgabe > 0 then
    raise exception '% der sechs 3.14-Kacheln ohne Aufgabe.', v_ohne_aufgabe;
  end if;

  raise notice '24 Aufgaben auf 3.14.1 bis 3.14.6 umgehaengt (3/10/4/5/1/1), keine mehr an der Station.';
end $$;

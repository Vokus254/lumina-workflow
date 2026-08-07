-- Rollout Welle 2, Schritt 3: die 23 Aufgaben an die Blattknoten haengen.
--
-- legacy_source_key und tasks.title bleiben unangetastet. Zuordnung ueber source_number
-- (ueber alle 202 Zeilen eindeutig), zusaetzlich abgesichert ueber den Stationsteil des
-- legacy_source_key.

update public.tasks t
set process_step_id = leaf.id,
    updated_at = now()
from (values
  -- 3.3
  ('74','3.3.1.1','3.3'), ('75','3.3.1.2','3.3'), ('76','3.3.1.3','3.3'),
  ('102','3.3.2.1','3.3'), ('103','3.3.2.2','3.3'), ('104','3.3.2.3','3.3'),
  -- 3.5
  ('33','3.5.1.1','3.5'), ('34','3.5.1.2','3.5'), ('35','3.5.1.3','3.5'), ('65','3.5.1.4','3.5'),
  ('41','3.5.2','3.5'), ('66','3.5.3.1','3.5'), ('67','3.5.3.2','3.5'), ('134','3.5.4','3.5'),
  -- 3.11
  ('84','3.11.1.1','3.11'), ('85','3.11.1.2','3.11'), ('117','3.11.2','3.11'),
  -- 3.16
  ('68','3.16.1.1','3.16'), ('69','3.16.1.2','3.16'),
  ('78','3.16.2.1','3.16'), ('79','3.16.2.2','3.16'), ('80','3.16.2.3','3.16'), ('81','3.16.2.4','3.16')
) as v(source_number, code, station)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|' || v.station || '. %'
  and t.process_step_id is distinct from leaf.id;

do $$
declare
  v_row record;
begin
  for v_row in
    select
      root.project_id,
      root.code as station,
      (select count(*) from public.tasks t
         join public.process_steps s on s.id = t.process_step_id
        where t.project_id = root.project_id
          and s.code like root.code || '.%'
          and not exists (select 1 from public.process_steps k where k.parent_id = s.id)) as an_blaettern,
      (select count(*) from public.tasks t
        where t.project_id = root.project_id and t.process_step_id = root.id) as noch_an_station,
      (select count(*) from public.process_steps s
        where s.project_id = root.project_id
          and s.code like root.code || '.%'
          and not exists (select 1 from public.process_steps k where k.parent_id = s.id)
          and not exists (select 1 from public.tasks t where t.process_step_id = s.id)) as blaetter_ohne_aufgabe
    from public.process_steps root
    where root.code in ('3.3', '3.5', '3.11', '3.16')
  loop
    if (v_row.station = '3.3'  and v_row.an_blaettern <> 6)
       or (v_row.station = '3.5'  and v_row.an_blaettern <> 8)
       or (v_row.station = '3.11' and v_row.an_blaettern <> 3)
       or (v_row.station = '3.16' and v_row.an_blaettern <> 6) then
      raise exception 'Projekt %, Station %: % Aufgaben an den Massnahmen - unerwartet.',
        v_row.project_id, v_row.station, v_row.an_blaettern;
    end if;
    if v_row.noch_an_station > 0 then
      raise exception 'Projekt %, Station %: % Aufgabe(n) haengen weiterhin direkt an der Station.',
        v_row.project_id, v_row.station, v_row.noch_an_station;
    end if;
    if v_row.blaetter_ohne_aufgabe > 0 then
      raise exception 'Projekt %, Station %: % Massnahmenkachel(n) ohne Aufgabe.',
        v_row.project_id, v_row.station, v_row.blaetter_ohne_aufgabe;
    end if;
    raise notice 'Projekt %, Station %: % Aufgaben umgehaengt.', v_row.project_id, v_row.station, v_row.an_blaettern;
  end loop;
end $$;

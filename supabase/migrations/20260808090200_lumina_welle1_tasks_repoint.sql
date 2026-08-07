-- Rollout Welle 1, Schritt 3: die sechs Aufgaben an die Blattknoten haengen.
--
-- Danach zeigt jede Aufgabe auf genau ihre Massnahme. Erst dadurch gilt auch hier
-- "eine Massnahme = ein Datenraum": documents.task_id fuehrt eindeutig auf eine Kachel,
-- und die Blattkachel oeffnet das Aufgaben-Modal statt einer eigenen Seite.
--
-- legacy_source_key bleibt unangetastet - es ist die Spur zur Ursprungszeile der
-- PBC-Liste. tasks.title (die Kategorie) bleibt ebenfalls stehen; der Kachelname kommt
-- aus process_steps.name.
--
-- Zuordnung ueber source_number: die Nummern sind ueber alle 202 Zeilen eindeutig,
-- zusaetzlich abgesichert ueber den Stationsteil des legacy_source_key.

update public.tasks t
set process_step_id = leaf.id,
    updated_at = now()
from (values
  ('70',  '3.6.1'), ('71',  '3.6.2'), ('72',  '3.6.3'), ('73',  '3.6.4'),
  ('82',  '3.9.1'), ('112', '3.9.2')
) as v(source_number, code)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|' || split_part(v.code, '.', 1) || '.' || split_part(v.code, '.', 2) || '. %'
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
        where t.project_id = root.project_id and s.parent_id = root.id) as an_blaettern,
      (select count(*) from public.tasks t
        where t.project_id = root.project_id and t.process_step_id = root.id) as noch_an_station,
      (select count(*) from public.process_steps s
        where s.parent_id = root.id
          and not exists (select 1 from public.tasks t where t.process_step_id = s.id)) as blaetter_ohne_aufgabe
    from public.process_steps root
    where root.code in ('3.6', '3.9')
  loop
    if (v_row.station = '3.6' and v_row.an_blaettern <> 4)
       or (v_row.station = '3.9' and v_row.an_blaettern <> 2) then
      raise exception 'Projekt %, Station %: % Aufgaben an den Massnahmen, erwartet 4 bzw. 2.',
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

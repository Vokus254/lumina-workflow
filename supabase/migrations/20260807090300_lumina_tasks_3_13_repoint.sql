-- Pilot 202-Kacheln-Architektur, Schritt 4 von 7: die 13 Aufgaben an die Blattknoten haengen.
--
-- Bisher zeigen alle 13 Aufgaben auf den Stationsknoten 3.13. Danach zeigt jede Aufgabe
-- auf genau ihre Massnahme (3.13.x.y). Erst dadurch gilt "eine Massnahme = ein Datenraum":
-- documents.task_id fuehrt dann eindeutig auf eine Kachel.
--
-- legacy_source_key bleibt unangetastet - es ist die Spur zur Ursprungszeile der PBC-Liste
-- und damit der einzige verbleibende Beleg fuer die urspruengliche Zuordnung.
-- tasks.title (die Kategorie) bleibt ebenfalls stehen; der Kachelname kommt ab jetzt aus
-- process_steps.name, nicht mehr aus der Aufgabe.
--
-- Zuordnung ueber source_number: die Nummern sind ueber alle 202 Zeilen eindeutig
-- (geprueft), zusaetzlich abgesichert ueber den Stationsteil des legacy_source_key.

update public.tasks t
set process_step_id = leaf.id,
    updated_at = now()
from (values
  ('96',  '3.13.1.1'), ('97',  '3.13.1.2'),
  ('98',  '3.13.2.1'), ('99',  '3.13.2.2'), ('100', '3.13.2.3'), ('101', '3.13.2.4'),
  ('105', '3.13.3.1'), ('106', '3.13.3.2'), ('107', '3.13.3.3'), ('108', '3.13.3.4'),
  ('109', '3.13.3.5'), ('110', '3.13.3.6'), ('111', '3.13.3.7')
) as v(source_number, code)
join public.process_steps leaf on leaf.code = v.code
where t.project_id = leaf.project_id
  and t.source_number = v.source_number
  and t.legacy_source_key like '%|3.13. %'
  and t.process_step_id is distinct from leaf.id;

-- ---------------------------------------------------------------------------
-- Kontrolle: alle 13 Aufgaben haengen an einem Blattknoten, keine mehr direkt an 3.13,
-- und jede Massnahmenkachel traegt genau eine Aufgabe.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row record;
begin
  for v_row in
    select
      root.project_id,
      (select count(*) from public.tasks t
         join public.process_steps s on s.id = t.process_step_id
        where t.project_id = root.project_id and s.code ~ '^3\.13\.[0-9]+\.[0-9]+$') as an_blaettern,
      (select count(*) from public.tasks t
        where t.project_id = root.project_id and t.process_step_id = root.id) as noch_an_3_13,
      (select count(*) from public.process_steps s
        where s.project_id = root.project_id
          and s.code ~ '^3\.13\.[0-9]+\.[0-9]+$'
          and not exists (select 1 from public.tasks t where t.process_step_id = s.id)) as blaetter_ohne_aufgabe
    from public.process_steps root
    where root.code = '3.13'
  loop
    if v_row.an_blaettern <> 13 then
      raise exception 'Projekt %: erwartet 13 Aufgaben an den 3.13-Massnahmen, gefunden %.',
        v_row.project_id, v_row.an_blaettern;
    end if;
    if v_row.noch_an_3_13 > 0 then
      raise exception 'Projekt %: % Aufgabe(n) haengen weiterhin direkt an 3.13.',
        v_row.project_id, v_row.noch_an_3_13;
    end if;
    if v_row.blaetter_ohne_aufgabe > 0 then
      raise exception 'Projekt %: % Massnahmenkachel(n) ohne Aufgabe.',
        v_row.project_id, v_row.blaetter_ohne_aufgabe;
    end if;
    raise notice 'Projekt %: 13 Aufgaben auf die Massnahmenkacheln umgehaengt.', v_row.project_id;
  end loop;
end $$;

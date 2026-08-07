-- Rollout Welle 1 von 3: Stationen 3.6 und 3.9.
--
-- Beide Stationen haben keine Kategorieebene. Nach der Rollout-Regel entfaellt sie
-- ueberall dort, wo sie keine Verzweigung brachte:
--   3.6 hat genau eine Kategorie ("Forderungen L+L", 4 Massnahmen) - der Zwischenknoten
--       haette den Stationsnamen wiederholt und einen Klick ohne Information gekostet.
--   3.9 hat zwei Kategorien mit je genau einer Massnahme - Kategorie und Massnahme
--       waeren dieselbe Sache in zwei Ebenen gewesen.
-- Die Massnahmen haengen deshalb direkt unter der Station: 3.6.1-3.6.4 und 3.9.1-3.9.2.
--
-- Namensgebung: sonst traegt ein Blatt den Anforderungstext aus der PBC-Liste. Bei 3.9
-- sind die beiden Texte fast identisch ("... abgegrenzte Aufwendungen" vs. "... Ertraege")
-- und unterscheiden sich erst nach 50 Zeichen. Dort traegt das Blatt deshalb den
-- Kategorienamen ("Aktive RAP" / "Passive RAP") - er ist die eigentliche Unterscheidung.
-- Der volle Anforderungstext steht in der Anleitung (Schritt 2 dieser Welle).
--
-- Idempotent: on conflict (project_id, code).

insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select
  parent.project_id,
  parent.id,
  v.code,
  v.name,
  v.sort_order,
  'taxonomy:' || v.code
from (values
  -- 3.6 Vorbereitung Forderungen L+L
  ('3.6', '3.6.1', 'Saldenliste inkl. kreditorischer Debitoren', 0),                                                        -- src 70
  ('3.6', '3.6.2', 'Offene Posten Liste zum Bilanzstichtag inkl. Altersstruktur', 1),                                       -- src 71
  ('3.6', '3.6.3', 'Offene Posten Liste zum Prüfungszeitpunkt inkl. Altersstruktur (mit Eingrenzung der Forderungen bis zum Bilanzstichtag)', 2), -- src 72
  ('3.6', '3.6.4', 'Entwicklung und Berechnung der Einzel- und Pauschalwertberichtigungen', 3),                             -- src 73
  -- 3.9 Vorbereitung Rechnungsabgrenzungen
  ('3.9', '3.9.1', 'Aktive RAP', 0),                                                                                        -- src 82
  ('3.9', '3.9.2', 'Passive RAP', 1)                                                                                        -- src 112
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  sort_order = excluded.sort_order,
  legacy_source_key = excluded.legacy_source_key;

do $$
declare
  v_row record;
begin
  for v_row in
    select
      root.project_id,
      root.code as station,
      count(*) filter (where child.parent_id = root.id) as blaetter,
      count(*) filter (where child.parent_id is null) as ohne_parent
    from public.process_steps root
    join public.process_steps child
      on child.project_id = root.project_id
     and child.code like root.code || '.%'
    where root.code in ('3.6', '3.9')
    group by root.project_id, root.code
  loop
    if (v_row.station = '3.6' and v_row.blaetter <> 4)
       or (v_row.station = '3.9' and v_row.blaetter <> 2) then
      raise exception 'Projekt %, Station %: unerwartete Blattzahl %.',
        v_row.project_id, v_row.station, v_row.blaetter;
    end if;
    if v_row.ohne_parent > 0 then
      raise exception 'Projekt %, Station %: % Knoten ohne parent_id.',
        v_row.project_id, v_row.station, v_row.ohne_parent;
    end if;
    raise notice 'Projekt %, Station %: % Massnahmen angelegt.', v_row.project_id, v_row.station, v_row.blaetter;
  end loop;
end $$;

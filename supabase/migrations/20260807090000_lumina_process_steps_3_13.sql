-- Pilot 202-Kacheln-Architektur, Schritt 1 von 7: die Hierarchie unter 3.13.
--
-- Zielbild: 3.13 (Station) -> 3.13.1/.2/.3 (Kategorie) -> 3.13.x.y (einzelne Massnahme).
-- Damit bekommt jede der 13 Massnahmen einen eigenen Knoten und kann eine eigene
-- Anleitung, einen eigenen Datenraum und eigene Kommentare tragen.
--
-- WICHTIG - Unterschied zum 3.14-Piloten:
--   Bei 3.14 lagen die Unter-Kacheln als Subitems in project_source_states.state und
--   waren nur ueber den Titel-Praefix mit process_steps verknuepft. Ein umbenannter
--   Titel haette die Anleitung lautlos abgehaengt. Hier ist process_steps die Wirbelsaeule:
--   die Kinder haengen ueber parent_id, nicht ueber eine Zeichenkette. Schritt 7 leert
--   die Subitems im State entsprechend.
--
-- parent_id wird bewusst explizit gesetzt und nicht aus dem Code abgeleitet. Das
-- Importskript (scripts/prepare_supabase_import.mjs) bestimmt den Elternknoten ueber
-- code.split(".")[0] - fuer "3.13.1.1" ergaebe das faelschlich "3".
--
-- Idempotent: on conflict (project_id, code). Laeuft in jedem Projekt, das eine 3.13 hat.

-- ---------------------------------------------------------------------------
-- 1. Kategorieebene: 3.13.1 bis 3.13.3
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select
  s.project_id,
  s.id,
  v.code,
  v.name,
  v.sort_order,
  'taxonomy:' || v.code
from public.process_steps s
cross join (values
  ('3.13.1', 'Verbindlichkeiten ggü. Kreditinstituten', 0),
  ('3.13.2', 'Verbindlichkeiten aus Lieferungen und Leistungen', 1),
  ('3.13.3', 'Sonstige Verbindlichkeiten', 2)
) as v(code, name, sort_order)
where s.code = '3.13'
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  sort_order = excluded.sort_order,
  legacy_source_key = excluded.legacy_source_key;

-- ---------------------------------------------------------------------------
-- 2. Massnahmenebene: 3.13.1.1 bis 3.13.3.7
--    name = der Anforderungstext aus der PBC-Liste (tasks.required_documents_text),
--    damit Kachel und Aufgabe unverwechselbar zusammengehoeren. Die Zuordnung zur
--    urspruenglichen Zeilennummer steht als Kommentar und wandert in Schritt 4
--    ueber tasks.source_number in die Verknuepfung.
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select
  parent.project_id,
  parent.id,
  v.code,
  v.name,
  v.sort_order,
  'taxonomy:' || v.code
from (values
  -- 3.13.1 Verbindlichkeiten ggü. Kreditinstituten
  ('3.13.1', '3.13.1.1', 'Ergänzende Übersicht der Restlaufzeit (bis 1 Jahr, 1-5 Jahre, > 5 Jahre)', 0),           -- src 96
  ('3.13.1', '3.13.1.2', 'Laufende Kontokorrente (Bankauszüge, Saldenbestätigung, Besicherung)', 1),               -- src 97
  -- 3.13.2 Verbindlichkeiten aus Lieferungen und Leistungen
  ('3.13.2', '3.13.2.1', 'Saldenliste inkl. debitorischer Kreditoren', 0),                                          -- src 98
  ('3.13.2', '3.13.2.2', 'Offene Posten Liste zum Bilanzstichtag', 1),                                              -- src 99
  ('3.13.2', '3.13.2.3', 'Offene Posten Liste zum Prüfungszeitpunkt (mit Eingrenzung der Verbindlichkeiten bis zum Bilanzstichtag)', 2), -- src 100
  ('3.13.2', '3.13.2.4', 'Ordner Lieferantenrechnungen Dezember bis März', 3),                                      -- src 101
  -- 3.13.3 Sonstige Verbindlichkeiten
  ('3.13.3', '3.13.3.1', 'Zusammensetzung und Aufgliederung der Sonstigen Verbindlichkeiten (falls keine Kontenaufgliederung besteht)', 0), -- src 105
  ('3.13.3', '3.13.3.2', 'Aufgliederung von Sammelkonten (z.B. Mietkautionen)', 1),                                 -- src 106
  ('3.13.3', '3.13.3.3', 'Übersicht Entwicklung der Verbindlichkeiten aus Mietkauf', 2),                            -- src 107
  ('3.13.3', '3.13.3.4', 'Übersicht Entwicklung der Verbindlichkeiten aus noch nicht verwendeten Projektförderungen', 3), -- src 108
  ('3.13.3', '3.13.3.5', 'Nachweis Sozialversicherungsbeträge und Lohnsteuer Dez. Berichtsjahr (Anmeldungen an FA bzw. Krankenkassen, Zahlungsbeleg)', 4), -- src 109
  ('3.13.3', '3.13.3.6', 'Aufstellung/Beleg über Zusatzversorgungen', 5),                                           -- src 110
  ('3.13.3', '3.13.3.7', 'Aufstellung über die Verbindlichkeiten aus der Umsatzsteuer zu den dazugehörigen Konten', 6) -- src 111
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  sort_order = excluded.sort_order,
  legacy_source_key = excluded.legacy_source_key;

-- ---------------------------------------------------------------------------
-- 3. Kontrolle: je Projekt mit 3.13 muessen 3 Kategorien und 13 Massnahmen stehen,
--    und jeder neue Knoten muss den richtigen Elternknoten haben.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row record;
begin
  for v_row in
    select
      root.project_id,
      count(*) filter (where child.code ~ '^3\.13\.[0-9]+$') as kategorien,
      count(*) filter (where child.code ~ '^3\.13\.[0-9]+\.[0-9]+$') as massnahmen,
      count(*) filter (where child.parent_id is null) as ohne_parent
    from public.process_steps root
    join public.process_steps child
      on child.project_id = root.project_id
     and child.code like '3.13.%'
    where root.code = '3.13'
    group by root.project_id
  loop
    if v_row.kategorien <> 3 or v_row.massnahmen <> 13 then
      raise exception 'Projekt %: erwartet 3 Kategorien und 13 Massnahmen unter 3.13, gefunden % und %.',
        v_row.project_id, v_row.kategorien, v_row.massnahmen;
    end if;
    if v_row.ohne_parent > 0 then
      raise exception 'Projekt %: % Knoten unter 3.13 ohne parent_id.', v_row.project_id, v_row.ohne_parent;
    end if;
    raise notice 'Projekt %: 3 Kategorien und 13 Massnahmen unter 3.13 angelegt.', v_row.project_id;
  end loop;
end $$;

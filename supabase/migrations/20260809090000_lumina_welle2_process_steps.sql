-- Rollout Welle 2 von 3: Stationen 3.3, 3.5, 3.11 und 3.16 (23 Aufgaben).
--
-- Erstmals gemischte Tiefe innerhalb einer Station. Die Kategorieebene bleibt, wo sie
-- verzweigt, und entfaellt, wo sie nur eine Massnahme traege:
--
--   3.3   3.3.1 Forderungen Verbundbereich (3)      3.3.2 Verbindlichkeiten Verbundbereich (3)
--   3.5   3.5.1 Anlagevermoegen (4)                 3.5.2 Massnahme direkt (#41)
--         3.5.3 Finanzanlagen (2)                   3.5.4 Massnahme direkt (#134)
--   3.11  3.11.1 Sonderposten (2)                   3.11.2 Massnahme direkt (#117)
--   3.16  3.16.1 Vorraete (2)                       3.16.2 Liquide Mittel (4)
--
-- Kategorieknoten und Blattknoten stehen dadurch nebeneinander auf derselben Ebene.
-- Das Frontend unterscheidet sie an der Kinderzahl: ein Knoten mit Kindern oeffnet die
-- Navigationsseite, ein Blatt mit Aufgabe das Aufgaben-Modal.
--
-- Namensgebung der Blaetter: der Anforderungstext aus der PBC-Liste. Der Kategoriename
-- kommt nur dort zum Zug, wo die Anforderungstexte einander zum Verwechseln aehneln -
-- in dieser Welle ist das nirgends der Fall (anders als bei 3.9 in Welle 1).
--
-- Idempotent: on conflict (project_id, code).

-- ---------------------------------------------------------------------------
-- Ebene 2: Kategorien und die drei direkt haengenden Massnahmen.
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  ('3.3',  '3.3.1',  'Forderungen Verbundbereich', 0),
  ('3.3',  '3.3.2',  'Verbindlichkeiten Verbundbereich', 1),
  ('3.5',  '3.5.1',  'Anlagevermögen', 0),
  ('3.5',  '3.5.2',  'Besprechung und Einsichtnahme der Stichproben zum AV', 1),                       -- src 41
  ('3.5',  '3.5.3',  'Finanzanlagen', 2),
  ('3.5',  '3.5.4',  'Auflistung der außerplanmäßigen Abschreibungen', 3),                             -- src 134
  ('3.11', '3.11.1', 'Sonderposten', 0),
  ('3.11', '3.11.2', 'Aktuelle Zuschussbescheide im Berichtsjahr (Zuschüsse, Bankbelege, Abschlagszahlungen)', 1), -- src 117
  ('3.16', '3.16.1', 'Vorräte', 0),
  ('3.16', '3.16.2', 'Liquide Mittel', 1)
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id, name = excluded.name,
  sort_order = excluded.sort_order, legacy_source_key = excluded.legacy_source_key;

-- ---------------------------------------------------------------------------
-- Ebene 3: Massnahmen unterhalb der Kategorien.
-- ---------------------------------------------------------------------------
insert into public.process_steps (project_id, parent_id, code, name, sort_order, legacy_source_key)
select parent.project_id, parent.id, v.code, v.name, v.sort_order, 'taxonomy:' || v.code
from (values
  -- 3.3.1 Forderungen Verbundbereich
  ('3.3.1', '3.3.1.1', 'Abstimmung von Forderungen an Unternehmen im Verbundbereich', 0),              -- src 74
  ('3.3.1', '3.3.1.2', 'Ergänzende Übersicht über die Restlaufzeiten', 1),                             -- src 75
  ('3.3.1', '3.3.1.3', 'Aufstellung der Forderungen in LuL und Liquidität unterteilt', 2),             -- src 76
  -- 3.3.2 Verbindlichkeiten Verbundbereich
  ('3.3.2', '3.3.2.1', 'Abstimmung von Verbindlichkeiten an Unternehmen im Verbundbereich', 0),        -- src 102
  ('3.3.2', '3.3.2.2', 'Aufstellung der Verbindlichkeiten in LuL und Liquidität unterteilt', 1),       -- src 103
  ('3.3.2', '3.3.2.3', 'Ergänzende Übersicht über die Restlaufzeiten', 2),                             -- src 104
  -- 3.5.1 Anlagevermögen
  ('3.5.1', '3.5.1.1', 'Anlagenspiegel/-gitter (Umbuchung, Zugang, Abgang, AfA); inkl. Aufstellung Buchgewinne oder Buchverlust', 0), -- src 33
  ('3.5.1', '3.5.1.2', 'Anlagen im Bau: Übersicht und Unterlagen über die Entwicklung (Vortrag, Umbuchung, Zugang, Abgang, Endstand)', 1), -- src 34
  ('3.5.1', '3.5.1.3', 'Investitionsplan des Berichts- und Folgejahr', 2),                             -- src 35
  ('3.5.1', '3.5.1.4', 'Aktualisierung/Ergänzung der Vorprüfung', 3),                                  -- src 65
  -- 3.5.3 Finanzanlagen
  ('3.5.3', '3.5.3.1', 'Unterlagen über Wertpapiere (Kauf- bzw. Verkaufsunterlagen, Bankbestätigungen bzw. Saldennachweis für Spareinlagen, Geschäftsanteile, Ausleihungen, Kurs zum 31.12.)', 0), -- src 66
  ('3.5.3', '3.5.3.2', 'Berechnung der Abschreibungen auf Wertpapiere', 1),                            -- src 67
  -- 3.11.1 Sonderposten
  ('3.11.1', '3.11.1.1', 'Entwicklung der Sonderposten mit Anlagennachweis (nach Finanzierungsarten abgestimmt)', 0), -- src 84
  ('3.11.1', '3.11.1.2', 'Aktualisierung/Ergänzung Vorprüfung: Bescheide für im Berichtsjahr neu hinzugekommene Güter im Sonderposten', 1), -- src 85
  -- 3.16.1 Vorräte
  ('3.16.1', '3.16.1.1', 'Bewertete Inventurunterlagen (abgestimmt mit Fibu und Mawi)', 0),            -- src 68
  ('3.16.1', '3.16.1.2', 'Altersstrukturliste; Niederstwerttest inkl. Nachweisen', 1),                 -- src 69
  -- 3.16.2 Liquide Mittel
  ('3.16.2', '3.16.2.1', 'Kassenaufnahmeprotokolle und Kassenbücher (31.12. und 1.1.)', 0),            -- src 78
  ('3.16.2', '3.16.2.2', 'Bankauszüge zum Bilanzstichtag', 1),                                         -- src 79
  ('3.16.2', '3.16.2.3', 'Übersicht über Festgeldanlagen (Betrag, Zins, Laufzeit) und Abgrenzung zum Stichtag', 2), -- src 80
  ('3.16.2', '3.16.2.4', 'Nachweise bei Kontenschließungen', 3)                                        -- src 81
) as v(parent_code, code, name, sort_order)
join public.process_steps parent on parent.code = v.parent_code
on conflict (project_id, code) do update set
  parent_id = excluded.parent_id, name = excluded.name,
  sort_order = excluded.sort_order, legacy_source_key = excluded.legacy_source_key;

do $$
declare
  v_row record;
begin
  for v_row in
    select s.project_id,
      count(*) filter (where s.code ~ '^3\.(3|5|11|16)\.[0-9]+$') as ebene2,
      count(*) filter (where s.code ~ '^3\.(3|5|11|16)\.[0-9]+\.[0-9]+$') as ebene3,
      count(*) filter (where s.parent_id is null) as ohne_parent
    from public.process_steps s
    where s.code ~ '^3\.(3|5|11|16)\.[0-9]+(\.[0-9]+)?$'
    group by s.project_id
  loop
    if v_row.ebene2 <> 10 or v_row.ebene3 <> 20 then
      raise exception 'Projekt %: erwartet 10 Knoten auf Ebene 2 und 20 auf Ebene 3, gefunden % und %.',
        v_row.project_id, v_row.ebene2, v_row.ebene3;
    end if;
    if v_row.ohne_parent > 0 then
      raise exception 'Projekt %: % Knoten ohne parent_id.', v_row.project_id, v_row.ohne_parent;
    end if;
    raise notice 'Projekt %: Welle 2 mit 30 Knoten angelegt (10 Ebene 2, 20 Ebene 3, davon 23 Blaetter).', v_row.project_id;
  end loop;
end $$;

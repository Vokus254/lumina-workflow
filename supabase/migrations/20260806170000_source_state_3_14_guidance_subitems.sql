-- Kachel 3.14 bekommt sechs Unter-Kacheln (dritte Hierarchieebene).
--
-- Die Kacheln entstehen nicht aus process_steps, sondern aus project_source_states.state.
-- process_steps und process_step_guidance fuer 3.14.1 bis 3.14.6 sind bereits live vorhanden;
-- diese Migration erzeugt ausschliesslich die passenden Subitems im Source-State. Die
-- Verknuepfung laeuft ueber den Titel-Praefix (guidanceStepCode im Frontend), deshalb tragen
-- die Subitems nur Code und Namen - keine IDs, keine parallelen Daten.
--
-- Ersetzt werden die 24 reinen Kategoriekarten unter state[2].measures[14] (alle done:false,
-- keine PBC- oder Formulardaten). Live-Positionen bestaetigt: station_idx 2, measure_idx 14.
--
-- Zuordnung alt -> neu:
--   subitem 0-2   Umsatzerloese (3)                      -> 3.14.1
--   subitem 3-7   Sonstige betriebliche Ertraege (5)     -> 3.14.4
--   subitem 8     Materialaufwand (1)                    -> 3.14.6
--   subitem 9-18  Personalaufwand (10)                   -> 3.14.2
--   subitem 19-22 Sonstige betrieblichen Aufwendungen (4)-> 3.14.3
--   subitem 23    Zinsertraege u.ae. (1)                 -> 3.14.5 Finanzergebnis

-- Sicherung vor dem Schreiben. Bleibt bewusst stehen, bis der Live-Klicktest durch ist.
create table if not exists public.project_source_states_backup_20260806 as
select * from public.project_source_states;

do $$
declare
  v_row record;
  v_measure jsonb;
  v_titel text;
  v_anzahl integer;
  v_neu jsonb;
  v_subitems constant jsonb := $subitems$[
    {"text":"3.14.1 Umsatzerlöse","done":false,"type":"guidance","data":{}},
    {"text":"3.14.2 Personalaufwand","done":false,"type":"guidance","data":{}},
    {"text":"3.14.3 Sonstige betriebliche Aufwendungen","done":false,"type":"guidance","data":{}},
    {"text":"3.14.4 Sonstige betriebliche Erträge","done":false,"type":"guidance","data":{}},
    {"text":"3.14.5 Finanzergebnis","done":false,"type":"guidance","data":{}},
    {"text":"3.14.6 Materialaufwand","done":false,"type":"guidance","data":{}}
  ]$subitems$::jsonb;
begin
  for v_row in select project_id, state from public.project_source_states loop
    v_measure := v_row.state #> array['2','measures','14'];

    if v_measure is null then
      raise exception 'Pfad state[2].measures[14] fehlt (Projekt %). Nichts geaendert.', v_row.project_id;
    end if;

    v_titel := v_measure ->> 'title';
    if v_titel is null or v_titel not like '3.14.%' then
      raise exception 'state[2].measures[14] ist nicht 3.14, sondern "%" (Projekt %). Nichts geaendert.',
        coalesce(v_titel, '<ohne Titel>'), v_row.project_id;
    end if;

    v_anzahl := jsonb_array_length(v_measure -> 'subitems');

    -- Bereits migriert: erneuter Lauf darf nicht scheitern (supabase db push ist wiederholbar).
    if v_anzahl = 6 and (v_measure #>> array['subitems','0','text']) like '3.14.1%' then
      raise notice 'Projekt %: Unter-Kacheln 3.14.1-3.14.6 bereits vorhanden, uebersprungen.', v_row.project_id;
      continue;
    end if;

    if v_anzahl <> 24 then
      raise exception 'Erwartet 24 Kategoriekarten unter 3.14, gefunden % (Projekt %). Nichts geaendert.',
        v_anzahl, v_row.project_id;
    end if;

    v_neu := jsonb_set(v_row.state, array['2','measures','14','subitems'], v_subitems, false);

    update public.project_source_states
    set state = v_neu,
        -- sha256() ist eingebaut, pgcrypto wird nicht benoetigt.
        source_sha256 = encode(sha256(v_neu::text::bytea), 'hex'),
        updated_at = now()
    where project_id = v_row.project_id;

    raise notice 'Projekt %: 24 Kategoriekarten durch 6 Guidance-Unterkacheln ersetzt.', v_row.project_id;
  end loop;
end $$;

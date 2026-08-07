-- Pilot 202-Kacheln-Architektur, Schritt 7 von 7: die Hierarchie aus dem State entfernen.
--
-- Das ist der eigentliche Test des Piloten. Bisher standen die Unter-Kacheln als Subitems
-- im JSONB und waren nur ueber den Titel-Praefix mit process_steps verbunden
-- (guidanceStepCode in public/legacy/lumina.html). Ab hier gilt:
--
--   Hierarchie  -> process_steps.parent_id      (Schritt 1)
--   Inhalte     -> process_step_guidance        (Schritt 3)
--   Aufgaben    -> tasks.process_step_id        (Schritt 4)
--   Fortschritt -> project_source_states.state  (nur noch hier)
--
-- Die 13 Kategoriekarten unter state[2].measures[13] entfallen ersatzlos. An ihre Stelle
-- tritt ein Feld am Measure-Objekt:
--   stepSource   = 'process_steps'  Marker fuer das Frontend: Kinder aus process_steps
--                                   laden, nicht aus subitems.
--
-- Hinweis: Das Frontend wertet stepSource nicht aus. Die Weiche ist datengetrieben -
-- eine Kachel rendert aus process_steps, sobald sie dort Kinder hat. Der Marker bleibt
-- als Dokumentation der Absicht stehen.
--
-- Ein urspruenglich vorgesehenes Feld stepProgress entfaellt: der Anleitungs-Fortschritt
-- liegt seit 20260807140000 serverseitig in process_step_guidance_progress und nicht mehr
-- im State.
--
-- ACHTUNG - Kopplung an das Frontend:
--   Diese Migration allein macht die Kachel 3.13 im Cockpit leer, weil das Frontend
--   heute nur subitems rendert. Sie darf erst zusammen mit der Frontend-Aenderung
--   ausgerollt werden, die stepSource auswertet. Die Schritte 1 bis 6 sind davon
--   unabhaengig und koennen vorher laufen.

-- ---------------------------------------------------------------------------
-- Sicherung vor dem Schreiben. Gleiche Mechanik wie beim 3.14-Piloten: neu aufgebaut
-- wird sie nur, solange irgendein Projekt noch den Ausgangszustand hat. Ein
-- Wiederholungslauf nach Abbruch ersetzt damit eine halbfertige Sicherung, ein Lauf
-- nach erfolgreicher Migration ueberschreibt die Sicherung des Vorzustands nicht.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.project_source_states
    where coalesce(state #>> array['2','measures','13','stepSource'], '') <> 'process_steps'
  ) then
    drop table if exists public.project_source_states_backup_20260807_313;
    create table public.project_source_states_backup_20260807_313 as
    select * from public.project_source_states;
    raise notice 'Sicherung project_source_states_backup_20260807_313 neu angelegt.';
  else
    raise notice 'Alle Projekte bereits migriert - vorhandene Sicherung bleibt unveraendert.';
  end if;
end $$;

do $$
declare
  v_row record;
  v_measure jsonb;
  v_titel text;
  v_anzahl integer;
  v_mit_daten integer;
  v_neu_measure jsonb;
  v_neu jsonb;
begin
  for v_row in select project_id, state from public.project_source_states loop
    v_measure := v_row.state #> array['2','measures','13'];

    if v_measure is null then
      raise exception 'Pfad state[2].measures[13] fehlt (Projekt %). Nichts geaendert.', v_row.project_id;
    end if;

    v_titel := v_measure ->> 'title';
    if v_titel is null or v_titel not like '3.13.%' then
      raise exception 'state[2].measures[13] ist nicht 3.13, sondern "%" (Projekt %). Nichts geaendert.',
        coalesce(v_titel, '<ohne Titel>'), v_row.project_id;
    end if;

    -- Bereits migriert: erneuter Lauf darf nicht scheitern (supabase db push ist wiederholbar).
    if coalesce(v_measure ->> 'stepSource', '') = 'process_steps' then
      raise notice 'Projekt %: 3.13 laeuft bereits ueber process_steps, uebersprungen.', v_row.project_id;
      continue;
    end if;

    v_anzahl := coalesce(jsonb_array_length(v_measure -> 'subitems'), 0);
    if v_anzahl <> 13 then
      raise exception 'Erwartet 13 Kategoriekarten unter 3.13, gefunden % (Projekt %). Nichts geaendert.',
        v_anzahl, v_row.project_id;
    end if;

    -- Die 13 Karten sind reine Beschriftungen ohne Nutzerdaten. Sollte doch an einer
    -- ein Haken oder ein Formularwert haengen, wird nichts verworfen - der Lauf bricht ab.
    select count(*) into v_mit_daten
    from jsonb_array_elements(v_measure -> 'subitems') as sub
    where coalesce((sub ->> 'done')::boolean, false)
       or coalesce(sub -> 'data', '{}'::jsonb) <> '{}'::jsonb
       -- jsonb_exists statt des Operators ?, damit kein Migrationsrunner das Fragezeichen
       -- als Parameterplatzhalter deutet.
       or jsonb_exists(sub, 'guidanceChecks');

    if v_mit_daten > 0 then
      raise exception 'Projekt %: % der 13 Karten unter 3.13 tragen Nutzerdaten. Nichts geaendert - bitte vorher sichten.',
        v_row.project_id, v_mit_daten;
    end if;

    v_neu_measure := v_measure || jsonb_build_object(
      'subitems',   '[]'::jsonb,
      'stepSource', 'process_steps'
    );

    v_neu := jsonb_set(v_row.state, array['2','measures','13'], v_neu_measure, false);

    update public.project_source_states
    set state = v_neu,
        -- sha256() ist eingebaut, pgcrypto wird nicht benoetigt. convert_to() statt ::bytea:
        -- der bytea-Cast parst den Text nach dem bytea-Eingabeformat und scheitert an jedem
        -- Backslash im Blob, der keine gueltige Escape-Sequenz bildet.
        source_sha256 = encode(sha256(convert_to(v_neu::text, 'UTF8')), 'hex'),
        updated_at = now()
    where project_id = v_row.project_id;

    raise notice 'Projekt %: 13 Kategoriekarten entfernt, 3.13 rendert ab jetzt aus process_steps.', v_row.project_id;
  end loop;
end $$;

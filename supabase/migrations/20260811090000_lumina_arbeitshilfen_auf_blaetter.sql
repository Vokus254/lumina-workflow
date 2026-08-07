-- ===========================================================================
-- Arbeitshilfen von den Stationsknoten auf die passenden Massnahmen umhaengen.
--
-- Hintergrund: das Massenmigrationspaket hat rund 75 Excel-Vorlagen in den Bucket
-- lumina-templates geladen und ihren Pfad jeweils am STATIONSknoten hinterlegt. Seit
-- Stationen mit Unterkacheln reine Navigationsseiten sind, liest das Frontend deren
-- Anleitung nicht mehr - die Download-Schaltflaeche dieser Vorlagen war damit nicht
-- mehr erreichbar. Die Dateien liegen weiterhin im Bucket, nur der Weg dorthin fehlte.
--
-- Diese Migration traegt Pfad, Name und Spaltenbeschreibung von der Station auf die
-- fachlich passende Massnahme. Sie ist additiv: die Stationszeilen bleiben unveraendert
-- stehen, es wird nichts geloescht und nichts eingefuegt - ausschliesslich UPDATE.
--
-- Warum die Werte aus der Datenbank gelesen und nicht kodiert werden: der tatsaechliche
-- Bucket-Pfad ist die Wahrheit. Ein kodierter Pfad koennte danebenliegen und wuerde eine
-- Vorlage verknuepfen, die es nicht gibt. Der erwartete Dateiname steht trotzdem in der
-- Zuordnungstabelle und wird geprueft - weicht er ab, bricht die Migration ab, statt
-- stillschweigend die falsche Datei zu verknuepfen.
--
-- Idempotent: es wird nur geschrieben, wo am Ziel noch kein Pfad steht.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Sicherung. Wird nur neu aufgebaut, solange noch mindestens ein Ziel leer ist -
-- ein Wiederholungslauf nach erfolgreicher Migration ueberschreibt die Sicherung
-- des Vorzustands damit nicht.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.process_step_guidance g
    join public.process_steps s on s.id = g.process_step_id
    where s.code in ('3.5.1.1','3.9.1','3.9.2','3.11.1.1','3.6.1','3.13.1.1','3.16.1.1','3.3.1.1','3.3.2.1')
      and g.arbeitshilfe_storage_path is null
  ) then
    drop table if exists public.process_step_guidance_backup_20260811;
    create table public.process_step_guidance_backup_20260811 as
    select * from public.process_step_guidance;
    raise notice 'Sicherung process_step_guidance_backup_20260811 neu angelegt.';
  else
    raise notice 'Alle Ziele tragen bereits einen Pfad - vorhandene Sicherung bleibt unveraendert.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- Vorpruefung: Quell- und Zielzeilen muessen existieren, und der Dateiname am
-- Stationsknoten muss dem erwarteten entsprechen.
-- ---------------------------------------------------------------------------
do $$
declare
  v_row record;
  v_fehlend text := '';
begin
  for v_row in
    select v.station_code, v.datei, v.blatt_code,
           qg.arbeitshilfe_storage_path as quelle_pfad,
           zg.process_step_id is not null as ziel_da
    from (values
      ('3.5',  'Anlagenspiegel_Brutto.xlsx',                          '3.5.1.1'),
      ('3.9',  '3.9_Excel-RAP-Spiegel.xlsx',                          '3.9.1'),
      ('3.9',  '3.9_Excel-RAP-Spiegel.xlsx',                          '3.9.2'),
      ('3.11', 'Entwicklung_Sonderposten.xlsx',                       '3.11.1.1'),
      ('3.6',  'Forderungsspiegel.xlsx',                              '3.6.1'),
      ('3.13', 'Verbindlichkeitenspiegel.xlsx',                       '3.13.1.1'),
      ('3.16', '3.16_Excel-Inventur-_und_Bestandsabgleich.xlsx',      '3.16.1.1'),
      ('3.3',  '3.3_Excel-Intercompany-Abstimmungsmatrix.xlsx',       '3.3.1.1'),
      ('3.3',  '3.3_Excel-Intercompany-Abstimmungsmatrix.xlsx',       '3.3.2.1')
    ) as v(station_code, datei, blatt_code)
    left join public.process_steps qs on qs.code = v.station_code
    left join public.process_step_guidance qg on qg.process_step_id = qs.id
    left join public.process_steps zs on zs.code = v.blatt_code
    left join public.process_step_guidance zg on zg.process_step_id = zs.id
  loop
    if v_row.quelle_pfad is null then
      v_fehlend := v_fehlend || format(' [Station %s ohne Arbeitshilfe-Pfad]', v_row.station_code);
    elsif v_row.quelle_pfad not like '%' || v_row.datei then
      v_fehlend := v_fehlend || format(' [Station %s: erwartet %s, gefunden %s]',
        v_row.station_code, v_row.datei, v_row.quelle_pfad);
    end if;
    if not coalesce(v_row.ziel_da, false) then
      v_fehlend := v_fehlend || format(' [Blatt %s ohne Anleitungszeile]', v_row.blatt_code);
    end if;
  end loop;

  if v_fehlend <> '' then
    raise exception 'Vorpruefung fehlgeschlagen:%', v_fehlend;
  end if;
  raise notice 'Vorpruefung ok: 7 Quellstationen, 9 Zielblaetter, Dateinamen stimmen.';
end $$;


-- ---------------------------------------------------------------------------
-- Umhaengen. Name, Pfad und Spaltenbeschreibung gehoeren zusammen und wandern
-- gemeinsam - sonst beschriebe die Spaltenliste des Blattes eine andere Datei als
-- die, die heruntergeladen wird.
-- ---------------------------------------------------------------------------
update public.process_step_guidance ziel
set arbeitshilfe_storage_path = quelle.arbeitshilfe_storage_path,
    arbeitshilfe_storage_bucket = quelle.arbeitshilfe_storage_bucket,
    arbeitshilfe_name = quelle.arbeitshilfe_name,
    arbeitshilfe_felder = quelle.arbeitshilfe_felder,
    updated_at = now()
from (values
  ('3.5',  '3.5.1.1'),
  ('3.9',  '3.9.1'),
  ('3.9',  '3.9.2'),
  ('3.11', '3.11.1.1'),
  ('3.6',  '3.6.1'),
  ('3.13', '3.13.1.1'),
  ('3.16', '3.16.1.1'),
  ('3.3',  '3.3.1.1'),
  ('3.3',  '3.3.2.1')
) as v(station_code, blatt_code)
join public.process_steps qs on qs.code = v.station_code
join public.process_step_guidance quelle on quelle.process_step_id = qs.id
join public.process_steps zs on zs.code = v.blatt_code
where ziel.process_step_id = zs.id
  and ziel.arbeitshilfe_storage_path is null
  and quelle.arbeitshilfe_storage_path is not null;


-- ---------------------------------------------------------------------------
-- Kontrolle
-- ---------------------------------------------------------------------------
do $$
declare
  v_mit_pfad integer;
  v_stationen_unveraendert integer;
begin
  select count(*) into v_mit_pfad
  from public.process_step_guidance g
  join public.process_steps s on s.id = g.process_step_id
  where s.code in ('3.5.1.1','3.9.1','3.9.2','3.11.1.1','3.6.1','3.13.1.1','3.16.1.1','3.3.1.1','3.3.2.1')
    and g.arbeitshilfe_storage_path is not null;
  if v_mit_pfad <> 9 then
    raise exception 'Erwartet 9 Massnahmen mit Arbeitshilfe, gefunden %.', v_mit_pfad;
  end if;

  -- Die Stationszeilen bleiben ausdruecklich unangetastet.
  select count(*) into v_stationen_unveraendert
  from public.process_step_guidance g
  join public.process_steps s on s.id = g.process_step_id
  where s.code in ('3.3','3.5','3.6','3.9','3.11','3.13','3.16')
    and g.arbeitshilfe_storage_path is not null;
  if v_stationen_unveraendert <> 7 then
    raise exception 'Die 7 Stationszeilen sollten unveraendert bleiben, gefunden % mit Pfad.', v_stationen_unveraendert;
  end if;

  raise notice '9 Arbeitshilfen auf Massnahmen umgehaengt, 7 Stationszeilen unveraendert.';
end $$;

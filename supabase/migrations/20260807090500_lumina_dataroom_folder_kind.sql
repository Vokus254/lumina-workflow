-- Pilot 202-Kacheln-Architektur, Schritt 6 von 7: die zwei Baeume sauber trennen.
--
-- Ausgangslage und Ursache des Datenraum-Fehlers:
--   dataroom_folders traegt seit 20260806140000 zwei Hierarchien in einer Tabelle.
--   Der thematische Datenraum hat 12 Top-Level-Ordner (Projektsteuerung, Stammdaten,
--   Bilanz - Aktiva, ...). Zusaetzlich legt prepare_step_document_upload je Prozessschritt
--   einen Ordner "process-step:<code>" an und haengt ihn unter "Projektsteuerung" -
--   ein zweiter Baum, der im Datenraum-Modal als normaler Unterordner erscheint.
--
-- Regel ab hier:
--   Genau eine Tabelle haelt die Prozesshierarchie (process_steps.parent_id), genau eine
--   die Ablagehierarchie (dataroom_folders.parent_folder_id). Keine Tabelle mischt beides.
--   Verknuepfungen zwischen den Baeumen laufen ueber Fremdschluessel, nie ueber Titel-
--   oder Code-Strings.
--
-- Umsetzung: folder_kind macht die Trennung explizit.
--   'thematic'     - der eigentliche Datenraum, nur diese Ordner gehoeren in den Baum.
--   'process_step' - technisches Ablageziel eines Prozessschritts. documents.folder_id ist
--                    NOT NULL, deshalb braucht auch ein schrittbezogener Upload einen Ordner;
--                    im Datenraum-Modal hat er aber nichts zu suchen.
--
-- Der Datenraum je Kachel wird dadurch eine Abfrage (documents ueber process_step_id),
-- kein Ordnerzweig. Dieselbe Datei, zwei Sichten, eine Wahrheit.

alter table public.dataroom_folders
  add column if not exists folder_kind text not null default 'thematic';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dataroom_folders'::regclass
      and conname = 'dataroom_folders_folder_kind_check'
  ) then
    alter table public.dataroom_folders
      add constraint dataroom_folders_folder_kind_check
      check (folder_kind in ('thematic', 'process_step'));
  end if;
end $$;

comment on column public.dataroom_folders.folder_kind is
  'thematic = Teil des sichtbaren Datenraumbaums. process_step = technisches Ablageziel eines Prozessschritts, wird im Datenraum-Modal nicht angezeigt.';

-- ---------------------------------------------------------------------------
-- Backfill: alle bisher angelegten Schritt-Ordner umklassifizieren.
-- Erfasst wird beides - Ordner mit gesetztem process_step_id und Ordner, deren
-- legacy_path_key dem Muster folgt. Die zweite Bedingung faengt Ordner ab, deren
-- process_step_id durch ein geloeschtes process_steps (on delete cascade greift nur
-- auf die Spalte) oder durch manuelles Anlegen im SQL-Editor fehlt - dazu zaehlen
-- die Ordner aus dem 3.14.6-Vorfall.
-- ---------------------------------------------------------------------------
update public.dataroom_folders
set folder_kind = 'process_step',
    updated_at = now()
where folder_kind <> 'process_step'
  and (process_step_id is not null or legacy_path_key like 'process-step:%');

do $$
declare
  v_umklassifiziert integer;
  v_verwaist integer;
begin
  select count(*) into v_umklassifiziert
  from public.dataroom_folders where folder_kind = 'process_step';

  -- Schritt-Ordner, die noch als Kind eines thematischen Ordners haengen. Sie stoeren
  -- nicht mehr, sobald das Modal nach folder_kind filtert; der Hinweis zeigt aber, wie
  -- viele Altlasten aus der Zeit vor dieser Trennung stammen.
  select count(*) into v_verwaist
  from public.dataroom_folders f
  join public.dataroom_folders p on p.id = f.parent_folder_id
  where f.folder_kind = 'process_step' and p.folder_kind = 'thematic';

  raise notice 'folder_kind: % Ordner als process_step markiert, davon % noch unter einem thematischen Ordner einsortiert.',
    v_umklassifiziert, v_verwaist;
end $$;

-- ---------------------------------------------------------------------------
-- prepare_step_document_upload nachziehen: neu angelegte Schritt-Ordner muessen die
-- Markierung sofort tragen, sonst stehen sie als 'thematic' wieder im Modal.
-- Unveraendert gegenueber 20260806140000 bis auf folder_kind im INSERT und im
-- ON CONFLICT - der Rest ist bewusst identisch uebernommen.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_step_document_upload(
  p_process_step_id uuid,
  p_original_file_name text,
  p_mime_type text default null,
  p_file_size bigint default 0,
  p_upload_comment text default null
)
returns table (
  document_id uuid,
  version_id uuid,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_id uuid;
  v_step_code text;
  v_step_name text;
  v_folder_id uuid;
  v_parent_folder_id uuid;
  v_document_id uuid := gen_random_uuid();
  v_version_id uuid := gen_random_uuid();
  v_user_id uuid := auth.uid();
  v_external_contact_id uuid;
  v_is_external boolean;
  v_safe_name text;
  v_storage_path text;
begin
  if v_user_id is null then
    raise exception 'Anmeldung erforderlich.';
  end if;
  if p_file_size < 0 or p_file_size > 52428800 then
    raise exception 'Die Datei ist groesser als 50 MB.';
  end if;
  if not private.can_access_process_step(p_process_step_id) then
    raise exception 'Kein Zugriff auf diesen Prozessschritt.';
  end if;

  select s.project_id, s.code, s.name
    into v_project_id, v_step_code, v_step_name
  from public.process_steps s
  where s.id = p_process_step_id;

  select f.id into v_folder_id
  from public.dataroom_folders f
  where f.project_id = v_project_id
    and f.process_step_id = p_process_step_id
    and f.archived_at is null;

  if v_folder_id is null then
    select f.id into v_parent_folder_id
    from public.dataroom_folders f
    where f.project_id = v_project_id
      and f.parent_folder_id is null
      and f.archived_at is null
      and lower(f.name) = 'projektsteuerung'
    order by f.sort_order, f.created_at, f.id
    limit 1;

    insert into public.dataroom_folders (
      project_id, parent_folder_id, name, process_step_id, legacy_path_key, visibility_scope, folder_kind
    ) values (
      v_project_id,
      v_parent_folder_id,
      trim(both ' ' from coalesce(v_step_code, '') || ' ' || coalesce(v_step_name, 'Prozessschritt')),
      p_process_step_id,
      'process-step:' || coalesce(v_step_code, p_process_step_id::text),
      'internal',
      'process_step'
    )
    on conflict (project_id, legacy_path_key)
      do update set process_step_id = excluded.process_step_id,
                    folder_kind = 'process_step',
                    archived_at = null
    returning id into v_folder_id;
  end if;

  if v_folder_id is null then
    raise exception 'Fuer diesen Prozessschritt konnte kein Datenraumordner ermittelt werden.';
  end if;

  v_external_contact_id := private.external_contact_id();
  v_is_external := v_external_contact_id is not null;

  v_safe_name := left(
    regexp_replace(coalesce(nullif(trim(p_original_file_name), ''), 'Dokument'), '[^a-zA-Z0-9._-]+', '_', 'g'),
    180
  );
  v_storage_path := format('%s/prozessschritt/%s/%s/%s', v_project_id, p_process_step_id, v_document_id, v_safe_name);

  insert into public.documents (
    id, project_id, folder_id, task_id, display_name,
    created_by_user_id, created_by_external_contact_id
  ) values (
    v_document_id, v_project_id, v_folder_id, null, p_original_file_name,
    case when not v_is_external then v_user_id end,
    case when v_is_external then v_external_contact_id end
  );

  insert into public.document_versions (
    id, document_id, version_number, storage_bucket, storage_path,
    original_file_name, mime_type, file_size, upload_comment,
    uploaded_by_user_id, uploaded_by_external_contact_id
  ) values (
    v_version_id, v_document_id, 1, 'lumina-datarooms', v_storage_path,
    p_original_file_name, nullif(p_mime_type, ''), p_file_size, nullif(p_upload_comment, ''),
    case when not v_is_external then v_user_id end,
    case when v_is_external then v_external_contact_id end
  );

  insert into public.task_activity_events (
    project_id, task_id, document_id, actor_user_id, actor_external_contact_id,
    event_type, event_data
  ) values (
    v_project_id, null, v_document_id,
    case when not v_is_external then v_user_id end,
    case when v_is_external then v_external_contact_id end,
    'document_uploaded',
    jsonb_build_object(
      'file_name', p_original_file_name,
      'process_step_id', p_process_step_id,
      'process_step_code', v_step_code
    )
  );

  return query select v_document_id, v_version_id, 'lumina-datarooms'::text, v_storage_path;
end;
$$;

revoke all on function public.prepare_step_document_upload(uuid,text,text,bigint,text) from public, anon;
grant execute on function public.prepare_step_document_upload(uuid,text,text,bigint,text) to authenticated;

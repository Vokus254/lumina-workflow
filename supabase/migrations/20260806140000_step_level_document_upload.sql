-- Upload ohne zugeordnete Aufgabe: Dokumente haengen am Prozessschritt statt an einer Task.
--
-- Ausgangslage:
--   documents.task_id ist bereits nullable, documents.folder_id dagegen NOT NULL.
--   Die SELECT-Policies fuer documents/document_versions/storage haben den Fallback
--   "can_access_task(task_id) or can_access_folder(folder_id)" schon; die INSERT-Policy
--   auf storage.objects hatte ihn nicht. prepare_document_upload ist fest an eine Task gebunden.
--
-- Diese Migration ergaenzt: Ordner je Prozessschritt, Zugriff fuer Rollennutzer auf genau
-- diese Ordner, eine eigene Upload-RPC und den fehlenden Ordner-Fallback beim Storage-Insert.

-- ---------------------------------------------------------------------------
-- 1. Datenraumordner kann einen Prozessschritt buendeln.
-- ---------------------------------------------------------------------------
alter table public.dataroom_folders
  add column if not exists process_step_id uuid references public.process_steps(id) on delete cascade;

create unique index if not exists dataroom_folders_process_step_uidx
  on public.dataroom_folders(project_id, process_step_id)
  where process_step_id is not null;

comment on column public.dataroom_folders.process_step_id is
  'Gesetzt bei Ordnern, die einen Prozessschritt buendeln (Uploads ohne Einzelaufgabe). Null bei allen uebrigen Ordnern.';

-- ---------------------------------------------------------------------------
-- 2. Zugriff fuer Rollennutzer.
--    Rollennutzer sind angemeldete interne Nutzer ohne project_members-Eintrag; ihr Zugriff
--    lief bisher ausschliesslich ueber Aufgaben. Bei Prozessschritten ohne Einzelmassnahme
--    gibt es keine Aufgabe, an der er haengen koennte - deshalb hier der Bezug ueber das Projekt.
--    Bewusst eng gehalten: nur Schritte, deren Anleitung und Ordner, nicht der uebrige Datenraum.
-- ---------------------------------------------------------------------------
create or replace function private.is_project_role_user(p_project uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1
    from public.responsibility_roles r
    join public.role_user_assignments a on a.role_id = r.id
    where r.project_id = p_project
      and a.user_id = auth.uid()
  )
$$;

create or replace function private.can_access_process_step(p_step uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1 from public.process_steps s
    where s.id = p_step
      and (private.is_project_member(s.project_id) or private.is_project_role_user(s.project_id))
  )
$$;

create or replace function private.can_access_folder(p_folder uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.dataroom_folders f where f.id=p_folder and private.is_project_member(f.project_id))
  or exists(select 1 from public.task_folder_assignments a where a.folder_id=p_folder and private.can_access_task(a.task_id))
  or exists(
    select 1 from public.dataroom_folders f
    where f.id = p_folder
      and f.process_step_id is not null
      and private.is_project_role_user(f.project_id)
  )
$$;

-- Ohne Lesezugriff auf Schritt und Anleitung sieht ein Rollennutzer die Vier-Block-Ansicht
-- eines aufgabenlosen Schritts gar nicht - der Upload liefe damit ins Leere.
drop policy if exists steps_access_select on public.process_steps;
create policy steps_access_select on public.process_steps for select to authenticated
using(
  private.is_project_member(project_id)
  or private.is_project_role_user(project_id)
  or exists(select 1 from public.tasks t where t.process_step_id=id and private.can_access_task(t.id))
);

drop policy if exists guidance_access_select on public.process_step_guidance;
create policy guidance_access_select on public.process_step_guidance for select to authenticated
using(exists(
  select 1 from public.process_steps s
  where s.id = process_step_id
    and (private.is_project_member(s.project_id)
      or private.is_project_role_user(s.project_id)
      or exists(select 1 from public.tasks t where t.process_step_id = s.id and private.can_access_task(t.id)))));

-- ---------------------------------------------------------------------------
-- 3. Upload gegen den Prozessschritt.
--    Gleiche Rueckgabe wie prepare_document_upload, damit das Frontend denselben Ablauf nutzt.
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

  -- Ordner des Schritts wiederverwenden oder beim ersten Upload anlegen.
  select f.id into v_folder_id
  from public.dataroom_folders f
  where f.project_id = v_project_id
    and f.process_step_id = p_process_step_id
    and f.archived_at is null;

  if v_folder_id is null then
    -- Der Datenraum ist thematisch gegliedert (Projektsteuerung, Stammdaten, Bilanz ...) und hat
    -- keinen Ordner je Prozess-Station. Schritt-Ordner haengen deshalb unter "Projektsteuerung" -
    -- derselbe Vorrang, den 20260803124000_assign_missing_task_folders fuer aufgabenlose
    -- Zuordnungen bereits verwendet. Ohne solchen Ordner wird der Schritt-Ordner top-level
    -- angelegt, statt ihn in einen beliebig erstsortierten Themenordner zu haengen.
    select f.id into v_parent_folder_id
    from public.dataroom_folders f
    where f.project_id = v_project_id
      and f.parent_folder_id is null
      and f.archived_at is null
      and lower(f.name) = 'projektsteuerung'
    order by f.sort_order, f.created_at, f.id
    limit 1;

    insert into public.dataroom_folders (
      project_id, parent_folder_id, name, process_step_id, legacy_path_key, visibility_scope
    ) values (
      v_project_id,
      v_parent_folder_id,
      trim(both ' ' from coalesce(v_step_code, '') || ' ' || coalesce(v_step_name, 'Prozessschritt')),
      p_process_step_id,
      'process-step:' || coalesce(v_step_code, p_process_step_id::text),
      'internal'
    )
    on conflict (project_id, legacy_path_key)
      do update set process_step_id = excluded.process_step_id, archived_at = null
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
  -- Eigenes Pfadsegment, damit schrittbezogene Dateien nicht mit task-IDs kollidieren.
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

  -- task_id bleibt null; der Schrittbezug steht in event_data.
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

-- ---------------------------------------------------------------------------
-- 4. Storage-Insert: fehlender Ordner-Fallback.
--    Ohne diese Ergaenzung scheitert der Datei-Upload bei task_id null, weil
--    can_access_task(null) false ist - die SELECT-Policies hatten den Fallback laengst.
-- ---------------------------------------------------------------------------
drop policy if exists lumina_files_insert on storage.objects;
create policy lumina_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'lumina-datarooms'
  and exists (
    select 1
    from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.storage_bucket = bucket_id
      and v.storage_path = name
      and (
        v.uploaded_by_user_id = auth.uid()
        or v.uploaded_by_external_contact_id = private.external_contact_id()
      )
      and (
        private.can_access_task(d.task_id)
        or private.can_access_folder(d.folder_id)
      )
  )
);

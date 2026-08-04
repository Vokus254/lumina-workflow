create or replace function public.prepare_document_upload(
  p_task_id uuid,
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
  v_folder_id uuid;
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
  if not private.can_access_task(p_task_id) then
    raise exception 'Kein Zugriff auf diese Aufgabe.';
  end if;

  select t.project_id, a.folder_id
    into v_project_id, v_folder_id
  from public.tasks t
  join public.task_folder_assignments a on a.task_id = t.id
  where t.id = p_task_id
  order by a.is_primary desc, a.assigned_at
  limit 1;

  if v_folder_id is null then
    raise exception 'Der Aufgabe ist kein Datenraumordner zugeordnet.';
  end if;

  -- Role users are authenticated internal users even when they are not listed
  -- as project_members. External contacts keep their separate audit identity.
  v_external_contact_id := private.external_contact_id();
  v_is_external := v_external_contact_id is not null;

  v_safe_name := left(
    regexp_replace(coalesce(nullif(trim(p_original_file_name), ''), 'Dokument'), '[^a-zA-Z0-9._-]+', '_', 'g'),
    180
  );
  v_storage_path := format('%s/%s/%s/%s', v_project_id, p_task_id, v_document_id, v_safe_name);

  insert into public.documents (
    id, project_id, folder_id, task_id, display_name,
    created_by_user_id, created_by_external_contact_id
  ) values (
    v_document_id, v_project_id, v_folder_id, p_task_id, p_original_file_name,
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
    v_project_id, p_task_id, v_document_id,
    case when not v_is_external then v_user_id end,
    case when v_is_external then v_external_contact_id end,
    'document_uploaded', jsonb_build_object('file_name', p_original_file_name)
  );

  return query select v_document_id, v_version_id, 'lumina-datarooms'::text, v_storage_path;
end;
$$;

revoke all on function public.prepare_document_upload(uuid,text,text,bigint,text) from public, anon;
grant execute on function public.prepare_document_upload(uuid,text,text,bigint,text) to authenticated;

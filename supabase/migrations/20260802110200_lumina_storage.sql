insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lumina-datarooms','lumina-datarooms',false,52428800,array[
 'application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv',
 'image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy lumina_files_select on storage.objects for select to authenticated
using(bucket_id='lumina-datarooms' and exists(
 select 1 from public.document_versions v join public.documents d on d.id=v.document_id
 where v.storage_bucket=bucket_id and v.storage_path=name
 and (private.can_access_task(d.task_id) or private.can_access_folder(d.folder_id))));

-- Kein direkter INSERT/UPDATE/DELETE auf storage.objects: Uploads und neue Versionen
-- werden nach Berechtigungsprüfung über eine Edge Function mit Service Role angelegt.

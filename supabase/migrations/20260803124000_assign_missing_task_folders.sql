-- Every task needs a primary folder before a document upload can be prepared.
-- Preserve existing assignments and use the project's Projektsteuerung folder
-- only as a safe default for legacy tasks without any persisted assignment.
insert into public.task_folder_assignments (task_id, folder_id, is_primary)
select
  t.id,
  default_folder.id,
  true
from public.tasks t
join lateral (
  select f.id
  from public.dataroom_folders f
  where f.project_id = t.project_id
    and f.archived_at is null
  order by
    case when lower(f.name) = 'projektsteuerung' then 0 else 1 end,
    f.sort_order,
    f.created_at,
    f.id
  limit 1
) default_folder on true
where not exists (
  select 1
  from public.task_folder_assignments existing
  where existing.task_id = t.id
)
on conflict (task_id, folder_id) do nothing;

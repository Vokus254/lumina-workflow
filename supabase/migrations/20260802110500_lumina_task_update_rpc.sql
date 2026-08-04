create or replace function public.update_task_state(
  p_task_id uuid,
  p_work_status text,
  p_review_status text,
  p_internal_comment text default null,
  p_due_date_override date default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task public.tasks;
begin
  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and private.is_project_member(t.project_id, array['owner','manager','contributor'])
  ) then
    raise exception 'LUMINA_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_work_status not in ('open','accepted','in_progress','submitted','completed','not_relevant') then
    raise exception 'LUMINA_INVALID_WORK_STATUS' using errcode = '22023';
  end if;
  if p_review_status not in ('unreviewed','question','changes_required','accepted') then
    raise exception 'LUMINA_INVALID_REVIEW_STATUS' using errcode = '22023';
  end if;

  update public.tasks
  set work_status = p_work_status,
      review_status = p_review_status,
      internal_comment = nullif(p_internal_comment, ''),
      due_date_override = p_due_date_override,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  insert into public.task_activity_events(project_id, task_id, actor_user_id, event_type, event_data)
  values(v_task.project_id, v_task.id, auth.uid(), 'task.updated',
    jsonb_build_object('work_status', v_task.work_status, 'review_status', v_task.review_status));

  return v_task;
end;
$$;

revoke all on function public.update_task_state(uuid,text,text,text,date) from public, anon;
grant execute on function public.update_task_state(uuid,text,text,text,date) to authenticated;

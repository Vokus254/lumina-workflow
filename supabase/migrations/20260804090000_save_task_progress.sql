-- Paket 7B-2: Kommentar speichern und Aufgabe durch berechtigte Bearbeiter abschliessen.
create or replace function public.save_task_progress(
  p_task_id uuid,
  p_internal_comment text default null,
  p_complete boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_task public.tasks;
  v_can_edit boolean;
begin
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        private.is_project_member(t.project_id, array['owner','manager','contributor'])
        or exists (
          select 1
          from public.role_user_assignments a
          where a.role_id = t.responsibility_role_id
            and a.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.task_invitations i
          join public.external_contacts c
            on c.id = i.external_contact_id
          where i.task_id = t.id
            and c.auth_user_id = auth.uid()
            and c.active
            and c.access_enabled
            and i.status in ('sent','opened','accepted','completed')
            and i.revoked_at is null
            and i.expires_at > now()
        )
      )
  )
  into v_can_edit;

  if not v_can_edit then
    raise exception 'LUMINA_TASK_EDIT_DENIED'
      using errcode = '42501';
  end if;

  update public.tasks
  set internal_comment = nullif(btrim(coalesce(p_internal_comment, '')), ''),
      work_status = case
        when p_complete then 'completed'
        else work_status
      end,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  if v_task.id is null then
    raise exception 'LUMINA_TASK_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  insert into public.task_activity_events(
    project_id,
    task_id,
    actor_user_id,
    event_type,
    event_data
  )
  values (
    v_task.project_id,
    v_task.id,
    auth.uid(),
    case
      when p_complete then 'task.completed'
      else 'task.comment_saved'
    end,
    jsonb_build_object(
      'work_status', v_task.work_status,
      'review_status', v_task.review_status,
      'has_comment', v_task.internal_comment is not null
    )
  );

  return v_task;
end;
$$;

revoke all on function public.save_task_progress(uuid,text,boolean)
  from public, anon;

grant execute on function public.save_task_progress(uuid,text,boolean)
  to authenticated;

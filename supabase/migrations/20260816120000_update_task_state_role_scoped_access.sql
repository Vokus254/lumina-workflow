-- Fix: update_task_state verweigerte rollenscharf zugewiesenen Nutzern (nur
-- role_user_assignments, keine project_members-Zeile - z.B. Abschluss-Chat-Bearbeiter) den
-- Statuswechsel ihrer eigenen, tatsaechlich autorisierten Aufgaben (LUMINA_ACCESS_DENIED),
-- obwohl sie dieselben Aufgaben laut private.can_access_task() bereits lesen/oeffnen/Dokumente
-- hochladen duerfen. Minimaler, symmetrischer Fix: derselbe rollenscharfe Zweig, den
-- can_access_task() bereits fuer Lesezugriff nutzt (role_user_assignments.role_id =
-- tasks.responsibility_role_id), wird hier NUR fuer genau die betroffene Aufgabe ergaenzt -
-- keine projektweite Schreibberechtigung, keine Aenderung an can_access_task/RLS selbst.

create or replace function public.update_task_state(
  p_task_id uuid,
  p_work_status text,
  p_review_status text,
  p_internal_comment text default null::text,
  p_due_date_override date default null::date
)
returns tasks
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_task public.tasks;
begin
  if not exists (
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
      )
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
$function$;

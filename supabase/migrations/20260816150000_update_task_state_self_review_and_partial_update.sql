-- P1-A: ein Nutzer, der ausschliesslich ueber role_user_assignments (nicht zusaetzlich als
-- project_members owner/manager/contributor) autorisiert ist, darf review_status nicht selbst auf
-- 'accepted' setzen (kein erzwungener Selbst-Review). Bestehende project_members-Zugriffe
-- (Legacy-Reviewer-Pfad) bleiben unveraendert - keine Ausweitung, keine neue Rolle.
--
-- P1-B: der bisherige "Voll-Save" (immer beide Felder ueberschreiben) passt zu Legacy
-- (saveLuminaTaskToSupabase sendet IMMER den kompletten lokalen Stand), zerstoert aber
-- internal_comment/due_date_override bei einem reinen Status-Update (Abschluss-Chat), das diese
-- Felder gar nicht mitschickt - PostgreSQL kann "Parameter weggelassen" nicht von "Parameter
-- bewusst NULL" unterscheiden. Neuer, standardmaessig abwaertskompatibler Parameter
-- p_touch_comment_and_due (default true = exakt bisheriges Verhalten fuer alle bestehenden
-- Aufrufer) macht das Uebergehen dieser beiden Felder fuer Status-only-Aufrufe explizit, statt
-- die bestehende NULL-Semantik fuer Legacy stillschweigend zu aendern.

create or replace function public.update_task_state(
  p_task_id uuid,
  p_work_status text,
  p_review_status text,
  p_internal_comment text default null::text,
  p_due_date_override date default null::date,
  p_touch_comment_and_due boolean default true
)
returns tasks
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_task public.tasks;
  v_is_project_member boolean;
  v_is_role_scoped boolean;
begin
  select
    exists (
      select 1 from public.tasks t
      where t.id = p_task_id
        and private.is_project_member(t.project_id, array['owner','manager','contributor'])
    ),
    exists (
      select 1
      from public.tasks t
      join public.role_user_assignments a on a.role_id = t.responsibility_role_id
      where t.id = p_task_id
        and a.user_id = auth.uid()
    )
  into v_is_project_member, v_is_role_scoped;

  if not (v_is_project_member or v_is_role_scoped) then
    raise exception 'LUMINA_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_work_status not in ('open','accepted','in_progress','submitted','completed','not_relevant') then
    raise exception 'LUMINA_INVALID_WORK_STATUS' using errcode = '22023';
  end if;
  if p_review_status not in ('unreviewed','question','changes_required','accepted') then
    raise exception 'LUMINA_INVALID_REVIEW_STATUS' using errcode = '22023';
  end if;

  -- P1-A: reiner Rollen-Zugriff (kein project_members-Zugriff) darf sich nicht selbst akzeptieren.
  if (not v_is_project_member) and v_is_role_scoped and p_review_status = 'accepted' then
    raise exception 'LUMINA_SELF_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;

  update public.tasks
  set work_status = p_work_status,
      review_status = p_review_status,
      internal_comment = case when p_touch_comment_and_due then nullif(p_internal_comment, '') else internal_comment end,
      due_date_override = case when p_touch_comment_and_due then p_due_date_override else due_date_override end,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  insert into public.task_activity_events(project_id, task_id, actor_user_id, event_type, event_data)
  values(v_task.project_id, v_task.id, auth.uid(), 'task.updated',
    jsonb_build_object('work_status', v_task.work_status, 'review_status', v_task.review_status));

  return v_task;
end;
$function$;

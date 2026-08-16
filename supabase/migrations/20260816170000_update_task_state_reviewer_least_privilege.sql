-- V2 Reviewer-Berechtigung (RW-Leitung), streng least-privilege, ausschliesslich fuer
-- project_members.security_role='reviewer' (bereits gueltiger Enum-Wert, siehe
-- project_members_security_role_check - keine Schemaaenderung noetig).
--
-- Lesezugriff: project_members mit security_role='reviewer' erhaelt bereits heute vollen
-- Task-/Dokumentlesezugriff ueber die BESTEHENDE can_access_task()-Bedingung
-- is_project_member(p.id) OHNE Rollenfilter - keine RLS-Aenderung noetig/vorgenommen.
--
-- Schreibzugriff (NEU, eng begrenzt): ein Nutzer, der AUSSCHLIESSLICH ueber die
-- reviewer-Rolle autorisiert ist (kein owner/manager/contributor, keine eigene
-- role_user_assignments-Zustaendigkeit fuer genau diese Aufgabe), darf ausschliesslich:
--   - review_status auf 'accepted' | 'changes_required' | 'question' setzen
--   - work_status dabei UNVERAENDERT lassen ODER auf 'in_progress' setzen (nur zusammen mit
--     'changes_required'/'question' - der bestehende Rueckgabe-Praezedenzfall aus
--     act_task_approval)
--   - internal_comment/due_date_override werden fuer diesen Pfad IMMER erhalten
--     (p_touch_comment_and_due wird serverseitig erzwungen auf false), unabhaengig davon,
--     was der Aufruf uebergibt - ein Reviewer schreibt nie die Bearbeiter-Notiz/Frist um.
-- Kein genereller Contributor-/Manager-Zugriff, keine Ausweitung auf andere Aufgaben, kein
-- Self-Review (P1-A bleibt unveraendert in Kraft und hat Vorrang, falls derselbe Nutzer
-- zusaetzlich ueber role_user_assignments fuer die eigene Aufgabe zustaendig ist).

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
  v_is_reviewer_only boolean;
  v_current_work_status text;
  v_touch_comment_and_due boolean := p_touch_comment_and_due;
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
    ),
    exists (
      select 1 from public.tasks t
      where t.id = p_task_id
        and private.is_project_member(t.project_id, array['reviewer'])
    ),
    (select t.work_status from public.tasks t where t.id = p_task_id)
  into v_is_project_member, v_is_role_scoped, v_is_reviewer_only, v_current_work_status;

  if not (v_is_project_member or v_is_role_scoped or v_is_reviewer_only) then
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

  -- Reviewer-Least-Privilege: greift NUR, wenn ausschliesslich ueber die reviewer-Rolle
  -- autorisiert (kein project_members owner/manager/contributor, keine eigene Zustaendigkeit
  -- fuer diese konkrete Aufgabe - fuer eigene Aufgaben gilt fuer denselben Nutzer stattdessen
  -- der normale Bearbeiter-Pfad oben).
  if (not v_is_project_member) and (not v_is_role_scoped) and v_is_reviewer_only then
    if p_review_status not in ('accepted', 'changes_required', 'question') then
      raise exception 'LUMINA_REVIEWER_ACTION_NOT_ALLOWED' using errcode = '42501';
    end if;
    if p_work_status <> v_current_work_status
       and not (p_work_status = 'in_progress' and p_review_status in ('changes_required', 'question')) then
      raise exception 'LUMINA_REVIEWER_ACTION_NOT_ALLOWED' using errcode = '42501';
    end if;
    v_touch_comment_and_due := false;
  end if;

  update public.tasks
  set work_status = p_work_status,
      review_status = p_review_status,
      internal_comment = case when v_touch_comment_and_due then nullif(p_internal_comment, '') else internal_comment end,
      due_date_override = case when v_touch_comment_and_due then p_due_date_override else due_date_override end,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  insert into public.task_activity_events(project_id, task_id, actor_user_id, event_type, event_data)
  values(v_task.project_id, v_task.id, auth.uid(), 'task.updated',
    jsonb_build_object('work_status', v_task.work_status, 'review_status', v_task.review_status));

  return v_task;
end;
$function$;

revoke execute on function public.update_task_state(uuid, text, text, text, date, boolean) from public;
revoke execute on function public.update_task_state(uuid, text, text, text, date, boolean) from anon;
grant execute on function public.update_task_state(uuid, text, text, text, date, boolean) to authenticated;

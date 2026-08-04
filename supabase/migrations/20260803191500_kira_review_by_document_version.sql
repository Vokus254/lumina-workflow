-- Recognize a KIRA review by the document version it assessed, not by whether
-- the preparer clicked submit before or after the analysis.
create or replace function private.has_current_kira_review(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  select exists(
    select 1
    from public.task_ai_interactions i
    where i.task_id=p_task_id
      and i.assistant_key='KIRA'
      and i.created_at >= coalesce((
        select max(latest.created_at)
        from public.documents d
        join lateral (
          select dv.created_at
          from public.document_versions dv
          where dv.document_id=d.id
          order by dv.version_number desc
          limit 1
        ) latest on true
        where d.task_id=p_task_id and d.archived_at is null
      ), '-infinity'::timestamptz)
  );
$$;
create or replace function public.get_task_approval_workflow(p_task_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_task public.tasks%rowtype;
  v_flow public.task_approval_workflows%rowtype;
  v_versions uuid[];
  v_outdated boolean := false;
  v_actions jsonb := '[]'::jsonb;
  v_waiting boolean := false;
  v_kira_ready boolean := false;
  v_stages jsonb;
  v_events jsonb;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  select * into v_task from public.tasks where id=p_task_id and private.can_access_task(id);
  if v_task.id is null then raise exception 'Kein Zugriff auf diese Aufgabe.'; end if;
  v_versions := private.current_task_version_ids(p_task_id);
  select * into v_flow from public.task_approval_workflows where task_id=p_task_id;
  if v_flow.task_id is not null and cardinality(v_flow.document_version_ids)>0 and v_versions<>v_flow.document_version_ids then
    v_outdated := true;
  end if;

  if v_flow.task_id is null or v_flow.status in ('draft','returned','outdated') or v_outdated then
    if private.is_task_assignee(p_task_id) or private.is_task_manager(p_task_id) then
      v_actions := v_actions || '"submit"'::jsonb; v_waiting := true;
    end if;
  elsif v_flow.current_stage='kira' and v_flow.status='pending' then
    v_kira_ready := private.has_current_kira_review(p_task_id);

    if private.is_task_manager(p_task_id) then
      if v_kira_ready then v_actions := v_actions || '"confirm_kira"'::jsonb; end if;
      v_actions := v_actions || '"return_kira"'::jsonb; v_waiting := true;
    end if;
  elsif v_flow.current_stage='accounting_lead' and v_flow.status='pending' then
    if private.is_accounting_lead(p_task_id) then
      v_actions := v_actions || '["approve_lead","return_lead"]'::jsonb; v_waiting := true;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'stage',s.stage,'status',s.status,'comment',s.comment,'acted_at',s.acted_at,
    'actor_email',u.email,'document_version_ids',s.document_version_ids
  ) order by case s.stage when 'preparer' then 1 when 'kira' then 2 else 3 end),'[]'::jsonb)
  into v_stages
  from public.task_approval_stage_states s left join auth.users u on u.id=s.actor_user_id
  where s.task_id=p_task_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'cycle',e.cycle,'stage',e.stage,'action',e.action,'actor_email',e.actor_email,
    'comment',e.comment,'document_version_ids',e.document_version_ids,'created_at',e.created_at
  ) order by e.created_at desc),'[]'::jsonb)
  into v_events from public.task_approval_events e where e.task_id=p_task_id;

  return jsonb_build_object(
    'enabled',v_task.source_number='82','task_id',p_task_id,'source_number',v_task.source_number,
    'current_stage',coalesce(v_flow.current_stage,'preparer'),'status',case when v_outdated then 'outdated' else coalesce(v_flow.status,'draft') end,
    'cycle',coalesce(v_flow.cycle,1),'document_version_ids',coalesce(v_flow.document_version_ids,'{}'::uuid[]),
    'current_document_version_ids',v_versions,'outdated',v_outdated,'kira_ready',v_kira_ready,
    'available_actions',v_actions,'waiting_for_me',v_waiting,'stages',v_stages,'events',v_events
  );
end;
$$;

create or replace function public.act_task_approval(p_task_id uuid,p_action text,p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_task public.tasks%rowtype;
  v_flow public.task_approval_workflows%rowtype;
  v_versions uuid[];
  v_cycle integer;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  select * into v_task from public.tasks where id=p_task_id and private.can_access_task(id) for update;
  if v_task.id is null then raise exception 'Kein Zugriff auf diese Aufgabe.'; end if;
  if v_task.source_number<>'82' then raise exception 'Der Freigabepilot ist derzeit fÃ¼r Aktive RAP verfÃ¼gbar.'; end if;
  select email into v_email from auth.users where id=auth.uid();
  v_versions := private.current_task_version_ids(p_task_id);
  select * into v_flow from public.task_approval_workflows where task_id=p_task_id for update;

  if p_action='submit' then
    if not (private.is_task_assignee(p_task_id) or private.is_task_manager(p_task_id)) then raise exception 'Nur Bearbeiter oder Administration dÃ¼rfen einreichen.'; end if;
    if cardinality(v_versions)=0 then raise exception 'Bitte zuerst mindestens ein Dokument hochladen.'; end if;
    v_cycle := case when v_flow.task_id is null then 1 else v_flow.cycle+1 end;
    insert into public.task_approval_workflows(task_id,project_id,current_stage,status,cycle,document_version_ids,updated_at,completed_at)
    values(p_task_id,v_task.project_id,'kira','pending',v_cycle,v_versions,now(),null)
    on conflict(task_id) do update set current_stage='kira',status='pending',cycle=excluded.cycle,document_version_ids=excluded.document_version_ids,updated_at=now(),completed_at=null;
    insert into public.task_approval_stage_states(task_id,stage,status,actor_user_id,comment,document_version_ids,acted_at,updated_at)
    values(p_task_id,'preparer','approved',auth.uid(),nullif(trim(p_comment),''),v_versions,now(),now())
    on conflict(task_id,stage) do update set status='approved',actor_user_id=auth.uid(),comment=excluded.comment,document_version_ids=v_versions,acted_at=now(),updated_at=now();
    insert into public.task_approval_stage_states(task_id,stage,status,actor_user_id,comment,document_version_ids,acted_at,updated_at)
    values(p_task_id,'kira','pending',null,null,v_versions,null,now()),(p_task_id,'accounting_lead','waiting',null,null,v_versions,null,now())
    on conflict(task_id,stage) do update set status=excluded.status,actor_user_id=null,comment=null,document_version_ids=v_versions,acted_at=null,updated_at=now();
    insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
    values(v_task.project_id,p_task_id,v_cycle,'preparer','submitted',auth.uid(),v_email,nullif(trim(p_comment),''),v_versions);
    update public.tasks set work_status='submitted',review_status='unreviewed',updated_at=now() where id=p_task_id;
  else
    if v_flow.task_id is null then raise exception 'Die Aufgabe wurde noch nicht eingereicht.'; end if;
    if v_versions<>v_flow.document_version_ids then raise exception 'Die Dokumentfassung hat sich geÃ¤ndert. Bitte erneut einreichen.'; end if;
    v_cycle:=v_flow.cycle;
    if p_action in ('return_kira','return_lead') and coalesce(trim(p_comment),'')='' then raise exception 'Bitte begrÃ¼nden Sie die RÃ¼ckgabe.'; end if;

    if p_action in ('confirm_kira','return_kira') then
      if not private.is_task_manager(p_task_id) then raise exception 'Nur die Administration darf die KIRA-PrÃ¼fung bestÃ¤tigen.'; end if;
      if v_flow.current_stage<>'kira' or v_flow.status<>'pending' then raise exception 'Die KIRA-Stufe ist nicht aktiv.'; end if;
      if p_action='confirm_kira' then
        if not private.has_current_kira_review(p_task_id) then raise exception 'Bitte zuerst KIRA mit der aktuellen Dokumentfassung prüfen lassen.'; end if;
        update public.task_approval_stage_states set status='approved',actor_user_id=auth.uid(),comment=nullif(trim(p_comment),''),acted_at=now(),updated_at=now() where task_id=p_task_id and stage='kira';
        update public.task_approval_stage_states set status='pending',updated_at=now() where task_id=p_task_id and stage='accounting_lead';
        update public.task_approval_workflows set current_stage='accounting_lead',status='pending',updated_at=now() where task_id=p_task_id;
        insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
        values(v_task.project_id,p_task_id,v_cycle,'kira','kira_confirmed',auth.uid(),v_email,nullif(trim(p_comment),''),v_versions);
      else
        update public.task_approval_stage_states set status='returned',actor_user_id=auth.uid(),comment=trim(p_comment),acted_at=now(),updated_at=now() where task_id=p_task_id and stage='kira';
        update public.task_approval_stage_states set status='waiting',actor_user_id=null,comment=null,acted_at=null,updated_at=now() where task_id=p_task_id and stage='accounting_lead';
        update public.task_approval_workflows set current_stage='preparer',status='returned',updated_at=now() where task_id=p_task_id;
        insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
        values(v_task.project_id,p_task_id,v_cycle,'kira','returned',auth.uid(),v_email,trim(p_comment),v_versions);
        update public.tasks set work_status='in_progress',review_status='changes_required',updated_at=now() where id=p_task_id;
      end if;
    elsif p_action in ('approve_lead','return_lead') then
      if not private.is_accounting_lead(p_task_id) then raise exception 'Nur die Leitung Rechnungswesen darf diese Stufe bearbeiten.'; end if;
      if v_flow.current_stage<>'accounting_lead' or v_flow.status<>'pending' then raise exception 'Die Freigabe der Leitung ist nicht aktiv.'; end if;
      if p_action='approve_lead' then
        update public.task_approval_stage_states set status='approved',actor_user_id=auth.uid(),comment=nullif(trim(p_comment),''),acted_at=now(),updated_at=now() where task_id=p_task_id and stage='accounting_lead';
        update public.task_approval_workflows set current_stage='completed',status='approved',updated_at=now(),completed_at=now() where task_id=p_task_id;
        insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
        values(v_task.project_id,p_task_id,v_cycle,'accounting_lead','approved',auth.uid(),v_email,nullif(trim(p_comment),''),v_versions);
        insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
        values(v_task.project_id,p_task_id,v_cycle,'system','completed',null,null,'Freigabepilot abgeschlossen',v_versions);
        update public.tasks set review_status='accepted',updated_at=now() where id=p_task_id;
      else
        update public.task_approval_stage_states set status='returned',actor_user_id=auth.uid(),comment=trim(p_comment),acted_at=now(),updated_at=now() where task_id=p_task_id and stage='accounting_lead';
        update public.task_approval_stage_states set status='waiting',actor_user_id=null,comment=null,acted_at=null,updated_at=now() where task_id=p_task_id and stage='kira';
        update public.task_approval_workflows set current_stage='preparer',status='returned',updated_at=now() where task_id=p_task_id;
        insert into public.task_approval_events(project_id,task_id,cycle,stage,action,actor_user_id,actor_email,comment,document_version_ids)
        values(v_task.project_id,p_task_id,v_cycle,'accounting_lead','returned',auth.uid(),v_email,trim(p_comment),v_versions);
        update public.tasks set work_status='in_progress',review_status='changes_required',updated_at=now() where id=p_task_id;
      end if;
    else raise exception 'Unbekannte Freigabeaktion.';
    end if;
  end if;
  return public.get_task_approval_workflow(p_task_id);
end;
$$;



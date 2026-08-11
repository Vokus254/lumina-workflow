-- Safe inbox replies without widening role-scoped task access.
-- A message recipient may read/reply to that addressed message, but does not
-- receive general access to the underlying task or its documents.

create or replace function public.mark_inbox_message_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_allowed boolean;
begin
  select exists(
    select 1
    from public.task_messages m
    left join public.role_user_assignments a
      on a.role_id=m.recipient_role_id and a.user_id=auth.uid()
    where m.id=p_message_id
      and (m.recipient_user_id=auth.uid() or a.user_id=auth.uid())
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Kein Zugriff auf diese Nachricht.';
  end if;

  insert into public.task_message_reads(message_id,user_id)
  values (p_message_id,auth.uid())
  on conflict(message_id,user_id) do nothing;

  return true;
end;
$$;

create or replace function public.reply_to_task_message(
  p_message_id uuid,
  p_body_text text
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,auth,private
as $$
declare
  v_source public.task_messages%rowtype;
  v_task_project uuid;
  v_sender_role uuid;
  v_recipient_email text;
  v_id uuid;
begin
  if length(trim(coalesce(p_body_text,'')))<1 then
    raise exception 'Bitte eine Antwort eingeben.';
  end if;

  select m.* into v_source
  from public.task_messages m
  left join public.role_user_assignments a
    on a.role_id=m.recipient_role_id and a.user_id=auth.uid()
  where m.id=p_message_id
    and (m.recipient_user_id=auth.uid() or a.user_id=auth.uid())
  limit 1;

  if v_source.id is null then
    raise exception 'Kein Zugriff auf diese Nachricht.';
  end if;

  select t.project_id into v_task_project
  from public.tasks t
  where t.id=v_source.task_id;

  -- Prefer the role to which the original message was addressed.
  if v_source.recipient_role_id is not null and exists(
    select 1 from public.role_user_assignments a
    where a.role_id=v_source.recipient_role_id and a.user_id=auth.uid()
  ) then
    v_sender_role := v_source.recipient_role_id;
  else
    select a.role_id into v_sender_role
    from public.role_user_assignments a
    join public.responsibility_roles r on r.id=a.role_id
    where a.user_id=auth.uid() and r.project_id=v_task_project
    limit 1;
  end if;

  select u.email into v_recipient_email
  from auth.users u
  where u.id=v_source.created_by;

  if v_source.created_by is null or v_recipient_email is null then
    raise exception 'Der Absender der Nachricht ist nicht mehr verfügbar.';
  end if;

  insert into public.task_messages(
    task_id,parent_message_id,message_type,recipient_email,recipient_user_id,
    recipient_role_id,sender_role_id,subject,body_text,status,created_by
  ) values (
    v_source.task_id,v_source.id,'response',v_recipient_email,v_source.created_by,
    v_source.sender_role_id,v_sender_role,
    case when v_source.subject ilike 'Antwort:%' then v_source.subject else 'Antwort: '||coalesce(nullif(trim(v_source.subject),''),'Nachricht zur Aufgabe') end,
    trim(p_body_text),'delivered',auth.uid()
  ) returning id into v_id;

  insert into public.task_message_reads(message_id,user_id)
  values (v_source.id,auth.uid())
  on conflict(message_id,user_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.mark_inbox_message_read(uuid) from public,anon;
revoke all on function public.reply_to_task_message(uuid,text) from public,anon;
grant execute on function public.mark_inbox_message_read(uuid) to authenticated;
grant execute on function public.reply_to_task_message(uuid,text) to authenticated;

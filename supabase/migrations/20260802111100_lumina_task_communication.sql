alter table public.task_messages
  add column if not exists parent_message_id uuid references public.task_messages(id) on delete set null,
  add column if not exists sender_role_id uuid references public.responsibility_roles(id) on delete set null,
  add column if not exists recipient_user_id uuid references auth.users(id) on delete set null,
  add column if not exists recipient_role_id uuid references public.responsibility_roles(id) on delete set null;

alter table public.task_messages drop constraint if exists task_messages_message_type_check;
alter table public.task_messages add constraint task_messages_message_type_check
  check(message_type in ('invitation','reminder','comment','question','response','completion'));

create index if not exists task_messages_task_created_idx
  on public.task_messages(task_id, created_at);
create index if not exists task_messages_recipient_user_idx
  on public.task_messages(recipient_user_id, created_at desc);
create index if not exists task_messages_recipient_role_idx
  on public.task_messages(recipient_role_id, created_at desc);

create table if not exists public.task_message_reads (
  message_id uuid not null references public.task_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(message_id,user_id)
);

alter table public.task_message_reads enable row level security;
create policy task_message_reads_self_select on public.task_message_reads
  for select to authenticated using(user_id=auth.uid());
revoke all on public.task_message_reads from anon;
grant select on public.task_message_reads to authenticated;

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  select exists(
    select 1 from public.tasks t
    where t.id=p_task and private.is_project_member(t.project_id)
  )
  or exists(
    select 1 from public.tasks t
    join public.role_user_assignments a on a.role_id=t.responsibility_role_id
    where t.id=p_task and a.user_id=auth.uid()
  )
  or exists(
    select 1 from public.task_messages m
    left join public.role_user_assignments a on a.role_id=m.recipient_role_id
    where m.task_id=p_task
      and (m.recipient_user_id=auth.uid() or a.user_id=auth.uid() or m.created_by=auth.uid())
  )
  or exists(
    select 1
    from public.task_invitations i
    join public.external_contacts c on c.id=i.external_contact_id
    where i.task_id=p_task and c.auth_user_id=auth.uid() and c.active and c.access_enabled
      and i.status in ('sent','opened','accepted','completed')
      and i.revoked_at is null and i.expires_at>now()
  )
$$;

create or replace function public.get_task_message_recipients(p_task_id uuid)
returns table(
  recipient_key text,
  recipient_kind text,
  recipient_role_id uuid,
  recipient_user_id uuid,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path=pg_catalog,public,auth,private
as $$
  with task_project as (
    select project_id from public.tasks where id=p_task_id and private.can_access_task(id)
  ), recipients as (
    select 'role:'||r.id::text as recipient_key, 'role'::text as recipient_kind,
           r.id as recipient_role_id, a.user_id as recipient_user_id,
           coalesce(nullif(concat_ws(' ',r.first_name,r.last_name),''),r.display_name) as display_name,
           r.email
    from public.responsibility_roles r
    join task_project p on p.project_id=r.project_id
    left join public.role_user_assignments a on a.role_id=r.id
    where r.email is not null
    union all
    select 'user:'||m.user_id::text, 'user', null::uuid, m.user_id,
           case when lower(u.email)='admin@volkerkusch.de' then 'LUMINA Administration' else coalesce(u.raw_user_meta_data->>'display_name',u.email) end,
           u.email
    from public.project_members m
    join task_project p on p.project_id=m.project_id
    join auth.users u on u.id=m.user_id
    where m.active and m.security_role in ('owner','manager')
  )
  select distinct on (email) recipient_key,recipient_kind,recipient_role_id,recipient_user_id,display_name,email
  from recipients
  where email is not null and lower(email)<>lower(coalesce(auth.jwt()->>'email',''))
  order by email,recipient_kind
$$;

create or replace function public.get_task_messages(p_task_id uuid)
returns table(
  id uuid,
  parent_message_id uuid,
  message_type text,
  subject text,
  body_text text,
  sender_user_id uuid,
  sender_role_id uuid,
  sender_name text,
  sender_email text,
  recipient_user_id uuid,
  recipient_role_id uuid,
  recipient_name text,
  recipient_email text,
  created_at timestamptz,
  is_read boolean
)
language sql
stable
security definer
set search_path=pg_catalog,public,auth,private
as $$
  select m.id,m.parent_message_id,m.message_type,m.subject,m.body_text,
         m.created_by,m.sender_role_id,
         coalesce(nullif(concat_ws(' ',sr.first_name,sr.last_name),''),
                  case when lower(su.email)='admin@volkerkusch.de' then 'LUMINA Administration' else su.email end),
         su.email,m.recipient_user_id,m.recipient_role_id,
         coalesce(nullif(concat_ws(' ',rr.first_name,rr.last_name),''),
                  case when lower(ru.email)='admin@volkerkusch.de' then 'LUMINA Administration' else ru.email end,
                  m.recipient_email),
         m.recipient_email,m.created_at,
         exists(select 1 from public.task_message_reads rd where rd.message_id=m.id and rd.user_id=auth.uid())
  from public.task_messages m
  left join auth.users su on su.id=m.created_by
  left join public.responsibility_roles sr on sr.id=m.sender_role_id
  left join auth.users ru on ru.id=m.recipient_user_id
  left join public.responsibility_roles rr on rr.id=m.recipient_role_id
  where m.task_id=p_task_id and private.can_access_task(p_task_id)
  order by m.created_at
$$;

create or replace function public.send_task_message(
  p_task_id uuid,
  p_recipient_kind text,
  p_recipient_id uuid,
  p_message_type text,
  p_subject text,
  p_body_text text,
  p_parent_message_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,auth,private
as $$
declare
  v_id uuid;
  v_project_id uuid;
  v_recipient_user uuid;
  v_recipient_role uuid;
  v_recipient_email text;
  v_sender_role uuid;
begin
  if not private.can_access_task(p_task_id) then raise exception 'Kein Zugriff auf diese Aufgabe.'; end if;
  if p_message_type not in ('comment','question','response','completion') then raise exception 'Ungültiger Nachrichtentyp.'; end if;
  if length(trim(coalesce(p_body_text,'')))<1 then raise exception 'Bitte eine Nachricht eingeben.'; end if;
  select project_id into v_project_id from public.tasks where id=p_task_id;
  select a.role_id into v_sender_role
  from public.role_user_assignments a join public.responsibility_roles r on r.id=a.role_id
  where a.user_id=auth.uid() and r.project_id=v_project_id limit 1;

  if p_recipient_kind='role' then
    select r.id,r.email,a.user_id into v_recipient_role,v_recipient_email,v_recipient_user
    from public.responsibility_roles r
    left join public.role_user_assignments a on a.role_id=r.id
    where r.id=p_recipient_id and r.project_id=v_project_id and r.email is not null limit 1;
  elsif p_recipient_kind='user' then
    select u.id,u.email into v_recipient_user,v_recipient_email
    from auth.users u join public.project_members m on m.user_id=u.id
    where u.id=p_recipient_id and m.project_id=v_project_id and m.active limit 1;
  else
    raise exception 'Bitte einen gültigen Empfänger auswählen.';
  end if;
  if v_recipient_email is null then raise exception 'Empfänger nicht gefunden.'; end if;

  insert into public.task_messages(
    task_id,parent_message_id,message_type,recipient_email,recipient_user_id,recipient_role_id,
    sender_role_id,subject,body_text,status,created_by
  ) values (
    p_task_id,p_parent_message_id,p_message_type,v_recipient_email,v_recipient_user,v_recipient_role,
    v_sender_role,coalesce(nullif(trim(p_subject),''),'Nachricht zur Aufgabe'),trim(p_body_text),'delivered',auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.mark_task_messages_read(p_task_id uuid)
returns integer
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_count integer;
begin
  insert into public.task_message_reads(message_id,user_id)
  select distinct m.id,auth.uid()
  from public.task_messages m
  left join public.role_user_assignments a on a.role_id=m.recipient_role_id
  where m.task_id=p_task_id and (m.recipient_user_id=auth.uid() or a.user_id=auth.uid())
  on conflict(message_id,user_id) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.get_my_task_inbox()
returns table(
  message_id uuid,
  task_id uuid,
  task_number text,
  task_title text,
  message_type text,
  subject text,
  body_text text,
  sender_name text,
  sender_email text,
  created_at timestamptz,
  is_read boolean
)
language sql
stable
security definer
set search_path=pg_catalog,public,auth
as $$
  select m.id,m.task_id,t.source_number,t.title,m.message_type,m.subject,m.body_text,
         coalesce(nullif(concat_ws(' ',r.first_name,r.last_name),''),
                  case when lower(u.email)='admin@volkerkusch.de' then 'LUMINA Administration' else u.email end),
         u.email,m.created_at,
         exists(select 1 from public.task_message_reads rd where rd.message_id=m.id and rd.user_id=auth.uid())
  from public.task_messages m
  join public.tasks t on t.id=m.task_id
  left join auth.users u on u.id=m.created_by
  left join public.responsibility_roles r on r.id=m.sender_role_id
  left join public.role_user_assignments a on a.role_id=m.recipient_role_id and a.user_id=auth.uid()
  where m.recipient_user_id=auth.uid() or a.user_id=auth.uid()
  order by m.created_at desc
$$;

revoke all on function public.get_task_message_recipients(uuid) from public,anon;
revoke all on function public.get_task_messages(uuid) from public,anon;
revoke all on function public.send_task_message(uuid,text,uuid,text,text,text,uuid) from public,anon;
revoke all on function public.mark_task_messages_read(uuid) from public,anon;
revoke all on function public.get_my_task_inbox() from public,anon;
grant execute on function public.get_task_message_recipients(uuid) to authenticated;
grant execute on function public.get_task_messages(uuid) to authenticated;
grant execute on function public.send_task_message(uuid,text,uuid,text,text,text,uuid) to authenticated;
grant execute on function public.mark_task_messages_read(uuid) to authenticated;
grant execute on function public.get_my_task_inbox() to authenticated;

insert into public.responsibility_roles(project_id,role_key,display_name,first_name,last_name,email,legacy_source_key)
select p.id,v.role_key,v.display_name,null,null,null,v.legacy_source_key
from public.projects p
cross join (values
  ('KAI (Bilanzbuchhalter)','KAI (Bilanzbuchhalter)','future-role-kai'),
  ('KIRA (Wirtschaftsprüferin)','KIRA (Wirtschaftsprüferin)','future-role-kira')
) as v(role_key,display_name,legacy_source_key)
where p.status in ('draft','active')
on conflict(project_id,role_key) do nothing;

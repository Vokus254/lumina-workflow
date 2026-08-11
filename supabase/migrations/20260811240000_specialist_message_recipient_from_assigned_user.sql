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
set search_path = pg_catalog, public, auth, private
as $$
  with task_project as (
    select project_id
    from public.tasks
    where id = p_task_id
      and private.can_access_task(id)
  ), recipients as (
    select
      'role:' || r.id::text as recipient_key,
      'role'::text as recipient_kind,
      r.id as recipient_role_id,
      a.user_id as recipient_user_id,
      coalesce(nullif(concat_ws(' ', r.first_name, r.last_name), ''), r.display_name) as display_name,
      coalesce(r.email, ru.email) as email
    from public.responsibility_roles r
    join task_project p on p.project_id = r.project_id
    left join public.role_user_assignments a on a.role_id = r.id
    left join auth.users ru on ru.id = a.user_id
    where coalesce(r.email, ru.email) is not null

    union all

    select
      'user:' || m.user_id::text,
      'user',
      null::uuid,
      m.user_id,
      case
        when lower(u.email) = 'admin@volkerkusch.de' then 'LUMINA Administration'
        else coalesce(u.raw_user_meta_data->>'display_name', u.email)
      end,
      u.email
    from public.project_members m
    join task_project p on p.project_id = m.project_id
    join auth.users u on u.id = m.user_id
    where m.active
      and m.security_role in ('owner', 'manager')
  )
  select distinct on (recipient_key)
    recipient_key,
    recipient_kind,
    recipient_role_id,
    recipient_user_id,
    display_name,
    email
  from recipients
  where email is not null
    and lower(email) <> lower(coalesce(auth.jwt()->>'email', ''))
  order by recipient_key, email;
$$;

revoke all on function public.get_task_message_recipients(uuid) from public, anon;
grant execute on function public.get_task_message_recipients(uuid) to authenticated;

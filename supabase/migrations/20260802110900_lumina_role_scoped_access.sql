create table public.role_user_assignments (
  role_id uuid not null references public.responsibility_roles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(role_id, user_id)
);

alter table public.role_user_assignments enable row level security;

create policy role_user_assignments_self_select
on public.role_user_assignments for select to authenticated
using(user_id = auth.uid());

grant select on public.role_user_assignments to authenticated;
revoke all on public.role_user_assignments from anon;

insert into public.role_user_assignments(role_id, user_id)
select r.id, u.id
from public.responsibility_roles r
join auth.users u on lower(u.email) = lower(r.email)
on conflict(role_id, user_id) do nothing;

create or replace function private.bootstrap_lumina_role_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.role_user_assignments(role_id, user_id)
  select r.id, new.id
  from public.responsibility_roles r
  where lower(r.email) = lower(new.email)
  on conflict(role_id, user_id) do nothing;

  delete from public.project_members m
  using public.responsibility_roles r
  where m.user_id = new.id
    and m.project_id = r.project_id
    and m.security_role = 'contributor'
    and lower(r.email) = lower(new.email);
  return new;
end;
$$;

delete from public.project_members m
using public.role_user_assignments a, public.responsibility_roles r
where a.user_id = m.user_id
  and r.id = a.role_id
  and r.project_id = m.project_id
  and m.security_role = 'contributor';

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public
as $$
  select exists(
    select 1
    from public.tasks t
    where t.id = p_task
      and private.is_project_member(t.project_id)
  )
  or exists(
    select 1
    from public.tasks t
    join public.role_user_assignments a on a.role_id = t.responsibility_role_id
    where t.id = p_task
      and a.user_id = auth.uid()
  )
  or exists(
    select 1
    from public.task_invitations i
    join public.external_contacts c on c.id=i.external_contact_id
    where i.task_id=p_task
      and c.auth_user_id=auth.uid()
      and c.active and c.access_enabled
      and i.status in ('sent','opened','accepted','completed')
      and i.revoked_at is null and i.expires_at>now()
  )
$$;

drop policy if exists roles_member_select on public.responsibility_roles;
create policy roles_access_select
on public.responsibility_roles for select to authenticated
using(
  private.is_project_member(project_id)
  or exists(
    select 1 from public.role_user_assignments a
    where a.role_id = id and a.user_id = auth.uid()
  )
);

create or replace function public.get_lumina_source_state()
returns table(project_id uuid, state jsonb, source_sha256 text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_id uuid;
  v_state jsonb;
  v_sha text;
  v_station integer;
  v_measure integer;
  v_subitem integer;
  v_rows jsonb;
begin
  select p.id into v_project_id
  from public.projects p
  where private.is_project_member(p.id)
     or exists(
       select 1
       from public.responsibility_roles r
       join public.role_user_assignments a on a.role_id = r.id
       where r.project_id = p.id and a.user_id = auth.uid()
     )
  order by p.created_at
  limit 1;

  if v_project_id is null then
    return;
  end if;

  select s.state, s.source_sha256
    into v_state, v_sha
  from public.project_source_states s
  where s.project_id = v_project_id;

  if v_state is null then
    return;
  end if;

  if not private.is_project_member(v_project_id) then
    for v_station in 0..jsonb_array_length(v_state)-1 loop
      for v_measure in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures'],'[]'::jsonb))-1 loop
        for v_subitem in 0..jsonb_array_length(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems'],'[]'::jsonb))-1 loop
          if v_state #>> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'type'] = 'pbc' then
            select coalesce(jsonb_agg(entry), '[]'::jsonb)
              into v_rows
            from jsonb_array_elements(coalesce(v_state #> array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'data','rows'],'[]'::jsonb)) entry
            where exists(
              select 1 from public.tasks t
              where t.project_id = v_project_id
                and t.source_number = entry->>0
                and private.can_access_task(t.id)
            );
            v_state := jsonb_set(
              v_state,
              array[v_station::text,'measures',v_measure::text,'subitems',v_subitem::text,'data','rows'],
              v_rows,
              false
            );
          end if;
        end loop;
      end loop;
    end loop;
  end if;

  return query select v_project_id, v_state, v_sha;
end;
$$;

revoke all on function public.get_lumina_source_state() from public, anon;
grant execute on function public.get_lumina_source_state() to authenticated;

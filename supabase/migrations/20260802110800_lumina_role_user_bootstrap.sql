create or replace function private.bootstrap_lumina_role_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  insert into public.project_members(project_id, user_id, security_role, active)
  select distinct r.project_id, new.id, 'contributor', true
  from public.responsibility_roles r
  where lower(r.email) = lower(new.email)
  on conflict(project_id, user_id) do update
    set security_role = excluded.security_role,
        active = true;
  return new;
end;
$$;

revoke all on function private.bootstrap_lumina_role_user() from public, anon, authenticated;

drop trigger if exists lumina_role_user_after_auth_user on auth.users;
create trigger lumina_role_user_after_auth_user
after insert or update of email on auth.users
for each row execute function private.bootstrap_lumina_role_user();

insert into public.project_members(project_id, user_id, security_role, active)
select distinct r.project_id, u.id, 'contributor', true
from public.responsibility_roles r
join auth.users u on lower(u.email) = lower(r.email)
on conflict(project_id, user_id) do update
  set security_role = excluded.security_role,
      active = true;

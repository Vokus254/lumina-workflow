create or replace function private.bootstrap_lumina_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if lower(new.email) = 'admin@volkerkusch.de' then
    insert into public.project_members(project_id, user_id, security_role, active)
    select p.id, new.id, 'owner', true
    from public.projects p
    on conflict(project_id, user_id) do update
      set security_role = 'owner', active = true;
  end if;
  return new;
end;
$$;

revoke all on function private.bootstrap_lumina_admin() from public, anon, authenticated;

drop trigger if exists lumina_admin_owner_after_auth_user on auth.users;
create trigger lumina_admin_owner_after_auth_user
after insert or update of email on auth.users
for each row execute function private.bootstrap_lumina_admin();

-- Backfill, falls der Benutzer bereits vor dieser Migration angelegt wurde.
insert into public.project_members(project_id, user_id, security_role, active)
select p.id, u.id, 'owner', true
from public.projects p
cross join auth.users u
where lower(u.email) = 'admin@volkerkusch.de'
on conflict(project_id, user_id) do update
  set security_role = 'owner', active = true;

-- LUMINA FIX18: definierter Vollzugriffs-/Test-Superadmin.
-- Falls der Auth-Benutzer bereits existiert, wird er in die bestehende Admin-Grenze aufgenommen.
insert into public.lumina_admins(user_id,active)
select id,true
from auth.users
where lower(email)='adminall@volkerkusch.de'
on conflict(user_id) do update set active=true;

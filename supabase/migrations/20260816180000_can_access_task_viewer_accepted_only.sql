-- WP accepted-only Security-Luecke schliessen. Minimaler, eng begrenzter Fix in
-- private.can_access_task() (SECURITY DEFINER) - dieselbe Funktion wird bereits von
-- tasks_access_select, documents_access_select UND versions_access_select genutzt, ein einziger
-- Fix deckt alle drei Tabellen serverseitig ab (keine UI-Filter-Loesung).
--
-- Wichtig: die bestehende zweite Bedingung nutzte is_project_member(p.id) OHNE Rollenfilter -
-- ein neu angelegter project_members-Eintrag mit security_role='viewer' haette darueber sofort
-- vollen, unbeschraenkten projektweiten Lesezugriff erhalten (falsch). Der bestehende Zweig wird
-- daher auf genau die vier bisherigen, dafuer vorgesehenen Rollen eingeschraenkt (identisches
-- Verhalten fuer owner/manager/contributor/reviewer, keine Aenderung), und 'viewer' bekommt einen
-- neuen, eigenen, streng eingeschraenkten dritten Zweig: nur lesen, nur wenn review_status
-- ='accepted'. Kein Schreibzugriff irgendwo veraendert (update_task_state bleibt unangetastet -
-- dessen Autorisierung nutzt bereits ausschliesslich array['owner','manager','contributor'], also
-- ohne 'viewer'). Eigene role_user_assignments-Aufgaben (vierter, unveraenderter Zweig) bleiben
-- fuer WP wie bisher unabhaengig vom review_status erreichbar.

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  -- Global LUMINA administrators may access every task.
  select private.is_lumina_admin()

  -- Direct project members (owner/manager/contributor/reviewer) and company owner/manager
  -- receive project-wide task access, but only while company/project are available to normal
  -- users. 'viewer' is intentionally excluded here - see the accepted-only branch below.
  or exists(
    select 1
    from public.tasks t
    join public.projects p on p.id=t.project_id
    join public.companies c on c.id=p.company_id
    where t.id=p_task
      and c.status='active'
      and p.status in ('active','draft')
      and (
        private.is_project_member(p.id, array['owner','manager','contributor','reviewer'])
        or private.is_company_member(p.company_id,array['owner','manager'])
      )
  )

  -- 'viewer' project members receive read-only, cross-role access ONLY to tasks that are
  -- actually accepted (review_status='accepted') - never draft/submitted/changes_required/
  -- question work. No write path exists for 'viewer' anywhere (update_task_state does not
  -- include it).
  or exists(
    select 1
    from public.tasks t
    join public.projects p on p.id=t.project_id
    join public.companies c on c.id=p.company_id
    where t.id=p_task
      and t.review_status='accepted'
      and c.status='active'
      and p.status in ('active','draft')
      and private.is_project_member(p.id, array['viewer'])
  )

  -- Responsibility-role users receive only tasks assigned to their role - unchanged, so a
  -- viewer's OWN role_user_assignments tasks remain reachable regardless of review_status.
  or exists(
    select 1
    from public.tasks t
    join public.projects p on p.id=t.project_id
    join public.companies c on c.id=p.company_id
    join public.role_user_assignments a on a.role_id=t.responsibility_role_id
    where t.id=p_task
      and a.user_id=auth.uid()
      and c.status='active'
      and p.status in ('active','draft')
  )

  -- External invited users receive only the explicitly invited task.
  or exists(
    select 1
    from public.task_invitations i
    join public.tasks t on t.id=i.task_id
    join public.projects p on p.id=t.project_id
    join public.companies co on co.id=p.company_id
    join public.external_contacts c on c.id=i.external_contact_id
    where i.task_id=p_task
      and c.auth_user_id=auth.uid()
      and c.active
      and c.access_enabled
      and co.status='active'
      and p.status in ('active','draft')
      and i.status in ('sent','opened','accepted','completed')
      and i.revoked_at is null
      and i.expires_at>now()
  )
$function$;

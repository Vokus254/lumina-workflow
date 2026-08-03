-- Paket 4: Aufgabenbezogene Zugriffsfreigabe für die Leitung Rechnungswesen
--
-- Problem:
-- Rollenbenutzer sind absichtlich keine allgemeinen Projektmitglieder. Dadurch konnte
-- die Leitung Rechnungswesen Aufgabe 82 nicht über private.can_access_task() sehen,
-- obwohl sie in der Freigabekette als nächste Instanz vorgesehen war.
--
-- Lösung:
-- Die bestehende Aufgaben-Zugriffsprüfung wird um einen eng begrenzten Lesepfad
-- für die projektbezogene Rolle "RW (Leitung)" und die Pilotaufgabe 82 ergänzt.
-- Dadurch funktionieren zugleich:
--   * get_my_pending_approvals()
--   * get_task_approval_workflow()
--   * act_task_approval()
--   * Anzeige der Aufgabe und ihrer Dokumente im rollenreduzierten Cockpit
--
-- Die eigentliche Freigabe bleibt weiterhin zusätzlich durch
-- private.is_accounting_lead() und die aktive Workflow-Stufe geschützt.

create or replace function private.can_access_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    -- Projektadministration / reguläre Projektmitgliedschaft
    exists(
      select 1
      from public.tasks t
      where t.id = p_task
        and private.is_project_member(t.project_id)
    )
    or
    -- Regulärer Aufgabenverantwortlicher
    exists(
      select 1
      from public.tasks t
      join public.role_user_assignments a
        on a.role_id = t.responsibility_role_id
      where t.id = p_task
        and a.user_id = auth.uid()
    )
    or
    -- Extern eingeladener Aufgabenbeteiligter
    exists(
      select 1
      from public.task_invitations i
      join public.external_contacts c
        on c.id = i.external_contact_id
      where i.task_id = p_task
        and c.auth_user_id = auth.uid()
        and c.active
        and c.access_enabled
        and i.status in ('sent', 'opened', 'accepted', 'completed')
        and i.revoked_at is null
        and i.expires_at > now()
    )
    or
    -- Freigabeinstanz Leitung Rechnungswesen für die Pilotaufgabe Aktive RAP.
    -- Der Zugriff ist projektbezogen und setzt eine konkrete Benutzerzuordnung
    -- zur Verantwortung "RW (Leitung)" voraus.
    exists(
      select 1
      from public.tasks t
      join public.responsibility_roles r
        on r.project_id = t.project_id
       and r.role_key = 'RW (Leitung)'
      join public.role_user_assignments a
        on a.role_id = r.id
      where t.id = p_task
        and t.source_number = '82'
        and a.user_id = auth.uid()
    );
$$;

revoke all on function private.can_access_task(uuid) from public, anon, authenticated;

comment on function private.can_access_task(uuid) is
  'Prüft Aufgaben-Zugriff für Projektmitglieder, Verantwortliche, externe Einladungen und die Leitung Rechnungswesen der Pilotaufgabe 82.';

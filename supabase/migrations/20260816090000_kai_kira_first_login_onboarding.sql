-- V13: Projektbezogener First-Login-Onboarding-Status fuer KAI.
-- Keine neue parallele Berechtigungslogik: RLS koppelt zusaetzlich an die bestehende
-- kanonische Projektberechtigung private.can_access_project(project_id) - dieselbe
-- Funktion, die bereits get_project_schedule_responsibility() und andere Projekt-weite
-- KAI/KIRA-Steuerungsdaten absichert.

create table if not exists public.user_project_onboarding (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'introduced', 'active')),
  introduced_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

comment on table public.user_project_onboarding is
  'V13: First-Login-Onboarding-Status pro Nutzer/Projekt fuer den KAI-Einfuehrungsbildschirm. Status wird ausschliesslich durch explizite Nutzeraktion fortgeschrieben, nicht durch technisches Initial-Rendern.';

alter table public.user_project_onboarding enable row level security;

create policy "user_project_onboarding_self_select"
  on public.user_project_onboarding for select
  using (user_id = auth.uid() and private.can_access_project(project_id));

create policy "user_project_onboarding_self_insert"
  on public.user_project_onboarding for insert
  with check (user_id = auth.uid() and private.can_access_project(project_id));

create policy "user_project_onboarding_self_update"
  on public.user_project_onboarding for update
  using (user_id = auth.uid() and private.can_access_project(project_id))
  with check (user_id = auth.uid() and private.can_access_project(project_id));

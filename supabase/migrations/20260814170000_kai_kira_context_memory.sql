-- LUMINA KAI/KIRA V8: explizite Projektmeilensteine und persönliches Arbeitsgedächtnis.
-- Quellenpriorität in der Anwendung: LUMINA-Fakten > gespeicherte Erinnerung > Fachwissen > KI-Empfehlung.

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_key text not null,
  label text not null,
  milestone_date date,
  status text not null default 'planned' check (status in ('planned','reached','delayed','cancelled')),
  notes text,
  source_type text not null default 'manual' check (source_type in ('manual','process_due_date','import')),
  is_key_milestone boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, milestone_key)
);

create index if not exists project_milestones_project_date_idx
  on public.project_milestones(project_id, milestone_date, sort_order);

alter table public.project_milestones enable row level security;
drop policy if exists project_milestones_access_select on public.project_milestones;
create policy project_milestones_access_select on public.project_milestones
for select to authenticated
using(private.is_project_member(project_id) or private.is_project_role_user(project_id));

grant select on public.project_milestones to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.project_milestones from authenticated;

-- Vorhandene, explizit benannte Prozess-Termine als lesbare Projektmeilensteine übernehmen.
-- Es werden nur eindeutig benannte Terminregeln aufgenommen; keine KI-generierten Daten.
insert into public.project_milestones
  (project_id, milestone_key, label, milestone_date, source_type, is_key_milestone, sort_order)
select
  d.project_id,
  'due:' || d.phase_key || ':' || md5(lower(coalesce(d.due_rule_label, d.phase_key))),
  coalesce(nullif(btrim(d.due_rule_label), ''), initcap(replace(d.phase_key, '_', ' '))),
  min(coalesce(d.due_date_override, d.due_date)),
  'process_due_date',
  bool_or(lower(coalesce(d.due_rule_label, d.phase_key)) ~ '(vorpr|hauptpr|buchung|bericht|feststellung|veröff|offenlegung)'),
  min(d.sort_order)
from public.process_step_due_dates d
where coalesce(nullif(btrim(d.due_rule_label), ''), d.phase_key) is not null
group by d.project_id, d.phase_key, d.due_rule_label
on conflict (project_id, milestone_key) do update set
  label = excluded.label,
  milestone_date = excluded.milestone_date,
  source_type = excluded.source_type,
  is_key_milestone = excluded.is_key_milestone,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.kai_kira_memories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  memory_type text not null check (memory_type in ('decision','commitment','open_point','preference','escalation','result')),
  title text not null,
  content text not null,
  status text not null default 'active' check (status in ('active','done','stale')),
  source_type text not null default 'kai_kira_chat' check (source_type in ('kai_kira_chat','manual','import')),
  source_excerpt text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) between 1 and 180),
  check (char_length(content) between 1 and 1200)
);

create index if not exists kai_kira_memories_user_project_status_idx
  on public.kai_kira_memories(user_id, project_id, status, updated_at desc);
create index if not exists kai_kira_memories_task_idx
  on public.kai_kira_memories(task_id, status) where task_id is not null;

alter table public.kai_kira_memories enable row level security;

drop policy if exists kai_kira_memories_self_select on public.kai_kira_memories;
create policy kai_kira_memories_self_select on public.kai_kira_memories
for select to authenticated
using(
  user_id = auth.uid()
  and (private.is_project_member(project_id) or private.is_project_role_user(project_id))
);

drop policy if exists kai_kira_memories_self_insert on public.kai_kira_memories;
create policy kai_kira_memories_self_insert on public.kai_kira_memories
for insert to authenticated
with check(
  user_id = auth.uid()
  and (private.is_project_member(project_id) or private.is_project_role_user(project_id))
  and (task_id is null or private.can_access_task(task_id))
);

drop policy if exists kai_kira_memories_self_update on public.kai_kira_memories;
create policy kai_kira_memories_self_update on public.kai_kira_memories
for update to authenticated
using(
  user_id = auth.uid()
  and (private.is_project_member(project_id) or private.is_project_role_user(project_id))
)
with check(
  user_id = auth.uid()
  and (private.is_project_member(project_id) or private.is_project_role_user(project_id))
  and (task_id is null or private.can_access_task(task_id))
);

drop policy if exists kai_kira_memories_self_delete on public.kai_kira_memories;
create policy kai_kira_memories_self_delete on public.kai_kira_memories
for delete to authenticated
using(
  user_id = auth.uid()
  and (private.is_project_member(project_id) or private.is_project_role_user(project_id))
);

grant select, insert, update, delete on public.kai_kira_memories to authenticated;
revoke truncate, references, trigger on public.kai_kira_memories from authenticated;

comment on table public.kai_kira_memories is
  'Persönliches, projektbezogenes KAI/KIRA-Arbeitsgedächtnis. Nur sechs fachlich relevante Erinnerungstypen; keine vollständigen Chatprotokolle.';
comment on table public.project_milestones is
  'Explizite Projektmeilensteine. Automatisch aus vorhandenen Prozess-Terminregeln ableitbare Einträge sind als source_type=process_due_date gekennzeichnet.';

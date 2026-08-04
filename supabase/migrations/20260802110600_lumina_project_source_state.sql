create table public.project_source_states (
  project_id uuid primary key references public.projects(id) on delete cascade,
  state jsonb not null,
  source_sha256 text not null,
  updated_at timestamptz not null default now()
);

alter table public.project_source_states enable row level security;

create policy project_source_states_member_select
on public.project_source_states for select to authenticated
using(private.is_project_member(project_id));

revoke all on public.project_source_states from anon;
grant select on public.project_source_states to authenticated;


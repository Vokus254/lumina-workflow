create table if not exists public.task_ai_interactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  assistant_key text not null check (assistant_key in ('KAI','KIRA')),
  request_text text not null,
  response_text text not null,
  model text not null,
  document_ids uuid[] not null default '{}',
  created_by_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists task_ai_interactions_task_created_idx
  on public.task_ai_interactions(task_id, created_at desc);

alter table public.task_ai_interactions enable row level security;

drop policy if exists task_ai_interactions_access_select on public.task_ai_interactions;
create policy task_ai_interactions_access_select on public.task_ai_interactions
  for select to authenticated using(private.can_access_task(task_id));

revoke all on public.task_ai_interactions from anon;
grant select on public.task_ai_interactions to authenticated;

create or replace function public.record_task_ai_interaction(
  p_task_id uuid,
  p_assistant_key text,
  p_request_text text,
  p_response_text text,
  p_model text,
  p_document_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_project_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.'; end if;
  if p_assistant_key not in ('KAI','KIRA') then raise exception 'Unbekannter Assistent.'; end if;
  if coalesce(trim(p_response_text),'')='' then raise exception 'Leere Antwort kann nicht gespeichert werden.'; end if;

  select project_id into v_project_id
  from public.tasks
  where id=p_task_id and private.can_access_task(id);

  if v_project_id is null then raise exception 'Kein Zugriff auf diese Aufgabe.'; end if;

  insert into public.task_ai_interactions(
    project_id,task_id,assistant_key,request_text,response_text,model,document_ids,created_by_user_id
  ) values (
    v_project_id,p_task_id,p_assistant_key,coalesce(nullif(trim(p_request_text),''),'Vollständige Aufgabenanalyse'),
    p_response_text,p_model,coalesce(p_document_ids,'{}'),auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_task_ai_interaction(uuid,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.record_task_ai_interaction(uuid,text,text,text,text,uuid[]) to authenticated;

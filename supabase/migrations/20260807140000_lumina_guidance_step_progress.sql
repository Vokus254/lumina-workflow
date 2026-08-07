-- Anleitungs-Fortschritt serverseitig, statt nur im Browser.
--
-- Ausgangslage: die Haken der Vier-Block-Ansicht (was_ist_zu_tun) landeten bisher in
-- stations[..].guidanceChecks - also im Speicher und bestenfalls im localStorage.
-- project_source_states hat nur "grant select", und beim Anmelden ueberschreibt der
-- Serverstand die lokalen stations. Der Fortschritt war damit weder geraeteuebergreifend
-- noch teamfaehig.
--
-- Warum nicht task_work_step_progress mitbenutzen:
--   Jene Tabelle haengt an task_work_steps.id, also an einer Zeile je Schritt. Die
--   Anleitungsschritte stehen dagegen als jsonb-Array in process_step_guidance.was_ist_zu_tun
--   und haben keine IDs. Um die vorhandene Tabelle zu nutzen, muesste der Anleitungstext in
--   task_work_steps dupliziert werden - dieselbe Doppelablage, die dieser Umbau abschafft.
--   Uebernommen wird deshalb das Muster (Fortschritt je Schritt und Nutzer), nicht die Tabelle.
--
-- Adressiert wird ueber die Position im Array. Damit ein spaeter geaenderter Anleitungstext
-- keinen Haken still auf einen anderen Schritt schiebt, wird der Text mitgehasht: passt der
-- Hash nicht mehr, zaehlt der Haken als nicht gesetzt. Lieber ein Haken verschwindet, als
-- dass er an der falschen Stelle steht.

create table if not exists public.process_step_guidance_progress (
  process_step_id uuid not null references public.process_steps(id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  step_text_hash text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (process_step_id, step_index, user_id)
);

comment on table public.process_step_guidance_progress is
  'Abgehakte Schritte aus process_step_guidance.was_ist_zu_tun, je Nutzer.';
comment on column public.process_step_guidance_progress.step_text_hash is
  'Hash des Schritttextes zum Zeitpunkt des Hakens (vom Client berechnet, nicht kryptografisch - dient nur der Drift-Erkennung). Stimmt er nicht mehr mit dem aktuellen Text ueberein, wird der Haken ignoriert.';

alter table public.process_step_guidance_progress enable row level security;

-- Gleicher Zuschnitt wie task_work_step_progress: jeder sieht seinen eigenen Fortschritt.
-- Eine spaetere Team-Sicht waere eine zusaetzliche Policy, keine Aenderung am Datenmodell.
drop policy if exists guidance_progress_self_select on public.process_step_guidance_progress;
create policy guidance_progress_self_select on public.process_step_guidance_progress
  for select to authenticated using(user_id = auth.uid());

revoke all on public.process_step_guidance_progress from anon;
grant select on public.process_step_guidance_progress to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.process_step_guidance_progress from authenticated;

-- Schreiben nur ueber RPC - gleiche Linie wie der uebrige Datenbestand.
create or replace function public.set_guidance_step_completed(
  p_process_step_id uuid,
  p_step_index integer,
  p_step_text_hash text,
  p_completed boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.';
  end if;
  if p_step_index is null or p_step_index < 0 then
    raise exception 'Ungueltiger Schrittindex.';
  end if;
  if p_step_text_hash is null or length(btrim(p_step_text_hash)) = 0 then
    raise exception 'Schrittkennung fehlt.';
  end if;
  if not private.can_access_process_step(p_process_step_id) then
    raise exception 'Kein Zugriff auf diesen Prozessschritt.';
  end if;

  insert into public.process_step_guidance_progress
    (process_step_id, step_index, user_id, step_text_hash, completed, completed_at, updated_at)
  values
    (p_process_step_id, p_step_index, auth.uid(), btrim(p_step_text_hash), p_completed,
     case when p_completed then now() end, now())
  on conflict (process_step_id, step_index, user_id) do update set
    step_text_hash = excluded.step_text_hash,
    completed = excluded.completed,
    completed_at = excluded.completed_at,
    updated_at = now();

  return p_completed;
end $$;

revoke all on function public.set_guidance_step_completed(uuid,integer,text,boolean) from public, anon;
grant execute on function public.set_guidance_step_completed(uuid,integer,text,boolean) to authenticated;

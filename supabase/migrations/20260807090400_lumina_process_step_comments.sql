-- Pilot 202-Kacheln-Architektur, Schritt 5 von 7: Kommentare je Kachel.
--
-- Anker ist immer der Prozessschritt. Ein Kommentar zu einer einzelnen Datei ist ein
-- Kommentar am Schritt mit gesetztem document_id - dadurch gibt es nur eine Tabelle und
-- nur einen Ort, an dem gesucht werden muss. Die Kachel zeigt alle Kommentare ihres
-- Schritts, ein Filter auf document_id liefert den Faden zu einer Datei.
--
-- parent_comment_id ist von Anfang an vorhanden, obwohl heute nur ein Nutzer schreibt.
-- Nachtraeglich eingefuehrte Threads haetten eine Migration bestehender Kommentare
-- erzwungen; als nullable Spalte kostet die Vorbereitung nichts.
--
-- Abgrenzung zu vorhandenen Tabellen:
--   task_messages          - E-Mail-Versand an externe Beteiligte, anderer Zweck.
--   document_reviews.comment - Pruefvermerk mit Statuswirkung auf ein Dokument.
--   Diese Tabelle ist die formlose Notiz an der Kachel ohne Statuswirkung.
--
-- Bewusst noch nicht enthalten: Bearbeiten eines Kommentars, Erwaehnungen, Reaktionen,
-- Lesebestaetigungen. Externe Beteiligte (task_invitations) duerfen weder lesen noch
-- schreiben - die Freigabe fuer Externe ist eine eigene Entscheidung.

create table if not exists public.process_step_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  process_step_id uuid not null references public.process_steps(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  parent_comment_id uuid references public.process_step_comments(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 10000),
  author_user_id uuid references auth.users(id),
  author_external_contact_id uuid references public.external_contacts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (author_user_id is not null or author_external_contact_id is not null)
);

create index if not exists process_step_comments_step_idx
  on public.process_step_comments(process_step_id, created_at);
create index if not exists process_step_comments_document_idx
  on public.process_step_comments(document_id, created_at)
  where document_id is not null;
create index if not exists process_step_comments_thread_idx
  on public.process_step_comments(parent_comment_id)
  where parent_comment_id is not null;

comment on table public.process_step_comments is
  'Kommentare an einer Kachel. document_id gesetzt = Kommentar zu einer einzelnen Datei dieser Kachel.';
comment on column public.process_step_comments.deleted_at is
  'Weiches Loeschen. Die Zeile bleibt erhalten, damit Antworten in einem Faden ihren Bezugspunkt behalten.';

alter table public.process_step_comments enable row level security;

-- Lesen darf, wer den Prozessschritt sehen darf - ohne den Task-Zweig, denn der
-- oeffnet ueber task_invitations auch externen Beteiligten den Zugang.
drop policy if exists step_comments_access_select on public.process_step_comments;
create policy step_comments_access_select on public.process_step_comments for select to authenticated
using(exists(
  select 1 from public.process_steps s
  where s.id = process_step_id
    and (private.is_project_member(s.project_id) or private.is_project_role_user(s.project_id))));

grant select on public.process_step_comments to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.process_step_comments from authenticated;

-- ---------------------------------------------------------------------------
-- Schreiben ausschliesslich ueber RPC - gleiche Linie wie der uebrige Datenbestand
-- (siehe 20260802110100_lumina_access.sql: "Mutationen bleiben serverseitigen RPCs
-- vorbehalten"). Damit kann kein Aufrufer project_id oder Autor faelschen.
-- ---------------------------------------------------------------------------
create or replace function public.add_process_step_comment(
  p_process_step_id uuid,
  p_body text,
  p_document_id uuid default null,
  p_parent_comment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_comment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Anmeldung erforderlich.';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'Der Kommentar darf nicht leer sein.';
  end if;
  if length(btrim(p_body)) > 10000 then
    raise exception 'Der Kommentar ist laenger als 10000 Zeichen.';
  end if;
  if not private.can_access_process_step(p_process_step_id) then
    raise exception 'Kein Zugriff auf diesen Prozessschritt.';
  end if;

  select s.project_id into v_project_id
  from public.process_steps s
  where s.id = p_process_step_id;

  -- Ein Dateibezug muss zu genau dieser Kachel gehoeren, sonst haengt der Kommentar
  -- an einer Datei, die in der Kachel gar nicht sichtbar ist.
  if p_document_id is not null then
    if not exists (
      select 1
      from public.documents d
      left join public.tasks t on t.id = d.task_id
      left join public.dataroom_folders f on f.id = d.folder_id
      where d.id = p_document_id
        and d.project_id = v_project_id
        and (t.process_step_id = p_process_step_id or f.process_step_id = p_process_step_id)
    ) then
      raise exception 'Das Dokument gehoert nicht zu diesem Prozessschritt.';
    end if;
  end if;

  if p_parent_comment_id is not null then
    if not exists (
      select 1 from public.process_step_comments c
      where c.id = p_parent_comment_id
        and c.process_step_id = p_process_step_id
        and c.deleted_at is null
    ) then
      raise exception 'Der uebergeordnete Kommentar gehoert nicht zu diesem Prozessschritt.';
    end if;
  end if;

  insert into public.process_step_comments
    (project_id, process_step_id, document_id, parent_comment_id, body, author_user_id)
  values
    (v_project_id, p_process_step_id, p_document_id, p_parent_comment_id, btrim(p_body), v_user_id)
  returning id into v_comment_id;

  return v_comment_id;
end $$;

revoke all on function public.add_process_step_comment(uuid,text,uuid,uuid) from public, anon;
grant execute on function public.add_process_step_comment(uuid,text,uuid,uuid) to authenticated;

-- Weiches Loeschen durch den Verfasser oder die Projektleitung.
create or replace function public.delete_process_step_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_author uuid;
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'Anmeldung erforderlich.';
  end if;

  select c.author_user_id, c.project_id into v_author, v_project_id
  from public.process_step_comments c
  where c.id = p_comment_id and c.deleted_at is null;

  if v_project_id is null then
    raise exception 'Kommentar nicht gefunden.';
  end if;
  if v_author is distinct from v_user_id
     and not private.is_project_member(v_project_id, array['owner','manager']) then
    raise exception 'Nur der Verfasser oder die Projektleitung kann diesen Kommentar loeschen.';
  end if;

  update public.process_step_comments
  set deleted_at = now(), updated_at = now()
  where id = p_comment_id;
end $$;

revoke all on function public.delete_process_step_comment(uuid) from public, anon;
grant execute on function public.delete_process_step_comment(uuid) to authenticated;

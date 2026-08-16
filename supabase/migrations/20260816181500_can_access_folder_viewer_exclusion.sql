-- Ergaenzung zur WP accepted-only Security-Luecke (siehe vorige Migration). documents_access_select
-- prueft can_access_task(task_id) OR can_access_folder(folder_id) - can_access_folder hatte
-- denselben, hier bereits bekannten Fehler: is_project_member(f.project_id) OHNE Rollenfilter in
-- ihrem ersten Zweig gewaehrte einem neu angelegten security_role='viewer'-Mitglied unconditional
-- Zugriff auf JEDEN Datenraumordner des Projekts - unabhaengig vom review_status der zugehoerigen
-- Aufgabe. Live get_wp_access_test bestaetigt: ohne diesen Fix war ein Dokument einer NICHT
-- akzeptierten fremden Aufgabe fuer WP trotzdem sichtbar (ueber den Ordner, nicht ueber die
-- Aufgabe). Minimaler Fix: derselbe Rollenfilter wie in can_access_task, 'viewer' ausgeschlossen -
-- Dokumentsichtbarkeit fuer 'viewer' haengt dadurch ausschliesslich noch vom (bereits korrekt
-- accepted-only gesicherten) task_folder_assignments-Zweig ab, der intern can_access_task nutzt.

create or replace function private.can_access_folder(p_folder uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists(select 1 from public.dataroom_folders f where f.id=p_folder and private.is_project_member(f.project_id, array['owner','manager','contributor','reviewer']))
  or exists(select 1 from public.task_folder_assignments a where a.folder_id=p_folder and private.can_access_task(a.task_id))
  or exists(
    select 1 from public.dataroom_folders f
    where f.id = p_folder
      and f.process_step_id is not null
      and private.is_project_role_user(f.project_id)
  )
$function$;

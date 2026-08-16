-- Korrektur: "create or replace function" auf update_task_state (vorherige Migration) hat die
-- Funktion mit den Postgres-Standardrechten neu anlegen lassen (EXECUTE an PUBLIC, damit auch an
-- anon) statt die zuvor engeren, projektueblichen Rechte zu behalten. Vergleichbare RPCs wie
-- save_task_progress haben nur service_role/authenticated/postgres. Die Funktion selbst haette
-- anon ohnehin wegen auth.uid()=null immer abgewiesen (LUMINA_ACCESS_DENIED), aber unnoetiger
-- anon-Zugriff auf eine schreibende SECURITY-DEFINER-Funktion ist trotzdem zu vermeiden.

revoke execute on function public.update_task_state(uuid, text, text, text, date, boolean) from public;
revoke execute on function public.update_task_state(uuid, text, text, text, date, boolean) from anon;
grant execute on function public.update_task_state(uuid, text, text, text, date, boolean) to authenticated;

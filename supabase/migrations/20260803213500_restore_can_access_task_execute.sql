-- Restore authenticated access to the central task access check.
-- The function itself continues to enforce task-level authorization.

grant execute on function private.can_access_task(uuid) to authenticated;

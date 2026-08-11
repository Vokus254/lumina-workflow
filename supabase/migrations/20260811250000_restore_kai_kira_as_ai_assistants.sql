-- KAI und KIRA sind KI-Assistenten, keine menschlichen Workflow-Empfänger.
delete from public.role_user_assignments a
using public.responsibility_roles r
where a.role_id = r.id
  and (r.role_key like 'KAI%' or r.role_key like 'KIRA%');

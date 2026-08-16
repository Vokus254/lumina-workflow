import type { createClient } from "@/lib/supabase/client";

// Abschluss-Chat V1 + V14: einzige Stelle, die update_task_state aus React aufruft. Die RPC prueft
// Autorisierung selbst (private.is_project_member(...,['owner','manager','contributor'])) - kein
// neuer Berechtigungscode hier, nur ein gemeinsam genutzter Client-Aufruf statt zweier getrennter
// Implementierungen (workflow-shell.tsx und die neue Bearbeiter-Chat-Shell).
export async function submitTaskStatus(
  supabase: ReturnType<typeof createClient>,
  taskId: string,
  workStatus: string,
  reviewStatus: string,
) {
  return supabase.rpc("update_task_state", {
    p_task_id: taskId,
    p_work_status: workStatus,
    p_review_status: reviewStatus,
  });
}

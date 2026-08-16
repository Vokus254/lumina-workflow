import type { createClient } from "@/lib/supabase/client";

// Abschluss-Chat V1 + V14: einzige Stelle, die update_task_state aus React aufruft. Die RPC prueft
// Autorisierung selbst (project_members ODER role_user_assignments fuer genau diese Aufgabe) und
// verbietet Selbst-Review (P1-A) - kein neuer Berechtigungscode hier, nur ein gemeinsam genutzter
// Client-Aufruf statt zweier getrennter Implementierungen (workflow-shell.tsx und die
// Bearbeiter-Chat-Shell).
//
// P1-B: ein reiner Status-Update (kein Formular mit Kommentar/Fristueberschreibung) darf
// internal_comment/due_date_override NICHT loeschen. update_task_state kann "Parameter weggelassen"
// nicht von "Parameter bewusst NULL" unterscheiden, daher der explizite, standardmaessig
// abwaertskompatible Parameter p_touch_comment_and_due (RPC-Default true = bisheriges
// Voll-Save-Verhalten fuer Legacy). Diese Hilfsfunktion setzt ihn bewusst auf false, weil sie
// ausschliesslich fuer Status-only-Aufrufe genutzt wird.
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
    p_touch_comment_and_due: false,
  });
}

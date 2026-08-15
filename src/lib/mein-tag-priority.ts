// Gemeinsame Priorisierung fuer "Mein Tag" - genutzt sowohl im Client (workflow-shell.tsx, echte
// "Mein Tag"-Ansicht) als auch serverseitig im 0-Token-KAI/KIRA-Start (assistant-workspace/route.ts),
// damit "Als Naechstes offen" beim Oeffnen des Drawers exakt dieselbe fachliche Reihenfolge zeigt
// wie "Mein Tag" selbst - keine zweite, abweichende Priorisierungslogik.

export type MeinTagPriorityTask = {
  dueDate?: string | null;
  workStatus: string;
  reviewStatus: string;
  processStepCode?: string | null;
  sourceNumber?: string | null;
  title: string;
};

export function meinTagPriorityRank(task: MeinTagPriorityTask, todayIso: string, weekEndIso: string): number {
  if (task.reviewStatus === "changes_required" || task.reviewStatus === "question") return 0;
  if (task.dueDate && task.dueDate < todayIso) return 1;
  if (task.dueDate === todayIso) return 2;
  if (task.dueDate && task.dueDate <= weekEndIso) return 3;
  return 4;
}

export function sortMeinTagTasks<T extends MeinTagPriorityTask>(tasks: T[], todayIso: string, weekEndIso: string): T[] {
  return [...tasks].sort((a, b) =>
    meinTagPriorityRank(a, todayIso, weekEndIso) - meinTagPriorityRank(b, todayIso, weekEndIso)
    || String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"))
    || String(a.processStepCode || a.sourceNumber || a.title).localeCompare(String(b.processStepCode || b.sourceNumber || b.title), "de", { numeric: true }));
}

export function weekEndIsoFrom(todayIso: string): string {
  const weekEnd = new Date(`${todayIso}T12:00:00`);
  weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));
  return weekEnd.toISOString().slice(0, 10);
}

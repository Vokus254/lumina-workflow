// Terminmatrix-Autorisierung: eine Aufgabenzeile ist nur klickbar, wenn die Task-ID in der Menge
// der für den aktuellen Nutzer laut tasks_access_select-RLS tatsächlich zugreifbaren Task-IDs
// enthalten ist. Die IDs werden bewusst auf der Nachricht selbst gespeichert (nicht als separater
// globaler State), damit ein aus sessionStorage wiederhergestellter Chatverlauf dieselbe
// Autorisierung zeigt wie beim ursprünglichen Laden - siehe workflow-shell.tsx loadFullScheduleMatrix().

export function resolveAccessibleTaskIdSet(matrixAccessibleTaskIds: string[] | undefined | null): Set<string> {
  return new Set(matrixAccessibleTaskIds || []);
}

export function isMatrixTaskRowAuthorized(
  row: { type: string; taskId: string | null },
  accessibleTaskIds: Set<string>,
): boolean {
  return row.type === "task" && Boolean(row.taskId) && accessibleTaskIds.has(row.taskId as string);
}

// Abschluss-Chat V1: strukturelle (nicht semantische) Abhaengigkeits-Ableitung fuer die
// "blockiert/wartet auf"-Chips aus dem Mockup. Es gibt (noch) keine echte task_dependencies-Tabelle
// (siehe V15-Architekturentscheidung/STOPP-Vorschlag) - diese Funktion erfindet daher KEINE
// konkreten Cross-Task-Verweise wie im Mockup ("#70 blockiert 4.4"), sondern leitet ausschliesslich
// aus der Reihenfolge der Aufgaben INNERHALB DESSELBEN uebergeordneten Prozessschritts ab, welche
// Aufgabe aktuell "dran" ist. Das Ergebnis ist bewusst als "strukturell/vorlaeufig" gekennzeichnet,
// nicht als LUMINA-Fakt ueber echte fachliche Abhaengigkeiten.

export type StructuralDependency = { kind: "blocks" | "waits" | "free"; label: string };

export type DependencyTaskInput = {
  id: string;
  parentStepId: string | null;
  sortKey: string;
  workStatus: string;
};

const DONE_STATUSES = new Set(["completed", "submitted"]);

export function deriveStructuralDependencies<T extends DependencyTaskInput>(tasks: T[]): Map<string, StructuralDependency> {
  const byParent = new Map<string, T[]>();
  for (const task of tasks) {
    const key = task.parentStepId || "__none__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(task);
  }

  const result = new Map<string, StructuralDependency>();
  for (const group of byParent.values()) {
    if (group.length < 2) {
      for (const task of group) result.set(task.id, { kind: "free", label: "keine weitere Aufgabe in diesem Prozessschritt" });
      continue;
    }
    const sorted = [...group].sort((a, b) => a.sortKey.localeCompare(b.sortKey, "de", { numeric: true }));
    const firstOpenIndex = sorted.findIndex((task) => !DONE_STATUSES.has(task.workStatus));
    sorted.forEach((task, index) => {
      if (DONE_STATUSES.has(task.workStatus)) {
        result.set(task.id, { kind: "free", label: "erledigt" });
        return;
      }
      if (firstOpenIndex === -1 || index === firstOpenIndex) {
        const laterOpen = sorted.slice(index + 1).some((other) => !DONE_STATUSES.has(other.workStatus));
        result.set(task.id, laterOpen
          ? { kind: "blocks", label: "an der Reihe · weitere Aufgaben dieses Schritts folgen danach" }
          : { kind: "free", label: "an der Reihe · keine weitere Aufgabe wartet" });
      } else {
        result.set(task.id, { kind: "waits", label: "wartet strukturell auf eine vorherige Aufgabe desselben Prozessschritts" });
      }
    });
  }
  return result;
}

import { describe, expect, it } from "vitest";
import { deriveStructuralDependencies } from "./task-dependency";

describe("deriveStructuralDependencies", () => {
  it("markiert eine alleinstehende Aufgabe (kein Geschwister im selben Prozessschritt) als frei", () => {
    const result = deriveStructuralDependencies([{ id: "a", parentStepId: "step-1", sortKey: "10", workStatus: "open" }]);
    expect(result.get("a")).toEqual({ kind: "free", label: "keine weitere Aufgabe in diesem Prozessschritt" });
  });

  it("die erste offene Aufgabe einer Gruppe mit weiteren offenen Nachfolgern blockiert", () => {
    const result = deriveStructuralDependencies([
      { id: "a", parentStepId: "step-1", sortKey: "10", workStatus: "open" },
      { id: "b", parentStepId: "step-1", sortKey: "20", workStatus: "open" },
    ]);
    expect(result.get("a")?.kind).toBe("blocks");
    expect(result.get("b")?.kind).toBe("waits");
  });

  it("bereits erledigte/eingereichte Aufgaben sind immer 'free', unabhängig von der Position", () => {
    const result = deriveStructuralDependencies([
      { id: "a", parentStepId: "step-1", sortKey: "10", workStatus: "completed" },
      { id: "b", parentStepId: "step-1", sortKey: "20", workStatus: "submitted" },
    ]);
    expect(result.get("a")?.kind).toBe("free");
    expect(result.get("b")?.kind).toBe("free");
  });

  it("überspringt erledigte Vorgänger und markiert die erste tatsächlich offene Aufgabe als blockierend", () => {
    const result = deriveStructuralDependencies([
      { id: "a", parentStepId: "step-1", sortKey: "10", workStatus: "completed" },
      { id: "b", parentStepId: "step-1", sortKey: "20", workStatus: "open" },
      { id: "c", parentStepId: "step-1", sortKey: "30", workStatus: "open" },
    ]);
    expect(result.get("a")?.kind).toBe("free");
    expect(result.get("b")?.kind).toBe("blocks");
    expect(result.get("c")?.kind).toBe("waits");
  });

  it("die letzte offene Aufgabe einer Gruppe ohne offene Nachfolger ist frei, nicht blockierend", () => {
    const result = deriveStructuralDependencies([
      { id: "a", parentStepId: "step-1", sortKey: "10", workStatus: "completed" },
      { id: "b", parentStepId: "step-1", sortKey: "20", workStatus: "open" },
    ]);
    expect(result.get("b")?.kind).toBe("free");
  });

  it("Aufgaben ohne parentStepId werden trotzdem konsistent gruppiert (__none__-Gruppe)", () => {
    const result = deriveStructuralDependencies([
      { id: "a", parentStepId: null, sortKey: "1", workStatus: "open" },
      { id: "b", parentStepId: null, sortKey: "2", workStatus: "open" },
    ]);
    expect(result.get("a")?.kind).toBe("blocks");
    expect(result.get("b")?.kind).toBe("waits");
  });
});

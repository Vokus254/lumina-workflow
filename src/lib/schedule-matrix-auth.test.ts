import { describe, expect, it } from "vitest";
import { isMatrixTaskRowAuthorized, resolveAccessibleTaskIdSet } from "./schedule-matrix-auth";

describe("resolveAccessibleTaskIdSet", () => {
  it("builds a set from the message's own accessible task ids", () => {
    const set = resolveAccessibleTaskIdSet(["a", "b"]);
    expect(set.has("a")).toBe(true);
    expect(set.has("c")).toBe(false);
  });

  it("returns an empty set when the message never stored accessible task ids", () => {
    expect(resolveAccessibleTaskIdSet(undefined).size).toBe(0);
    expect(resolveAccessibleTaskIdSet(null).size).toBe(0);
  });
});

describe("isMatrixTaskRowAuthorized", () => {
  it("authorizes a task row whose id is in the accessible set (own task)", () => {
    const accessible = resolveAccessibleTaskIdSet(["own-task-125"]);
    expect(isMatrixTaskRowAuthorized({ type: "task", taskId: "own-task-125" }, accessible)).toBe(true);
  });

  it("does not authorize a task row whose id is missing from the accessible set (someone else's task)", () => {
    const accessible = resolveAccessibleTaskIdSet(["own-task-125"]);
    expect(isMatrixTaskRowAuthorized({ type: "task", taskId: "other-task-124" }, accessible)).toBe(false);
  });

  it("never authorizes non-task rows (milestones, process dates) even if the id happens to match", () => {
    const accessible = resolveAccessibleTaskIdSet(["milestone-1"]);
    expect(isMatrixTaskRowAuthorized({ type: "milestone", taskId: "milestone-1" }, accessible)).toBe(false);
  });

  it("regression: a matrix message restored from sessionStorage (no live global auth state) still authorizes the owner's own tasks", () => {
    // Reproduces the bug fixed in this commit: accessibleTaskIds used to live only in a global
    // React state that resets to an empty Set on remount/session restore, while the matrix
    // message content itself was restored from sessionStorage - so every row, including the
    // user's own authorized tasks, appeared non-clickable after reopening KAI/KIRA.
    // Fix: accessible task ids are now embedded on the message itself and derived from that,
    // never from a separate global state that can go stale independently of the message.
    const restoredMessage = { matrixAccessibleTaskIds: ["ddb45b0e-324a-5f31-8d68-07307925aab0"] };
    const accessible = resolveAccessibleTaskIdSet(restoredMessage.matrixAccessibleTaskIds);
    expect(isMatrixTaskRowAuthorized({ type: "task", taskId: "ddb45b0e-324a-5f31-8d68-07307925aab0" }, accessible)).toBe(true);
    expect(isMatrixTaskRowAuthorized({ type: "task", taskId: "e847a99c-816b-5ec0-a86d-9a054cd56599" }, accessible)).toBe(false);
  });
});

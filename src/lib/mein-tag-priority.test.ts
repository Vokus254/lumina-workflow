import { describe, expect, it } from "vitest";
import { sortMeinTagTasks, weekEndIsoFrom } from "./mein-tag-priority";

const TODAY = "2026-08-15";
const WEEK_END = weekEndIsoFrom(TODAY);

describe("sortMeinTagTasks", () => {
  it("ranks Rueckfrage/Nachbesserung above overdue, overdue above due-today, due-today above this-week, this-week above the rest", () => {
    const rest = { title: "Rest", processStepCode: "9.9", workStatus: "open", reviewStatus: "unreviewed", dueDate: null };
    const thisWeek = { title: "Diese Woche", processStepCode: "9.8", workStatus: "open", reviewStatus: "unreviewed", dueDate: WEEK_END };
    const dueToday = { title: "Heute", processStepCode: "9.7", workStatus: "open", reviewStatus: "unreviewed", dueDate: TODAY };
    const overdue = { title: "Ueberfaellig", processStepCode: "9.6", workStatus: "open", reviewStatus: "unreviewed", dueDate: "2026-08-01" };
    const reviewIssue = { title: "Rueckfrage", processStepCode: "9.5", workStatus: "open", reviewStatus: "question", dueDate: "2099-01-01" };

    const sorted = sortMeinTagTasks([rest, thisWeek, dueToday, overdue, reviewIssue], TODAY, WEEK_END);

    expect(sorted.map((t) => t.title)).toEqual(["Rueckfrage", "Ueberfaellig", "Heute", "Diese Woche", "Rest"]);
  });

  it("uses the earliest due date as tiebreaker within the same priority tier", () => {
    const later = { title: "Spaeter faellig", processStepCode: "1.1", workStatus: "open", reviewStatus: "unreviewed", dueDate: "2026-08-02" };
    const earlier = { title: "Frueher faellig", processStepCode: "1.2", workStatus: "open", reviewStatus: "unreviewed", dueDate: "2026-08-01" };
    const sorted = sortMeinTagTasks([later, earlier], TODAY, WEEK_END);
    expect(sorted.map((t) => t.title)).toEqual(["Frueher faellig", "Spaeter faellig"]);
  });

  it("does not mutate the input array", () => {
    const tasks = [
      { title: "B", processStepCode: "2", workStatus: "open", reviewStatus: "unreviewed", dueDate: "2026-08-02" },
      { title: "A", processStepCode: "1", workStatus: "open", reviewStatus: "unreviewed", dueDate: "2026-08-01" },
    ];
    const original = [...tasks];
    sortMeinTagTasks(tasks, TODAY, WEEK_END);
    expect(tasks).toEqual(original);
  });
});

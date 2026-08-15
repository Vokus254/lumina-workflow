import { describe, it, expect } from "vitest";
import { resolveStepLookupPlan, specialToolParentCode, isSpecialToolStep, resolveToolTitle } from "./special-tools";

// Regressionsschutz für den V12-Fehler: "gehe zu Kachel 1.7" öffnete fälschlich Phase 1, "öffne
// 3.17" öffnete fälschlich Phase 3, weil specialToolParentCode() blind auf JEDEN mehrteiligen Code
// angewendet wurde. resolveStepLookupPlan() darf einen Elterncode nur vorschlagen, wenn der Code
// selbst ein bekannter Unterwerkzeug-Schlüssel ist.
describe("resolveStepLookupPlan", () => {
  it("liefert für gewöhnliche Prozesscodes ausschließlich den exakten Code, keinen Elterncode", () => {
    expect(resolveStepLookupPlan("1")).toEqual({ exactCode: "1", parentFallbackCode: null });
    expect(resolveStepLookupPlan("1.1")).toEqual({ exactCode: "1.1", parentFallbackCode: null });
    expect(resolveStepLookupPlan("1.6")).toEqual({ exactCode: "1.6", parentFallbackCode: null });
    expect(resolveStepLookupPlan("1.7")).toEqual({ exactCode: "1.7", parentFallbackCode: null });
    expect(resolveStepLookupPlan("3")).toEqual({ exactCode: "3", parentFallbackCode: null });
    expect(resolveStepLookupPlan("3.17")).toEqual({ exactCode: "3.17", parentFallbackCode: null });
    expect(resolveStepLookupPlan("4.4")).toEqual({ exactCode: "4.4", parentFallbackCode: null });
  });

  it("liefert einen Elterncode-Fallback ausschließlich für bekannte Unterwerkzeug-Codes", () => {
    expect(resolveStepLookupPlan("3.17.1")).toEqual({ exactCode: "3.17.1", parentFallbackCode: "3.17" });
    expect(resolveStepLookupPlan("3.17.2")).toEqual({ exactCode: "3.17.2", parentFallbackCode: "3.17" });
    expect(resolveStepLookupPlan("4.4.1")).toEqual({ exactCode: "4.4.1", parentFallbackCode: "4.4" });
  });

  it("erfindet für unbekannte Codes keinen Elterncode, auch wenn das Muster passen würde", () => {
    // "3.17.9" sieht wie ein Unterwerkzeug-Code aus, ist aber keiner - kein Fallback erlaubt.
    expect(resolveStepLookupPlan("3.17.9")).toEqual({ exactCode: "3.17.9", parentFallbackCode: null });
  });
});

describe("specialToolParentCode (Baustein, nicht mehr direkt für die Codeauflösung genutzt)", () => {
  it("extrahiert den Elterncode aus einem drei-teiligen Code", () => {
    expect(specialToolParentCode("3.17.1")).toBe("3.17");
  });
});

// Regressionsschutz: "öffne 3.17" lieferte vor dem Fix tool.title=null, im Workspace wörtlich als
// "3.17 · null" gerendert, weil SPECIAL_TOOL_SUBITEMS nur Titel für Unterwerkzeuge kennt.
describe("resolveToolTitle", () => {
  it("nutzt den Prozessschrittnamen als Fallback für Top-Level-Werkzeugcodes", () => {
    expect(resolveToolTitle("3.17", "Erstellung Summen- und Saldenliste")).toBe("Erstellung Summen- und Saldenliste");
    expect(resolveToolTitle("4.4", "Erstellung Rohbilanz und Roh-GuV")).toBe("Erstellung Rohbilanz und Roh-GuV");
  });

  it("bevorzugt den bekannten Unterwerkzeug-Titel vor dem Prozessschrittnamen", () => {
    expect(resolveToolTitle("3.17.1", "Erstellung Summen- und Saldenliste")).toBe("SuSa hochladen");
  });

  it("liefert niemals null, wenn ein Schrittname vorhanden ist - kein '· null' im UI", () => {
    expect(resolveToolTitle("3.17", "Irgendein Name")).not.toBeNull();
  });

  it("liefert null nur, wenn weder ein bekannter Titel noch ein Schrittname vorliegt", () => {
    expect(resolveToolTitle("3.17", null)).toBeNull();
    expect(resolveToolTitle(null, "Name")).toBeNull();
  });
});

describe("isSpecialToolStep", () => {
  it("erkennt nur die fünf definierten Spezialwerkzeug-Schritte", () => {
    expect(isSpecialToolStep("3.17")).toBe(true);
    expect(isSpecialToolStep("3.17.1")).toBe(false);
    expect(isSpecialToolStep("1.7")).toBe(false);
  });
});

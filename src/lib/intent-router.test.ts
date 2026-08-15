import { describe, it, expect } from "vitest";
import { isFullMatrixRequest, routeIntent, needsExplicitFocus, isExplicitProjectRequest } from "./intent-router";

describe("routeIntent", () => {
  it("erkennt volle Terminmatrix-Anfragen", () => {
    expect(routeIntent("Zeig mir die vollständige Terminmatrix")).toEqual({ kind: "fullSchedule" });
    expect(isFullMatrixRequest("gesamte Terminmatrix")).toBe(true);
  });

  it("erkennt exakte Kachel-/Aufgabenreferenzen aus Navigationsformulierungen", () => {
    expect(routeIntent("gehe zu Kachel 1.7")).toEqual({ kind: "measure", ref: "1.7" });
    expect(routeIntent("öffne 3.17")).toEqual({ kind: "measure", ref: "3.17" });
    expect(routeIntent("öffne 3.17.1")).toEqual({ kind: "measure", ref: "3.17.1" });
    expect(routeIntent("zeige Aufgabe 29")).toEqual({ kind: "measure", ref: "29" });
    expect(routeIntent("zeige mir 3.17.1")).toEqual({ kind: "measure", ref: "3.17.1" });
    expect(routeIntent("wo ist Aufgabe 29")).toEqual({ kind: "measure", ref: "29" });
    expect(routeIntent("gehe zu Maßnahme 125")).toEqual({ kind: "measure", ref: "125" });
  });

  it("gibt bei Navigation NIE eine verkürzte Referenz zurück (Regressionsschutz)", () => {
    // Der eigentliche V12-Bug lag in assistant-workspace (specialToolParentCode wurde blind
    // angewendet), aber der Router selbst darf ebenfalls niemals selbst kürzen - "1.7" bleibt
    // "1.7", nicht "1"; "3.17" bleibt "3.17", nicht "3".
    expect(routeIntent("gehe zu Kachel 1.7")).toEqual({ kind: "measure", ref: "1.7" });
    expect(routeIntent("öffne 3.17")).not.toEqual({ kind: "measure", ref: "3" });
  });

  it("fällt bei nicht-numerischer Navigation auf Suche zurück", () => {
    expect(routeIntent("öffne Saldenliste")).toEqual({ kind: "search", query: "Saldenliste" });
  });

  it("liefert null für normale Sparring-Fragen ohne Navigationsverb", () => {
    expect(routeIntent("Was hat heute Priorität?")).toBeNull();
    expect(routeIntent("Reicht das für den WP?")).toBeNull();
  });
});

describe("needsExplicitFocus", () => {
  it("erkennt Review-Fragen, die ohne Bezugsobjekt nicht beantwortbar sind", () => {
    expect(needsExplicitFocus("Reicht das für den WP?")).toBe(true);
    expect(needsExplicitFocus("Ist das vollständig?")).toBe(true);
    expect(needsExplicitFocus("Was fehlt noch?")).toBe(true);
  });

  it("löst nicht bei operativen oder projektweiten Fragen aus", () => {
    expect(needsExplicitFocus("Was hat jetzt Priorität?")).toBe(false);
    expect(needsExplicitFocus("Wo droht mir ein Engpass?")).toBe(false);
  });
});

describe("isExplicitProjectRequest", () => {
  it("erkennt ausdrücklich projektweite Formulierungen", () => {
    expect(isExplicitProjectRequest("Bewerte den gesamten Jahresabschluss")).toBe(true);
    expect(isExplicitProjectRequest("Gib mir eine Gesamtbeurteilung des Abschlussprojekts")).toBe(true);
  });

  it("löst nicht bei einer einzelnen Aufgabenfrage aus", () => {
    expect(isExplicitProjectRequest("Reicht das für den WP?")).toBe(false);
  });
});

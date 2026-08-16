import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORKSPACE_COMPONENT_REGISTRY } from "./workspace-registry";

// V14: Conversational Workspace. Wie bei den vorherigen V12/V13-Regressionstests gibt es (bewusst)
// keine React-/DOM-Testinfrastruktur - diese Tests pruefen strukturell auf Quelltextebene die drei
// zentralen Garantien aus der Aufgabenstellung: (1) der klassische Desktop wird im neuen Modus
// tatsaechlich ausgeblendet statt nur ueberlagert, (2) Statusaenderungen an Aufgaben laufen
// ausschliesslich ueber einen expliziten Button-Klick, nie automatisch, (3) die Registry ist mit
// den tatsaechlich implementierten Kartentypen konsistent.

const SHELL_SOURCE = readFileSync(new URL("./workflow-shell.tsx", import.meta.url), "utf8");
const WORKSPACE_SOURCE = readFileSync(new URL("./kai-workspace.tsx", import.meta.url), "utf8");

describe("V14 Conversational Workspace: Desktop-Fallback bleibt sauber getrennt", () => {
  it("Desktop-Navigation (aside/main/Floating-Button) wird im docked Modus ausgeblendet, nicht nur uebermalt", () => {
    expect(SHELL_SOURCE).toContain('{!dockedConversational ? <aside className={styles.nav}>');
    expect(SHELL_SOURCE).toContain('{!dockedConversational ? <main className=');
    expect(SHELL_SOURCE).toContain('{!dockedConversational ? <button type="button" className={styles.sparringGlobalButton}');
  });

  it("'Desktop öffnen' und 'Zurück zu KAI' setzen denselben desktopMode-State um (kein Datenverlust, kein Reload)", () => {
    expect(SHELL_SOURCE).toContain("setDesktopMode(true)");
    expect(SHELL_SOURCE).toContain('onClick={() => setDesktopMode(false)}');
    expect(SHELL_SOURCE).toContain(">Zurück zu KAI<");
  });

  it("das Sparring-Panel wird im docked Modus erzwungen offen gehalten, nur ueber einen State-Effekt (kein LLM-Aufruf darin)", () => {
    const effectBodies = SHELL_SOURCE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];
    const dockedEffect = effectBodies.find((body) => body.includes("if (dockedConversational) setSparringOpen(true);"));
    expect(dockedEffect).toBeDefined();
    expect(dockedEffect).not.toMatch(/askSparring\(|advanceOnboarding\(/);
  });
});

describe("V14 Aufgaben-Mini-App: Statusaktionen nur per explizitem Klick", () => {
  it("onSetTaskStatus wird ausschliesslich aus einem Button-onClick in der Aufgaben-Mini-App aufgerufen", () => {
    const callSites = WORKSPACE_SOURCE.match(/onSetTaskStatus\(/g) || [];
    // genau 1 Stelle: der tatsaechliche Aufruf im onClick des Statusbuttons. Die Prop-Weiterreichung
    // (`onSetTaskStatus={onSetTaskStatus}`) ist kein Funktionsaufruf und matcht bewusst nicht.
    expect(callSites.length).toBe(1);
    expect(WORKSPACE_SOURCE).toMatch(/onClick=\{\(\) => onSetTaskStatus\(/);
  });

  it("handleSetTaskStatus im Shell ruft die geteilte, autorisierende RPC-Hilfsfunktion auf - keine neue/doppelte Berechtigungslogik", () => {
    expect(SHELL_SOURCE).toContain("submitTaskStatus(supabase, taskId, workStatus, reviewStatus)");
    // update_task_state selbst wird nur noch an genau einer Stelle im ganzen Projekt aufgerufen:
    // src/lib/task-status.ts. workflow-shell.tsx und die Bearbeiter-Chat-Shell teilen sich diese
    // eine Implementierung statt sie zu duplizieren.
    const taskStatusSource = readFileSync(new URL("../../lib/task-status.ts", import.meta.url), "utf8");
    const rpcSites = taskStatusSource.match(/\.rpc\("update_task_state"/g) || [];
    expect(rpcSites.length).toBe(1);
    expect(SHELL_SOURCE).not.toContain('.rpc("update_task_state"');
  });
});

describe("V14 Workspace-Registry", () => {
  it("jeder Registry-Eintrag ist eindeutig (kein doppelter type)", () => {
    const types = WORKSPACE_COMPONENT_REGISTRY.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("als 'implemented' markierte Kartentypen kommen tatsaechlich im WorkspaceCard-Unionstyp vor (oder sind bewusst separat dokumentiert, z. B. 'schedule' als Matrix statt WorkspaceCard)", () => {
    const cardTypeUnion = WORKSPACE_SOURCE.slice(WORKSPACE_SOURCE.indexOf("export type WorkspaceCard ="), WORKSPACE_SOURCE.indexOf("function formatGermanDate"));
    const cardTypeNameByRegistryType: Partial<Record<string, string>> = { task: "measure", review: "measure", process: "processSteps" };
    // "schedule" wird nicht als WorkspaceCard, sondern ueber die separate ScheduleMatrixTable
    // (message.matrix) gerendert - kein WorkspaceCard-Unionmitglied, siehe loadFullScheduleMatrix.
    const renderedOutsideCardUnion = new Set(["schedule"]);
    for (const entry of WORKSPACE_COMPONENT_REGISTRY.filter((item) => item.implemented)) {
      if (renderedOutsideCardUnion.has(entry.type)) continue;
      const cardTypeName = cardTypeNameByRegistryType[entry.type] || entry.type;
      expect(cardTypeUnion).toContain(`"${cardTypeName}"`);
    }
  });
});
